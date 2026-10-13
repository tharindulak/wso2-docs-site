import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '@mdx-js/mdx';
import remarkDirective from 'remark-directive';
// Docusaurus's own remark plugins, in the order mdx-loader runs them before the site's remarkPlugins.
import * as admonitions from '@docusaurus/mdx-loader/lib/remark/admonitions/index.js';
import * as headings from '@docusaurus/mdx-loader/lib/remark/headings/index.js';
import * as toc from '@docusaurus/mdx-loader/lib/remark/toc/index.js';
import remarkSteps from '../src/remark-steps.js';
import remarkPrerequisites from '../src/remark-prerequisites.js';

/** A CommonJS module's default export, as Node hands it to an ES module. */
const cjs = (m: object): never => { const d = (m as { default: { default?: unknown } }).default; return (d.default ?? d) as never; };

/** The page's JSX, as the docs site would compile it: directives, admonitions, heading ids, TOC, then the site plugins. */
const jsx = async (value: string, frontMatter: Record<string, unknown> = {}, format: 'mdx' | 'md' = 'mdx'): Promise<string> =>
  String(await compile({ value, data: { frontMatter } }, {
    jsx: true, format,
    remarkPlugins: [remarkDirective, cjs(admonitions), [cjs(headings), { anchorsMaintainCase: false }], cjs(toc), remarkSteps, remarkPrerequisites],
  }));

const count = (s: string, re: RegExp): number => (s.match(new RegExp(re, 'g')) ?? []).length;

test('a Prerequisites heading becomes a panel: the heading as its title, its content as the body', async () => {
  const js = await jsx('Intro.\n\n## Prerequisites\n\n- An account.\n- A tenant.\n\n## Configure\n\nDo it.');
  assert.match(js, /<_components\.div className="prerequisites"><_components\.div className="prerequisites__head"><_components\.h2 id="prerequisites">\{"Prerequisites"\}<\/_components\.h2><\/_components\.div><_components\.div className="prerequisites__body"><_components\.ul>/);
  assert.match(js, /A tenant\.[\s\S]*<\/_components\.ul><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.h2 id="configure">/, 'the next heading at its level ends the block');
});

test('h2 and h3 headings titled "Prerequisites" or "Before you begin", in any case and with a trailing "!", are blocks; other headings are not', async () => {
  for (const h of ['## Prerequisites', '### Prerequisites', '## Before you begin', '### BEFORE YOU BEGIN', '## prerequisites', '## Before you begin!']) {
    assert.equal(count(await jsx(`${h}\n\nNeed a.\n\n## Next\n\nb`), /className="prerequisites"/), 1, h);
  }
  for (const h of ['#### Prerequisites', '# Prerequisites', '## General prerequisites', '## Prerequisites for SSO', '## Before you begin: Enable tenant URL mode']) {
    assert.doesNotMatch(await jsx(`${h}\n\nNeed a.\n\n## Next\n\nb`), /className="prerequisites/, h);
  }
});

test('the heading keeps its id and its TOC entry', async () => {
  const js = await jsx('## Before you begin\n\nNeed a.\n\n### Details\n\nmore\n\n## Next\n\nb');
  assert.match(js, /export const toc = \[\{\s*"value": "Before you begin",\s*"id": "before-you-begin",\s*"level": 2\s*\}, \{\s*"value": "Details",\s*"id": "details",\s*"level": 3/);
  assert.match(js, /<_components\.div className="prerequisites__head"><_components\.h2 id="before-you-begin">\{"Before you begin"\}<\/_components\.h2>/);
});

test('sub-headings, admonitions, tabs and code stay inside the block; it ends at the next heading at its level or above', async () => {
  const js = await jsx('## Prerequisites\n\n### Accounts\n\na\n\n:::note\nKeep it.\n:::\n\n<Tabs><TabItem label="npm">x</TabItem></Tabs>\n\n```sh\nrun\n```\n\n## Configure\n\nb');
  assert.match(js, /className="prerequisites__body"><_components\.h3 id="accounts">[\s\S]*<_components\.admonition type="note">[\s\S]*<Tabs>[\s\S]*run[\s\S]*<\/_components\.pre><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.h2 id="configure">/);
  const h3 = await jsx('### Prerequisites\n\na\n\n#### More\n\nb\n\n### Next\n\nc\n\n## Up\n\nd');
  assert.match(h3, /More[\s\S]*<\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.h3 id="next">/);
});

test('a block ends where a stepper starts, also when the Step headings are deeper than the block heading', async () => {
  const same = await jsx('## Prerequisites\n\nNeed a.\n\n## Step 1: A\n\na\n\n## Step 2: B\n\nb');
  assert.match(same, /Need a\."\}<\/_components\.p><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.div className="steps">/);
  const deeper = await jsx('## Prerequisites\n\nNeed a.\n\n### Step 1: A\n\na\n\n### Step 2: B\n\nb\n\n## Next\n\nc');
  assert.match(deeper, /Need a\."\}<\/_components\.p><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.div className="steps">/);
});

test('an admonition of any type titled "Prerequisites" or "Before you begin" becomes the same panel; the type is dropped', async () => {
  for (const type of ['note', 'tip', 'info', 'warning', 'danger', 'caution', 'important', 'success', 'secondary']) {
    const js = await jsx(`Intro.\n\n:::${type}[Before you begin]\n\n- An account.\n\n:::\n\nNext.`);
    assert.match(js, /<_components\.div className="prerequisites"><_components\.div className="prerequisites__head"><_components\.p className="prerequisites__title">\{"Before you begin"\}<\/_components\.p><\/_components\.div><_components\.div className="prerequisites__body"><_components\.ul>[\s\S]*An account\.[\s\S]*<\/_components\.ul><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.p>\{"Next\."\}/, type);
    assert.doesNotMatch(js, /admonition/, type);
  }
});

test('the admonition title is the author\'s text, in any case; a title with formatting counts too; other titles do not', async () => {
  assert.match(await jsx(':::note[PREREQUISITES]\nNeed a.\n:::'), /className="prerequisites__title">\{"PREREQUISITES"\}/);
  assert.match(await jsx(':::tip[ Before You Begin ]\nNeed a.\n:::'), /className="prerequisites"/);
  assert.match(await jsx(':::info[**Before you begin**]\nNeed a.\n:::'), /className="prerequisites__title"><_components\.strong>\{"Before you begin"\}<\/_components\.strong>/);
  for (const title of ['General prerequisites', 'Before you begin, keep the following in mind', 'Note']) {
    assert.match(await jsx(`:::note[${title}]\nNeed a.\n:::`), /admonition/, title);
  }
  assert.match(await jsx(':::note\nPrerequisites\n:::'), /admonition/, 'an untitled admonition about prerequisites stays');
});

test('several blocks on a page each become their own panel, where they are written', async () => {
  const js = await jsx('## Prerequisites\n\na\n\n## Set up\n\nb\n\n:::tip[Before you begin]\nc\n:::\n\n## Try it\n\n### Before you begin\n\nd\n\n### Run\n\ne');
  assert.equal(count(js, /className="prerequisites"/), 3);
  assert.match(js, /id="set-up">[\s\S]*className="prerequisites"[\s\S]*id="try-it">[\s\S]*className="prerequisites"[\s\S]*id="run">/);
});

test('blocks inside JSX blocks (Applies) and inside a step are wrapped too', async () => {
  const applies = await jsx('<Applies to="Self-hosted">\n\n## Prerequisites\n\na\n\n</Applies>\n\n<Applies to="Cloud">\n\n:::note[Prerequisites]\nb\n:::\n\n</Applies>');
  assert.equal(count(applies, /<Applies to="[^"]+"><_components\.div className="prerequisites">/), 2);
  const step = await jsx('## Step 1: A\n\n:::info[Before you begin]\na\n:::\n\n## Step 2: B\n\nb');
  assert.match(step, /className="steps__step" data-step="1">[\s\S]*className="prerequisites"[\s\S]*data-step="2"/);
});

test('front matter prerequisites: false leaves the page as written', async () => {
  const js = await jsx('## Prerequisites\n\na\n\n:::note[Before you begin]\nb\n:::', { prerequisites: false });
  assert.doesNotMatch(js, /className="prerequisites/);
  assert.match(js, /admonition/);
});

test('CommonMark (format md) pages get the panel too', async () => {
  assert.equal(count(await jsx('## Prerequisites\n\na\n\n## Then\n\n:::note[Before you begin]\nb\n:::', {}, 'md'), /className="prerequisites"/), 2);
});

test('a block inside another block\'s content is not wrapped again', async () => {
  const js = await jsx('## Prerequisites\n\n### Before you begin\n\na\n\n:::note[Before you begin]\nb\n:::\n\n## Next\n\nc');
  assert.equal(count(js, /className="prerequisites"/), 1);
  assert.match(js, /className="prerequisites__body"><_components\.h3 id="before-you-begin">[\s\S]*<_components\.admonition title="Before you begin" type="note">/);
});

test('a heading with nothing under it before the next heading or stepper is left as written', async () => {
  assert.doesNotMatch(await jsx('## Prerequisites\n\n## Configure\n\na'), /className="prerequisites/);
  assert.doesNotMatch(await jsx('## Prerequisites\n\n### Step 1: A\n\na\n\n### Step 2: B\n\nb'), /className="prerequisites/);
});

test('an admonition titled "Before you begin!" (as 88 docs-is admonitions are) is a block too', async () => {
  assert.equal(count(await jsx(':::note[Before you begin!]\n\nNeed a.\n\n:::\n\nAfter.'), /className="prerequisites"/), 1);
});
