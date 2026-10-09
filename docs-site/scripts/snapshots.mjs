// Frozen versions: each is its own Docusaurus build (DOCS_SNAPSHOT), packed as <key>.tgz and merged into the live
// output under the same URLs. The key covers source commit, exclude list, converter and site chrome; a change rebuilds.
// Usage: node scripts/snapshots.mjs list [--json] | build <versionId> | assemble <liveDir> <outDir>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readLock, liveWindow, ROOT } from './lib.mjs';
import { sectionVersions } from './versions.mjs';
import { createStore } from './snapshot-store.mjs';
import { findBrokenLinks } from './check-links.mjs';
import { withHeap } from './docusaurus.mjs';

const CHROME = ['site/src', 'site/plugins', 'site/docusaurus.config.js', 'scripts/build-content.mjs', 'package-lock.json'];
const CONVERTER = ['packages/docs-converter/src'];

export function snapshotKey(v, { converter, chrome }) {
  const input = { id: v.id, repo: v.repo, sha: v.sha, mkdocs: v.mkdocs ?? null, docs: v.docs ?? null, sidebar: v.sidebar ?? null, exclude: [...(v.exclude ?? [])].sort(), converter, chrome };
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function inputHashes(root = ROOT) {
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  const hash = (paths) => {
    const trees = paths.map((p) => git('rev-parse', `HEAD:docs-site/${p}`)).join(',');
    const dirty = git('status', '--porcelain', '--', ...paths);
    return dirty ? `${trees}-dirty-${Date.now()}` : trees;
  };
  return { converter: hash(CONVERTER), chrome: hash(CHROME) };
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

function build(id) {
  const v = snapshotVersions().find((x) => x.id === id);
  if (!v) throw new Error(`${id} is not a snapshot version`);
  const key = snapshotKey(v, inputHashes());
  const store = createStore();
  if (store.has(key)) { console.log(`cached   ${id} ${key.slice(0, 12)}`); return; }
  const run = (cmd, args, env = process.env) => { const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`); };
  run(process.execPath, ['scripts/build-content.mjs', id]);
  const out = path.join(ROOT, 'site', 'build-snapshots', id);
  fs.rmSync(out, { recursive: true, force: true });
  run(path.join(ROOT, 'node_modules/.bin/docusaurus'), ['build', 'site', '--out-dir', path.relative(path.join(ROOT, 'site'), out)], { ...withHeap(), DOCS_SNAPSHOT: id });
  const broken = findBrokenLinks(out, { under: `${v.route}/` }).filter((b) => b.link.startsWith(`/${v.route}/`) || b.link.startsWith('/assets/'));
  if (broken.length) { for (const b of broken.slice(0, 50)) console.error(`${b.page}: ${b.link}`); throw new Error(`${id}: ${broken.length} broken link(s) inside the snapshot`); }
  const file = path.join(os.tmpdir(), `${key}.tgz`);
  tar('-czf', file, '-C', out, v.route, 'assets');
  store.put(key, file);
  console.log(`built    ${id} ${key.slice(0, 12)} ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
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
  } else if (cmd === 'build' && a) build(a);
  else if (cmd === 'assemble' && a && b) assemble(path.resolve(a), path.resolve(b));
  else { console.error('Usage: node scripts/snapshots.mjs list [--json] | build <versionId> | assemble <liveDir> <outDir>'); process.exit(2); }
}
