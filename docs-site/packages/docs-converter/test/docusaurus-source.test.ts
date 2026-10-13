import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prepareDocusaurusDocs } from '../src/site.js';
import { tempSource } from './helpers.js';

/** A migrated content source: docs-is's generated docusaurus/ tree with Latest and one older version. */
const migrated = (files: Record<string, string> = {}) => tempSource({
  'docusaurus/sidebars.json': '{ "docs": [{ "type": "doc", "id": "index" }] }',
  'docusaurus/versioned_sidebars/version-7.2.0-sidebars.json': '{ "docs": [{ "type": "doc", "id": "index" }] }',
  'docusaurus/docs/index.md': '---\ntitle: Home\n---\n\n# Home\n\n![Shot](../assets/img/shot.png)\n',
  'docusaurus/versioned_docs/version-7.2.0/guides/index.md': '---\ntitle: Guides\n---\n\n# Guides\n\n![Shot](../../../assets/_versions/7.2.0/img/shot.png)\n',
  'docusaurus/assets/img/shot.png': 'NEW',
  'docusaurus/assets/_versions/7.2.0/img/shot.png': 'OLD',
  ...files,
});

async function prepare(root: string, docs: string, extra: Record<string, unknown> = {}) {
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const staticTo = fs.mkdtempSync(path.join(root, 'static-'));
  const result = await prepareDocusaurusDocs({ root, docs, sidebar: 'docusaurus/sidebars.json', treeRoot: 'docusaurus', deployment_options: ['WSO2 Cloud', 'Self-hosted'], ...extra }, { outDir: out, route: 'identity' });
  return { out, staticTo, result, read: (rel: string) => fs.readFileSync(path.join(out, rel), 'utf8') };
}

test('files a page references outside its docs folder, inside the tree, are copied next to the pages and the reference follows', async () => {
  const root = migrated();
  const latest = await prepare(root, 'docusaurus/docs');
  assert.match(latest.read('index.md'), /!\[Shot\]\(_tree\/assets\/img\/shot\.png\)/);
  assert.equal(latest.read('_tree/assets/img/shot.png'), 'NEW');
  const old = await prepare(root, 'docusaurus/versioned_docs/version-7.2.0');
  assert.match(old.read('guides/index.md'), /!\[Shot\]\(\.\.\/_tree\/assets\/_versions\/7\.2\.0\/img\/shot\.png\)/);
  assert.equal(old.read('_tree/assets/_versions/7.2.0/img/shot.png'), 'OLD');
  assert.ok(!fs.existsSync(path.join(old.out, '_tree/assets/img/shot.png')), 'only referenced files are copied');
});

test('the tree\'s static folder is copied to the folder the product route serves', async () => {
  const root = migrated({ 'docusaurus/static/apis/users.yaml': 'SPEC', 'docusaurus/static/apis/roles.yml': 'YML SPEC', 'docusaurus/static/_versions/7.2.0/apis/users.yaml': 'OLD SPEC' });
  const staticTo = path.join(root, 'served', 'identity');
  await prepare(root, 'docusaurus/versioned_docs/version-7.2.0', { static: { from: 'docusaurus/static', to: staticTo } });
  assert.equal(fs.readFileSync(path.join(staticTo, 'apis/users.yaml'), 'utf8'), 'SPEC');
  assert.equal(fs.readFileSync(path.join(staticTo, '_versions/7.2.0/apis/users.yaml'), 'utf8'), 'OLD SPEC');
  assert.equal(fs.readFileSync(path.join(staticTo, 'apis/roles.yml'), 'utf8'), 'YML SPEC');
});

test('a page\'s own edit link is kept; pages without one get the content source\'s', async () => {
  const root = migrated({ 'docusaurus/docs/own.md': '---\ntitle: Own\ncustom_edit_url: https://github.com/wso2/docs-is/edit/master/en/asgardeo/docs/own.md\n---\n\n# Own\n' });
  const { read } = await prepare(root, 'docusaurus/docs', { editUrl: (file: string) => `https://github.com/o/r/blob/x/${path.relative(root, file)}` });
  assert.match(read('own.md'), /^custom_edit_url: https:\/\/github\.com\/wso2\/docs-is\/edit\/master\/en\/asgardeo\/docs\/own\.md$/m);
  assert.match(read('index.md'), /^custom_edit_url: https:\/\/github\.com\/o\/r\/blob\/x\/docusaurus\/docs\/index\.md$/m);
});

test('in strict mode a page that does not compile as MDX fails instead of falling back to CommonMark', async () => {
  const broken = { 'docusaurus/docs/broken.md': '---\ntitle: Broken\n---\n\n# Broken\n\n<div>\n\nunclosed\n' };
  const lenient = await prepare(migrated(broken), 'docusaurus/docs');
  assert.match(lenient.read('broken.md'), /format: md/);
  const strict = await prepare(migrated(broken), 'docusaurus/docs', { strict: true });
  assert.deepEqual(strict.result.report.failures.map((f) => [f.page, f.kind]), [['broken.md', 'compile']]);
  assert.ok(!fs.existsSync(path.join(strict.out, 'broken.md')));
});

test('the version\'s entries in the tree\'s redirects.json become redirect pages at the old URLs', async () => {
  const root = migrated({ 'docusaurus/redirects.json': JSON.stringify({ current: { 'old/page.md': 'index.md', 'index.md': 'nowhere.md' }, '7.2.0': { 'gone.md': 'guides/index.md' } }) });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const staticDir = fs.mkdtempSync(path.join(root, 'static-'));
  await prepareDocusaurusDocs({ root, docs: 'docusaurus/docs', sidebar: 'docusaurus/sidebars.json', deployment_options: [], redirects: { file: 'docusaurus/redirects.json', version: 'current' } }, { outDir: out, staticDir, route: 'identity' });
  assert.match(fs.readFileSync(path.join(staticDir, 'old/page/index.html'), 'utf8'), /url=\/identity\/"/);
  assert.ok(!fs.existsSync(path.join(staticDir, 'gone/index.html')), 'another version\'s entries are not this version\'s');
  assert.ok(!fs.existsSync(path.join(staticDir, 'index.html')), 'a real page keeps its URL');
});

test('a page that declares CommonMark (mdx.format: md) compiles as CommonMark, also in strict mode', async () => {
  const root = migrated({ 'docusaurus/docs/table.md': '---\ntitle: Table\nmdx:\n  format: md\n---\n\n# Table\n\n<table><tr><td>x</tr></table>\n' });
  const { read, result } = await prepare(root, 'docusaurus/docs', { strict: true });
  assert.deepEqual(result.report.failures, []);
  assert.match(read('table.md'), /format: md/);
});

test('partials (files under a _ name) are copied without front matter: Docusaurus ignores it there and warns', async () => {
  const root = migrated({ 'docusaurus/docs/_partials/db/config.mdx': 'Set the **datasource**.\n' });
  const { read } = await prepare(root, 'docusaurus/docs', { editUrl: () => 'https://github.com/o/r/blob/x/f.md' });
  assert.equal(read('_partials/db/config.md'), 'Set the **datasource**.\n');
});
