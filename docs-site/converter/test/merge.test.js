import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mergePage } from '../merge.js';
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
