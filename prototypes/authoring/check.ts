// PROTOTYPE, throwaway. Answers: "What does writing with the explicit WSO2 content components feel like for an Identity
// Platform writer, and what does the check tell them when they miss one?" (map .scratch/wso2-docs-authoring-components).
//
// A throwaway contract check: parses a page with unified + remark-parse + remark-mdx + remark-gfm + remark-directive
// (+ remark-frontmatter) and reports, with file:line and a fix hint, each hand-written pattern a component covers.
// Every finding is reported as "error" here; error versus warning, scope (new/edited/untouched pages) and an escape
// hatch are open in ticket 05 and not decided by this prototype.
//
// Run: node check.ts pages/*.mdx   (exit code 1 when anything is reported)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import { toString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';
import YAML from 'yaml';

export type Finding = { line: number; column: number; rule: string; message: string; fix: string };

export const ALLOWED = ['Steps', 'Prerequisites', 'LinkCards', 'Tabs', 'TabItem', 'Applies', 'DeploymentValue',
  'ApiReference', 'Recommendation', 'Redirect', 'DbConfigTable'];
const STEP_HEADING = /^Step\s+(\d+(?:\.\d+)*)\s*[:.\-–]?\s*/i;
const PREREQ_TITLE = /^(prerequisites|before you begin|before you start)\s*:?$/i;
const CLOSING_TITLE = /^(what'?s next\??|next steps|see also|related (topics|guides|links)|learn more)$/i;
const ADMONITIONS = ['note', 'tip', 'info', 'warning', 'caution', 'danger', 'important'];

const parser = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkMdx).use(remarkGfm).use(remarkDirective);

const isJsx = (n: any, name?: string) => (n.type === 'mdxJsxFlowElement' || n.type === 'mdxJsxTextElement') && (!name || n.name === name);
const labelOf = (n: any) => {
  const p = n.children?.[0];
  return p?.data?.directiveLabel ? toString(p) : '';
};
/** Heading text without an explicit id comment ({/* #id *\/}). */
const headingText = (h: any) => toString({ type: 'root', children: h.children.filter((c: any) => c.type !== 'mdxTextExpression') }).trim();

export function check(file: string, source: string): Finding[] {
  const out: Finding[] = [];
  const add = (node: any, rule: string, message: string, fix: string) =>
    out.push({ line: node?.position?.start.line ?? 1, column: node?.position?.start.column ?? 1, rule, message, fix });

  if (path.extname(file) === '.md') {
    add(null, 'mdx-extension', 'Authored pages are .mdx; this page is .md.', `Rename to ${path.basename(file, '.md')}.mdx (the URL does not change) and update links to it.`);
  }

  let tree: any;
  try {
    tree = parser.parse(source);
  } catch (e: any) {
    out.push({ line: e.line ?? e.place?.line ?? 1, column: e.column ?? e.place?.column ?? 1, rule: 'mdx-parse',
      message: `Not valid MDX: ${e.reason ?? e.message}`, fix: 'Escape stray <, { or close raw HTML tags so the page compiles as MDX.' });
    return out;
  }

  // Front matter: no CommonMark pages.
  const fm = tree.children.find((n: any) => n.type === 'yaml');
  if (fm) {
    let data: any = {};
    try { data = YAML.parse(fm.value) ?? {}; } catch { /* the site build reports bad YAML */ }
    if (data?.mdx?.format === 'md') {
      const offset = fm.value.split('\n').findIndex((l: string) => /^\s*format:\s*md\s*$/.test(l));
      out.push({ line: fm.position.start.line + 1 + Math.max(offset, 0), column: 1, rule: 'no-commonmark',
        message: '`mdx.format: md` compiles the page as CommonMark, so it cannot use components.',
        fix: 'Delete the `mdx:` / `format: md` lines; fix anything that then fails to compile as MDX.' });
    }
  }

  const slugger = new GithubSlugger();
  type Run = { nodes: any[] };
  let run: Run | null = null;
  const runs: Run[] = [];

  function walk(node: any, ancestors: any[]) {
    const inside = (name: string) => ancestors.filter((a) => isJsx(a, name)).length;
    const kids = node.children ?? [];
    kids.forEach((n: any, i: number) => {
      if (n.type === 'heading') {
        const text = headingText(n);
        const slug = slugger.slug(text);
        const m = STEP_HEADING.exec(text);
        if (m && !inside('Steps')) {
          if (!run) { run = { nodes: [] }; runs.push(run); }
          run.nodes.push({ node: n, slug, rest: text.slice(m[0].length) });
        } else if (n.depth <= 3) {
          run = null;
        }
        if (m && inside('Steps')) {
          add(n, 'steps-prefix', `"${m[0].trim()}" in a heading inside <Steps>: step numbers are automatic.`,
            `Write "${'#'.repeat(n.depth)} ${text.slice(m[0].length)}"${/\{\/\*/.test(JSON.stringify(n.children)) ? '' : ` and keep the old anchor: {/* #${slug} */}`}.`);
        }
        if (PREREQ_TITLE.test(text) && !inside('Prerequisites')) {
          let end = kids.length;
          for (let j = i + 1; j < kids.length; j++) if (kids[j].type === 'heading' && kids[j].depth <= n.depth) { end = j; break; }
          const last = kids[end - 1];
          add(n, 'prerequisites', `"${text}" heading not wrapped in <Prerequisites> (lines ${n.position.start.line}-${last.position.end.line}).`,
            'Put <Prerequisites> before the heading and </Prerequisites> after its content (blank lines around both); the heading keeps its anchor and TOC entry.');
        }
        if (CLOSING_TITLE.test(text)) {
          const next = kids[i + 1];
          if (next?.type === 'list' && next.children.every((li: any) => {
            const p = li.children[0];
            return p?.type === 'paragraph' && p.children.find((c: any) => c.type !== 'text' || c.value.trim())?.type === 'link';
          })) {
            add(next, 'link-cards', `Link list under "${text}" not wrapped in <LinkCards> (lines ${next.position.start.line}-${next.position.end.line}).`,
              'Put <LinkCards> before the list and </LinkCards> after it (heading stays outside). Card title = link text; description = your text after the link, else the linked page\'s description.');
          }
        }
      }
      if (n.type === 'containerDirective') {
        const label = labelOf(n);
        if (ADMONITIONS.includes(n.name) && PREREQ_TITLE.test(label) && !inside('Prerequisites')) {
          add(n, 'prerequisites', `:::${n.name}[${label}] used as a prerequisites block.`,
            `Replace ":::${n.name}[${label}]" ... ":::" with <Prerequisites title="${label}"> ... </Prerequisites> (no heading, not in the TOC).`);
        }
        if (ADMONITIONS.includes(n.name) && /^deprecat/i.test(label)) {
          const title = label.replace(/^deprecated\s*[:\-–]?\s*/i, '');
          add(n, 'deprecated', `:::${n.name}[${label}] marks a deprecated section by hand.`,
            `Use :::deprecated[${title ? title[0].toUpperCase() + title.slice(1) : 'Title'}] (the Deprecated tag and scope line are added for you).`);
        }
      }
      if (isJsx(n) && n.name && /^[A-Z]/.test(n.name) && !ALLOWED.includes(n.name)) {
        add(n, 'unknown-component', `<${n.name}> is not a WSO2 content component.`, `Use one of: ${ALLOWED.join(', ')}; or ask for a new component.`);
      }
      if (isJsx(n, 'Steps')) {
        if (inside('Steps') >= 2) add(n, 'steps-depth', '<Steps> nested more than one level deep.', 'Sub-steps go one level only; use a numbered list for the inner level.');
        if (!n.children.some((c: any) => c.type === 'heading')) add(n, 'steps-empty', '<Steps> without a heading: each heading inside is a step.', 'Put the step headings directly inside <Steps> (blank lines around them).');
        run = null;
      }
      if (isJsx(n, 'Prerequisites') && !n.attributes.some((a: any) => a.name === 'title') && n.children.find((c: any) => c.type !== 'mdxFlowExpression')?.type !== 'heading') {
        add(n, 'prerequisites-title', '<Prerequisites> has no title.', 'Start it with a heading (## Prerequisites) or give it title="Before you begin".');
      }
      walk(n, [...ancestors, n]);
    });
  }
  walk(tree, []);

  for (const r of runs) {
    const first = r.nodes[0];
    const lines = r.nodes.map((x: any) => x.node.position.start.line).join(', ');
    add(first.node, 'steps', `${r.nodes.length} "Step N" heading${r.nodes.length > 1 ? 's' : ''} outside <Steps> (lines ${lines}).`,
      `Wrap them in <Steps> ... </Steps> (sub-steps in a nested <Steps>), drop the "Step N:" prefixes and keep each old anchor, e.g. "${'#'.repeat(first.node.depth)} ${first.rest} {/* #${first.slug} */}".`);
  }
  return out.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function format(file: string, findings: Finding[]): string {
  if (!findings.length) return `${file}\n  0 errors\n`;
  const lines = findings.map((f) => `  ${`${f.line}:${f.column}`.padEnd(7)} error  ${f.message}  [${f.rule}]\n          fix: ${f.fix}`);
  return `${file}\n${lines.join('\n')}\n\n  ${findings.length} error${findings.length > 1 ? 's' : ''}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let total = 0;
  for (const f of process.argv.slice(2)) {
    const findings = check(f, fs.readFileSync(f, 'utf8'));
    total += findings.length;
    console.log(format(f, findings));
  }
  process.exit(total ? 1 : 0);
}
