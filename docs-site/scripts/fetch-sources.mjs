// Fetch every pinned content source: shallow, blob-filtered, sparse checkout of exactly the locked commit.
// Usage: node scripts/fetch-sources.mjs [sectionId | versionId ...]     FETCH_ASSETS=0 skips images and other assets.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { readLock, liveWindow, refsOf, checkoutDir, CACHE } from './lib.mjs';
import { sectionVersions } from './versions.mjs';

const only = new Set(process.argv.slice(2));

// One fetch at a time: two runs on the same checkout delete each other's work.
fs.mkdirSync(CACHE, { recursive: true });
const lockFile = path.join(CACHE, '.fetch.lock');
try { fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' }); }
catch { console.error(`Another fetch is running (or crashed): remove ${lockFile} if no fetch is running.`); process.exit(1); }
const release = () => { try { fs.rmSync(lockFile); } catch { /* already gone */ } };
process.on('exit', release);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
const assets = process.env.FETCH_ASSETS !== '0';
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

const lock = readLock();
const wanted = new Map(); // repo@sha -> { repo, sha, sparse:Set }
for (const product of lock.products) {
  for (const section of product.sections) {
    for (const v of sectionVersions(section, liveWindow(lock))) {
      // Snapshot versions are fetched only when named (scripts/snapshots.mjs build does); the live build never reads them.
      if (v.status === 'snapshot' ? !only.has(v.id) : only.size && !only.has(section.id) && !only.has(v.id)) continue;
      for (const ref of refsOf(v)) {
        const key = `${ref.repo}@${ref.sha}`;
        if (!wanted.has(key)) wanted.set(key, { ...ref, sparse: new Set() });
        const sparse = ref === v.cloud_companion ? v.cloud_companion.sparse : v.sparse;
        for (const p of sparse ?? ['/']) wanted.get(key).sparse.add(p);
      }
    }
  }
}

for (const { repo, sha, sparse } of wanted.values()) {
  const dir = checkoutDir(repo, sha);
  const patterns = [...sparse].flatMap((p) => {
    const base = `/${p.replace(/^\/|\/$/g, '')}`;
    if (/\.[a-z]+$/i.test(p)) return [base];
    return assets ? [`${base}/`] : ['md', 'mdx', 'yml', 'yaml', 'json', 'js', 'ts'].map((e) => `${base}/**/*.${e}`);
  });
  // The marker names the sparse patterns too: a checkout fetched for fewer paths is not reused for more.
  const marker = `${dir}/.fetched-${assets ? 'full' : 'text'}-${crypto.createHash('sha256').update(patterns.sort().join('\n')).digest('hex').slice(0, 8)}`;
  if (fs.existsSync(marker)) { console.log(`cached   ${repo}@${sha.slice(0, 12)}`); continue; }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'remote', 'add', 'origin', `https://github.com/${repo}.git`);
  git(dir, 'sparse-checkout', 'set', '--no-cone', ...patterns);
  git(dir, 'fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', sha);
  git(dir, 'checkout', '-q', 'FETCH_HEAD');
  const head = git(dir, 'rev-parse', 'HEAD');
  if (head !== sha) throw new Error(`${repo}: fetched ${head}, expected ${sha}`);
  fs.writeFileSync(marker, `${new Date().toISOString()}\n`);
  console.log(`fetched  ${repo}@${sha.slice(0, 12)} (${assets ? 'with assets' : 'text only'})`);
}
