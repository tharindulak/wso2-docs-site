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
