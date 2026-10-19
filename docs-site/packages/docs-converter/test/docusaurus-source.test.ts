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
  const broken = { 'docusaurus/docs/broken.md': '---\ntitle: Broken\n---\n\n# Broken\n\n<div>\n\nunclosed\n\n## Step 1: A\n\na\n\n## Step 2: B\n\nb\n' };
  const lenient = await prepare(migrated(broken), 'docusaurus/docs');
  assert.match(lenient.read('broken.md'), /format: md/);
  assert.match(lenient.read('broken.md'), /## Step 1: A/, 'a CommonMark page gets no components');
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

test('a Docusaurus tree is taken as written: explicit components stay, convention-written pages get none (one rendering path)', async () => {
  const steps = '## Step 1: Install\n\na\n\n## Step 2: Run\n\nb\n';
  const root = migrated({
    'docusaurus/docs/old.mdx': `---\ntitle: Old\n---\n\n# Old\n\n:::note[Before you begin]\nNeed a.\n:::\n\n${steps}`,
    'docusaurus/docs/_partial.mdx': steps,
    'docusaurus/docs/new.mdx': '---\ntitle: New\n---\n\n<Steps>\n\n## Install {/* #step-1-install */}\n\na\n\n</Steps>\n',
  });
  const { read } = await prepare(root, 'docusaurus/docs');
  assert.match(read('old.md'), /:::note\[Before you begin\]\nNeed a\.\n:::\n\n## Step 1: Install/);
  assert.doesNotMatch(read('old.md'), /<Steps>|<Prerequisites/);
  assert.equal(read('_partial.md'), steps);
  assert.match(read('new.md'), /<Steps>\n\n## Install \{\/\* #step-1-install \*\/\}\n\na\n\n<\/Steps>\n$/);
});

// docs-agent-platform and open-healthcare-docs: Docusaurus sources whose writers follow the Prerequisites and
// "Step N" conventions without the explicit components.
test('a Docusaurus source that opts in to the conventions gets the explicit components; by default it is taken as written', async () => {
  const page = { 'docusaurus/docs/guide.md': '---\ntitle: Guide\n---\n\n# Guide\n\n## Prerequisites\n\n- An account\n\n## Step 1: Install\n\nInstall it.\n\n## Step 2: Run\n\nRun it.\n' };
  const opted = (await prepare(migrated(page), 'docusaurus/docs', { conventions: true })).read('guide.md');
  assert.match(opted, /<Prerequisites>[\s\S]*An account[\s\S]*<\/Prerequisites>/);
  assert.match(opted, /<Steps>\n+## Install[\s\S]*## Run[\s\S]*<\/Steps>/);
  const asWritten = (await prepare(migrated(page), 'docusaurus/docs')).read('guide.md');
  assert.doesNotMatch(asWritten, /<Steps>|<Prerequisites>/);
  assert.match(asWritten, /## Step 1: Install/);
  const optOut = { 'docusaurus/docs/guide.md': page['docusaurus/docs/guide.md'].replace('title: Guide', 'title: Guide\nstepper: false') };
  assert.doesNotMatch((await prepare(migrated(optOut), 'docusaurus/docs', { conventions: true })).read('guide.md'), /<Steps>/, 'page opt-out honoured');
});

test('githubEditUrl links to the editor on a branch, or to a pinned commit\'s view', async () => {
  const { githubEditUrl } = await import('../src/site.js');
  assert.equal(githubEditUrl('wso2/docs-x', 'main', '/r', 'edit')('/r/en/docs/a.md'), 'https://github.com/wso2/docs-x/edit/main/en/docs/a.md');
  assert.equal(githubEditUrl('wso2/docs-x', 'abc123', '/r')('/r/en/docs/a.md'), 'https://github.com/wso2/docs-x/blob/abc123/en/docs/a.md');
});

// docs-integrator guides: ThemedImage sources written as useBaseUrl('/img/...') pointed at the site root.
test('static paths given to useBaseUrl move under the section route, like Markdown image paths', async () => {
  const page = { 'docusaurus/docs/themed.md': "---\ntitle: Themed\n---\n\nimport ThemedImage from '@theme/ThemedImage';\nimport useBaseUrl from '@docusaurus/useBaseUrl';\n\n# Themed\n\n<ThemedImage alt=\"A\" sources={{ light: useBaseUrl('/img/a.png'), dark: useBaseUrl(\"/img/a-dark.png\") }} />\n\n![B](/img/b.png)\n" };
  const text = (await prepare(migrated(page), 'docusaurus/docs')).read('themed.md');
  assert.match(text, /useBaseUrl\('\/identity\/img\/a\.png'\)/);
  assert.match(text, /useBaseUrl\("\/identity\/img\/a-dark\.png"\)/);
  assert.match(text, /!\[B\]\(\/identity\/img\/b\.png\)/);
});
