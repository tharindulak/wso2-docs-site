// The site's rendering of the explicit content components a page writes (no import needed):
//   <Steps start={n}>  each heading directly inside at its first heading level is a step, numbered from `start`
//                      (default 1); a <Steps> inside a step makes sub-steps numbered from the parent (1.1, 1.2), shown
//                      with a filled badge; a <Steps> nested deeper only groups its content.
//   <Prerequisites>    a panel: the writer's own heading as its title, or `title="…"` (then no heading, not in the TOC).
//   <LinkCards>        the Markdown list it wraps as cards: link text is the title; the writer's text after the link,
//                      else the linked doc's description (components/LinkCards), is the description.
// Runs in the site build after Docusaurus has set heading ids, built the table of contents and resolved `.md` links,
// so headings keep their ids (`{/* #id */}` sets one) and TOC entries. A step's "Step N: " prefix is added in a visually
// hidden span, and to its TOC entry, so screen readers, anchors and the TOC read as before the components. The markup
// is that of the convention plugins this replaces. Styles: .steps, .prerequisites, .link-cards in the site CSS.
// Convention-written pages (`## Step 1: …`) get these components from the converter (conventions.ts).
import type { Heading, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import { cardsOfList, type LinkCard } from './link-cards.js';

type Node = Root | RootContent;

const isElement = (node: Node, name: string): node is MdxJsxFlowElement =>
  node.type === 'mdxJsxFlowElement' && node.name === name;

/** A block that renders as `<div>` with the given class; mdast-util-to-hast reads `data.hName` for unknown nodes. */
const block = (className: string, children: RootContent[], props: Record<string, string> = {}): RootContent =>
  ({ type: 'component', children, data: { hName: 'div', hProperties: { className: [className], ...props } } }) as unknown as RootContent;

/** An attribute's value: a string as written, or an expression's source (`start={2}`). */
function attribute(el: MdxJsxFlowElement, name: string): string | undefined {
  const found = el.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === name);
  if (!found || found.type !== 'mdxJsxAttribute' || found.value == null) return undefined;
  return typeof found.value === 'string' ? found.value : found.value.value;
}

/** Puts the hidden "Step N: " prefix first in a heading, and notes it for the heading's TOC entry. */
function prefix(heading: Heading, label: string, prefixes: Map<string, string>): void {
  const value = `Step ${label}: `;
  const span = { type: 'stepPrefix', children: [{ type: 'text', value }], data: { hName: 'span', hProperties: { className: ['steps__prefix'] } } };
  heading.children = [span as unknown as PhrasingContent, ...heading.children];
  const id = (heading.data as { id?: unknown } | undefined)?.id;
  if (typeof id === 'string') prefixes.set(id, value);
}

/** The steps of a <Steps>: each heading at the first heading level starts one; content before the first stays first. */
function split(el: MdxJsxFlowElement): { before: RootContent[]; steps: RootContent[][] } {
  const children = el.children as RootContent[];
  const level = (children.find((c) => c.type === 'heading') as Heading | undefined)?.depth;
  const before: RootContent[] = [];
  const steps: RootContent[][] = [];
  for (const child of children) {
    if (child.type === 'heading' && child.depth === level) steps.push([child]);
    else (steps.at(-1) ?? before).push(child);
  }
  return { before, steps };
}

const startOf = (el: MdxJsxFlowElement): number => {
  const n = Number(attribute(el, 'start') ?? 1);
  return Number.isFinite(n) ? n : 1;
};

/** A <Prerequisites> panel: headed by its `title`, else by the writer's leading heading; the rest is the body. */
function prerequisites(el: MdxJsxFlowElement): RootContent {
  const children = el.children as RootContent[];
  const title = attribute(el, 'title');
  let head: RootContent | undefined;
  let body = children;
  if (title !== undefined) {
    head = { type: 'paragraph', children: [{ type: 'text', value: title }], data: { hProperties: { className: ['prerequisites__title'] } } } as RootContent;
  } else if (children[0]?.type === 'heading') {
    [head, ...body] = children;
  }
  return block('prerequisites', [...(head ? [block('prerequisites__head', [head])] : []), block('prerequisites__body', body)]);
}

/** A JSON value as an estree expression, so the attribute carries data without any code built from strings. */
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
function estree(value: Json): object {
  if (Array.isArray(value)) return { type: 'ArrayExpression', elements: value.map(estree) };
  if (value && typeof value === 'object') {
    return {
      type: 'ObjectExpression',
      properties: Object.entries(value).map(([k, v]) => ({
        type: 'Property', kind: 'init', key: { type: 'Literal', value: k }, value: estree(v), method: false, shorthand: false, computed: false,
      })),
    };
  }
  return { type: 'Literal', value };
}

/**
 * <LinkCards> gets the cards of the list it wraps as its `items`; the list stays as its children, which the component
 * shows when it cannot draw cards. Anything but one list of links gets no items.
 */
function linkCards(el: MdxJsxFlowElement): void {
  if (el.attributes.some((a) => a.type === 'mdxJsxAttribute' && a.name === 'items')) return;
  const content = (el.children as RootContent[]).filter((n) => !silent(n));
  const items = content.length === 1 && content[0].type === 'list' ? cardsOfList(content[0]) : null;
  if (!items) return;
  const program = { type: 'Program', sourceType: 'module', body: [{ type: 'ExpressionStatement', expression: estree(items as unknown as Json) }] };
  el.attributes.push({ type: 'mdxJsxAttribute', name: 'items', value: { type: 'mdxJsxAttributeValueExpression', value: JSON.stringify(items satisfies LinkCard[]), data: { estree: program as never } } });
}

/** Nodes that render nothing: MDX comments. */
const silent = (node: RootContent): boolean => node.type === 'mdxFlowExpression' && /^\s*\/\*[\s\S]*\*\/\s*$/.test(node.value);

/** Where a node sits: inside step N (its <Steps> make sub-steps), inside a sub-step (no more numbering), or neither. */
type Context = { step?: number; sub?: boolean };

function render(node: Node, ctx: Context, prefixes: Map<string, string>, partials: Set<string>): void {
  if (!('children' in node)) return;
  const parent = node as Parent;
  const out: RootContent[] = [];
  for (const child of parent.children as RootContent[]) {
    if (isElement(child, 'Steps')) {
      const { before, steps } = split(child);
      before.forEach((c) => render(c, ctx, prefixes, partials));
      if (ctx.step === undefined) {
        const items = steps.map((nodes, i) => {
          const n = startOf(child) + i;
          prefix(nodes[0] as Heading, String(n), prefixes);
          const step = block('steps__step', nodes, { dataStep: String(n) });
          render(step, { step: n }, prefixes, partials);
          return step;
        });
        out.push(block('steps', [...before, ...items]));
      } else if (!ctx.sub) {
        // Sub-steps: the headings stay in the parent step, each with its number as a badge (CSS reads data-substep).
        out.push(...before);
        steps.forEach((nodes, i) => {
          const label = `${ctx.step}.${startOf(child) + i}`;
          const heading = nodes[0] as Heading;
          prefix(heading, label, prefixes);
          const data = (heading.data ??= {}) as { hProperties?: Record<string, unknown> };
          const props = (data.hProperties ??= {});
          props.className = ['steps__substep'];
          props.dataSubstep = label;
          const holder = { type: 'root', children: nodes } as Root;
          render(holder, { ...ctx, sub: true }, prefixes, partials);
          out.push(...(holder.children as RootContent[]));
        });
      } else {
        const holder = { type: 'root', children: child.children } as Root;
        render(holder, ctx, prefixes, partials);
        out.push(...(holder.children as RootContent[]));
      }
      continue;
    }
    if (isElement(child, 'LinkCards')) {
      linkCards(child);
      out.push(child);
      continue;
    }
    if (isElement(child, 'Prerequisites')) {
      const panel = prerequisites(child);
      render(panel, ctx, prefixes, partials);
      out.push(panel);
      continue;
    }
    const el = child as Node;
    if (ctx.step !== undefined && !ctx.sub && el.type === 'mdxJsxFlowElement' && partials.has((el as MdxJsxFlowElement).name ?? '')) {
      // A partial is compiled on its own and cannot know it sits in a step: CSS shows its steps as this step's sub-steps.
      out.push(block('steps__nested', [child], { dataParent: String(ctx.step), style: `counter-reset: steps-parent ${ctx.step}` }));
      continue;
    }
    render(child, ctx, prefixes, partials);
    out.push(child);
  }
  parent.children = out as never;
}

/** Components the page imports from a `_partials/` folder (`import Deploy from '../_partials/deploy/steps.mdx'`). */
function partialNames(tree: Root): Set<string> {
  type Spec = { type: string; local: { name: string } };
  const names = new Set<string>();
  for (const node of tree.children) {
    if (node.type !== 'mdxjsEsm') continue;
    for (const s of (node.data?.estree?.body ?? []) as unknown as { type: string; source?: { value?: unknown }; specifiers?: Spec[] }[]) {
      if (s.type !== 'ImportDeclaration' || typeof s.source?.value !== 'string' || !/(?:^|\/)_partials\//.test(s.source.value)) continue;
      for (const spec of s.specifiers ?? []) if (spec.type === 'ImportDefaultSpecifier') names.add(spec.local.name);
    }
  }
  return names;
}

/** Adds each step heading's "Step N: " to its entry in the `toc` export Docusaurus put on the page. */
function prefixToc(tree: Root, prefixes: Map<string, string>): void {
  if (!prefixes.size) return;
  type Lit = { type: string; value?: unknown; raw?: string };
  type Prop = { type: string; key: Lit & { name?: string }; value: Lit };
  for (const node of tree.children) {
    if (node.type !== 'mdxjsEsm') continue;
    const body = (node.data?.estree?.body ?? []) as unknown as { type: string; declaration?: { declarations?: { id: { name?: string }; init?: { type: string; elements: { type: string; properties: Prop[] }[] } }[] } }[];
    for (const statement of body) {
      for (const d of statement.declaration?.declarations ?? []) {
        if (d.id.name !== 'toc' || d.init?.type !== 'ArrayExpression') continue;
        for (const entry of d.init.elements) {
          if (entry?.type !== 'ObjectExpression') continue;
          const field = (k: string) => entry.properties.find((p) => (p.key.value ?? p.key.name) === k)?.value;
          const id = field('id')?.value;
          const value = field('value');
          const add = typeof id === 'string' ? prefixes.get(id) : undefined;
          if (!add || !value || typeof value.value !== 'string') continue;
          value.value = add + value.value;
          delete value.raw;
        }
      }
    }
  }
}

export default function remarkComponents() {
  return (tree: Root): void => {
    const prefixes = new Map<string, string>();
    render(tree, {}, prefixes, partialNames(tree));
    prefixToc(tree, prefixes);
  };
}
