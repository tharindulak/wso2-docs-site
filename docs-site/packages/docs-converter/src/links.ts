// Links in content that point at a product's current docs site, for a page this site now hosts, are
// rewritten to the page here so readers stay on the site. Older releases and pages not hosted stay external.
import path from 'node:path';
import { outsideCode } from './syntax.js';

export interface HostedSite {
  /** Current site URL prefix, for example https://apim.docs.wso2.com/en/4.7.0/ */
  prefix: string;
  /** Route of the section on the docs site, for example api-platform/api-manager */
  route: string;
  /** Whether the page at this path (no leading slash, "" for the home page) is a real page here. */
  hosts: (pagePath: string) => boolean;
  /** Whether a file (image, download) at this path (decoded, inside the section) is part of the section here. */
  hasFile?: (filePath: string) => boolean;
}

export interface RewriteOptions {
  /**
   * Origin of the former site the page was served from (https://apim.docs.wso2.com). Root-relative former-site paths
   * (/en/<version>/...) are links on that host: they resolve like the full URL, files included, and go to the former
   * site when this site does not host them.
   */
  origin?: string;
}

/** A file a rewritten link now points at: the caller serves it at /<site.route>/<path>. */
export interface RewrittenFile { site: HostedSite; path: string }

const FORMER_PATH = /^\/en\/[^/?#\s]+\//;

/** A decoded, normalised path inside the section, or null (malformed escape, NUL, or leaving the section). */
function filePath(rest: string): string | null {
  let decoded: string;
  try { decoded = decodeURI(rest); } catch { return null; }
  if (!decoded || decoded.includes('\0') || /%2e|%2f|%5c/i.test(rest) || decoded.includes('\\')) return null;
  const p = path.posix.normalize(decoded);
  return p.startsWith('/') || p === '..' || p.startsWith('../') || p.split('/').includes('..') ? null : p;
}

/** Rewrite link targets only: Markdown `](url)`, `href="url"` and `href={"url"}`; with an origin also `src`. */
export function rewriteSiteLinks(text: string, sites: HostedSite[], { origin }: RewriteOptions = {}): { text: string; rewritten: number; files: RewrittenFile[] } {
  const ordered = [...sites].sort((a, b) => b.prefix.length - a.prefix.length);
  let rewritten = 0;
  const files: RewrittenFile[] = [];
  const local = (url: string, withFiles: boolean): string | null => {
    const [base = '', hash = ''] = url.split('#');
    // Several sections may share a current site (one source, two tabs): the first that hosts the page wins.
    for (const site of ordered.filter((c) => base.startsWith(c.prefix) || `${base}/` === c.prefix)) {
      const rest = base.slice(site.prefix.length).replace(/^\/+/, '').replace(/index\.html$/, '').replace(/\.html$/, '/');
      if (withFiles && rest.split('/').includes('..')) continue;
      const pagePath = rest && !rest.endsWith('/') && !/\.\w+$/.test(rest) ? `${rest}/` : rest;
      const suffix = hash ? `#${hash}` : '';
      if (site.hosts(pagePath.replace(/\/$/, ''))) {
        rewritten++;
        return `/${site.route}/${pagePath}${suffix}`;
      }
      const file = withFiles && site.hasFile && /\.\w+$/.test(rest) ? filePath(rest) : null;
      if (file !== null && site.hasFile!(file)) {
        rewritten++;
        files.push({ site, path: file });
        return `/${site.route}/${rest}${suffix}`;
      }
    }
    return null;
  };
  /** A full former-site URL: internal when hosted, else unchanged. */
  const full = (url: string): string | null => local(url, false);
  /** A root-relative former-site path: internal when hosted (files too), else the full URL on the former site. */
  const rootRelative = (p: string): string | null => {
    if (!origin || !FORMER_PATH.test(p)) return null;
    const url = `${origin}${p}`;
    const to = local(url, true);
    if (to) return to;
    rewritten++; // to the former site: still a change the caller must write
    return url;
  };
  const target = (url: string): string | null => (/^https?:\/\//.test(url) ? full(url) : rootRelative(url));
  const out = outsideCode(text, (t) => t
    .replace(/(\]\(\s*)((?:https?:\/\/|\/(?!\/))[^)\s]+)/g, (m, pre: string, url: string) => { const to = target(url); return to ? pre + to : m; })
    .replace(/(href=\{?)(["'])((?:https?:\/\/|\/(?!\/))[^"']+)\2/g, (m, pre: string, q: string, url: string) => { const to = target(url); return to ? `${pre}${q}${to}${q}` : m; })
    .replace(/(src=\{?)(["'])(\/(?!\/)[^"']+)\2/g, (m, pre: string, q: string, url: string) => { const to = rootRelative(url); return to ? `${pre}${q}${to}${q}` : m; }));
  return { text: out, rewritten, files };
}
