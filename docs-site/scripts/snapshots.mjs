// Frozen versions: each is its own Docusaurus build (DOCS_SNAPSHOT), packed as <key>.tgz and merged into the live
// output under the same URLs. The key covers source commit, exclude list, converter and site chrome; a change rebuilds.
// Broken links inside a snapshot fail its build only when they are not in link-baselines/<versionId>.json, the
// version's known breakage (recorded with --record-baseline; source content we do not edit).
// Usage: node scripts/snapshots.mjs list [--json] | build <versionId> [--record-baseline] | assemble <liveDir> <outDir>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readLock, liveWindow, ROOT, GENERATED } from './lib.mjs';
import { sectionVersions } from './versions.mjs';
import { createStore } from './snapshot-store.mjs';
import { findBrokenLinks } from './check-links.mjs';
import { withHeap } from './docusaurus.mjs';

const CHROME = ['site/src', 'site/plugins', 'site/docusaurus.config.js', 'scripts/build-content.mjs', 'scripts/lib.mjs', 'scripts/versions.mjs', 'package-lock.json'];
const CONVERTER = ['packages/docs-converter/src'];
const BASELINES = path.join(ROOT, 'link-baselines');
const linkKey = (b) => `${b.page}\n${b.link}`;

/** Broken links that are not in the baseline (both are { page, link }[]). */
export function newBrokenLinks(broken, baseline) {
  const known = new Set(baseline.map(linkKey));
  return broken.filter((b) => !known.has(linkKey(b)));
}

export function snapshotKey(v, { converter, chrome, nav = '' }) {
  const input = { id: v.id, repo: v.repo, sha: v.sha, mkdocs: v.mkdocs ?? null, docs: v.docs ?? null, sidebar: v.sidebar ?? null, exclude: [...(v.exclude ?? [])].sort(), converter, chrome, nav };
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/** Hash of the navigation catalogue (products and section labels/routes, not versions) from the generated manifest. */
export function navHash(manifestPath = path.join(GENERATED, 'manifest.json')) {
  if (!fs.existsSync(manifestPath)) return '';
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const nav = (m.products ?? []).map((p) => [p.id, p.name, p.group, (p.sections ?? []).map((s) => [s.id, s.label, s.route])]);
  return crypto.createHash('sha256').update(JSON.stringify(nav)).digest('hex');
}

export function inputHashes(root = ROOT) {
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  const hash = (paths) => {
    const trees = paths.map((p) => git('rev-parse', `HEAD:docs-site/${p}`)).join(',');
    const dirty = git('status', '--porcelain', '--', ...paths);
    return dirty ? `${trees}-dirty-${Date.now()}` : trees;
  };
  return { converter: hash(CONVERTER), chrome: hash(CHROME), nav: navHash() };
}

export function checkTarEntries(names, route) {
  for (const raw of names) {
    const name = raw.replace(/^\.\//, '');
    const ok = !name.startsWith('/') && !name.split('/').includes('..') && (name.startsWith(`${route}/`) || name === `${route}/` || name.startsWith('assets/') || name === 'assets/');
    if (!ok) throw new Error(`unsafe snapshot entry: ${raw}`);
  }
}

const snapshotVersions = () => {
  const lock = readLock();
  return lock.products.flatMap((p) => p.sections.flatMap((s) => sectionVersions(s, liveWindow(lock)))).filter((v) => v.status === 'snapshot');
};
const tar = (...a) => execFileSync('tar', a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

/** Copy a tree without overwriting: hashed assets are identical when names match; the live build always wins. */
function copyNoOverwrite(from, to) {
  for (const e of fs.readdirSync(from, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue;
    const rel = path.relative(from, path.join(e.parentPath, e.name));
    const dest = path.join(to, rel);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(from, rel), dest);
  }
}

function build(id, { recordBaseline = false } = {}) {
  const v = snapshotVersions().find((x) => x.id === id);
  if (!v) throw new Error(`${id} is not a snapshot version`);
  const key = snapshotKey(v, inputHashes());
  const store = createStore();
  if (!recordBaseline && store.has(key)) { console.log(`cached   ${id} ${key.slice(0, 12)}`); return; }
  const run = (cmd, args, env = process.env) => { const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`); };
  run(process.execPath, ['scripts/build-content.mjs', id]);
  const out = path.join(ROOT, 'site', 'build-snapshots', id);
  fs.rmSync(out, { recursive: true, force: true });
  run(path.join(ROOT, 'node_modules/.bin/docusaurus'), ['build', 'site', '--out-dir', path.relative(path.join(ROOT, 'site'), out)], { ...withHeap(), DOCS_SNAPSHOT: id });
  const broken = findBrokenLinks(out, { under: `${v.route}/` }).filter((b) => b.link.startsWith(`/${v.route}/`) || b.link.startsWith('/assets/'));
  const baselineFile = path.join(BASELINES, `${id}.json`);
  if (recordBaseline) {
    fs.mkdirSync(BASELINES, { recursive: true });
    const sorted = broken.map(({ page, link }) => ({ page, link })).sort((x, y) => (linkKey(x) < linkKey(y) ? -1 : linkKey(x) > linkKey(y) ? 1 : 0));
    fs.writeFileSync(baselineFile, `${JSON.stringify(sorted, null, 1)}\n`);
    console.log(`baseline ${id} ${sorted.length} known broken link(s)`);
  }
  const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : [];
  const fresh = newBrokenLinks(broken, baseline);
  if (fresh.length) { for (const b of fresh.slice(0, 50)) console.error(`${b.page}: ${b.link}`); throw new Error(`${id}: ${fresh.length} broken link(s) inside the snapshot not in ${path.relative(ROOT, baselineFile)}`); }
  const file = path.join(os.tmpdir(), `${key}.tgz`);
  tar('-czf', file, '-C', out, v.route, 'assets');
  store.put(key, file);
  const mb = (fs.statSync(file).size / 1e6).toFixed(1);
  fs.rmSync(file, { force: true });
  fs.rmSync(out, { recursive: true, force: true });
  console.log(`built    ${id} ${key.slice(0, 12)} ${mb} MB`);
}

function assemble(liveDir, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(liveDir, outDir, { recursive: true });
  const store = createStore();
  const hashes = inputHashes();
  for (const v of snapshotVersions()) {
    const key = snapshotKey(v, hashes);
    if (!store.has(key)) throw new Error(`snapshot ${v.id} (${key.slice(0, 12)}) is missing: run \`node scripts/snapshots.mjs build ${v.id}\``);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
    const file = path.join(tmp, `${key}.tgz`);
    store.get(key, file);
    checkTarEntries(tar('-tzf', file).split('\n').filter(Boolean), v.route);
    const dir = path.join(tmp, 'x'); fs.mkdirSync(dir);
    tar('-xzf', file, '-C', dir, '--no-same-owner');
    copyNoOverwrite(dir, outDir);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`merged   ${v.id}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'list') {
    const hashes = inputHashes();
    const rows = snapshotVersions().map((v) => ({ id: v.id, key: snapshotKey(v, hashes) }));
    console.log(process.argv.includes('--json') ? JSON.stringify(rows) : rows.map((r) => `${r.id}\t${r.key}`).join('\n'));
  } else if (cmd === 'build' && a) build(a, { recordBaseline: process.argv.includes('--record-baseline') });
  else if (cmd === 'assemble' && a && b) assemble(path.resolve(a), path.resolve(b));
  else { console.error('Usage: node scripts/snapshots.mjs list [--json] | build <versionId> [--record-baseline] | assemble <liveDir> <outDir>'); process.exit(2); }
}
