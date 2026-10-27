// Docs bundles: which section a release branch releases, its next tag, and the files a bundle carries. A bundle is
// self-contained: the version's pages, the files they reference inside the section (or its include folders), and
// the version's own redirects. Anything leaving that, symlinks and code files stop the bundle.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ConfigError, type SourceConfig } from './config.js';
import { outsideCode } from './syntax.js';

export const LIMITS = { bytes: 200 * 1024 * 1024, files: 20_000 };

export interface BundleProblem { kind: 'outside' | 'symlink' | 'executable' | 'navigation' | 'limit'; file: string; detail: string }
export interface BundleFiles {
  /** Repo-relative files copied from the checkout, sorted. */
  files: string[];
  /** Repo-relative files the bundle writes itself (the version's redirects). */
  generated: Record<string, Buffer>;
  problems: BundleProblem[];
}

const COMPONENT = '[a-z0-9][a-z0-9-]*';
const BRANCH = new RegExp(`^(?:refs/heads/)?release/(?:(${COMPONENT})/)?(\\d+\\.\\d+\\.\\d+|latest)$`);

/** `release/<component>/<x.y.z>`, `release/<x.y.z>`, `release/latest` or `release/<component>/latest`. */
export function parseReleaseBranch(branch: string): { component: string | null; version: string } {
  const m = branch.match(BRANCH);
  if (!m) throw new ConfigError(`${branch} is not a release branch: release/<component>/<x.y.z>, release/<x.y.z> or release/latest`);
  return { component: m[1] ?? null, version: m[2]! };
}

const prefixOf = (component: string | null): string => (component ? `${component}/v` : 'v');
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * The tag this push publishes. A version's first release is `<prefix><x.y.z>`; later ones add a fourth segment one
 * above the highest so far. `latest` releases are dated (UTC) `<prefix><YYYY.MM.DD>`, then `.1`, `.2` that day.
 */
export function nextTag(prefix: string, version: string, existing: string[], now = new Date()): string {
  const base = version === 'latest'
    ? `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, '0')}.${String(now.getUTCDate()).padStart(2, '0')}`
    : version;
  const re = new RegExp(`^${escape(prefix + base)}(?:\\.(\\d+))?$`);
  let highest = -1;
  for (const t of existing) {
    const m = t.match(re);
    if (m) highest = Math.max(highest, m[1] ? Number(m[1]) : 0);
  }
  return highest < 0 ? `${prefix}${base}` : `${prefix}${base}.${highest + 1}`;
}

function readYaml(file: string): unknown {
  try { return yaml.load(fs.readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA }); } catch { return null; }
}

const SKIP_DIRS =new Set(['.git', 'node_modules', '.docusaurus', 'build', 'dist', 'site']);

/** The one `wso2-docs.yaml` whose `section.release_tag` is the branch component's prefix (repo-relative path). */
export function findManifest(root: string, component: string | null): string {
  const prefix = prefixOf(component);
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(rel); continue; }
      if (e.name !== 'wso2-docs.yaml') continue;
      const raw = readYaml(path.join(root, rel)) as { section?: { release_tag?: unknown } } | null;
      if (raw?.section?.release_tag === prefix) hits.push(rel);
    }
  };
  walk('');
  if (hits.length === 0) throw new ConfigError(`no wso2-docs.yaml releases with prefix ${prefix} (section.release_tag)`);
  if (hits.length > 1) throw new ConfigError(`${hits.length} wso2-docs.yaml files release with prefix ${prefix}: ${hits.sort().join(', ')}`);
  return hits[0]!;
}

const CODE = /\.(?:[cm]?[jt]sx?)$/i;
// Relative targets in Markdown links and images, JSX src, and MDX/JS imports.
const REF = /\]\(\s*<?([^)\s>#?]+)|\bsrc=\{?["']([^"'#?]+)|\bfrom\s+["'](\.[^"']+)["']|require\(\s*["'](\.[^"']+)["']\s*\)/g;

/**
 * Files for a bundle of the section `manifestFile` describes (repo-relative). The section folder is the manifest's
 * folder; pages come from `docs`; referenced files must be in the section folder or a `section.include` folder.
 */
export function collectBundle(root: string, manifestFile: string, cfg: SourceConfig, limits = LIMITS): BundleFiles {
  const problems: BundleProblem[] = [];
  const files = new Set<string>();
  const generated: Record<string, Buffer> = {};
  const realRoot = fs.realpathSync(root);
  const sectionDir = path.posix.dirname(manifestFile);
  const allowed = [sectionDir, ...(cfg.section?.include ?? [])].map((d) => (d === '.' ? '' : d.replace(/\/$/, '')));
  const inAllowed = (rel: string): boolean => allowed.some((d) => d === '' || rel === d || rel.startsWith(`${d}/`));

  if (!cfg.nav) problems.push({ kind: 'navigation', file: manifestFile, detail: 'a bundle needs nav in wso2-docs.yaml (sidebar files are not read)' });
  if (cfg.sidebar && CODE.test(cfg.sidebar)) problems.push({ kind: 'executable', file: cfg.sidebar, detail: 'sidebars written as code are not accepted' });

  const docsDir = cfg.kind === 'docusaurus' ? cfg.docs : undefined;
  if (!docsDir) throw new ConfigError('bundles support kind: docusaurus sections for now');
  if (!inAllowed(docsDir)) problems.push({ kind: 'outside', file: docsDir, detail: 'docs folder is outside the section folder' });

  const walk = (dir: string): void => {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isSymbolicLink()) problems.push({ kind: 'symlink', file: rel, detail: 'symbolic links are not packed' });
      else if (e.isDirectory()) walk(rel);
      else if (e.isFile()) files.add(rel);
    }
  };
  walk(docsDir.replace(/\/$/, ''));

  for (const page of [...files].filter((f) => /\.mdx?$/.test(f)).sort()) {
    const text = fs.readFileSync(path.join(root, page), 'utf8');
    const refs: string[] = [];
    outsideCode(text, (prose) => { for (const m of prose.matchAll(REF)) refs.push(m[1] ?? m[2] ?? m[3] ?? m[4]!); return prose; });
    for (const raw of refs) {
      let ref: string;
      try { ref = decodeURI(raw); } catch { ref = raw; }
      if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('/') || ref.startsWith('@')) continue; // URLs, site paths, aliases
      const abs = path.resolve(realRoot, path.posix.dirname(page), ref);
      const rel = path.relative(realRoot, abs).split(path.sep).join('/');
      if (rel.startsWith('..') || path.isAbsolute(rel) || !inAllowed(rel)) {
        problems.push({ kind: 'outside', file: page, detail: `references ${ref}, outside the section and its include folders` });
        continue;
      }
      if (files.has(rel) || !fs.existsSync(abs)) continue; // packed already, or a broken link the check reports
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) problems.push({ kind: 'symlink', file: rel, detail: `referenced by ${page}` });
      else if (st.isFile()) files.add(rel);
    }
  }

  for (const f of files) if (CODE.test(f)) problems.push({ kind: 'executable', file: f, detail: 'code files are not packed into bundles' });

  if (cfg.redirects) {
    const file = cfg.redirects.file;
    const abs = path.join(root, file);
    if (!inAllowed(file)) problems.push({ kind: 'outside', file, detail: 'redirects file is outside the section folder' });
    else if (fs.existsSync(abs)) {
      const all = JSON.parse(fs.readFileSync(abs, 'utf8')) as Record<string, unknown>;
      const own = all[cfg.redirects.version];
      generated[file] = Buffer.from(`${JSON.stringify({ [cfg.redirects.version]: own ?? {} }, null, 2)}\n`);
    }
  }

  const list = [...files].sort();
  const bytes = list.reduce((n, f) => n + fs.statSync(path.join(root, f)).size, 0);
  if (list.length > limits.files) problems.push({ kind: 'limit', file: sectionDir, detail: `${list.length} files, more than ${limits.files}` });
  if (bytes > limits.bytes) problems.push({ kind: 'limit', file: sectionDir, detail: `${bytes} bytes, more than ${limits.bytes}` });
  return { files: list, generated, problems };
}
