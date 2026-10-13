// MkDocs redirects plugin (redirect_maps): the former site served a redirect page at each old page URL, so links and
// bookmarks written for an old URL kept working. The docs site writes the same pages into the section's static files.
import fs from 'node:fs';
import path from 'node:path';
import type { MkdocsConfig } from './mkdocs-config.js';

/** The plugin's redirect_maps, old docs_dir page path -> target (a docs_dir page path or a URL), in file order. */
export function redirectMaps(config: MkdocsConfig): Array<[string, string]> {
  const plugins = Array.isArray(config.plugins) ? config.plugins : [];
  const out: Array<[string, string]> = [];
  for (const p of plugins) {
    if (!p || typeof p !== 'object') continue;
    const maps = (p as { redirects?: { redirect_maps?: unknown } }).redirects?.redirect_maps;
    if (!maps || typeof maps !== 'object') continue;
    for (const [from, to] of Object.entries(maps as Record<string, unknown>)) if (typeof to === 'string') out.push([from, to]);
  }
  return out;
}

export interface RedirectContext {
  /** Section route on the docs site, for example api-platform/api-manager/4.2.0 */
  route: string;
  /** The section's URL prefix on its former site, for example https://apim.docs.wso2.com/en/4.2.0/ */
  currentSite?: string;
  /** A docs_dir page path as a path inside this section (only, skip and docsRoot applied), or null when not its own. */
  toSection: (docsPath: string) => string | null;
  /** Site URL (relative to the section) of a page this section publishes, from its section path, or null. */
  hostedUrl: (sectionPath: string) => string | null;
}

const SAFE_PATH = /^(?:[A-Za-z0-9._~-]+\/)*(?:[A-Za-z0-9._~-]+)?$/;

/**
 * Where an old URL now goes: the page here when the section publishes it, else the target on its former site, else
 * any other https URL as written. Null for anything else (other schemes, paths leaving the section).
 */
export function redirectTarget(to: string, ctx: RedirectContext): string | null {
  const [base = '', hash = ''] = to.trim().split('#');
  const suffix = hash && /^[A-Za-z0-9._~-]+$/.test(hash) ? `#${hash}` : '';
  const internal = (sectionPath: string | null): string | null => {
    const url = sectionPath === null ? null : ctx.hostedUrl(sectionPath);
    return url === null ? null : `/${ctx.route}/${url}${suffix}`;
  };
  if (/^https:\/\//i.test(base)) {
    if (ctx.currentSite && base.startsWith(ctx.currentSite)) {
      const rest = base.slice(ctx.currentSite.length).replace(/^\/+/, '').replace(/index\.html$/, '').replace(/\/$/, '');
      const page = SAFE_PATH.test(rest) ? internal(rest === '' ? 'index.md' : `${rest}.md`) ?? internal(`${rest}/index.md`) : null;
      if (page) return page;
    }
    return /^https:\/\/[^\s"'<>]+$/.test(to.trim()) ? to.trim() : null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(base) || base.startsWith('/') || base.split('/').includes('..') || !base.endsWith('.md')) return null;
  const rel = ctx.toSection(base);
  const page = internal(rel);
  if (page) return page;
  return ctx.currentSite && rel !== null ? `${ctx.currentSite}${rel.replace(/(^|\/)(?:index|README)\.md$/, '$1').replace(/\.md$/, '/')}${suffix}` : null;
}

const escapeHtml = (t: string): string => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A redirect page as the MkDocs plugin writes one: meta refresh, canonical link, not indexed. */
export const redirectPageHtml = (target: string): string => {
  const to = escapeHtml(target);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Redirecting</title><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"><meta name="robots" content="noindex"></head>\n<body><p><a href="${to}">Continue to the page</a></p></body></html>\n`;
};

/**
 * Write a redirect page at each old URL in `maps` that the section owns and that no published page uses, under
 * staticDir (served at /<route>/). Returns how many pages were written.
 */
export function writeRedirectPages(maps: Array<[string, string]>, staticDir: string, ctx: RedirectContext): number {
  let written = 0;
  for (const [from, to] of maps) {
    if (!from.endsWith('.md') || from.split('/').includes('..') || from.startsWith('/')) continue;
    const rel = ctx.toSection(from);
    if (rel === null || ctx.hostedUrl(rel) !== null) continue; // a real page still lives at the old URL
    const url = rel.replace(/(^|\/)(?:index|README)\.md$/, '$1').replace(/\.md$/, '/');
    if (!SAFE_PATH.test(url.replace(/\/$/, ''))) continue;
    const target = redirectTarget(to, ctx);
    if (!target) continue;
    const file = path.join(staticDir, url, 'index.html');
    if (!path.resolve(file).startsWith(path.resolve(staticDir) + path.sep) || fs.existsSync(file)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, redirectPageHtml(target));
    written++;
  }
  return written;
}
