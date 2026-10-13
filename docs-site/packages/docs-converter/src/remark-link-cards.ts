// Closing sections ("What's next", "See also", ...) that are a list of links render as cards, without author changes.
// A section is an h2/h3 with one of the closing titles; it runs to the next heading at its level or above. Only a
// section that is exactly one list, whose items each start with a link and hold no nested list, is changed: the list
// is wrapped in `<LinkCards>` and stays as its children (the fallback), and each item's href, link text (the card
// title) and the author's text after the link (the description, leading dash or colon dropped) are passed as the
// `items` prop. Anything else stays as written. The heading stays as it is (its id and TOC entry are set before the
// plugin runs). Runs in the site build after Docusaurus has rewritten `.md` links to permalinks; the site's LinkCards
// component looks up descriptions for internal links without author text. A page opts out with `link_cards: false`
// in front matter. Styles: .link-cards in the site CSS.
import type { List, ListItem, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';

/** "What's next" (with or without "?", straight or curly apostrophe) and the other closing titles, in any case. */
const TITLE = /^(what['’]?s next\??|next steps|see also|learn more|related topics|related links|further reading)$/i;

/** A dash, en dash, em dash or colon (and spaces) between the link and the author's text. */
const LEAD = /^\s*[-–—:]\s*/;

const text = (node: RootContent | PhrasingContent): string =>
  'value' in node ? String(node.value) : 'children' in node ? (node.children as PhrasingContent[]).map(text).join('') : '';

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

const depthOf = (node: RootContent): number => (node.type === 'heading' ? node.depth : 0);

/** One card: where it goes, the author's link text, and the author's own text after the link, if any. */
export interface LinkCard { href: string; title: string; text?: string }

const hasList = (node: RootContent): boolean =>
  node.type === 'list' || ('children' in node && (node.children as RootContent[]).some(hasList));

/** An item's card, or null when the item does not start with a link or holds a nested list. */
function cardOf(item: ListItem): LinkCard | null {
  const [first, ...more] = item.children as RootContent[];
  if (first?.type !== 'paragraph' || (item.children as RootContent[]).some(hasList)) return null;
  const phrasing = first.children.filter((n, k) => !(k === 0 && n.type === 'text' && !n.value.trim()));
  const [link, ...after] = phrasing;
  if (link?.type !== 'link') return null;
  const title = squash(text(link));
  if (!title || !link.url) return null;
  const rest = squash([after.map(text).join(''), ...more.map(text)].join(' ')).replace(LEAD, '').trim();
  return { href: link.url, title, ...(rest ? { text: rest } : {}) };
}

/** Nodes that render nothing: ESM (the TOC export Docusaurus appends to the page) and MDX comments. */
const silent = (node: RootContent): boolean =>
  node.type === 'mdxjsEsm' || (node.type === 'mdxFlowExpression' && /^\s*\/\*[\s\S]*\*\/\s*$/.test(node.value));

/** The section's list and its cards, when the section is exactly one list of link items; else null. */
function cardsOf(body: RootContent[]): { list: List; items: LinkCard[] } | null {
  const content = body.filter((n) => !silent(n));
  if (content.length !== 1 || content[0].type !== 'list') return null;
  const list = content[0];
  const items = list.children.map(cardOf);
  return items.length && items.every(Boolean) ? { list, items: items as LinkCard[] } : null;
}

/** A JSON value as an estree expression, so the attribute carries data without any code built from strings. */
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
function estree(value: Json): object {
  if (Array.isArray(value)) return { type: 'ArrayExpression', elements: value.map(estree) };
  if (value && typeof value === 'object') {
    return {
      type: 'ObjectExpression',
      properties: Object.entries(value).map(([k, v]) => ({
        type: 'Property', kind: 'init', key: { type: 'Literal', value: k }, value: estree(v), method: false, shorthand: false, computed: false,
      })),
    };
  }
  return { type: 'Literal', value };
}

/** `<LinkCards items={[...]}>` around the list; the list stays as children for when the cards cannot render. */
function linkCards(list: RootContent, items: LinkCard[]): MdxJsxFlowElement {
  const program = { type: 'Program', sourceType: 'module', body: [{ type: 'ExpressionStatement', expression: estree(items as unknown as Json) }] };
  return {
    type: 'mdxJsxFlowElement',
    name: 'LinkCards',
    attributes: [{ type: 'mdxJsxAttribute', name: 'items', value: { type: 'mdxJsxAttributeValueExpression', value: JSON.stringify(items), data: { estree: program as never } } }],
    children: [list as MdxJsxFlowElement['children'][number]],
  };
}

/** Wraps the list of each closing section in `children` that qualifies; other nodes stay as they are. */
function wrapSections(children: RootContent[]): RootContent[] {
  const out: RootContent[] = [];
  let i = 0;
  while (i < children.length) {
    const node = children[i++];
    out.push(node);
    const depth = depthOf(node);
    if ((depth !== 2 && depth !== 3) || !TITLE.test(squash(text(node)))) continue;
    const start = i;
    while (i < children.length && !(depthOf(children[i]) && depthOf(children[i]) <= depth)) i++;
    const body = children.slice(start, i);
    const found = cardsOf(body);
    out.push(...(found ? body.map((n) => (n === found.list ? (linkCards(n, found.items) as RootContent) : n)) : body));
  }
  return out;
}

/** Wraps sections at every level (the page, JSX blocks such as Applies, steps, panels); cards are left alone. */
function visit(node: Root | RootContent): void {
  if (!('children' in node) || (node.type === 'mdxJsxFlowElement' && node.name === 'LinkCards')) return;
  const parent = node as Parent;
  parent.children = wrapSections(parent.children as RootContent[]);
  for (const child of parent.children) visit(child as RootContent);
}

export default function remarkLinkCards() {
  // Docusaurus puts the page's front matter on the file it compiles (mdx-loader processor.js).
  return (tree: Root, file: { data: object }): void => {
    if ((file.data as { frontMatter?: { link_cards?: unknown } }).frontMatter?.link_cards === false) return;
    visit(tree);
  };
}
