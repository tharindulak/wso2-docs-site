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
        if (typeof i === 'string')
            return [{ type: 'doc', id: i }];
        if (!('type' in i) || !i.type) {
            return Object.entries(i).map(([label, sub]) => ({ type: 'category', label, items: normalizeSidebar(sub) }));
        }
        const item = i;
        return [item.items ? { ...item, items: normalizeSidebar(item.items) } : item];
    });
}
/** Place a cloud companion's top-level sidebar entries into the main sidebar's sections. */
export function placeCompanion(mainItems, companionItems, companion) {
    const main = normalizeSidebar(mainItems);
    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const findSection = (label) => main.find((i) => i.type === 'category' && norm(i.label) === norm(label));
    for (const item of companionItems) {
        const original = item.label ?? '';
        const renamed = companion.rename?.[original] ?? original;
        const entry = item.type === 'category' ? { ...item, label: renamed } : { ...item, ...(item.label ? { label: renamed } : {}) };
        const target = findSection(companion.placement?.[original] ?? '');
        if (target && entry.type === 'category' && norm(target.label) === norm(entry.label)) {
            target.items = [...(target.items ?? []), ...(entry.items ?? [])]; // same-named section: join it
        }
        else if (target) {
            // Same-label category: its entries follow the category's own; otherwise add after the section's own entries.
            const same = entry.type === 'category' ? (target.items ?? []).find((i) => i.type === 'category' && norm(i.label) === norm(entry.label)) : undefined;
            target.items = same
                ? (target.items ?? []).map((i) => (i === same ? { ...i, items: [...(i.items ?? []), ...(entry.items ?? [])] } : i))
                : [...(target.items ?? []), entry];
        }
        else {
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
export function overviewLinks(sidebar, docId, usable = () => true) {
    const items = normalizeSidebar(sidebar);
    const firstDoc = (i) => (i.type === 'doc' ? (usable(i.id) ? i.id : null)
        : [i.link?.id].filter((id) => Boolean(id) && usable(id))[0] ?? (i.items ?? []).map(firstDoc).find(Boolean));
    const labelOf = (i) => i.label ?? (i.id ?? '').split('/').filter((p) => p !== 'index').pop().replace(/[-_]/g, ' ');
    const linksOf = (list) => list.filter((i) => i.type !== 'link')
        .map((i) => ({ label: labelOf(i), id: firstDoc(i) }))
        .filter((l) => Boolean(l.id) && l.id !== docId);
    if (docId === 'index')
        return linksOf(items);
    const find = (list) => {
        for (const i of list) {
            if (i.type !== 'category')
                continue;
            if (i.link?.id === docId || firstDoc(i) === docId)
                return i;
            const inner = find(i.items ?? []);
            if (inner)
                return inner;
        }
        return null;
    };
    const category = find(items);
    return category ? linksOf(category.items ?? []) : [];
}
//# sourceMappingURL=sections.js.map