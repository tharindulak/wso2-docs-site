// Search index from a built site: one record per page and per h2/h3 section, plus one per link-out product, pushed to
// Typesense. Reads the final HTML (live build or merged with snapshots), so no crawler or running site is needed.
// Behaviour is decided in .scratch/wso2-docs-site/issues/11-search-choice.md.
//
// Usage: node scripts/search-index.mjs <build dir> [--manifest generated/manifest.json] [--dry-run <out.jsonl> | --release]
//   --release: write <build dir>/_search/records.jsonl and schema.json for the docs VM's gate, which indexes them when
//   the release goes live (hosting/docs-gate); no Typesense access, no keys.
// Env (not with --dry-run):
//   TYPESENSE_URL         admin endpoint, for example http://localhost:8108
//   TYPESENSE_ADMIN_KEY   admin key (CI secret; never written anywhere)
//   TYPESENSE_SEARCH_KEY  search-only key value, published to readers in <build dir>/search-config.json (also
//                         .cache/search-public/, from where later local builds and `npm start` serve it)
//   TYPESENSE_PUBLIC_URL  endpoint browsers use (https, or http on localhost); defaults to TYPESENSE_URL
//
// Each run indexes into a new collection docs_<timestamp>, points the alias `docs` at it and drops older ones, so
// readers never see a half-built index. The search key may only search `docs`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseDocument, DomUtils } from 'htmlparser2';
import { ROOT, GENERATED } from './lib.mjs';
import { HUB, HUB_NAME, DEPLOYMENT_OPTIONS, readSearchConfig } from '../site/src/lib/search.mjs';

export const ALIAS = 'docs';
const MAX_CONTENT = 3000;
const BATCH = 2000;

export const SCHEMA = {
  fields: [
    { name: 'url', type: 'string', index: false, optional: true },
    { name: 'title', type: 'string' },
    { name: 'heading', type: 'string' },
    { name: 'content', type: 'string' },
    { name: 'crumbs', type: 'string' },
    { name: 'product', type: 'string', facet: true },
    { name: 'product_name', type: 'string', index: false, optional: true },
    { name: 'section', type: 'string', facet: true },
    { name: 'section_label', type: 'string', index: false, optional: true },
    { name: 'version_id', type: 'string', facet: true },
    { name: 'version', type: 'string', index: false, optional: true },
    { name: 'latest', type: 'bool', facet: true },
    { name: 'deployment', type: 'string[]', facet: true, optional: true },
    { name: 'badges', type: 'string[]', index: false, optional: true },
    { name: 'kind', type: 'string', facet: true },
    { name: 'rank', type: 'int32' },
  ],
  default_sorting_field: 'rank',
};

// Page chrome inside <article> that is not content.
const SKIP_CLASS = /(?:^|\s)(?:theme-doc-breadcrumbs|theme-doc-toc-mobile|theme-doc-footer|deployment-box|older-version-banner|hash-link|theme-doc-version-badge|pagination-nav)(?:\s|$)/;
const SKIP_TAG = new Set(['script', 'style', 'svg', 'button', 'nav', 'footer', 'noscript', 'template']);
const BLOCK = new Set(['p', 'div', 'li', 'ul', 'ol', 'table', 'tr', 'td', 'th', 'pre', 'blockquote', 'section', 'details', 'summary', 'h4', 'h5', 'h6', 'dt', 'dd', 'br', 'hr', 'figcaption']);
const clean = (t) => t.replace(/[​ \s]+/g, ' ').trim();

/** Site path of a built HTML file: a/b/index.html -> /a/b/, a/b.html -> /a/b. */
export const pagePath = (file) => `/${file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')}`;

const meta = (doc, name) => DomUtils.findOne((e) => e.name === 'meta' && (e.attribs.name === name || e.attribs['http-equiv'] === name), doc.children)?.attribs.content;

/**
 * Index of version id -> { product, productName, section, sectionLabel, version, latest } from the manifest. Products
 * (and the hub) hidden from navigation are marked hidden: their pages are built but not searchable.
 */
export function versionIndex(manifest) {
  const hidden = new Set(manifest.hiddenFromNavigation ?? []);
  const mark = (id) => (hidden.has(id) ? { hidden: true } : {});
  const index = new Map([[HUB, { product: HUB, productName: HUB_NAME, section: HUB, sectionLabel: HUB_NAME, version: '', latest: true, ...mark(HUB) }]]);
  for (const p of manifest.products) {
    for (const s of p.sections) {
      for (const ver of s.versions) {
        if (ver.status === 'confluence') continue;
        // A single-section product's section label ("Docs") says nothing next to the product name.
        index.set(ver.id, { product: p.id, productName: p.name, section: s.id, sectionLabel: p.sections.length > 1 ? s.label : '', version: ver.version ?? '', latest: ver.status === 'latest', ...mark(p.id) });
      }
    }
  }
  return index;
}

/**
 * Records for one built page, or [] when it is not a docs page or is a redirect. `where` comes from versionIndex.
 * Deployment options come from <meta name="wso2:deployment">, else the "Deployment options" box.
 */
export function pageRecords(html, url, where) {
  const doc = parseDocument(html);
  if (meta(doc, 'refresh') || /noindex/i.test(meta(doc, 'robots') ?? '')) return [];
  const article = DomUtils.findOne((e) => e.name === 'article', doc.children);
  if (!article) return [];

  const crumbsNav = DomUtils.findOne((e) => /theme-doc-breadcrumbs/.test(e.attribs.class ?? ''), article.children);
  const crumbs = crumbsNav ? DomUtils.findAll((e) => e.name === 'li', crumbsNav.children).map((li) => clean(DomUtils.textContent(li))).filter(Boolean).join(' › ') : '';
  let deployment = (meta(doc, 'wso2:deployment') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!deployment.length) {
    const box = DomUtils.findOne((e) => /(?:^|\s)deployment-box(?:\s|$)/.test(e.attribs.class ?? ''), article.children);
    deployment = box ? clean(DomUtils.textContent(box)).replace(/^Deployment options:\s*/, '').split(',').map((s) => s.trim()) : [];
  }
  deployment = deployment.filter((d) => DEPLOYMENT_OPTIONS.includes(d));

  // Walk the article in document order: h1 opens the page record, h2/h3 open section records, all else is text.
  const blocks = [];
  let current = null;
  const open = (el, level) => {
    const text = clean(DomUtils.textContent(el).replace(/#$/, ''));
    current = { level, heading: text, anchor: el.attribs.id ?? null, text: [] };
    blocks.push(current);
  };
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'text') { current?.text.push(n.data); continue; }
      if (n.type !== 'tag') continue;
      if (SKIP_TAG.has(n.name) || SKIP_CLASS.test(n.attribs.class ?? '')) continue;
      if (n.name === 'h1') { open(n, 1); continue; }
      if (n.name === 'h2' || n.name === 'h3') { open(n, 2); continue; }
      if (BLOCK.has(n.name)) current?.text.push(' ');
      walk(n.children);
      if (BLOCK.has(n.name)) current?.text.push(' ');
    }
  };
  walk(article.children);
  if (!blocks.length) return [];

  const title = blocks[0].heading || clean(meta(doc, 'og:title') ?? '').replace(/ \| WSO2 Docs$/, '');
  const base = {
    title, crumbs, product: where.product, product_name: where.productName, section: where.section, section_label: where.sectionLabel,
    version_id: where.versionId, version: where.version, latest: where.latest, deployment,
  };
  return blocks.map((b, i) => {
    const content = clean(b.text.join('')).slice(0, MAX_CONTENT);
    const first = i === 0;
    const href = !first && b.anchor ? `${url}#${b.anchor}` : url;
    return { id: idOf(`${href}\u0000${i}`), url: href, heading: first ? '' : b.heading, content: first && !content ? clean(meta(doc, 'description') ?? '') : content, kind: first ? 'page' : 'section', rank: first ? 2 : 1, ...base };
  });
}

const idOf = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 24);

/** One record per link-out product, so a query for its name says where its docs are. */
export function linkOutRecords(manifest) {
  return (manifest.linkOut ?? []).filter((p) => /^https:\/\//.test(p.href ?? '')).map((p) => {
    const host = new URL(p.href).host.replace(/^www\./, '');
    return {
      id: idOf(`link-out\u0000${p.id}`), url: p.href, title: p.name, heading: '', content: `Docs for ${p.name} are on ${host}. ${p.blurb ?? ''}`.trim(), crumbs: '',
      product: p.id, product_name: p.name, section: p.id, section_label: '', version_id: p.id, version: '', latest: true, deployment: [], kind: 'link-out', rank: 3,
    };
  });
}

/** Badges: a page's deployment options, unless it carries every option its product has (then they say nothing). */
export function badgesFor(record, productOptions) {
  const all = productOptions.get(record.product)?.size ?? 0;
  return record.deployment.length && record.deployment.length < all ? record.deployment : [];
}

const walkHtml = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/')).sort();

/** Every record for a build directory, without badges. Pages of version ids the manifest does not know are skipped. */
export function* buildRecords(buildDir, manifest, warn = console.warn) {
  const index = versionIndex(manifest);
  const unknown = new Map();
  for (const file of walkHtml(buildDir)) {
    const html = fs.readFileSync(path.join(buildDir, file), 'utf8');
    const tag = /<meta[^>]*name="docusaurus_tag"[^>]*content="docs-(.+?)-current"/.exec(html)?.[1];
    if (!tag) continue; // home page, 404, search page, redirects
    const where = index.get(tag);
    if (!where) { unknown.set(tag, (unknown.get(tag) ?? 0) + 1); continue; }
    if (where.hidden) continue;
    yield* pageRecords(html, pagePath(file), { ...where, versionId: tag });
  }
  for (const [tag, n] of unknown) warn(`skipped ${n} pages of unknown version id ${tag}`);
  yield* linkOutRecords(manifest);
}

/**
 * Streams every record of a build to a JSONL file (a site holds far more text than fits in memory), then yields them
 * back with badges, which need each product's full set of options first.
 */
export async function* recordsWithBadges(buildDir, manifest, tmpFile) {
  const options = new Map();
  const fd = fs.openSync(tmpFile, 'w');
  try {
    for (const r of buildRecords(buildDir, manifest)) {
      for (const d of r.deployment) (options.get(r.product) ?? options.set(r.product, new Set()).get(r.product)).add(d);
      fs.writeSync(fd, `${JSON.stringify(r)}\n`);
    }
  } finally { fs.closeSync(fd); }
  const lines = readline.createInterface({ input: fs.createReadStream(tmpFile), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line) continue;
    const r = JSON.parse(line);
    yield { ...r, badges: badgesFor(r, options) };
  }
}

// ---- Typesense ----

async function ts(base, key, method, route, body, contentType = 'application/json') {
  const res = await fetch(`${base}${route}`, {
    method, headers: { 'X-TYPESENSE-API-KEY': key, ...(body === undefined ? {} : { 'Content-Type': contentType }) },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  if (!res.ok) { const err = new Error(`Typesense ${method} ${route}: ${res.status} ${text.slice(0, 300)}`); err.status = res.status; throw err; }
  return contentType === 'application/json' && text ? JSON.parse(text) : text;
}

/** Index `records` into a fresh collection, switch the alias to it, drop older collections, ensure key and analytics. */
export async function publish(records, { url, adminKey, searchKey, log = console.log }) {
  const name = `${ALIAS}_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
  await ts(url, adminKey, 'POST', '/collections', { name, ...SCHEMA });
  let count = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const out = await ts(url, adminKey, 'POST', `/collections/${name}/documents/import?action=create`, batch.join('\n'), 'text/plain');
    const failed = out.split('\n').map((l) => JSON.parse(l)).filter((r) => !r.success);
    if (failed.length) throw new Error(`${failed.length} records failed to import into ${name}, first: ${JSON.stringify(failed[0]).slice(0, 300)}`);
    count += batch.length;
    batch = [];
  };
  try {
    for await (const r of records) { batch.push(JSON.stringify(r)); if (batch.length === BATCH) await flush(); }
    await flush();
  } catch (e) {
    await ts(url, adminKey, 'DELETE', `/collections/${name}`).catch(() => {}); // the alias still points at the last good index
    throw e;
  }
  await ts(url, adminKey, 'PUT', `/aliases/${ALIAS}`, { collection_name: name });
  for (const c of await ts(url, adminKey, 'GET', '/collections')) {
    if (c.name !== name && new RegExp(`^${ALIAS}_\\d{14}$`).test(c.name)) await ts(url, adminKey, 'DELETE', `/collections/${c.name}`);
  }
  await ensureSearchKey(url, adminKey, searchKey);
  await ensureAnalytics(url, adminKey, log);
  log(`indexed ${count} records into ${name} (alias ${ALIAS})`);
  return name;
}

/** The published key: search only, on the alias only. Created with the given value; left alone when it exists. */
async function ensureSearchKey(url, adminKey, value) {
  const { keys } = await ts(url, adminKey, 'GET', '/keys');
  const prefix = value.slice(0, 4);
  const existing = keys.filter((k) => k.description === 'docs-site search' && k.value_prefix === prefix);
  if (existing.some((k) => JSON.stringify(k.actions) === '["documents:search"]' && JSON.stringify(k.collections) === `["${ALIAS}"]`)) return;
  for (const k of existing) await ts(url, adminKey, 'DELETE', `/keys/${k.id}`); // same prefix, wrong scope: replace
  await ts(url, adminKey, 'POST', '/keys', { description: 'docs-site search', actions: ['documents:search'], collections: [ALIAS], value });
}

/**
 * Aggregate search analytics (decided: query and no-results counts, no cookies or reader ids). Rules are on the alias,
 * so they survive re-indexing. Needs the server started with --enable-search-analytics; skipped with a note if not.
 */
async function ensureAnalytics(url, adminKey, log) {
  const rules = [['docs_popular_queries', 'popular_queries', 'search_queries'], ['docs_nohits_queries', 'nohits_queries', 'search_nohits']];
  try {
    for (const [name, type, dest] of rules) {
      try {
        await ts(url, adminKey, 'POST', '/collections', { name: dest, fields: [{ name: 'q', type: 'string' }, { name: 'count', type: 'int32' }] });
      } catch (e) { if (e.status !== 409) throw e; }
      const existing = await ts(url, adminKey, 'GET', `/analytics/rules/${name}`).catch((e) => { if (e.status === 404 || /Rule not found/.test(e.message)) return null; throw e; }); // 30.2 answers 400
      if (existing?.collection === ALIAS) continue;
      if (existing) await ts(url, adminKey, 'DELETE', `/analytics/rules/${name}`); // a rule's collection cannot change
      await ts(url, adminKey, 'POST', '/analytics/rules', {
        name, type, collection: ALIAS, event_type: 'search',
        params: { destination_collection: dest, limit: 1000, capture_search_requests: true, expand_query: false },
      });
    }
  } catch (e) {
    log(`search analytics not set up: ${e.message}`);
  }
}

/** The release's search files: records (one JSON object per line) and the collection schema, without a name. */
export async function writeRelease(records, buildDir) {
  const dir = path.join(buildDir, '_search');
  fs.mkdirSync(dir, { recursive: true });
  const fd = fs.openSync(path.join(dir, 'records.jsonl'), 'w');
  let n = 0;
  try { for await (const r of records) { fs.writeSync(fd, `${JSON.stringify(r)}\n`); n++; } } finally { fs.closeSync(fd); }
  fs.writeFileSync(path.join(dir, 'schema.json'), `${JSON.stringify(SCHEMA)}\n`);
  return n;
}

/** Where local builds pick up the search settings (a static directory in docusaurus.config.js; gitignored). */
export const SEARCH_PUBLIC = path.join(ROOT, '.cache', 'search-public');

/**
 * Writes search-config.json, the only search setting the browser reads, into each directory: the build being indexed,
 * and SEARCH_PUBLIC so later dev and quick builds have it too.
 */
export function writeConfig(dirs, publicUrl, searchKey) {
  const config = readSearchConfig({ url: publicUrl, key: searchKey, collection: ALIAS });
  if (!config) throw new Error('TYPESENSE_PUBLIC_URL must be https (or http on localhost) and TYPESENSE_SEARCH_KEY 8 to 128 characters of [A-Za-z0-9_-]');
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'search-config.json'), `${JSON.stringify(config)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args.splice(i, 2)[1]; };
  const manifestFile = path.resolve(opt('--manifest') ?? path.join(GENERATED, 'manifest.json'));
  const dryRun = opt('--dry-run');
  const release = args.includes('--release');
  if (release) args.splice(args.indexOf('--release'), 1);
  const [buildArg] = args;
  if (!buildArg) { console.error('Usage: node scripts/search-index.mjs <build dir> [--manifest <file>] [--dry-run <out.jsonl>]'); process.exit(2); }
  const buildDir = path.resolve(ROOT, buildArg);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-search-'));
  const records = recordsWithBadges(buildDir, manifest, path.join(tmpDir, 'records.jsonl'));
  try {
    if (release) {
      console.log(`wrote ${await writeRelease(records, buildDir)} records to ${path.join(buildDir, '_search')}`);
    } else if (dryRun) {
      const fd = fs.openSync(dryRun, 'w');
      let n = 0;
      for await (const r of records) { fs.writeSync(fd, `${JSON.stringify(r)}\n`); n++; }
      fs.closeSync(fd);
      console.log(`wrote ${n} records to ${dryRun}`);
    } else {
      const { TYPESENSE_URL: url, TYPESENSE_ADMIN_KEY: adminKey, TYPESENSE_SEARCH_KEY: searchKey } = process.env;
      if (!url || !adminKey || !searchKey) { console.error('Set TYPESENSE_URL, TYPESENSE_ADMIN_KEY and TYPESENSE_SEARCH_KEY (or use --dry-run).'); process.exit(2); }
      if (searchKey === adminKey) { console.error('TYPESENSE_SEARCH_KEY must differ from the admin key: it is published to readers.'); process.exit(2); }
      writeConfig([buildDir, SEARCH_PUBLIC], process.env.TYPESENSE_PUBLIC_URL || url, searchKey); // validate before indexing
      await publish(records, { url: url.replace(/\/$/, ''), adminKey, searchKey });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
