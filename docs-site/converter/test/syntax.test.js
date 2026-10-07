import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMdx } from '../syntax.js';

test('admonitions, including titled and nested in lists', () => {
  const { body } = toMdx('!!! warning "Before you start"\n    Read this.\n\n1. Step\n\n    !!! note\n        Inside.\n');
  assert.match(body, /^:::warning\[Before you start\]\n\nRead this\.\n\n:::/m);
  assert.match(body, /^ {4}:::note\n\n {4}Inside\.\n\n {4}:::/m);
});

test('collapsibles and tabs', () => {
  const { body, usesTabs } = toMdx('??? tip "More"\n    Hidden.\n\n=== "Java"\n    ```java\n    a();\n    ```\n\n=== "Go"\n    b\n');
  assert.match(body, /<details>\n<summary>More<\/summary>/);
  assert.match(body, /<Tabs>\n<TabItem value="tab-0" label="Java">/);
  assert.match(body, /<TabItem value="tab-1" label="Go">/);
  assert.equal(usesTabs, true);
});

test('code is never rewritten; fence attributes become Docusaurus metadata', () => {
  const { body } = toMdx('```js hl_lines="1 3" title="a.js"\nconst x = {a: 1}; // <b>\n```\nUse `{x}` and <b>bold</b>.');
  assert.match(body, /```js title="a\.js" \{1,3\}\nconst x = \{a: 1\}; \/\/ <b>\n```/);
  assert.match(body, /Use `\{x\}` and <b>bold<\/b>\./);
});

test('escapes braces and unknown tags in prose; fixes HTML for JSX', () => {
  const { body } = toMdx('Set {org_name} for <tenant-domain>.\n<img src="a.png" class="x" style="border:0"><br>\n[Link](x.md){:target="_blank"}\n<!-- hidden -->');
  assert.match(body, /Set \\\{org_name\\\} for &lt;tenant-domain>\./);
  assert.match(body, /<img src="a\.png" className="x" \/><br \/>/);
  assert.match(body, /\[Link\]\(x\.md\)\n/);
  assert.doesNotMatch(body, /hidden/);
});

test('placeholders in link URLs: in the host the link becomes code, in the path it is encoded', () => {
  assert.equal(toMdx('[Portal](https://<APIM_HOST>:9443/devportal)').body, 'Portal (`https://<APIM_HOST>:9443/devportal`)');
  assert.equal(toMdx('[API](https://api.example.com/<org>/x)').body, '[API](https://api.example.com/%3Corg%3E/x)');
});
