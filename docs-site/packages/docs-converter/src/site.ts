// Convert a whole documentation source: an MkDocs site, a cloud + self-hosted pair merged page by page, or an
// existing Docusaurus docs folder. Used by the docs site's build and by the `wso2-docs` CLI in team repos.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';
import { mkdocsSite } from './mkdocs-config.js';
import { loadPage, renderSingle, readPageData } from './render.js';
import { mergePage, CLOUD, SELF_HOSTED } from './merge.js';
import { convertRendered, compileCheck, splitFrontMatter, PageError, withoutImports, type PageErrorKind } from './page.js';
import { navToSidebar, mergeSidebars, selectNav, type NavSelection } from './nav.js';
import { optionsFor, prefixIds, type DeploymentDefaults } from './sections.js';
import type { DeploymentOption, SidebarInput, SidebarItem } from './types.js';

/** `{{ base_path }}` renders as this marker, then maps to the section's route. */
const BASE = '@@BASE@@';

export interface PageFailure { page: string; kind: PageErrorKind; error: string }

export interface SiteReport {
  ok: number;
  redirected: number;
  failures: PageFailure[];
  /** Pages on the exclude list that now convert: candidates for removal from the list. */
  nowPassing: string[];
  /** nav: entries pointing at pages that are not generated. */
  droppedNav: string[];
  merge: { splitBlocks: number; diverged: number };
}

export const emptyReport = (): SiteReport => ({ ok: 0, redirected: 0, failures: [], nowPassing: [], droppedNav: [], merge: { splitBlocks: 0, diverged: 0 } });

/** What to write for a page that is excluded or fails: the docs site writes a redirect; the CLI writes nothing. */
export interface FallbackInfo { rel: string; title: string; to: string; deploymentOptions: DeploymentOption[] }
export type FallbackPage = (info: FallbackInfo) => string | null;

export interface SiteOutput {
  /** Pages, and assets for page-relative references. */
  outDir: string;
  /** Second copy of assets for absolute /<route>/assets/... references (the docs site's static folder). */
  staticDir?: string;
  /** Route of the section on the docs site; `{{ base_path }}` resolves to it. */
  route: string;
  /** Sub-path inside the section (a cloud companion's pages). */
  prefix?: string;
  /** Pages known to fail (relative to the section, with prefix). They stay fallbacks even when they pass. */
  exclude?: string[];
  fallback?: FallbackPage;
  report?: SiteReport;
}

/** Edit link for a page file, for example https://github.com/wso2/docs-is/blob/<sha>/<path>. */
export type EditUrl = (file: string) => string | undefined;

export function githubEditUrl(repo: string, ref: string, root: string): EditUrl {
  return (file) => `https://github.com/${repo}/blob/${ref}/${path.relative(root, file).replace(/\\/g, '/')}`;
}

// ---- file helpers ----

export const walk = (dir: string, filter: (rel: string) => boolean): string[] => (fs.existsSync(dir)
  ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name))).filter(filter).sort()
  : []);
const isPage = (rel: string): boolean => /\.mdx?$/.test(rel);
const write = (file: string, text: string): void => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

/** Copy non-page files (images, attachments) keeping their paths; existing files are kept. */
export function copyAssets(fromDir: string, toDir: string, skip: string[] = []): void {
  for (const rel of walk(fromDir, (r) => !isPage(r) && !r.endsWith('.yml') && !skip.some((p) => r.startsWith(p)))) {
    const to = path.join(toDir, rel);
    if (fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(fromDir, rel), to);
  }
}

/** URL of a page on an MkDocs site, relative to the site root. */
export const mkdocsUrl = (rel: string): string => rel.replace(/\\/g, '/').replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '/');

const titleOf = (text: string, rel: string): string =>
  String(splitFrontMatter(text).data.title ?? (text.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(rel, path.extname(rel)))).replace(/[{}<>]/g, '').trim();

const resolveBase = (text: string, route: string): string => text.replaceAll(`${BASE}/`, `/${route}/`).replaceAll(BASE, `/${route}`);

/**
 * Docusaurus turns `x/x.md` and `x/README.md` into the folder's index page (URL without the last segment);
 * MkDocs does not. Pin such pages to their MkDocs URL so existing links keep working.
 */
export function keepMkdocsUrl(mdx: string, rel: string): string {
  const parts = rel.replace(/\\/g, '/').replace(/\.mdx?$/, '').split('/');
  const name = parts.at(-1) ?? '';
  const collides = /^readme$/i.test(name) || (parts.length > 1 && name.toLowerCase() === (parts.at(-2) ?? '').toLowerCase());
  if (!collides || /^slug:/m.test(mdx.split('\n---')[0] ?? '')) return mdx;
  return mdx.replace(/^---\n/, `---\nslug: /${parts.join('/')}/\n`);
}

async function emit(out: SiteOutput, report: SiteReport, rel: string, produce: () => Promise<string>, fallback: Omit<FallbackInfo, 'rel'>): Promise<void> {
  const file = path.join(out.outDir, rel.replace(/\.mdx$/, '.md'));
  const excluded = (out.exclude ?? []).includes(rel);
  const writeFallback = (): void => {
    const page = out.fallback?.({ rel, ...fallback });
    if (page) { write(file, keepMkdocsUrl(page, rel)); report.redirected++; }
  };
  try {
    const mdx = keepMkdocsUrl(await produce(), rel);
    // An excluded page stays a fallback until it is taken off the list: it may pass conversion and still fail
    // the Docusaurus build.
    if (excluded) { report.nowPassing.push(rel); writeFallback(); return; }
    write(file, mdx);
    report.ok++;
  } catch (e) {
    const kind: PageErrorKind = e instanceof PageError ? e.kind : 'template';
    report.failures.push({ page: rel, kind, error: (e as Error).message.slice(0, 200) });
    writeFallback();
  }
}

// ---- MkDocs ----

export interface MkdocsSiteOptions extends DeploymentDefaults {
  /** Repository checkout; includes never resolve outside it. */
  root: string;
  /** Path of mkdocs.yml inside root. */
  mkdocs: string;
  /** Page URL prefix on the product's current site (fallback targets). */
  currentSite?: string;
  editUrl?: EditUrl;
  /** Path prefixes of the pages to take (several sections may share one source). */
  only?: string;
  skip?: string[];
  nav?: NavSelection;
  iframeHosts?: readonly string[];
}

/** Convert one MkDocs site. Returns sidebar items (ids relative to the section) and the report. */
export async function convertMkdocsSite(src: MkdocsSiteOptions, out: SiteOutput): Promise<{ sidebar: SidebarItem[]; report: SiteReport }> {
  const report = out.report ?? emptyReport();
  const site = mkdocsSite(path.join(src.root, src.mkdocs));
  const source = { root: src.root, includeBases: site.includeBases };
  const prefix = out.prefix ?? '';
  const route = prefix ? `${out.route}/${prefix}` : out.route;
  const withPrefix = (rel: string): string => (prefix ? `${prefix}/${rel}` : rel);
  const wanted = (r: string): boolean => r.endsWith('.md') && (!src.only || r.startsWith(src.only)) && !(src.skip ?? []).some((p) => r.startsWith(p));
  for (const rel of walk(site.docsDir, wanted)) {
    const file = path.join(site.docsDir, rel);
    const raw = fs.readFileSync(file, 'utf8');
    const deploymentOptions = optionsFor(src, rel);
    await emit(out, report, withPrefix(rel), async () => {
      const env = { ...site.extra, config: site.config, base_path: BASE };
      const rendered = resolveBase(renderSingle(loadPage(file, source), env, file, source), route);
      return (await convertRendered(rendered, { deploymentOptions, editUrl: src.editUrl?.(file), pageData: readPageData(file, source), iframeHosts: src.iframeHosts })).mdx;
    }, { title: titleOf(raw, rel), to: (src.currentSite ?? '') + mkdocsUrl(rel), deploymentOptions });
  }
  if (out.staticDir) copyAssets(site.docsDir, prefix ? path.join(out.staticDir, prefix) : out.staticDir, src.skip);
  copyAssets(site.docsDir, prefix ? path.join(out.outDir, prefix) : out.outDir, src.skip);
  const nav = selectNav(site.nav, src.nav);
  const items = navToSidebar(nav, (id) => fs.existsSync(path.join(out.outDir, `${withPrefix(id)}.md`)), report.droppedNav);
  return { sidebar: prefix ? prefixIds(items, prefix) : items, report };
}

// ---- Cloud + self-hosted merge ----

export interface MergeSideOptions { root: string; mkdocs: string; currentSite?: string; editUrl?: EditUrl }

export interface MergedSitesOptions {
  cloud: MergeSideOptions;
  self: MergeSideOptions;
  /** Text for a variable that differs but sits in shared text (product_name -> "WSO2 Identity Platform"). */
  sharedNames?: Record<string, string>;
  iframeHosts?: readonly string[];
}

/** Convert a cloud and a self-hosted MkDocs site that share templates into one set of pages. */
export async function convertMergedSites(opts: MergedSitesOptions, out: SiteOutput): Promise<{ sidebar: SidebarItem[]; report: SiteReport }> {
  const report = out.report ?? emptyReport();
  const side = (o: MergeSideOptions) => {
    const site = mkdocsSite(path.join(o.root, o.mkdocs));
    return { o, site, source: { root: o.root, includeBases: site.includeBases }, pages: new Set(walk(site.docsDir, (r) => r.endsWith('.md'))) };
  };
  const c = side(opts.cloud);
  const s = side(opts.self);
  const envOf = (x: ReturnType<typeof side>) => ({ ...x.site.extra, config: x.site.config, base_path: BASE });
  for (const rel of [...new Set([...c.pages, ...s.pages])].sort()) {
    const inC = c.pages.has(rel);
    const inS = s.pages.has(rel);
    const deploymentOptions = inC && inS ? [CLOUD, SELF_HOSTED] : inC ? [CLOUD] : [SELF_HOSTED];
    const primary = inC ? c : s;
    const file = path.join(primary.site.docsDir, rel);
    await emit(out, report, rel, async () => {
      let text: string;
      if (inC && inS) {
        const merged = mergePage(path.join(c.site.docsDir, rel), path.join(s.site.docsDir, rel),
          { cloud: { env: envOf(c), source: c.source }, self: { env: envOf(s), source: s.source } }, opts.sharedNames ?? {});
        text = merged.text;
        report.merge.splitBlocks += merged.stats.splitBlocks;
        if (merged.stats.diverged) report.merge.diverged++;
      } else {
        text = renderSingle(loadPage(file, primary.source), envOf(primary), file, primary.source);
      }
      // Page data: the cloud wrapper's front matter and quick-start meta win; self-hosted fills gaps.
      const cData = inC ? readPageData(path.join(c.site.docsDir, rel), c.source) : undefined;
      const sData = inS ? readPageData(path.join(s.site.docsDir, rel), s.source) : undefined;
      const pageData = { frontMatter: { ...(sData?.frontMatter ?? {}), ...(cData?.frontMatter ?? {}) }, meta: cData?.meta ?? sData?.meta };
      return (await convertRendered(resolveBase(text, out.route), { deploymentOptions, editUrl: primary.o.editUrl?.(file), pageData, iframeHosts: opts.iframeHosts })).mdx;
    }, { title: titleOf(fs.readFileSync(file, 'utf8'), rel), to: (primary.o.currentSite ?? '') + mkdocsUrl(rel), deploymentOptions });
  }
  for (const dir of [out.staticDir, out.outDir]) {
    if (!dir) continue;
    copyAssets(c.site.docsDir, dir);
    copyAssets(s.site.docsDir, dir);
  }
  const known = (id: string): boolean => fs.existsSync(path.join(out.outDir, `${id}.md`));
  return { sidebar: mergeSidebars(navToSidebar(c.site.nav, known, report.droppedNav), navToSidebar(s.site.nav, known, report.droppedNav)), report };
}

// ---- Existing Docusaurus docs ----

/**
 * Evaluate a Docusaurus sidebars file (.ts/.js/.json) from its checkout; returns { sidebarId: items }.
 * A .ts/.js file is code from the content source (as Docusaurus itself would run it): pin and review it.
 */
export function loadSidebarFile(file: string): Record<string, SidebarInput[]> {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, SidebarInput[]>;
  const require = createRequire(import.meta.url);
  const createJiti = require('jiti') as (from: string, opts: Record<string, unknown>) => (id: string) => { default?: unknown };
  const load = createJiti(file, { interopDefault: true, cache: false });
  const mod = load(file);
  return (mod.default ?? mod) as Record<string, SidebarInput[]>;
}

export interface DocusaurusDocsOptions extends DeploymentDefaults {
  root: string;
  /** Docs folder inside root. */
  docs: string;
  /** Sidebars file inside root (.json, .js or .ts). */
  sidebar: string;
  currentSite?: string;
  editUrl?: EditUrl;
  /** Component imports to replace, for example the source site's own components with site stand-ins. */
  shims?: Record<string, string>;
}

/**
 * Prepare an existing Docusaurus docs folder for the site: deployment options and edit links in front matter,
 * images under the section route, `.mdx` links and imports written as `.md`, shims for source-only components,
 * and a CommonMark fallback for pages that fail to compile.
 */
export async function prepareDocusaurusDocs(src: DocusaurusDocsOptions, out: SiteOutput): Promise<{ sidebarId: string; sidebar: SidebarInput[]; report: SiteReport }> {
  const report = out.report ?? emptyReport();
  const docsDir = path.join(src.root, src.docs);
  for (const rel of walk(docsDir, isPage)) {
    const file = path.join(docsDir, rel);
    const raw = fs.readFileSync(file, 'utf8');
    const deploymentOptions = optionsFor(src, rel);
    await emit(out, report, rel, async () => {
      const { data, body } = splitFrontMatter(raw);
      let text = body;
      for (const [from, to] of Object.entries(src.shims ?? {})) text = text.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`);
      text = text.replace(/(\]\(|src=["'{]?["']?)\/(img|images|assets)\//g, `$1/${out.route}/$2/`);
      text = text.replace(/(\]\((?!https?:)[^)\s]*?)\.mdx(?=[)#])/g, '$1.md'); // pages are written as .md
      text = text.replace(/(from\s+['"]\.{1,2}\/[^'"]*?)\.mdx(['"])/g, '$1.md$2');
      const edit = src.editUrl?.(file);
      const front = { ...data, deployment_options: data.deployment_options ?? deploymentOptions, ...(edit ? { custom_edit_url: edit } : {}) };
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
    }, { title: titleOf(raw, rel), to: (src.currentSite ?? '') + rel.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '$1'), deploymentOptions });
  }
  if (out.staticDir) copyAssets(docsDir, out.staticDir);
  copyAssets(docsDir, out.outDir);
  const staticSrc = path.join(src.root, path.dirname(src.docs) === '.' ? 'static' : path.join(path.dirname(src.docs), 'static'));
  if (out.staticDir) copyAssets(staticSrc, out.staticDir);
  const sidebars = loadSidebarFile(path.join(src.root, src.sidebar));
  const [sidebarId, items] = Object.entries(sidebars)[0] ?? ['docs', []];
  return { sidebarId, sidebar: items, report };
}
