import { type PageErrorKind } from './page.js';
import { type NavSelection } from './nav.js';
import { type DeploymentDefaults } from './sections.js';
import type { DeploymentOption, MkdocsNav, SidebarInput, SidebarItem } from './types.js';
export interface PageFailure {
    page: string;
    kind: PageErrorKind;
    error: string;
}
export interface SiteReport {
    ok: number;
    redirected: number;
    failures: PageFailure[];
    /** Pages on the exclude list that now convert: candidates for removal from the list. */
    nowPassing: string[];
    /** nav: entries pointing at pages that are not generated. */
    droppedNav: string[];
    merge: {
        splitBlocks: number;
        diverged: number;
    };
}
export declare const emptyReport: () => SiteReport;
/** What to write for a page that is excluded or fails: the docs site writes a redirect; the CLI writes nothing. */
export interface FallbackInfo {
    rel: string;
    title: string;
    to: string;
    deploymentOptions: DeploymentOption[];
}
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
export declare function githubEditUrl(repo: string, ref: string, root: string): EditUrl;
export declare const walk: (dir: string, filter: (rel: string) => boolean) => string[];
/** Copy non-page files (images, attachments) keeping their paths; existing files are kept. */
export declare function copyAssets(fromDir: string, toDir: string, skip?: string[]): void;
/**
 * The real path of a regular file at `rel` under `root`, or null when it is missing, not a file, or resolves
 * (through `..` or a symbolic link) outside the real `root`.
 */
export declare function containedFile(root: string, rel: string): string | null;
/** Markdown images at /<route>/<file> become page-relative, so Docusaurus emits them content-hashed (shared across versions). */
export declare function relativeImages(mdx: string, pageRel: string, route: string, exists: (assetRel: string) => boolean): string;
/**
 * Files a page references, as paths relative to the section route: absolute `/<route>/<file>` references, and
 * relative HTML `src`/`href` and `<ApiReference spec>` resolved against the page's directory URL (as a browser
 * does, and as specInfoFor does). References that resolve outside the route are left out.
 */
export declare function referencedFiles(text: string, pageRel: string, route: string): string[];
/** Copy to the static folder only the files pages reference (absolute /<route>/<file>, or relative from HTML and API specs). */
export declare function copyReferencedAssets(fromDir: string, pagesDir: string, toDir: string, route: string): number;
/** URL of a page on an MkDocs site, relative to the site root. MkDocs serves README.md as its folder's index. */
export declare const mkdocsUrl: (rel: string) => string;
/**
 * A page's title as MkDocs gives it when the page has no title and no H1: its nav label, else the file name with
 * `-` and `_` as spaces and the first letter capitalised; an index page (index.md, README.md) takes its folder's
 * name, and the home page is "Home".
 */
export declare function mkdocsTitle(rel: string, navLabel?: string): string;
/** Labels the nav gives pages, by docs_dir path without extension (the first label wins). */
export declare function navLabels(nav: MkdocsNav | undefined, acc?: Map<string, string>): Map<string, string>;
/** The origin of a base_path that is a host only (no path), else undefined. */
export declare function hostOnly(basePath: unknown): string | undefined;
/**
 * Docusaurus turns `x/x.md` and `x/README.md` into the folder's index page (URL without the last segment);
 * MkDocs does not. Pin such pages to their MkDocs URL so existing links keep working.
 */
export declare function keepMkdocsUrl(mdx: string, rel: string, { readmeIndex }?: {
    readmeIndex?: boolean;
}): string;
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
export declare function pagesDir(root: string, docsDir: string, docsRoot?: string): string;
/**
 * A decoded path written back as a URL that is safe in a Markdown link destination and in an HTML or JSX attribute:
 * every character outside RFC 3986 unreserved, `/` and a few harmless sub-delimiters is percent-encoded (space, `%`,
 * `"`, `'`, `<`, `>`, `&`, `{`, `}`, `(`, `)`, `#`, `?`, backslash and non-ASCII among them).
 */
export declare function encodePath(decoded: string): string;
/**
 * References from a page to files the section does not take (outside docsRoot, or filtered out by only/skip):
 * Markdown links and images resolve against the page file, HTML src/href against the page URL (as MkDocs serves
 * them). Pages map through linkOutside; files are copied into <outDir>/_shared/ (and <staticDir>/_shared/ for HTML
 * references) and point there. Anything resolving outside docs_dir, or not found, stays as written.
 */
export declare function rewriteOutsideRefs(mdx: string, ctx: {
    /** Output path of the page (section-relative) and its path in docs_dir. */
    rel: string;
    pageSrc: string;
    docsDir: string;
    route: string;
    outDir: string;
    staticDir?: string;
    /** Whether the section takes this docs_dir path (a page, or a file copied with the pages). */
    inside: (docsPath: string, page: boolean) => boolean;
    linkOutside?: (docsPath: string) => string | null;
}): string;
/** Convert one MkDocs site. Returns sidebar items (ids relative to the section) and the report. */
export declare function convertMkdocsSite(src: MkdocsSiteOptions, out: SiteOutput): Promise<{
    sidebar: SidebarItem[];
    report: SiteReport;
}>;
export interface MergeSideOptions {
    root: string;
    mkdocs: string;
    currentSite?: string;
    editUrl?: EditUrl;
}
export interface MergedSitesOptions {
    cloud: MergeSideOptions;
    self: MergeSideOptions;
    /** Text for a variable that differs but sits in shared text (product_name -> "WSO2 Identity Platform"). */
    sharedNames?: Record<string, string>;
    iframeHosts?: readonly string[];
}
/** Convert a cloud and a self-hosted MkDocs site that share templates into one set of pages. */
export declare function convertMergedSites(opts: MergedSitesOptions, out: SiteOutput): Promise<{
    sidebar: SidebarItem[];
    report: SiteReport;
}>;
/**
 * Evaluate a Docusaurus sidebars file (.ts/.js/.json) from its checkout; returns { sidebarId: items }.
 * A .ts/.js file is code from the content source (as Docusaurus itself would run it): pin and review it.
 */
export declare function loadSidebarFile(file: string): Record<string, SidebarInput[]>;
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
export declare function prepareDocusaurusDocs(src: DocusaurusDocsOptions, out: SiteOutput): Promise<{
    sidebarId: string;
    sidebar: SidebarInput[];
    report: SiteReport;
}>;
