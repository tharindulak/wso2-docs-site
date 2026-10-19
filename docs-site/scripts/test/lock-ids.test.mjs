import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib.mjs');
const readWith = (id) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-ids-'));
  const lock = path.join(dir, 'lock.yaml');
  fs.writeFileSync(lock, `products:\n  - id: p\n    sections:\n      - id: "${id}"\n        route: demo\n        kind: mkdocs\n`);
  return spawnSync(process.execPath, ['-e', `import(${JSON.stringify(LIB)}).then((m) => m.readLock())`], { env: { ...process.env, DOCS_SITE_LOCK: lock }, encoding: 'utf8' });
};

test('readLock rejects a section id that is not lowercase letters, digits and hyphens', () => {
  for (const id of ['x; rm -rf ~', 'Upper', '-lead', 'a b']) {
    const bad = readWith(id);
    assert.notEqual(bad.status, 0, id);
    assert.match(bad.stderr, /Section id must be lowercase/, id);
  }
});

test('readLock accepts the id shape the lock file uses (fails later, on other fields)', () => {
  assert.doesNotMatch(readWith('integration-mi').stderr, /Section id must be/);
});

test('repoOk accepts wso2/<name> only, never . or .. or extra segments', async () => {
  const { repoOk } = await import('../lib.mjs');
  assert.equal(repoOk('wso2/docs-is'), true);
  assert.equal(repoOk('wso2/docs.mi'), true);
  for (const bad of ['wso2/.', 'wso2/..', 'wso2/a/b', 'other/docs-is', 'wso2/', 'wso2/a b']) assert.equal(repoOk(bad), false, bad);
});

test('readLock accepts hide_from_navigation of product ids and account (the hub), and rejects any other id', () => {
  const read = (ids) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-hide-'));
    const lock = path.join(dir, 'lock.yaml');
    fs.writeFileSync(lock, `products:\n  - id: updates\n    sections: []\nhide_from_navigation: [${ids}]\n`);
    return spawnSync(process.execPath, ['-e', `import(${JSON.stringify(LIB)}).then((m) => m.readLock())`], { env: { ...process.env, DOCS_SITE_LOCK: lock }, encoding: 'utf8' });
  };
  assert.equal(read('updates, account').status, 0);
  const bad = read('updatez');
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /hide_from_navigation: no product updatez/);
});
