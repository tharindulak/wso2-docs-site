import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '@mdx-js/mdx';
import remarkDirective from 'remark-directive';
// Docusaurus's admonitions plugin, as mdx-loader runs it before the site's remarkPlugins, with the site's keyword.
import * as admonitions from '@docusaurus/mdx-loader/lib/remark/admonitions/index.js';
import remarkDeprecatedSections from '../src/remark-deprecated-sections.js';

const cjs = (m: object): never => { const d = (m as { default: { default?: unknown } }).default; return (d.default ?? d) as never; };

const jsx = async (value: string): Promise<string> =>
  String(await compile({ value }, { jsx: true, remarkPlugins: [remarkDirective, [cjs(admonitions), { keywords: ['deprecated'] }], remarkDeprecatedSections] }));

test('a deprecated admonition renders as the deprecated type, with or without a title', async () => {
  assert.match(await jsx(':::deprecated[Deprecated behavior]\n\nOld.\n\n:::'), /<_components\.admonition title="Deprecated behavior" type="deprecated">/);
  assert.match(await jsx(':::deprecated\n\nOld.\n\n:::'), /<_components\.admonition type="deprecated">/);
});

test('a warning titled "Deprecated …" is the same notice (sources written before the deprecated type), also with code in the title', async () => {
  assert.match(await jsx(':::warning[Deprecated feature]\n\nOld.\n\n:::'), /<_components\.admonition title="Deprecated feature" type="deprecated">/);
  assert.match(await jsx(':::warning[deprecated FEATURE]\n\nOld.\n\n:::'), /type="deprecated"/);
  const rich = await jsx(':::warning[Deprecated `sub` attribute behavior]\n\nOld.\n\n:::');
  assert.match(rich, /<_components\.admonition type="deprecated"><_components\.mdxAdmonitionTitle>\{"Deprecated "\}<_components\.code>\{"sub"\}/);
});

test('other warnings, and other types titled "Deprecated …", stay as they are', async () => {
  assert.match(await jsx(':::warning[Before you start]\n\nRead.\n\n:::'), /type="warning"/);
  assert.match(await jsx(':::warning[Deprecation of X is planned]\n\nRead.\n\n:::'), /type="warning"/);
  assert.match(await jsx(':::warning\n\nDeprecated things.\n\n:::'), /type="warning"/);
  assert.match(await jsx(':::note[Deprecated feature]\n\nRead.\n\n:::'), /type="note"/);
});

test('notices nested in lists and blocks are found', async () => {
  assert.match(await jsx('1. Step\n\n    :::warning[Deprecated feature]\n\n    Old.\n\n    :::\n'), /type="deprecated"/);
});
