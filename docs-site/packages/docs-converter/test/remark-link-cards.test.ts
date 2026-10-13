import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, run } from '@mdx-js/mdx';
import remarkDirective from 'remark-directive';
import rehypeRaw from 'rehype-raw';
// Docusaurus's own remark plugins, in the order mdx-loader runs them before the site's remarkPlugins.
import * as admonitions from '@docusaurus/mdx-loader/lib/remark/admonitions/index.js';
import * as headings from '@docusaurus/mdx-loader/lib/remark/headings/index.js';
import * as toc from '@docusaurus/mdx-loader/lib/remark/toc/index.js';
import * as resolveMarkdownLinks from '@docusaurus/mdx-loader/lib/remark/resolveMarkdownLinks/index.js';
import remarkSteps from '../src/remark-steps.js';
import remarkPrerequisites from '../src/remark-prerequisites.js';
import remarkLinkCards from '../src/remark-link-cards.js';

/** A CommonJS module's default export, as Node hands it to an ES module. */
const cjs = (m: object): never => { const d = (m as { default: { default?: unknown } }).default; return (d.default ?? d) as never; };

/** Docusaurus rewrites links to Markdown files to the target's permalink before the site's plugins run. */
const PERMALINKS: Record<string, string> = { './users.md': '/identity/guides/users/', '../apps/index.md': '/identity/guides/apps/' };
const resolve = { resolveMarkdownLink: ({ linkPathname }: { linkPathname: string }) => PERMALINKS[linkPathname] ?? null, onBrokenMarkdownLinks: () => undefined };

type Format = 'mdx' | 'md';
const options = (format: Format) => ({
  format,
  remarkPlugins: [remarkDirective, cjs(admonitions), [cjs(headings), { anchorsMaintainCase: false }], cjs(toc), [cjs(resolveMarkdownLinks), resolve],
    remarkSteps, remarkPrerequisites, remarkLinkCards] as never,
  // CommonMark pages: mdx-loader parses raw HTML with rehype-raw and passes MDX nodes (such as LinkCards) through.
  rehypePlugins: (format === 'md' ? [[rehypeRaw, { passThrough: ['mdxFlowExpression', 'mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxTextExpression', 'mdxjsEsm'] }]] : []) as never,
});

/** The page's JSX source, as the docs site would compile it. */
const jsx = async (value: string, frontMatter: Record<string, unknown> = {}, format: Format = 'mdx'): Promise<string> =>
  String(await compile({ value, path: '/docs/identity/guides/page.md', data: { frontMatter } }, { ...options(format), jsx: true }));

interface El { type: unknown; props: { children?: unknown; [k: string]: unknown } }
interface Card { href: string; title: string; text?: string }

/** Runs the compiled page with a runtime that records elements, and returns each LinkCards element's props. */
async function cards(value: string, frontMatter: Record<string, unknown> = {}, format: Format = 'mdx'): Promise<{ items: Card[]; children: El[] }[]> {
  const code = String(await compile({ value, path: '/docs/identity/guides/page.md', data: { frontMatter } }, { ...options(format), outputFormat: 'function-body' }));
  const el = (type: unknown, props: El['props']): El => ({ type, props });
  const { default: Content } = await run(code, { Fragment: 'fragment', jsx: el, jsxs: el, baseUrl: import.meta.url } as never);
  const LinkCards = (): null => null;
  const pass = (): null => null;
  const tree = (Content as (p: object) => El)({ components: { LinkCards, Applies: pass, Tabs: pass, TabItem: pass } });
  const found: { items: Card[]; children: El[] }[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object' || !('props' in n)) return;
    const e = n as El;
    if (e.type === LinkCards) found.push({ items: e.props.items as Card[], children: [e.props.children].flat() as El[] });
    walk(e.props.children);
  };
  walk(tree);
  return found;
}

test('a "What\'s next?" section that is a list of links becomes LinkCards: href, link text and author text per item, the list kept as its children', async () => {
  const found = await cards("Intro.\n\n## What's next?\n\n- [Users](./users.md) - Manage the users of an organization.\n- [Apps](https://example.org/apps)\n");
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].items, [
    { href: '/identity/guides/users/', title: 'Users', text: 'Manage the users of an organization.' },
    { href: 'https://example.org/apps', title: 'Apps' },
  ]);
  assert.equal(found[0].children.filter((c) => c && typeof c === 'object').map((c) => c.type).join(), 'ul');
});

const LIST = '- [Users](/identity/guides/users/)\n- [Apps](/identity/guides/apps/)\n';
const count = async (md: string, fm: Record<string, unknown> = {}, format: Format = 'mdx'): Promise<number> => (await cards(md, fm, format)).length;

test('every closing title at h2 and h3, in any case, with straight or curly apostrophes, is a closing section; other titles are not', async () => {
  const titles = ["What's next", "What's next?", 'What’s next?', 'Whats next', "WHAT'S NEXT?", 'Next steps', 'Next Steps', 'See also',
    'Learn more', 'Learn More', 'Related topics', 'Related links', 'Further reading'];
  for (const t of titles) for (const h of ['##', '###']) assert.equal(await count(`${h} ${t}\n\n${LIST}`), 1, `${h} ${t}`);
  for (const h of ['# Next steps', '#### Next steps', '## Next steps to take', '## Related', "## What's next for SCIM", '## Overview'])
    assert.equal(await count(`${h}\n\n${LIST}`), 0, h);
});

test('the heading keeps its id and its TOC entry, outside the cards', async () => {
  const js = await jsx(`## What's next?\n\n${LIST}`);
  assert.match(js, /export const toc = \[\{\s*"value": "What&#39;s next\?",\s*"id": "whats-next",\s*"level": 2\s*\}\]/);
  assert.match(js, /<_components\.h2 id="whats-next">\{"What's next\?"\}<\/_components\.h2>\{"\\n"\}<LinkCards items=/);
});

test('a section runs to the next heading at its level or above; a deeper heading ends nothing and makes it more than a list', async () => {
  assert.equal(await count(`### See also\n\n${LIST}\n## Then\n\nProse.`), 1, 'ends at a higher heading');
  assert.equal(await count(`## See also\n\n${LIST}\n## Then\n\nProse.`), 1, 'ends at a heading at its level');
  assert.equal(await count(`## See also\n\n${LIST}\n### More\n\nProse.`), 0, 'a sub-heading is part of the section');
});

test('prose, several blocks, nested lists and items that do not start with a link stay as written', async () => {
  const left = [
    'Read [Users](/u/) next.',
    `Some intro.\n\n${LIST}`,
    `${LIST}\nAnd a closing line.`,
    '- [Users](/u/)\n  - [Roles](/r/)\n- [Apps](/a/)',
    '- [Users](/u/)\n- Learn about [apps](/a/).',
    '- **Note:** [Users](/u/)',
    ':::note\n[Users](/u/)\n:::',
    '1. Create a keystore as in [Keystores](/k/).\n2. Import it.',
  ];
  for (const body of left) {
    const md = `## Next steps\n\n${body}\n`;
    assert.equal(await count(md), 0, body);
    assert.doesNotMatch(await jsx(md), /LinkCards/, body);
  }
});

test('an ordered list of links becomes cards too, and a paragraph item ("loose" list) counts', async () => {
  assert.equal(await count('## Next steps\n\n1. [Users](/u/)\n2. [Apps](/a/)\n'), 1);
  assert.equal(await count('## Next steps\n\n- [Users](/u/)\n\n- [Apps](/a/)\n'), 1);
});

test("the author's text after the link is the description: a leading dash, en dash, em dash or colon is dropped; formatting is kept as text", async () => {
  const [found] = await cards('## See also\n\n- [A](/a/) - one.\n- [B](/b/) – two.\n- [C](/c/) — three.\n- [D](/d/): four.\n- [E](/e/)\n- [F](/f/) for **bold** and `code`.\n- [`G` api](/g/)  \n  on a second line.\n');
  assert.deepEqual(found.items.map((i) => [i.title, i.text]), [
    ['A', 'one.'], ['B', 'two.'], ['C', 'three.'], ['D', 'four.'], ['E', undefined], ['F', 'for bold and code.'], ['G api', 'on a second line.'],
  ]);
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

test('a partial (a file with no front matter of its own) gets cards', async () => {
  assert.equal(await count(`## See also\n\n${LIST}`, {}), 1);
});

test('several closing sections on a page each become their own cards', async () => {
  assert.equal(await count(`## Use it\n\n### Learn more\n\n${LIST}\n## Next steps\n\n${LIST}`), 2);
});

test('a section inside a step of a stepper becomes cards, and the stepper stays', async () => {
  const js = await jsx(`## Step 1: A\n\na\n\n## Step 2: B\n\nb\n\n### Next steps\n\n${LIST}`);
  assert.match(js, /className="steps__step" data-step="2">[\s\S]*<LinkCards items=/);
});

test('front matter link_cards: false leaves the page as written', async () => {
  assert.equal(await count(`## See also\n\n${LIST}`, { link_cards: false }), 0);
});

test('CommonMark (format md) pages get the cards too', async () => {
  const found = await cards(`<div>raw</div>\n\n## See also\n\n- [Users](/u/) - Manage users.\n`, {}, 'md');
  assert.deepEqual(found[0]?.items, [{ href: '/u/', title: 'Users', text: 'Manage users.' }]);
});

test('link text and author text with quotes, braces and markup reach the component as data, never as code', async () => {
  const [found] = await cards('## See also\n\n- [a "b" \\{c\\} \\</script>](/a/?q=1&r="2") - `${x}` \\{y\\} "); alert(1); ("\n');
  assert.deepEqual(found.items, [{ href: '/a/?q=1&r="2"', title: 'a "b" {c} </script>', text: '${x} {y} "); alert(1); ("' }]);
});
