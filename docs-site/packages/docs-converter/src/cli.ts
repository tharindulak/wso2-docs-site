#!/usr/bin/env node
// wso2-docs: check or convert a WSO2 docs source for the docs site. Run it inside the content repo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadConfig, ConfigError, type SourceConfig } from './config.js';
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

check     converts every page in memory and reports pages that would not reach the site;
          with --release-tag and --version-folder it also warns when the release's version has no folder
convert   writes dist/docs/ (pages and images), dist/sidebar.json and dist/manifest.json

Exit codes: 0 all pages convert (or are on the exclude list), 1 new failures or bad lifecycle stage values in front matter,
            2 usage or config error. Front matter that is not valid YAML is a warning.`;

interface Args { command?: string; config: string; root: string; out: string; format: 'text' | 'github' | 'json'; releaseTag?: string; versionFolder?: string }

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
    else if (a === '--format') {
      const f = value();
      if (f !== 'text' && f !== 'github' && f !== 'json') throw new ConfigError('--format must be text, github or json');
      args.format = f;
    } else if (a === '--help' || a === '-h') args.command = 'help';
    else if (a === '--version' || a === '-v') args.command = 'version';
    else if (!a.startsWith('-') && !args.command) args.command = a;
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

function gitCommit(root: string): string | null {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === 'help') { process.stdout.write(`${HELP}\n`); return args.command ? 0 : 2; }
  if (args.command === 'version') { process.stdout.write(`${VERSION}\n`); return 0; }
  if (args.command !== 'check' && args.command !== 'convert') throw new ConfigError(`Unknown command: ${args.command}`);

  const root = path.resolve(args.root);
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
