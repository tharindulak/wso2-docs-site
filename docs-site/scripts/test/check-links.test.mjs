import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findBrokenLinks } from '../check-links.mjs';

const site = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-'));
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  return dir;
};

test('internal links resolve to index.html, files or .html', () => {
  const dir = site({
    'identity/index.html': '<a href="/identity/guides/">g</a><a href="/identity/x/#top">x</a><img src="/assets/images/a-1.png"><a href="https://ext">e</a><a href="//cdn/x">c</a>',
    'identity/guides/index.html': '<a href="/identity/missing/">m</a><a href="/identity/7.2.0/">old</a><a href="/identity/guides/?q=1">q</a>',
    'identity/x.html': '', 'assets/images/a-1.png': '',
  });
  assert.deepEqual(findBrokenLinks(dir), [
    { page: 'identity/guides/index.html', link: '/identity/7.2.0/' },
    { page: 'identity/guides/index.html', link: '/identity/missing/' },
  ]);
  assert.deepEqual(findBrokenLinks(dir, { under: 'identity/x' }), []);
});
