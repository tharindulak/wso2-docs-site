// The order of the site's remark plugins, read from the config source (loading the config needs generated content).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../docusaurus.config.js', import.meta.url), 'utf8');
const plugins = (/remarkPlugins: \[([^\]]*)\]/.exec(config)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

test('remark-prerequisites runs after remark-steps, so a stepper ends a prerequisites block', () => {
  assert.ok(plugins.includes('remarkSteps'), plugins.join());
  assert.ok(plugins.indexOf('remarkPrerequisites') > plugins.indexOf('remarkSteps'), plugins.join());
});

test('remark-link-cards runs last, so closing sections inside steppers and panels are already in place', () => {
  assert.equal(plugins.at(-1), 'remarkLinkCards', plugins.join());
});
