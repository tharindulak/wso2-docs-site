// Where the built site is published. A deploy sets DOCS_SITE_URL (an https origin, such as the test VM's hostname);
// other builds use wso2.com. DOCS_NO_INDEX=1 marks every page noindex (the test VM, while it serves content from forks).
// Both change every page's HTML (canonical and og:url links, the sitemap, the robots meta), so a snapshot built under
// one setting is not reused under another: siteKeySuffix() joins the snapshot key (scripts/snapshots.mjs).
export const DEFAULT_SITE_URL = 'https://wso2.com';

export function siteUrl(env = process.env) {
  const url = env.DOCS_SITE_URL;
  if (!url) return DEFAULT_SITE_URL;
  if (!/^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?$/.test(url)) throw new Error(`DOCS_SITE_URL must be an https origin with no path, got ${url}`);
  return url;
}

export const noIndex = (env = process.env) => env.DOCS_NO_INDEX === '1';

/** '' for the default site, so snapshot keys stored before these settings existed stay valid. */
export function siteKeySuffix(env = process.env) {
  const url = siteUrl(env);
  return `${url === DEFAULT_SITE_URL ? '' : `+url=${url}`}${noIndex(env) ? '+noindex' : ''}`;
}
