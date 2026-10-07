import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadPage, renderSingle } from '../render.js';
import { TemplateError } from '../template.js';
import { tempSource } from './helpers.js';

const src = (root) => ({ root, includeBases: [path.join(root, 'docs'), path.join(root, 'includes'), root] });

test('renders Jinja includes, conditions and variables', () => {
  const root = tempSource({
    'docs/page.md': '{% set host = "localhost" %}# {{ product_name }}\n{% include "../includes/part.md" %}',
    'includes/part.md': 'Host {{ host }}.{% if is_version > "7.2.0" %} New.{% endif %}',
  });
  const s = src(root);
  const out = renderSingle(loadPage(path.join(root, 'docs/page.md'), s), { product_name: 'IS', is_version: '7.10.0' }, path.join(root, 'docs/page.md'), s);
  assert.equal(out, '# IS\nHost localhost. New.');
});

test('expands markdown-include, snippets and {{#var#}}', () => {
  const root = tempSource({
    'docs/page.md': 'A {!includes/x.md!} B\n--8<-- "banner.md"\nLink {{#base_path#}}/y',
    'includes/x.md': 'X',
    'docs/banner.md': 'BANNER',
  });
  const s = src(root);
  const f = path.join(root, 'docs/page.md');
  assert.equal(renderSingle(loadPage(f, s), { base_path: '/p' }, f, s), 'A X B\nBANNER\nLink /p/y');
});

test('refuses includes that escape the content source', () => {
  const root = tempSource({ 'docs/page.md': '{% include "../../../etc/hosts" %}' });
  const s = src(root);
  const f = path.join(root, 'docs/page.md');
  assert.throws(() => renderSingle(loadPage(f, s), {}, f, s), TemplateError);
  const root2 = tempSource({ 'docs/page.md': '{!../../../etc/hosts!}' });
  assert.throws(() => loadPage(path.join(root2, 'docs/page.md'), src(root2)), TemplateError);
});

test('reports a missing include instead of dropping content', () => {
  const root = tempSource({ 'docs/page.md': '{!missing.md!}' });
  assert.throws(() => loadPage(path.join(root, 'docs/page.md'), src(root)), /Include not found/);
});
