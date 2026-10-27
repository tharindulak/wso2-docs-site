#!/usr/bin/env node
// wso2-docs: check or convert a WSO2 docs source for the docs site. Run it inside the content repo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';
import { loadConfig, ConfigError, type SourceConfig } from './config.js';
import { parseReleaseBranch, nextTag, findManifest, collectBundle, type BundleProblem } from './bundle.js';
import { parseNav, parseSection, sidebarToNav } from './manifest.js';
import { loadSidebarFile } from './site.js';
import { zipEntries } from './zip.js';
import { convertSource, CONTRACT_VERSION } from './source.js';
import { mkdocsSite } from './mkdocs-config.js';
import type { SiteReport } from './site.js';

const require = createRequire(import.meta.url);
const VERSION = (require('../../package.json') as { version: string }).version;

const HELP = `wso2-docs ${VERSION}: convert WSO2 MkDocs or Docusaurus docs for the WSO2 docs site

Usage:
  wso2-docs check   [--config wso2-docs.yaml] [--root .] [--format text|github|json]
                    [--release-tag v7.4.0 --version-folder en/identity-server/{version}]
  wso2-docs convert [--config wso2-docs.yaml] [--root .] [--out dist] [--format text|github|json]
  wso2-docs bundle  --branch release/<component>/<x.y.z> [--root .] [--format text|github]
                    (--check-only | --commit <sha> --tags <file> --out <dir>)
  wso2-docs manifest init [--config wso2-docs.yaml] [--root .] --id <section id> --prefix <v|component/v>
                    --section-version <x.y.z|latest> [--label <label>] [--write]

check     converts every page in memory and reports pages that would not reach the site;
          with --release-tag and --version-folder it also warns when the release's version has no folder
convert   writes dist/docs/ (pages and images), dist/sidebar.json and dist/manifest.json
bundle    checks the section the release branch releases (its wso2-docs.yaml) and, unless --check-only, writes
          <out>/<section>-<version>.docs.zip, its .sha256 and bundle.json (tag, asset, title, sha256)
manifest init  adds section and nav (from the sidebars file) to a Docusaurus section's wso2-docs.yaml

Exit codes: 0 all pages convert (or are on the exclude list), 1 new failures or bad lifecycle stage values in front matter,
            2 usage or config error. Front matter that is not valid YAML is a warning.`;

interface Args {
  command?: string; sub?: string; config: string; root: string; out: string; format: 'text' | 'github' | 'json'; releaseTag?: string; versionFolder?: string;
  branch?: string; commit?: string; tags?: string; checkOnly?: boolean; write?: boolean; id?: string; label?: string; prefix?: string; sectionVersion?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { config: 'wso2-docs.yaml', root: '.', out: 'dist', format: 'text' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const value = (): string => { const v = argv[++i]; if (!v) throw new ConfigError(`${a} needs a value`); return v; };
    if (a === '--config') args.config = value();
    else if (a === '--root') args.root = value();
    else if (a === '--out') args.out = value();
    else if (a === '--release-tag') args.releaseTag = value();
    else if (a === '--version-folder') args.versionFolder = value();
    else if (a === '--branch') args.branch = value();
    else if (a === '--commit') args.commit = value();
    else if (a === '--tags') args.tags = value();
    else if (a === '--check-only') args.checkOnly = true;
    else if (a === '--write') args.write = true;
    else if (a === '--id') args.id = value();
    else if (a === '--label') args.label = value();
    else if (a === '--prefix') args.prefix = value();
    else if (a === '--section-version') args.sectionVersion = value();
    else if (a === '--format') {
      const f = value();
      if (f !== 'text' && f !== 'github' && f !== 'json') throw new ConfigError('--format must be text, github or json');
      args.format = f;
    } else if (a === '--help' || a === '-h') args.command = 'help';
    else if (a === '--version' || a === '-v') args.command = 'version';
    else if (!a.startsWith('-') && !args.command) args.command = a;
    else if (!a.startsWith('-') && args.command === 'manifest' && !args.sub) args.sub = a;
    else throw new ConfigError(`Unknown argument: ${a}`);
  }
  return args;
}

/** Where a page's source file lives, relative to the repo (for annotations). */
function sourceFileOf(cfg: SourceConfig, root: string, page: string): string {
  const candidates: string[] = [];
  const docsOf = (mkdocs?: string): string | null => (mkdocs ? mkdocsSite(path.join(root, mkdocs)).docsDir : null);
  if (cfg.kind === 'docusaurus' && cfg.docs) candidates.push(path.join(root, cfg.docs, page));
  for (const d of [docsOf(cfg.mkdocs), docsOf(cfg.cloud?.mkdocs), docsOf(cfg.self_hosted?.mkdocs)]) if (d) candidates.push(path.join(d, page));
  const hit = candidates.find((f) => fs.existsSync(f)) ?? candidates[0] ?? page;
  return path.relative(root, hit).replace(/\\/g, '/');
}

function report(r: SiteReport, cfg: SourceConfig, root: string, excluded: string[], format: Args['format']): number {
  const known = new Set(excluded);
  const fresh = r.failures.filter((f) => !known.has(f.page));
  // Bad lifecycle stage values fail the check (the page itself still converts); invalid front-matter YAML warns.
  const lifecycle = (r.frontMatter ?? []).filter((p) => p.kind === 'lifecycle');
  const yamlWarnings = (r.frontMatter ?? []).filter((p) => p.kind === 'yaml');
  const failed = fresh.length + lifecycle.length > 0;
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify({ ok: r.ok, failures: r.failures, newFailures: fresh.length, nowPassing: r.nowPassing, droppedNav: r.droppedNav, frontMatter: r.frontMatter ?? [] }, null, 2)}\n`);
    return failed ? 1 : 0;
  }
  const print = (level: 'error' | 'warning', page: string, kind: string, error: string): void => {
    const file = sourceFileOf(cfg, root, page);
    const line = error.match(/\(line (\d+)\)/)?.[1];
    if (format === 'github') {
      const message = `${kind}: ${error}`.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      process.stdout.write(`::${level} file=${file}${line ? `,line=${line}` : ''},title=wso2-docs ${kind}::${message}\n`);
    } else {
      process.stdout.write(`${level === 'error' ? '✖' : '⚠'} ${file}${line ? `:${line}` : ''}\n    ${kind.padEnd(8)} ${error}\n`);
    }
  };
  for (const f of fresh) print('error', f.page, f.kind, f.error);
  for (const p of lifecycle) print('error', p.page, p.kind, p.error);
  for (const p of yamlWarnings) print('warning', p.page, p.kind, p.error);
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
  const summary = `${r.ok} pages convert · ${plural(fresh.length, 'new failure')}`
    + (lifecycle.length ? ` · ${plural(lifecycle.length, 'lifecycle problem')}` : '')
    + (yamlWarnings.length ? ` · ${plural(yamlWarnings.length, 'front matter warning')}` : '')
    + (excluded.length ? ` · ${excluded.length} on the exclude list` : '')
    + (r.nowPassing.length ? ` · ${r.nowPassing.length} excluded page${r.nowPassing.length === 1 ? '' : 's'} now convert: remove from the list` : '')
    + (r.droppedNav.length ? ` · ${r.droppedNav.length} nav entries point at missing pages` : '');
  process.stdout.write(`${failed ? '' : '✔ '}${summary}\n`);
  return failed ? 1 : 0;
}

/** Warn (never fail) when a docs release tag names a version whose folder is missing from the source. */
function checkReleaseFolder(root: string, tag: string, pattern: string): void {
  const version = tag.match(/^(?:.*\/)?v(\d+\.\d+\.\d+)(?:\.\d+)?$/)?.[1];
  if (!version) throw new ConfigError(`--release-tag ${tag} is not v<version> or <component>/v<version>`);
  if (!pattern.includes('{version}')) throw new ConfigError('--version-folder must contain {version}');
  const folder = pattern.replace(/\{version\}/g, version);
  const abs = path.resolve(root, folder);
  if (!abs.startsWith(root + path.sep)) throw new ConfigError('--version-folder must stay inside the repository');
  if (!fs.existsSync(abs)) process.stderr.write(`warning: release ${tag} has no folder ${folder}\n`);
}

function annotate(format: Args['format'], level: 'error' | 'warning', file: string, kind: string, message: string): void {
  if (format === 'github') {
    const text = `${kind}: ${message}`.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    process.stdout.write(`::${level} file=${file},title=wso2-docs ${kind}::${text}\n`);
  } else {
    process.stdout.write(`${level === 'error' ? '✖' : '⚠'} ${file}\n    ${kind.padEnd(8)} ${message}\n`);
  }
}

/** `bundle`: check the release branch's section and pack its docs bundle. */
async function bundle(args: Args, root: string): Promise<number> {
  if (!args.branch) throw new ConfigError('bundle needs --branch');
  if (args.format === 'json') throw new ConfigError('bundle prints text or github annotations');
  const { component, version } = parseReleaseBranch(args.branch);
  const manifestFile = findManifest(root, component);
  const cfg = loadConfig(path.join(root, manifestFile), root);
  if (!cfg.section) throw new ConfigError(`${manifestFile} has no section`);
  if (cfg.section.version !== version) throw new ConfigError(`section.version ${cfg.section.version} in ${manifestFile} does not match branch ${args.branch}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wso2-docs-bundle-'));
  let checked: number;
  try {
    const { report: r } = await convertSource(cfg, root, { outDir: path.join(tmp, 'docs'), exclude: cfg.excludeList });
    const missingNav = r.droppedNav.splice(0); // nav pages that do not exist fail a bundle (check only counts them)
    checked = report(r, cfg, root, cfg.excludeList, args.format);
    for (const page of missingNav) annotate(args.format, 'error', manifestFile, 'navigation', `nav page ${page} does not exist under ${cfg.docs}`);
    if (missingNav.length) checked = 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const files = collectBundle(root, manifestFile, cfg);
  for (const p of files.problems) annotate(args.format, 'error', p.file, p.kind, p.detail);
  const problems: BundleProblem[] = files.problems;
  if (checked !== 0 || problems.length) return 1;
  if (args.checkOnly) {
    if (args.format === 'text') process.stdout.write(`✔ ${manifestFile}: ${files.files.length} files would be bundled\n`);
    return 0;
  }

  if (!args.commit || !/^[0-9a-f]{40}$/.test(args.commit)) throw new ConfigError('bundle needs --commit with a 40-character commit (or --check-only)');
  if (!args.out) throw new ConfigError('bundle needs --out');
  const tags = args.tags ? fs.readFileSync(path.resolve(args.tags), 'utf8').split('\n').map((t) => t.trim()).filter(Boolean) : [];
  const prefix = cfg.section.release_tag;
  const tag = nextTag(prefix, version, tags);
  const tagVersion = tag.slice(prefix.length);
  const asset = `${cfg.section.id}-${tagVersion}.docs.zip`;
  const raw = yaml.load(fs.readFileSync(path.join(root, manifestFile), 'utf8'), { schema: yaml.JSON_SCHEMA }) as Record<string, unknown> & { section: Record<string, unknown> };
  raw.section = { ...raw.section, source_commit: args.commit };
  const entries = [
    ...files.files.map((name) => ({ name, data: fs.readFileSync(path.join(root, name)) })),
    ...Object.entries(files.generated).map(([name, data]) => ({ name, data })),
    { name: 'wso2-docs.yaml', data: Buffer.from(yaml.dump(raw, { lineWidth: -1, noRefs: true })) },
  ];
  // Generated files replace the checkout's copy at the same path.
  const byName = new Map(entries.map((e) => [e.name, e]));
  const zip = zipEntries([...byName.values()]);
  const sha256 = createHash('sha256').update(zip).digest('hex');
  const out = path.resolve(args.out);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, asset), zip);
  fs.writeFileSync(path.join(out, `${asset}.sha256`), `${sha256}  ${asset}\n`);
  const info = {
    section: cfg.section.id, title: `${cfg.section.label ?? cfg.section.id} ${tagVersion}`, version, tag, asset, sha256,
    source_commit: args.commit, manifest: manifestFile, files: byName.size,
  };
  fs.writeFileSync(path.join(out, 'bundle.json'), `${JSON.stringify(info, null, 2)}\n`);
  if (args.format === 'text') process.stdout.write(`Wrote ${asset} (${byName.size} files, sha256 ${sha256}) for ${tag}\n`);
  return 0;
}

/** `manifest init`: add section and nav to a Docusaurus section's wso2-docs.yaml, from its sidebars file. */
function manifestInit(args: Args, root: string): number {
  if (args.sub !== 'init') throw new ConfigError('Usage: wso2-docs manifest init --id <id> --prefix <v|component/v> --section-version <x.y.z|latest>');
  const file = path.resolve(root, args.config);
  const cfg = loadConfig(file, root);
  if (cfg.kind !== 'docusaurus' || !cfg.docs) throw new ConfigError('manifest init supports kind: docusaurus sections');
  if (!cfg.sidebar || !cfg.sidebar.endsWith('.json')) throw new ConfigError('manifest init reads a sidebars .json file (a .ts/.js sidebar would run code)');
  const section = parseSection({ id: args.id, ...(args.label ? { label: args.label } : {}), version: args.sectionVersion, release_tag: args.prefix });
  const [, items = []] = Object.entries(loadSidebarFile(path.join(root, cfg.sidebar)))[0] ?? [];
  const { nav, problems } = sidebarToNav(items, root, cfg.docs);
  parseNav(nav);
  const raw = yaml.load(fs.readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>;
  delete raw.sidebar;
  const text = yaml.dump({ ...raw, section, nav }, { lineWidth: -1, noRefs: true });
  for (const p of problems) process.stderr.write(`warning: ${p}\n`);
  if (args.write) fs.writeFileSync(file, text);
  else process.stdout.write(text);
  return problems.length ? 1 : 0;
}

function gitCommit(root: string): string | null {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === 'help') { process.stdout.write(`${HELP}\n`); return args.command ? 0 : 2; }
  if (args.command === 'version') { process.stdout.write(`${VERSION}\n`); return 0; }
  const root = path.resolve(args.root);
  if (args.command === 'bundle') return bundle(args, root);
  if (args.command === 'manifest') return manifestInit(args, root);
  if (args.command !== 'check' && args.command !== 'convert') throw new ConfigError(`Unknown command: ${args.command}`);

  const cfg = loadConfig(path.resolve(root, args.config), root);

  if (args.command === 'check') {
    if (!args.releaseTag !== !args.versionFolder) throw new ConfigError('--release-tag and --version-folder go together');
    if (args.releaseTag && args.versionFolder) checkReleaseFolder(root, args.releaseTag, args.versionFolder);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wso2-docs-check-'));
    try {
      const { report: r } = await convertSource(cfg, root, { outDir: path.join(tmp, 'docs'), exclude: cfg.excludeList });
      return report(r, cfg, root, cfg.excludeList, args.format);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // convert: refuse to clear a directory this tool did not create.
  const out = path.resolve(root, args.out);
  if (out === root || !out.startsWith(root + path.sep)) throw new ConfigError('--out must be a folder inside the repository');
  if (fs.existsSync(out) && fs.readdirSync(out).length && !fs.existsSync(path.join(out, 'manifest.json'))) {
    throw new ConfigError(`${args.out} exists and was not written by wso2-docs; choose another --out`);
  }
  fs.rmSync(out, { recursive: true, force: true });
  const result = await convertSource(cfg, root, { outDir: path.join(out, 'docs'), exclude: cfg.excludeList });
  fs.writeFileSync(path.join(out, 'sidebar.json'), `${JSON.stringify({ [result.sidebarId]: result.sidebar }, null, 2)}\n`);
  const manifest = {
    contract: CONTRACT_VERSION,
    converter: { name: '@wso2/docs-converter', version: VERSION },
    source: { commit: gitCommit(root), kind: cfg.kind, route: cfg.route },
    pages: { converted: result.report.ok, failed: result.report.failures.map((f) => f.page), excluded: cfg.excludeList },
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const code = report(result.report, cfg, root, cfg.excludeList, args.format);
  if (args.format === 'text') process.stdout.write(`Wrote ${path.relative(process.cwd(), out) || '.'}/ (docs, sidebar.json, manifest.json)\n`);
  return code;
}

main().then((code) => { process.exitCode = code; }, (e: unknown) => {
  process.stderr.write(`wso2-docs: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = e instanceof ConfigError ? 2 : 1;
});
