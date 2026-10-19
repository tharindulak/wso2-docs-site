import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sinceText, deprecationNotice, needsDeprecatedTag, deprecationRows, deprecationTabs, scopeText } from '../src/lib/deprecation.mjs';

const LINE = 'Still works, but not recommended; it will be removed in a future release.';
const docs = {
  'apis/role-management/roles-v2-rest-api': { url: '/identity/apis/role-management/roles-v2-rest-api/', title: 'SCIM 2.0 Roles V2 API' },
  'apis/organization-user-share-v2-rest-api': { url: '/identity/apis/organization-user-share-v2-rest-api/', title: 'User sharing Management API V2' },
  'references/wso2-identity-server-feature-deprecation': { url: '/identity/references/wso2-identity-server-feature-deprecation/', title: 'Feature deprecation' },
};
const resolveDoc = (id) => docs[id] ?? null;

test('since reads once when the options agree, else per option, naming the self-hosted product', () => {
  assert.equal(sinceText([{ option: 'Self-hosted', since: '7.0.0' }], 'identity'), 'since 7.0.0');
  assert.equal(sinceText([{ option: 'WSO2 Cloud', since: '2026-03' }, { option: 'Self-hosted', since: '2026-03' }], 'identity'), 'since 2026-03');
  assert.equal(sinceText([{ option: 'WSO2 Cloud', since: '2026-03' }, { option: 'Self-hosted', since: '7.3.0' }], 'identity'),
    'on WSO2 Cloud since 2026-03; in Identity Server since 7.3.0');
  assert.equal(sinceText([{ option: 'WSO2 Cloud', since: '2026-03' }, { option: 'Self-hosted', since: '7.3.0' }], 'other'),
    'on WSO2 Cloud since 2026-03; Self-hosted since 7.3.0', 'a product without a self-hosted name keeps the option name');
  assert.equal(sinceText([{ option: 'Self-hosted' }], 'identity'), '');
});

test('a deprecated page\'s notice: since, the one-line explanation, one button per distinct replacement, the policy link', () => {
  const notice = deprecationNotice({ deployment_options: ['WSO2 Cloud', 'Self-hosted'], lifecycle: {
    'WSO2 Cloud': { status: 'deprecated', deprecated_since: '2026-03', replacement: 'organization-user-share-v2-rest-api.md' },
    'Self-hosted': { status: 'deprecated', deprecated_since: '7.3.0', replacement: 'organization-user-share-v2-rest-api.md' },
  } }, { docId: 'apis/organization-user-share-rest-api', resolveDoc, sectionId: 'identity' });
  assert.deepEqual(notice, {
    since: 'on WSO2 Cloud since 2026-03; in Identity Server since 7.3.0', line: LINE,
    replacements: [{ url: '/identity/apis/organization-user-share-v2-rest-api/', title: 'User sharing Management API V2' }],
    policy: '/identity/references/wso2-identity-server-feature-deprecation/', removal: null,
  });
});

test('no removal line unless removal is set; a replacement naming no page is dropped; no policy link where the version has no such page', () => {
  const resolveNone = (id) => (id.startsWith('references/') ? null : resolveDoc(id));
  const notice = deprecationNotice({ deployment_options: ['Self-hosted'], status: 'deprecated', deprecated_since: '7.0.0', replacement: 'gone.md' },
    { docId: 'apis/role-management/roles-v1-rest-api', resolveDoc: resolveNone, sectionId: 'identity' });
  assert.deepEqual(notice, { since: 'since 7.0.0', line: LINE, replacements: [], policy: null, removal: null });
  const removal = deprecationNotice({ deployment_options: ['Self-hosted'], status: 'deprecated', deprecated_since: '7.0.0', removal: '7.5.0', replacement: 'https://example.com/v2' },
    { docId: 'apis/x', resolveDoc, sectionId: 'identity' });
  assert.equal(removal.removal, 'Removal planned: 7.5.0');
  assert.deepEqual(removal.replacements, [{ url: 'https://example.com/v2', title: 'https://example.com/v2' }]);
});

test('a page that is not deprecated, or only in Beta, has no notice', () => {
  assert.equal(deprecationNotice({ deployment_options: ['Self-hosted'] }, { docId: 'a', resolveDoc, sectionId: 'identity' }), null);
  assert.equal(deprecationNotice({ status: 'beta' }, { docId: 'a', resolveDoc, sectionId: 'identity' }), null);
});

test('a section notice shows the Deprecated tag only when its title does not already say so', () => {
  assert.equal(needsDeprecatedTag('Deprecated feature'), false);
  assert.equal(needsDeprecatedTag('This behavior is DEPRECATED'), false);
  assert.equal(needsDeprecatedTag('Deprecation of the old flow'), false);
  assert.equal(needsDeprecatedTag('Use the new token format'), true);
  assert.equal(needsDeprecatedTag(''), true);
});

test('Deprecations page rows: name, kind, deployment options, since, replacements, removal "Not announced" when unset', () => {
  const rows = deprecationRows({ entries: [
    { kind: 'page', title: 'User sharing Management API', url: '/identity/apis/organization-user-share-rest-api/',
      options: [{ option: 'WSO2 Cloud', since: '2026-03' }, { option: 'Self-hosted', since: '7.3.0' }],
      replacements: [{ url: '/identity/apis/organization-user-share-v2-rest-api/', title: 'User sharing Management API V2' }] },
    { kind: 'section', title: 'Deprecated feature', url: '/identity/guides/branding/', page: 'Configure UI branding', options: [{ option: 'Self-hosted' }], replacements: [] },
    { kind: 'listed', title: 'Legacy scripts', url: null, options: [{ option: 'Self-hosted', since: '7.1.0', removal: '7.5.0' }], replacements: [] },
  ] }, 'identity');
  assert.deepEqual(rows, [
    { kind: 'page', name: 'User sharing Management API', url: '/identity/apis/organization-user-share-rest-api/', page: null, scope: 'WSO2 Cloud, Identity Server',
      since: 'on WSO2 Cloud since 2026-03; in Identity Server since 7.3.0', replacements: [{ url: '/identity/apis/organization-user-share-v2-rest-api/', title: 'User sharing Management API V2' }], removal: 'Not announced' },
    { kind: 'section', name: 'Deprecated feature', url: '/identity/guides/branding/', page: 'Configure UI branding', scope: 'Identity Server', since: '', replacements: [], removal: 'Not announced' },
    { kind: 'listed', name: 'Legacy scripts', url: null, page: null, scope: 'Identity Server', since: '7.1.0', replacements: [], removal: '7.5.0' },
  ]);
});

test('version tabs: the versions whose pages include a Deprecations page, the current one marked', () => {
  const doc = { versions: [
    { version: '7.3.0', label: '7.3.0 (Latest)', status: 'latest', path: '/identity/' },
    { version: '7.2.0', label: '7.2.0', status: 'snapshot', path: '/identity/7.2.0/' },
    { version: '6.1.0', label: '6.1.0', status: 'snapshot', path: '/identity/6.1.0/' },
    { version: '5.8.0', label: '5.8.0', status: 'confluence', href: 'https://example.com' },
  ] };
  const pages = { '/identity/': { pages: ['', 'deprecations/'] }, '/identity/7.2.0/': ['deprecations/'], '/identity/6.1.0/': { pages: ['x/'] } };
  assert.deepEqual(deprecationTabs(doc, pages, '/identity/7.2.0/deprecations/'), [
    { label: 'Latest', href: '/identity/deprecations/', current: false },
    { label: '7.2.0', href: '/identity/7.2.0/deprecations/', current: true },
  ]);
});

test('a section notice\'s scope line names the options it applies to, the self-hosted one by product name', () => {
  assert.equal(scopeText(['Self-hosted'], 'identity'), 'Applies to Identity Server.');
  assert.equal(scopeText(['WSO2 Cloud', 'Self-hosted'], 'identity'), 'Applies to WSO2 Cloud and Identity Server.');
  assert.equal(scopeText(null, 'identity'), null);
  assert.equal(scopeText([], 'identity'), null);
});

test('a replacement titled as the deprecated page gets the version from its file name', () => {
  const notice = deprecationNotice({ deployment_options: ['Self-hosted'], status: 'deprecated', deprecated_since: '7.0.0', replacement: 'user-account-recovery-v2-rest-api.md' },
    { docId: 'apis/user-account-recovery-v1-rest-api', title: 'User Account Recovery API', sectionId: 'identity',
      resolveDoc: (id) => (id === 'apis/user-account-recovery-v2-rest-api' ? { url: '/identity/apis/user-account-recovery-v2-rest-api/', title: 'User Account Recovery API' } : null) });
  assert.deepEqual(notice.replacements, [{ url: '/identity/apis/user-account-recovery-v2-rest-api/', title: 'User Account Recovery API V2' }]);
});

test('a deprecation on only some of the page\'s options names them in since', () => {
  const notice = deprecationNotice({ deployment_options: ['WSO2 Cloud', 'Self-hosted'], lifecycle: { 'WSO2 Cloud': { status: 'deprecated', deprecated_since: '2026-06' } } },
    { docId: 'apis/x', resolveDoc, sectionId: 'identity' });
  assert.equal(notice.since, 'on WSO2 Cloud since 2026-06');
  assert.equal(sinceText([{ option: 'Self-hosted', since: '7.2.0' }], 'identity', { scoped: true }), 'in Identity Server since 7.2.0');
});
