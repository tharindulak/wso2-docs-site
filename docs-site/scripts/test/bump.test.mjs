// docs-site/scripts/test/bump.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBumps, planDocsReleases, applyDocsRelease } from '../bump-lib.mjs';

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
