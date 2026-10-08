import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { convertMkdocsSite, convertMergedSites, keepMkdocsUrl } from '../src/site.js';
import { loadConfig, ConfigError } from '../src/config.js';
import { tempSource } from './helpers.js';

const mkdocsRepo = () => tempSource({
  'en/mkdocs.yml': 'site_name: Demo\nnav:\n  - Home: index.md\n  - Guides:\n      - guides/index.md\n      - Setup: guides/setup.md\n      - Broken: guides/broken.md\nextra:\n  product_name: Demo Server\n',
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
