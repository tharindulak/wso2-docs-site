// Convert a whole documentation source: an MkDocs site, a cloud + self-hosted pair merged page by page, or an
// existing Docusaurus docs folder. Used by the docs site's build and by the `wso2-docs` CLI in team repos.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';
import { mkdocsSite } from './mkdocs-config.js';
import { redirectMaps, writeRedirectPages } from './redirects.js';
import { loadPage, loadPlain, renderSingle, readPageData } from './render.js';
import { mergePage, CLOUD, SELF_HOSTED } from './merge.js';
import { outsideCode } from './syntax.js';
import { convertRendered, compileCheck, splitFrontMatter, PageError, withoutImports } from './page.js';
import { navToSidebar, mergeSidebars, selectNav } from './nav.js';
import { optionsFor, prefixIds } from './sections.js';
/** `{{ base_path }}` renders as this marker, then maps to the section's route. */
const BASE = '@@BASE@@';
export const emptyReport = () => ({ ok: 0, redirected: 0, failures: [], nowPassing: [], droppedNav: [], merge: { splitBlocks: 0, diverged: 0 } });
export function githubEditUrl(repo, ref, root) {
    return (file) => `https://github.com/${repo}/blob/${ref}/${path.relative(root, file).replace(/\\/g, '/')}`;
}
// ---- file helpers ----
export const walk = (dir, filter) => (fs.existsSync(dir)
    ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())
        .map((e) => path.relative(dir, path.join(e.parentPath, e.name))).filter(filter).sort()
    : []);
const isPage = (rel) => /\.mdx?$/.test(rel);
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
/** Copy non-page files (images, attachments) keeping their paths; existing files are kept. */
export function copyAssets(fromDir, toDir, skip = []) {
    for (const rel of walk(fromDir, (r) => !isPage(r) && !r.endsWith('.yml') && !skip.some((p) => r.startsWith(p)))) {
        const to = path.join(toDir, rel);
        if (fs.existsSync(to))
            continue;
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(path.join(fromDir, rel), to);
    }
}
/**
 * The real path of a regular file at `rel` under `root`, or null when it is missing, not a file, or resolves
 * (through `..` or a symbolic link) outside the real `root`.
 */
export function containedFile(root, rel) {
    try {
        const realRoot = fs.realpathSync(root);
        const lexical = path.resolve(root, rel);
        if (!lexical.startsWith(path.resolve(root) + path.sep))
            return null;
        const real = fs.realpathSync(lexical);
        if (!real.startsWith(realRoot + path.sep))
            return null;
        return fs.statSync(real).isFile() ? real : null;
    }
    catch {
        return null;
    }
}
const IMAGE = /\.(png|jpe?g|gif|svg|webp|avif)$/i;
/** Markdown images at /<route>/<file> become page-relative, so Docusaurus emits them content-hashed (shared across versions). */
export function relativeImages(mdx, pageRel, route, exists) {
    const prefix = `/${route}/`;
    return outsideCode(mdx, (t) => t.replace(/(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g, (m, pre, url, post) => {
        if (!url.startsWith(prefix) || !IMAGE.test(url))
            return m;
        const asset = decodeURI(url.slice(prefix.length));
        if (!exists(asset))
            return m;
        const rel = path.posix.relative(path.posix.dirname(pageRel.replace(/\\/g, '/')), asset);
        return `${pre}${encodePath(rel)}${post}`; // the decoded name is for the lookup only (a space would end the target)
    }));
}
const safeDecode = (s) => { try {
    return decodeURI(s);
}
catch {
    return undefined;
} };
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
export function referencedFiles(text, pageRel, route) {
    const found = [];
    const add = (p) => { if (p && /\.[A-Za-z0-9]+$/.test(p))
        found.push(p); };
    const re = new RegExp(`/${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^\\s"'()<>{}#?]+\\.[A-Za-z0-9]+)`, 'g');
    for (const m of text.matchAll(re))
        add(safeDecode(m[1]));
    const pageDir = `/${route}/${mkdocsUrl(pageRel.replace(/\.mdx$/, '.md'))}`.replace(/\/?$/, '/');
    for (const m of text.matchAll(RELATIVE_REF)) {
        const ref = safeDecode((m[1] ?? m[2]).trim().replace(/[?#].*$/, ''));
        if (!ref)
            continue;
        const resolved = path.posix.resolve(pageDir, ref);
        if (resolved.startsWith(`/${route}/`))
            add(resolved.slice(route.length + 2));
    }
    return found;
}
/** Copy to the static folder only the files pages reference (absolute /<route>/<file>, or relative from HTML and API specs). */
export function copyReferencedAssets(fromDir, pagesDir, toDir, route) {
    const wanted = new Set();
    for (const rel of walk(pagesDir, isPage))
        for (const f of referencedFiles(fs.readFileSync(path.join(pagesDir, rel), 'utf8'), rel, route))
            wanted.add(f);
    let copied = 0;
    for (const rel of wanted) {
        const from = containedFile(fromDir, rel);
        if (!from || isPage(rel))
            continue;
        const to = path.join(toDir, rel);
        if (!path.resolve(to).startsWith(path.resolve(toDir) + path.sep) || fs.existsSync(to))
            continue;
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        copied++;
    }
    return copied;
}
/** URL of a page on an MkDocs site, relative to the site root. MkDocs serves README.md as its folder's index. */
export const mkdocsUrl = (rel) => rel.replace(/\\/g, '/').replace(/(^|\/)(?:index|README)\.md$/, '$1').replace(/\.md$/, '/');
/**
 * A page's title as MkDocs gives it when the page has no title and no H1: its nav label, else the file name with
 * `-` and `_` as spaces and the first letter capitalised; an index page (index.md, README.md) takes its folder's
 * name, and the home page is "Home".
 */
export function mkdocsTitle(rel, navLabel) {
    if (navLabel?.trim())
        return navLabel.trim();
    const parts = rel.replace(/\\/g, '/').replace(/\.mdx?$/, '').split('/');
    if (/^(?:index|README)$/.test(parts.at(-1)))
        parts.pop();
    const name = parts.at(-1);
    if (!name)
        return 'Home';
    // As MkDocs get_title: capitalise only a name that is all lowercase (Python str.capitalize), else keep it as written.
    const title = name.replace(/[-_]/g, ' ').trim();
    return title.toLowerCase() === title ? title.charAt(0).toUpperCase() + title.slice(1) : title;
}
const docPath = (p) => p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.?\//, '').replace(/\.mdx?$/, '');
/** Labels the nav gives pages, by docs_dir path without extension (the first label wins). */
export function navLabels(nav, acc = new Map()) {
    for (const entry of nav ?? []) {
        if (!entry || typeof entry !== 'object')
            continue;
        for (const [label, value] of Object.entries(entry)) {
            if (typeof value === 'string') {
                if (!/^[a-z]+:/i.test(value) && !value.startsWith('/') && String(label).trim() && !acc.has(docPath(value)))
                    acc.set(docPath(value), String(label));
            }
            else if (Array.isArray(value))
                navLabels(value, acc);
        }
    }
    return acc;
}
const titleOf = (text, fallback) => String(splitFrontMatter(text).data.title ?? (text.match(/^#\s+(.+)$/m)?.[1] ?? fallback)).replace(/[{}<>]/g, '').trim();
/**
 * `{{ base_path }}` resolves to the section route. A base_path that is only a host (https://apk.docs.wso2.com) makes
 * `{{ base_path }}/en/<version>/...` a full former-site URL, which the docs site maps to its page like any other.
 */
const resolveBase = (text, route, host) => (host ? text.replace(new RegExp(`${BASE}(?=/en/[^/\\s"')]+/)`, 'g'), host) : text)
    .replaceAll(`${BASE}/`, `/${route}/`).replaceAll(BASE, `/${route}`);
/** The origin of a base_path that is a host only (no path), else undefined. */
export function hostOnly(basePath) {
    if (typeof basePath !== 'string' || !/^https?:\/\//i.test(basePath))
        return undefined;
    try {
        const url = new URL(basePath);
        return url.pathname.replace(/\/+$/, '') === '' && !url.search && !url.hash ? url.origin : undefined;
    }
    catch {
        return undefined;
    }
}
/** MkDocs serves a README.md as its folder's index when the folder has no index.md. */
const readmeIsIndex = (rel, dirs) => path.basename(rel) === 'README.md'
    && !dirs.some((d) => fs.existsSync(path.join(d, path.dirname(rel), 'index.md')));
/**
 * Docusaurus turns `x/x.md` and `x/README.md` into the folder's index page (URL without the last segment);
 * MkDocs does not. Pin such pages to their MkDocs URL so existing links keep working.
 */
export function keepMkdocsUrl(mdx, rel, { readmeIndex = false } = {}) {
    const parts = rel.replace(/\\/g, '/').replace(/\.mdx?$/, '').split('/');
    const name = parts.at(-1) ?? '';
    // A README.md that MkDocs serves as the folder index (readmeIndex) keeps the folder URL Docusaurus gives it.
    if (readmeIndex && name === 'README')
        return mdx;
    const collides = /^readme$/i.test(name) || (parts.length > 1 && name.toLowerCase() === (parts.at(-2) ?? '').toLowerCase());
    if (!collides || /^slug:/m.test(mdx.split('\n---')[0] ?? ''))
        return mdx;
    return mdx.replace(/^---\n/, `---\nslug: /${parts.join('/')}/\n`);
}
// ---- OpenAPI specs behind <ApiReference> ----
const specCache = new Map();
function readSpecInfo(file) {
    if (specCache.has(file))
        return specCache.get(file);
    let info;
    try {
        const doc = yaml.load(fs.readFileSync(file, 'utf8'));
        const title = typeof doc?.info?.title === 'string' ? doc.info.title.trim() : undefined;
        const raw = typeof doc?.info?.description === 'string' ? doc.info.description : '';
        // First paragraph as plain text: no Markdown, HTML or line breaks.
        const first = raw.split(/\n\s*\n/)[0].replace(/<[^>]+>/g, '').replace(/[*_`#>]|\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
        info = { title, description: first ? (first.length > 200 ? `${first.slice(0, 197)}...` : first) : undefined };
    }
    catch {
        info = undefined;
    }
    specCache.set(file, info);
    return info;
}
/**
 * Resolve <ApiReference spec> to the spec file in the docs folder(s), the way the page's URL resolves it:
 * absolute site paths under the section route, or relative to the page's directory URL (MkDocs and the docs
 * site both use directory URLs). Never outside a docs folder.
 */
function specInfoFor(docsDirs, route, rel) {
    return (spec) => {
        const pageDir = `/${mkdocsUrl(rel)}`.replace(/\/?$/, '/');
        const sitePath = spec.startsWith('/') ? (spec.startsWith(`/${route}/`) ? spec.slice(route.length + 1) : spec) : path.posix.resolve(pageDir, spec);
        for (const dir of docsDirs) {
            const file = path.join(dir, sitePath);
            if (!path.resolve(file).startsWith(path.resolve(dir) + path.sep) || !fs.existsSync(file))
                continue;
            return readSpecInfo(file);
        }
        return undefined;
    };
}
async function emit(out, report, rel, produce, fallback, { readmeIndex = false } = {}) {
    const file = path.join(out.outDir, rel.replace(/\.mdx$/, '.md'));
    const excluded = (out.exclude ?? []).includes(rel);
    const writeFallback = () => {
        const page = out.fallback?.({ rel, ...fallback });
        if (page) {
            write(file, keepMkdocsUrl(page, rel, { readmeIndex }));
            report.redirected++;
        }
    };
    try {
        const mdx = keepMkdocsUrl(await produce(), rel, { readmeIndex });
        // An excluded page stays a fallback until it is taken off the list: it may pass conversion and still fail
        // the Docusaurus build.
        if (excluded) {
            report.nowPassing.push(rel);
            writeFallback();
            return;
        }
        write(file, mdx);
        report.ok++;
    }
    catch (e) {
        const kind = e instanceof PageError ? e.kind : 'template';
        report.failures.push({ page: rel, kind, error: e.message.slice(0, 200) });
        writeFallback();
    }
}
/** The folder pages are read from: docs_dir, or docsRoot inside it (then never outside the repository checkout). */
export function pagesDir(root, docsDir, docsRoot) {
    if (!docsRoot)
        return docsDir;
    const real = (p) => fs.realpathSync(p);
    const inside = (p, dir) => p === dir || p.startsWith(dir + path.sep);
    if (!fs.existsSync(docsDir) || !inside(real(docsDir), real(root)))
        throw new Error(`docs_dir is outside the content source: ${docsDir}`);
    const dir = path.resolve(docsDir, docsRoot);
    if (!inside(dir, path.resolve(docsDir)) || dir === path.resolve(docsDir) || !fs.existsSync(dir) || !inside(real(dir), real(docsDir))) {
        throw new Error(`docs_root must be a folder inside docs_dir: ${docsRoot}`);
    }
    return dir;
}
const SHARED = '_shared';
/**
 * A decoded path written back as a URL that is safe in a Markdown link destination and in an HTML or JSX attribute:
 * every character outside RFC 3986 unreserved, `/` and a few harmless sub-delimiters is percent-encoded (space, `%`,
 * `"`, `'`, `<`, `>`, `&`, `{`, `}`, `(`, `)`, `#`, `?`, backslash and non-ASCII among them).
 */
export function encodePath(decoded) {
    return decoded.replace(/[^A-Za-z0-9\-._~!$*+,;=:@/]/gu, (c) => Array.from(new TextEncoder().encode(c), (b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join(''));
}
/**
 * References from a page to files the section does not take (outside docsRoot, or filtered out by only/skip):
 * Markdown links and images resolve against the page file, HTML src/href against the page URL (as MkDocs serves
 * them). Pages map through linkOutside; files are copied into <outDir>/_shared/ (and <staticDir>/_shared/ for HTML
 * references) and point there. Anything resolving outside docs_dir, or not found, stays as written.
 */
export function rewriteOutsideRefs(mdx, ctx) {
    const pageSrc = ctx.pageSrc.replace(/\\/g, '/');
    const realDocs = fs.realpathSync(ctx.docsDir);
    const copy = (docsPath, toDir) => {
        const to = path.join(toDir, SHARED, docsPath);
        if (fs.existsSync(to))
            return;
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(path.join(ctx.docsDir, docsPath), to);
    };
    const fileInDocs = (docsPath) => {
        const file = path.join(ctx.docsDir, docsPath);
        const stat = fs.statSync(file, { throwIfNoEntry: false });
        return Boolean(stat?.isFile()) && fs.realpathSync(file).startsWith(realDocs + path.sep);
    };
    const target = (ref, html) => {
        const [, p = '', suffix = ''] = ref.match(/^([^?#]*)(.*)$/) ?? [];
        const decoded = safeDecode(p);
        if (!decoded || decoded.includes('\0'))
            return null;
        const from = html ? mkdocsUrl(pageSrc) : path.posix.dirname(pageSrc);
        const resolved = path.posix.normalize(path.posix.join(from, decoded));
        if (resolved === '..' || resolved.startsWith('../'))
            return null; // outside docs_dir
        const page = /\.md$/.test(resolved) || (!html && !/\.[A-Za-z0-9]+$/.test(resolved));
        if (ctx.inside(resolved, page))
            return null;
        if (page) {
            const url = ctx.linkOutside?.(resolved);
            return url ? `${encodePath(url)}${suffix}` : null;
        }
        // The decoded path is for file-system lookups only; what goes back into the page is re-encoded (encodePath).
        if (isPage(resolved) || !fileInDocs(resolved))
            return null;
        copy(resolved, ctx.outDir);
        if (html) {
            if (ctx.staticDir)
                copy(resolved, ctx.staticDir);
            return `/${ctx.route}/${SHARED}/${encodePath(resolved)}${suffix}`;
        }
        return `${encodePath(path.posix.relative(path.posix.dirname(ctx.rel.replace(/\\/g, '/')), `${SHARED}/${resolved}`))}${suffix}`;
    };
    return outsideCode(mdx, (t) => t.replace(RELATIVE_REF, (m, htmlRef, mdRef) => {
        if (htmlRef !== undefined && !/^(?:src|href)=/i.test(m))
            return m;
        const ref = (htmlRef ?? mdRef).trim();
        const to = target(ref, htmlRef !== undefined);
        return to === null ? m : m.replace(ref, () => to); // a function: `$` in a file name is not a replacement pattern
    }));
}
/** Convert one MkDocs site. Returns sidebar items (ids relative to the section) and the report. */
export async function convertMkdocsSite(src, out) {
    const report = out.report ?? emptyReport();
    const site = mkdocsSite(path.join(src.root, src.mkdocs));
    const pages = pagesDir(src.root, site.docsDir, src.docsRoot);
    const source = { root: src.root, includeBases: site.includeBases };
    const prefix = out.prefix ?? '';
    const route = prefix ? `${out.route}/${prefix}` : out.route;
    const withPrefix = (rel) => (prefix ? `${prefix}/${rel}` : rel);
    const wanted = (r) => r.endsWith('.md') && (!src.only || r.startsWith(src.only)) && !(src.skip ?? []).some((p) => r.startsWith(p));
    const docsRoot = src.docsRoot?.replace(/\\/g, '/').replace(/\/?$/, '/');
    // A docs_dir path the section takes: under docsRoot (its own filters apply below it), else a page it keeps or an asset it copies.
    const inside = (docsPath, page) => {
        if (docsRoot && !docsPath.startsWith(docsRoot))
            return false;
        const rel = docsRoot ? docsPath.slice(docsRoot.length) : docsPath;
        return page ? wanted(/\.md$/.test(rel) ? rel : `${rel.replace(/\/$/, '')}/index.md`) || wanted(`${rel.replace(/\/$/, '')}.md`) : !(src.skip ?? []).some((p) => rel.startsWith(p));
    };
    const labels = navLabels(site.nav);
    const host = hostOnly(site.extra.base_path);
    for (const rel of walk(pages, wanted)) {
        const file = path.join(pages, rel);
        const raw = fs.readFileSync(file, 'utf8');
        const deploymentOptions = optionsFor(src, rel);
        const fallbackTitle = mkdocsTitle(rel, labels.get(docPath(`${docsRoot ?? ''}${rel}`)));
        await emit(out, report, withPrefix(rel), async () => {
            const env = { ...site.extra, config: site.config, base_path: BASE };
            const rendered = resolveBase(renderSingle((site.templating ? loadPage : loadPlain)(file, source), env, file, source), route, host);
            const result = await convertRendered(rendered, {
                deploymentOptions, editUrl: src.editUrl?.(file), pageData: readPageData(file, source), iframeHosts: src.iframeHosts,
                specInfo: specInfoFor([pages], route, rel), fallbackTitle,
            });
            const mdx = src.docsRoot || src.linkOutside ? rewriteOutsideRefs(result.mdx, {
                rel: withPrefix(rel), pageSrc: `${docsRoot ?? ''}${rel.replace(/\\/g, '/')}`, docsDir: site.docsDir, route: out.route,
                outDir: out.outDir, staticDir: out.staticDir, inside, linkOutside: src.linkOutside,
            }) : result.mdx;
            return relativeImages(mdx, withPrefix(rel), out.route, (a) => fs.existsSync(path.join(pages, prefix ? a.slice(prefix.length + 1) : a)));
        }, { title: titleOf(raw, fallbackTitle), to: (src.currentSite ?? '') + mkdocsUrl(rel), deploymentOptions }, { readmeIndex: readmeIsIndex(rel, [pages]) });
    }
    if (out.staticDir)
        copyReferencedAssets(pages, prefix ? path.join(out.outDir, prefix) : out.outDir, prefix ? path.join(out.staticDir, prefix) : out.staticDir, route);
    // Old page URLs from the MkDocs redirects plugin keep answering, as they did on the former site.
    if (out.staticDir) {
        writeRedirectPages(redirectMaps(site.config), prefix ? path.join(out.staticDir, prefix) : out.staticDir, {
            route, currentSite: src.currentSite,
            toSection: (docsPath) => {
                if (docsRoot && !docsPath.startsWith(docsRoot))
                    return null;
                const rel = docsRoot ? docsPath.slice(docsRoot.length) : docsPath;
                return wanted(rel) ? rel : null;
            },
            hostedUrl: (rel) => (fs.existsSync(path.join(out.outDir, withPrefix(rel))) ? mkdocsUrl(rel) : null),
        });
    }
    copyAssets(pages, prefix ? path.join(out.outDir, prefix) : out.outDir, src.skip);
    const nav = selectNav(site.nav, { ...src.nav, ...(docsRoot ? { strip: docsRoot, outside: src.linkOutside } : {}) });
    const items = navToSidebar(nav, (id) => fs.existsSync(path.join(out.outDir, `${withPrefix(id)}.md`)), report.droppedNav);
    return { sidebar: prefix ? prefixIds(items, prefix) : items, report };
}
/** Convert a cloud and a self-hosted MkDocs site that share templates into one set of pages. */
export async function convertMergedSites(opts, out) {
    const report = out.report ?? emptyReport();
    const side = (o) => {
        const site = mkdocsSite(path.join(o.root, o.mkdocs));
        return { o, site, source: { root: o.root, includeBases: site.includeBases }, pages: new Set(walk(site.docsDir, (r) => r.endsWith('.md'))) };
    };
    const c = side(opts.cloud);
    const s = side(opts.self);
    const envOf = (x) => ({ ...x.site.extra, config: x.site.config, base_path: BASE });
    const labels = navLabels(s.site.nav, navLabels(c.site.nav));
    for (const rel of [...new Set([...c.pages, ...s.pages])].sort()) {
        const inC = c.pages.has(rel);
        const inS = s.pages.has(rel);
        const deploymentOptions = inC && inS ? [CLOUD, SELF_HOSTED] : inC ? [CLOUD] : [SELF_HOSTED];
        const primary = inC ? c : s;
        const file = path.join(primary.site.docsDir, rel);
        globalThis.__page = { rel, options: deploymentOptions };
        const fallbackTitle = mkdocsTitle(rel, labels.get(docPath(rel)));
        await emit(out, report, rel, async () => {
            let text;
            if (inC && inS) {
                const merged = mergePage(path.join(c.site.docsDir, rel), path.join(s.site.docsDir, rel), { cloud: { env: envOf(c), source: c.source }, self: { env: envOf(s), source: s.source } }, opts.sharedNames ?? {});
                text = merged.text;
                report.merge.splitBlocks += merged.stats.splitBlocks;
                if (merged.stats.diverged)
                    report.merge.diverged++;
            }
            else {
                text = renderSingle(loadPage(file, primary.source), envOf(primary), file, primary.source);
            }
            // Page data: the cloud wrapper's front matter and quick-start meta win; self-hosted fills gaps.
            const cData = inC ? readPageData(path.join(c.site.docsDir, rel), c.source) : undefined;
            const sData = inS ? readPageData(path.join(s.site.docsDir, rel), s.source) : undefined;
            const pageData = { frontMatter: { ...(sData?.frontMatter ?? {}), ...(cData?.frontMatter ?? {}) }, meta: cData?.meta ?? sData?.meta };
            const result = await convertRendered(resolveBase(text, out.route), {
                deploymentOptions, editUrl: primary.o.editUrl?.(file), pageData, iframeHosts: opts.iframeHosts,
                specInfo: specInfoFor([c.site.docsDir, s.site.docsDir], out.route, rel), fallbackTitle,
            });
            return relativeImages(result.mdx, rel, out.route, (a) => fs.existsSync(path.join(c.site.docsDir, a)) || fs.existsSync(path.join(s.site.docsDir, a)));
        }, { title: titleOf(fs.readFileSync(file, 'utf8'), fallbackTitle), to: (primary.o.currentSite ?? '') + mkdocsUrl(rel), deploymentOptions }, { readmeIndex: readmeIsIndex(rel, [c.site.docsDir, s.site.docsDir]) });
    }
    if (out.staticDir) {
        copyReferencedAssets(c.site.docsDir, out.outDir, out.staticDir, out.route);
        copyReferencedAssets(s.site.docsDir, out.outDir, out.staticDir, out.route);
    }
    copyAssets(c.site.docsDir, out.outDir);
    copyAssets(s.site.docsDir, out.outDir);
    const known = (id) => fs.existsSync(path.join(out.outDir, `${id}.md`));
    return { sidebar: mergeSidebars(navToSidebar(c.site.nav, known, report.droppedNav), navToSidebar(s.site.nav, known, report.droppedNav)), report };
}
// ---- Existing Docusaurus docs ----
/**
 * Evaluate a Docusaurus sidebars file (.ts/.js/.json) from its checkout; returns { sidebarId: items }.
 * A .ts/.js file is code from the content source (as Docusaurus itself would run it): pin and review it.
 */
export function loadSidebarFile(file) {
    if (file.endsWith('.json'))
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    const require = createRequire(import.meta.url);
    const createJiti = require('jiti');
    const load = createJiti(file, { interopDefault: true, cache: false });
    const mod = load(file);
    return (mod.default ?? mod);
}
/**
 * Prepare an existing Docusaurus docs folder for the site: deployment options and edit links in front matter,
 * images under the section route, `.mdx` links and imports written as `.md`, shims for source-only components,
 * and a CommonMark fallback for pages that fail to compile.
 */
export async function prepareDocusaurusDocs(src, out) {
    const report = out.report ?? emptyReport();
    const docsDir = path.join(src.root, src.docs);
    for (const rel of walk(docsDir, isPage)) {
        const file = path.join(docsDir, rel);
        const raw = fs.readFileSync(file, 'utf8');
        const deploymentOptions = optionsFor(src, rel);
        await emit(out, report, rel, async () => {
            const { data, body } = splitFrontMatter(raw);
            let text = body;
            for (const [from, to] of Object.entries(src.shims ?? {}))
                text = text.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`);
            text = text.replace(/(\]\(|src=["'{]?["']?)\/(img|images|assets)\//g, `$1/${out.route}/$2/`);
            text = text.replace(/(\]\((?!https?:)[^)\s]*?)\.mdx(?=[)#])/g, '$1.md'); // pages are written as .md
            text = text.replace(/(from\s+['"]\.{1,2}\/[^'"]*?)\.mdx(['"])/g, '$1.md$2');
            const edit = src.editUrl?.(file);
            const front = { ...data, deployment_options: data.deployment_options ?? deploymentOptions, ...(edit ? { custom_edit_url: edit } : {}) };
            const mdx = `---\n${yaml.dump(front, { lineWidth: -1 })}---\n${text}`;
            try {
                await compileCheck(mdx);
                return mdx;
            }
            catch (e) {
                if (!(e instanceof PageError) || e.kind !== 'compile')
                    throw e;
                // Same last resort as MkDocs pages: CommonMark keeps the page on the site, components show as plain content.
                const md = `---\n${yaml.dump({ ...front, mdx: { format: 'md' } }, { lineWidth: -1 })}---\n${withoutImports(text)}`;
                await compileCheck(md, { format: 'md' });
                return md;
            }
        }, { title: titleOf(raw, path.basename(rel, path.extname(rel))), to: (src.currentSite ?? '') + rel.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '$1'), deploymentOptions });
    }
    if (out.staticDir)
        copyAssets(docsDir, out.staticDir);
    copyAssets(docsDir, out.outDir);
    const staticSrc = path.join(src.root, path.dirname(src.docs) === '.' ? 'static' : path.join(path.dirname(src.docs), 'static'));
    if (out.staticDir)
        copyAssets(staticSrc, out.staticDir);
    const sidebars = loadSidebarFile(path.join(src.root, src.sidebar));
    const [sidebarId, items] = Object.entries(sidebars)[0] ?? ['docs', []];
    return { sidebarId, sidebar: items, report };
}
//# sourceMappingURL=site.js.map