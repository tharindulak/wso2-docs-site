import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkCards } from '../src/lib/link-cards.mjs';

// What a doc page has at hand: the version's doc metadata (useDocsVersion().docs) and its docs in global data.
const docs = {
  'guides/users/index': { id: 'guides/users/index', title: 'Users', description: 'Manage the users of an organization.' },
  'guides/apps/register': { id: 'guides/apps/register', title: 'Register an app', description: 'Register an application.' },
  'guides/empty': { id: 'guides/empty', title: 'Empty', description: '' },
};
const globalDocs = [
  { id: 'guides/users/index', path: '/identity/guides/users/' },
  { id: 'guides/apps/register', path: '/identity/guides/apps/register' },
  { id: 'guides/empty', path: '/identity/guides/empty/' },
];
const context = { pathname: '/identity/guides/start/', docs, globalDocs };
const one = (item, ctx = context) => linkCards([item], ctx)?.[0];

test("the author's text is the description, before anything the linked doc has", () => {
  assert.deepEqual(one({ href: '/identity/guides/users/', title: 'Users', text: 'Add and remove users.' }),
    { href: '/identity/guides/users/', title: 'Users', description: 'Add and remove users.', external: false });
});

test("an internal link without author text shows the linked doc's description", () => {
  assert.equal(one({ href: '/identity/guides/users/', title: 'Users' }).description, 'Manage the users of an organization.');
});

test('trailing slashes, anchors and queries do not stop a link from matching its doc', () => {
  for (const href of ['/identity/guides/users', '/identity/guides/users/#roles', '/identity/guides/users?x=1', '/identity/guides/apps/register/', '/identity/guides/apps/register#a']) {
    assert.ok(one({ href, title: 'T' }).description, href);
  }
});

test('a relative link is matched against the current page', () => {
  assert.equal(one({ href: '../users/', title: 'Users' }).description, 'Manage the users of an organization.');
  assert.equal(one({ href: '../apps/register', title: 'Reg' }, { ...context, pathname: '/identity/guides/start/' }).description, 'Register an application.');
});

test('an external link shows its host, marked external; author text still comes first', () => {
  assert.deepEqual(one({ href: 'https://wso2.com/library/article/', title: 'Article' }),
    { href: 'https://wso2.com/library/article/', title: 'Article', description: 'wso2.com', external: true });
  assert.equal(one({ href: 'https://wso2.com/x', title: 'X', text: 'Read this.' }).description, 'Read this.');
});

test('a link that matches no doc, or a doc with no description, is a card without a description', () => {
  for (const href of ['/identity/guides/missing/', './missing.md', '/other-product/guide/', '/identity/guides/empty/']) {
    const card = one({ href, title: 'Gone' });
    assert.deepEqual(card, { href, title: 'Gone', description: undefined, external: false }, href);
  }
});

test('without version data (outside a docs page) internal cards still render, without descriptions', () => {
  assert.equal(one({ href: '/identity/guides/users/', title: 'Users' }, { pathname: '/x/' }).description, undefined);
});

test('anything missing or malformed gives null, so the component falls back to the plain list', () => {
  for (const items of [undefined, null, 'x', [], [{ href: '/a/' }], [{ title: 'A' }], [{ href: 1, title: 'A' }], [null]]) {
    assert.equal(linkCards(items, context), null, JSON.stringify(items));
  }
});

test('a doc id that is an Object prototype name is not a doc', () => {
  const card = one({ href: '/identity/constructor/', title: 'C' }, { ...context, globalDocs: [{ id: 'constructor', path: '/identity/constructor/' }] });
  assert.equal(card.description, undefined);
});
