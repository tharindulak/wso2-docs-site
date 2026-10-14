// One page: rendered Markdown -> checked, converted, compiled MDX with front matter.
import yaml from 'js-yaml';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import rehypeRaw from 'rehype-raw';
import rehypeValidElements from './rehype-valid-elements.js';
import { applyHtmlPolicy, unexpandedMarkers, removeForbiddenElements, type PolicyResult } from './html-policy.js';
import { htmlBlocksToJsx } from './html-blocks.js';
import { isHomeLayout, nameIconLinks } from './home-layout.js';
import { toMdx, outsideCode, type SyntaxStats } from './syntax.js';
import { writeComponents } from './conventions.js';
import type { DeploymentOption } from './types.js';
import { loadFrontMatter, type PageData } from './render.js';
import { applyLifecycle, lifecycleBadge, withoutDeprecatedSuffix, BY_OPTION, LIFECYCLE_FIELDS, type CheckOptions } from './lifecycle.js';

const KEEP_FRONT_MATTER = ['title', 'description', 'keywords', 'sidebar_label', 'sidebar_position', 'slug', 'tags', 'image'];

/** Split leading YAML front matter from Markdown. */
export function splitFrontMatter(text: string): { data: Record<string, unknown>; body: string; error?: string } {
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
  if (!m) return { data: {}, body: text };
  const { data, error } = loadFrontMatter(m[1]!);
  return { data, body: text.slice(m[0].length), ...(error ? { error } : {}) };
}

export type PageErrorKind = 'template' | 'policy' | 'include' | 'compile';

export class PageError extends Error {
  readonly kind: PageErrorKind;
  constructor(kind: PageErrorKind, message: string) {
    super(message);
    this.name = 'PageError';
    this.kind = kind;
  }
}

/** First level-1 heading outside code, as plain text. */
function firstHeading(markdown: string): string | undefined {
  const m = markdown.replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1/gm, '').match(/^#\s+(.+?)\s*#*\s*$/m);
  return m ? m[1]!.replace(/[*_`]/g, '').trim() : undefined;
}

export interface ConvertOptions {
  deploymentOptions: DeploymentOption[];
  editUrl?: string;
  iframeHosts?: readonly string[];
  /** Front matter and quick-start meta read from the page file itself (see render.splitPageData). */
  pageData?: Partial<PageData>;
  /** Title and summary of an OpenAPI spec referenced by <ApiReference spec>, for pages that have no heading. */
  specInfo?: (spec: string) => { title?: string; description?: string } | undefined;
  /**
   * Title for a page with no front-matter title, no heading and no spec title (as MkDocs: the nav label, else from
   * the file name). Without it Docusaurus shows the file id.
   */
  fallbackTitle?: string;
  /** Whether a relative `.md` lifecycle `replacement` names a page (see lifecycle.ts); unset: not checked. */
  replacementExists?: CheckOptions['replacementExists'];
}

export type PageStats = SyntaxStats & { removed?: string[]; htmlBlocks?: number; format?: 'md' };

/**
 * What a converted page carries besides its MDX: `problems` with its lifecycle fields (left out of the front matter)
 * and `yamlErrors` in its front matter (which then gives no fields, as before). Callers report both.
 */
export interface ConvertResult { mdx: string; stats: PageStats; problems: string[]; yamlErrors: string[] }

/** Convert rendered Markdown into Docusaurus MDX with front matter. Throws PageError when the page cannot be kept. */
export async function convertRendered(rendered: string, opts: ConvertOptions): Promise<ConvertResult> {
  const { data, body, error } = splitFrontMatter(rendered);
  const yamlErrors = [opts.pageData?.error, error].filter((e): e is string => !!e);
  const markers = unexpandedMarkers(body);
  if (markers.length) throw new PageError('include', `Unexpanded include: ${markers[0]}`);
  let policy: PolicyResult = applyHtmlPolicy(body, { iframeHosts: opts.iframeHosts });
  let removed: string[] = [];
  if (policy.violations.length) {
    // Scripts, styles and stylesheet links are dropped rather than losing the page; other violations still reject it.
    const stripped = removeForbiddenElements(body);
    const again = applyHtmlPolicy(stripped.text, { iframeHosts: opts.iframeHosts });
    if (again.violations.length || !stripped.removed.length) throw new PageError('policy', again.violations[0] ?? policy.violations[0]!);
    policy = { ...again, meta: again.meta ?? policy.meta };
    removed = stripped.removed;
  }
  // Icon-only and empty links get visible text before any rewrite (see home-layout.ts).
  policy = { ...policy, text: nameIconLinks(policy.text) };
  const withRemoved = (result: Omit<ConvertResult, 'yamlErrors'>): ConvertResult => ({ ...(removed.length ? { ...result, stats: { ...result.stats, removed } } : result), yamlErrors });
  const compileFailure = (e: unknown): void => { if (!(e instanceof PageError) || e.kind !== 'compile') throw e; };
  try {
    return withRemoved(await assemble(policy.text, data, body, policy, opts));
  } catch (e) { compileFailure(e); }
  // Retry with multi-line raw HTML blocks rewritten as JSX (see html-blocks.ts); the JSX skips the Markdown rewrites.
  const saved: string[] = [];
  const rewritten = htmlBlocksToJsx(policy.text, { protect: (jsx) => `MDXHTMLBLOCK${saved.push(jsx) - 1}X` });
  if (rewritten.blocks) {
    try {
      const result = await assemble(rewritten.text, data, body, policy, opts, { restore: (mdx) => mdx.replace(/MDXHTMLBLOCK(\d+)X/g, (_, i: string) => saved[Number(i)]!) });
      return withRemoved({ ...result, stats: { ...result.stats, htmlBlocks: rewritten.blocks } });
    } catch (e) { compileFailure(e); }
  }
  // Last resort: CommonMark (Docusaurus `mdx.format: md`), where raw HTML is parsed leniently, as browsers do.
  // The page stays on the site; JSX components (tabs, deployment blocks) show as plain content. HTML blocks nested in
  // a container become one line of HTML with their inline Markdown rendered, as Python-Markdown renders it.
  const html: string[] = [];
  const nested = htmlBlocksToJsx(policy.text, { html: true, protect: (h) => `MDXHTMLBLOCK${html.push(h) - 1}X` });
  const md = async (text: string, restore?: (mdx: string) => string) => withRemoved(await assemble(text, data, body, policy, opts, { format: 'md', restore }).then((r) => ({ ...r, stats: { ...r.stats, format: 'md' as const } })));
  if (nested.text !== policy.text) {
    try { return await md(nested.text, (mdx) => mdx.replace(/MDXHTMLBLOCK(\d+)X/g, (_, i: string) => html[Number(i)]!)); } catch (e) { compileFailure(e); }
  }
  return md(policy.text);
}

async function assemble(
  text: string, data: Record<string, unknown>, body: string, policy: PolicyResult, opts: ConvertOptions,
  { restore = (mdx: string) => mdx, format = 'mdx' }: { restore?: (mdx: string) => string; format?: 'mdx' | 'md' } = {},
): Promise<Omit<ConvertResult, 'yamlErrors'>> {
  const { body: converted, usesTabs, stats } = toMdx(text);
  const md = format === 'md';
  const source = { ...(opts.pageData?.frontMatter ?? {}), ...data };
  // CommonMark pages carry raw HTML, not JSX: keep HTML attribute names. They cannot hold components either; MDX pages
  // get the explicit components where they follow a convention (conventions.ts).
  const mdxBody = md ? withoutImports(restore(converted)).replace(/(<[a-zA-Z][^>]*?)\bclassName=/g, '$1class=')
    : writeComponents(restore(converted), { frontMatter: source }).text;

  const front: Record<string, unknown> = {};
  for (const k of KEEP_FRONT_MATTER) if (source[k] !== undefined) front[k] = source[k];
  front.title ??= firstHeading(body);
  const spec = mdxBody.match(/<ApiReference spec="([^"]+)"/)?.[1];
  if (spec) {
    // An API reference page: the viewer needs the full width, and the spec names the page.
    front.hide_table_of_contents = true;
    const info = opts.specInfo?.(spec);
    front.title ??= info?.title;
    if (info?.description && front.description === undefined) front.description = info.description;
  }
  // An empty MkDocs template page gets its title and overview links later (the docs site's fillTemplatePages).
  if (!(source.template && !mdxBody.trim()) && front.title === undefined && opts.fallbackTitle !== undefined) {
    front.title = opts.fallbackTitle;
    // MkDocs Material shows a synthesized title as the H1, but a custom home layout does not; keep it for the
    // browser tab, breadcrumb and search only.
    if (isHomeLayout(mdxBody)) front.hide_title = true;
  }
  if (source.template) front.mkdocs_template = String(source.template).replace(/^templates\//, '').replace(/\.html$/, '');
  front.deployment_options = opts.deploymentOptions;
  if (opts.editUrl) front.custom_edit_url = opts.editUrl;
  const meta = opts.pageData?.meta ?? policy.meta;
  if (meta) front.quick_start = meta;
  if (md) front.mdx = { format: 'md' };
  for (const k of [...LIFECYCLE_FIELDS, BY_OPTION]) if (source[k] !== undefined) front[k] = source[k];
  const lifecycle = applyLifecycle(front, { replacementExists: opts.replacementExists });
  // The badge says Deprecated: the page's own heading loses the suffix too, as its title does.
  let shownBody = mdxBody;
  if (lifecycleBadge(lifecycle.front)?.stage === 'deprecated') {
    let done = false;
    shownBody = outsideCode(mdxBody, (t) => t.replace(/^(#[ \t]+)(.+?)([ \t]+#+)?[ \t]*$/m, (m, hash: string, text: string) => {
      if (done) return m;
      done = true;
      return hash + withoutDeprecatedSuffix(text);
    }));
  }

  const imports = md ? '' : [
    /<Applies\b/.test(mdxBody) && "import Applies from '@site/src/components/Applies';",
    /<DeploymentValue\b/.test(mdxBody) && "import DeploymentValue from '@site/src/components/DeploymentValue';",
    /<ApiReference\b/.test(mdxBody) && "import ApiReference from '@site/src/components/ApiReference';",
    usesTabs && !/import Tabs from/.test(mdxBody) && "import Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';",
  ].filter(Boolean).join('\n');

  const mdx = `---\n${yaml.dump(lifecycle.front, { lineWidth: -1 })}---\n\n${imports ? `${imports}\n\n` : ''}${shownBody.trim()}\n`;
  await compileCheck(mdx, { format });
  return { mdx, stats, problems: lifecycle.problems };
}

interface MdastLike { type: string; url?: string; children?: MdastLike[] }

/** Docusaurus stops the build on an absolute link URL it cannot parse (http://host:port/x); fail the page here instead. */
function remarkParsableLinks() {
  return (tree: MdastLike): void => {
    const visit = (node: MdastLike): void => {
      if (node.type === 'link' && node.url && /^[a-z][\w+.-]*:\/\//i.test(node.url)) {
        try { new URL(node.url); } catch { throw new Error(`Link URL cannot be parsed: ${node.url.slice(0, 80)}`); }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}

// As Docusaurus configures rehype-raw for CommonMark pages.
const MDX_NODES = ['mdxFlowExpression', 'mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxTextExpression', 'mdxjsEsm'];

/** CommonMark has no ESM: import lines would print as text. */
export const withoutImports = (text: string): string => text.replace(/^import\s+[\w{},\s*]+\s+from\s+['"][^'"]+['"];?[ \t]*$\n?/gm, '');

/** Compile as Docusaurus would (MDX 3 or CommonMark, GFM, directives). Throws PageError('compile') on failure. */
export async function compileCheck(mdx: string, { format = 'mdx' }: { format?: 'mdx' | 'md' } = {}): Promise<void> {
  const body = mdx.replace(/^---[\s\S]*?\n---\n/, '');
  try {
    await compile(body, format === 'md'
      ? { format: 'md', remarkPlugins: [remarkGfm, remarkDirective, remarkParsableLinks], rehypePlugins: [[rehypeRaw, { passThrough: MDX_NODES }], rehypeValidElements] }
      : { remarkPlugins: [remarkGfm, remarkDirective, remarkParsableLinks] });
  } catch (e) {
    const err = e as { reason?: string; message?: string; line?: number };
    const where = err.line ? ` (line ${err.line})` : '';
    throw new PageError('compile', `${String(err.reason ?? err.message).slice(0, 160)}${where}`);
  }
}
