import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navToSidebar, mergeSidebars, selectNav } from '../nav.js';

test('MkDocs nav becomes a sidebar; section index pages link categories; missing pages are reported', () => {
  const known = (id) => ['index', 'guides/index', 'guides/a', 'guides/b'].includes(id);
  const dropped = [];
  const items = navToSidebar(['index.md', { Guides: ['guides/index.md', { A: 'guides/a.md' }, 'guides/b.md', 'gone.md'] }, { GitHub: 'https://github.com/wso2' }], known, dropped);
  assert.deepEqual(items, [
    { type: 'doc', id: 'index' },
    { type: 'category', label: 'Guides', link: { type: 'doc', id: 'guides/index' }, items: [{ type: 'doc', id: 'guides/a', label: 'A' }, { type: 'doc', id: 'guides/b' }] },
    { type: 'link', label: 'GitHub', href: 'https://github.com/wso2' },
  ]);
  assert.deepEqual(dropped, ['gone.md']);
});

test('merging keeps base order and slots extra items after their nearest shared neighbour', () => {
  const base = [{ type: 'doc', id: 'a' }, { type: 'category', label: 'Guides', items: [{ type: 'doc', id: 'g1' }] }, { type: 'doc', id: 'z' }];
  const extra = [{ type: 'doc', id: 'a' }, { type: 'doc', id: 'cloud-only' }, { type: 'category', label: 'guides', items: [{ type: 'doc', id: 'g1' }, { type: 'doc', id: 'g2' }] }];
  assert.deepEqual(mergeSidebars(base, extra).map((i) => i.id ?? i.label), ['a', 'cloud-only', 'Guides', 'z']);
  assert.deepEqual(mergeSidebars(base, extra)[2].items.map((i) => i.id), ['g1', 'g2']);
});

test('an empty MkDocs title keeps the page out of the sidebar', () => {
  assert.deepEqual(navToSidebar([{ '': 'page-not-found.md' }, 'index.md'], () => true), [{ type: 'doc', id: 'index' }]);
});

test('selectNav takes a subtree, drops entries and keeps one release of a versioned entry', () => {
  const nav = [
    { Overview: 'index.md' },
    { Cloud: [{ Introduction: ['cloud/intro.md'] }] },
    { 'API Manager': [{ Documentation: 'https://apim.docs.wso2.com/en/latest/' }] },
    { 'API Gateway': [{ next: ['api-gateway/next/a.md'] }, { '1.2.0': [{ Overview: 'api-gateway/1.2.0/a.md' }] }, { '1.1.0': ['api-gateway/1.1.0/a.md'] }] },
  ];
  assert.deepEqual(selectNav(nav, { root: 'Cloud' }), [{ Introduction: ['cloud/intro.md'] }]);
  assert.deepEqual(selectNav(nav, { drop: ['Cloud', 'API Manager'], pick: { 'API Gateway': '1.2.0' } }), [
    { Overview: 'index.md' },
    { 'API Gateway': [{ Overview: 'api-gateway/1.2.0/a.md' }] },
  ]);
  assert.deepEqual(selectNav(nav, {}), nav, 'no options: unchanged');
  assert.throws(() => selectNav(nav, { pick: { 'API Gateway': '9.9.9' } }), /9\.9\.9/);
});
