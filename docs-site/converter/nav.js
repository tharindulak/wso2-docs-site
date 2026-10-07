// MkDocs `nav:` -> Docusaurus sidebar items, and merging two navs (cloud + self-hosted) into one tree.

const docId = (p) => p.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\.mdx?$/, '');
const isUrl = (p) => /^[a-z]+:\/\//i.test(p) || p.startsWith('mailto:');

/**
 * Convert an MkDocs nav to sidebar items. Entries whose page is not in `known` are dropped and reported.
 * @param {Array} nav MkDocs nav list
 * @param {(id: string) => boolean} known whether a doc id exists in the generated docs
 */
export function navToSidebar(nav, known, dropped = []) {
  const items = [];
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
        const children = navToSidebar(value, known, dropped);
        if (!children.length) continue;
        // MkDocs Material "section index": a leading index page becomes the category's own page.
        const [first, ...rest] = children;
        if (first.type === 'doc' && /(^|\/)index$/.test(first.id) && rest.length) {
          items.push({ type: 'category', label, link: { type: 'doc', id: first.id }, items: rest });
        } else {
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
      if (item.type === 'category' && out[at].type === 'category') {
        out[at] = { ...out[at], items: mergeSidebars(out[at].items, item.items), link: out[at].link ?? item.link };
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
export function sidebarDocIds(items, acc = new Set()) {
  for (const i of items) {
    if (i.type === 'doc') acc.add(i.id);
    if (i.link?.type === 'doc') acc.add(i.link.id);
    if (i.items) sidebarDocIds(i.items, acc);
  }
  return acc;
}

/**
 * Narrow a MkDocs `nav:` for one section: `root` takes a top-level entry's children, `drop` removes
 * top-level entries, `pick` replaces a versioned entry's children with those of one release.
 */
export function selectNav(nav, { root, drop = [], pick = {} } = {}) {
  const labelOf = (entry) => (entry && typeof entry === 'object' ? Object.keys(entry)[0] : null);
  let items = nav ?? [];
  if (root) {
    const entry = items.find((e) => labelOf(e) === root);
    if (!entry) throw new Error(`nav has no top-level entry "${root}"`);
    items = entry[root];
  }
  items = items.filter((e) => !drop.includes(labelOf(e)));
  return items.map((e) => {
    const label = labelOf(e);
    if (!(label in pick)) return e;
    const release = e[label].find((r) => String(labelOf(r)) === String(pick[label]));
    if (!release) throw new Error(`nav entry "${label}" has no release "${pick[label]}"`);
    return { [label]: release[labelOf(release)] };
  });
}
