// Where snapshot tarballs live, by key. local:<dir> (default) or github-release:<tag> (assets of one release in
// $GITHUB_REPOSITORY, through the gh CLI). Swap for the host's object storage once hosting is decided.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const KEY = /^[0-9a-f]{64}$/;
const checkKey = (key) => { if (!KEY.test(key)) throw new Error(`invalid snapshot key: ${key}`); return key; };

export function createStore(spec = process.env.SNAPSHOT_STORE ?? 'local:.cache/snapshots') {
  const [kind, arg] = [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)];
  if (kind === 'local') {
    const dir = path.resolve(ROOT, arg);
    const file = (key) => path.join(dir, `${checkKey(key)}.tgz`);
    return {
      has: (key) => fs.existsSync(file(key)),
      get: (key, dest) => fs.copyFileSync(file(key), dest),
      put: (key, src) => { fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(src, file(key)); },
    };
  }
  if (kind === 'github-release') {
    if (!/^[A-Za-z0-9._-]+$/.test(arg)) throw new Error(`invalid release tag: ${arg}`);
    const repo = process.env.GITHUB_REPOSITORY;
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo ?? '')) throw new Error('GITHUB_REPOSITORY must be owner/name');
    const gh = (...a) => execFileSync('gh', [...a, '--repo', repo], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    let names = null;
    const view = () => {
      try { return JSON.parse(gh('release', 'view', arg, '--json', 'assets')).assets.map((a) => a.name); }
      catch (e) { if (/release not found/i.test(String(e.stderr ?? e.message))) return []; throw e; } // nothing stored yet
    };
    const list = () => (names ??= new Set(view()));
    return {
      has: (key) => list().has(`${checkKey(key)}.tgz`),
      get: (key, dest) => gh('release', 'download', arg, '--pattern', `${checkKey(key)}.tgz`, '--output', dest, '--clobber'),
      put: (key, src) => {
        const named = path.join(path.dirname(src), `${checkKey(key)}.tgz`);
        if (named !== src) fs.copyFileSync(src, named);
        gh('release', 'upload', arg, named, '--clobber');
        list().add(`${key}.tgz`);
      },
    };
  }
  throw new Error(`SNAPSHOT_STORE must be local:<dir> or github-release:<tag>, got ${spec}`);
}
