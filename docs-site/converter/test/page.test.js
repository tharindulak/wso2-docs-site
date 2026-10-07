import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertRendered, PageError, compileCheck } from '../page.js';

test('produces compiled MDX with front matter, imports and deployment options', async () => {
  const { mdx } = await convertRendered('---\ntitle: TOTP\ntemplate: x.html\n---\n# TOTP\n\n!!! note\n    Hi {name}.\n\n<Applies to="WSO2 Cloud">\n\nCloud.\n\n</Applies>\n', { deploymentOptions: ['WSO2 Cloud', 'Self-hosted'], editUrl: 'https://github.com/wso2/docs-is/edit/main/x.md' });
  assert.match(mdx, /^---\ntitle: TOTP\nmkdocs_template: x\ndeployment_options:\n {2}- WSO2 Cloud\n {2}- Self-hosted\ncustom_edit_url: https:\/\/github\.com/);
  assert.doesNotMatch(mdx, /^template:/m);
  assert.match(mdx, /import Applies from '@site\/src\/components\/Applies';/);
  assert.match(mdx, /:::note\n\nHi \\\{name\\\}\./);
});

test('policy and include failures surface as PageError with a kind (compile failures fall back to CommonMark)', async () => {
  await assert.rejects(convertRendered('<a href="javascript:x()">x</a>', { deploymentOptions: [] }), (e) => e instanceof PageError && e.kind === 'policy');
  await assert.rejects(convertRendered('{!x.md!}', { deploymentOptions: [] }), (e) => e.kind === 'include');
});

test('title falls back to the first heading; MkDocs template and quick-start data are kept as front matter', async () => {
  const { mdx } = await convertRendered('\n[//] STEPS_START\n\n# React Quickstart\n\nBody.\n', { deploymentOptions: [], pageData: { frontMatter: { template: 'templates/quick-start.html' }, meta: { what_you_will_learn: ['A'] } } });
  assert.match(mdx, /^title: React Quickstart$/m);
  assert.match(mdx, /^mkdocs_template: quick-start$/m);
  assert.match(mdx, /^quick_start:\n {2}what_you_will_learn:\n {4}- A$/m);
  assert.doesNotMatch(mdx, /STEPS_START/);
});

test('a page that fails only on a raw HTML table converts once the table is rewritten; other pages are untouched', async () => {
  const opts = { deploymentOptions: ['Self-hosted'] };
  const broken = '# API\n\n<table>\n<tr>\n<td>Context</td>\n<td>\nThe API context.\n<ul><li>Must be unique</ul>\n</td>\n</tr>\n</table>\n\nNext **step**.\n';
  const { mdx, stats } = await convertRendered(broken, opts);
  assert.equal(stats.htmlBlocks, 1);
  assert.match(mdx, /<table><tbody><tr><td>\{"Context"\}<\/td><td>\{"The API context\. "\}<ul><li>\{"Must be unique"\}<\/li><\/ul><\/td><\/tr><\/tbody><\/table>/);
  assert.match(mdx, /Next \*\*step\*\*\./, 'Markdown outside the block is converted as usual');
  const fine = await convertRendered('# Fine\n\n<table>\n<tr><td>ok</td></tr>\n</table>\n', opts);
  assert.equal(fine.stats.htmlBlocks ?? 0, 0);
  assert.match(fine.mdx, /<tr><td>ok<\/td><\/tr>/);
});

test('a page MDX cannot read falls back to CommonMark, with scripts removed, and stays a real page', async () => {
  const opts = { deploymentOptions: ['Self-hosted'] };
  const src = '# Odd\n\nText with {braces and <!DOCTYPE stray> markup <b>bold</i>.\n\n<script>track()</script>\n\n!!! note\n    Kept.\n';
  const { mdx, stats } = await convertRendered(src, opts);
  assert.equal(stats.format, 'md');
  assert.deepEqual(stats.removed, ['script']);
  assert.match(mdx, /^mdx:\n {2}format: md$/m);
  assert.doesNotMatch(mdx, /track\(\)|^import /m);
  assert.match(mdx, /:::note/);
});

test('event handler attributes are removed; javascript: URLs still reject the page', async () => {
  const { mdx, stats } = await convertRendered('<div class="card" onclick="location.href=\'x/\'">Card</div>\n', { deploymentOptions: [] });
  assert.doesNotMatch(mdx, /onclick|location/);
  assert.deepEqual(stats.removed, ['onclick']);
  await assert.rejects(convertRendered('<a href="javascript:x()">x</a>', { deploymentOptions: [] }), (e) => e.kind === 'policy');
});

test('the compile check rejects a link URL Docusaurus cannot parse', async () => {
  await assert.rejects(compileCheck('---\n---\n[x](http://host:port/a)\n'), (e) => e.kind === 'compile' && /cannot be parsed/.test(e.message));
});

test('CommonMark fallback pages keep HTML class attributes', async () => {
  const { mdx, stats } = await convertRendered('<table>\n<tr class="odd">\n<td>a {b</td>\n</tr>\n</table>\n\nx <!DOCTYPE y> z\n', { deploymentOptions: [] });
  if (stats.format === 'md') assert.match(mdx, /<tr class="odd">/);
  assert.doesNotMatch(mdx, /format: md[\s\S]*className=/);
});
