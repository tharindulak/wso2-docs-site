import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mergePage } from '../src/merge.js';
import { tempSource } from './helpers.js';

test('shared text kept once; differing branches and values labelled', () => {
  const root = tempSource({
    'cloud/p.md': '{% set host = "api.example.io" %}{% include "../inc/p.md" %}',
    'self/p.md': '{% set host = "localhost:9443" %}{% include "../inc/p.md" %}',
    'inc/p.md': '{{ product_name }} intro.\n{% if product_name == "Cloud P" %}Console steps.{% else %}Edit deployment.toml.{% endif %}\nHost {{ host }}.\n```\ncurl https://{{ host }}/x\n```\n',
  });
  const source = { root, includeBases: [] };
  const sides = { cloud: { env: { product_name: 'Cloud P' }, source }, self: { env: { product_name: 'Server P' }, source } };
  const { text, stats } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), sides, { product_name: 'Platform P' });
  assert.match(text, /^Platform P intro\./);
  assert.match(text, /<Applies to="WSO2 Cloud">\n\nConsole steps\.\n\n<\/Applies>/);
  assert.match(text, /<Applies to="Self-hosted">\n\nEdit deployment\.toml\.\n\n<\/Applies>/);
  assert.match(text, /<DeploymentValue cloud="api\.example\.io" selfHosted="localhost:9443" \/>/);
  assert.match(text, /curl https:\/\/<HOST>\/x/);
  assert.equal(stats.diverged, false);
});

test('wrappers that include different files are kept whole and labelled', () => {
  const root = tempSource({ 'cloud/p.md': 'Cloud only page.', 'self/p.md': 'Self page.' });
  const source = { root, includeBases: [] };
  const { text, stats } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.equal(stats.diverged, true);
  assert.match(text, /<Applies to="WSO2 Cloud">\n\nCloud only page\./);
});

test('wrappers differing only in front matter or quick-start meta still merge page by page', () => {
  const root = tempSource({
    'cloud/p.md': '---\ntemplate: t.html\n---\n<script>const meta = { pkg: "a" };</script>\n{% include "../inc/p.md" %}',
    'self/p.md': '---\ntemplate: t.html\n---\n<script>const meta = { pkg: "b" };</script>\n{% include "../inc/p.md" %}',
    'inc/p.md': '# Quickstart\nShared.',
  });
  const source = { root, includeBases: [] };
  const { text, stats } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.equal(stats.diverged, false);
  assert.equal(text.trim(), '# Quickstart\nShared.');
});

test('differences inside code split the whole sample; indented content keeps its container', () => {
  const root = tempSource({
    'cloud/p.md': '{% include "../inc/p.md" %}', 'self/p.md': '{% include "../inc/p.md" %}',
    'inc/p.md': '=== "Python"\n    ```python\n    run({% if product_name == "C" %}CLOUD_CFG{% else %}IS_CFG{% endif %})\n    ```\n\n!!! note\n    Shared.\n    {% if product_name == "C" %}\n    Cloud tip.\n    {% endif %}\n',
  });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: { product_name: 'C' }, source }, self: { env: { product_name: 'S' }, source } });
  assert.match(text, / {4}<Applies to="WSO2 Cloud">\n\n {4}```python\n {4}run\(CLOUD_CFG\)\n {4}```\n\n {4}<\/Applies>/);
  assert.match(text, / {4}<Applies to="Self-hosted">\n\n {4}```python\n {4}run\(IS_CFG\)\n {4}```/);
  assert.match(text, / {4}<Applies to="WSO2 Cloud">\n\n {4}Cloud tip\.\n\n {4}<\/Applies>/);
  assert.doesNotMatch(text, /\u2063/);
});

test('an indented include whose later lines are not indented stays inside its list item', () => {
  const root = tempSource({
    'cloud/p.md': '{% include "../inc/p.md" %}', 'self/p.md': '{% include "../inc/p.md" %}',
    'inc/p.md': '1. Step\n\n    {% include "frag.md" %}\n',
    'inc/frag.md': '{% if product_name == "C" %}=== "Classic"\n    A\n\n=== "Visual"\n    B\n{% endif %}',
  });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: { product_name: 'C' }, source }, self: { env: { product_name: 'S' }, source } });
  assert.match(text, / {4}<Applies to="WSO2 Cloud">\n\n {4}=== "Classic"\n {8}A\n\n {4}=== "Visual"\n {8}B\n\n {4}<\/Applies>/);
});

test('a differing value inside inline code becomes a placeholder, not a component', () => {
  const root = tempSource({ 'cloud/p.md': '{% set product = "asgardeo" %}{% include "../inc/p.md" %}', 'self/p.md': '{% set product = "is" %}{% include "../inc/p.md" %}', 'inc/p.md': 'Name: `{{ product }}-react`, then {{ product }}.' });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.match(text, /^Name: `<PRODUCT>-react`, then <DeploymentValue cloud="asgardeo" selfHosted="is" \/>\.$/);
});
