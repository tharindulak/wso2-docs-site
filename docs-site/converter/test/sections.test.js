import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionsFor, prefixIds, placeCompanion } from '../sections.js';

test('the longest path-prefix override wins; otherwise the section default', () => {
  const src = { deployment_options: ['WSO2 Cloud', 'Self-hosted'], deployment_overrides: { 'deploy/': ['Self-hosted'], 'deploy/cloud/': ['WSO2 Cloud'] } };
  assert.deepEqual(optionsFor(src, 'develop/a.md'), ['WSO2 Cloud', 'Self-hosted']);
  assert.deepEqual(optionsFor(src, 'deploy/k8s.md'), ['Self-hosted']);
  assert.deepEqual(optionsFor(src, 'deploy/cloud/x.md'), ['WSO2 Cloud']);
});

test('companion entries are prefixed, renamed and placed into the matching main sections', () => {
  const main = [{ type: 'category', label: 'Get Started', items: [{ type: 'doc', id: 'intro' }] }, { type: 'category', label: 'Deploy', items: [] }];
  const companion = prefixIds([
    { type: 'category', label: 'Devant Concepts', items: [{ type: 'doc', id: 'concepts/env' }] },
    { type: 'category', label: 'Configure VPN', items: [{ type: 'doc', id: 'vpn' }] },
    { type: 'category', label: 'Unmapped', items: [{ type: 'doc', id: 'x' }] },
  ], 'cloud');
  const placed = placeCompanion(main, companion, { placement: { 'Devant Concepts': 'Get Started', 'Configure VPN': 'Deploy' }, rename: { 'Devant Concepts': 'Concepts' } });
  assert.deepEqual(placed[0].items.map((i) => i.id ?? i.label), ['intro', 'Concepts']);
  assert.equal(placed[0].items[1].items[0].id, 'cloud/concepts/env');
  assert.equal(placed[1].items[0].label, 'Configure VPN');
  assert.equal(placed.at(-1).label, 'Unmapped');
  assert.equal(main[0].items.length, 1, 'input not mutated');
});

test('Docusaurus shorthand in the main sidebar survives merging a same-label companion category', () => {
  // docs-integrator's sidebars.ts lists docs as bare ids and may use { Label: [...] } category shorthand.
  const main = [{ type: 'category', label: 'Get Started', items: ['intro', { Concepts: ['concepts/core'] }] }];
  const companion = [{ type: 'category', label: 'Devant Concepts', items: [{ type: 'doc', id: 'cloud/concepts/env' }] }];
  const placed = placeCompanion(main, companion, { placement: { 'Devant Concepts': 'Get Started' }, rename: { 'Devant Concepts': 'Concepts' } });
  assert.deepEqual(placed[0].items[0], { type: 'doc', id: 'intro' });
  const concepts = placed[0].items[1];
  assert.equal(concepts.type, 'category');
  assert.deepEqual(concepts.items, [{ type: 'doc', id: 'concepts/core' }, { type: 'doc', id: 'cloud/concepts/env' }]);
});
