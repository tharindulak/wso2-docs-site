// Version selector logic over /<route>/versions.json (written by scripts/build-content.mjs). No React here.
const slash = (p) => (p.endsWith('/') ? p : `${p}/`);

export function currentVersion(doc, pathname) {
  const p = slash(pathname);
  return doc.versions.filter((v) => v.path && p.startsWith(v.path)).sort((a, b) => b.path.length - a.path.length)[0];
}

/**
 * Where choosing `target` takes the reader: the same page when the target version has it, else its home.
 * `info` is the target's pages.json: { pages, home } (home: the landing page, for versions whose index is excluded),
 * or a bare page list from older builds.
 */
export function versionHref(doc, pathname, target, info) {
  if (target.status === 'confluence') return target.href;
  const pages = Array.isArray(info) ? info : Array.isArray(info?.pages) ? info.pages : null;
  const safe = (h) => typeof h === 'string' && /^(?:[A-Za-z0-9._~-]+\/)*$/.test(h) && !h.split('/').some((x) => x === '.' || x === '..');
  const home = !Array.isArray(info) && safe(info?.home) ? info.home : '';
  const current = currentVersion(doc, pathname);
  const rest = current ? slash(pathname).slice(current.path.length) : '';
  return pages?.includes(rest) ? `${target.path}${rest}` : `${target.path}${home}`;
}

export function groups(doc) {
  return {
    current: doc.versions.filter((v) => v.status === 'latest'),
    previous: doc.versions.filter((v) => v.status === 'live' || v.status === 'snapshot'),
    older: doc.versions.filter((v) => v.status === 'confluence'),
  };
}
