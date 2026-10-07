import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navToSidebar, mergeSidebars } from '../nav.js';

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
