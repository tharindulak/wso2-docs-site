// Convert a whole documentation source: an MkDocs site, a cloud + self-hosted pair merged page by page, or an
// existing Docusaurus docs folder. Used by the docs site's build and by the `wso2-docs` CLI in team repos.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';
import { mkdocsSite } from './mkdocs-config.js';
import { loadPage, loadPlain, renderSingle, readPageData } from './render.js';
import { mergePage, CLOUD, SELF_HOSTED } from './merge.js';
import { outsideCode } from './syntax.js';
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

const IMAGE = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

/** Markdown images at /<route>/<file> become page-relative, so Docusaurus emits them content-hashed (shared across versions). */
export function relativeImages(mdx: string, pageRel: string, route: string, exists: (assetRel: string) => boolean): string {
  const prefix = `/${route}/`;
  return outsideCode(mdx, (t) => t.replace(/(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g, (m, pre: string, url: string, post: string) => {
    if (!url.startsWith(prefix) || !IMAGE.test(url)) return m;
    const asset = decodeURI(url.slice(prefix.length));
    if (!exists(asset)) return m;
    const rel = path.posix.relative(path.posix.dirname(pageRel.replace(/\\/g, '/')), asset);
    return `${pre}${rel}${post}`;
  }));
}

const safeDecode = (s: string): string | undefined => { try { return decodeURI(s); } catch { return undefined; } };

/**
 * Relative file references: HTML src/href and <ApiReference spec> (`attr="x"` or `attr={"x"}`), and Markdown links and
 * images. Docusaurus bundles a Markdown target only when it exists relative to the page file; otherwise the link stays
 * as written and the browser resolves it against the page URL, as on MkDocs.
 */
const RELATIVE_REF = /\b(?:src|href|spec)=\{?"((?![a-z][a-z0-9+.-]*:|\/|#|\s)[^"<>{}\n]+)"|\]\(\s*<?((?![a-z][a-z0-9+.-]*:|\/|#)[^)\s<>]+)>?(?:\s+"[^"]*")?\)/gi;

/**
 * Files a page references, as paths relative to the section route: absolute `/<route>/<file>` references, and
 * relative HTML `src`/`href` and `<ApiReference spec>` resolved against the page's directory URL (as a browser
 * does, and as specInfoFor does). References that resolve outside the route are left out.
 */
export function referencedFiles(text: string, pageRel: string, route: string): string[] {
  const found: string[] = [];
  const add = (p: string | undefined): void => { if (p && /\.[A-Za-z0-9]+$/.test(p)) found.push(p); };
  const re = new RegExp(`/${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^\\s"'()<>{}#?]+\\.[A-Za-z0-9]+)`, 'g');
  for (const m of text.matchAll(re)) add(safeDecode(m[1]!));
  const pageDir = `/${route}/${mkdocsUrl(pageRel.replace(/\.mdx$/, '.md'))}`.replace(/\/?$/, '/');
  for (const m of text.matchAll(RELATIVE_REF)) {
    const ref = safeDecode((m[1] ?? m[2])!.trim().replace(/[?#].*$/, ''));
    if (!ref) continue;
    const resolved = path.posix.resolve(pageDir, ref);
    if (resolved.startsWith(`/${route}/`)) add(resolved.slice(route.length + 2));
  }
  return found;
}

/** Copy to the static folder only the files pages reference (absolute /<route>/<file>, or relative from HTML and API specs). */
export function copyReferencedAssets(fromDir: string, pagesDir: string, toDir: string, route: string): number {
  const wanted = new Set<string>();
  for (const rel of walk(pagesDir, isPage)) for (const f of referencedFiles(fs.readFileSync(path.join(pagesDir, rel), 'utf8'), rel, route)) wanted.add(f);
  let copied = 0;
  for (const rel of wanted) {
    const from = path.join(fromDir, rel);
    if (!path.resolve(from).startsWith(path.resolve(fromDir) + path.sep) || !fs.statSync(from, { throwIfNoEntry: false })?.isFile() || isPage(rel)) continue;
    const to = path.join(toDir, rel);
    if (!path.resolve(to).startsWith(path.resolve(toDir) + path.sep) || fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
  }
  return copied;
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

// ---- OpenAPI specs behind <ApiReference> ----

const specCache = new Map<string, { title?: string; description?: string } | undefined>();

function readSpecInfo(file: string): { title?: string; description?: string } | undefined {
  if (specCache.has(file)) return specCache.get(file);
  let info: { title?: string; description?: string } | undefined;
  try {
    const doc = yaml.load(fs.readFileSync(file, 'utf8')) as { info?: { title?: unknown; description?: unknown } } | null;
    const title = typeof doc?.info?.title === 'string' ? doc.info.title.trim() : undefined;
    const raw = typeof doc?.info?.description === 'string' ? doc.info.description : '';
    // First paragraph as plain text: no Markdown, HTML or line breaks.
    const first = raw.split(/\n\s*\n/)[0]!.replace(/<[^>]+>/g, '').replace(/[*_`#>]|\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
    info = { title, description: first ? (first.length > 200 ? `${first.slice(0, 197)}...` : first) : undefined };
  } catch { info = undefined; }
  specCache.set(file, info);
  return info;
}

/**
 * Resolve <ApiReference spec> to the spec file in the docs folder(s), the way the page's URL resolves it:
 * absolute site paths under the section route, or relative to the page's directory URL (MkDocs and the docs
 * site both use directory URLs). Never outside a docs folder.
 */
function specInfoFor(docsDirs: string[], route: string, rel: string): (spec: string) => { title?: string; description?: string } | undefined {
  return (spec) => {
    const pageDir = `/${mkdocsUrl(rel)}`.replace(/\/?$/, '/');
    const sitePath = spec.startsWith('/') ? (spec.startsWith(`/${route}/`) ? spec.slice(route.length + 1) : spec) : path.posix.resolve(pageDir, spec);
    for (const dir of docsDirs) {
      const file = path.join(dir, sitePath);
      if (!path.resolve(file).startsWith(path.resolve(dir) + path.sep) || !fs.existsSync(file)) continue;
      return readSpecInfo(file);
    }
    return undefined;
  };
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
  /** Page URL prefix on the product's current site (fallback targets); with docsRoot, the URL of that folder. */
  currentSite?: string;
  editUrl?: EditUrl;
  /** Path prefixes of the pages to take (several sections may share one source). */
  only?: string;
  skip?: string[];
  nav?: NavSelection;
  iframeHosts?: readonly string[];
  /**
   * Folder inside docs_dir that is the section root (a component's version folder, for example api-gateway/1.2.0/):
   * page paths, nav ids, `only`, `skip`, `exclude` and deployment overrides are relative to it.
   */
  docsRoot?: string;
  /**
   * Site URL of a page outside docsRoot, from its docs_dir path (for example policy-hub/overview.md); null leaves
   * the link as written. Files outside docsRoot that pages reference are copied into the section's _shared/ folder.
   */
  linkOutside?: (docsPath: string) => string | null;
}

/** The folder pages are read from: docs_dir, or docsRoot inside it (then never outside the repository checkout). */
export function pagesDir(root: string, docsDir: string, docsRoot?: string): string {
  if (!docsRoot) return docsDir;
  const real = (p: string): string => fs.realpathSync(p);
  const inside = (p: string, dir: string): boolean => p === dir || p.startsWith(dir + path.sep);
  if (!fs.existsSync(docsDir) || !inside(real(docsDir), real(root))) throw new Error(`docs_dir is outside the content source: ${docsDir}`);
  const dir = path.resolve(docsDir, docsRoot);
  if (!inside(dir, path.resolve(docsDir)) || dir === path.resolve(docsDir) || !fs.existsSync(dir) || !inside(real(dir), real(docsDir))) {
    throw new Error(`docs_root must be a folder inside docs_dir: ${docsRoot}`);
  }
  return dir;
}

const SHARED = '_shared';

/**
 * References from a page to files the section does not take (outside docsRoot, or filtered out by only/skip):
 * Markdown links and images resolve against the page file, HTML src/href against the page URL (as MkDocs serves
 * them). Pages map through linkOutside; files are copied into <outDir>/_shared/ (and <staticDir>/_shared/ for HTML
 * references) and point there. Anything resolving outside docs_dir, or not found, stays as written.
 */
export function rewriteOutsideRefs(mdx: string, ctx: {
  /** Output path of the page (section-relative) and its path in docs_dir. */
  rel: string; pageSrc: string; docsDir: string; route: string; outDir: string; staticDir?: string;
  /** Whether the section takes this docs_dir path (a page, or a file copied with the pages). */
  inside: (docsPath: string, page: boolean) => boolean;
  linkOutside?: (docsPath: string) => string | null;
}): string {
  const pageSrc = ctx.pageSrc.replace(/\\/g, '/');
  const realDocs = fs.realpathSync(ctx.docsDir);
  const copy = (docsPath: string, toDir: string): void => {
    const to = path.join(toDir, SHARED, docsPath);
    if (fs.existsSync(to)) return;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ctx.docsDir, docsPath), to);
  };
  const fileInDocs = (docsPath: string): boolean => {
    const file = path.join(ctx.docsDir, docsPath);
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    return Boolean(stat?.isFile()) && fs.realpathSync(file).startsWith(realDocs + path.sep);
  };
  const target = (ref: string, html: boolean): string | null => {
    const [, p = '', suffix = ''] = ref.match(/^([^?#]*)(.*)$/) ?? [];
    const decoded = safeDecode(p);
    if (!decoded || decoded.includes('\0')) return null;
    const from = html ? mkdocsUrl(pageSrc) : path.posix.dirname(pageSrc);
    const resolved = path.posix.normalize(path.posix.join(from, decoded));
    if (resolved === '..' || resolved.startsWith('../')) return null; // outside docs_dir
    const page = /\.md$/.test(resolved) || (!html && !/\.[A-Za-z0-9]+$/.test(resolved));
    if (ctx.inside(resolved, page)) return null;
    if (page) {
      const url = ctx.linkOutside?.(resolved);
      return url ? `${url}${suffix}` : null;
    }
    if (isPage(resolved) || !fileInDocs(resolved)) return null;
    copy(resolved, ctx.outDir);
    if (html) {
      if (ctx.staticDir) copy(resolved, ctx.staticDir);
      return `/${ctx.route}/${SHARED}/${resolved}${suffix}`;
    }
    return `${path.posix.relative(path.posix.dirname(ctx.rel.replace(/\\/g, '/')), `${SHARED}/${resolved}`)}${suffix}`;
  };
  return outsideCode(mdx, (t) => t.replace(RELATIVE_REF, (m, htmlRef?: string, mdRef?: string) => {
    if (htmlRef !== undefined && !/^(?:src|href)=/i.test(m)) return m;
    const ref = (htmlRef ?? mdRef)!.trim();
    const to = target(ref, htmlRef !== undefined);
    return to === null ? m : m.replace(ref, to);
  }));
}

/** Convert one MkDocs site. Returns sidebar items (ids relative to the section) and the report. */
export async function convertMkdocsSite(src: MkdocsSiteOptions, out: SiteOutput): Promise<{ sidebar: SidebarItem[]; report: SiteReport }> {
  const report = out.report ?? emptyReport();
  const site = mkdocsSite(path.join(src.root, src.mkdocs));
  const pages = pagesDir(src.root, site.docsDir, src.docsRoot);
  const source = { root: src.root, includeBases: site.includeBases };
  const prefix = out.prefix ?? '';
  const route = prefix ? `${out.route}/${prefix}` : out.route;
  const withPrefix = (rel: string): string => (prefix ? `${prefix}/${rel}` : rel);
  const wanted = (r: string): boolean => r.endsWith('.md') && (!src.only || r.startsWith(src.only)) && !(src.skip ?? []).some((p) => r.startsWith(p));
  const docsRoot = src.docsRoot?.replace(/\\/g, '/').replace(/\/?$/, '/');
  // A docs_dir path the section takes: under docsRoot (its own filters apply below it), else a page it keeps or an asset it copies.
  const inside = (docsPath: string, page: boolean): boolean => {
    if (docsRoot && !docsPath.startsWith(docsRoot)) return false;
    const rel = docsRoot ? docsPath.slice(docsRoot.length) : docsPath;
    return page ? wanted(/\.md$/.test(rel) ? rel : `${rel.replace(/\/$/, '')}/index.md`) || wanted(`${rel.replace(/\/$/, '')}.md`) : !(src.skip ?? []).some((p) => rel.startsWith(p));
  };
  for (const rel of walk(pages, wanted)) {
    const file = path.join(pages, rel);
    const raw = fs.readFileSync(file, 'utf8');
    const deploymentOptions = optionsFor(src, rel);
    await emit(out, report, withPrefix(rel), async () => {
      const env = { ...site.extra, config: site.config, base_path: BASE };
      const rendered = resolveBase(renderSingle((site.templating ? loadPage : loadPlain)(file, source), env, file, source), route);
      const result = await convertRendered(rendered, {
        deploymentOptions, editUrl: src.editUrl?.(file), pageData: readPageData(file, source), iframeHosts: src.iframeHosts,
        specInfo: specInfoFor([pages], route, rel),
      });
      const mdx = src.docsRoot || src.linkOutside ? rewriteOutsideRefs(result.mdx, {
        rel: withPrefix(rel), pageSrc: `${docsRoot ?? ''}${rel.replace(/\\/g, '/')}`, docsDir: site.docsDir, route: out.route,
        outDir: out.outDir, staticDir: out.staticDir, inside, linkOutside: src.linkOutside,
      }) : result.mdx;
      return relativeImages(mdx, withPrefix(rel), out.route, (a) => fs.existsSync(path.join(pages, prefix ? a.slice(prefix.length + 1) : a)));
    }, { title: titleOf(raw, rel), to: (src.currentSite ?? '') + mkdocsUrl(rel), deploymentOptions });
  }
  if (out.staticDir) copyReferencedAssets(pages, prefix ? path.join(out.outDir, prefix) : out.outDir, prefix ? path.join(out.staticDir, prefix) : out.staticDir, route);
  copyAssets(pages, prefix ? path.join(out.outDir, prefix) : out.outDir, src.skip);
  const nav = selectNav(site.nav, { ...src.nav, ...(docsRoot ? { strip: docsRoot, outside: src.linkOutside } : {}) });
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
      const result = await convertRendered(resolveBase(text, out.route), {
        deploymentOptions, editUrl: primary.o.editUrl?.(file), pageData, iframeHosts: opts.iframeHosts,
        specInfo: specInfoFor([c.site.docsDir, s.site.docsDir], out.route, rel),
      });
      return relativeImages(result.mdx, rel, out.route, (a) => fs.existsSync(path.join(c.site.docsDir, a)) || fs.existsSync(path.join(s.site.docsDir, a)));
    }, { title: titleOf(fs.readFileSync(file, 'utf8'), rel), to: (primary.o.currentSite ?? '') + mkdocsUrl(rel), deploymentOptions });
  }
  if (out.staticDir) {
    copyReferencedAssets(c.site.docsDir, out.outDir, out.staticDir, out.route);
    copyReferencedAssets(s.site.docsDir, out.outDir, out.staticDir, out.route);
  }
  copyAssets(c.site.docsDir, out.outDir);
  copyAssets(s.site.docsDir, out.outDir);
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
