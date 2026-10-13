const docId = (p) => p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.?\//, '').replace(/\.mdx?$/, '');
// A site path (/route/page/) is a link too: nav entries of a version folder that point at another section's pages.
const isUrl = (p) => /^[a-z]+:\/\//i.test(p) || p.startsWith('mailto:') || /^\/(?!\/).*\/$/.test(p);
/**
 * Convert an MkDocs nav to sidebar items. Entries whose page is not `known` are dropped and reported.
 * @param known whether a doc id exists in the generated docs
 */
export function navToSidebar(nav, known, dropped = []) {
    const items = [];
    for (const entry of nav ?? []) {
        if (typeof entry === 'string') {
            if (isUrl(entry))
                continue;
            const id = docId(entry);
            if (known(id))
                items.push({ type: 'doc', id });
            else
                dropped.push(entry);
            continue;
        }
        if (!entry || typeof entry !== 'object')
            continue;
        for (const [label, value] of Object.entries(entry)) {
            if (!String(label).trim())
                continue; // MkDocs: an empty title keeps a page out of the menu
            if (typeof value === 'string') {
                if (isUrl(value)) {
                    items.push({ type: 'link', label, href: value });
                    continue;
                }
                const id = docId(value);
                if (known(id))
                    items.push({ type: 'doc', id, label });
                else
                    dropped.push(value);
            }
            else if (Array.isArray(value)) {
                const children = navToSidebar(value, known, dropped);
                if (!children.length)
                    continue;
                // MkDocs Material "section index": a leading index page becomes the category's own page.
                const [first, ...rest] = children;
                if (first.type === 'doc' && /(^|\/)index$/.test(first.id ?? '') && rest.length) {
                    items.push({ type: 'category', label, link: { type: 'doc', id: first.id }, items: rest });
                }
                else {
                    items.push({ type: 'category', label, items: children });
                }
            }
        }
    }
    return items;
}
const keyOf = (item) => (item.type === 'doc' ? `doc:${item.id}` : `${item.type}:${(item.label ?? '').trim().toLowerCase()}`);
/**
 * Merge `extra` into `base`: matching docs and same-label categories merge; items only in `extra`
 * are inserted after the nearest preceding item they share with `base`.
 */
export function mergeSidebars(base, extra) {
    const out = base.map((i) => ({ ...i, ...(i.items ? { items: [...i.items] } : {}) }));
    let anchor = -1;
    for (const item of extra) {
        const at = out.findIndex((o) => keyOf(o) === keyOf(item));
        if (at >= 0) {
            const existing = out[at];
            if (item.type === 'category' && existing.type === 'category') {
                out[at] = { ...existing, items: mergeSidebars(existing.items ?? [], item.items ?? []), link: existing.link ?? item.link };
            }
            anchor = at;
        }
        else {
            out.splice(anchor + 1, 0, item);
            anchor += 1;
        }
    }
    return out;
}
/** Ids referenced anywhere in a sidebar. */
export function sidebarDocIds(items, acc = new Set()) {
    for (const i of items) {
        if (i.type === 'doc' && i.id)
            acc.add(i.id);
        if (i.link?.type === 'doc' && i.link.id)
            acc.add(i.link.id);
        if (i.items)
            sidebarDocIds(i.items, acc);
    }
    return acc;
}
/**
 * Narrow a MkDocs `nav:` for one section: `root` takes a top-level entry's children, `release` then takes the
 * children of one release under it (a component's version folder), `drop` removes top-level entries, `pick`
 * replaces a versioned entry's children with those of one release, and `strip` removes a folder prefix from page
 * paths (the folder is the section root); `outside` gives other pages' site paths (labelled entries become links).
 */
export function selectNav(nav, { root, drop = [], pick = {}, release, strip, outside } = {}) {
    const labelOf = (entry) => (entry && typeof entry === 'object' ? Object.keys(entry)[0] ?? null : null);
    let items = nav ?? [];
    if (root) {
        const entry = items.find((e) => labelOf(e) === root);
        if (!entry)
            throw new Error(`nav has no top-level entry "${root}"`);
        items = entry[root];
    }
    if (release !== undefined) {
        const entry = items.find((e) => String(labelOf(e)) === String(release));
        if (!entry)
            throw new Error(`nav${root ? ` entry "${root}"` : ''} has no release "${release}"`);
        items = entry[labelOf(entry)];
    }
    items = items.filter((e) => !drop.includes(labelOf(e) ?? ''));
    const picked = items.map((e) => {
        const label = labelOf(e);
        if (!label || !(label in pick))
            return e;
        const releases = e[label];
        const chosen = releases.find((r) => String(labelOf(r)) === String(pick[label]));
        if (!chosen)
            throw new Error(`nav entry "${label}" has no release "${pick[label]}"`);
        return { [label]: chosen[labelOf(chosen)] };
    });
    return strip ? stripNav(picked, strip, outside) : picked;
}
/**
 * Page paths under `prefix` lose it; labelled pages outside it become site links when `outside` knows them; the rest
 * stay as written (and drop out when no such page is generated).
 */
function stripNav(nav, prefix, outside) {
    const page = (v) => (v.startsWith(prefix) ? v.slice(prefix.length) : isUrl(v) || /^[a-z]+:/i.test(v) ? v : outside?.(v) ?? v);
    const fix = (v) => (typeof v === 'string' ? page(v)
        : Array.isArray(v) ? v.map(fix)
            : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : v);
    return fix(nav);
}
//# sourceMappingURL=nav.js.map