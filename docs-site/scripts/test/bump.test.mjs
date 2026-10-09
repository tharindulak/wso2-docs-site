// docs-site/scripts/test/bump.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBumps, applyBumps, planDocsReleases, applyDocsRelease } from '../bump-lib.mjs';

const S = (c) => c.repeat(40);
const lock = () => ({ live_window: 2, products: [{ id: 'integration', sections: [{
  id: 'integration-mi', route: 'integration/micro-integrator', kind: 'mkdocs', repo: 'wso2/docs-mi', mkdocs: 'en/mkdocs.yml',
  release_tag: 'v', product_repo: 'wso2/micro-integrator', former_site: 'https://mi.docs.wso2.com/en/{version}/',
  versions: [
    { version: '4.6.0', ref: '4.6.0', sha: S('a'), track: true },
    { version: '4.5.0', ref: '4.5.0', sha: S('b') },
    { version: '4.4.0', ref: 'v4.4.0', sha: S('c') },
  ],
}] }] });
const text = [
  '      - id: integration-mi',
  '        versions:',
  '          - version: 4.6.0',
  '            ref: 4.6.0',
  `            sha: ${S('a')}`,
  '            track: true',
  '            exclude: []',
  '          - version: 4.5.0',
  '            ref: 4.5.0',
  `            sha: ${S('b')}`,
  '            exclude: []',
  '          - version: 4.4.0',
  '            ref: v4.4.0',
  `            sha: ${S('c')}`,
  '            exclude: []',
  '',
].join('\n');

test('only Latest is bumped to its branch head', () => {
  const heads = { 'wso2/docs-mi#4.6.0': S('d') };
  const bumps = planBumps(lock(), (repo, branch) => { const h = heads[`${repo}#${branch}`]; if (!h) throw new Error(`asked for ${repo}#${branch}`); return h; });
  assert.deepEqual(bumps.map((b) => [b.repo, b.track, b.from, b.to]), [['wso2/docs-mi', '4.6.0', S('a'), S('d')]]);
});

const deps = (docsTags, productTags) => ({
  releasesOf: async () => docsTags.map((t) => ({ tag_name: t, draft: false, prerelease: false })),
  productReleasesOf: async () => productTags.map((t) => ({ tag_name: t, draft: false, prerelease: false })),
  tagSha: async (_repo, tag) => ({ 'v4.4.0.1': S('e'), 'v4.7.0': S('f'), 'v4.8.0': S('9') })[tag],
});

test('a fourth-segment docs release is a fix for that version', async () => {
  const props = await planDocsReleases(lock(), deps(['v4.4.0.1', 'v4.4.0'], ['v4.6.0']));
  assert.deepEqual(props, [{ type: 'fix', section: 'integration-mi', version: '4.4.0', base: '4.4.0', tag: 'v4.4.0.1', sha: S('e') }]);
  const out = applyDocsRelease(text, props[0]);
  assert.match(out, /- version: 4\.4\.0\n {12}ref: v4\.4\.0\.1\n {12}sha: e{40}\n/);
});

test('a newer docs release becomes Latest only when the product released it; Latest stops tracking', async () => {
  const props = await planDocsReleases(lock(), deps(['v4.7.0', 'v4.8.0', 'v4.7.0-rc1'], ['v4.7.0']));
  assert.deepEqual(props.map((p) => [p.type, p.version]), [['new', '4.7.0'], ['missing-product-release', '4.8.0']]);
  const out = applyDocsRelease(text, props[0]);
  assert.match(out, /versions:\n {10}- version: 4\.7\.0\n {12}ref: v4\.7\.0\n {12}sha: f{40}\n {12}exclude: \[\]\n {10}- version: 4\.6\.0\n {12}ref: 4\.6\.0\n {12}sha: a{40}\n {12}exclude: \[\]/);
  assert.doesNotMatch(out, /track: true/);
});

test('prereleases and drafts are ignored; tags of other components are ignored', async () => {
  const d = deps([], ['v4.7.0']);
  d.releasesOf = async () => [{ tag_name: 'v4.7.0', draft: true, prerelease: false }, { tag_name: 'v4.9.0', draft: false, prerelease: true }, { tag_name: 'api-gateway/v9.0.0', draft: false, prerelease: false }];
  assert.deepEqual(await planDocsReleases(lock(), d), []);
});

test('a fix release un-tracks the version it pins', () => {
  const t2 = text.replace(`            ref: 4.5.0\n            sha: ${S('b')}\n`, `            ref: 4.5.0\n            sha: ${S('b')}\n            track: 4.5.0\n`);
  assert.match(t2, /track: 4\.5\.0/);
  const out = applyDocsRelease(t2, { type: 'fix', section: 'integration-mi', version: '4.5.0', base: '4.5.0', tag: 'v4.5.0.1', sha: S('e') });
  assert.doesNotMatch(out, /track: 4\.5\.0/);
  assert.match(out, /ref: v4\.5\.0\.1\n {12}sha: e{40}\n {12}exclude/);
});

test('a bump moves only the tracking entries, not older versions pinned to the same commit', () => {
  const X = S('1');
  const isText = [
    '      - id: identity',
    '        cloud:',
    '          repo: wso2/docs-is',
    `          sha: ${X}`,
    '          track: master',
    '        self_hosted:',
    '          repo: wso2/docs-is',
    '          versions:',
    '            - version: 7.3.0',
    '              ref: master',
    `              sha: ${X}`,
    '              track: true',
    '              exclude:',
    '                - a.md',
    '            - version: 7.2.0',
    '              ref: master',
    `              sha: ${X}`,
    '              exclude: []',
    '            - version: 7.1.0',
    `              sha: ${X}`,
    '              ref: master',
    '      - id: other',
    '        repo: wso2/docs-is',
    `        sha: ${X}`,
    '        track: release-1',
    '',
  ].join('\n');
  const out = applyBumps(isText, [{ repo: 'wso2/docs-is', track: 'master', from: X, to: S('2') }]);
  assert.equal(out.split(S('2')).length - 1, 2, 'cloud and Latest');
  assert.match(out, /cloud:\n {10}repo: wso2\/docs-is\n {10}sha: 2{40}\n/);
  assert.match(out, /- version: 7\.3\.0\n {14}ref: master\n {14}sha: 2{40}\n/);
  assert.match(out, /- version: 7\.2\.0\n {14}ref: master\n {14}sha: 1{40}\n/);
  assert.match(out, /- version: 7\.1\.0\n {14}sha: 1{40}\n/);
  assert.match(out, /- id: other\n {8}repo: wso2\/docs-is\n {8}sha: 1{40}\n {8}track: release-1/, 'another branch at the same commit');
});

const isLock = () => ({ products: [{ id: 'identity', sections: [{
  id: 'identity', route: 'identity', kind: 'mkdocs-merge',
  cloud: { repo: 'wso2/docs-is', sha: S('1'), track: 'master', mkdocs: 'en/asgardeo/mkdocs.yml' },
  self_hosted: { repo: 'wso2/docs-is', product_repo: 'wso2/product-is', version_folder: 'en/identity-server/{version}/mkdocs.yml',
    versions: [{ version: '7.3.0', ref: 'master', sha: S('1'), track: true, mkdocs: 'en/identity-server/7.3.0/mkdocs.yml' }] },
}] }] });
const isDeps = (folders) => ({
  releasesOf: async () => [{ tag_name: 'v7.4.0', draft: false, prerelease: false }, { tag_name: 'v7.3.0.1', draft: false, prerelease: false }],
  productReleasesOf: async () => [{ tag_name: 'v7.4.0', draft: false, prerelease: false }],
  tagSha: async () => S('4'),
  fileAt: async (_repo, _tag, file) => folders.includes(file),
});

test('an Identity promotion writes the version folder; a missing folder blocks the promotion; tracking Latest takes no fix tags', async () => {
  const props = await planDocsReleases(isLock(), isDeps(['en/identity-server/7.4.0/mkdocs.yml']));
  assert.deepEqual(props, [{ type: 'new', section: 'identity', version: '7.4.0', base: '7.4.0', tag: 'v7.4.0', sha: S('4'), mkdocs: 'en/identity-server/7.4.0/mkdocs.yml' }]);
  const lockText = [
    '      - id: identity',
    '        self_hosted:',
    '          versions:',
    '            - version: 7.3.0',
    '              ref: master',
    `              sha: ${S('1')}`,
    '              mkdocs: en/identity-server/7.3.0/mkdocs.yml',
    '              track: true',
    '',
  ].join('\n');
  assert.match(applyDocsRelease(lockText, props[0]), /- version: 7\.4\.0\n {14}ref: v7\.4\.0\n {14}sha: 4{40}\n {14}mkdocs: en\/identity-server\/7\.4\.0\/mkdocs\.yml\n {14}exclude: \[\]\n {12}- version: 7\.3\.0/);
  const missing = await planDocsReleases(isLock(), isDeps([]));
  assert.deepEqual(missing.map((p) => [p.type, p.version]), [['missing-version-folder', '7.4.0']]);
  assert.deepEqual(await planDocsReleases(isLock(), isDeps([]), ['fix']), [], 'fix-only planning makes no promotion calls');
});

test('a merged section version without mkdocs or version_folder is rejected', async () => {
  const { validateVersions, sectionVersions } = await import('../versions.mjs');
  const l = isLock().products[0].sections[0];
  l.self_hosted.versions.push({ version: '7.2.0', ref: 'master', sha: S('1') });
  assert.equal(sectionVersions(l, 1)[1].mkdocs, 'en/identity-server/7.2.0/mkdocs.yml', 'derived from version_folder');
  delete l.self_hosted.version_folder;
  assert.throws(() => validateVersions(l, 1), /7\.2\.0: mkdocs is required/);
});
