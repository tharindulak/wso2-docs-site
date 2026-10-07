// Section assembly helpers: per-page deployment options and placing a cloud companion's sidebar.

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

/** Expand Docusaurus sidebar shorthand (bare doc ids, { Label: [...] } categories) into full items. */
export function normalizeSidebar(items) {
  const list = Array.isArray(items) ? items : Object.entries(items).map(([label, sub]) => ({ [label]: sub }));
  return list.flatMap((i) => {
    if (typeof i === 'string') return [{ type: 'doc', id: i }];
    if (!i.type) return Object.entries(i).map(([label, sub]) => ({ type: 'category', label, items: normalizeSidebar(sub) }));
    return [i.items ? { ...i, items: normalizeSidebar(i.items) } : i];
  });
}

/** Place a cloud companion's top-level sidebar entries into the main sidebar's sections. */
export function placeCompanion(mainItems, companionItems, companion) {
  const main = normalizeSidebar(mainItems);
  const findSection = (label) => main.find((i) => i.type === 'category' && i.label?.trim().toLowerCase() === String(label).trim().toLowerCase());
  for (const item of companionItems) {
    const original = item.label ?? '';
    const renamed = companion.rename?.[original] ?? original;
    const entry = item.type === 'category' ? { ...item, label: renamed } : { ...item, ...(item.label ? { label: renamed } : {}) };
    const target = findSection(companion.placement?.[original] ?? '');
    if (target) {
      // Same-label category: its entries follow the category's own; otherwise add after the section's own entries.
      const same = entry.type === 'category' && (target.items ?? []).find((i) => i.type === 'category' && i.label?.trim().toLowerCase() === entry.label.trim().toLowerCase());
      target.items = same
        ? target.items.map((i) => (i === same ? { ...i, items: [...(i.items ?? []), ...(entry.items ?? [])] } : i))
        : [...(target.items ?? []), entry];
    }
    else main.push(entry);
  }
  return main;
}
