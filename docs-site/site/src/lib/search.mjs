// Search behaviour over the Typesense index (records written by scripts/search-index.mjs). No React here.
// Decided in .scratch/wso2-docs-site/issues/11-search-choice.md.

/** Product id of the Account and billing (hub) pages; they appear in every scope. */
export const HUB = 'account';
export const HUB_NAME = 'Account and billing';
export const DEPLOYMENT_OPTIONS = ['WSO2 Cloud', 'Hybrid', 'Self-hosted'];

// Highlight markers: control characters never present in indexed text, so snippets render as text, never as HTML.
export const MARK_START = '\u0002';
export const MARK_END = '\u0003';

// Typesense filter values in backticks; a backtick inside a value would end it, so it is dropped.
const v = (s) => `\`${String(s).replace(/`/g, '')}\``;

/**
 * The reader's place, { product, productName, section, versionId, latest }, from the docs plugin id of the page being
 * viewed (one plugin per version) and the site's customFields; null outside every product (home, search page).
 */
export function searchContext(catalogue, versionInfo, versionId) {
  if (versionId === HUB) return { product: HUB, productName: HUB_NAME, section: HUB, versionId: HUB, latest: true };
  const info = versionId ? versionInfo?.[versionId] : null;
  if (!info) return null;
  const product = catalogue?.products.find((p) => (p.sections ?? []).some((s) => s.pluginId === info.sectionId));
  if (!product) return null;
  return { product: product.id, productName: product.name, section: info.sectionId, versionId, latest: info.status === 'latest' };
}

/** Whether the reader can scope to a product: only inside one (home and hub pages search all products). */
export const hasProductScope = (ctx) => Boolean(ctx && ctx.product !== HUB);

/**
 * Typesense filter_by for a search. Versions: Latest of everything, except the section being viewed on an older
 * version, which is searched at that version. scope 'product': the product plus the hub. deployment: any of them.
 */
export function searchFilter(ctx, scope, deployment = []) {
  const versions = ctx && !ctx.latest ? `(latest:=true && section:!=${v(ctx.section)}) || version_id:=${v(ctx.versionId)}` : 'latest:=true';
  const parts = [`(${versions})`];
  if (scope === 'product' && hasProductScope(ctx)) parts.push(`product:=[${v(ctx.product)}, ${v(HUB)}]`);
  const options = deployment.filter((d) => DEPLOYMENT_OPTIONS.includes(d));
  if (options.length) parts.push(`deployment:=[${options.map(v).join(', ')}]`);
  return parts.join(' && ');
}

/** Query string for /collections/<collection>/documents/search. */
export function searchParams(query, filter, { perPage = 20, facets = false } = {}) {
  const p = new URLSearchParams({
    q: query,
    query_by: 'title,heading,content,crumbs',
    query_by_weights: '6,4,1,1',
    filter_by: filter,
    // Relevance in 10 buckets, then rank: among similar matches a link-out (3) or page (2) comes before its sections (1).
    sort_by: '_text_match(buckets:10):desc,rank:desc',
    exclude_fields: 'content',
    highlight_fields: 'content,heading,title',
    highlight_start_tag: MARK_START,
    highlight_end_tag: MARK_END,
    highlight_affix_num_tokens: '12',
    per_page: String(perPage),
  });
  if (facets) p.set('facet_by', 'deployment');
  return p;
}

/**
 * Hits grouped by product: the reader's product first, then Account and billing, then the others in order of their
 * best hit. Each group: { product, name, hits }. A heading that repeats on one page (merged cloud and self-hosted
 * pages carry a section once per half) shows once.
 */
export function groupHits(hits, currentProduct) {
  const groups = new Map();
  const seen = new Set();
  for (const hit of hits) {
    const doc = hit.document ?? hit;
    const key = `${String(doc.url).split('#')[0]}\u0000${doc.heading ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!groups.has(doc.product)) groups.set(doc.product, { product: doc.product, name: doc.product === HUB ? HUB_NAME : doc.product_name, hits: [] });
    groups.get(doc.product).hits.push(hit);
  }
  const weight = (g) => (g.product === currentProduct ? 0 : g.product === HUB ? 1 : 2);
  return [...groups.values()].map((g, i) => ({ g, i })).sort((a, b) => weight(a.g) - weight(b.g) || a.i - b.i).map(({ g }) => g);
}

/** A highlighted string as [{ text, mark }] parts, for rendering as text nodes. */
export function splitMarked(text) {
  const parts = [];
  let mark = false;
  for (const piece of String(text ?? '').split(new RegExp(`([${MARK_START}${MARK_END}])`))) {
    if (piece === MARK_START) mark = true;
    else if (piece === MARK_END) mark = false;
    else if (piece) parts.push({ text: piece, mark });
  }
  return parts;
}

/** The snippet to show under a hit: matched content, else the matched heading, else nothing. */
export function hitSnippet(hit) {
  const h = hit.highlight ?? {};
  return h.content?.snippet ?? (h.heading?.matched_tokens?.length ? h.heading.snippet : null) ?? null;
}

/** "Section · Version" line: the version only when it is not Latest; nothing for hub and link-out records. */
export function hitMeta(doc) {
  if (doc.kind === 'link-out' || doc.product === HUB) return '';
  return [doc.section_label, doc.latest ? null : doc.version].filter(Boolean).join(' · ');
}

/** Where a hit goes. Link-out records go to their https site; everything else must be a site path. */
export function hitHref(doc) {
  const url = String(doc.url ?? '');
  if (doc.kind === 'link-out') return /^https:\/\//.test(url) ? url : null;
  return url.startsWith('/') && !url.startsWith('//') ? url : null;
}

/**
 * The search page URL for a query and scope. `ctx` travels as the viewed version id, which the page looks up again.
 */
export function searchPageHref(query, scope, ctx) {
  const p = new URLSearchParams({ q: query });
  if (hasProductScope(ctx)) { p.set('scope', scope); p.set('from', ctx.versionId); }
  return `/search?${p}`;
}

/** Fallback when the search service is unreachable: the same query on a web search engine, limited to this site. */
export function webSearchHref(query, siteUrl) {
  const host = new URL(siteUrl).host;
  return `https://duckduckgo.com/?${new URLSearchParams({ q: `site:${host} ${query}` })}`;
}

/** Validates /search-config.json: { url (https, or http on localhost), key, collection }. Anything else is null. */
export function readSearchConfig(json) {
  if (!json || typeof json !== 'object') return null;
  const { url, key, collection } = json;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return null;
  if (typeof collection !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(collection)) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  const local = u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !local) return null;
  return { url: u.origin, key, collection };
}

/**
 * Search settings from the /search-config.json response: { config, reason }. reason is null when usable, 'missing'
 * when the file is absent or not JSON (a build that was never indexed), 'invalid' when it fails readSearchConfig.
 */
export function settingsFrom(ok, json) {
  if (!ok || json === undefined) return { config: null, reason: 'missing' };
  const config = readSearchConfig(json);
  return config ? { config, reason: null } : { config: null, reason: 'invalid' };
}

/** A local preview or dev server, where the unavailable message may say how to set search up. */
export const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
