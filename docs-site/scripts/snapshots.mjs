// Frozen versions: each is its own Docusaurus build (DOCS_SNAPSHOT), packed as <key>.tgz and merged into the live
// output under the same URLs. The key covers the version's whole lock entry (source commit, paths, exclude list,
// inherited section settings), the converter (src and tsconfig), the site chrome (with the fetch script), the
// navigation catalogue and the Node.js major version; a change rebuilds.
// A snapshot's output reads nothing else: its pages link only to their own version, and its navigation comes from
// the lock file (docusaurus.config.js, snapshot mode). The exception, a version folder of a shared MkDocs source
// (docs_root), links into the sections sharing that source; the lock fields those links read are part of its key.
// Broken links inside a snapshot fail its build only when they are not in link-baselines/<versionId>.json, the
// version's known breakage (recorded with --record-baseline; source content we do not edit).
// Usage: node scripts/snapshots.mjs list [--json] [--missing] | build <versionId> [--record-baseline]
//        | assemble <liveDir> <outDir> [--allow-missing]
// Uploading to the CI store is the snapshot workflow's upload job (shell, no repository scripts).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readLock, liveWindow, ROOT } from './lib.mjs';
import { sectionVersions, outsideLinkInputs } from './versions.mjs';
import { createStore } from './snapshot-store.mjs';
import { findBrokenLinks, notIn, sortedPairs } from './check-links.mjs';
import { withHeap } from './docusaurus.mjs';
import { writeSnapshotRootRedirect, checkVersionRoots } from './redirect.mjs';

export const CHROME = ['site/src', 'site/plugins', 'site/account', 'site/account-sidebars.js', 'site/static', 'site/docusaurus.config.js', 'scripts/build-content.mjs', 'scripts/fetch-sources.mjs', 'scripts/lib.mjs', 'scripts/versions.mjs', 'package-lock.json'];
// tsconfig.json decides how src compiles to the dist that build-content.mjs runs.
export const CONVERTER = ['packages/docs-converter/src', 'packages/docs-converter/tsconfig.json'];
const BASELINES = path.join(ROOT, 'link-baselines');
const KEY_FILE = '.snapshot-key';
const SECRETS = ['GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_URL'];

/** The environment for steps that run content code (fetch, convert, Docusaurus): no repository tokens. */
export const withoutTokens = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !SECRETS.includes(k)));

/** Broken links that are not in the baseline (both are { page, link }[]). */
export const newBrokenLinks = (broken, baseline) => notIn(broken, baseline);

// Lock data of other versions (the section's version list, Confluence links): not read by a snapshot build.
const NOT_KEYED = new Set(['versions', 'older_versions']);
const canonical = (x) => (Array.isArray(x) ? x.map(canonical)
  : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).filter((k) => x[k] !== undefined).sort().map((k) => [k, canonical(x[k])])) : x);

/**
 * Key of a snapshot: its whole normalised version source (everything the conversion reads) and the build inputs.
 * links: the lock fields its cross-section links read (outsideLinkInputs), for sources shared with docs_root sections.
 * node: the Node.js major version that runs the converter and Docusaurus.
 */
export function snapshotKey(v, { converter, chrome, nav = '', links = null, node = '' }) {
  const source = Object.fromEntries(Object.entries(v).filter(([k]) => !NOT_KEYED.has(k)));
  const input = { source: canonical({ ...source, exclude: [...(v.exclude ?? [])].sort() }), converter, chrome, nav, node, ...(links ? { links: canonical(links) } : {}) };
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/**
 * Hash of the navigation catalogue a snapshot bundles (groups, products with blurbs, section labels and routes,
 * link-outs; not versions), taken from the lock file. docusaurus.config.js builds the snapshot catalogue from these fields only.
 */
export function navHash(lock = readLock()) {
  const nav = {
    groups: lock.groups ?? null,
    products: (lock.products ?? []).map((p) => [p.id, p.name, p.group, p.blurb ?? null, (p.sections ?? []).map((s) => [s.id, s.label, s.route])]),
    linkOut: canonical(lock.link_out ?? []),
  };
  return crypto.createHash('sha256').update(JSON.stringify(nav)).digest('hex');
}

/** Hash of git trees/blobs at HEAD under `prefix` plus a dirty marker; a path absent at HEAD (an empty directory) hashes as "absent". */
export function treeHash(paths, root = ROOT, prefix = 'docs-site/') {
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  const at = (p) => { try { return git('rev-parse', `HEAD:${prefix}${p}`); } catch { return 'absent'; } };
  const trees = paths.map(at).join(',');
  const dirty = git('status', '--porcelain', '--untracked-files=all', '--', ...paths.map((p) => `:(top)${prefix}${p}`)); // :(top): pathspecs are cwd-relative otherwise, and callers run in docs-site/
  return dirty ? `${trees}-dirty-${Date.now()}` : trees;
}

/** Major version of the running Node.js (a snapshot key input). */
export const nodeMajor = (version = process.versions.node) => version.split('.')[0];

export function inputHashes(root = ROOT) {
  return { converter: treeHash(CONVERTER, root), chrome: treeHash(CHROME, root), nav: navHash(), node: nodeMajor() };
}

export function checkTarEntries(names, route) {
  for (const raw of names) {
    const name = raw.replace(/^\.\//, '');
    const ok = !name.startsWith('/') && !name.split('/').includes('..') && (name.startsWith(`${route}/`) || name === `${route}/` || name.startsWith('assets/') || name === 'assets/' || name === KEY_FILE);
    if (!ok) throw new Error(`unsafe snapshot entry: ${raw}`);
  }
}

/** Only regular files and directories (lines of `tar -tv`: the mode string starts with - or d); no links or devices. */
export function checkTarTypes(verboseLines) {
  for (const line of verboseLines) if (!/^[-d]/.test(line)) throw new Error(`unsafe snapshot entry type: ${line}`);
}

/** Snapshot versions, each with the cross-section link inputs its key covers (null for most). */
const snapshotVersions = () => {
  const lock = readLock();
  return lock.products.flatMap((p) => p.sections.flatMap((s) => sectionVersions(s, liveWindow(lock)))).filter((v) => v.status === 'snapshot')
    .map((v) => ({ v, links: outsideLinkInputs(lock, v) }));
};
/** Key of a snapshot version from snapshotVersions(). */
const keyOf = ({ v, links }, hashes) => snapshotKey(v, { ...hashes, links });
/** tar output; a verbose listing of a large snapshot exceeds the 1 MiB default buffer. 256 MiB stays under V8's string length limit. */
export const tar = (...a) => execFileSync('tar', a, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).toString();

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
  const entry = snapshotVersions().find((x) => x.v.id === id);
  if (!entry) throw new Error(`${id} is not a snapshot version`);
  const { v } = entry;
  const key = keyOf(entry, inputHashes());
  const store = createStore();
  // Checked before fetching sources: a stored key costs nothing.
  if (!recordBaseline && store.has(key)) { console.log(`cached   ${id} ${key.slice(0, 12)}`); return; }
  // Content code (fetch, conversion, Docusaurus rendering of source MDX) runs without repository tokens.
  const env = withoutTokens();
  const run = (cmd, args, e = env) => { const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: e }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`); };
  run(process.execPath, ['scripts/fetch-sources.mjs', id]);
  run(process.execPath, ['scripts/build-content.mjs', id]);
  const out = path.join(ROOT, 'site', 'build-snapshots', id);
  fs.rmSync(out, { recursive: true, force: true });
  run(path.join(ROOT, 'node_modules/.bin/docusaurus'), ['build', 'site', '--out-dir', path.relative(path.join(ROOT, 'site'), out)], { ...withHeap(env), DOCS_SNAPSHOT: id });
  const broken = findBrokenLinks(out, { under: `${v.route}/` }).filter((b) => b.target.startsWith(`/${v.route}/`) || b.target.startsWith('/assets/'));
  const baselineFile = path.join(BASELINES, `${id}.json`);
  if (recordBaseline) {
    fs.mkdirSync(BASELINES, { recursive: true });
    const sorted = sortedPairs(broken);
    fs.writeFileSync(baselineFile, `${JSON.stringify(sorted, null, 1)}\n`);
    console.log(`baseline ${id} ${sorted.length} known broken link(s)`);
  }
  const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : [];
  const fresh = newBrokenLinks(broken, baseline);
  if (fresh.length) { for (const b of fresh.slice(0, 50)) console.error(`${b.page}: ${b.link}`); throw new Error(`${id}: ${fresh.length} broken link(s) inside the snapshot not in ${path.relative(ROOT, baselineFile)}`); }
  fs.writeFileSync(path.join(out, KEY_FILE), `${key}\n`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  const file = path.join(tmp, `${key}.tgz`);
  tar('-czf', file, '-C', out, KEY_FILE, v.route, 'assets');
  store.put(key, file);
  const mb = (fs.statSync(file).size / 1e6).toFixed(1);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(out, { recursive: true, force: true });
  console.log(`built    ${id} ${key.slice(0, 12)} ${mb} MB`);
}

/**
 * Merge stored snapshots into the live build. With allowMissing (pull-request CI), a key not stored yet is reported
 * as pending, not an error: the snapshot workflow builds it after merge. A deploy assembles without it. outDir may
 * equal liveDir (merge in place, saving a copy of the live build).
 */
function assemble(liveDir, outDir, { allowMissing = false } = {}) {
  if (outDir !== liveDir) {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.cpSync(liveDir, outDir, { recursive: true });
  }
  const store = createStore();
  const hashes = inputHashes();
  const pending = [];
  const pendingRoutes = [];
  for (const entry of snapshotVersions()) {
    const { v } = entry;
    const key = keyOf(entry, hashes);
    if (!store.has(key)) {
      if (!allowMissing) throw new Error(`snapshot ${v.id} (${key.slice(0, 12)}) is missing: run \`node scripts/snapshots.mjs build ${v.id}\``);
      pending.push(v.id);
      pendingRoutes.push(v.route);
      console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : ''}pending  ${v.id} (${key.slice(0, 12)}): not stored yet; the snapshot workflow builds it after merge`);
      continue;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
    const file = path.join(tmp, `${key}.tgz`);
    store.get(key, file);
    checkTarEntries(tar('-tzf', file).split('\n').filter(Boolean), v.route);
    checkTarTypes(tar('-tvzf', file).split('\n').filter(Boolean));
    const dir = path.join(tmp, 'x'); fs.mkdirSync(dir);
    tar('-xzf', file, '-C', dir, '--no-same-owner');
    const keyFile = path.join(dir, KEY_FILE);
    const packed = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : null;
    if (packed !== key) throw new Error(`snapshot ${v.id}: tarball key ${packed ?? '(none)'} does not match ${key}`);
    fs.rmSync(keyFile);
    copyNoOverwrite(dir, outDir);
    writeSnapshotRootRedirect(outDir, v.route, (m) => console.warn(`${process.env.GITHUB_ACTIONS ? '::warning::' : ''}${m}`));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`merged   ${v.id}`);
  }
  if (pending.length) console.log(`${pending.length} snapshot(s) pending: ${pending.join(', ')}`);
  checkVersionRoots(outDir, new Set(pendingRoutes.map((r) => `/${r}/`)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  const flag = (f) => process.argv.includes(f);
  if (cmd === 'list') {
    const hashes = inputHashes();
    const store = flag('--missing') ? createStore() : null;
    const rows = snapshotVersions().map((e) => ({ id: e.v.id, key: keyOf(e, hashes) })).filter((r) => !store || !store.has(r.key));
    console.log(flag('--json') ? JSON.stringify(rows) : rows.map((r) => `${r.id}\t${r.key}`).join('\n'));
  } else if (cmd === 'build' && a) build(a, { recordBaseline: flag('--record-baseline') });
  else if (cmd === 'assemble' && a && b) assemble(path.resolve(a), path.resolve(b), { allowMissing: flag('--allow-missing') });
  else { console.error('Usage: node scripts/snapshots.mjs list [--json] [--missing] | build <versionId> [--record-baseline] | assemble <liveDir> <outDir> [--allow-missing]'); process.exit(2); }
}
