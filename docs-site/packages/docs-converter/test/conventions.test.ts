// The converter step that writes the explicit content components where a page follows a convention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeComponents } from '../src/conventions.js';

const write = (text: string, frontMatter: Record<string, unknown> = {}): string => writeComponents(text, { frontMatter }).text;

test('a run of "Step N:" headings becomes <Steps> around the run; each heading loses its prefix and keeps its old anchor as an explicit id', () => {
  assert.equal(
    write('Intro.\n\n## Step 1: Install\n\nDo a.\n\n## Step 2: Configure the server\n\nDo b.\n\n## After\n\nDone.\n'),
    'Intro.\n\n<Steps>\n\n## Install {/* #step-1-install */}\n\nDo a.\n\n## Configure the server {/* #step-2-configure-the-server */}\n\nDo b.\n\n</Steps>\n\n## After\n\nDone.\n',
  );
});

test('Step N.M headings inside a step become a nested <Steps>, closed at the next heading that is not a sub-step', () => {
  assert.equal(
    write('## Step 1: A\n\n### Step 1.1: Create a key vault\n\na\n\n### Step 1.2 - Set policies\n\nb\n\n### Notes\n\nn\n\n## Step 2: B\n\nc\n'),
    '<Steps>\n\n## A {/* #step-1-a */}\n\n<Steps>\n\n### Create a key vault {/* #step-11-create-a-key-vault */}\n\na\n\n### Set policies {/* #step-12---set-policies */}\n\nb\n\n</Steps>\n\n### Notes\n\nn\n\n## B {/* #step-2-b */}\n\nc\n\n</Steps>\n',
  );
});

test('Step Na headings inside a step are sub-steps too, the letter read as its place (a is 1)', () => {
  const { text, written } = writeComponents('## Step 7: TLS\n\n### Step 7a: Generate a CA\n\na\n\n### Step 7b - Sign\n\nb\n\n## Step 8: Done\n\nc\n');
  assert.equal(
    text,
    '<Steps start={7}>\n\n## TLS {/* #step-7-tls */}\n\n<Steps>\n\n### Generate a CA {/* #step-7a-generate-a-ca */}\n\na\n\n### Sign {/* #step-7b---sign */}\n\nb\n\n</Steps>\n\n## Done {/* #step-8-done */}\n\nc\n\n</Steps>\n',
  );
  assert.deepEqual(written, { steps: 2, subSteps: 2, prerequisites: 0, linkCards: 0, renumbered: 0 });
});

test('an em dash separates a step number from its title too', () => {
  assert.equal(
    write('### Step 1 — Install tools\n\na\n\n### Step 2 — Deploy\n\nb\n'),
    '<Steps>\n\n### Install tools {/* #step-1--install-tools */}\n\na\n\n### Deploy {/* #step-2--deploy */}\n\nb\n\n</Steps>\n',
  );
});

test('a run of Step N headings inside a step becomes its sub-steps', () => {
  const { text, written } = writeComponents('## Step 1: Prepare\n\np\n\n## Step 2: Configure\n\n### Step 1 - Install\n\na\n\n### Step 2 - Start\n\nb\n');
  assert.equal(
    text,
    '<Steps>\n\n## Prepare {/* #step-1-prepare */}\n\np\n\n## Configure {/* #step-2-configure */}\n\n<Steps>\n\n### Install {/* #step-1---install */}\n\na\n\n### Start {/* #step-2---start */}\n\nb\n\n</Steps>\n\n</Steps>\n',
  );
  assert.deepEqual(written, { steps: 2, subSteps: 2, prerequisites: 0, linkCards: 0, renumbered: 0 });
});

test('a run that does not start at 1 gets start; skipped numbers are renumbered and counted', () => {
  const { text, written } = writeComponents('### Step 0: Prepare\n\na\n\n### Step 1: Go\n\nb\n\n### Step 3: Skip\n\nc\n');
  assert.match(text, /^<Steps start=\{0\}>\n\n### Prepare \{\/\* #step-0-prepare \*\/\}/);
  assert.deepEqual(written, { steps: 3, subSteps: 0, prerequisites: 0, linkCards: 0, renumbered: 1 });
});

test('a bold step number goes with its separator; bold that runs past the prefix stays', () => {
  assert.match(write('### **Step 1**: Scan the QR code\n\na\n\n### **Step 2**: Generate a key\n\nb\n'), /### Scan the QR code \{\/\* #step-1-scan-the-qr-code \*\/\}/);
  assert.match(write('## **Step 1: Install** it\n\na\n\n## Step 2: Run\n\nb\n'), /## \*\*Step 1: Install\*\* it\n/);
});

test('a heading that already sets its id keeps it; repeated headings get the ids Docusaurus gave them', () => {
  const text = write('## Step 1: A {/* #mine */}\n\na\n\n## Step 2: B\n\nb\n\n## Step 1: A\n\nc\n\n## Step 2: B\n\nd\n');
  assert.match(text, /## A \{\/\* #mine \*\/\}\n/);
  assert.match(text, /## B \{\/\* #step-2-b \*\/\}[\s\S]*## A \{\/\* #step-1-a \*\/\}[\s\S]*## B \{\/\* #step-2-b-1 \*\/\}/);
});

test('a run inside an indented TabItem is wrapped at its indentation', () => {
  assert.equal(
    write('<Tabs>\n  <TabItem value="a" label="A">\n\n  ## Step 1: X\n\n  x\n\n  ## Step 2: Y\n\n  y\n\n  </TabItem>\n</Tabs>\n'),
    '<Tabs>\n  <TabItem value="a" label="A">\n\n  <Steps>\n\n  ## X {/* #step-1-x */}\n\n  x\n\n  ## Y {/* #step-2-y */}\n\n  y\n\n  </Steps>\n\n  </TabItem>\n</Tabs>\n',
  );
});

test('a lone Step heading, a run broken by another heading, and look-alikes stay as written', () => {
  for (const md of ['## Step 1: Only\n\na\n\n## Other\n\nb\n', '## Step 1: A\n\na\n\n## Note\n\nb\n\n## Step 2: B\n\nc\n', '## Steps to follow\n\na\n\n## Stepping up\n\nb\n', '## Step one: A\n\na\n\n## Step two: B\n\nb\n']) {
    assert.equal(write(md), md);
  }
});

test('the step runs again on its own output without changing it, and leaves explicit components alone', () => {
  const once = write('## Prerequisites\n\nNeed a.\n\n## Step 1: A\n\n:::note[Before you begin]\nx\n:::\n\n## Step 2: B\n\nb\n\n## See also\n\n- [Users](/u/)\n');
  assert.equal(write(once), once);
});

test('stepper: false, prerequisites: false and link_cards: false leave their convention as written', () => {
  const md = '## Prerequisites\n\nNeed a.\n\n## Step 1: A\n\na\n\n## Step 2: B\n\nb\n\n## See also\n\n- [Users](/u/)\n';
  assert.doesNotMatch(write(md, { stepper: false }), /<Steps>/);
  assert.doesNotMatch(write(md, { prerequisites: false }), /<Prerequisites>/);
  assert.doesNotMatch(write(md, { link_cards: false }), /<LinkCards>/);
  assert.match(write(md, { stepper: false }), /<Prerequisites>[\s\S]*<LinkCards>/);
});

// docs-is 5.x setup/setting-up-separate-databases-for-clustering.md as converted before nested admonitions got longer
// fences: the tip is left open, so a panel written around it would not parse.
test('a convention whose components would not parse is left as written', () => {
  const src = ':::warning[H2]\n\nNot for production.\n\n:::tip[Before you begin]\n\nOptional.\n\n:::\n\n:::\n\nAfter.\n';
  assert.equal(writeComponents(src).text, src);
});
