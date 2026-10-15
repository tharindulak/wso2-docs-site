// The Deprecations index of one docs version: pages marked deprecated (either front-matter shape), deprecated sections,
// and the hand-kept deprecations.yml entries; the page that renders it and its sidebar entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deprecatedSections, deprecationIndex, readDeprecationsList, deprecationsPage, withDeprecationsEntry } from '../src/deprecations.js';

const page = (id: string, front: string, body = 'Text.\n') => ({ id, url: `/identity/${id}/`, text: `---\n${front}\n---\n\n${body}` });

const roles = page('apis/role-management/roles-v1-rest-api', 'title: SCIM 2.0 Roles V1 API\ndeployment_options:\n  - Self-hosted\nstatus: deprecated\ndeprecated_since: "7.0.0"\nreplacement: roles-v2-rest-api.md');
const rolesV2 = page('apis/role-management/roles-v2-rest-api', 'title: SCIM 2.0 Roles V2 API\ndeployment_options:\n  - Self-hosted');
const sharing = page('apis/organization-user-share-rest-api', [
  'title: User sharing Management API', 'deployment_options:\n  - WSO2 Cloud\n  - Self-hosted',
  'lifecycle:\n  WSO2 Cloud:\n    status: deprecated\n    deprecated_since: "2026-03"\n    replacement: organization-user-share-v2-rest-api.md',
  '  Self-hosted:\n    status: deprecated\n    deprecated_since: "7.3.0"\n    replacement: organization-user-share-v2-rest-api.md',
].join('\n'));
const sharingV2 = page('apis/organization-user-share-v2-rest-api', 'title: User sharing Management API V2');

test('deprecated sections: the deprecated type and warnings titled "Deprecated …", with the Applies block around them', () => {
  const body = [
    'Intro.', '', ':::deprecated[Deprecated behavior]', '', 'Old.', '', ':::', '',
    '<Applies to="Self-hosted">', '', ':::warning[Deprecated feature]', '', 'Old.', '', ':::', '', '</Applies>', '',
    ':::warning[Deprecated `sub` attribute behavior]', 'x', ':::', '',
    ':::deprecated', 'No title.', ':::', '',
    ':::warning[Before you start]', 'Read.', ':::', '',
    '```md', ':::deprecated[In a code block]', '```', '',
    '    :::warning[Deprecated inside a list]', '    x', '    :::',
  ].join('\n');
  assert.deepEqual(deprecatedSections(body), [
    { title: 'Deprecated behavior' },
    { title: 'Deprecated feature', option: 'Self-hosted' },
    { title: 'Deprecated `sub` attribute behavior' },
    { title: 'Deprecated' },
    { title: 'Deprecated inside a list' },
  ]);
});

test('a deprecated page is listed with its options, since dates and the replacement page\'s URL and title', () => {
  const { entries, problems } = deprecationIndex({ pages: [roles, rolesV2, sharing, sharingV2] });
  assert.deepEqual(problems, []);
  assert.deepEqual(entries, [
    { kind: 'page', title: 'SCIM 2.0 Roles V1 API', url: '/identity/apis/role-management/roles-v1-rest-api/',
      options: [{ option: 'Self-hosted', since: '7.0.0' }],
      replacements: [{ url: '/identity/apis/role-management/roles-v2-rest-api/', title: 'SCIM 2.0 Roles V2 API' }] },
    { kind: 'page', title: 'User sharing Management API', url: '/identity/apis/organization-user-share-rest-api/',
      options: [{ option: 'WSO2 Cloud', since: '2026-03' }, { option: 'Self-hosted', since: '7.3.0' }],
      replacements: [{ url: '/identity/apis/organization-user-share-v2-rest-api/', title: 'User sharing Management API V2' }] },
  ]);
});

test('sections are listed with their page; their options come from the Applies block, else the page', () => {
  const guide = page('guides/branding', 'title: Configure UI branding\ndeployment_options:\n  - WSO2 Cloud\n  - Self-hosted',
    'A.\n\n<Applies to="Self-hosted">\n\n:::warning[Deprecated feature]\n\nOld.\n\n:::\n\n</Applies>\n\n:::deprecated[Deprecated behavior]\n\nOld.\n\n:::\n');
  const { entries } = deprecationIndex({ pages: [guide] });
  assert.deepEqual(entries, [
    { kind: 'section', title: 'Deprecated feature', url: '/identity/guides/branding/', page: 'Configure UI branding', options: [{ option: 'Self-hosted' }], replacements: [] },
    { kind: 'section', title: 'Deprecated behavior', url: '/identity/guides/branding/', page: 'Configure UI branding', options: [{ option: 'WSO2 Cloud' }, { option: 'Self-hosted' }], replacements: [] },
  ]);
});

test('a replacement naming no page is dropped and reported; a URL or site path stays as written', () => {
  const missing = page('apis/old', 'title: Old API\ndeployment_options:\n  - Self-hosted\nstatus: deprecated\ndeprecated_since: "7.1.0"\nreplacement: gone.md');
  const external = page('apis/ext', 'title: Ext API\nstatus: deprecated\ndeprecated_since: "7.1.0"\nreplacement: https://example.com/new');
  const sitePath = page('apis/site', 'title: Site API\nstatus: deprecated\ndeprecated_since: "7.1.0"\nreplacement: /identity/apis/role-management/roles-v2-rest-api/');
  const { entries, problems } = deprecationIndex({ pages: [missing, external, sitePath, rolesV2] });
  assert.deepEqual(entries.map((e) => e.replacements), [
    [],
    [{ url: 'https://example.com/new', title: 'https://example.com/new' }],
    [{ url: '/identity/apis/role-management/roles-v2-rest-api/', title: 'SCIM 2.0 Roles V2 API' }],
  ]);
  assert.deepEqual(problems, ['apis/old: replacement names no page: gone.md']);
});

test('pages with the same title are told apart by the first sidebar category where their places differ', () => {
  const fm = 'title: Notification Senders API\ndeployment_options:\n  - Self-hosted\nstatus: deprecated\ndeprecated_since: "7.1.0"';
  const a = page('apis/notification-sender-rest-api', fm);
  const b = page('apis/organization-apis/notification-sender-rest-api', fm);
  const sidebar = [{ type: 'category', label: 'APIs', items: [
    { type: 'category', label: 'Management APIs', items: [{ type: 'category', label: 'Notification sender', items: [{ type: 'doc', id: a.id }] }] },
    { type: 'category', label: 'Organization APIs', items: [{ type: 'doc', id: b.id }] },
  ] }];
  const { entries } = deprecationIndex({ pages: [a, b], sidebar });
  assert.deepEqual(entries.map((e) => e.title), ['Notification Senders API (Management APIs)', 'Notification Senders API (Organization APIs)']);
});

test('deprecations.yml entries join the index, with replacement and link resolved like front matter', () => {
  const { listed, problems } = readDeprecationsList([
    '- title: Legacy adaptive scripts', '  deprecated_since: "7.1.0"', '  replacement: apis/role-management/roles-v2-rest-api.md', '  link: https://example.com/notes',
    '- title: No date', '- deprecated_since: "7.0.0"', '- title: Bad link', '  deprecated_since: "7.0.0"', '  link: "javascript:alert(1)"',
  ].join('\n'), ['Self-hosted']);
  assert.deepEqual(problems, ['deprecations.yml entry 2 (No date): needs deprecated_since (quoted: "7.3.0" or "2026-09")', 'deprecations.yml entry 3: needs a title', 'deprecations.yml entry 4 (Bad link): link is not a safe URL: javascript:alert(1)']);
  const { entries } = deprecationIndex({ pages: [rolesV2], listed });
  assert.deepEqual(entries, [
    { kind: 'listed', title: 'Legacy adaptive scripts', url: 'https://example.com/notes', options: [{ option: 'Self-hosted', since: '7.1.0' }],
      replacements: [{ url: '/identity/apis/role-management/roles-v2-rest-api/', title: 'SCIM 2.0 Roles V2 API' }] },
    { kind: 'listed', title: 'Bad link', url: null, options: [{ option: 'Self-hosted', since: '7.0.0' }], replacements: [] },
  ]);
  assert.deepEqual(readDeprecationsList('title: not a list', []).problems, ['deprecations.yml must be a list of entries']);
  assert.match(readDeprecationsList('- [', []).problems[0]!, /^deprecations\.yml is not valid YAML/);
});

test('the Deprecations page renders the version\'s index file with the Deprecations component', () => {
  const mdx = deprecationsPage('../../deprecations/identity.json');
  assert.match(mdx, /^---\ntitle: Deprecations\n/);
  assert.match(mdx, /\nimport index from '\.\.\/\.\.\/deprecations\/identity\.json';\n/);
  assert.match(mdx, /\n<Deprecations index=\{index\} \/>\n$/);
});

test('the sidebar lists the Deprecations page after the Feature deprecation reference, else last; once', () => {
  const sidebar = [{ type: 'category', label: 'References', items: [
    { type: 'doc', id: 'references/wso2-identity-server-feature-deprecation', label: 'Feature deprecation' }, { type: 'doc', id: 'references/other' },
  ] }];
  const placed = withDeprecationsEntry(sidebar);
  assert.deepEqual((placed[0] as { items: unknown[] }).items[1], { type: 'doc', id: 'deprecations', label: 'Deprecations' });
  assert.deepEqual(withDeprecationsEntry(placed), placed, 'already listed');
  assert.deepEqual(withDeprecationsEntry([{ type: 'doc', id: 'intro' }]), [{ type: 'doc', id: 'intro' }, { type: 'doc', id: 'deprecations', label: 'Deprecations' }]);
});

test('a deprecated section holding an admonition (a longer fence) is still a deprecation notice', () => {
  assert.deepEqual(deprecatedSections('::::deprecated[Old API]\n\nGone.\n\n:::note\n\nx\n\n:::\n\n::::\n'), [{ title: 'Old API' }]);
});
