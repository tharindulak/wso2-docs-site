// Section assembly helpers: per-page deployment options and placing a cloud companion's sidebar.
import type { DeploymentOption, SidebarInput, SidebarItem } from './types.js';

export interface DeploymentDefaults {
  deployment_options: DeploymentOption[];
  deployment_overrides?: Record<string, DeploymentOption[]>;
}

/** Deployment options for a page: the longest matching path-prefix override, else the section default. */
export function optionsFor(src: DeploymentDefaults, rel: string): DeploymentOption[] {
  const p = rel.replace(/\\/g, '/');
  const match = Object.keys(src.deployment_overrides ?? {}).filter((k) => p.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return match ? src.deployment_overrides![match]! : src.deployment_options;
}

export function prefixIds(items: SidebarItem[], prefix: string): SidebarItem[] {
  return items.map((i) => ({
    ...i,
    ...(i.type === 'doc' ? { id: `${prefix}/${i.id}` } : {}),
    ...(i.link?.type === 'doc' ? { link: { ...i.link, id: `${prefix}/${i.link.id}` } } : {}),
    ...(i.items ? { items: prefixIds(i.items, prefix) } : {}),
  }));
}

/** Expand Docusaurus sidebar shorthand (bare doc ids, { Label: [...] } categories) into full items. */
export function normalizeSidebar(items: SidebarInput[] | Record<string, unknown>): SidebarItem[] {
  const list: SidebarInput[] = Array.isArray(items) ? items : Object.entries(items).map(([label, sub]) => ({ [label]: sub }));
  return list.flatMap((i): SidebarItem[] => {
    if (typeof i === 'string') return [{ type: 'doc', id: i }];
    if (!('type' in i) || !i.type) {
      return Object.entries(i).map(([label, sub]) => ({ type: 'category', label, items: normalizeSidebar(sub as SidebarInput[]) }));
    }
    const item = i as SidebarItem;
    return [item.items ? { ...item, items: normalizeSidebar(item.items) } : item];
  });
}

export interface CompanionPlacement {
  placement?: Record<string, string>;
  rename?: Record<string, string>;
}

/** Place a cloud companion's top-level sidebar entries into the main sidebar's sections. */
export function placeCompanion(mainItems: SidebarInput[], companionItems: SidebarItem[], companion: CompanionPlacement): SidebarItem[] {
  const main = normalizeSidebar(mainItems);
  const norm = (s: unknown): string => String(s ?? '').trim().toLowerCase();
  const findSection = (label: string): SidebarItem | undefined => main.find((i) => i.type === 'category' && norm(i.label) === norm(label));
  for (const item of companionItems) {
    const original = item.label ?? '';
    const renamed = companion.rename?.[original] ?? original;
    const entry: SidebarItem = item.type === 'category' ? { ...item, label: renamed } : { ...item, ...(item.label ? { label: renamed } : {}) };
    const target = findSection(companion.placement?.[original] ?? '');
    if (target && entry.type === 'category' && norm(target.label) === norm(entry.label)) {
      target.items = [...(target.items ?? []), ...(entry.items ?? [])]; // same-named section: join it
    } else if (target) {
      // Same-label category: its entries follow the category's own; otherwise add after the section's own entries.
      const same = entry.type === 'category' ? (target.items ?? []).find((i) => i.type === 'category' && norm(i.label) === norm(entry.label)) : undefined;
      target.items = same
        ? (target.items ?? []).map((i) => (i === same ? { ...i, items: [...(i.items ?? []), ...(entry.items ?? [])] } : i))
        : [...(target.items ?? []), entry];
    } else {
      main.push(entry);
    }
  }
  return main;
}

/**
 * Links for a page MkDocs builds from a theme template (no Markdown body): the section home lists the
 * sidebar's top-level areas; a category's own page lists that category's pages. Each link goes to the first
 * page `usable` accepts (for example, not a redirect).
 */
export function overviewLinks(sidebar: SidebarInput[], docId: string, usable: (id: string) => boolean = () => true): Array<{ label: string; id: string }> {
  const items = normalizeSidebar(sidebar);
  const firstDoc = (i: SidebarItem): string | null | undefined => (i.type === 'doc' ? (usable(i.id!) ? i.id : null)
    : [i.link?.id].filter((id): id is string => Boolean(id) && usable(id!))[0] ?? (i.items ?? []).map(firstDoc).find(Boolean));
  const labelOf = (i: SidebarItem): string => i.label ?? (i.id ?? '').split('/').filter((p) => p !== 'index').pop()!.replace(/[-_]/g, ' ');
  const linksOf = (list: SidebarItem[]): Array<{ label: string; id: string }> => list.filter((i) => i.type !== 'link')
    .map((i) => ({ label: labelOf(i), id: firstDoc(i) }))
    .filter((l): l is { label: string; id: string } => Boolean(l.id) && l.id !== docId);
  if (docId === 'index') return linksOf(items);
  const find = (list: SidebarItem[]): SidebarItem | null => {
    for (const i of list) {
      if (i.type !== 'category') continue;
      if (i.link?.id === docId || firstDoc(i) === docId) return i;
      const inner = find(i.items ?? []);
      if (inner) return inner;
    }
    return null;
  };
  const category = find(items);
  return category ? linksOf(category.items ?? []) : [];
}
