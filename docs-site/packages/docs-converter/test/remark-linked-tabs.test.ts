import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '@mdx-js/mdx';
import remarkLinkedTabs from '../src/remark-linked-tabs.js';

/** The page's JSX, as the docs site would compile it, after the plugin. */
const jsx = async (value: string): Promise<string> =>
  String(await compile(value, { jsx: true, remarkPlugins: [remarkLinkedTabs] }));

/** A `<Tabs>` block as the converter writes it: positional values, one tab per label. */
const tabs = (labels: string[], attrs = ''): string =>
  [`<Tabs${attrs}>`, ...labels.map((label, k) => `<TabItem value="tab-${k + 1}" label="${label}">\n\n${label} body\n\n</TabItem>`), '</Tabs>'].join('\n\n');

/** The groupId of each `<Tabs>` in order (null when none), and the values of its tabs. */
const blocks = (js: string): { groupId: string | null; values: string[] }[] =>
  js.split(/<Tabs\b/).slice(1).map((part) => ({
    groupId: /^[^>]*groupId="([^"]*)"/.exec(part)?.[1] ?? null,
    values: [...part.split('</Tabs>')[0].matchAll(/<TabItem\b[^>]*value="([^"]*)"/g)].map((m) => m[1]),
  }));

test('blocks offering the same choices in a different order share a groupId; each tab\'s value is its label', async () => {
  const [a, b] = blocks(await jsx(`${tabs(['npm', 'yarn', 'pnpm'])}\n\nText.\n\n${tabs(['pnpm', 'npm', 'yarn'])}`));
  assert.deepEqual(a.values, ['npm', 'yarn', 'pnpm']);
  assert.deepEqual(b.values, ['pnpm', 'npm', 'yarn']);
  assert.ok(a.groupId);
  assert.equal(a.groupId, b.groupId);
});

test('labels differing only in case, spaces or Markdown formatting are the same choice', async () => {
  const [a, b] = blocks(await jsx(`${tabs(['**Format**', 'Example'])}\n\n${tabs(['  format ', '*example*'])}\n\n${tabs(['Request (\`/authn\`)', 'Request  format'])}`));
  assert.deepEqual(a.values, ['format', 'example']);
  assert.equal(a.groupId, b.groupId);
});

test('OS aliases are one choice: macOS/Linux, Linux/macOS, Linux/Unix and Linux link; Windows stays Windows', async () => {
  const found = blocks(await jsx(['macOS/Linux', 'Linux/macOS', 'Linux/Unix', 'Linux'].map((os) => tabs(['Windows', os])).join('\n\n')));
  assert.deepEqual(found.map((b) => b.values[0]), ['windows', 'windows', 'windows', 'windows']);
  assert.equal(new Set(found.map((b) => b.values[1])).size, 1);
  assert.equal(new Set(found.map((b) => b.groupId)).size, 1);
});

test('a block the author grouped, valued or defaulted is left as written', async () => {
  const authored = [
    tabs(['npm', 'yarn'], ' groupId="pm"'),
    '<Tabs>\n\n<TabItem value="npm" label="npm">\n\na\n\n</TabItem>\n\n<TabItem value="tab-2" label="yarn">\n\nb\n\n</TabItem>\n\n</Tabs>',
    tabs(['npm', 'yarn'], ' defaultValue="tab-2"'),
  ];
  for (const source of authored) {
    const [b] = blocks(await jsx(source));
    assert.equal(b.groupId, /groupId="([^"]*)"/.exec(source)?.[1] ?? null, source);
    assert.deepEqual(b.values, [...source.matchAll(/value="([^"]*)"/g)].map((m) => m[1]), source);
  }
});

test('single-tab blocks, and blocks where two labels are the same choice, are left as written', async () => {
  for (const labels of [['npm'], ['Format', '**format**'], ['Linux', 'macOS/Linux', 'Windows']]) {
    const [b] = blocks(await jsx(tabs(labels)));
    assert.equal(b.groupId, null, labels.join());
    assert.deepEqual(b.values, labels.map((_, k) => `tab-${k + 1}`), labels.join());
  }
});

test('tabs inside an Applies block, in a partial, and nested in another tab link too', async () => {
  const applies = blocks(await jsx(`<Applies to="Self-hosted">\n\n${tabs(['JKS', 'PKCS12'])}\n\n</Applies>`));
  assert.deepEqual(applies[0].values, ['jks', 'pkcs12']);
  // A partial is a page fragment without front matter or imports; the docs plugin compiles it with the same plugins.
  const partial = blocks(await jsx(`## Install\n\n${tabs(['pnpm', 'npm'])}`));
  assert.deepEqual(partial[0].values, ['pnpm', 'npm']);
  const nested = blocks(await jsx(`<Tabs>\n\n<TabItem value="tab-1" label="Windows">\n\n${tabs(['npm', 'yarn'])}\n\n</TabItem>\n\n<TabItem value="tab-2" label="Linux">\n\n${tabs(['yarn', 'npm'])}\n\n</TabItem>\n\n</Tabs>`));
  assert.equal(nested.length, 3);
  assert.deepEqual(nested[0].values.slice(0, 1), ['windows']);
  assert.equal(nested[1].groupId, nested[2].groupId);
  assert.notEqual(nested[0].groupId, nested[1].groupId);
});

test('groupId and values are slug-like and bounded, whatever the labels hold', async () => {
  const long = 'A very long tab label that goes on and on about the request format'.repeat(3);
  const [b] = blocks(await jsx(tabs([`${long} one`, `${long} two`, "Say &quot;hi&quot; &amp; 'bye' / (x) \\\\"])));
  for (const id of [b.groupId!, ...b.values]) assert.match(id, /^[a-z0-9][a-z0-9_-]{0,99}$/, id);
  assert.notEqual(b.values[0], b.values[1], 'labels that differ only past the bound stay distinct');
});
