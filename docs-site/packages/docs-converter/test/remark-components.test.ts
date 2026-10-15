// The site renders the explicit content components (<Steps>, <Prerequisites>, <LinkCards>) a page writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsx, count, cards } from './site-compile.js';

test('<Steps> makes each heading at its first heading level a numbered step holding its content', async () => {
  const js = await jsx('Intro.\n\n<Steps>\n\n## Install\n\nDo a.\n\n### Details\n\nmore\n\n## Run\n\nDo b.\n\n</Steps>\n\n## After\n\nDone.');
  assert.equal(count(js, /className="steps"/), 1);
  assert.equal(count(js, /className="steps__step"/), 2);
  assert.match(js, /<_components\.div className="steps"><_components\.div className="steps__step" data-step="1"><_components\.h2 id="install"><_components\.span className="steps__prefix">\{"Step 1: "\}<\/_components\.span>\{"Install"\}<\/_components\.h2>/);
  assert.match(js, /id="details"[\s\S]*more[\s\S]*<\/_components\.div><_components\.div className="steps__step" data-step="2"><_components\.h2 id="run">/);
  assert.match(js, /Do b\."\}<\/_components\.p><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.h2 id="after">/);
});

test('a step heading keeps its id, and its TOC entry reads "Step N: …" as before', async () => {
  const js = await jsx('<Steps>\n\n## Install\n\na\n\n## Run\n\nb\n\n</Steps>');
  assert.match(js, /"value": "Step 1: Install",\s*"id": "install"/);
  assert.match(js, /"value": "Step 2: Run",\s*"id": "run"/);
});

test('start sets the first number (start={0}, start="3")', async () => {
  assert.deepEqual([...(await jsx('<Steps start={0}>\n\n### A\n\na\n\n### B\n\nb\n\n</Steps>')).matchAll(/data-step="(\d+)"/g)].map((m) => m[1]), ['0', '1']);
  assert.deepEqual([...(await jsx('<Steps start="3">\n\n### A\n\na\n\n</Steps>')).matchAll(/data-step="(\d+)"/g)].map((m) => m[1]), ['3']);
});

test('a <Steps> inside a step makes sub-steps numbered from the parent, with the badge; text after it stays in the parent step', async () => {
  const js = await jsx('<Steps>\n\n## A\n\n<Steps>\n\n### Create a key vault\n\na\n\n### Set policies\n\nb\n\n</Steps>\n\nAfter.\n\n## B\n\nc\n\n</Steps>');
  assert.equal(count(js, /className="steps__step"/), 2, 'sub-steps do not become steps');
  assert.equal(count(js, /className="steps"/), 1);
  assert.match(js, /<_components\.h3 id="create-a-key-vault" className="steps__substep" data-substep="1\.1"><_components\.span className="steps__prefix">\{"Step 1\.1: "\}<\/_components\.span>\{"Create a key vault"\}<\/_components\.h3>/);
  assert.match(js, /id="set-policies" className="steps__substep" data-substep="1\.2">/);
  assert.match(js, /After\.[\s\S]*<\/_components\.div><_components\.div className="steps__step" data-step="2">/);
  assert.match(js, /"value": "Step 1\.1: Create a key vault",\s*"id": "create-a-key-vault"/);
});

test('a partial placed inside a step is held in a block naming the step, so its own steps show as sub-steps', async () => {
  const js = await jsx("import Deploy from '../_partials/deploy/steps.mdx';\nimport Other from './other.mdx';\n\n<Steps>\n\n## Prepare\n\np\n\n## Configure\n\n<Deploy />\n\n<Other />\n\n</Steps>\n\n<Deploy />");
  assert.match(js, /<_components\.div className="steps__step" data-step="2">[\s\S]*<_components\.div className="steps__nested" data-parent="2" style=\{\{\s*counterReset: "steps-parent 2"\s*\}\}><Deploy \/><\/_components\.div>/);
  assert.equal(count(js, /className="steps__nested"/), 1, 'only a partial, only inside a step');
});

test('a <Steps> nested below a sub-step only groups its content: no more numbers', async () => {
  const js = await jsx('<Steps>\n\n## A\n\n<Steps>\n\n### S\n\n<Steps>\n\n#### Deep\n\nd\n\n</Steps>\n\n</Steps>\n\n</Steps>');
  assert.match(js, /<_components\.h4 id="deep">\{"Deep"\}<\/_components\.h4>/);
  assert.doesNotMatch(js, /<Steps|_missingMdxReference\("Steps"/);
});

test('{/* #id */} on a step heading sets its id; the TOC entry keeps that id', async () => {
  const js = await jsx('<Steps>\n\n## Configure Azure {/* #step-1-configure-azure */}\n\na\n\n## Go\n\nb\n\n</Steps>');
  assert.match(js, /<_components\.h2 id="step-1-configure-azure"><_components\.span className="steps__prefix">\{"Step 1: "\}<\/_components\.span>\{"Configure Azure"\}<\/_components\.h2>/);
  assert.match(js, /"value": "Step 1: Configure Azure",\s*"id": "step-1-configure-azure"/);
});

test('<Steps> inside a JSX block (Applies, TabItem) renders inside that block', async () => {
  const js = await jsx('<Applies to="Self-hosted">\n\n<Steps>\n\n## A\n\na\n\n## B\n\nb\n\n</Steps>\n\n</Applies>');
  assert.match(js, /<Applies to="Self-hosted"><_components\.div className="steps">/);
});

test('<Prerequisites> around a heading is a panel: the heading (id and TOC entry kept) as its title, the rest as the body', async () => {
  const js = await jsx('<Prerequisites>\n\n## Prerequisites\n\n- An account.\n\n</Prerequisites>\n\n## Configure\n\nDo it.');
  assert.match(js, /<_components\.div className="prerequisites"><_components\.div className="prerequisites__head"><_components\.h2 id="prerequisites">\{"Prerequisites"\}<\/_components\.h2><\/_components\.div><_components\.div className="prerequisites__body"><_components\.ul>[\s\S]*An account\.[\s\S]*<\/_components\.ul><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.h2 id="configure">/);
  assert.match(js, /"value": "Prerequisites",\s*"id": "prerequisites"/);
});

test('<Prerequisites title="…"> has no heading: the title heads the panel, outside the TOC', async () => {
  const js = await jsx('<Prerequisites title="Before you begin">\n\n- An account.\n\n</Prerequisites>\n\nNext.');
  assert.match(js, /<_components\.div className="prerequisites"><_components\.div className="prerequisites__head"><_components\.p className="prerequisites__title">\{"Before you begin"\}<\/_components\.p><\/_components\.div><_components\.div className="prerequisites__body"><_components\.ul>[\s\S]*<\/_components\.ul><\/_components\.div><\/_components\.div>\{"\\n"\}<_components\.p>\{"Next\."\}/);
  assert.match(js, /export const toc = \[\]/);
});

test('<Prerequisites> inside a step stays in that step', async () => {
  const js = await jsx('<Steps>\n\n## A\n\n<Prerequisites title="Before you begin">\n\nNeed a.\n\n</Prerequisites>\n\n## B\n\nb\n\n</Steps>');
  assert.match(js, /className="steps__step" data-step="1">[\s\S]*className="prerequisites"[\s\S]*data-step="2"/);
});

test('<LinkCards> passes each item of the list it wraps as a card: href (as Docusaurus resolves it), link text, and the writer\'s text after the link', async () => {
  const found = await cards("## What's next?\n\n<LinkCards>\n\n- [Users](./users.md) - Manage the users of an organization.\n- [Apps](https://example.org/apps)\n\n</LinkCards>\n");
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].items, [
    { href: '/identity/guides/users/', title: 'Users', text: 'Manage the users of an organization.' },
    { href: 'https://example.org/apps', title: 'Apps' },
  ]);
  assert.equal(found[0].children.filter((c) => c && typeof c === 'object').map((c) => c.type).join(), 'ul', 'the list stays as the fallback');
});

test("the writer's text after the link: a leading dash, en dash, em dash or colon is dropped; formatting is kept as text", async () => {
  const [found] = await cards('<LinkCards>\n\n- [A](/a/) - one.\n- [B](/b/) – two.\n- [C](/c/) — three.\n- [D](/d/): four.\n- [E](/e/)\n- [F](/f/) for **bold** and `code`.\n- [`G` api](/g/)  \n  on a second line.\n\n</LinkCards>');
  assert.deepEqual(found.items.map((i) => [i.title, i.text]), [
    ['A', 'one.'], ['B', 'two.'], ['C', 'three.'], ['D', 'four.'], ['E', undefined], ['F', 'for bold and code.'], ['G api', 'on a second line.'],
  ]);
});

test('<LinkCards> around anything but a list of links gets no items, so the component shows what it wraps', async () => {
  for (const body of ['Read [Users](/u/) next.', '- [Users](/u/)\n- Learn about [apps](/a/).', '- [Users](/u/)\n  - [Roles](/r/)']) {
    const [found] = await cards(`<LinkCards>\n\n${body}\n\n</LinkCards>`);
    assert.equal(found.items, undefined, body);
  }
});

test('link text and the writer\'s text with quotes, braces and markup reach the component as data, never as code', async () => {
  const [found] = await cards('<LinkCards>\n\n- [a "b" \\{c\\} \\</script>](/a/?q=1&r="2") - `${x}` \\{y\\} "); alert(1); ("\n\n</LinkCards>');
  assert.deepEqual(found.items, [{ href: '/a/?q=1&r="2"', title: 'a "b" {c} </script>', text: '${x} {y} "); alert(1); ("' }]);
});
