// Link cards: the items of a Markdown list of links, as the site's LinkCards component takes them. Shared by the site's
// rendering of <LinkCards> (remark-components.ts) and the converter step that wraps closing sections (conventions.ts).
import type { List, ListItem, PhrasingContent, RootContent } from 'mdast';

/** One card: where it goes, the writer's link text, and the writer's own text after the link, if any. */
export interface LinkCard { href: string; title: string; text?: string }

/** A dash, en dash, em dash or colon (and spaces) between the link and the writer's text. */
const LEAD = /^\s*[-–—:]\s*/;

const text = (node: RootContent | PhrasingContent): string =>
  'value' in node ? String(node.value) : 'children' in node ? (node.children as PhrasingContent[]).map(text).join('') : '';

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

const hasList = (node: RootContent): boolean =>
  node.type === 'list' || ('children' in node && (node.children as RootContent[]).some(hasList));

/** An item's card, or null when the item does not start with a link or holds a nested list. */
export function cardOf(item: ListItem): LinkCard | null {
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

/** The cards of a list, or null unless every item is a card. */
export function cardsOfList(list: List): LinkCard[] | null {
  const items = list.children.map(cardOf);
  return items.length && items.every(Boolean) ? (items as LinkCard[]) : null;
}
