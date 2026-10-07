// One page: rendered Markdown -> checked, converted, compiled MDX with front matter.
import yaml from 'js-yaml';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { applyHtmlPolicy, unexpandedMarkers } from './html-policy.js';
import { toMdx } from './syntax.js';

const KEEP_FRONT_MATTER = ['title', 'description', 'keywords', 'sidebar_label', 'sidebar_position', 'slug', 'tags', 'image'];

/** Split leading YAML front matter from Markdown. */
export function splitFrontMatter(text) {
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
  if (!m) return { data: {}, body: text };
  let data = {};
  try { data = yaml.load(m[1], { schema: yaml.JSON_SCHEMA }) ?? {}; } catch { data = {}; }
  return { data: typeof data === 'object' ? data : {}, body: text.slice(m[0].length) };
}

export class PageError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'PageError';
    this.kind = kind; // template | policy | include | compile
  }
}

/** First level-1 heading outside code, as plain text. */
function firstHeading(markdown) {
  const m = markdown.replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1/gm, '').match(/^#\s+(.+?)\s*#*\s*$/m);
  return m ? m[1].replace(/[*_`]/g, '').trim() : undefined;
}

/**
 * @param {string} rendered Markdown after templating
 * @param {{ deploymentOptions: string[], editUrl?: string, iframeHosts?: string[],
 *           pageData?: { frontMatter?: object, meta?: object } }} opts
 *   pageData: front matter and quick-start meta read from the page file itself (see render.splitPageData)
 * @returns {Promise<{ mdx: string, stats: object }>}
 */
export async function convertRendered(rendered, opts) {
  const { data, body } = splitFrontMatter(rendered);
  const markers = unexpandedMarkers(body);
  if (markers.length) throw new PageError('include', `Unexpanded include: ${markers[0]}`);
  const policy = applyHtmlPolicy(body, { iframeHosts: opts.iframeHosts });
  if (policy.violations.length) throw new PageError('policy', policy.violations[0]);
  const { body: mdxBody, usesTabs, stats } = toMdx(policy.text);

  const front = {};
  const source = { ...(opts.pageData?.frontMatter ?? {}), ...data };
  for (const k of KEEP_FRONT_MATTER) if (source[k] !== undefined) front[k] = source[k];
  front.title ??= firstHeading(body);
  if (source.template) front.mkdocs_template = String(source.template).replace(/^templates\//, '').replace(/\.html$/, '');
  front.deployment_options = opts.deploymentOptions;
  if (opts.editUrl) front.custom_edit_url = opts.editUrl;
  const meta = opts.pageData?.meta ?? policy.meta;
  if (meta) front.quick_start = meta;

  const imports = [
    /<Applies\b/.test(mdxBody) && "import Applies from '@site/src/components/Applies';",
    /<DeploymentValue\b/.test(mdxBody) && "import DeploymentValue from '@site/src/components/DeploymentValue';",
    usesTabs && !/import Tabs from/.test(mdxBody) && "import Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';",
  ].filter(Boolean).join('\n');

  const mdx = `---\n${yaml.dump(front, { lineWidth: -1 })}---\n\n${imports ? `${imports}\n\n` : ''}${mdxBody.trim()}\n`;
  await compileCheck(mdx);
  return { mdx, stats };
}

/** Compile as Docusaurus would (MDX 3, GFM, directives). Throws PageError('compile') on failure. */
export async function compileCheck(mdx) {
  const body = mdx.replace(/^---[\s\S]*?\n---\n/, '');
  try {
    await compile(body, { remarkPlugins: [remarkGfm, remarkDirective] });
  } catch (e) {
    const where = e.line ? ` (line ${e.line})` : '';
    throw new PageError('compile', `${String(e.reason ?? e.message).slice(0, 160)}${where}`);
  }
}
