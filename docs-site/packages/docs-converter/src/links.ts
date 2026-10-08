// Links in content that point at a product's current docs site, for a page this site now hosts, are
// rewritten to the page here so readers stay on the site. Older releases and pages not hosted stay external.
import { outsideCode } from './syntax.js';

export interface HostedSite {
  /** Current site URL prefix, for example https://apim.docs.wso2.com/en/4.7.0/ */
  prefix: string;
  /** Route of the section on the docs site, for example api-platform/api-manager */
  route: string;
  /** Whether the page at this path (no leading slash, "" for the home page) is a real page here. */
  hosts: (pagePath: string) => boolean;
}

/** Rewrite link targets only: Markdown `](url)`, `href="url"` and `href={"url"}`. */
export function rewriteSiteLinks(text: string, sites: HostedSite[]): { text: string; rewritten: number } {
  const ordered = [...sites].sort((a, b) => b.prefix.length - a.prefix.length);
  let rewritten = 0;
  const local = (url: string): string | null => {
    const [base = '', hash = ''] = url.split('#');
    // Several sections may share a current site (one source, two tabs): the first that hosts the page wins.
    for (const site of ordered.filter((c) => base.startsWith(c.prefix) || `${base}/` === c.prefix)) {
      const rest = base.slice(site.prefix.length).replace(/^\/+/, '').replace(/index\.html$/, '').replace(/\.html$/, '/');
      const pagePath = rest && !rest.endsWith('/') && !/\.\w+$/.test(rest) ? `${rest}/` : rest;
      if (!site.hosts(pagePath.replace(/\/$/, ''))) continue;
      rewritten++;
      return `/${site.route}/${pagePath}${hash ? `#${hash}` : ''}`;
    }
    return null;
  };
  const out = outsideCode(text, (t) => t
    .replace(/(\]\(\s*)(https?:\/\/[^)\s]+)/g, (m, pre: string, url: string) => { const to = local(url); return to ? pre + to : m; })
    .replace(/(href=\{?)(["'])(https?:\/\/[^"']+)\2/g, (m, pre: string, q: string, url: string) => { const to = local(url); return to ? `${pre}${q}${to}${q}` : m; }));
  return { text: out, rewritten };
}
