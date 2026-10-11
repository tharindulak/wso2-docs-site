import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sectionVersions, versionId, validateVersions, replaceExclude, pagePaths, confluenceVersions, confluenceEntries, outsideLinks, formerRouteRedirects } from '../versions.mjs';

const SHA = (c) => c.repeat(40);
const mi = () => ({
  id: 'integration-mi', label: 'Micro Integrator', route: 'integration/micro-integrator', kind: 'mkdocs',
  repo: 'wso2/docs-mi', mkdocs: 'en/mkdocs.yml', sparse: ['en'], deployment_options: ['Self-hosted'],
  current_site: 'https://mi.docs.wso2.com/en/latest/', former_site: 'https://mi.docs.wso2.com/en/{version}/',
  release_tag: 'v',
  versions: [
    { version: '4.6.0', ref: '4.6.0', sha: SHA('a'), track: true, exclude: ['x.md'] },
    { version: '4.5.0', ref: '4.5.0', sha: SHA('b') },
    { version: '4.4.0', ref: 'v4.4.0.2', sha: SHA('c') },
  ],
  older_versions: [{ version: '1.2.0', href: 'https://wso2docs.atlassian.net/wiki/spaces/EI611' }],
});

test('a legacy section is one Latest version that looks like the section', () => {
  const legacy = { id: 'updates', route: 'updates', kind: 'mkdocs', repo: 'wso2/docs-updates', sha: SHA('d'), track: 'master', mkdocs: 'en/mkdocs.yml' };
  const [v] = sectionVersions(legacy);
  assert.equal(v.id, 'updates');
  assert.equal(v.status, 'latest');
  assert.equal(v.source, 'legacy');
  assert.equal(v.sha, SHA('d'));
  assert.equal(v.track, 'master');
  assert.equal(v.route, 'updates');
  assert.equal(v.versionLabel, 'Latest');
  assert.equal(v.label, legacy.label, 'section label untouched');
});

test('versions get ids, routes, statuses, labels and source kinds', () => {
  const vs = sectionVersions(mi(), 2);
  assert.deepEqual(vs.map((v) => [v.id, v.route, v.status, v.versionLabel, v.source]), [
    ['integration-mi', 'integration/micro-integrator', 'latest', '4.6.0 (Latest)', 'branch'],
    ['integration-mi--v4-5-0', 'integration/micro-integrator/4.5.0', 'live', '4.5.0', 'branch'],
    ['integration-mi--v4-4-0', 'integration/micro-integrator/4.4.0', 'snapshot', '4.4.0', 'release'],
  ]);
  assert.equal(vs[0].track, '4.6.0', 'Latest follows its branch');
  assert.equal(vs[1].track, null, 'older versions are pinned');
  assert.deepEqual(vs[0].exclude, ['x.md']);
  assert.deepEqual(vs[1].deployment_options, ['Self-hosted']);
  assert.equal(vs[1].current_site, 'https://mi.docs.wso2.com/en/4.5.0/', 'fallback target is the version on its former site');
  assert.equal(vs[0].former_site, 'https://mi.docs.wso2.com/en/{version}/');
});

test('older versions of a merged section are plain MkDocs, Self-hosted only, without the cloud side', () => {
  const identity = {
    id: 'identity', route: 'identity', kind: 'mkdocs-merge', sparse: ['en'], former_site: 'https://is.docs.wso2.com/en/{version}/',
    cloud: { repo: 'wso2/docs-is', sha: SHA('e'), track: 'master', mkdocs: 'en/asgardeo/mkdocs.yml' },
    self_hosted: {
      repo: 'wso2/docs-is', product_repo: 'wso2/product-is', current_site: 'https://is.docs.wso2.com/en/7.3.0/',
      versions: [
        { version: '7.3.0', ref: 'master', sha: SHA('e'), track: true, mkdocs: 'en/identity-server/7.3.0/mkdocs.yml' },
        { version: '7.2.0', ref: 'master', sha: SHA('e'), mkdocs: 'en/identity-server/7.2.0/mkdocs.yml' },
      ],
    },
  };
  const [latest, prev] = sectionVersions(identity);
  assert.equal(latest.kind, 'mkdocs-merge');
  assert.equal(latest.self_hosted.version, '7.3.0');
  assert.equal(latest.self_hosted.sha, SHA('e'));
  assert.equal(latest.self_hosted.track, 'master');
  assert.equal(latest.self_hosted.mkdocs, 'en/identity-server/7.3.0/mkdocs.yml');
  assert.equal(prev.kind, 'mkdocs');
  assert.equal(prev.repo, 'wso2/docs-is');
  assert.equal(prev.mkdocs, 'en/identity-server/7.2.0/mkdocs.yml');
  assert.equal(prev.source, 'folder');
  assert.equal(prev.cloud, undefined);
  assert.deepEqual(prev.deployment_options, ['Self-hosted']);
});

test('versionId is a valid Docusaurus plugin id', () => {
  assert.equal(versionId('identity', '7.2.0', false), 'identity--v7-2-0');
  assert.equal(versionId('identity', '7.3.0', true), 'identity');
  assert.match(versionId('a-b', '1.10.0', false), /^[a-zA-Z0-9_-]+$/);
});

test('validation rejects unordered, duplicate, malformed and tracked older versions', () => {
  const bad = (edit, message) => { const s = mi(); edit(s); assert.throws(() => validateVersions(s, 2), message); };
  bad((s) => s.versions.reverse(), /integration-mi: versions must be newest first/);
  bad((s) => { s.versions[1].version = '4.6.0'; }, /integration-mi: versions must be newest first/);
  bad((s) => { s.versions[1].track = true; }, /integration-mi: only Latest \(4\.6\.0\) may track/);
  bad((s) => { s.versions[2].ref = 'v4.5.0.1'; }, /integration-mi: ref v4\.5\.0\.1 is a release of another version than 4\.4\.0/);
  bad((s) => { s.versions[0].sha = 'abc'; }, /integration-mi 4\.6\.0: sha must be a full 40-character commit/);
  bad((s) => { s.versions[0].version = '4.6'; }, /integration-mi: version 4\.6 must be numeric/);
  bad((s) => { s.older_versions[0].href = 'http://x'; }, /integration-mi: older version 1\.2\.0 href must be https/);
  bad((s) => { s.versions[1].mkdocs = '../x.yml'; }, /integration-mi 4\.5\.0: path must be relative and inside the repo/);
  assert.doesNotThrow(() => validateVersions(mi(), 2));
});

test('confluenceVersions lists older_versions', () => {
  assert.deepEqual(confluenceVersions(mi()), [{ version: '1.2.0', href: 'https://wso2docs.atlassian.net/wiki/spaces/EI611' }]);
});

test('older_versions entries may carry a label; it defaults to the version', () => {
  const s = mi();
  s.older_versions.push({ version: '7.1.0', label: 'Enterprise Integrator 7.1.0', href: 'https://ei.docs.wso2.com/en/7.1.0/' });
  assert.deepEqual(confluenceEntries(s).map((e) => [e.version, e.label, e.status]), [['1.2.0', '1.2.0', 'confluence'], ['7.1.0', 'Enterprise Integrator 7.1.0', 'confluence']]);
  assert.doesNotThrow(() => validateVersions(s, 2));
  s.older_versions[1].label = '<b>EI</b>';
  assert.throws(() => validateVersions(s, 2), /older version 7\.1\.0 label must be plain text/);
});

test('replaceExclude rewrites one version entry and leaves the rest', () => {
  const text = [
    '      - id: integration-mi',
    '        versions:',
    '          - version: 4.6.0',
    '            ref: 4.6.0',
    '            exclude:',
    '              - a.md',
    '          - version: 4.5.0',
    '            ref: 4.5.0',
    '            exclude: []',
    '      - id: other',
    '        exclude: []',
    '',
  ].join('\n');
  const out = replaceExclude(text, 'integration-mi', '4.5.0', ['b.md', 'c.md']);
  assert.match(out, /- version: 4\.5\.0\n {12}ref: 4\.5\.0\n {12}exclude:\n {14}- b\.md\n {14}- c\.md\n/);
  assert.match(out, /exclude:\n {14}- a\.md\n/, 'other version untouched');
  assert.match(replaceExclude(out, 'integration-mi', '4.6.0', []), /- version: 4\.6\.0\n {12}ref: 4\.6\.0\n {12}exclude: \[\]\n/);
  assert.match(out, /- id: other\n {8}exclude: \[\]/);
});

test('pagePaths lists real pages as URL paths, honours slugs and skips redirects', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  put('index.md', '# Home\n');
  put('guides/setup.md', '# Setup\n');
  put('guides/index.md', '# Guides\n');
  put('ref/ref.md', '---\nslug: /ref/ref/\n---\n# Ref\n');
  put('gone.md', "---\ntitle: Gone\n---\n\nimport Redirect from '@site/src/components/Redirect';\n");
  assert.deepEqual(pagePaths(dir), ['', 'guides/', 'guides/setup/', 'ref/ref/']);
});

const aiGateway = () => ({
  id: 'api-platform-ai-gateway', label: 'AI Gateway', route: 'api-platform/ai-gateway', kind: 'mkdocs',
  repo: 'wso2/docs-api-platform', mkdocs: 'en/mkdocs.yml', sparse: ['en'], deployment_options: ['Self-hosted'],
  docs_root: 'ai-gateway/{version}/', nav_root: 'AI Gateway', release_tag: 'ai-gateway/v',
  current_site: 'https://wso2.com/bijira/docs/', former_site: 'https://wso2.com/bijira/docs/ai-gateway/{version}/',
  versions: [
    { version: '2026.09.24', ref: 'main', sha: SHA('a'), track: true },
    { version: '1.2.0', ref: 'main', sha: SHA('a') },
    { version: '1.1.0', ref: 'ai-gateway/v1.1.0', sha: SHA('b') },
  ],
});

test('a date-style version (2026.09.24) validates and sorts above 1.2.0', () => {
  assert.doesNotThrow(() => validateVersions(aiGateway(), 1));
  const swapped = aiGateway();
  swapped.versions = [swapped.versions[1], swapped.versions[0], swapped.versions[2]];
  assert.throws(() => validateVersions(swapped, 1), /newest first/);
  const vs = sectionVersions(aiGateway(), 1);
  assert.deepEqual(vs.map((v) => [v.id, v.route, v.status]), [
    ['api-platform-ai-gateway', 'api-platform/ai-gateway', 'latest'],
    ['api-platform-ai-gateway--v1-2-0', 'api-platform/ai-gateway/1.2.0', 'snapshot'],
    ['api-platform-ai-gateway--v1-1-0', 'api-platform/ai-gateway/1.1.0', 'snapshot'],
  ]);
});

test('docs_root: each version reads its own folder, with that folder on the former site as its fallback target', () => {
  const vs = sectionVersions(aiGateway(), 1);
  assert.deepEqual(vs.map((v) => [v.docs_root, v.current_site, v.source]), [
    ['ai-gateway/2026.09.24/', 'https://wso2.com/bijira/docs/ai-gateway/2026.09.24/', 'folder'],
    ['ai-gateway/1.2.0/', 'https://wso2.com/bijira/docs/ai-gateway/1.2.0/', 'folder'],
    ['ai-gateway/1.1.0/', 'https://wso2.com/bijira/docs/ai-gateway/1.1.0/', 'release'],
  ]);
  for (const docs_root of ['ai-gateway/1.0.0/', '../{version}/', 'ai-gateway/{version}', '{version}/{version}/', 'ai-gateway/v{version}/']) {
    assert.throws(() => validateVersions({ ...aiGateway(), docs_root }, 1), /docs_root must be/, docs_root);
  }
});

test('outsideLinks: a shared source maps component folders to version routes and other pages to the section that takes them', () => {
  const src = { repo: 'wso2/docs-api-platform', mkdocs: 'en/mkdocs.yml' };
  const lock = { products: [{ sections: [
    { id: 'api-platform-platform', route: 'api-platform/platform', kind: 'mkdocs', ...src, skip: ['cloud/', 'next/', 'ai-gateway/'] },
    aiGateway(),
    { id: 'api-platform-apim', route: 'api-platform/api-manager', kind: 'mkdocs', repo: 'wso2/docs-apim', mkdocs: 'en/mkdocs.yml', cloud_companion: { ...src, only: 'cloud/' } },
  ] }] };
  const to = outsideLinks(lock, src);
  assert.equal(to('ai-gateway/2026.09.24/routing/a.md'), '/api-platform/ai-gateway/routing/a/', 'Latest has no version segment');
  assert.equal(to('ai-gateway/1.2.0/index.md'), '/api-platform/ai-gateway/1.2.0/');
  assert.equal(to('ai-gateway/0.9.0/overview.md'), '/api-platform/ai-gateway/', 'a version not in the lock: the section root');
  assert.equal(to('ai-gateway/next/overview.md'), null, 'next/ is not published');
  assert.equal(to('policy-hub/overview.md'), '/api-platform/platform/policy-hub/overview/');
  assert.equal(to('guides/x'), '/api-platform/platform/guides/x/');
  assert.equal(to('cloud/ai-workspace/overview.md'), '/api-platform/api-manager/cloud/ai-workspace/overview/', 'cloud pages live in the companion');
  assert.equal(to('next/index.md'), null);
  assert.equal(outsideLinks(lock, { repo: 'wso2/docs-apim', mkdocs: 'en/mkdocs.yml' }), null, 'sources without component folders are unchanged');
});

test('former_route redirects stay inside their folder: hostile page paths (slugs) are skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'former-'));
  const docs = path.join(dir, 'docs');
  fs.mkdirSync(docs);
  fs.writeFileSync(path.join(docs, 'overview.md'), '# Overview\n');
  fs.writeFileSync(path.join(docs, 'evil.md'), '---\nslug: /../../../../../../scripts/x/\n---\n# Evil\n');
  const pages = pagePaths(docs);
  assert.ok(pages.includes('../../../../../../scripts/x/'), 'the slug reaches the page list as written');
  const staticDir = path.join(dir, 'static');
  const { redirects, skipped } = formerRouteRedirects(staticDir, 'api-platform/platform/api-gateway/1.2.0', 'api-platform/api-gateway', [...pages, 'a/./b/', 'a\\b/', '/abs/']);
  assert.deepEqual(redirects.map((r) => [path.relative(staticDir, r.file), r.target]), [
    ['api-platform/platform/api-gateway/1.2.0/index.html', '/api-platform/api-gateway/'],
    ['api-platform/platform/api-gateway/1.2.0/overview/index.html', '/api-platform/api-gateway/overview/'],
  ]);
  assert.deepEqual(skipped, ['../../../../../../scripts/x/', 'a/./b/', 'a\\b/', '/abs/']);
});
