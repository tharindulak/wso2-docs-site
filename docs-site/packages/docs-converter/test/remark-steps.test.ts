import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '@mdx-js/mdx';
import remarkSteps from '../src/remark-steps.js';

/** The page's JSX, as the docs site would compile it, after the plugin. */
const jsx = async (value: string, frontMatter: Record<string, unknown> = {}, format: 'mdx' | 'md' = 'mdx'): Promise<string> =>
  String(await compile({ value, data: { frontMatter } }, { jsx: true, format, remarkPlugins: [remarkSteps] }));

const count = (s: string, re: RegExp): number => (s.match(new RegExp(re, 'g')) ?? []).length;

test('a run of Step headings becomes one stepper with a step per heading, each holding its content', async () => {
  const js = await jsx('Intro.\n\n## Step 1: Install\n\nDo a.\n\n## Step 2: Configure\n\nDo b.\n\n```sh\nrun\n```\n\n## Step 3: Run\n\nDo c.\n\n## After\n\nDone.');
  assert.equal(count(js, /className="steps"/), 1);
  assert.equal(count(js, /className="steps__step"/), 3);
  assert.match(js, /<_components\.div className="steps"><_components\.div className="steps__step" data-step="1"><_components\.h2>/);
  assert.match(js, /Do b\.[\s\S]*run[\s\S]*<\/_components\.div><_components\.div className="steps__step" data-step="3">/, 'a step holds everything up to the next step');
  assert.match(js, /Do c\."\}<\/_components\.p><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.h2>\{"After"\}/, 'a heading at the same level ends the run');
});

test('the "Step N:" prefix stays in the heading, in a visually hidden span', async () => {
  const js = await jsx('## Step 1: Install\n\na\n\n## Step 2: Run\n\nb');
  assert.match(js, /<_components\.h2><_components\.span className="steps__prefix">\{"Step 1: "\}<\/_components\.span>\{"Install"\}<\/_components\.h2>/);
});

test('separators in use count: colon, dash, en dash, full stop, none', async () => {
  for (const [a, b] of [['Step 1: A', 'Step 2: B'], ['Step 1 - A', 'Step 2 - B'], ['Step 1 – A', 'Step 2 – B'], ['Step 1. A', 'Step 2. B'], ['Step 1 A', 'Step 2 B']]) {
    const js = await jsx(`## ${a}\n\nx\n\n## ${b}\n\ny`);
    assert.equal(count(js, /className="steps__step"/), 2, a);
    assert.match(js, /\{"A"\}/, `${a}: prefix split off`);
  }
});

test('the circle shows the author\'s number: Step 0 and skipped numbers are kept', async () => {
  const js = await jsx('### Step 0: Prepare\n\na\n\n### Step 1: Go\n\nb\n\n### Step 3: Skip\n\nc');
  assert.deepEqual([...js.matchAll(/data-step="(\d+)"/g)].map((m) => m[1]), ['0', '1', '3']);
  assert.equal(count(js, /className="steps"/), 1);
});

test('a number not above the previous one starts a new run', async () => {
  const js = await jsx('### Step 1: A\n\na\n\n### Step 2: B\n\nb\n\n### Step 1: C\n\nc\n\n### Step 2: D\n\nd');
  assert.equal(count(js, /className="steps"/), 2);
});

test('runs are per heading level; deeper headings stay inside the step', async () => {
  const js = await jsx('## Step 1: A\n\n### Step 1.1: Sub\n\na\n\n### Details\n\nb\n\n## Step 2: B\n\nc');
  assert.equal(count(js, /className="steps"/), 1);
  assert.equal(count(js, /className="steps__step"/), 2);
  assert.match(js, /\{"Step 1.1: Sub"\}/, 'a Step N.M sub-step heading is left as written');
});

test('a lone Step heading, or a run broken by another heading, is not wrapped', async () => {
  assert.doesNotMatch(await jsx('## Step 1: Only\n\na\n\n## Other\n\nb'), /steps/);
  assert.doesNotMatch(await jsx('## Step 1: A\n\na\n\n## Note\n\nb\n\n## Step 2: B\n\nc'), /steps/);
});

test('headings that only start like a step are not steps', async () => {
  assert.doesNotMatch(await jsx('## Steps to follow\n\na\n\n## Stepping up\n\nb'), /steps/);
  assert.doesNotMatch(await jsx('## Step one: A\n\na\n\n## Step two: B\n\nb'), /steps/);
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
  assert.doesNotMatch(await jsx('## Step 1: A\n\na\n\n## Step 2: B\n\nb', { stepper: false }), /steps/);
});

test('CommonMark (format md) pages get the stepper too', async () => {
  assert.equal(count(await jsx('## Step 1: A\n\na\n\n## Step 2: B\n\nb', {}, 'md'), /className="steps__step"/), 2);
});
