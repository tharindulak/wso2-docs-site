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
