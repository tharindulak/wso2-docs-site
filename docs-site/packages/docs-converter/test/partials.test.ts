import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { convertMergedSites } from '../src/site.js';
import { tempSource } from './helpers.js';

/** A cloud + self-hosted pair sharing templates, like docs-is (wrapper pages include files from en/includes). */
const pair = (files: Record<string, string>, selfPages: string[] = [], cloudPages: string[] = []) => tempSource({
  'cloud/mkdocs.yml': 'site_name: C\nextra:\n  product_name: Cloud P\n',
  'self/mkdocs.yml': 'site_name: S\nextra:\n  product_name: Server P\n',
  ...files,
  ...Object.fromEntries(selfPages.map((p) => [`self/docs/${p}`, files[`cloud/docs/${p}`] ?? ''])),
  ...Object.fromEntries(cloudPages.map((p) => [`cloud/docs/${p}`, files[`self/docs/${p}`] ?? ''])),
});

async function convert(root: string): Promise<{ out: string; read: (rel: string) => string }> {
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  await convertMergedSites({ cloud: { root, mkdocs: 'cloud/mkdocs.yml' }, self: { root, mkdocs: 'self/mkdocs.yml' }, sharedNames: { product_name: 'Platform P' }, partials: true }, { outDir: out, route: 'p' });
  return { out, read: (rel) => fs.readFileSync(path.join(out, rel), 'utf8') };
}

test('an include that two pages use becomes one partial both pages import', async () => {
  const root = pair({
    'cloud/docs/a.md': '# A\n\n{% include "../../includes/db/shared-step.md" %}\n',
    'cloud/docs/b.md': '# B\n\nIntro.\n\n{% include "../../includes/db/shared-step.md" %}\n\nAfter.\n',
    'includes/db/shared-step.md': 'Run the shared step.\n',
  }, ['a.md', 'b.md']);
  const { read } = await convert(root);
  assert.equal(read('_partials/db/shared-step.mdx').trim(), 'Run the shared step.');
  for (const page of ['a.md', 'b.md']) {
    const text = read(page);
    assert.match(text, /^import SharedStep from '\.\/_partials\/db\/shared-step\.mdx';$/m);
    assert.match(text, /^<SharedStep \/>$/m);
    assert.doesNotMatch(text, /Run the shared step/);
  }
  assert.match(read('b.md'), /Intro\.\n\n<SharedStep \/>\n\nAfter\./);
});

test('an include only one page uses is written into that page', async () => {
  const root = pair({
    'cloud/docs/a.md': '# A\n\n{% include "../../includes/a-body.md" %}\n',
    'cloud/docs/b.md': '# B\n\nOwn text.\n',
    'includes/a-body.md': 'Only A says this.\n',
  }, ['a.md', 'b.md']);
  const { out, read } = await convert(root);
  assert.match(read('a.md'), /Only A says this\./);
  assert.doesNotMatch(read('a.md'), /import /);
  assert.ok(!fs.existsSync(path.join(out, '_partials')));
});

test('a shared include inside a line or inside code is written in place', async () => {
  const root = pair({
    'cloud/docs/a.md': '# A\n\nUse {% include "../../includes/word.md" %} here.\n\n```toml\n{% include "../../includes/toml.md" %}\n```\n',
    'cloud/docs/b.md': '# B\n\nAlso {% include "../../includes/word.md" %}.\n\n```toml\n{% include "../../includes/toml.md" %}\n```\n',
    'includes/word.md': 'the console',
    'includes/toml.md': '[server]\nhostname = "localhost"',
  }, ['a.md', 'b.md']);
  const { out, read } = await convert(root);
  assert.match(read('a.md'), /Use the console here\./);
  assert.match(read('b.md'), /\[server\]\nhostname = "localhost"/);
  assert.ok(!fs.existsSync(path.join(out, '_partials')));
});

test('a partial keeps the deployment-option labels of its include, also when a cloud-only and a self-hosted-only page share it', async () => {
  const step = 'includes/sign-in.md';
  const root = pair({
    'cloud/docs/console.md': '# Console\n\n{% include "../../includes/sign-in.md" %}\n',
    'self/docs/install.md': '# Install\n\n{% include "../../includes/sign-in.md" %}\n',
    [step]: 'Sign in to {{ product_name }}.\n\n{% if product_name == "Cloud P" %}Open the Console.{% else %}Open https://localhost:9443/console.{% endif %}\n',
  });
  const { read } = await convert(root);
  const partial = read('_partials/sign-in.mdx');
  assert.match(partial, /Sign in to Platform P\./);
  assert.match(partial, /<Applies to="WSO2 Cloud">\n\nOpen the Console\.\n\n<\/Applies>/);
  assert.match(partial, /<Applies to="Self-hosted">\n\nOpen https:\/\/localhost:9443\/console\.\n\n<\/Applies>/);
  assert.match(read('console.md'), /^<SignIn \/>$/m);
  assert.match(read('install.md'), /^<SignIn \/>$/m);
});

test('a shared include that reads a page\'s own values stays inlined, since one partial could not say both', async () => {
  const root = pair({
    'cloud/docs/a.md': '{% set app = "Alpha" %}\n# A\n\n{% include "../../includes/register.md" %}\n',
    'cloud/docs/b.md': '{% set app = "Beta" %}\n# B\n\n{% include "../../includes/register.md" %}\n',
    'includes/register.md': 'Register {{ app }}.\n',
  }, ['a.md', 'b.md']);
  const { out, read } = await convert(root);
  assert.match(read('a.md'), /Register Alpha\./);
  assert.match(read('b.md'), /Register Beta\./);
  assert.ok(!fs.existsSync(path.join(out, '_partials')));
});

test('a page that only converts as CommonMark inlines its partials, and later pages still import theirs', async () => {
  const root = pair({
    'cloud/docs/a.md': '# A\n\n<table><tr><td>x</td></tr></tr></table>\n\n{% include "../../includes/shared.md" %}\n',
    'cloud/docs/b.md': '# B\n\n{% include "../../includes/shared.md" %}\n',
    'cloud/docs/c.md': '# C\n\n{% include "../../includes/shared.md" %}\n',
    'includes/shared.md': 'Shared words.\n',
  }, ['a.md', 'b.md', 'c.md']);
  const { read } = await convert(root);
  assert.match(read('a.md'), /Shared words\./);
  for (const page of ['b.md', 'c.md']) assert.match(read(page), /^<Shared \/>$/m);
});
