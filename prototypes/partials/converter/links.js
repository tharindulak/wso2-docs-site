// Links in content that point at a product's current docs site, for a page this site now hosts, are
// rewritten to the page here so readers stay on the site. Older releases and pages not hosted stay external.
import path from 'node:path';
import { outsideCode } from './syntax.js';
const FORMER_PATH = /^\/en\/[^/?#\s]+\//;
/** A decoded, normalised path inside the section, or null (malformed escape, NUL, or leaving the section). */
function filePath(rest) {
    let decoded;
    try {
        decoded = decodeURI(rest);
    }
    catch {
        return null;
    }
    if (!decoded || decoded.includes('\0') || /%2e|%2f|%5c/i.test(rest) || decoded.includes('\\'))
        return null;
    const p = path.posix.normalize(decoded);
    return p.startsWith('/') || p === '..' || p.startsWith('../') || p.split('/').includes('..') ? null : p;
}
/** Rewrite link targets only: Markdown `](url)`, `href="url"` and `href={"url"}`; with an origin also `src`. */
export function rewriteSiteLinks(text, sites, { origin } = {}) {
    const ordered = [...sites].sort((a, b) => b.prefix.length - a.prefix.length);
    let rewritten = 0;
    const files = [];
    const local = (url, withFiles) => {
        const [base = '', hash = ''] = url.split('#');
        // Several sections may share a current site (one source, two tabs): the first that hosts the page wins.
        for (const site of ordered.filter((c) => base.startsWith(c.prefix) || `${base}/` === c.prefix)) {
            const rest = base.slice(site.prefix.length).replace(/^\/+/, '').replace(/index\.html$/, '').replace(/\.html$/, '/');
            if (withFiles && rest.split('/').includes('..'))
                continue;
            const pagePath = rest && !rest.endsWith('/') && !/\.\w+$/.test(rest) ? `${rest}/` : rest;
            const suffix = hash ? `#${hash}` : '';
            if (site.hosts(pagePath.replace(/\/$/, ''))) {
                rewritten++;
                return `/${site.route}/${pagePath}${suffix}`;
            }
            const file = withFiles && site.hasFile && /\.\w+$/.test(rest) ? filePath(rest) : null;
            if (file !== null && site.hasFile(file)) {
                rewritten++;
                files.push({ site, path: file });
                return `/${site.route}/${rest}${suffix}`;
            }
        }
        return null;
    };
    /** A full former-site URL: internal when hosted, else unchanged. */
    const full = (url) => local(url, false);
    /** A root-relative former-site path: internal when hosted (files too), else the full URL on the former site. */
    const rootRelative = (p) => {
        if (!origin || !FORMER_PATH.test(p))
            return null;
        const url = `${origin}${p}`;
        const to = local(url, true);
        if (to)
            return to;
        rewritten++; // to the former site: still a change the caller must write
        return url;
    };
    const target = (url) => (/^https?:\/\//.test(url) ? full(url) : rootRelative(url));
    const out = outsideCode(text, (t) => t
        .replace(/(\]\(\s*)((?:https?:\/\/|\/(?!\/))[^)\s]+)/g, (m, pre, url) => { const to = target(url); return to ? pre + to : m; })
        .replace(/(href=\{?)(["'])((?:https?:\/\/|\/(?!\/))[^"']+)\2/g, (m, pre, q, url) => { const to = target(url); return to ? `${pre}${q}${to}${q}` : m; })
        .replace(/(src=\{?)(["'])(\/(?!\/)[^"']+)\2/g, (m, pre, q, url) => { const to = rootRelative(url); return to ? `${pre}${q}${to}${q}` : m; }));
    return { text: out, rewritten, files };
}
//# sourceMappingURL=links.js.map