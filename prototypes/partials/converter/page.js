// One page: rendered Markdown -> checked, converted, compiled MDX with front matter.
import yaml from 'js-yaml';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import rehypeRaw from 'rehype-raw';
import rehypeValidElements from './rehype-valid-elements.js';
import { applyHtmlPolicy, unexpandedMarkers, removeForbiddenElements } from './html-policy.js';
import { htmlBlocksToJsx } from './html-blocks.js';
import { dropScriptedModals, hasHtmlH1, isHomeLayout, nameIconLinks } from './home-layout.js';
import { toMdx } from './syntax.js';
const KEEP_FRONT_MATTER = ['title', 'description', 'keywords', 'sidebar_label', 'sidebar_position', 'slug', 'tags', 'image'];
/** Split leading YAML front matter from Markdown. */
export function splitFrontMatter(text) {
    const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
    if (!m)
        return { data: {}, body: text };
    let data = {};
    try {
        data = yaml.load(m[1], { schema: yaml.JSON_SCHEMA }) ?? {};
    }
    catch {
        data = {};
    }
    return { data: data && typeof data === 'object' ? data : {}, body: text.slice(m[0].length) };
}
export class PageError extends Error {
    kind;
    constructor(kind, message) {
        super(message);
        this.name = 'PageError';
        this.kind = kind;
    }
}
/** First level-1 heading outside code, as plain text. */
function firstHeading(markdown) {
    const m = markdown.replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1/gm, '').match(/^#\s+(.+?)\s*#*\s*$/m);
    return m ? m[1].replace(/[*_`]/g, '').trim() : undefined;
}
/** Convert rendered Markdown into Docusaurus MDX with front matter. Throws PageError when the page cannot be kept. */
export async function convertRendered(rendered, opts) {
    const { data, body } = splitFrontMatter(rendered);
    const markers = unexpandedMarkers(body);
    if (markers.length)
        throw new PageError('include', `Unexpanded include: ${markers[0]}`);
    let policy = applyHtmlPolicy(body, { iframeHosts: opts.iframeHosts });
    let removed = [];
    if (policy.violations.length) {
        // Scripts, styles and stylesheet links are dropped rather than losing the page; other violations still reject it.
        const stripped = removeForbiddenElements(body);
        const again = applyHtmlPolicy(stripped.text, { iframeHosts: opts.iframeHosts });
        if (again.violations.length || !stripped.removed.length)
            throw new PageError('policy', again.violations[0] ?? policy.violations[0]);
        policy = { ...again, meta: again.meta ?? policy.meta };
        removed = stripped.removed;
    }
    // Script-driven lightboxes lose their hidden dialog, and icon-only and empty links get visible text, before any
    // rewrite (see home-layout.ts).
    policy = { ...policy, text: nameIconLinks(dropScriptedModals(policy.text)) };
    const withRemoved = (result) => (removed.length ? { ...result, stats: { ...result.stats, removed } } : result);
    const compileFailure = (e) => { if (!(e instanceof PageError) || e.kind !== 'compile')
        throw e; };
    try {
        return withRemoved(await assemble(policy.text, data, body, policy, opts));
    }
    catch (e) {
        compileFailure(e);
    }
    // Retry with multi-line raw HTML blocks rewritten as JSX (see html-blocks.ts); the JSX skips the Markdown rewrites.
    const saved = [];
    const rewritten = htmlBlocksToJsx(policy.text, { protect: (jsx) => `MDXHTMLBLOCK${saved.push(jsx) - 1}X` });
    if (rewritten.blocks) {
        try {
            const result = await assemble(rewritten.text, data, body, policy, opts, { restore: (mdx) => mdx.replace(/MDXHTMLBLOCK(\d+)X/g, (_, i) => saved[Number(i)]) });
            return withRemoved({ ...result, stats: { ...result.stats, htmlBlocks: rewritten.blocks } });
        }
        catch (e) {
            compileFailure(e);
        }
    }
    // Last resort: CommonMark (Docusaurus `mdx.format: md`), where raw HTML is parsed leniently, as browsers do.
    // The page stays on the site; JSX components (tabs, deployment blocks) show as plain content. HTML blocks nested in
    // a container become one line of HTML with their inline Markdown rendered, as Python-Markdown renders it.
    const html = [];
    const nested = htmlBlocksToJsx(policy.text, { html: true, protect: (h) => `MDXHTMLBLOCK${html.push(h) - 1}X` });
    const md = async (text, restore) => withRemoved(await assemble(text, data, body, policy, opts, { format: 'md', restore }).then((r) => ({ ...r, stats: { ...r.stats, format: 'md' } })));
    if (nested.text !== policy.text) {
        try {
            return await md(nested.text, (mdx) => mdx.replace(/MDXHTMLBLOCK(\d+)X/g, (_, i) => html[Number(i)]));
        }
        catch (e) {
            compileFailure(e);
        }
    }
    return md(policy.text);
}
async function assemble(text, data, body, policy, opts, { restore = (mdx) => mdx, format = 'mdx' } = {}) {
    const { body: converted, usesTabs, stats } = toMdx(text);
    const md = format === 'md';
    // CommonMark pages carry raw HTML, not JSX: keep HTML attribute names.
    const mdxBody = md ? withoutImports(restore(converted)).replace(/(<[a-zA-Z][^>]*?)\bclassName=/g, '$1class=') : restore(converted);
    const front = {};
    const source = { ...(opts.pageData?.frontMatter ?? {}), ...data };
    for (const k of KEEP_FRONT_MATTER)
        if (source[k] !== undefined)
            front[k] = source[k];
    front.title ??= firstHeading(body);
    const spec = mdxBody.match(/<ApiReference spec="([^"]+)"/)?.[1];
    if (spec) {
        // An API reference page: the viewer needs the full width, and the spec names the page.
        front.hide_table_of_contents = true;
        const info = opts.specInfo?.(spec);
        front.title ??= info?.title;
        if (info?.description && front.description === undefined)
            front.description = info.description;
    }
    // An empty MkDocs template page gets its title and overview links later (the docs site's fillTemplatePages).
    if (!(source.template && !mdxBody.trim()) && front.title === undefined && opts.fallbackTitle !== undefined) {
        front.title = opts.fallbackTitle;
        // MkDocs Material shows a synthesized title as the H1, but not on a custom home layout or over a page with its
        // own <h1>; keep it for the browser tab, breadcrumb and search only.
        if (isHomeLayout(mdxBody) || hasHtmlH1(mdxBody))
            front.hide_title = true;
    }
    if (source.template)
        front.mkdocs_template = String(source.template).replace(/^templates\//, '').replace(/\.html$/, '');
    front.deployment_options = opts.deploymentOptions;
    if (opts.editUrl)
        front.custom_edit_url = opts.editUrl;
    const meta = opts.pageData?.meta ?? policy.meta;
    if (meta)
        front.quick_start = meta;
    if (md)
        front.mdx = { format: 'md' };
    const imports = md ? '' : [
        /<Applies\b/.test(mdxBody) && "import Applies from '@site/src/components/Applies';",
        /<DeploymentValue\b/.test(mdxBody) && "import DeploymentValue from '@site/src/components/DeploymentValue';",
        /<ApiReference\b/.test(mdxBody) && "import ApiReference from '@site/src/components/ApiReference';",
        usesTabs && !/import Tabs from/.test(mdxBody) && "import Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';",
    ].filter(Boolean).join('\n');
    const mdx = `---\n${yaml.dump(front, { lineWidth: -1 })}---\n\n${imports ? `${imports}\n\n` : ''}${mdxBody.trim()}\n`;
    await compileCheck(mdx, { format });
    return { mdx, stats };
}
/** Docusaurus stops the build on an absolute link URL it cannot parse (http://host:port/x); fail the page here instead. */
function remarkParsableLinks() {
    return (tree) => {
        const visit = (node) => {
            if (node.type === 'link' && node.url && /^[a-z][\w+.-]*:\/\//i.test(node.url)) {
                try {
                    new URL(node.url);
                }
                catch {
                    throw new Error(`Link URL cannot be parsed: ${node.url.slice(0, 80)}`);
                }
            }
            for (const child of node.children ?? [])
                visit(child);
        };
        visit(tree);
    };
}
// As Docusaurus configures rehype-raw for CommonMark pages.
const MDX_NODES = ['mdxFlowExpression', 'mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxTextExpression', 'mdxjsEsm'];
/** CommonMark has no ESM: import lines would print as text. */
export const withoutImports = (text) => text.replace(/^import\s+[\w{},\s*]+\s+from\s+['"][^'"]+['"];?[ \t]*$\n?/gm, '');
/** Compile as Docusaurus would (MDX 3 or CommonMark, GFM, directives). Throws PageError('compile') on failure. */
export async function compileCheck(mdx, { format = 'mdx' } = {}) {
    const body = mdx.replace(/^---[\s\S]*?\n---\n/, '');
    try {
        await compile(body, format === 'md'
            ? { format: 'md', remarkPlugins: [remarkGfm, remarkDirective, remarkParsableLinks], rehypePlugins: [[rehypeRaw, { passThrough: MDX_NODES }], rehypeValidElements] }
            : { remarkPlugins: [remarkGfm, remarkDirective, remarkParsableLinks] });
    }
    catch (e) {
        const err = e;
        const where = err.line ? ` (line ${err.line})` : '';
        throw new PageError('compile', `${String(err.reason ?? err.message).slice(0, 160)}${where}`);
    }
}
//# sourceMappingURL=page.js.map