import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { snapshotKey, checkTarEntries, newBrokenLinks } from '../snapshots.mjs';
import { createStore } from '../snapshot-store.mjs';

const v = { id: 'integration-mi--v4-4-0', repo: 'wso2/docs-mi', sha: 'c'.repeat(40), mkdocs: 'en/mkdocs.yml', exclude: [], route: 'integration/micro-integrator/4.4.0' };
const h = { converter: 't1', chrome: 't2' };

test('snapshot key changes with source, exclude list, converter and chrome', () => {
  const k = snapshotKey(v, h);
  assert.match(k, /^[0-9a-f]{64}$/);
  assert.equal(snapshotKey({ ...v }, { ...h }), k, 'deterministic');
  for (const changed of [snapshotKey({ ...v, sha: 'd'.repeat(40) }, h), snapshotKey({ ...v, exclude: ['a.md'] }, h),
    snapshotKey(v, { ...h, converter: 'x' }), snapshotKey(v, { ...h, chrome: 'x' })]) assert.notEqual(changed, k);
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
