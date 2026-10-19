// Pages written with the conventions (Step N headings, Prerequisites blocks, closing sections) render as before the
// one rendering path: the converter step writes the explicit components (conventions.ts), the site renders them
// (remark-components.ts). Ported from the tests of the convention plugins the site used to run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeComponents } from '../src/conventions.js';
import { jsx as compiled, cards as compiledCards, count, type Format } from './site-compile.js';

/** The page as the site renders it after conversion. */
const jsx = (md: string, fm: Record<string, unknown> = {}, format: Format = 'mdx'): Promise<string> =>
  compiled(writeComponents(md, { frontMatter: fm }).text, fm, format);
const cards = (md: string, fm: Record<string, unknown> = {}): ReturnType<typeof compiledCards> =>
  compiledCards(writeComponents(md, { frontMatter: fm }).text, fm);

// Steps

test('a run of Step headings becomes one stepper with a step per heading, each holding its content', async () => {
  const js = await jsx('Intro.\n\n## Step 1: Install\n\nDo a.\n\n## Step 2: Configure\n\nDo b.\n\n```sh\nrun\n```\n\n## Step 3: Run\n\nDo c.\n\n## After\n\nDone.');
  assert.equal(count(js, /className="steps"/), 1);
  assert.equal(count(js, /className="steps__step"/), 3);
  assert.match(js, /<_components\.div className="steps"><_components\.div className="steps__step" data-step="1"><_components\.h2 id="step-1-install">/);
  assert.match(js, /Do b\.[\s\S]*run[\s\S]*<\/_components\.div><_components\.div className="steps__step" data-step="3">/, 'a step holds everything up to the next step');
  assert.match(js, /Do c\."\}<\/_components\.p><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.h2 id="after">\{"After"\}/, 'a heading at the same level ends the run');
});

test('the "Step N:" prefix stays in the heading, in a visually hidden span; the id and TOC entry are as before', async () => {
  const js = await jsx('## Step 1: Install\n\na\n\n## Step 2: Run\n\nb');
  assert.match(js, /<_components\.h2 id="step-1-install"><_components\.span className="steps__prefix">\{"Step 1: "\}<\/_components\.span>\{"Install"\}<\/_components\.h2>/);
  assert.match(js, /export const toc = \[\{\s*"value": "Step 1: Install",\s*"id": "step-1-install",\s*"level": 2\s*\}, \{\s*"value": "Step 2: Run",\s*"id": "step-2-run"/);
});

test('separators in use count: colon, dash, en dash, full stop, none; the anchor keeps the separator as written', async () => {
  for (const [a, b, id] of [['Step 1: A', 'Step 2: B', 'step-1-a'], ['Step 1 - A', 'Step 2 - B', 'step-1---a'], ['Step 1 – A', 'Step 2 – B', 'step-1--a'], ['Step 1. A', 'Step 2. B', 'step-1-a'], ['Step 1 A', 'Step 2 B', 'step-1-a']]) {
    const js = await jsx(`## ${a}\n\nx\n\n## ${b}\n\ny`);
    assert.equal(count(js, /className="steps__step"/), 2, a);
    assert.match(js, new RegExp(`<_components\\.h2 id="${id}"><_components\\.span className="steps__prefix">\\{"Step 1: "\\}<\\/_components\\.span>\\{"A"\\}`), a);
  }
});

test('Step 0 starts the count at 0; a skipped number is renumbered in order', async () => {
  const js = await jsx('### Step 0: Prepare\n\na\n\n### Step 1: Go\n\nb\n\n### Step 3: Skip\n\nc');
  assert.deepEqual([...js.matchAll(/data-step="(\d+)"/g)].map((m) => m[1]), ['0', '1', '2']);
  assert.equal(count(js, /className="steps"/), 1);
  assert.match(js, /id="step-3-skip"/, 'the anchor stays');
});

test('a number not above the previous one starts a new run', async () => {
  const js = await jsx('### Step 1: A\n\na\n\n### Step 2: B\n\nb\n\n### Step 1: C\n\nc\n\n### Step 2: D\n\nd');
  assert.equal(count(js, /className="steps"/), 2);
});

test('runs are per heading level; deeper headings stay inside the step', async () => {
  const js = await jsx('## Step 1: A\n\n### Step 1.1: Sub\n\na\n\n### Details\n\nb\n\n## Step 2: B\n\nc');
  assert.equal(count(js, /className="steps"/), 1);
  assert.equal(count(js, /className="steps__step"/), 2);
  assert.match(js, /id="details"[\s\S]*data-step="2"/);
});

test('a Step N.M sub-step inside a step gets a number badge; its prefix is hidden like a step\'s', async () => {
  const js = await jsx('## Step 1: A\n\n### Step 1.1: Create a key vault\n\na\n\n### Step 1.2 - Set policies\n\nb\n\n## Step 2: B\n\nc');
  assert.match(js, /<_components\.h3 id="step-11-create-a-key-vault" className="steps__substep" data-substep="1\.1"><_components\.span className="steps__prefix">\{"Step 1\.1: "\}<\/_components\.span>\{"Create a key vault"\}<\/_components\.h3>/);
  assert.match(js, /id="step-12---set-policies" className="steps__substep" data-substep="1\.2"><_components\.span className="steps__prefix">\{"Step 1\.2: "\}/);
  assert.equal(count(js, /className="steps__step"/), 2, 'sub-steps do not become steps');
});

test('a sub-step heading outside a stepper stays as written', async () => {
  const js = await jsx('## Step 1: Only\n\n### Step 1.1: Sub\n\na\n\n## Other\n\nb');
  assert.doesNotMatch(js, /steps__substep/);
  assert.match(js, /\{"Step 1\.1: Sub"\}/);
});

test('a bold step number ("**Step 1**: Scan") is hidden like a plain one, for steps and sub-steps', async () => {
  const js = await jsx('### **Step 1**: Scan the QR code\n\na\n\n#### **Step 1.1** - Read it\n\nb\n\n### **Step 2**: Generate a key\n\nc');
  assert.equal(count(js, /className="steps__step"/), 2);
  assert.match(js, /<_components\.h3 id="step-1-scan-the-qr-code"><_components\.span className="steps__prefix">\{"Step 1: "\}<\/_components\.span>\{"Scan the QR code"\}<\/_components\.h3>/);
  assert.match(js, /data-substep="1\.1"><_components\.span className="steps__prefix">\{"Step 1\.1: "\}<\/_components\.span>\{"Read it"\}/);
  assert.doesNotMatch(js, /<_components\.strong>\{"Step/);
});

test('bold text that goes past the step number keeps its formatting', async () => {
  const js = await jsx('## **Step 1: Install** it\n\na\n\n## Step 2: Run\n\nb');
  assert.match(js, /<_components\.strong>\{"Step 1: Install"\}<\/_components\.strong>/);
});

test('a lone Step heading, or a run broken by another heading, is not wrapped', async () => {
  assert.doesNotMatch(await jsx('## Step 1: Only\n\na\n\n## Other\n\nb'), /steps/);
  assert.doesNotMatch(await jsx('## Step 1: A\n\na\n\n## Note\n\nb\n\n## Step 2: B\n\nc'), /steps/);
});

test('headings that only start like a step are not steps', async () => {
  assert.doesNotMatch(await jsx('## Steps to follow\n\na\n\n## Stepping up\n\nb'), /className="steps/);
  assert.doesNotMatch(await jsx('## Step one: A\n\na\n\n## Step two: B\n\nb'), /className="steps/);
});

test('a run inside a JSX block (Applies, TabItem) becomes a stepper inside that block', async () => {
  const js = await jsx('<Applies to="Self-hosted">\n\n## Step 1: A\n\na\n\n## Step 2: B\n\nb\n\n</Applies>');
  assert.match(js, /<Applies to="Self-hosted"><_components\.div className="steps">/);
});

test('a heading that starts with code keeps its text; the step still gets its number', async () => {
  const js = await jsx('## Step 1: `init`\n\na\n\n## Step 2: Run\n\nb');
  assert.equal(count(js, /className="steps__step"/), 2);
  assert.match(js, /<_components\.span className="steps__prefix">\{"Step 1: "\}<\/_components\.span><_components\.code>\{"init"\}/);
});

test('front matter stepper: false leaves the page as written', async () => {
  assert.doesNotMatch(await jsx('## Step 1: A\n\na\n\n## Step 2: B\n\nb', { stepper: false }), /className="steps/);
});

// Prerequisites

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

test('the admonition title is the writer\'s text, in any case; a title with formatting counts too, as plain text; other titles do not', async () => {
  assert.match(await jsx(':::note[PREREQUISITES]\nNeed a.\n:::'), /className="prerequisites__title">\{"PREREQUISITES"\}/);
  assert.match(await jsx(':::tip[ Before You Begin ]\nNeed a.\n:::'), /className="prerequisites__title">\{"Before You Begin"\}/);
  assert.match(await jsx(':::info[**Before you begin**]\nNeed a.\n:::'), /className="prerequisites__title">\{"Before you begin"\}/);
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

test('blocks inside JSX blocks (Applies) and inside a step are wrapped too; a block in a step ends with the step', async () => {
  const applies = await jsx('<Applies to="Self-hosted">\n\n## Prerequisites\n\na\n\n</Applies>\n\n<Applies to="Cloud">\n\n:::note[Prerequisites]\nb\n:::\n\n</Applies>');
  assert.equal(count(applies, /<Applies to="[^"]+"><_components\.div className="prerequisites">/), 2);
  const step = await jsx('## Step 1: A\n\n:::info[Before you begin]\na\n:::\n\n## Step 2: B\n\nb');
  assert.match(step, /className="steps__step" data-step="1">[\s\S]*className="prerequisites"[\s\S]*data-step="2"/);
  const last = await jsx('# Page\n\n## Step 1: A\n\na\n\n## Step 2: B\n\n### Prerequisites\n\nNeed b.\n\n# Next\n\nc');
  assert.match(last, /Need b\."\}<\/_components\.p><\/_components\.div><\/_components\.div><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.h1/);
});

test('front matter prerequisites: false leaves the page as written', async () => {
  const js = await jsx('## Prerequisites\n\na\n\n:::note[Before you begin]\nb\n:::', { prerequisites: false });
  assert.doesNotMatch(js, /className="prerequisites/);
  assert.match(js, /admonition/);
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

// Closing sections

const LIST = '- [Users](/identity/guides/users/)\n- [Apps](/identity/guides/apps/)\n';
const cardCount = async (md: string, fm: Record<string, unknown> = {}): Promise<number> => (await cards(md, fm)).length;

test('a "What\'s next?" section that is a list of links becomes LinkCards: href, link text and writer text per item, the list kept as its children', async () => {
  const found = await cards("Intro.\n\n## What's next?\n\n- [Users](./users.md) - Manage the users of an organization.\n- [Apps](https://example.org/apps)\n");
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].items, [
    { href: '/identity/guides/users/', title: 'Users', text: 'Manage the users of an organization.' },
    { href: 'https://example.org/apps', title: 'Apps' },
  ]);
  assert.equal(found[0].children.filter((c) => c && typeof c === 'object').map((c) => c.type).join(), 'ul');
});

test('every closing title at h2 and h3, in any case, with straight or curly apostrophes, is a closing section; other titles are not', async () => {
  const titles = ["What's next", "What's next?", 'What’s next?', 'Whats next', "WHAT'S NEXT?", 'Next steps', 'Next Steps', 'See also',
    'Learn more', 'Learn More', 'Related topics', 'Related links', 'Further reading'];
  for (const t of titles) for (const h of ['##', '###']) assert.equal(await cardCount(`${h} ${t}\n\n${LIST}`), 1, `${h} ${t}`);
  for (const h of ['# Next steps', '#### Next steps', '## Next steps to take', '## Related', "## What's next for SCIM", '## Overview'])
    assert.equal(await cardCount(`${h}\n\n${LIST}`), 0, h);
});

test('the heading keeps its id and its TOC entry, outside the cards', async () => {
  const js = await jsx(`## What's next?\n\n${LIST}`);
  assert.match(js, /export const toc = \[\{\s*"value": "What&#39;s next\?",\s*"id": "whats-next",\s*"level": 2\s*\}\]/);
  assert.match(js, /<_components\.h2 id="whats-next">\{"What's next\?"\}<\/_components\.h2>\{"\\n"\}<LinkCards items=/);
});

test('a section runs to the next heading at its level or above; a deeper heading ends nothing and makes it more than a list', async () => {
  assert.equal(await cardCount(`### See also\n\n${LIST}\n## Then\n\nProse.`), 1, 'ends at a higher heading');
  assert.equal(await cardCount(`## See also\n\n${LIST}\n## Then\n\nProse.`), 1, 'ends at a heading at its level');
  assert.equal(await cardCount(`## See also\n\n${LIST}\n### More\n\nProse.`), 0, 'a sub-heading is part of the section');
});

test('prose, several blocks, nested lists and items that do not start with a link stay as written', async () => {
  const left = [
    'Read [Users](/u/) next.',
    `First intro.\n\nSecond intro.\n\n${LIST}`,
    `:::note\nAn admonition first.\n:::\n\n${LIST}`,
    `${LIST}\nAnd a closing line.`,
    '- [Users](/u/)\n  - [Roles](/r/)\n- [Apps](/a/)',
    '- [Users](/u/)\n- Learn about [apps](/a/).',
    '- **Note:** [Users](/u/)',
    ':::note\n[Users](/u/)\n:::',
    '1. Create a keystore as in [Keystores](/k/).\n2. Import it.',
  ];
  for (const body of left) {
    const md = `## Next steps\n\n${body}\n`;
    assert.equal(writeComponents(md).text, md, body);
  }
});

test('one intro paragraph before the list is allowed: it stays above the cards, as written', async () => {
  const md = `## What's next?\n\nNow that you have set it up, try these.\n\n${LIST}`;
  assert.equal(await cardCount(md), 1);
  const js = await jsx(md);
  assert.ok(js.indexOf('Now that you have set it up, try these.') < js.indexOf('<LinkCards'), 'the intro comes first');
  assert.doesNotMatch(js.slice(js.indexOf('<LinkCards')), /Now that you have set it up/, 'the intro is not inside the cards');
});

test('an ordered list of links becomes cards too, and a paragraph item ("loose" list) counts', async () => {
  assert.equal(await cardCount('## Next steps\n\n1. [Users](/u/)\n2. [Apps](/a/)\n'), 1);
  assert.equal(await cardCount('## Next steps\n\n- [Users](/u/)\n\n- [Apps](/a/)\n'), 1);
});

test('internal, external and unresolved links keep their href as Docusaurus leaves it', async () => {
  const [found] = await cards('## Learn more\n\n- [Users](./users.md#roles)\n- [Ext](https://wso2.com/library/)\n- [Gone](./missing.md)\n- [Root](/identity/guides/x)\n');
  assert.deepEqual(found.items.map((i) => i.href), ['/identity/guides/users/#roles', 'https://wso2.com/library/', './missing.md', '/identity/guides/x']);
});

test('sections inside Applies blocks become cards too, each on its own', async () => {
  const md = `<Applies to="WSO2 Cloud">\n\n## What's next?\n\n${LIST}\n</Applies>\n\n<Applies to="Self-hosted">\n\n## What's next?\n\n- [Keys](/k/) - Rotate keys.\n\n</Applies>\n`;
  const found = await cards(md);
  assert.equal(found.length, 2);
  assert.deepEqual(found[1].items, [{ href: '/k/', title: 'Keys', text: 'Rotate keys.' }]);
});

test('several closing sections on a page each become their own cards', async () => {
  assert.equal(await cardCount(`## Use it\n\n### Learn more\n\n${LIST}\n## Next steps\n\n${LIST}`), 2);
});

test('a section inside a step of a stepper becomes cards, and the stepper stays', async () => {
  const js = await jsx(`## Step 1: A\n\na\n\n## Step 2: B\n\nb\n\n### Next steps\n\n${LIST}`);
  assert.match(js, /className="steps__step" data-step="2">[\s\S]*<LinkCards items=/);
});

test('front matter link_cards: false leaves the page as written', async () => {
  assert.equal(await cardCount(`## See also\n\n${LIST}`, { link_cards: false }), 0);
});
