// Convert every locked content source into generated/ for the Docusaurus site.
// Usage: node scripts/build-content.mjs [--onboard] [sectionId ...]
//   --onboard  for a section whose exclude list is empty, record today's failing pages as its exclude list
//              (first onboarding only; afterwards the list may only shrink).
//   --prune    remove pages that now convert from their exclude list.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readLock, checkoutDir, GENERATED, LOCK, ROOT } from './lib.mjs';
import { mkdocsSite } from '../converter/mkdocs-config.js';
import { loadPage, renderSingle, readPageData } from '../converter/render.js';
import { mergePage, CLOUD, SELF_HOSTED } from '../converter/merge.js';
import { convertRendered, compileCheck, splitFrontMatter, PageError, withoutImports } from '../converter/page.js';
import { navToSidebar, mergeSidebars, sidebarDocIds, selectNav } from '../converter/nav.js';
import { rewriteSiteLinks } from '../converter/links.js';
import { optionsFor, prefixIds, placeCompanion, normalizeSidebar, overviewLinks } from '../converter/sections.js';

const args = process.argv.slice(2);
const onboard = args.includes('--onboard');
const prune = args.includes('--prune');
const only = new Set(args.filter((a) => !a.startsWith('--')));
const BASE = '@@BASE@@';

const walk = (dir, filter) => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath ?? e.path, e.name))).filter(filter).sort() : []);
const isPage = (rel) => /\.mdx?$/.test(rel);
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const copyAssets = (fromDir, toDir, skip = []) => {
  for (const rel of walk(fromDir, (r) => !isPage(r) && !r.endsWith('.yml') && !skip.some((p) => r.startsWith(p)))) {
    const to = path.join(toDir, rel);
    if (fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(fromDir, rel), to);
  }
};
const mkdocsUrl = (rel) => rel.replace(/\\/g, '/').replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '/');
const titleOf = (text, rel) => splitFrontMatter(text).data.title ?? (text.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(rel, path.extname(rel))).replace(/[{}<>]/g, '').trim();
const editUrl = (repo, sha, file, root) => `https://github.com/${repo}/blob/${sha}/${path.relative(root, file).replace(/\\/g, '/')}`;

/** {{ base_path }} is rendered as a marker, then mapped to the section's route (assets are served under it). */
const resolveBase = (text, route) => text.replaceAll(`${BASE}/`, `/${route}/`).replaceAll(BASE, `/${route}`);

function redirectPage(title, to, deploymentOptions) {
  return `---\n${yaml.dump({ title, deployment_options: deploymentOptions, pagination_next: null, pagination_prev: null })}---\n\nimport Redirect from '@site/src/components/Redirect';\n\n<Redirect to="${to}" />\n`;
}

// Docusaurus turns `x/x.md` and `x/README.md` into the folder's index page (URL without the last segment);
// MkDocs does not. Pin such pages to their MkDocs URL so existing links keep working.
function keepMkdocsUrl(mdx, rel) {
  const parts = rel.replace(/\\/g, '/').replace(/\.mdx?$/, '').split('/');
  const name = parts.at(-1);
  const collides = /^readme$/i.test(name) || (parts.length > 1 && name.toLowerCase() === parts.at(-2).toLowerCase());
  if (!collides || /^slug:/m.test(mdx.split('\n---')[0])) return mdx;
  return mdx.replace(/^---\n/, `---\nslug: /${parts.join('/')}/\n`);
}

async function emit(section, report, rel, outDir, produce, fallback) {
  const out = path.join(outDir, rel.replace(/\.mdx$/, '.md'));
  const excluded = (section.exclude ?? []).includes(rel);
  try {
    const mdx = keepMkdocsUrl(await produce(), rel);
    // An excluded page stays a redirect until --prune takes it off the list: it may pass conversion
    // and still fail the Docusaurus build (see Known limits in the README).
    if (excluded) {
      report.nowPassing.push(rel);
      write(out, keepMkdocsUrl(redirectPage(fallback.title, fallback.to, fallback.deploymentOptions), rel));
      report.redirected++;
      return;
    }
    write(out, mdx);
    report.ok++;
  } catch (e) {
    const kind = e instanceof PageError ? e.kind : 'template';
    report.failures.push({ page: rel, kind, error: e.message.slice(0, 200) });
    write(out, keepMkdocsUrl(redirectPage(fallback.title, fallback.to, fallback.deploymentOptions), rel));
    report.redirected++;
  }
}

/**
 * Convert one MkDocs site. `src` names the repo, commit, mkdocs.yml, current site and deployment options
 * (the section itself, or its cloud companion); `prefix` places its pages under a sub-path of the section.
 * Returns sidebar items with ids relative to the section.
 */
async function buildMkdocs(section, outDir, staticDir, report, src = section, prefix = '') {
  const root = checkoutDir(src.repo, src.sha);
  const site = mkdocsSite(path.join(root, src.mkdocs));
  const source = { root, includeBases: site.includeBases };
  const route = prefix ? `${section.route}/${prefix}` : section.route;
  const withPrefix = (rel) => (prefix ? `${prefix}/${rel}` : rel);
  // only/skip: path prefixes of the pages this section takes from the source (several sections may share one).
  const wanted = (r) => r.endsWith('.md') && (!src.only || r.startsWith(src.only)) && !(src.skip ?? []).some((p) => r.startsWith(p));
  for (const rel of walk(site.docsDir, wanted)) {
    const file = path.join(site.docsDir, rel);
    const raw = fs.readFileSync(file, 'utf8');
    const deploymentOptions = optionsFor(src, rel);
    await emit(section, report, withPrefix(rel), outDir, async () => {
      const env = { ...site.extra, config: site.config, base_path: BASE };
      const rendered = resolveBase(renderSingle(loadPage(file, source), env, file, source), route);
      return (await convertRendered(rendered, { deploymentOptions, editUrl: editUrl(src.repo, src.sha, file, root), pageData: readPageData(file, source) })).mdx;
    }, { title: titleOf(raw, rel), to: src.current_site + mkdocsUrl(rel), deploymentOptions });
  }
  copyAssets(site.docsDir, prefix ? path.join(staticDir, prefix) : staticDir, src.skip); // absolute /<route>/assets/... references
  copyAssets(site.docsDir, prefix ? path.join(outDir, prefix) : outDir, src.skip); // page-relative ../assets/... references
  const nav = selectNav(site.nav, { root: src.nav_root, drop: src.nav_drop, pick: src.nav_pick });
  const items = navToSidebar(nav, (id) => fs.existsSync(path.join(outDir, `${withPrefix(id)}.md`)), report.droppedNav);
  return prefix ? prefixIds(items, prefix) : items;
}

/** Evaluate a Docusaurus sidebars file (.ts/.js/.json) from its checkout; returns { sidebarId: items }. */
function loadSidebarFile(file) {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  // Runs code from the content source (as Docusaurus would): pinned commit, reviewed bump, see the contract.
  const require = createRequire(fileURLToPath(import.meta.url));
  const createJiti = require('jiti');
  const load = createJiti(fileURLToPath(import.meta.url), { interopDefault: true, cache: false });
  const mod = load(file);
  return mod.default ?? mod;
}

async function buildMerge(section, outDir, staticDir, report) {
  const side = (ref) => {
    const root = checkoutDir(ref.repo, ref.sha);
    const site = mkdocsSite(path.join(root, ref.mkdocs));
    return { ref, root, site, source: { root, includeBases: site.includeBases }, pages: new Set(walk(site.docsDir, (r) => r.endsWith('.md'))) };
  };
  const c = side(section.cloud);
  const s = side(section.self_hosted);
  const envOf = (x) => ({ ...x.site.extra, config: x.site.config, base_path: BASE });
  for (const rel of [...new Set([...c.pages, ...s.pages])].sort()) {
    const inC = c.pages.has(rel);
    const inS = s.pages.has(rel);
    const deploymentOptions = inC && inS ? [CLOUD, SELF_HOSTED] : inC ? [CLOUD] : [SELF_HOSTED];
    const primary = inC ? c : s;
    const file = path.join(primary.site.docsDir, rel);
    await emit(section, report, rel, outDir, async () => {
      let text;
      if (inC && inS) {
        const merged = mergePage(path.join(c.site.docsDir, rel), path.join(s.site.docsDir, rel),
          { cloud: { env: envOf(c), source: c.source }, self: { env: envOf(s), source: s.source } }, section.shared_names ?? {});
        text = merged.text;
        report.merge.splitBlocks += merged.stats.splitBlocks;
        if (merged.stats.diverged) report.merge.diverged++;
      } else {
        text = renderSingle(loadPage(file, primary.source), envOf(primary), file, primary.source);
      }
      // Page data: the cloud wrapper's front matter and quick-start meta win; self-hosted fills gaps.
      const cData = inC ? readPageData(path.join(c.site.docsDir, rel), c.source) : {};
      const sData = inS ? readPageData(path.join(s.site.docsDir, rel), s.source) : {};
      const pageData = { frontMatter: { ...(sData.frontMatter ?? {}), ...(cData.frontMatter ?? {}) }, meta: cData.meta ?? sData.meta };
      return (await convertRendered(resolveBase(text, section.route), { deploymentOptions, editUrl: editUrl(primary.ref.repo, primary.ref.sha, file, primary.root), pageData })).mdx;
    }, { title: titleOf(fs.readFileSync(file, 'utf8'), rel), to: primary.ref.current_site + mkdocsUrl(rel), deploymentOptions });
  }
  for (const dir of [staticDir, outDir]) { copyAssets(c.site.docsDir, dir); copyAssets(s.site.docsDir, dir); }
  const known = (id) => fs.existsSync(path.join(outDir, `${id}.md`));
  return mergeSidebars(navToSidebar(c.site.nav, known, report.droppedNav), navToSidebar(s.site.nav, known, report.droppedNav));
}

// Custom components some Docusaurus sources import, mapped to site stand-ins (source-repo code never reaches the bundle).
const SHIMS = {
  '@site/src/components/TabAwareToc': '@site/src/components/shims/TabAwareToc',
  '@site/src/components/ConnectorCatalog': '@site/src/components/shims/ConnectorCatalog',
  '@site/src/utils/eipPatternComponents': '@site/src/components/shims/eipPatternComponents',
};

async function buildDocusaurus(section, outDir, staticDir, sidebarsDir, report) {
  const root = checkoutDir(section.repo, section.sha);
  const docsDir = path.join(root, section.docs);
  for (const rel of walk(docsDir, isPage)) {
    const file = path.join(docsDir, rel);
    const raw = fs.readFileSync(file, 'utf8');
    const deploymentOptions = optionsFor(section, rel);
    await emit(section, report, rel, outDir, async () => {
      const { data, body } = splitFrontMatter(raw);
      let text = body;
      for (const [from, to] of Object.entries(SHIMS)) text = text.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`);
      text = text.replace(/(\]\(|src=["'{]?["']?)\/(img|images|assets)\//g, `$1/${section.route}/$2/`);
      text = text.replace(/(\]\((?!https?:)[^)\s]*?)\.mdx(?=[)#])/g, '$1.md'); // pages are written as .md
      text = text.replace(/(from\s+['"]\.{1,2}\/[^'"]*?)\.mdx(['"])/g, '$1.md$2');
      const front = { ...data, deployment_options: data.deployment_options ?? deploymentOptions, custom_edit_url: editUrl(section.repo, section.sha, file, root) };
      const mdx = `---\n${yaml.dump(front, { lineWidth: -1 })}---\n${text}`;
      try {
        await compileCheck(mdx);
        return mdx;
      } catch (e) {
        if (!(e instanceof PageError) || e.kind !== 'compile') throw e;
        // Same last resort as MkDocs pages: CommonMark keeps the page on the site, components show as plain content.
        const md = `---\n${yaml.dump({ ...front, mdx: { format: 'md' } }, { lineWidth: -1 })}---\n${withoutImports(text)}`;
        await compileCheck(md, { format: 'md' });
        return md;
      }
    }, { title: titleOf(raw, rel), to: section.current_site + rel.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '$1'), deploymentOptions });
  }
  copyAssets(docsDir, staticDir);
  copyAssets(docsDir, outDir);
  const staticSrc = path.join(root, path.dirname(section.docs) === '.' ? 'static' : path.join(path.dirname(section.docs), 'static'));
  copyAssets(staticSrc, staticDir);
  const sidebars = loadSidebarFile(path.join(root, section.sidebar));
  const [sidebarId, items] = Object.entries(sidebars)[0];
  let main = items;
  if (section.cloud_companion) {
    const companionItems = await buildMkdocs(section, outDir, staticDir, report, section.cloud_companion, section.cloud_companion.path_prefix);
    main = placeCompanion(main, companionItems, section.cloud_companion);
  }
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
  const href = (id) => `/${section.route}/${id.replace(/(^|\/)index$/, '$1')}${/(^|\/)index$/.test(id) && id !== 'index' ? '' : '/'}`.replace(/\/+$/, '/');
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

/**
 * Links to a product's current docs site, for pages hosted here, become internal links (converter/links.js).
 * Each section answers for its current site, that site's /en/latest/ form and any `aliases` (former URLs).
 */
function rewriteLinksToHostedPages(lock) {
  const sites = [];
  for (const product of lock.products) for (const section of product.sections) {
    const docsDir = path.join(GENERATED, 'docs', section.id);
    const hosts = (sub) => (p) => {
      const base = path.join(docsDir, sub, p);
      return (p === '' ? [path.join(base, 'index.md')] : [`${base}.md`, path.join(base, 'index.md')])
        .some((f) => fs.existsSync(f) && !fs.readFileSync(f, 'utf8').includes("from '@site/src/components/Redirect'"));
    };
    const add = (url, sub = '') => {
      if (!url) return;
      const route = sub ? `${section.route}/${sub}` : section.route;
      for (const prefix of new Set([url, url.replace(/\/en\/\d[\w.-]*\/$/, '/en/latest/')])) sites.push({ prefix, route, hosts: hosts(sub) });
    };
    const refs = section.kind === 'mkdocs-merge' ? [section.cloud, section.self_hosted] : [section];
    for (const ref of refs) add(ref.current_site);
    for (const alias of section.aliases ?? []) add(alias);
    if (section.cloud_companion) add(section.cloud_companion.current_site, section.cloud_companion.path_prefix ?? '');
  }
  let total = 0;
  for (const product of lock.products) for (const section of product.sections) {
    const docsDir = path.join(GENERATED, 'docs', section.id);
    for (const rel of walk(docsDir, (r) => r.endsWith('.md'))) {
      const file = path.join(docsDir, rel);
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes("from '@site/src/components/Redirect'")) continue;
      const { text: out, rewritten } = rewriteSiteLinks(text, sites);
      if (rewritten) { fs.writeFileSync(file, out); total += rewritten; }
    }
  }
  return total;
}

const lock = readLock();
const manifest = { groups: lock.groups, products: [], linkOut: lock.link_out ?? [] };
const reports = [];
let blocking = false;
let lockChanged = false;
const sidebarsDir = path.join(GENERATED, 'sidebars');
fs.mkdirSync(sidebarsDir, { recursive: true });

for (const product of lock.products) {
  const entry = { id: product.id, name: product.name, group: product.group, blurb: product.blurb, sections: [] };
  for (const section of product.sections) {
    const outDir = path.join(GENERATED, 'docs', section.id);
    const staticDir = path.join(GENERATED, 'static', section.route);
    if (!only.size || only.has(section.id)) {
      fs.rmSync(outDir, { recursive: true, force: true });
      const report = { section: section.id, ok: 0, redirected: 0, failures: [], nowPassing: [], droppedNav: [], merge: { splitBlocks: 0, diverged: 0 } };
      const started = Date.now();
      let sidebar;
      if (section.kind === 'mkdocs') {
        sidebar = await buildMkdocs(section, outDir, staticDir, report);
        const companion = section.cloud_companion;
        if (companion) sidebar = placeCompanion(sidebar, await buildMkdocs(section, outDir, staticDir, report, companion, companion.path_prefix ?? ''), companion);
      }
      else if (section.kind === 'mkdocs-merge') sidebar = await buildMerge(section, outDir, staticDir, report);
      else sidebar = await buildDocusaurus(section, outDir, staticDir, sidebarsDir, report);
      for (const f of fs.readdirSync(sidebarsDir)) if (f.startsWith(`${section.id}.`) && !f.endsWith('.json')) fs.rmSync(path.join(sidebarsDir, f));
      if (sidebar) write(path.join(sidebarsDir, `${section.id}.json`), JSON.stringify({ docs: sidebar.length ? sidebar : [{ type: 'autogenerated', dirName: '.' }] }, null, 2));
      fillTemplatePages(product, section, outDir, path.join(sidebarsDir, `${section.id}.json`));

      const known = new Set(section.exclude ?? []);
      const fresh = report.failures.filter((f) => !known.has(f.page));
      if (fresh.length && onboard && !known.size) {
        section.exclude = report.failures.map((f) => f.page).sort();
        lockChanged = true;
      } else if (fresh.length) {
        blocking = true;
      }
      if (prune && report.nowPassing.length) {
        section.exclude = (section.exclude ?? []).filter((p) => !report.nowPassing.includes(p));
        lockChanged = true;
      }
      report.fresh = fresh.length;
      report.seconds = Math.round((Date.now() - started) / 1000);
      reports.push(report);
      console.log(`${section.id.padEnd(40)} ok ${String(report.ok).padStart(4)}  redirected ${String(report.redirected).padStart(3)}  new failures ${String(fresh.length).padStart(3)}  now passing ${report.nowPassing.length}  nav dropped ${report.droppedNav.length}  ${report.seconds}s`);
    }
    // Landing: the section index, else the first sidebar page; never a redirect to the product's current site.
    const docsDir = path.join(GENERATED, 'docs', section.id);
    const isPage = (id) => ['.md', '/index.md'].some((ext) => {
      const f = path.join(docsDir, `${id}${ext}`);
      return fs.existsSync(f) && !fs.readFileSync(f, 'utf8').includes("from '@site/src/components/Redirect'");
    });
    const sidebarFile = path.join(sidebarsDir, `${section.id}.json`);
    const ids = fs.existsSync(sidebarFile) ? Object.values(JSON.parse(fs.readFileSync(sidebarFile, 'utf8'))).flatMap((items) => [...sidebarDocIds(normalizeSidebar(items))]) : [];
    const landingId = ['index', ...ids].find(isPage);
    entry.sections.push({
      landing: !landingId || landingId === 'index' ? '' : `${landingId.replace(/(^|\/)index$/, '')}/`.replace(/^\/$/, ''),
      id: section.id, label: section.label, route: section.route, kind: section.kind,
      version: section.self_hosted?.version ?? section.version ?? null, olderVersions: section.older_versions ?? null,
      sidebar: fs.existsSync(path.join(sidebarsDir, `${section.id}.json`)) ? `${section.id}.json` : fs.readdirSync(sidebarsDir).find((f) => f.startsWith(`${section.id}.`)),
    });
  }
  manifest.products.push(entry);
}

console.log(`Links to current docs sites made internal: ${rewriteLinksToHostedPages(lock)}`);
write(path.join(GENERATED, 'manifest.json'), JSON.stringify(manifest, null, 2));
write(path.join(GENERATED, 'content-report.json'), JSON.stringify(reports, null, 2));
if (lockChanged) {
  // Rewrite only the exclude lists, keeping the hand-written file otherwise intact.
  let text = fs.readFileSync(LOCK, 'utf8');
  for (const product of lock.products) for (const section of product.sections) {
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
