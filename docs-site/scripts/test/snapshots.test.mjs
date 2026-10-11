import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CHROME, navHash, treeHash, snapshotKey, checkTarEntries, checkTarTypes, newBrokenLinks, withoutTokens } from '../snapshots.mjs';
import { createStore } from '../snapshot-store.mjs';

const v = { id: 'integration-mi--v4-4-0', repo: 'wso2/docs-mi', sha: 'c'.repeat(40), mkdocs: 'en/mkdocs.yml', exclude: [], route: 'integration/micro-integrator/4.4.0' };
const h = { converter: 't1', chrome: 't2' };

test('snapshot key changes with source, exclude list, converter and chrome', () => {
  const k = snapshotKey(v, h);
  assert.match(k, /^[0-9a-f]{64}$/);
  assert.equal(snapshotKey({ ...v }, { ...h }), k, 'deterministic');
  for (const changed of [snapshotKey({ ...v, sha: 'd'.repeat(40) }, h), snapshotKey({ ...v, exclude: ['a.md'] }, h),
    snapshotKey(v, { ...h, converter: 'x' }), snapshotKey(v, { ...h, chrome: 'x' }), snapshotKey(v, { ...h, nav: 'n1' })]) assert.notEqual(changed, k);
});

test('unsafe tar entries are refused', () => {
  const route = 'integration/micro-integrator/4.4.0';
  assert.doesNotThrow(() => checkTarEntries(['integration/micro-integrator/4.4.0/index.html', 'assets/js/main.1.js'], route));
  for (const bad of ['/etc/passwd', '../x', 'integration/micro-integrator/4.5.0/index.html', 'index.html', 'assets/../../x'])
    assert.throws(() => checkTarEntries([bad], route), /unsafe snapshot entry/);
});

test('local store keeps files by key and refuses malformed keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));
  const store = createStore(`local:${dir}`);
  const key = 'a'.repeat(64);
  const src = path.join(dir, 'in.tgz'); fs.writeFileSync(src, 'TAR');
  assert.equal(store.has(key), false);
  store.put(key, src);
  assert.equal(store.has(key), true);
  const dest = path.join(dir, 'out.tgz'); store.get(key, dest);
  assert.equal(fs.readFileSync(dest, 'utf8'), 'TAR');
  assert.throws(() => store.has('../x'), /invalid snapshot key/);
});

test('only broken links missing from the baseline fail the build', () => {
  const a = { page: 'identity/7.1.0/x/index.html', link: '/identity/7.1.0/gone/' };
  const b = { page: 'identity/7.1.0/y/index.html', link: '/identity/7.1.0/gone/' };
  const c = { page: 'identity/7.1.0/x/index.html', link: '/assets/files/z.png/' };
  assert.deepEqual(newBrokenLinks([a, b, c], [a, c]), [b], 'matched by page and link together');
  assert.deepEqual(newBrokenLinks([a], []), [a], 'no baseline: every broken link is new');
  assert.deepEqual(newBrokenLinks([], [a]), [], 'fixed links are not an error');
});

test('navigation hash ignores versions but follows names, groups, section labels and link-outs', () => {
  const base = { id: 'a', name: 'A', group: 'G', sections: [{ id: 's', label: 'S', route: 'a/s', versions: [{ version: '1' }] }] };
  const hash = (p, link_out = []) => navHash({ products: [p], link_out });
  const h0 = hash(base);
  assert.equal(hash({ ...base, sections: [{ ...base.sections[0], versions: [{ version: '2' }] }] }), h0);
  for (const h of [hash({ ...base, name: 'B' }), hash({ ...base, group: 'H' }), hash({ ...base, sections: [{ ...base.sections[0], label: 'T' }] }),
    hash(base, [{ id: 'x', name: 'X', group: 'G', href: 'https://x' }])]) assert.notEqual(h, h0);
});

test('snapshot key covers every inherited lock field but not the other versions', () => {
  const k = snapshotKey(v, h);
  for (const extra of [{ sparse: ['en'] }, { nav_root: 'Docs' }, { nav_drop: ['X'] }, { nav_pick: { a: 'b' } }, { only: 'a/' }, { skip: ['b/'] },
    { former_site: 'https://x/en/{version}/' }, { current_site: 'https://x/en/4.4.0/' }]) assert.notEqual(snapshotKey({ ...v, ...extra }, h), k, Object.keys(extra)[0]);
  assert.equal(snapshotKey({ ...v, versions: [{ version: '4.6.0', sha: 'f'.repeat(40) }], older_versions: 'https://x' }, h), k, 'other versions and Confluence links are not inputs');
  assert.equal(snapshotKey({ ...v, exclude: ['b.md', 'a.md'] }, h), snapshotKey({ ...v, exclude: ['a.md', 'b.md'] }, h), 'exclude order');
  const { id, ...rest } = v;
  assert.equal(snapshotKey({ ...rest, id }, h), k, 'field order');
});

test('navigation hash follows blurbs and the group list', () => {
  const base = { id: 'a', name: 'A', group: 'G', blurb: 'One', sections: [] };
  const h0 = navHash({ groups: ['G'], products: [base] });
  assert.notEqual(navHash({ groups: ['G'], products: [{ ...base, blurb: 'Two' }] }), h0);
  assert.notEqual(navHash({ groups: ['G', 'H'], products: [base] }), h0);
});

test('tar entries must be regular files or directories', () => {
  assert.doesNotThrow(() => checkTarTypes(['-rw-r--r--  0 u g 3 Oct 10 12:00 a/index.html', 'drwxr-xr-x  0 u g 0 Oct 10 12:00 a/']));
  for (const bad of ['lrwxr-xr-x  0 u g 0 Oct 10 12:00 a/x -> /etc/passwd', 'hrw-r--r--  0 u g 0 Oct 10 12:00 a/y link to a/x', 'crw-r--r-- 0 u g 0 a/dev'])
    assert.throws(() => checkTarTypes([bad]), /unsafe snapshot entry type/);
  assert.doesNotThrow(() => checkTarEntries(['.snapshot-key', './.snapshot-key'], 'identity/7.1.0'));
});

test('content steps run without repository tokens', () => {
  const env = withoutTokens({ PATH: '/bin', GH_TOKEN: 'x', GITHUB_TOKEN: 'y', ACTIONS_RUNTIME_TOKEN: 'z', DOCS_HEAP_MB: '1' });
  assert.deepEqual(env, { PATH: '/bin', DOCS_HEAP_MB: '1' });
});

test('the chrome hash covers site/account, account-sidebars.js and site/static (they feed snapshot builds)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: dir, stdio: 'pipe' });
  const write = (f, c) => { fs.mkdirSync(path.dirname(path.join(dir, 'docs-site', f)), { recursive: true }); fs.writeFileSync(path.join(dir, 'docs-site', f), c); };
  const paths = ['site/account', 'site/account-sidebars.js', 'site/static'];
  for (const p of paths) assert.ok(CHROME.includes(p), `${p} is part of the chrome key`);
  git('init', '-q');
  write('site/account/index.md', 'a'); write('site/account-sidebars.js', 'b'); write('site/static/logo.svg', 'c');
  git('add', '.'); git('commit', '-qm', 'one');
  const base = treeHash(paths, dir);
  assert.equal(treeHash(paths, dir), base, 'deterministic when clean');
  for (const f of ['site/account/index.md', 'site/account-sidebars.js', 'site/static/logo.svg']) {
    write(f, 'changed');
    assert.notEqual(treeHash(paths, dir), base, `${f} (uncommitted)`);
    git('commit', '-qam', f);
    assert.notEqual(treeHash(paths, dir), base, `${f} (committed)`);
    assert.doesNotMatch(treeHash(paths, dir), /dirty/);
    const next = treeHash(paths, dir);
    write(f, 'c' + f); git('commit', '-qam', 'again');
    assert.notEqual(treeHash(paths, dir), next);
  }
  fs.rmSync(path.join(dir, 'docs-site/site/static'), { recursive: true }); git('commit', '-qam', 'rm');
  assert.match(treeHash(paths, dir), /absent$/, 'a path absent at HEAD hashes without throwing');
  fs.rmSync(dir, { recursive: true, force: true });
});
