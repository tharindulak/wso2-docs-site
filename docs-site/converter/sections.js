// Section assembly helpers: per-page deployment options and placing a cloud companion's sidebar.
import { mergeSidebars } from './nav.js';

/** Deployment options for a page: the longest matching path-prefix override, else the section default. */
export function optionsFor(src, rel) {
  const p = rel.replace(/\\/g, '/');
  const match = Object.keys(src.deployment_overrides ?? {}).filter((k) => p.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return match ? src.deployment_overrides[match] : src.deployment_options;
}

export function prefixIds(items, prefix) {
  return items.map((i) => ({
    ...i,
    ...(i.type === 'doc' ? { id: `${prefix}/${i.id}` } : {}),
    ...(i.link?.type === 'doc' ? { link: { ...i.link, id: `${prefix}/${i.link.id}` } } : {}),
    ...(i.items ? { items: prefixIds(i.items, prefix) } : {}),
  }));
}

/** Place a cloud companion's top-level sidebar entries into the main sidebar's sections. */
export function placeCompanion(mainItems, companionItems, companion) {
  const main = mainItems.map((i) => ({ ...i }));
  const findSection = (label) => main.find((i) => i.type === 'category' && i.label?.trim().toLowerCase() === String(label).trim().toLowerCase());
  for (const item of companionItems) {
    const original = item.label ?? '';
    const renamed = companion.rename?.[original] ?? original;
    const entry = item.type === 'category' ? { ...item, label: renamed } : { ...item, ...(item.label ? { label: renamed } : {}) };
    const target = findSection(companion.placement?.[original] ?? '');
    if (target) {
      // Same-label category: merge into it; otherwise add after the section's own entries.
      const same = entry.type === 'category' && (target.items ?? []).find((i) => i.type === 'category' && i.label?.trim().toLowerCase() === entry.label.trim().toLowerCase());
      target.items = same
        ? target.items.map((i) => (i === same ? { ...i, items: mergeSidebars(i.items ?? [], entry.items ?? []) } : i))
        : [...(target.items ?? []), entry];
    }
    else main.push(entry);
  }
  return main;
}
