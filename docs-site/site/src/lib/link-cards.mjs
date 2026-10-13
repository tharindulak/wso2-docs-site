// What each card of a closing section shows (remark-link-cards passes the items; components/LinkCards renders them).
// Description, first found: the author's text after the link; for an internal link, the linked doc's description
// (front matter, else Docusaurus's first-line excerpt, as in <meta name="description">); for an external link, its
// host; else none. Internal links are matched to a doc by path, ignoring a trailing slash, query and anchor.

/** A URL with a scheme (https:, mailto:) or protocol-relative: not a page of this site. */
const isExternal = (href) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');

const ORIGIN = 'https://docs.invalid';

/** A site path without its trailing slash, decoded, so `/a/b`, `/a/b/` and `/a/b/#x` compare equal. */
function pathKey(path) {
  let p = path.replace(/\/+$/, '') || '/';
  try { p = decodeURI(p); } catch { /* keep it as written */ }
  return p;
}

/** The path an internal href points to, resolved against the current page; null when it cannot be read. */
function targetPath(href, pathname) {
  try {
    return pathKey(new URL(href, ORIGIN + (pathname || '/')).pathname);
  } catch {
    return null;
  }
}

function hostOf(href) {
  try { return new URL(href, ORIGIN).host || undefined; } catch { return undefined; }
}

const own = (obj, key) => obj != null && Object.prototype.hasOwnProperty.call(obj, key);

const valid = (item) => item != null && typeof item.href === 'string' && item.href !== '' && typeof item.title === 'string' && item.title !== '';

/**
 * The cards for `items` ({ href, title, text? }), or null when anything is missing or malformed (the component then
 * renders the author's list). `docs` is the version's doc metadata by id, `globalDocs` the version's docs ({ id, path })
 * from global data; both may be missing (no description is looked up then).
 */
export function linkCards(items, { pathname, docs, globalDocs } = {}) {
  if (!Array.isArray(items) || !items.length || !items.every(valid)) return null;
  const idByPath = new Map((Array.isArray(globalDocs) ? globalDocs : []).filter((d) => d && typeof d.path === 'string').map((d) => [pathKey(d.path), d.id]));
  return items.map(({ href, title, text }) => {
    const external = isExternal(href);
    let description = typeof text === 'string' && text.trim() ? text.trim() : undefined;
    if (!description && external) description = hostOf(href);
    if (!description && !external) {
      const id = idByPath.get(targetPath(href, pathname));
      const doc = own(docs, id) ? docs[id] : undefined;
      description = typeof doc?.description === 'string' && doc.description.trim() ? doc.description.trim() : undefined;
    }
    return { href, title, description, external };
  });
}
