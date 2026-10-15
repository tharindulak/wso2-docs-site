// The site's remark plugins, read from the config source (loading the config needs generated content).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../docusaurus.config.js', import.meta.url), 'utf8');
const plugins = (/remarkPlugins: \[([^\]]*)\]/.exec(config)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

test('the site renders the explicit content components, last, so they see deprecated sections and linked tabs in place', () => {
  assert.equal(plugins.at(-1), 'remarkComponents', plugins.join());
});

test('the site does not recognise writing conventions: the converter writes the components for them', () => {
  for (const name of ['remarkSteps', 'remarkPrerequisites', 'remarkLinkCards']) assert.ok(!config.includes(name), name);
});
