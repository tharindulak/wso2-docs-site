import { test } from 'node:test';
import assert from 'node:assert/strict';
import rehypeValidElements from '../src/rehype-valid-elements.js';

test('an element whose name is not a valid tag becomes the text it came from; its children stay', () => {
  const tree = { type: 'root', children: [{ type: 'element', tagName: 'td', properties: {}, children: [
    { type: 'text', value: 'From ' },
    { type: 'element', tagName: 'mail@address.tld', properties: {}, children: [{ type: 'text', value: '. Rest' }] },
  ] }] };
  rehypeValidElements()(tree as any);
  assert.deepEqual((tree as any).children[0].children, [{ type: 'text', value: 'From ' }, { type: 'text', value: '<mail@address.tld>' }, { type: 'text', value: '. Rest' }]);
  assert.equal(tree.children[0].tagName, 'td');
});

test('the title element Docusaurus makes for an admonition title with markup stays an element', () => {
  const title = { type: 'element', tagName: 'mdxAdmonitionTitle', properties: {}, children: [{ type: 'text', value: 'Deprecated ' }] };
  const tree = { type: 'root', children: [{ type: 'element', tagName: 'admonition', properties: { type: 'warning' }, children: [title] }] };
  rehypeValidElements()(tree as any);
  assert.deepEqual((tree as any).children[0].children, [title]);
});
