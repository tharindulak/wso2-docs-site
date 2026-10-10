import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { convertMkdocsSite, convertMergedSites, keepMkdocsUrl, relativeImages, copyReferencedAssets, referencedFiles } from '../src/site.js';
import { loadConfig, ConfigError } from '../src/config.js';
import { tempSource } from './helpers.js';

const mkdocsRepo = () => tempSource({
  'en/mkdocs.yml': 'site_name: Demo\nplugins:\n  - markdownextradata\nnav:\n  - Home: index.md\n  - Guides:\n      - guides/index.md\n      - Setup: guides/setup.md\n      - Broken: guides/broken.md\nextra:\n  product_name: Demo Server\n',
  'en/docs/index.md': '# Demo\n\nWelcome to {{ product_name }}.\n',
  'en/docs/guides/index.md': '# Guides\n',
  'en/docs/guides/setup.md': '# Setup\n\n!!! note\n    See [home]({{ base_path }}/index.md).\n\n![Shot]({{ base_path }}/assets/shot.png)\n',
  'en/docs/guides/broken.md': '# Broken\n\n<a href="javascript:x()">x</a>\n',
  'en/docs/assets/shot.png': 'PNG',
});

test('an MkDocs site converts page by page, with a sidebar from nav:, assets and failures reported', async () => {
  const root = mkdocsRepo();
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { sidebar, report } = await convertMkdocsSite(
    { root, mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'], currentSite: 'https://demo.example/en/1.0/' },
    { outDir: out, route: 'demo' },
  );
  assert.equal(report.ok, 3);
  assert.deepEqual(report.failures.map((f) => [f.page, f.kind]), [['guides/broken.md', 'policy']]);
  assert.ok(!fs.existsSync(path.join(out, 'guides/broken.md')), 'no fallback configured: failing page not written');
  const setup = fs.readFileSync(path.join(out, 'guides/setup.md'), 'utf8');
  assert.match(setup, /^deployment_options:\n {2}- Self-hosted$/m);
  assert.match(setup, /:::note\n\nSee \[home\]\(\/demo\/index\.md\)\./);
  assert.ok(fs.existsSync(path.join(out, 'assets/shot.png')), 'assets copied next to pages');
  assert.match(fs.readFileSync(path.join(out, 'index.md'), 'utf8'), /Welcome to Demo Server\./);
  assert.deepEqual(sidebar, [
    { type: 'doc', id: 'index', label: 'Home' },
    { type: 'category', label: 'Guides', link: { type: 'doc', id: 'guides/index' }, items: [{ type: 'doc', id: 'guides/setup', label: 'Setup' }] },
  ]);
  assert.deepEqual(report.droppedNav, ['guides/broken.md']);
});

test('excluded and failing pages get the caller\'s fallback page; excluded pages that pass are reported', async () => {
  const root = mkdocsRepo();
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { report } = await convertMkdocsSite(
    { root, mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'], currentSite: 'https://demo.example/en/1.0/' },
    { outDir: out, route: 'demo', exclude: ['guides/setup.md'], fallback: (p) => `---\ntitle: ${p.title}\n---\n\nMoved: ${p.to}\n` },
  );
  assert.deepEqual(report.nowPassing, ['guides/setup.md']);
  assert.equal(report.redirected, 2);
  assert.match(fs.readFileSync(path.join(out, 'guides/broken.md'), 'utf8'), /Moved: https:\/\/demo\.example\/en\/1\.0\/guides\/broken\//);
});

test('a cloud + self-hosted pair merges into one page per topic', async () => {
  const root = tempSource({
    'cloud/mkdocs.yml': 'site_name: Cloud\nextra:\n  product_name: Cloud P\nnav:\n  - p.md\n',
    'cloud/docs/p.md': '{% include "../../inc/p.md" %}',
    'self/mkdocs.yml': 'site_name: Self\nextra:\n  product_name: Server P\nnav:\n  - p.md\n  - only-self.md\n',
    'self/docs/p.md': '{% include "../../inc/p.md" %}',
    'self/docs/only-self.md': '# Install\n',
    'inc/p.md': '# {{ product_name }}\n\n{% if product_name == "Cloud P" %}Console.{% else %}Edit deployment.toml.{% endif %}\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { sidebar, report } = await convertMergedSites(
    { cloud: { root, mkdocs: 'cloud/mkdocs.yml' }, self: { root, mkdocs: 'self/mkdocs.yml' }, sharedNames: { product_name: 'Platform P' } },
    { outDir: out, route: 'p' },
  );
  assert.equal(report.ok, 2);
  const page = fs.readFileSync(path.join(out, 'p.md'), 'utf8');
  assert.match(page, /deployment_options:\n {2}- WSO2 Cloud\n {2}- Self-hosted/);
  assert.match(page, /# Platform P/);
  assert.match(page, /<Applies to="WSO2 Cloud">\n\nConsole\.\n\n<\/Applies>/);
  assert.match(fs.readFileSync(path.join(out, 'only-self.md'), 'utf8'), /deployment_options:\n {2}- Self-hosted\n/);
  assert.deepEqual(sidebar.map((i) => i.id), ['p', 'only-self']);
});

test('keepMkdocsUrl pins pages Docusaurus would turn into folder index pages', () => {
  assert.equal(keepMkdocsUrl('---\ntitle: a\n---\nx', 'apis/apis.md'), '---\nslug: /apis/apis/\ntitle: a\n---\nx');
  assert.equal(keepMkdocsUrl('---\ntitle: a\n---\nx', 'apis/other.md'), '---\ntitle: a\n---\nx');
});

test('config: paths must stay inside the repository; kinds and routes are validated', () => {
  const root = tempSource({
    'ok.yaml': 'kind: mkdocs\nmkdocs: en/mkdocs.yml\ndeployment_options: [Self-hosted]\nexclude: exclude.txt\n',
    'exclude.txt': '# known\nguides/broken.md\n',
    'escape.yaml': 'kind: mkdocs\nmkdocs: ../../etc/mkdocs.yml\ndeployment_options: [Self-hosted]\n',
    'kind.yaml': 'kind: sphinx\n',
    'route.yaml': 'kind: mkdocs\nmkdocs: en/mkdocs.yml\nroute: "../x"\ndeployment_options: []\n',
  });
  const ok = loadConfig(path.join(root, 'ok.yaml'), root);
  assert.equal(ok.route, 'docs');
  assert.deepEqual(ok.excludeList, ['guides/broken.md']);
  assert.throws(() => loadConfig(path.join(root, 'escape.yaml'), root), ConfigError);
  assert.throws(() => loadConfig(path.join(root, 'kind.yaml'), root), /kind must be/);
  assert.throws(() => loadConfig(path.join(root, 'route.yaml'), root), /route must be/);
});

test('API reference pages resolve their spec like a browser would and read its title, never outside the docs folder', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: Demo\nplugins:\n  - markdownextradata\nnav:\n  - apis/publisher.md\n  - apis/abs.md\n  - apis/escape.md\n',
    'en/docs/apis/publisher.md': `<redoc spec-url='../publisher-v4.yaml'></redoc>`,
    'en/docs/apis/abs.md': '<redoc spec-url="{{ base_path }}/apis/restapis/admin.yaml"></redoc>',
    'en/docs/apis/escape.md': `<redoc spec-url='../../../../secret.yaml'></redoc>`,
    'en/docs/apis/publisher-v4.yaml': 'openapi: 3.0.1\ninfo:\n  title: Publisher API v4\n  description: |\n    Manage APIs in the **Publisher**.\n\n    Second paragraph.\n',
    'en/docs/apis/restapis/admin.yaml': '{"openapi":"3.0.1","info":{"title":"Admin API"}}',
    'secret.yaml': 'info:\n  title: Should not be read\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { report } = await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'] }, { outDir: out, route: 'demo' });
  assert.equal(report.ok, 3);
  const read = (p: string) => fs.readFileSync(path.join(out, p), 'utf8');
  assert.match(read('apis/publisher.md'), /^title: Publisher API v4$/m);
  assert.match(read('apis/publisher.md'), /^description: Manage APIs in the Publisher\.$/m, 'first paragraph, Markdown removed');
  assert.match(read('apis/abs.md'), /^title: Admin API$/m);
  assert.match(read('apis/abs.md'), /<ApiReference spec="\/demo\/apis\/restapis\/admin\.yaml" \/>/);
  assert.doesNotMatch(read('apis/escape.md'), /Should not be read/);
});

test('without markdownextradata or macros, {{ }} and {% %} are text, and include markers still expand', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: Old\nplugins:\n  - search\nnav:\n  - Home: index.md\n',
    'en/docs/index.md': '# Old\n\nSend {{token}} and keep {% raw %} as written.\n\n{!includes/note.md!}\n',
    'en/docs/includes/note.md': 'Included.',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { report } = await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [] }, { outDir: out, route: 'old' });
  assert.equal(report.failures.length, 0);
  const page = fs.readFileSync(path.join(out, 'index.md'), 'utf8');
  assert.match(page, /token/);
  assert.match(page, /raw/);
  assert.match(page, /Included\./);
});

test('with markdownextradata (string or mapping form, also through INHERIT), Jinja renders as before', async () => {
  for (const plugins of ['  - markdownextradata\n', '  - markdownextradata: {}\n', '  - macros\n']) {
    const root = tempSource({
      'en/base.yml': `plugins:\n${plugins}`,
      'en/mkdocs.yml': 'INHERIT: base.yml\nsite_name: New\nnav:\n  - Home: index.md\nextra:\n  product_name: Demo\n',
      'en/docs/index.md': '# New\n\nWelcome to {{ product_name }}.\n',
    });
    const out = fs.mkdtempSync(path.join(root, 'out-'));
    await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [] }, { outDir: out, route: 'new' });
    assert.match(fs.readFileSync(path.join(out, 'index.md'), 'utf8'), /Welcome to Demo\./, plugins);
  }
});

test('markdown images under the section route become page-relative when the file exists', () => {
  const exists = (rel: string) => rel === 'assets/img/a.png';
  assert.equal(relativeImages('![A](/demo/assets/img/a.png)', 'guides/setup.md', 'demo', exists), '![A](../assets/img/a.png)');
  assert.equal(relativeImages('![A](/demo/assets/img/a.png "t")', 'index.md', 'demo', exists), '![A](assets/img/a.png "t")');
  assert.equal(relativeImages('![B](/demo/assets/img/b.png)', 'index.md', 'demo', exists), '![B](/demo/assets/img/b.png)', 'missing file left alone');
  assert.equal(relativeImages('<img src="/demo/assets/img/a.png" />', 'index.md', 'demo', exists), '<img src="/demo/assets/img/a.png" />', 'HTML stays absolute');
  assert.equal(relativeImages('```\n![A](/demo/assets/img/a.png)\n```', 'index.md', 'demo', exists), '```\n![A](/demo/assets/img/a.png)\n```', 'code untouched');
});

test('only assets still referenced by absolute path are copied to static', () => {
  const root = tempSource({ 'docs/assets/a.png': 'A', 'docs/assets/b.png': 'B', 'docs/files/c.zip': 'C', 'pages/index.md': '<img src="/demo/assets/a.png" /> [zip](/demo/files/c.zip)' });
  const to = path.join(root, 'static');
  assert.equal(copyReferencedAssets(path.join(root, 'docs'), path.join(root, 'pages'), to, 'demo'), 2);
  assert.ok(fs.existsSync(path.join(to, 'assets/a.png')));
  assert.ok(fs.existsSync(path.join(to, 'files/c.zip')));
  assert.ok(!fs.existsSync(path.join(to, 'assets/b.png')));
});

test('relative HTML images, file links and API specs are copied to static, resolved against the page URL', () => {
  const root = tempSource({
    'docs/assets/img/learn/a.png': 'A', 'docs/apis/restapis/actions.yaml': 'openapi: 3.0.0', 'docs/files/guide.pdf': 'P', 'docs/assets/unused.png': 'U',
    'docs/learn/b.png': 'B', 'secret.txt': 'S',
    'pages/learn/configuring-reset.md': '<img src="../../assets/img/learn/a.png" />\n<a href={"../../files/guide.pdf"}>pdf</a>\n<img src="b.png" />',
    'pages/apis/actions-rest-api.md': '<ApiReference spec="../../apis/restapis/actions.yaml" />',
    'pages/learn/escape.md': '<img src="../../../../secret.txt" /> <img src="https://x.example/a.png" /> <a href="#x.png">x</a> <img src="%E0%A4%A.png" />',
  });
  const to = path.join(root, 'static');
  assert.equal(copyReferencedAssets(path.join(root, 'docs'), path.join(root, 'pages'), to, 'demo'), 3);
  for (const f of ['assets/img/learn/a.png', 'apis/restapis/actions.yaml', 'files/guide.pdf']) assert.ok(fs.existsSync(path.join(to, f)), f);
  assert.ok(!fs.existsSync(path.join(to, 'learn/b.png')), 'b.png resolves to learn/configuring-reset/b.png, as in a browser');
  assert.ok(!fs.existsSync(path.join(to, 'assets/unused.png')));
  assert.ok(!fs.existsSync(path.join(to, 'secret.txt')));
});

test('referencedFiles resolves like a browser and never leaves the section route', () => {
  assert.deepEqual(referencedFiles('<img src="img/a.png" />', 'guides/setup.md', 'demo'), ['guides/setup/img/a.png'], 'directory URLs');
  assert.deepEqual(referencedFiles('<img src="img/a.png" />', 'guides/index.md', 'demo'), ['guides/img/a.png']);
  assert.deepEqual(referencedFiles('<ApiReference spec="../../apis/x.yaml" />', 'apis/x-api.md', 'identity/7.1.0'), ['apis/x.yaml'], 'route with segments');
  assert.deepEqual(referencedFiles('<img src="../../../x.png" />', 'a.md', 'demo'), [], 'outside the route');
  assert.deepEqual(referencedFiles('<a href="../other/">x</a> <img src="data:image/png;base64,x" /> <a href="mailto:a@b.c">m</a>', 'a.md', 'demo'), [], 'pages, schemes');
  assert.deepEqual(referencedFiles('<img src="bad%E0.png" /> /demo/bad%E0.png', 'a.md', 'demo'), [], 'malformed escapes are skipped, not thrown');
  assert.deepEqual(referencedFiles('<img src="my%20shot.png?v=1" />', 'index.md', 'demo'), ['my shot.png']);
  assert.deepEqual(referencedFiles('[WSDL](../../assets/attachments/a.wsdl) ![shot](img/b.png "t") [page](../other/) [ext](https://x/a.png)', 'develop/x.md', 'demo/5.9.0'),
    ['assets/attachments/a.wsdl', 'develop/x/img/b.png'], 'Markdown links and images, resolved against the page URL');
});
