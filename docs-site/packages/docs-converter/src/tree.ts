// The Docusaurus tree a content source keeps once it migrates (docs-is: `docusaurus/`), written from the converted
// output of each of its versions: Latest in docs/, older versions in versioned_docs/ with their sidebars. Every page
// is an .mdx file holding the explicit content components (conventions.ts writes them where a page still follows a
// convention); links between pages and lifecycle replacements name the .mdx files. Doc ids, URLs and sidebars do not
// change.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { walk, encodePath } from './site.js';
import { outsideCode } from './syntax.js';
import { splitFrontMatter } from './page.js';
import { subStepReview, writeComponents } from './conventions.js';

export interface TreeVersion {
  /** Release, three segments (7.3.0). */
  version: string;
  /** URL base of the version's pages on the docs site: `identity` for Latest, `identity/7.2.0` for an older one. */
  route: string;
  /** Converted pages, partials and page-relative assets of the version. */
  docsDir: string;
  /** Files the version's pages reference by absolute URL under `/<route>/`. */
  staticDir?: string;
  /** The version's sidebar file content: `{ sidebarId: items }`. */
  sidebar: Record<string, unknown>;
  /** MkDocs `redirect_maps` of the version: old page -> new page or URL. */
  redirects?: Record<string, string>;
  /** Branch "Edit this page" opens for this version (one kept on its own branch); unset: the tree's editBranch. */
  editBranch?: string;
}

/** What a tree run leaves for a writer: nested Steps to review (file under the tree root, line of the nested </Steps>). */
export interface TreeResult { review: Array<{ file: string; line: number }> }

export interface TreeOptions {
  /** URL base of the product's Latest pages (`identity`). */
  route: string;
  /** Branch "Edit this page" opens (`master`); links pinned to a commit become edit links on it. Unset: kept. */
  editBranch?: string;
}

/**
 * Files shared by path across versions: the newest version using a path holds it at `<dir>/<key>`; an older version
 * whose copy differs keeps its own at `<dir>/_versions/<version>/<key>`. Versions arrive newest first.
 */
class SharedFiles {
  private readonly holders = new Map<string, string>();
  constructor(private readonly outRoot: string, private readonly dir: string) {}

  /** Store `file` for `version` under `key`; returns its path under the tree root. */
  place(key: string, file: string, version: string): string {
    const bytes = fs.readFileSync(file);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const held = this.holders.get(key);
    const rel = held === undefined || held === hash ? `${this.dir}/${key}` : `${this.dir}/_versions/${version}/${key}`;
    if (held === undefined) this.holders.set(key, hash);
    const dest = path.join(this.outRoot, rel);
    if (!fs.existsSync(dest)) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes); }
    return rel;
  }
}

const safeDecode = (s: string): string | undefined => { try { return decodeURI(s); } catch { return undefined; } };
/** A file inside `root` (never outside it), or undefined. */
const fileIn = (root: string | undefined, rel: string): string | undefined => {
  if (!root || /\.mdx?\/*$/.test(rel) || rel.endsWith('/')) return undefined; // pages and folders are never assets
  const file = path.resolve(root, rel);
  return file.startsWith(path.resolve(root) + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : undefined;
};

// A space may follow the parenthesis (`]( /p/x.png)`): CommonMark allows it, and sources use it.
const MD_TARGET = /(\]\()\s*([^)\s]+)((?:\s+"[^"]*")?\))/g;
// HTML forms `src="…"` and `src='…'`, and the JSX form the converter writes for HTML blocks, `src={"…"}`.
const URL_ATTR = /(\b(?:src|href|spec)=\{?(["']))((?:(?!\2)[^#])(?:(?!\2).)*)(\2\}?)/g;

/** URL path of a page inside its version (`/guides/setup/`): its front matter slug, else Docusaurus's default. */
function pageUrl(rel: string, text: string): string {
  const slug = text.match(/^---\n[\s\S]*?^slug:\s*(\S+)\s*$[\s\S]*?^---$/m)?.[1]?.replace(/^["']|["']$/g, '');
  if (slug) return `/${slug.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  const id = rel.replace(/\.mdx?$/, '');
  const dir = path.posix.dirname(id);
  const base = /(?:^|\/)(?:index|README)$/i.test(id) ? (dir === '.' ? '' : dir) : id;
  return base ? `/${base}/` : '/';
}

/**
 * Drop `@site/` and `@theme/` imports from the top of a page (front matter, then imports): the docs site registers
 * those components globally. Relative imports (partials) stay.
 */
export function withoutComponentImports(text: string): string {
  const head = text.match(/^(?:---\n[\s\S]*?\n---\n)?(?:[ \t]*\n|import [^\n]*\n)*/)![0];
  const lines = head.split('\n').filter((l) => !/^import \w+ from ['"]@(?:site|theme)\/[^'"]+['"];?\s*$/.test(l));
  const kept = lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
  const rest = text.slice(head.length);
  if (!kept.trim()) return rest;
  return `${kept.replace(/\n*$/, '\n')}\n${rest}`;
}

/** `https://github.com/o/r/blob/<sha>/path` in the front matter -> `https://github.com/o/r/edit/<branch>/path`. */
function editOnBranch(text: string, branch: string): string {
  const fm = text.match(/^---\n[\s\S]*?\n---\n/)?.[0];
  if (!fm) return text;
  return fm.replace(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/blob\/[0-9a-f]{40}\//g, `https://github.com/$1/edit/${branch}/`) + text.slice(fm.length);
}

const withSlash = (p: string): string => (p.endsWith('/') ? p : `${p}/`);

/** A page's file name in the tree: every page is .mdx (partials already are). */
const asMdx = (rel: string): string => rel.replace(/\.md$/, '.mdx');

/** Lifecycle `replacement:` values in front matter naming a page of the version (relative `.md`): the page's .mdx. */
function mdxReplacements(text: string, pageDir: string, isPage: (rel: string) => boolean): string {
  const fm = text.match(/^---\n[\s\S]*?\n---\n/)?.[0];
  if (!fm) return text;
  return fm.replace(/^([ \t]*replacement:[ \t]*)(\S+?\.md)((?:#\S*)?)[ \t]*$/gm, (m, key: string, file: string, hash: string) =>
    (!/^[a-z][a-z0-9+.-]*:|^\//i.test(file) && isPage(path.posix.join(pageDir, file)) ? `${key}${asMdx(file)}${hash}` : m)) + text.slice(fm.length);
}

/** The explicit components written into a page's body (front matter kept; CommonMark pages cannot hold them). */
function withComponents(text: string): string {
  const fm = text.match(/^---\n[\s\S]*?\n---\n/)?.[0] ?? '';
  const { data } = splitFrontMatter(text);
  if ((data.mdx as { format?: unknown } | undefined)?.format === 'md') return text;
  return fm + writeComponents(text.slice(fm.length), { frontMatter: data }).text;
}

const write = (file: string, text: string): void => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Marks a folder as a generated tree, which a later run may replace. */
export const TREE_MARKER = '.wso2-docs-tree';

/** Empty `outRoot` for a fresh tree: only when it is missing, empty, or a tree an earlier run wrote. */
function prepareOut(outRoot: string): void {
  if (fs.existsSync(outRoot) && fs.readdirSync(outRoot).length) {
    if (!fs.existsSync(path.join(outRoot, TREE_MARKER))) throw new Error(`${outRoot} is not a tree written by wso2-docs; refusing to replace it`);
    fs.rmSync(outRoot, { recursive: true });
  }
  write(path.join(outRoot, TREE_MARKER), 'Generated by wso2-docs (writeDocusaurusTree). Regenerate instead of editing until cutover.\n');
}

/**
 * Write the tree for `versions`, newest first (the first is Latest), into `outRoot`. The output depends only on the
 * input: pages and versions are visited in a fixed order, so the same input gives the same tree.
 */
export function writeDocusaurusTree(versions: TreeVersion[], outRoot: string, opts: TreeOptions): TreeResult {
  const review: TreeResult['review'] = [];
  for (const b of [opts.editBranch, ...versions.map((v) => v.editBranch)]) {
    if (b !== undefined && !/^[A-Za-z0-9._\/-]+$/.test(b)) throw new Error(`Invalid edit branch: ${b}`);
  }
  prepareOut(outRoot);
  const assets = new SharedFiles(outRoot, 'assets');
  const statics = new SharedFiles(outRoot, 'static');
  for (const [i, v] of versions.entries()) {
    const latest = i === 0;
    const pagesRoot = latest ? 'docs' : `versioned_docs/version-${v.version}`;
    const pageFiles = walk(v.docsDir, (r) => /\.mdx?$/.test(r)).sort();
    const pageAt = new Map<string, string>();
    const pages = new Set<string>();
    for (const rel of pageFiles) {
      if (!rel.startsWith('_partials/')) { pageAt.set(pageUrl(rel, fs.readFileSync(path.join(v.docsDir, rel), 'utf8')), rel); pages.add(rel); }
    }
    for (const rel of pageFiles) {
      const pageDir = path.posix.dirname(rel);
      const outDir = path.posix.join(pagesRoot, pageDir);
      const raw = fs.readFileSync(path.join(v.docsDir, rel), 'utf8');
      /** Where a browser on this page takes an attribute's URL (absolute stays; relative resolves against the page URL). */
      const resolveUrl = (target: string): string => (target.startsWith('/') ? target : path.posix.resolve(`/${v.route}${pageUrl(rel, raw)}`, target));
      // Markdown link and image targets naming a file the version holds: point them at the shared copy.
      const text = outsideCode(withoutComponentImports(raw), (t) => t.replace(MD_TARGET, (m, pre: string, url: string, post: string) => {
        const target = safeDecode(url.split('#')[0]!);
        if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return m;
        if (/\.mdx?\/*$/.test(target)) {
          // A relative link to a page file of this version: its .mdx name.
          return target.endsWith('.md') && !target.startsWith('/') && pages.has(path.posix.join(pageDir, target)) ? m.replace(/\.md(?=[#)\s"])/, '.mdx') : m;
        }
        // A page of this version: a relative file link, which Docusaurus resolves within the version.
        const linked = target === `/${v.route}` || target.startsWith(`/${v.route}/`) ? pageAt.get(withSlash(`/${target.slice(v.route.length + 2)}`)) : undefined;
        if (linked) return `${pre}${encodePath(path.posix.relative(pageDir, asMdx(linked)))}${url.includes('#') ? url.slice(url.indexOf('#')) : ''}${post}`;
        let fromDocs = target.startsWith(`/${v.route}/`) ? target.slice(v.route.length + 2) : target.startsWith('/') ? undefined : path.posix.join(pageDir, target);
        let file = fromDocs !== undefined ? fileIn(v.docsDir, fromDocs) : undefined;
        if (!file && !target.startsWith('/')) {
          // MkDocs pages often write file links relative to the page URL (`../../assets/x` from `/a/b/`), as a browser reads them.
          const viaUrl = resolveUrl(target);
          fromDocs = viaUrl.startsWith(`/${v.route}/`) ? viaUrl.slice(v.route.length + 2) : undefined;
          file = fromDocs !== undefined ? fileIn(v.docsDir, fromDocs) : undefined;
        }
        if (file && fromDocs && /\.html?$/i.test(fromDocs)) {
          // Docusaurus never bundles a linked .html file, so it needs a URL, as attributes do.
          return `${pre}/${opts.route}/${encodePath(statics.place(fromDocs, file, v.version).slice('static/'.length))}${post}`;
        }
        if (file && fromDocs) {
          const stored = assets.place(fromDocs.replace(/^assets\//, ''), file, v.version);
          return `${pre}${encodePath(path.posix.relative(outDir, stored))}${post}`;
        }
        // Only in the version's static files: keep a URL, as attributes do.
        const key = target.startsWith(`/${v.route}/`) ? target.slice(v.route.length + 2) : undefined;
        const asStatic = key !== undefined ? fileIn(v.staticDir, key) : undefined;
        return asStatic ? `${pre}/${opts.route}/${encodePath(statics.place(key!, asStatic, v.version).slice('static/'.length))}${post}` : m;
      }).replace(URL_ATTR, (m, pre: string, _quote: string, url: string, post: string) => {
        // Attributes need a URL: the file goes to static/, served under the product's route.
        const [decoded, anchor] = [safeDecode(url.split('#')[0]!), url.includes('#') ? url.slice(url.indexOf('#')) : ''];
        if (!decoded || /^[a-z][a-z0-9+.-]*:/i.test(decoded) || decoded.startsWith('//')) return m;
        const target = resolveUrl(decoded);
        if (!target.startsWith(`/${v.route}/`)) return m;
        const key = target.slice(v.route.length + 2);
        // A file copied with the pages (docs folder) or one only in the version's static files.
        const file = fileIn(v.docsDir, key) ?? fileIn(v.staticDir, key);
        if (!file) return m;
        return `${pre}/${opts.route}/${encodePath(statics.place(key, file, v.version).slice('static/'.length))}${anchor}${post}`;
      }));
      const outRel = asMdx(rel);
      const branch = v.editBranch ?? opts.editBranch;
      const final = withComponents(mdxReplacements(branch ? editOnBranch(text, branch) : text, pageDir, (p) => pages.has(p)));
      write(path.join(outRoot, pagesRoot, outRel), final);
      const fm = final.match(/^---\n[\s\S]*?\n---\n/)?.[0] ?? '';
      const fmLines = fm.split('\n').length - 1;
      for (const line of subStepReview(final.slice(fm.length))) review.push({ file: path.posix.join(pagesRoot, outRel), line: line + fmLines });
    }
    write(path.join(outRoot, latest ? 'sidebars.json' : `versioned_sidebars/version-${v.version}-sidebars.json`), json(v.sidebar));
  }
  write(path.join(outRoot, 'versions.json'), json(versions.slice(1).map((v) => v.version)));
  const redirects = Object.fromEntries(versions.flatMap((v, i) => (v.redirects && Object.keys(v.redirects).length
    ? [[i === 0 ? 'current' : v.version, Object.fromEntries(Object.entries(v.redirects).sort(([a], [b]) => a.localeCompare(b)))]] : [])));
  if (Object.keys(redirects).length) write(path.join(outRoot, 'redirects.json'), json(redirects));
  return { review };
}
