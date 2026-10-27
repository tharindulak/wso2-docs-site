import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempSource } from './helpers.js';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/cli.js');
const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });

const repo = () => tempSource({
  'wso2-docs.yaml': 'kind: mkdocs\nmkdocs: en/mkdocs.yml\nroute: demo\ndeployment_options: [Self-hosted]\nedit_url: https://github.com/wso2/docs-demo/blob/main/\n',
  'en/mkdocs.yml': 'site_name: Demo\nnav:\n  - Home: index.md\n  - Broken: broken.md\n',
  'en/docs/index.md': '# Demo\n\nHello.\n',
  'en/docs/broken.md': '# Broken\n\n<img src="x.png" onerror="alert(1)">\n<a href="javascript:x()">x</a>\n',
});

test('check reports new failures with file and kind, and exits 1', () => {
  const r = run(repo(), 'check');
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stdout, /✖ en\/docs\/broken\.md\n {4}policy/);
  assert.match(r.stdout, /1 pages convert · 1 new failure/);
});

test('check --format github prints workflow annotations', () => {
  const r = run(repo(), 'check', '--format', 'github');
  assert.match(r.stdout, /^::error file=en\/docs\/broken\.md,title=wso2-docs policy::policy: /m);
});

test('an exclude list turns known failures into a pass (exit 0)', () => {
  const root = repo();
  fs.appendFileSync(path.join(root, 'wso2-docs.yaml'), 'exclude: [broken.md]\n');
  const r = run(root, 'check');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /✔ 1 pages convert · 0 new failures · 1 on the exclude list/);
});

test('convert writes docs, sidebar.json and a manifest with the contract version', () => {
  const root = repo();
  fs.appendFileSync(path.join(root, 'wso2-docs.yaml'), 'exclude: [broken.md]\n');
  const r = run(root, 'convert', '--out', 'dist');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/manifest.json'), 'utf8'));
  assert.equal(manifest.contract, 1);
  assert.equal(manifest.converter.name, '@wso2/docs-converter');
  assert.equal(manifest.pages.converted, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'dist/sidebar.json'), 'utf8')), { docs: [{ type: 'doc', id: 'index', label: 'Home' }] });
  assert.match(fs.readFileSync(path.join(root, 'dist/docs/index.md'), 'utf8'), /custom_edit_url: https:\/\/github\.com\/wso2\/docs-demo\/blob\/main\/en\/docs\/index\.md/);
});

test('convert refuses to clear a folder it did not write, and paths outside the repo', () => {
  const root = repo();
  fs.mkdirSync(path.join(root, 'notes'));
  fs.writeFileSync(path.join(root, 'notes/keep.txt'), 'mine');
  const r = run(root, 'convert', '--out', 'notes');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /was not written by wso2-docs/);
  assert.ok(fs.existsSync(path.join(root, 'notes/keep.txt')));
  assert.equal(run(root, 'convert', '--out', '../elsewhere').status, 2);
});

test('usage errors exit 2; --version prints the package version', () => {
  assert.equal(run(repo(), 'publish').status, 2);
  assert.match(run(repo(), '--version').stdout, /^\d+\.\d+\.\d+\n$/);
});

test('check --release-tag warns when the release has no version folder, and still exits 0', () => {
  const root = repo();
  fs.appendFileSync(path.join(root, 'wso2-docs.yaml'), 'exclude: [broken.md]\n');
  const r = run(root, 'check', '--release-tag', 'v7.4.0', '--version-folder', 'en/identity-server/{version}');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /release v7\.4\.0 has no folder en\/identity-server\/7\.4\.0/);
});

test('check --release-tag is quiet when the folder exists, reads component tags and fix segments', () => {
  const root = repo();
  fs.appendFileSync(path.join(root, 'wso2-docs.yaml'), 'exclude: [broken.md]\n');
  fs.mkdirSync(path.join(root, 'en/gateway/1.3.0'), { recursive: true });
  const r = run(root, 'check', '--release-tag', 'api-gateway/v1.3.0.2', '--version-folder', 'en/gateway/{version}');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stderr, /has no folder/);
  assert.equal(run(root, 'check', '--release-tag', 'release-1', '--version-folder', 'x/{version}').status, 2);
  assert.equal(run(root, 'check', '--release-tag', 'v1.0.0').status, 2);
});

test('check fails on a bad lifecycle stage value and warns on invalid front-matter YAML', () => {
  const root = tempSource({
    'wso2-docs.yaml': 'kind: mkdocs\nmkdocs: en/mkdocs.yml\nroute: demo\ndeployment_options: [Self-hosted]\n',
    'en/mkdocs.yml': 'site_name: Demo\nnav:\n  - Home: index.md\n  - Old: old.md\n',
    'en/docs/index.md': '---\ntitle: [x\n---\n# Demo\n',
    'en/docs/old.md': '---\nstatus: deprecated\n---\n# Old\n',
  });
  const r = run(root, 'check');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /✖ en\/docs\/old\.md\n {4}lifecycle status: deprecated needs deprecated_since/);
  assert.match(r.stdout, /⚠ en\/docs\/index\.md\n {4}yaml {5}front matter is not valid YAML/);
  assert.match(r.stdout, /2 pages convert · 0 new failures · 1 lifecycle problem · 1 front matter warning/);
  const gh = run(root, 'check', '--format', 'github');
  assert.match(gh.stdout, /^::error file=en\/docs\/old\.md,title=wso2-docs lifecycle::/m);
  assert.match(gh.stdout, /^::warning file=en\/docs\/index\.md,title=wso2-docs yaml::/m);
  fs.writeFileSync(path.join(root, 'en/docs/old.md'), '---\nstatus: deprecated\ndeprecated_since: "7.0.0"\n---\n# Old\n');
  assert.equal(run(root, 'check').status, 0, 'a YAML warning alone does not fail the check');
});

// ---- Docs bundles ----

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const gatewayRepo = (manifestExtra = '') => tempSource({
  'docusaurus/api-gateway/wso2-docs.yaml': `kind: docusaurus
route: api-platform/api-gateway
deployment_options: [Self-hosted]
docs: docusaurus/api-gateway/docs
section:
  id: api-platform-api-gateway
  label: API Gateway
  version: 1.2.0
  release_tag: gateway/v
nav:
  - page: docusaurus/api-gateway/docs/overview.mdx
    label: Overview
${manifestExtra}`,
  'docusaurus/api-gateway/docs/overview.mdx': '---\ntitle: API Platform Gateway overview\n---\n\n# Overview\n\n![Arch](../assets/arch.png)\n',
  'docusaurus/api-gateway/assets/arch.png': 'PNG',
  'docusaurus/api-gateway/sidebars.json': '{ "docs": [{ "type": "doc", "id": "overview", "label": "Overview" }] }',
});

test('bundle packs the branch\'s section into a deterministic zip with the manifest at its root', () => {
  const root = gatewayRepo();
  const out = fs.mkdtempSync(path.join(root, '..', 'bundle-out-'));
  fs.writeFileSync(path.join(out, 'tags.txt'), 'gateway/v1.2.0\nai-gateway/v1.2.0.3\n');
  const r = run(root, 'bundle', '--branch', 'release/gateway/1.2.0', '--commit', COMMIT, '--tags', path.join(out, 'tags.txt'), '--out', out);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const info = JSON.parse(fs.readFileSync(path.join(out, 'bundle.json'), 'utf8'));
  assert.equal(info.tag, 'gateway/v1.2.0.1');
  assert.equal(info.asset, 'api-platform-api-gateway-1.2.0.1.docs.zip');
  assert.equal(info.title, 'API Gateway 1.2.0.1');
  assert.equal(info.source_commit, COMMIT);
  const zip = path.join(out, info.asset);
  assert.match(fs.readFileSync(`${zip}.sha256`, 'utf8'), new RegExp(`^${info.sha256}  ${info.asset.replace(/\./g, '\\.')}\\n$`));
  const listing = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' });
  if (listing.status === 0) assert.deepEqual(listing.stdout.trim().split('\n'), ['docusaurus/api-gateway/assets/arch.png', 'docusaurus/api-gateway/docs/overview.mdx', 'wso2-docs.yaml']);
  const again = fs.mkdtempSync(path.join(root, '..', 'bundle-out-'));
  run(root, 'bundle', '--branch', 'release/gateway/1.2.0', '--commit', COMMIT, '--tags', path.join(out, 'tags.txt'), '--out', again);
  assert.ok(fs.readFileSync(zip).equals(fs.readFileSync(path.join(again, info.asset))), 'same input, same bytes');
});

test('bundle --check-only checks without writing anything, and needs no commit', () => {
  const root = gatewayRepo();
  const out = fs.mkdtempSync(path.join(root, '..', 'bundle-out-'));
  const r = run(root, 'bundle', '--branch', 'release/gateway/1.2.0', '--check-only', '--out', out);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(fs.readdirSync(out), []);
});

test('bundle fails when the manifest version is not the branch version, or a nav page is missing', () => {
  const root = gatewayRepo();
  const wrong = run(root, 'bundle', '--branch', 'release/gateway/1.3.0', '--check-only');
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /section\.version 1\.2\.0 .* branch release\/gateway\/1\.3\.0/);
  const missing = gatewayRepo('  - page: docusaurus/api-gateway/docs/gone.mdx\n');
  const r = run(missing, 'bundle', '--branch', 'release/gateway/1.2.0', '--check-only', '--format', 'github');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /::error file=docusaurus\/api-gateway\/wso2-docs\.yaml,title=wso2-docs navigation::navigation: nav page docusaurus\/api-gateway\/docs\/gone\.mdx/);
});

test('bundle reports references outside the section as errors on the page', () => {
  const root = gatewayRepo();
  fs.writeFileSync(path.join(root, 'docusaurus/api-gateway/docs/overview.mdx'), '# Overview\n\n![x](../../../secret.png)\n');
  fs.writeFileSync(path.join(root, 'secret.png'), 'x');
  const r = run(root, 'bundle', '--branch', 'release/gateway/1.2.0', '--check-only', '--format', 'github');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /::error file=docusaurus\/api-gateway\/docs\/overview\.mdx,title=wso2-docs outside::/);
});

test('manifest init writes section and nav from the sidebars file, keeping labels', () => {
  const root = gatewayRepo();
  const cfg = 'docusaurus/api-gateway/wso2-docs.yaml';
  fs.writeFileSync(path.join(root, cfg), 'kind: docusaurus\nroute: api-platform/api-gateway\ndeployment_options: [Self-hosted]\ndocs: docusaurus/api-gateway/docs\nsidebar: docusaurus/api-gateway/sidebars.json\n');
  const r = run(root, 'manifest', 'init', '--config', cfg, '--id', 'api-platform-api-gateway', '--label', 'API Gateway', '--prefix', 'gateway/v', '--section-version', '1.2.0', '--write');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const written = fs.readFileSync(path.join(root, cfg), 'utf8');
  assert.doesNotMatch(written, /^sidebar:/m);
  assert.match(written, /section:\n {2}id: api-platform-api-gateway\n {2}label: API Gateway\n {2}version: 1\.2\.0\n {2}release_tag: gateway\/v\n/);
  assert.match(written, /nav:\n {2}- page: docusaurus\/api-gateway\/docs\/overview\.mdx\n {4}label: Overview\n/);
  assert.equal(run(root, 'bundle', '--branch', 'release/gateway/1.2.0', '--check-only').status, 0);
});
