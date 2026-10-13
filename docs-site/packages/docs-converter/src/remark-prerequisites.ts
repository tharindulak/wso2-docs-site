// Prerequisites blocks render as a panel where they are written, without author changes (about 180 Identity pages
// write one). Two source forms: an h2/h3 titled "Prerequisites" or "Before you begin", whose block runs to the next
// heading at its level or above, or to a stepper; and an admonition of any type with that title. Both become the same
// panel, titled with the author's own text: the heading stays as it is (its id and TOC entry are set before the plugin
// runs), and an admonition's type is dropped. Runs in the site build after remark-steps, so a stepper (a `steps` node)
// ends the block. A page opts out with `prerequisites: false` in front matter. Styles: .prerequisites in the site CSS.
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';

/** "Prerequisites" or "Before you begin", in any case; a trailing "!" too (88 docs-is admonitions write one). */
const TITLE = /^(prerequisites|before you begin)!?$/i;

const text = (node: RootContent | PhrasingContent): string =>
  'value' in node ? String(node.value) : 'children' in node ? (node.children as PhrasingContent[]).map(text).join('') : '';

const depthOf = (node: RootContent): number => (node.type === 'heading' ? node.depth : 0);

/** remark-steps' stepper, which ends a block whatever the level of its Step headings. */
const isStepper = (node: RootContent): boolean => node.type === ('steps' as string);

/** Where a heading's block ends: the next heading at its level or above, or a stepper. */
const ends = (node: RootContent, depth: number): boolean => isStepper(node) || (depthOf(node) > 0 && depthOf(node) <= depth);

/** A block that renders as `<div>` with the given class; mdast-util-to-hast reads `data.hName` for unknown nodes. */
const block = (className: string, children: RootContent[]): RootContent =>
  ({ type: 'prerequisites', children, data: { hName: 'div', hProperties: { className: [className] } } }) as unknown as RootContent;

const panel = (title: RootContent, body: RootContent[]): RootContent =>
  block('prerequisites', [block('prerequisites__head', [title]), block('prerequisites__body', body)]);

/**
 * The title of a Docusaurus admonition, as its admonitions plugin leaves it before the site's plugins run: a
 * `containerDirective` with `data.hName` "admonition", and the title in `hProperties.title` when it is plain text, or
 * else in a leading `mdxAdmonitionTitle` child (mdx-loader lib/remark/admonitions).
 */
function admonitionTitle(node: RootContent): { title: PhrasingContent[]; body: RootContent[] } | null {
  if (node.type !== 'containerDirective' || node.data?.hName !== 'admonition') return null;
  const plain = (node.data.hProperties as { title?: unknown } | undefined)?.title;
  const [first, ...rest] = node.children as RootContent[];
  if (typeof plain === 'string') return { title: [{ type: 'text', value: plain.trim() }], body: node.children as RootContent[] };
  if (first?.type === ('mdxAdmonitionTitle' as string)) return { title: (first as unknown as Parent).children as PhrasingContent[], body: rest };
  return null;
}

/** An admonition's title becomes a paragraph in the panel head; the title is checked as text, as for headings. */
function fromAdmonition(node: RootContent): RootContent | null {
  const found = admonitionTitle(node);
  if (!found || !TITLE.test(found.title.map(text).join('').trim())) return null;
  const title = { type: 'paragraph', children: found.title, data: { hProperties: { className: ['prerequisites__title'] } } } as RootContent;
  return panel(title, found.body);
}

/** Wraps each block in `children`. */
function wrapBlocks(children: RootContent[]): RootContent[] {
  const out: RootContent[] = [];
  let i = 0;
  while (i < children.length) {
    const node = children[i++];
    const admonition = fromAdmonition(node);
    if (admonition) { out.push(admonition); continue; }
    const depth = depthOf(node);
    if ((depth !== 2 && depth !== 3) || !TITLE.test(text(node).trim())) { out.push(node); continue; }
    const start = i;
    while (i < children.length && !ends(children[i], depth)) i++;
    if (i === start) out.push(node); // nothing to box
    else out.push(panel(node, children.slice(start, i)));
  }
  return out;
}

/** Wraps blocks at every level (the page, JSX blocks such as Applies, steps); a panel's content is left alone. */
function visit(node: Root | RootContent): void {
  if (!('children' in node) || node.type === ('prerequisites' as string)) return;
  const parent = node as Parent;
  parent.children = wrapBlocks(parent.children as RootContent[]);
  for (const child of parent.children) visit(child as RootContent);
}

export default function remarkPrerequisites() {
  // Docusaurus puts the page's front matter on the file it compiles (mdx-loader processor.js).
  return (tree: Root, file: { data: object }): void => {
    if ((file.data as { frontMatter?: { prerequisites?: unknown } }).frontMatter?.prerequisites === false) return;
    visit(tree);
  };
}
