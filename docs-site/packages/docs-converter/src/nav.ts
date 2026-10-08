// MkDocs `nav:` -> Docusaurus sidebar items, and merging two navs (cloud + self-hosted) into one tree.
import type { MkdocsNav, SidebarItem } from './types.js';

const docId = (p: string): string => p.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\.mdx?$/, '');
const isUrl = (p: string): boolean => /^[a-z]+:\/\//i.test(p) || p.startsWith('mailto:');

/**
 * Convert an MkDocs nav to sidebar items. Entries whose page is not `known` are dropped and reported.
 * @param known whether a doc id exists in the generated docs
 */
export function navToSidebar(nav: MkdocsNav | undefined, known: (id: string) => boolean, dropped: string[] = []): SidebarItem[] {
  const items: SidebarItem[] = [];
  for (const entry of nav ?? []) {
    if (typeof entry === 'string') {
      if (isUrl(entry)) continue;
      const id = docId(entry);
      if (known(id)) items.push({ type: 'doc', id });
      else dropped.push(entry);
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    for (const [label, value] of Object.entries(entry)) {
      if (!String(label).trim()) continue; // MkDocs: an empty title keeps a page out of the menu
      if (typeof value === 'string') {
        if (isUrl(value)) { items.push({ type: 'link', label, href: value }); continue; }
        const id = docId(value);
        if (known(id)) items.push({ type: 'doc', id, label });
        else dropped.push(value);
      } else if (Array.isArray(value)) {
        const children = navToSidebar(value as MkdocsNav, known, dropped);
        if (!children.length) continue;
        // MkDocs Material "section index": a leading index page becomes the category's own page.
        const [first, ...rest] = children;
        if (first!.type === 'doc' && /(^|\/)index$/.test(first!.id ?? '') && rest.length) {
          items.push({ type: 'category', label, link: { type: 'doc', id: first!.id! }, items: rest });
        } else {
          items.push({ type: 'category', label, items: children });
        }
      }
    }
  }
  return items;
}

const keyOf = (item: SidebarItem): string => (item.type === 'doc' ? `doc:${item.id}` : `${item.type}:${(item.label ?? '').trim().toLowerCase()}`);

/**
 * Merge `extra` into `base`: matching docs and same-label categories merge; items only in `extra`
 * are inserted after the nearest preceding item they share with `base`.
 */
export function mergeSidebars(base: SidebarItem[], extra: SidebarItem[]): SidebarItem[] {
  const out = base.map((i) => ({ ...i, ...(i.items ? { items: [...i.items] } : {}) }));
  let anchor = -1;
  for (const item of extra) {
    const at = out.findIndex((o) => keyOf(o) === keyOf(item));
    if (at >= 0) {
      const existing = out[at]!;
      if (item.type === 'category' && existing.type === 'category') {
        out[at] = { ...existing, items: mergeSidebars(existing.items ?? [], item.items ?? []), link: existing.link ?? item.link };
      }
      anchor = at;
    } else {
      out.splice(anchor + 1, 0, item);
      anchor += 1;
    }
  }
  return out;
}

/** Ids referenced anywhere in a sidebar. */
export function sidebarDocIds(items: SidebarItem[], acc = new Set<string>()): Set<string> {
  for (const i of items) {
    if (i.type === 'doc' && i.id) acc.add(i.id);
    if (i.link?.type === 'doc' && i.link.id) acc.add(i.link.id);
    if (i.items) sidebarDocIds(i.items, acc);
  }
  return acc;
}

export interface NavSelection { root?: string; drop?: string[]; pick?: Record<string, string | number> }

/**
 * Narrow a MkDocs `nav:` for one section: `root` takes a top-level entry's children, `drop` removes
 * top-level entries, `pick` replaces a versioned entry's children with those of one release.
 */
export function selectNav(nav: MkdocsNav | undefined, { root, drop = [], pick = {} }: NavSelection = {}): MkdocsNav {
  const labelOf = (entry: unknown): string | null => (entry && typeof entry === 'object' ? Object.keys(entry)[0] ?? null : null);
  let items: MkdocsNav = nav ?? [];
  if (root) {
    const entry = items.find((e) => labelOf(e) === root) as Record<string, unknown> | undefined;
    if (!entry) throw new Error(`nav has no top-level entry "${root}"`);
    items = entry[root] as MkdocsNav;
  }
  items = items.filter((e) => !drop.includes(labelOf(e) ?? ''));
  return items.map((e) => {
    const label = labelOf(e);
    if (!label || !(label in pick)) return e;
    const releases = (e as Record<string, MkdocsNav>)[label]!;
    const release = releases.find((r) => String(labelOf(r)) === String(pick[label])) as Record<string, unknown> | undefined;
    if (!release) throw new Error(`nav entry "${label}" has no release "${pick[label]}"`);
    return { [label]: release[labelOf(release)!] };
  });
}
