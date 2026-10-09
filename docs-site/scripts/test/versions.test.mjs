import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sectionVersions, versionId, validateVersions, replaceExclude, pagePaths, confluenceVersions } from '../versions.mjs';

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
