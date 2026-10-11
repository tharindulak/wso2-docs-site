import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findBrokenLinks, targetOf, notIn, readBaselines, findLiteralMarkdown, literalMarkdownCount, literalOverBaseline } from '../check-links.mjs';

const site = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-'));
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  return dir;
};

test('internal links resolve to index.html, files or .html', () => {
  const dir = site({
    'identity/index.html': '<a href="/identity/guides/">g</a><a href="/identity/x/#top">x</a><img src="/assets/images/a-1.png"><a href="https://ext">e</a><a href="//cdn/x">c</a>',
    'identity/guides/index.html': '<a href="/identity/missing/">m</a><a href="/identity/7.2.0/">old</a><a href="/identity/guides/?q=1">q</a>',
    'identity/x/index.html': '', 'assets/images/a-1.png': '',
  });
  assert.deepEqual(findBrokenLinks(dir).map(({ page, link }) => ({ page, link })), [
    { page: 'identity/guides/index.html', link: '/identity/7.2.0/' },
    { page: 'identity/guides/index.html', link: '/identity/missing/' },
  ]);
  assert.deepEqual(findBrokenLinks(dir, { under: 'identity/x' }), []);
});

test('trailing-slash link is broken if only .html file exists', () => {
  const dir = site({
    'identity/index.html': '<a href="/identity/x/">x</a>',
    'identity/x.html': '',
  });
  assert.deepEqual(findBrokenLinks(dir).map(({ page, link }) => ({ page, link })), [
    { page: 'identity/index.html', link: '/identity/x/' },
  ]);
});

test('relative links and API spec references resolve against the page URL', () => {
  const dir = site({
    'identity/7.1.0/learn/reset/index.html': '<img src="../../assets/img/a.png"><img src="../../assets/img/gone.png"><a href="../other/">o</a><a href="#x">x</a><a href="mailto:a@b.c">m</a>',
    'identity/7.1.0/apis/x/index.html': '<p class="api-reference__status" data-spec="../../apis/restapis/actions.yaml">Loading</p><p data-spec="../../apis/restapis/gone.yaml"></p>',
    'identity/7.1.0/assets/img/a.png': '', 'identity/7.1.0/learn/other/index.html': '', 'identity/7.1.0/apis/restapis/actions.yaml': '',
  });
  assert.deepEqual(findBrokenLinks(dir), [
    { page: 'identity/7.1.0/apis/x/index.html', link: '../../apis/restapis/gone.yaml', target: '/identity/7.1.0/apis/restapis/gone.yaml' },
    { page: 'identity/7.1.0/learn/reset/index.html', link: '../../assets/img/gone.png', target: '/identity/7.1.0/assets/img/gone.png' },
  ]);
});

test('targetOf: external links and fragments are not checked; trailing slashes are kept', () => {
  assert.equal(targetOf('a/b/index.html', 'https://x/'), null);
  assert.equal(targetOf('a/b/index.html', '//cdn/x'), null);
  assert.equal(targetOf('a/b/index.html', '#top'), null);
  assert.equal(targetOf('a/b/index.html', '../c/'), '/a/c/');
  assert.equal(targetOf('a/b/index.html', 'img/x.png?v=1'), '/a/b/img/x.png?v=1');
  assert.equal(targetOf('404.html', 'x/'), '/x/');
  assert.equal(targetOf('a/index.html', '../../../x.png'), '/x.png');
});

test('the merged gate fails only on links in no baseline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baselines-'));
  const a = { page: 'identity/7.1.0/x/index.html', link: '/identity/7.1.0/gone/' };
  const b = { page: 'identity/x/index.html', link: '/identity/gone/' };
  const c = { page: 'identity/y/index.html', link: '/identity/new/' };
  fs.writeFileSync(path.join(dir, 'identity--v7-1-0.json'), JSON.stringify([a]));
  fs.writeFileSync(path.join(dir, 'live.json'), JSON.stringify([b]));
  const known = readBaselines(dir);
  assert.deepEqual(known.versions, [a]);
  assert.deepEqual(known.live, [b]);
  assert.deepEqual(notIn([a, b, c].map((x) => ({ ...x, target: x.link })), known.versions, known.live).map((x) => x.page), [c.page]);
});

test('preview server maps directory URLs with dotted segments to index.html and stays inside the root', async () => {
  const { fileFor } = await import('../serve.mjs');
  const dir = site({ 'identity/7.1.0/index.html': '', 'identity/7.1.0/guides/x/index.html': '', 'a.yaml': '' });
  assert.equal(fileFor(dir, '/identity/7.1.0/'), path.join(dir, 'identity/7.1.0/index.html'));
  assert.equal(fileFor(dir, '/identity/7.1.0/guides/x/?q=1'), path.join(dir, 'identity/7.1.0/guides/x/index.html'));
  assert.equal(fileFor(dir, '/identity/7.1.0'), path.join(dir, 'identity/7.1.0/index.html'));
  assert.equal(fileFor(dir, '/a.yaml'), path.join(dir, 'a.yaml'));
  assert.equal(fileFor(dir, '/../etc/passwd'), null);
  assert.equal(fileFor(dir, '/%2e%2e/x'), null);
  assert.equal(fileFor(dir, '/%E0%A4%A'), null);
});

test('literal Markdown link and image syntax in paragraph text is counted per page; code and parsed links are not', () => {
  const dir = site({
    'a/index.html': '<p>Chart: ![Line chart](../_shared/four-core-AP- with-8.svg) and [x](y z)</p><p class="c">ok <a href="/a/">link</a></p>',
    'b/index.html': '<p>Use <code>![alt](src)</code> in Markdown.</p><pre><code>[a](b)</code></pre><div>![not a paragraph](x)</div>',
    'c/index.html': '<p>A lone ](</p>',
    'd/index.html': '<p>[plain brackets] and (parens)</p>',
  });
  assert.deepEqual(findLiteralMarkdown(dir), [{ page: 'a/index.html', count: 2 }, { page: 'c/index.html', count: 1 }]);
  assert.deepEqual(findLiteralMarkdown(dir, { under: 'c/' }), [{ page: 'c/index.html', count: 1 }]);
  assert.equal(literalMarkdownCount('![a](b) ![ ]('), 2, 'a whole `![alt](` counts once');
  assert.equal(literalMarkdownCount('![\nx ]('), 2, 'a lone `![` and a lone `](`');
});

test('literal Markdown fails only above the baseline count, and its baseline file is not a link baseline', () => {
  const found = [{ page: 'a/index.html', count: 2 }, { page: 'b/index.html', count: 1 }, { page: 'c/index.html', count: 3 }];
  assert.deepEqual(literalOverBaseline(found, { 'a/index.html': 2, 'c/index.html': 1 }).map((f) => f.page), ['b/index.html', 'c/index.html']);
  assert.deepEqual(literalOverBaseline(found).length, 3);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'baselines-'));
  fs.writeFileSync(path.join(dir, 'literal-markdown.json'), JSON.stringify({ 'a/index.html': 2 }));
  fs.writeFileSync(path.join(dir, 'live.json'), '[]');
  const known = readBaselines(dir);
  assert.deepEqual(known.versions, []);
  assert.deepEqual(known.literal, { 'a/index.html': 2 });
});
