// MkDocs `nav:` -> Docusaurus sidebar items, and merging two navs (cloud + self-hosted) into one tree.
import type { MkdocsNav, SidebarItem } from './types.js';

const docId = (p: string): string => p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.?\//, '').replace(/\.mdx?$/, '');
// A site path (/route/page/) is a link too: nav entries of a version folder that point at another section's pages.
const isUrl = (p: string): boolean => /^[a-z]+:\/\//i.test(p) || p.startsWith('mailto:') || /^\/(?!\/).*\/$/.test(p);

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

export interface NavSelection { root?: string; drop?: string[]; pick?: Record<string, string | number>; release?: string; strip?: string; outside?: (docsPath: string) => string | null }

/**
 * Narrow a MkDocs `nav:` for one section: `root` takes a top-level entry's children, `release` then takes the
 * children of one release under it (a component's version folder), `drop` removes top-level entries, `pick`
 * replaces a versioned entry's children with those of one release, and `strip` removes a folder prefix from page
 * paths (the folder is the section root); `outside` gives other pages' site paths (labelled entries become links).
 */
export function selectNav(nav: MkdocsNav | undefined, { root, drop = [], pick = {}, release, strip, outside }: NavSelection = {}): MkdocsNav {
  const labelOf = (entry: unknown): string | null => (entry && typeof entry === 'object' ? Object.keys(entry)[0] ?? null : null);
  let items: MkdocsNav = nav ?? [];
  if (root) {
    const entry = items.find((e) => labelOf(e) === root) as Record<string, unknown> | undefined;
    if (!entry) throw new Error(`nav has no top-level entry "${root}"`);
    items = entry[root] as MkdocsNav;
  }
  if (release !== undefined) {
    const entry = items.find((e) => String(labelOf(e)) === String(release)) as Record<string, unknown> | undefined;
    if (!entry) throw new Error(`nav${root ? ` entry "${root}"` : ''} has no release "${release}"`);
    items = entry[labelOf(entry)!] as MkdocsNav;
  }
  items = items.filter((e) => !drop.includes(labelOf(e) ?? ''));
  const picked = items.map((e) => {
    const label = labelOf(e);
    if (!label || !(label in pick)) return e;
    const releases = (e as Record<string, MkdocsNav>)[label]!;
    const chosen = releases.find((r) => String(labelOf(r)) === String(pick[label])) as Record<string, unknown> | undefined;
    if (!chosen) throw new Error(`nav entry "${label}" has no release "${pick[label]}"`);
    return { [label]: chosen[labelOf(chosen)!] };
  });
  return strip ? stripNav(picked, strip, outside) : picked;
}

/**
 * Page paths under `prefix` lose it; labelled pages outside it become site links when `outside` knows them; the rest
 * stay as written (and drop out when no such page is generated).
 */
function stripNav(nav: MkdocsNav, prefix: string, outside?: (docsPath: string) => string | null): MkdocsNav {
  const page = (v: string): string => (v.startsWith(prefix) ? v.slice(prefix.length) : isUrl(v) || /^[a-z]+:/i.test(v) ? v : outside?.(v) ?? v);
  const fix = (v: unknown): unknown => (typeof v === 'string' ? page(v)
    : Array.isArray(v) ? v.map(fix)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : v);
  return fix(nav) as MkdocsNav;
}
