// Convert every locked content source into generated/ for the Docusaurus site.
// Usage: node scripts/build-content.mjs [--onboard] [sectionId ...]
//   --onboard  for a section whose exclude list is empty, record today's failing pages as its exclude list
//              (first onboarding only; afterwards the list may only shrink).
//   --prune    remove pages that now convert from their exclude list.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  convertMkdocsSite, convertMergedSites, prepareDocusaurusDocs, githubEditUrl, emptyReport, walk,
  splitFrontMatter, sidebarDocIds, normalizeSidebar, overviewLinks, placeCompanion, rewriteSiteLinks,
} from '@wso2/docs-converter';
import { readLock, checkoutDir, GENERATED, LOCK, ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const onboard = args.includes('--onboard');
const prune = args.includes('--prune');
const only = new Set(args.filter((a) => !a.startsWith('--')));

const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

/** Excluded and failing pages send readers to the same page on the product's current site. */
function redirectPage({ title, to, deploymentOptions }) {
  return `---\n${yaml.dump({ title, deployment_options: deploymentOptions, pagination_next: null, pagination_prev: null })}---\n\nimport Redirect from '@site/src/components/Redirect';\n\n<Redirect to="${to}" />\n`;
}

// Custom components some Docusaurus sources import, mapped to site stand-ins (source-repo code never reaches the bundle).
const SHIMS = {
  '@site/src/components/TabAwareToc': '@site/src/components/shims/TabAwareToc',
  '@site/src/components/ConnectorCatalog': '@site/src/components/shims/ConnectorCatalog',
  '@site/src/utils/eipPatternComponents': '@site/src/components/shims/eipPatternComponents',
};

/** Lock-file fields of one MkDocs source (a section or its cloud companion) as converter options. */
const mkdocsOptions = (src) => {
  const root = checkoutDir(src.repo, src.sha);
  return {
    root, mkdocs: src.mkdocs, currentSite: src.current_site, editUrl: githubEditUrl(src.repo, src.sha, root),
    deployment_options: src.deployment_options, deployment_overrides: src.deployment_overrides,
    only: src.only, skip: src.skip, nav: { root: src.nav_root, drop: src.nav_drop, pick: src.nav_pick },
  };
};

/** Convert one lock-file section into generated/; returns the sidebar to write (or null when written here). */
async function buildSection(section, outDir, staticDir, sidebarsDir, report) {
  const out = { outDir, staticDir, route: section.route, exclude: section.exclude ?? [], fallback: redirectPage, report };
  const companion = section.cloud_companion;
  const companionSidebar = async () => (await convertMkdocsSite(mkdocsOptions(companion), { ...out, prefix: companion.path_prefix ?? '' })).sidebar;
  if (section.kind === 'mkdocs') {
    const { sidebar } = await convertMkdocsSite(mkdocsOptions(section), out);
    return companion ? placeCompanion(sidebar, await companionSidebar(), companion) : sidebar;
  }
  if (section.kind === 'mkdocs-merge') {
    const side = (ref) => { const root = checkoutDir(ref.repo, ref.sha); return { root, mkdocs: ref.mkdocs, currentSite: ref.current_site, editUrl: githubEditUrl(ref.repo, ref.sha, root) }; };
    return (await convertMergedSites({ cloud: side(section.cloud), self: side(section.self_hosted), sharedNames: section.shared_names ?? {} }, out)).sidebar;
  }
  const root = checkoutDir(section.repo, section.sha);
  const { sidebarId, sidebar } = await prepareDocusaurusDocs({
    root, docs: section.docs, sidebar: section.sidebar, currentSite: section.current_site, editUrl: githubEditUrl(section.repo, section.sha, root),
    shims: SHIMS, deployment_options: section.deployment_options, deployment_overrides: section.deployment_overrides,
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
 * Links to a product's current docs site, for pages hosted here, become internal links (rewriteSiteLinks in @wso2/docs-converter).
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
      const report = { section: section.id, ...emptyReport() };
      const started = Date.now();
      const sidebar = await buildSection(section, outDir, staticDir, sidebarsDir, report);
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
