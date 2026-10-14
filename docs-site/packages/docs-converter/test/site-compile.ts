// Compiling a page as the docs site does, for tests: directives, Docusaurus's admonitions, heading ids, TOC and
// Markdown link resolution (mdx-loader runs these before the site's remarkPlugins), then the site's own plugins.
import { compile, run } from '@mdx-js/mdx';
import remarkDirective from 'remark-directive';
import rehypeRaw from 'rehype-raw';
import * as admonitions from '@docusaurus/mdx-loader/lib/remark/admonitions/index.js';
import * as headings from '@docusaurus/mdx-loader/lib/remark/headings/index.js';
import * as toc from '@docusaurus/mdx-loader/lib/remark/toc/index.js';
import * as resolveMarkdownLinks from '@docusaurus/mdx-loader/lib/remark/resolveMarkdownLinks/index.js';
import remarkDeprecatedSections from '../src/remark-deprecated-sections.js';
import remarkComponents from '../src/remark-components.js';

/** A CommonJS module's default export, as Node hands it to an ES module. */
const cjs = (m: object): never => { const d = (m as { default: { default?: unknown } }).default; return (d.default ?? d) as never; };

/** Docusaurus rewrites links to Markdown files to the target's permalink before the site's plugins run. */
const PERMALINKS: Record<string, string> = { './users.md': '/identity/guides/users/', '../apps/index.md': '/identity/guides/apps/' };
const resolve = { resolveMarkdownLink: ({ linkPathname }: { linkPathname: string }) => PERMALINKS[linkPathname] ?? null, onBrokenMarkdownLinks: () => undefined };

export type Format = 'mdx' | 'md';

const options = (format: Format) => ({
  format,
  remarkPlugins: [remarkDirective, cjs(admonitions), [cjs(headings), { anchorsMaintainCase: false }], cjs(toc), [cjs(resolveMarkdownLinks), resolve],
    remarkDeprecatedSections, remarkComponents] as never,
  // CommonMark pages: mdx-loader parses raw HTML with rehype-raw and passes MDX nodes through.
  rehypePlugins: (format === 'md' ? [[rehypeRaw, { passThrough: ['mdxFlowExpression', 'mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxTextExpression', 'mdxjsEsm'] }]] : []) as never,
});

const PATH = '/docs/identity/guides/page.md';

/** The page's JSX source, as the docs site would compile it. */
export const jsx = async (value: string, frontMatter: Record<string, unknown> = {}, format: Format = 'mdx'): Promise<string> =>
  String(await compile({ value, path: PATH, data: { frontMatter } }, { ...options(format), jsx: true }));

export const count = (s: string, re: RegExp): number => (s.match(new RegExp(re, 'g')) ?? []).length;

interface El { type: unknown; props: { children?: unknown; [k: string]: unknown } }
export interface Card { href: string; title: string; text?: string }

/** Runs the compiled page with a runtime that records elements, and returns each LinkCards element's props. */
export async function cards(value: string, frontMatter: Record<string, unknown> = {}, format: Format = 'mdx'): Promise<{ items: Card[]; children: El[] }[]> {
  const code = String(await compile({ value, path: PATH, data: { frontMatter } }, { ...options(format), outputFormat: 'function-body' }));
  const el = (type: unknown, props: El['props']): El => ({ type, props });
  const { default: Content } = await run(code, { Fragment: 'fragment', jsx: el, jsxs: el, baseUrl: import.meta.url } as never);
  const LinkCards = (): null => null;
  const pass = (): null => null;
  const tree = (Content as (p: object) => El)({ components: { LinkCards, Applies: pass, Tabs: pass, TabItem: pass } });
  const found: { items: Card[]; children: El[] }[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object' || !('props' in n)) return;
    const e = n as El;
    if (e.type === LinkCards) found.push({ items: e.props.items as Card[], children: [e.props.children].flat() as El[] });
    walk(e.props.children);
  };
  walk(tree);
  return found;
}
