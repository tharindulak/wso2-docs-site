// Convert every locked content source into generated/ for the Docusaurus site.
// Usage: node scripts/build-content.mjs [--onboard] [sectionId | versionId ...]
//   Snapshot versions (older than live_window) convert only when named by version id (scripts/snapshots.mjs does).
//   --onboard  for a section whose exclude list is empty, record today's failing pages as its exclude list
//              (first onboarding only; afterwards the list may only shrink).
//   --prune    remove pages that now convert from their exclude list.
//   --partials Latest of a merged or MkDocs section writes shared includes as _partials/*.mdx (for a migration; see
//              migrate-docusaurus.mjs). Older versions, and cloud companions, inline them.
//   --every-include with --partials: MkDocs sections also write includes one page uses as partials.
//   --source-tree converting for a source's Docusaurus tree (migrate-docusaurus.mjs): no site-made pages (Deprecations).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  convertMkdocsSite, convertMergedSites, prepareDocusaurusDocs, githubEditUrl, emptyReport, walk,
  splitFrontMatter, sidebarDocIds, normalizeSidebar, overviewLinks, placeCompanion, rewriteSiteLinks, containedFile, redirectPageHtml, redirectPageTarget, collapseRedirects,
  deprecationIndex, readDeprecationsList, deprecationsPage, withDeprecationsEntry, DEPRECATIONS_ID,
} from '@wso2/docs-converter';
import { readLock, liveWindow, checkoutDir, GENERATED, LOCK, ROOT } from './lib.mjs';
import { sectionVersions, confluenceEntries, replaceExclude, pagePaths, pagePath, outsideLinks, formerRouteRedirects } from './versions.mjs';

const args = process.argv.slice(2);
const onboard = args.includes('--onboard');
const prune = args.includes('--prune');
const partials = args.includes('--partials');
const everyInclude = args.includes('--every-include');
const sourceTree = args.includes('--source-tree');
const only = new Set(args.filter((a) => !a.startsWith('--')));

const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

const REDIRECT_MARK = '<!-- wso2-docs: section root redirect -->';
/** A static page sending /<route>/ to the section's landing page (same site; the target is a generated path). */
const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const redirectHtml = (target) => { const to = escapeHtml(target); return `<!doctype html>\n${REDIRECT_MARK}\n<html lang="en"><head><meta charset="utf-8"><title>Redirecting</title><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"><meta name="robots" content="noindex"></head>\n<body><p><a href="${to}">Continue to the documentation</a></p></body></html>\n`; };

/** Excluded and failing pages: a notice that the page is not published here yet, with its source file on GitHub. */
function redirectPage({ title, source, deploymentOptions }) {
  return `---\n${yaml.dump({ title, deployment_options: deploymentOptions, pagination_next: null, pagination_prev: null })}---\n\nimport Redirect from '@site/src/components/Redirect';\n\n<Redirect${source ? ` source={${JSON.stringify(source)}}` : ''} />\n`;
}

// Custom components some Docusaurus sources import, mapped to site stand-ins (source-repo code never reaches the bundle).
const SHIMS = {
  '@site/src/components/TabAwareToc': '@site/src/components/shims/TabAwareToc',
  '@site/src/components/ConnectorCatalog': '@site/src/components/shims/ConnectorCatalog',
  '@site/src/utils/eipPatternComponents': '@site/src/components/shims/eipPatternComponents',
};

/**
 * Edit links of a source: GitHub's editor on the branch it tracks, for a wso2/ repository (where writers edit); a
 * pinned commit's view when no branch is known. A personal fork gets none: its migrated pages carry their own
 * custom_edit_url to the wso2/ source, and its other pages are generated, not edited. `edit: { repo, branch }` on a
 * source names where its files are edited when that is not the repository read (a fork of a wso2/ source).
 */
const editUrlOf = (src, root) => (src.edit ? githubEditUrl(src.edit.repo, src.edit.branch, root, 'edit')
  : !src.repo.startsWith('wso2/') ? undefined
  : src.track ? githubEditUrl(src.repo, src.track, root, 'edit') : githubEditUrl(src.repo, src.sha, root));

/** Lock-file fields of one MkDocs source (a section or its cloud companion) as converter options. */
const mkdocsOptions = (src) => {
  const root = checkoutDir(src.repo, src.sha);
  return {
    root, mkdocs: src.mkdocs, currentSite: src.current_site, editUrl: editUrlOf(src, root),
    deployment_options: src.deployment_options, deployment_overrides: src.deployment_overrides,
    only: src.only, skip: src.skip, nav: { root: src.nav_root, drop: src.nav_drop, pick: src.nav_pick, release: src.docs_root ? String(src.version) : undefined },
    docsRoot: src.docs_root, linkOutside: outsideLinks(lock, src) ?? undefined,
  };
};

/** Convert one lock-file section into generated/; returns the sidebar to write (or null when written here). */
async function buildSection(section, outDir, staticDir, sidebarsDir, report) {
  const out = { outDir, staticDir, route: section.route, exclude: section.exclude ?? [], fallback: redirectPage, report };
  const companion = section.cloud_companion;
  const companionSidebar = async () => (await convertMkdocsSite(mkdocsOptions(companion), { ...out, prefix: companion.path_prefix ?? '' })).sidebar;
  if (section.kind === 'mkdocs') {
    const { sidebar } = await convertMkdocsSite({ ...mkdocsOptions(section), partials: partials && section.status === 'latest' && (everyInclude ? 'every' : true) }, out);
    return companion ? placeCompanion(sidebar, await companionSidebar(), companion) : sidebar;
  }
  if (section.kind === 'mkdocs-merge') {
    const side = (ref) => { const root = checkoutDir(ref.repo, ref.sha); return { root, mkdocs: ref.mkdocs, currentSite: ref.current_site, editUrl: editUrlOf(ref, root) }; };
    return (await convertMergedSites({ cloud: side(section.cloud), self: side(section.self_hosted), sharedNames: section.shared_names ?? {}, partials }, out)).sidebar;
  }
  const root = checkoutDir(section.repo, section.sha);
  // A migrated tree (tree_root): its static folder serves the product's route; this version's redirects.json entries.
  const productRoute = lock.products.flatMap((p) => p.sections).find((s) => s.id === section.sectionId)?.route ?? section.route;
  const routeStatic = section.status === 'latest' ? path.join(GENERATED, 'static', productRoute) : path.join(GENERATED, 'static-versions', section.id, productRoute);
  const { sidebarId, sidebar } = await prepareDocusaurusDocs({
    root, docs: section.docs, sidebar: section.sidebar, currentSite: section.current_site, editUrl: editUrlOf(section, root),
    shims: SHIMS, deployment_options: section.deployment_options, deployment_overrides: section.deployment_overrides,
    treeRoot: section.tree_root, strict: Boolean(section.strict), conventions: Boolean(section.conventions),
    static: section.tree_static ? { from: section.tree_static, to: routeStatic } : undefined,
    redirects: section.tree_redirects ? { file: section.tree_redirects, version: section.status === 'latest' ? 'current' : section.version } : undefined,
  }, out);
  const main = companion ? placeCompanion(sidebar, await companionSidebar(), companion) : sidebar;
  write(path.join(sidebarsDir, `${section.id}.json`), JSON.stringify({ [sidebarId]: main }, null, 2));
  return null; // sidebar written here
}

/**
 * MkDocs builds some pages (section homes, catalogues) from theme templates, leaving no Markdown body.
 * Give each an overview: a heading and links to the pages under it in the sidebar.
 */
function fillTemplatePages(product, section, outDir, sidebarFile) {
  if (!fs.existsSync(sidebarFile)) return;
  const sidebar = Object.values(JSON.parse(fs.readFileSync(sidebarFile, 'utf8')))[0];
  const usable = (id) => ['.md', '/index.md'].some((ext) => {
    const f = path.join(outDir, `${id}${ext}`);
    return fs.existsSync(f) && !fs.readFileSync(f, 'utf8').includes("from '@site/src/components/Redirect'");
  });
  const href = (id) => `/${section.route}/${urlOfId(outDir, id)}`;
  for (const rel of walk(outDir, (r) => r.endsWith('.md'))) {
    const file = path.join(outDir, rel);
    const text = fs.readFileSync(file, 'utf8');
    const { data, body } = splitFrontMatter(text);
    if (!data.mkdocs_template || body.replace(/<!--[\s\S]*?-->/g, '').trim()) continue;
    const id = rel.replace(/\.md$/, '');
    const home = id === 'index';
    const own = home ? [] : overviewLinks(sidebar, id, usable);
    const links = own.length ? own : overviewLinks(sidebar, 'index', usable);
    const title = data.title ?? (home ? (section.label === 'Docs' ? product.name : section.label) : path.basename(path.dirname(file)).replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()));
    const list = links.map((l) => `- [${l.label.replace(/[[\]]/g, '')}](${href(l.id)})`).join('\n');
    write(file, `---\n${yaml.dump({ ...data, title })}---\n\n${list}\n`);
  }
}

/** Site path of a generated page by doc id, relative to its version route ("" for the index); a README may be the folder index. */
function urlOfId(docsDir, id) {
  const file = [`${id}.md`, `${id}/index.md`].map((f) => path.join(docsDir, f)).find((f) => fs.existsSync(f));
  return file ? pagePath(path.relative(docsDir, file), fs.readFileSync(file, 'utf8')) : `${id.replace(/(^|\/)index$/, '$1')}/`.replace(/^\/$/, '');
}

/**
 * Hand-kept deprecations without a page: a `deprecations.yml` beside each MkDocs site's mkdocs.yml (a merged version
 * reads both, each for its own deployment option), or at the root of a Docusaurus source's docs folder.
 */
function deprecationLists(v) {
  const at = (repo, sha, rel, options) => ({ file: containedFile(checkoutDir(repo, sha), rel), options });
  const beside = (src, options) => at(src.repo, src.sha, path.posix.join(path.posix.dirname(src.mkdocs), 'deprecations.yml'), options);
  if (v.kind === 'mkdocs-merge') return [beside(v.cloud, ['WSO2 Cloud']), beside(v.self_hosted, ['Self-hosted'])];
  if (v.kind === 'mkdocs') return [beside(v, v.deployment_options ?? [])];
  return [at(v.repo, v.sha, path.posix.join(v.docs, 'deprecations.yml'), v.deployment_options ?? [])];
}

/**
 * The version's Deprecations index (generated/deprecations/<versionId>.json) and the page rendering it at
 * /<route>/deprecations/, listed in the sidebar after the Feature deprecation reference; none when nothing is deprecated.
 */
function writeDeprecations(v, docsDir) {
  const indexFile = path.join(GENERATED, 'deprecations', `${v.id}.json`);
  fs.rmSync(indexFile, { force: true });
  const pages = walk(docsDir, (r) => /\.mdx?$/.test(r) && !r.split('/').some((part) => part.startsWith('_'))).sort().flatMap((rel) => {
    const text = fs.readFileSync(path.join(docsDir, rel), 'utf8');
    return text.includes("from '@site/src/components/Redirect'") ? [] : [{ id: rel.replace(/\.mdx?$/, ''), url: `/${v.route}/${pagePath(rel.replace(/\.mdx$/, '.md'), text)}`, text }];
  });
  const listed = [];
  for (const { file, options } of deprecationLists(v)) {
    if (!file) continue;
    const r = readDeprecationsList(fs.readFileSync(file, 'utf8'), options);
    listed.push(...r.listed);
    for (const p of r.problems) console.warn(`[WARNING] ${v.id}: ${p}`);
  }
  const sidebarFile = sidebarsOf(v.id);
  const sidebars = fs.existsSync(sidebarFile) ? JSON.parse(fs.readFileSync(sidebarFile, 'utf8')) : null;
  const { entries, problems } = deprecationIndex({ pages, listed, sidebar: sidebars ? Object.values(sidebars)[0] : [] });
  for (const p of problems) console.warn(`[WARNING] ${v.id}: deprecations: ${p}`);
  if (!entries.length) return 0;
  if (pages.some((p) => p.id === DEPRECATIONS_ID)) {
    console.warn(`[WARNING] ${v.id}: the source has a ${DEPRECATIONS_ID} page; no Deprecations page made`);
    return 0;
  }
  write(indexFile, JSON.stringify({ version: v.version, entries }, null, 2));
  write(path.join(docsDir, `${DEPRECATIONS_ID}.md`), deprecationsPage(path.relative(docsDir, indexFile).split(path.sep).join('/')));
  if (sidebars) {
    const [sidebarId, items] = Object.entries(sidebars)[0];
    write(sidebarFile, JSON.stringify({ ...sidebars, [sidebarId]: withDeprecationsEntry(items) }, null, 2));
  } else console.warn(`[WARNING] ${v.id}: no JSON sidebar; the Deprecations page is not listed in it`);
  return entries.length;
}

/** Where a version's static files go (Latest: generated/static; others: their own static-versions folder). */
const staticDirOf = (v) => (v.status === 'latest' ? path.join(GENERATED, 'static', v.route) : path.join(GENERATED, 'static-versions', v.id, v.route));

/** Origin of the former site a version's pages were served from, when its paths are /en/<version>/ (root-relative links). */
function formerOrigin(v) {
  for (const u of [v.former_site && v.version ? v.former_site.replace('{version}', v.version) : null, v.current_site, v.self_hosted?.current_site]) {
    if (!u) continue;
    try { const url = new URL(u); if (/^\/en\/[^/]+\//.test(url.pathname)) return url.origin; } catch { /* not a URL */ }
  }
  return undefined;
}

/**
 * Links to a product's current docs site, for pages hosted here, become internal links (rewriteSiteLinks in @wso2/docs-converter).
 * Each version answers for its current site; Latest also for the site's /en/latest/ form and any `aliases` (former URLs).
 * A snapshot's pages map only to the snapshot itself, so its output depends on nothing else in generated/ (its key
 * covers it); live pages map only to live versions.
 */
function rewriteLinksToHostedPages(lock) {
  const sites = [];
  const win = liveWindow(lock);
  const all = [];
  for (const product of lock.products) for (const section of product.sections) for (const v of sectionVersions(section, win)) all.push({ section, v });
  for (const { section, v } of all) {
    const latest = v.status === 'latest';
    const docsDir = path.join(GENERATED, 'docs', v.id);
    const page = (f) => fs.existsSync(f) && !fs.readFileSync(f, 'utf8').includes("from '@site/src/components/Redirect'");
    // A README.md without a slug is its folder's index (MkDocs serves it there); a pinned one answers at README/.
    const readmeIndex = (f) => page(f) && !/^slug:/m.test(fs.readFileSync(f, 'utf8').split('\n---')[0]);
    // An old URL this version answers with a redirect page (redirects.ts) is a target too: the browser follows it here.
    const redirectPage = (sub, p) => {
      const f = path.join(staticDirOf(v), sub, p, 'index.html');
      return p !== '' && !p.split('/').includes('..') && fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('<title>Redirecting</title>');
    };
    const hosts = (sub) => (p) => {
      const base = path.join(docsDir, sub, p);
      return (p === '' ? [path.join(base, 'index.md')] : [`${base}.md`, path.join(base, 'index.md')]).some(page) || readmeIndex(path.join(base, 'README.md'))
        || redirectPage(sub, p);
    };
    // Files (images, downloads) the version's pages are served with; the caller copies a linked one to static.
    // The real path must stay inside the version's folder: a symbolic link never pulls in a file from elsewhere.
    const hasFile = (sub) => (p) => !/\.mdx?$/.test(p) && containedFile(path.join(docsDir, sub), p) !== null;
    const add = (url, sub = '') => {
      if (!url) return;
      const route = sub ? `${v.route}/${sub}` : v.route;
      const sectionHome = `/${sub ? `${section.route}/${sub}` : section.route}/`;
      const prefixes = new Set([url, ...(latest ? [url.replace(/\/en\/\d[\w.-]*\/$/, '/en/latest/')] : [])]);
      const files = { from: path.join(docsDir, sub), to: path.join(staticDirOf(v), sub) };
      for (const prefix of prefixes) sites.push({ prefix, route, sectionHome, hosts: hosts(sub), hasFile: hasFile(sub), files, owner: v.id, snapshot: v.status === 'snapshot' });
    };
    const refs = latest && v.kind === 'mkdocs-merge' ? [v.cloud, v.self_hosted] : [v];
    for (const ref of refs) add(ref.current_site);
    if (latest) {
      for (const alias of section.aliases ?? []) add(alias);
      if (section.former_site && v.version) add(section.former_site.replace('{version}', v.version));
      if (section.cloud_companion) add(section.cloud_companion.current_site, section.cloud_companion.path_prefix ?? '');
    }
  }
  let total = 0;
  const redirects = []; // every old-URL redirect page: { owner, self, file, to }
  const liveSites = sites.filter((x) => !x.snapshot);
  for (const { v } of all) {
    const docsDir = path.join(GENERATED, 'docs', v.id);
    const own = v.status === 'snapshot' ? sites.filter((x) => x.owner === v.id) : liveSites;
    for (const rel of walk(docsDir, (r) => r.endsWith('.md'))) {
      const file = path.join(docsDir, rel);
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes("from '@site/src/components/Redirect'")) continue;
      const { text: out, rewritten, files } = rewriteSiteLinks(text, own, { origin: formerOrigin(v) });
      // Written whenever the text changed: a link sent to the former site counts too, even with no hosted rewrite.
      if (out !== text) { fs.writeFileSync(file, out); total += rewritten; }
      // A root-relative former-site link to a file now points at /<route>/<file>: serve the file there.
      for (const { site, path: p } of files) {
        const from = containedFile(site.files.from, p);
        const to = path.join(site.files.to, p);
        if (!from || !path.resolve(to).startsWith(path.resolve(site.files.to) + path.sep) || fs.existsSync(to)) continue;
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
      }
    }
    // Old-URL redirect pages (the redirects plugin's maps) sent to a current site: to the page here when it is hosted.
    const staticDir = staticDirOf(v);
    for (const rel of fs.existsSync(staticDir) ? walk(staticDir, (r) => r.endsWith('index.html')) : []) {
      const file = path.join(staticDir, rel);
      const url = redirectPageTarget(fs.readFileSync(file, 'utf8'));
      if (!url) continue;
      const self = `/${v.route}/${rel.split(path.sep).join('/').replace(/index\.html$/, '')}`;
      let to = /^https:\/\//.test(url) ? rewriteSiteLinks(`](${url})`, own).text.slice(2, -1) : url;
      // A page no longer published anywhere (its product site is retired): the section's home here (user decision 2026-10-21).
      if (!to.startsWith('/') || to.split('#')[0] === self) to = homeOf(url, own) ?? url;
      if (to.split('#')[0] === self) to = url;
      if (to !== url) { fs.writeFileSync(file, redirectPageHtml(to)); total++; }
      redirects.push({ owner: v.id, self, file, to });
    }
  }
  // A redirect to an old URL that itself redirects here goes straight to the end of the chain (within one version).
  for (const owner of new Set(redirects.map((r) => r.owner))) {
    const own = redirects.filter((r) => r.owner === owner);
    const files = new Map(own.map((r) => [r.self, r.file]));
    for (const [self, to] of collapseRedirects(new Map(own.map((r) => [r.self, r.to])))) fs.writeFileSync(files.get(self), redirectPageHtml(to));
  }
  return total;

  /** The home on this site of the section whose current site `url` is on: its own version first, else the section's Latest. */
  function homeOf(url, own) {
    const pick = (list) => list.filter((x) => url.startsWith(x.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
    const mine = pick(own);
    return mine ? `/${mine.route}/` : pick(sites)?.sectionHome ?? null;
  }
}

const lock = readLock();
const manifest = { groups: lock.groups, products: [], linkOut: lock.link_out ?? [], hiddenFromNavigation: lock.hide_from_navigation ?? [] };
const reports = [];
let blocking = false;
let lockChanged = false;
const sidebarsDir = path.join(GENERATED, 'sidebars');
fs.mkdirSync(sidebarsDir, { recursive: true });

const excludeChanges = [];
const sidebarsOf = (id) => path.join(sidebarsDir, `${id}.json`);

/** The section index, else the first sidebar page; never a redirect to the product's current site. */
function landingOf(v) {
  const docsDir = path.join(GENERATED, 'docs', v.id);
  const isPage = (id) => ['.md', '/index.md'].some((ext) => {
    const f = path.join(docsDir, `${id}${ext}`);
    return fs.existsSync(f) && !fs.readFileSync(f, 'utf8').includes("from '@site/src/components/Redirect'");
  });
  const sidebarFile = sidebarsOf(v.id);
  const ids = fs.existsSync(sidebarFile) ? Object.values(JSON.parse(fs.readFileSync(sidebarFile, 'utf8'))).flatMap((items) => [...sidebarDocIds(normalizeSidebar(items))]) : [];
  const landingId = ['index', ...ids].find(isPage);
  return !landingId || landingId === 'index' ? '' : urlOfId(docsDir, landingId);
}

/** A migrated tree lists its older versions in versions.json; the lock decides what is published, and they must agree. */
function checkTreeVersions(section, versions) {
  if (section.kind !== 'docusaurus' || !section.tree_root) return;
  const file = containedFile(checkoutDir(versions[0].repo, versions[0].sha), path.posix.join(section.tree_root, 'versions.json'));
  const tree = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const locked = versions.slice(1).map((v) => v.version);
  if (JSON.stringify(tree) !== JSON.stringify(locked)) {
    throw new Error(`${section.id}: ${section.tree_root}/versions.json lists ${JSON.stringify(tree)}, the lock file ${JSON.stringify(locked)}`);
  }
}

for (const product of lock.products) {
  const entry = { id: product.id, name: product.name, group: product.group, blurb: product.blurb, sections: [] };
  for (const section of product.sections) {
    const versions = sectionVersions(section, liveWindow(lock));
    if (!only.size || only.has(section.id)) checkTreeVersions(section, versions);
    const listed = Boolean(section.versions ?? section.self_hosted?.versions);
    for (const v of versions) {
      const outDir = path.join(GENERATED, 'docs', v.id);
      const staticDir = v.status === 'latest' ? path.join(GENERATED, 'static', v.route) : path.join(GENERATED, 'static-versions', v.id, v.route);
      // Snapshots are built by scripts/snapshots.mjs, which names them; a content run for the live build skips them.
      if (v.status === 'snapshot' ? only.has(v.id) : !only.size || only.has(section.id) || only.has(v.id)) {
        fs.rmSync(outDir, { recursive: true, force: true });
        if (v.status !== 'latest') fs.rmSync(path.join(GENERATED, 'static-versions', v.id), { recursive: true, force: true });
        const report = { section: v.id, ...emptyReport() };
        const started = Date.now();
        const sidebar = await buildSection(v, outDir, staticDir, sidebarsDir, report);
        for (const f of fs.readdirSync(sidebarsDir)) if (f.startsWith(`${v.id}.`) && !f.endsWith('.json')) fs.rmSync(path.join(sidebarsDir, f));
        if (sidebar) write(sidebarsOf(v.id), JSON.stringify({ docs: sidebar.length ? sidebar : [{ type: 'autogenerated', dirName: '.' }] }, null, 2));
        fillTemplatePages(product, v, outDir, sidebarsOf(v.id));
        const deprecations = sourceTree ? 0 : writeDeprecations(v, outDir);

        let list = v.exclude ?? [];
        const known = new Set(list);
        const fresh = report.failures.filter((f) => !known.has(f.page));
        let changed = false;
        if (fresh.length && onboard && !known.size) {
          list = report.failures.map((f) => f.page).sort();
          changed = true;
        } else if (fresh.length) {
          blocking = true;
        }
        if (prune && report.nowPassing.length) {
          list = list.filter((p) => !report.nowPassing.includes(p));
          changed = true;
        }
        if (changed) {
          lockChanged = true;
          if (listed) excludeChanges.push({ section, v, list });
          else section.exclude = list;
        }
        report.fresh = fresh.length;
        report.seconds = Math.round((Date.now() - started) / 1000);
        reports.push(report);
        console.log(`${v.id.padEnd(40)} ok ${String(report.ok).padStart(4)}  redirected ${String(report.redirected).padStart(3)}  new failures ${String(fresh.length).padStart(3)}  now passing ${report.nowPassing.length}  nav dropped ${report.droppedNav.length}  deprecations ${deprecations}  ${report.seconds}s`);
        // Front matter left out (invalid YAML, bad lifecycle stage values): the pages build; `wso2-docs check` fails on stage values.
        for (const p of report.frontMatter) console.warn(`[WARNING] ${v.id}: ${p.page}: ${p.kind === 'yaml' ? '' : 'lifecycle '}${p.error}`);
      }
    }
    const versionEntries = versions.map((v) => ({
      id: v.id, version: v.version, label: v.versionLabel, status: v.status, route: v.route,
      sidebar: fs.existsSync(sidebarsOf(v.id)) ? `${v.id}.json` : fs.readdirSync(sidebarsDir).find((f) => f.startsWith(`${v.id}.`)),
      landing: landingOf(v),
      // A native Docusaurus doc set (no sidebar in the lock) has its number prefixes ("01-intro") stripped, as Docusaurus
      // does; every other set keeps them, as its URLs and sidebar ids do (API Manager's connectors/1.x/).
      ...(v.kind === 'docusaurus' && !v.sidebar ? { stripNumberPrefixes: true } : {}),
    }));
    const confluence = confluenceEntries(section);
    if (!listed && typeof section.older_versions === 'string') confluence.push({ version: 'older', label: 'Older versions', status: 'confluence', href: section.older_versions });
    entry.sections.push({
      ...versionEntries[0], id: section.id, label: section.label, kind: section.kind,
      cloud: section.kind === 'mkdocs-merge' || Boolean(section.cloud_companion) || (versions[0].deployment_options ?? []).includes('WSO2 Cloud'),
      version: versions[0].version, olderVersions: null,
      versions: [...versionEntries, ...confluence],
    });
  }
  manifest.products.push(entry);
}

console.log(`Links to current docs sites made internal: ${rewriteLinksToHostedPages(lock)}`);
for (const product of manifest.products) for (const s of product.sections) {
  const doc = {
    section: s.id, latest: s.version,
    versions: s.versions.map((v) => (v.status === 'confluence' ? { version: v.version, label: v.label, status: v.status, href: v.href }
      : { version: v.version, label: v.label, status: v.status, path: v.status === 'latest' ? `/${s.route}/` : `/${v.route}/` })),
  };
  write(path.join(GENERATED, 'static', s.route, 'versions.json'), JSON.stringify(doc));
  for (const v of s.versions.filter((x) => x.status !== 'confluence')) {
    const docsDir = path.join(GENERATED, 'docs', v.id);
    if (!fs.existsSync(docsDir)) continue;
    const dir = v.status === 'latest' ? path.join(GENERATED, 'static', v.route) : path.join(GENERATED, 'static-versions', v.id, v.route);
    // home: where the version selector lands when this version lacks the reader's page (the index may be excluded).
    const pages = pagePaths(docsDir);
    write(path.join(dir, 'pages.json'), JSON.stringify({ pages, home: v.landing }));
    // Latest without an index page: /<route>/ redirects to the landing, so snapshots can link every section's root.
    const rootRedirect = path.join(dir, 'index.html');
    if (v.status === 'latest' && !pages.includes('') && v.landing) write(rootRedirect, redirectHtml(`/${v.route}/${v.landing}`));
    else if (fs.existsSync(rootRedirect) && fs.readFileSync(rootRedirect, 'utf8').includes(REDIRECT_MARK)) fs.rmSync(rootRedirect);
  }
}
// A section that moved (API Platform components were under the platform section): its former URLs redirect to its pages.
for (const product of lock.products) for (const section of product.sections) {
  if (!section.former_route) continue;
  const docsDir = path.join(GENERATED, 'docs', sectionVersions(section, liveWindow(lock))[0].id);
  if (!fs.existsSync(docsDir)) continue;
  // Redirects from an earlier run go first (pages may have gone); other files there (assets) stay.
  const base = path.join(GENERATED, 'static', section.former_route);
  for (const rel of walk(base, (r) => path.basename(r) === 'index.html')) {
    if (fs.readFileSync(path.join(base, rel), 'utf8').includes(REDIRECT_MARK)) fs.rmSync(path.join(base, rel));
  }
  const { redirects, skipped } = formerRouteRedirects(path.join(GENERATED, 'static'), section.former_route, section.route, pagePaths(docsDir));
  for (const { file, target } of redirects) write(file, redirectHtml(target));
  if (skipped.length) console.warn(`${section.id}: no former_route redirect for unsafe page path(s): ${skipped.join(', ')}`);
}
write(path.join(GENERATED, 'manifest.json'), JSON.stringify(manifest, null, 2));
write(path.join(GENERATED, 'content-report.json'), JSON.stringify(reports, null, 2));
if (lockChanged) {
  // Rewrite only the exclude lists, keeping the hand-written file otherwise intact.
  let text = fs.readFileSync(LOCK, 'utf8');
  for (const { section, v, list } of excludeChanges) text = replaceExclude(text, section.id, v.version, list);
  for (const product of lock.products) for (const section of product.sections) {
    if (section.versions ?? section.self_hosted?.versions) continue;
    const re = new RegExp(`(\\n {6}- id: ${section.id}\\n[\\s\\S]*?\\n {8}exclude:)[ \\t]*(?:\\[\\]|(?:\\n {10}- .*)+)`);
    const list = section.exclude ?? [];
    text = text.replace(re, `$1${list.length ? `\n${list.map((p) => `          - ${p}`).join('\n')}` : ' []'}`);
  }
  fs.writeFileSync(LOCK, text);
  console.log(`Exclude lists updated in ${path.relative(ROOT, LOCK)}`);
}
if (blocking) {
  console.error('New failing pages (not on the exclude list). See generated/content-report.json.');
  process.exitCode = 1;
}
