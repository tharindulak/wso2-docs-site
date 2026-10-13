// Linked tabs: `<Tabs>` blocks offering the same choices switch together, as on MkDocs with `content.tabs.link`.
// The converter writes positional values (`tab-1`, `tab-2`), so nothing links by default. Each such block gets a
// `groupId` from its normalised, sorted labels, and each tab the normalised label as its value; Docusaurus keeps the
// reader's choice per group in localStorage (`docusaurus.tab.<groupId>`). Runs in the site build over the JSX, so it
// does not depend on converter output.
import { createHash } from 'node:crypto';
import type { Root, RootContent } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';

/** A label's value: lower case, letters and digits joined by single dashes. Markdown marks and spaces drop out. */
const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Labels that name one choice, by slug. Add a pair only when two real sets should link and do not; typos are fixed in
 * the source instead.
 */
const ALIASES: Record<string, string> = { 'macos-linux': 'linux', 'linux-macos': 'linux', 'linux-unix': 'linux' };

/** Cuts an id to `max` characters; a cut id ends in a hash of the whole, so ids that differ past the cut stay distinct. */
const bounded = (id: string, max: number): string =>
  id.length <= max ? id : `${id.slice(0, max - 9).replace(/[-_]+$/, '')}-${createHash('sha256').update(id).digest('hex').slice(0, 8)}`;

const valueOf = (label: string): string => bounded(ALIASES[slug(label)] ?? slug(label), 64);

const attr = (el: MdxJsxFlowElement, name: string) => el.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === name);

const setAttr = (el: MdxJsxFlowElement, name: string, value: string): void => {
  const existing = attr(el, name);
  if (existing) existing.value = value;
  else el.attributes.push({ type: 'mdxJsxAttribute', name, value });
};

/** Tabs props that mean the author chose values or a group: such a block is left as written. */
const AUTHORED = new Set(['groupId', 'defaultValue', 'values', 'queryString']);

/** `tab-1`, `tab-2`: the positional values the converter writes. */
const POSITIONAL = /^tab-\d+$/;

/**
 * The value of each tab when the block can link, else null: tabs only, at least two, positional values, plain-text
 * labels, and no two labels naming one choice (Docusaurus needs distinct values).
 */
function linkedValues(tabs: MdxJsxFlowElement): string[] | null {
  if (tabs.attributes.some((a) => a.type !== 'mdxJsxAttribute' || AUTHORED.has(a.name))) return null;
  const items = tabs.children;
  if (items.length < 2) return null;
  const values: string[] = [];
  for (const item of items) {
    if (item.type !== 'mdxJsxFlowElement' || item.name !== 'TabItem') return null;
    const value = attr(item, 'value')?.value;
    const label = attr(item, 'label')?.value;
    if (typeof value !== 'string' || !POSITIONAL.test(value) || typeof label !== 'string') return null;
    values.push(valueOf(label));
  }
  return values.every(Boolean) && new Set(values).size === values.length ? values : null;
}

function link(tabs: MdxJsxFlowElement): void {
  const values = linkedValues(tabs);
  if (!values) return;
  tabs.children.forEach((item, k) => setAttr(item as MdxJsxFlowElement, 'value', values[k]));
  // Values hold no `_`, so the sorted values joined by `_` name the set; Docusaurus stores the choice under this key.
  setAttr(tabs, 'groupId', bounded([...values].sort().join('_'), 100));
}

function visit(node: Root | RootContent): void {
  if (node.type === 'mdxJsxFlowElement' && node.name === 'Tabs') link(node);
  if ('children' in node) for (const child of node.children) visit(child as RootContent);
}

export default function remarkLinkedTabs() {
  return (tree: Root): void => visit(tree);
}
