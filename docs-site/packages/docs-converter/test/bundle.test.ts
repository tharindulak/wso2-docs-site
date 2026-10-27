import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseReleaseBranch, nextTag, findManifest, collectBundle, LIMITS } from '../src/bundle.js';
import { loadConfig, ConfigError } from '../src/config.js';
import { tempSource } from './helpers.js';

const manifest = (extra = '') => `kind: docusaurus
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
${extra}`;

const repo = (files: Record<string, string> = {}) => tempSource({
  'docusaurus/api-gateway/wso2-docs.yaml': manifest(),
  'docusaurus/api-gateway/docs/overview.mdx': '# Overview\n\n![Arch](../assets/img/arch.png)\n\nimport Chart from \'./_chart.mdx\';\n',
  'docusaurus/api-gateway/docs/_chart.mdx': 'chart\n',
  'docusaurus/api-gateway/assets/img/arch.png': 'PNG',
  'docusaurus/api-gateway/assets/img/unused.png': 'PNG',
  'docusaurus/api-gateway/sidebars.json': '{}',
  'docusaurus/ai-gateway/wso2-docs.yaml': manifest().replace(/api-gateway/g, 'ai-gateway').replace('gateway/v', 'ai-gateway/v'),
  'docusaurus/ai-gateway/docs/overview.mdx': '# AI\n',
  ...files,
});

test('release branches name a component and version, or latest', () => {
  assert.deepEqual(parseReleaseBranch('release/gateway/1.2.0'), { component: 'gateway', version: '1.2.0' });
  assert.deepEqual(parseReleaseBranch('refs/heads/release/7.2.0'), { component: null, version: '7.2.0' });
  assert.deepEqual(parseReleaseBranch('release/latest'), { component: null, version: 'latest' });
  assert.deepEqual(parseReleaseBranch('release/cloud/latest'), { component: 'cloud', version: 'latest' });
  for (const b of ['main', 'release/gateway/1.2', 'release/portals/ai-workspace/1.0.0', 'release/Gateway/1.2.0', 'release/gateway/1.2.0.1'])
    assert.throws(() => parseReleaseBranch(b), ConfigError, b);
});

test('the first push of a version publishes it; later pushes add the next fix segment', () => {
  assert.equal(nextTag('gateway/v', '1.2.0', []), 'gateway/v1.2.0');
  assert.equal(nextTag('gateway/v', '1.2.0', ['gateway/v1.2.0', 'gateway/v1.1.0.4', 'ai-gateway/v1.2.0.7']), 'gateway/v1.2.0.1');
  assert.equal(nextTag('v', '7.2.0', ['v7.2.0', 'v7.2.0.1', 'v7.2.0.3']), 'v7.2.0.4');
});

test('release/latest publishes a date tag, then .1, .2 on the same day', () => {
  const day = new Date('2026-10-27T23:30:00Z');
  assert.equal(nextTag('cloud/v', 'latest', [], day), 'cloud/v2026.10.27');
  assert.equal(nextTag('cloud/v', 'latest', ['cloud/v2026.10.27', 'cloud/v2026.10.26.3'], day), 'cloud/v2026.10.27.1');
});

test('the branch component picks exactly one manifest by its release tag prefix', () => {
  const root = repo();
  assert.equal(findManifest(root, 'gateway'), 'docusaurus/api-gateway/wso2-docs.yaml');
  assert.equal(findManifest(root, 'ai-gateway'), 'docusaurus/ai-gateway/wso2-docs.yaml');
  assert.throws(() => findManifest(root, 'portal'), /no wso2-docs\.yaml releases with prefix portal\/v/);
  const twice = repo({ 'other/wso2-docs.yaml': manifest() });
  assert.throws(() => findManifest(twice, 'gateway'), /2 wso2-docs\.yaml files release with prefix gateway\/v/);
});

test('a bundle holds the version\'s pages and the files they reference, and nothing else', () => {
  const root = repo();
  const file = 'docusaurus/api-gateway/wso2-docs.yaml';
  const b = collectBundle(root, file, loadConfig(path.join(root, file), root));
  assert.deepEqual(b.problems, []);
  assert.deepEqual(b.files, [
    'docusaurus/api-gateway/assets/img/arch.png',
    'docusaurus/api-gateway/docs/_chart.mdx',
    'docusaurus/api-gateway/docs/overview.mdx',
  ]);
});

test('references leaving the section and its include folders, symlinks and code files stop the bundle', () => {
  const root = repo({
    'docusaurus/api-gateway/docs/leak.mdx': '![x](../../ai-gateway/docs/overview.mdx)\n![y](../../../../etc/passwd)\n',
    'docusaurus/api-gateway/docs/plugin.js': 'module.exports = {}\n',
  });
  fs.symlinkSync('/etc/hosts', path.join(root, 'docusaurus/api-gateway/docs/hosts.md'));
  const file = 'docusaurus/api-gateway/wso2-docs.yaml';
  const kinds = collectBundle(root, file, loadConfig(path.join(root, file), root)).problems.map((p) => `${p.kind} ${p.file}`).sort();
  assert.deepEqual(kinds, [
    'executable docusaurus/api-gateway/docs/plugin.js',
    'outside docusaurus/api-gateway/docs/leak.mdx',
    'outside docusaurus/api-gateway/docs/leak.mdx',
    'symlink docusaurus/api-gateway/docs/hosts.md',
  ]);
});

test('include folders let pages reference shared files outside the section', () => {
  const root = repo({
    'docusaurus/api-gateway/wso2-docs.yaml': manifest().replace('  release_tag: gateway/v', '  release_tag: gateway/v\n  include: [shared/snippets]'),
    'docusaurus/api-gateway/docs/overview.mdx': '![x](../../../shared/snippets/a.png)\n',
    'shared/snippets/a.png': 'PNG',
  });
  const file = 'docusaurus/api-gateway/wso2-docs.yaml';
  const b = collectBundle(root, file, loadConfig(path.join(root, file), root));
  assert.deepEqual(b.problems, []);
  assert.ok(b.files.includes('shared/snippets/a.png'));
});

test('an executable sidebar is refused; the navigation must come from the manifest', () => {
  const root = repo({ 'docusaurus/api-gateway/wso2-docs.yaml': manifest().replace(/nav:\n.*\n/, 'sidebar: docusaurus/api-gateway/sidebars.ts\n') });
  const file = 'docusaurus/api-gateway/wso2-docs.yaml';
  const kinds = collectBundle(root, file, loadConfig(path.join(root, file), root)).problems.map((p) => p.kind);
  assert.ok(kinds.includes('navigation'), kinds.join());
});

test('only the version\'s own redirects go into the bundle, at the same path', () => {
  const root = repo({
    'docusaurus/api-gateway/wso2-docs.yaml': manifest('redirects: { file: docusaurus/api-gateway/redirects.json, version: current }\n'),
    'docusaurus/api-gateway/redirects.json': JSON.stringify({ current: { 'old.md': 'overview.md' }, '1.1.0': { 'older.md': 'x.md' } }),
  });
  const file = 'docusaurus/api-gateway/wso2-docs.yaml';
  const b = collectBundle(root, file, loadConfig(path.join(root, file), root));
  assert.deepEqual(b.problems, []);
  assert.deepEqual(JSON.parse(b.generated['docusaurus/api-gateway/redirects.json']!.toString()), { current: { 'old.md': 'overview.md' } });
});

test('bundles over the size or file-count limit are refused', () => {
  assert.equal(LIMITS.bytes, 200 * 1024 * 1024);
  assert.equal(LIMITS.files, 20_000);
  const root = repo();
  const file = 'docusaurus/api-gateway/wso2-docs.yaml';
  const b = collectBundle(root, file, loadConfig(path.join(root, file), root), { bytes: 10, files: 2 });
  assert.deepEqual(b.problems.map((p) => p.kind).sort(), ['limit', 'limit']);
});
