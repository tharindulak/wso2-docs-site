// Converter step: where a page follows a writing convention, write the explicit content component the site renders
// (remark-components.ts). Runs on MDX text and changes only what it wraps, so the rest of the page stays as written:
//   - a run of `Step N:` headings (two or more at one level, each number above the last; or one that continues the
//     numbering of an earlier stepper on the page) is wrapped in <Steps>
//     (`start` when the first number is not 1); each heading loses its "Step N:" prefix (also written `**Step 1**:`) and
//     keeps its old anchor as an explicit id: `## Configure Azure {/* #step-1-configure-azure */}`. `Step N.M` (or `Step Na`)
//     headings inside a step become a nested <Steps> (sub-steps), closed at the next heading that is not a sub-step; so
//     does a run of plain `Step N` headings inside a step.
//   - an h2/h3 "Prerequisites" or "Before you begin" heading and its block (to the next heading at its level or above,
//     or a stepper) is wrapped in <Prerequisites>; an admonition with that title becomes <Prerequisites title="…">.
//   - a closing section ("What's next", "See also", …) that is one list of links (after at most one intro paragraph)
//     gets the list wrapped in <LinkCards>.
// Opt-outs in front matter: `stepper: false`, `prerequisites: false`, `link_cards: false`. Content already inside an
// explicit component is left alone, so the step can run again on its own output. Used for MkDocs sources on every
// conversion (page.ts) and by the tree writer (tree.ts), which wrote the Identity tree's explicit components once.
// Docusaurus-kind sources are taken as written (site.ts prepareDocusaurusDocs).
import { createProcessor } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import type { Heading, List, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import { cardsOfList } from './link-cards.js';

/** `Step 1:`, `Step 1 -`, `Step 1 –`, `Step 1—` (a dash needs no spaces), `Step 1.` or `Step 1 Title`; not `Step 1.1`. */
const STEP = /^Step\s+(\d+)(?!\.\d)\s*(?:[–—]\s*|[:.\-]?\s+)/i;
/** A sub-step inside a step: `Step 1.1:` or `Step 1a:` (a letter is its place: a is 1), and the same separators. */
const SUB_STEP = /^Step\s+(\d+)(?:\.(\d+)|([a-z])(?![a-z]))\s*(?:[–—]\s*|[:.\-]?\s+)/i;
const subStepNumber = (m: RegExpExecArray): number => (m[2] ? Number(m[2]) : m[3].toLowerCase().charCodeAt(0) - 96);
/** "Prerequisites" or "Before you begin", in any case; a trailing "!" too (88 docs-is admonitions write one). */
const PREREQUISITES = /^(prerequisites|before you begin)!?$/i;
/** "What's next" (with or without "?", straight or curly apostrophe) and the other closing titles, in any case. */
const CLOSING = /^(what['’]?s next\??|next steps|see also|learn more|related topics|related links|further reading)$/i;
/** Admonition types Docusaurus knows (with the site's `deprecated`); other directives are not admonitions. */
const ADMONITIONS = new Set(['note', 'tip', 'info', 'warning', 'danger', 'caution', 'important', 'success', 'secondary', 'deprecated']);
/** The explicit components: what they hold is left as written. */
const COMPONENTS = new Set(['Steps', 'Prerequisites', 'LinkCards']);

export interface WrittenComponents { steps: number; subSteps: number; prerequisites: number; linkCards: number; renumbered: number }
export interface ComponentsResult { text: string; written: WrittenComponents }

type Node = Root | RootContent;
type Positioned = { position?: { start: { offset?: number }; end: { offset?: number } } };
const start = (n: Positioned): number => n.position!.start.offset!;
const end = (n: Positioned): number => n.position!.end.offset!;

/** Plain text as a reader sees it: MDX expressions (comments) and raw HTML left out. */
const text = (node: RootContent | PhrasingContent): string =>
  node.type === 'mdxTextExpression' || node.type === 'html' ? ''
    : 'value' in node ? String(node.value) : 'children' in node ? (node.children as PhrasingContent[]).map(text).join('') : '';

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
const depthOf = (node: RootContent): number => (node.type === 'heading' ? node.depth : 0);
const isComponent = (node: Node): boolean => node.type === 'mdxJsxFlowElement' && COMPONENTS.has(node.name ?? '');

/**
 * Heading ids as Docusaurus sets them (mdx-loader remark/headings with github-slugger): an explicit `{/* #id *\/}`
 * comment, else the heading text lowercased, with everything but letters, marks, digits, `_`, `-` and spaces dropped,
 * spaces as `-`, and `-1`, `-2` … on repeats.
 */
export function headingIds(tree: Root): Map<Heading, string> {
  const ids = new Map<Heading, string>();
  const seen = new Map<string, number>();
  const slug = (value: string): string => {
    const base = value.toLowerCase().replace(/[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc} -]/gu, '').replace(/ /g, '-');
    let id = base;
    while (seen.has(id)) {
      const n = seen.get(base)! + 1;
      seen.set(base, n);
      id = `${base}-${n}`;
    }
    seen.set(id, 0);
    return id;
  };
  const visit = (node: Node): void => {
    if (node.type === 'heading') {
      const explicit = commentId(node);
      const toString = (n: RootContent | PhrasingContent): string =>
        'value' in n ? String(n.value) : 'children' in n ? (n.children as PhrasingContent[]).map(toString).join('') : '';
      ids.set(node, explicit ?? slug(node.children.filter((c) => c.type !== 'html').map(toString).join('')));
    }
    if ('children' in node) for (const child of node.children as RootContent[]) visit(child);
  };
  visit(tree);
  return ids;
}

/** The id a heading's trailing `{/* #id *\/}` comment sets, if any. */
function commentId(heading: Heading): string | undefined {
  const last = heading.children.at(-1);
  if (last?.type !== 'mdxTextExpression') return undefined;
  const m = /^\s*\/\*\s*#(\S+?)[\s*]/.exec(last.value + ' ');
  return m?.[1];
}

/**
 * One change to the source: replace [from, to) with `insert`. Changes at one offset end up in this order: plain edits
 * (an id after a heading), then closing tags (inner first), then opening tags (outer first); `span` is the wrapper's size.
 */
interface Edit { from: number; to: number; insert: string; kind: 'edit' | 'close' | 'open'; span: number }

/** Virtual nodes standing for what the step has wrapped, so later conventions see the structure the site renders. */
interface Wrapped { type: 'wrapped'; kind: 'steps' | 'step' | 'prerequisites'; children: RootContent[] }
const wrapped = (kind: Wrapped['kind'], children: RootContent[]): RootContent => ({ type: 'wrapped', kind, children }) as unknown as RootContent;
const isWrapped = (node: Node, kind: Wrapped['kind']): boolean => node.type === ('wrapped' as string) && (node as unknown as Wrapped).kind === kind;

class Writer {
  readonly edits: Edit[] = [];
  readonly written: WrittenComponents = { steps: 0, subSteps: 0, prerequisites: 0, linkCards: 0, renumbered: 0 };
  /** The number of the last step wrapped so far on the page: a lone step that continues it gets a stepper too. */
  lastStep = -Infinity;
  constructor(readonly source: string, readonly ids: Map<Heading, string>) {}

  /** What stands before a node on its line (indentation, `>` of a blockquote), repeated on the lines written. */
  indent(offset: number): string {
    const lineStart = this.source.lastIndexOf('\n', offset - 1) + 1;
    const before = this.source.slice(lineStart, offset);
    return /^[\s>]*$/.test(before) ? before : before.replace(/[^\s>]/g, ' ');
  }

  /** Wraps the nodes from `first` to `last` in `<open>` … `</name>`; inner wrappers open after and close before outer ones. */
  wrap(first: RootContent, last: RootContent, open: string, name: string): void {
    const from = start(first);
    const to = end(last);
    const indent = this.indent(from);
    const blank = indent.trimEnd();
    this.edits.push({ from, to: from, insert: `${open}\n${blank}\n${indent}`, kind: 'open', span: to - from });
    this.edits.push({ from: to, to, insert: `\n${blank}\n${indent}</${name}>`, kind: 'close', span: to - from });
  }

  replace(from: number, to: number, insert: string): void {
    this.edits.push({ from, to, insert, kind: 'edit', span: 0 });
  }

  /** Removes a heading's `Step N:` prefix (bold or not) and gives it its old anchor as an explicit id. */
  rewriteHeading(heading: Heading, prefix: RegExp): void {
    const [first, second] = heading.children;
    const raw = (n: PhrasingContent): string => this.source.slice(start(n), end(n));
    let cut: [number, number] | null = null;
    if (first?.type === 'text') {
      const m = prefix.exec(raw(first));
      if (m) cut = [start(first), start(first) + m[0].length];
    } else if ((first?.type === 'strong' || first?.type === 'emphasis') && first.children.every((c) => c.type === 'text')) {
      // `**Step 1**: Scan`: the bold number and the separator after it go; bold that runs past the prefix stays.
      const inner = text(first);
      const after = second?.type === 'text' ? second.value : '';
      const m = prefix.exec(inner + after);
      if (m && inner.length <= m[0].length) {
        const rest = m[0].length - inner.length;
        cut = [start(first), second?.type === 'text' ? start(second) + rest : end(first)];
      }
    }
    if (!cut) return;
    this.replace(cut[0], cut[1], '');
    const id = this.ids.get(heading);
    if (id && !commentId(heading)) this.replace(end(heading.children.at(-1)!), end(heading.children.at(-1)!), ` {/* #${id} */}`);
  }
}

/** How many of `nodes`, from the end, are thematic breaks: a `---` that ends a block closes the section, not the box. */
const trailingBreaks = (nodes: RootContent[]): number => {
  let k = 0;
  while (k < nodes.length && nodes[nodes.length - 1 - k].type === 'thematicBreak') k++;
  return k;
};

const stepNumber = (node: RootContent): number | null => {
  if (node.type !== 'heading') return null;
  const m = STEP.exec(text(node));
  return m ? Number(m[1]) : null;
};

/** Sub-step headings in a step's body: each group at one level, closed at the next heading that is not one of them. */
function subSteps(w: Writer, body: RootContent[], depth: number, step: number): void {
  let group: { depth: number; first: RootContent; last: RootContent; start: number; count: number } | null = null;
  const close = (): void => {
    if (!group) return;
    w.wrap(group.first, group.last, `<Steps${group.start === 1 ? '' : ` start={${group.start}}`}>`, 'Steps');
    w.written.subSteps += group.count;
    group = null;
  };
  for (const node of body) {
    const deeper = node.type === 'heading' && node.depth > depth;
    const m = deeper ? SUB_STEP.exec(text(node)) : null;
    // A plain `Step N` run inside a step numbers its sub-steps on its own (multi-DC: Step 1 to 7 under Step 2).
    const plain = deeper && !m ? STEP.exec(text(node)) : null;
    if (m || plain) {
      const heading = node as Heading;
      if (group && group.depth !== heading.depth) close();
      const [n, sub] = m ? [Number(m[1]), subStepNumber(m)] : [step, Number(plain![1])];
      if (!group) group = { depth: heading.depth, first: node, last: node, start: sub, count: 0 };
      if (n !== step || sub !== group.start + group.count) w.written.renumbered++;
      group.count++;
      group.last = node;
      w.rewriteHeading(heading, m ? SUB_STEP : STEP);
      continue;
    }
    if (group && depthOf(node) && depthOf(node) <= group.depth) close();
    if (group && node.type !== 'thematicBreak') group.last = node;
  }
  close();
}

/** Wraps each run in `children` (as the site's stepper did): Step headings at one level, each number above the last. */
function wrapRuns(w: Writer, children: RootContent[]): RootContent[] {
  const out: RootContent[] = [];
  let i = 0;
  while (i < children.length) {
    const first = stepNumber(children[i]);
    if (first === null) { out.push(children[i++]); continue; }
    const depth = depthOf(children[i]);
    const steps: { n: number; nodes: RootContent[] }[] = [];
    let previous = -Infinity;
    let n: number | null = first;
    while (n !== null && n > previous && depthOf(children[i]) === depth) {
      const from = i++;
      while (i < children.length && !(depthOf(children[i]) && depthOf(children[i]) <= depth)) i++;
      steps.push({ n, nodes: children.slice(from, i) });
      previous = n;
      n = i < children.length ? stepNumber(children[i]) : null;
    }
    // A lone step stays as written unless it continues an earlier stepper's numbering (Step 9 in its own section).
    if (steps.length < 2 && first !== w.lastStep + 1) { out.push(...steps[0].nodes); continue; }
    w.lastStep = first + steps.length - 1;
    const lastStep = steps.at(-1)!.nodes;
    const after = lastStep.splice(lastStep.length - trailingBreaks(lastStep.slice(1)));
    w.wrap(steps[0].nodes[0], lastStep.at(-1)!, `<Steps${first === 1 ? '' : ` start={${first}}`}>`, 'Steps');
    w.written.steps += steps.length;
    out.push(wrapped('steps', steps.map(({ n: num, nodes }, k) => {
      if (num !== first + k) w.written.renumbered++;
      w.rewriteHeading(nodes[0] as Heading, STEP);
      subSteps(w, nodes.slice(1), depth, first + k);
      return wrapped('step', nodes);
    })));
    out.push(...after);
  }
  return out;
}

/** Steps in the page and in JSX blocks (Applies, TabItem), also inside a step; explicit components are left alone. */
function visitSteps(w: Writer, node: Node): void {
  if (!('children' in node) || isComponent(node)) return;
  const parent = node as Parent;
  if (node.type === 'root' || node.type === 'mdxJsxFlowElement') parent.children = wrapRuns(w, parent.children as RootContent[]);
  for (const child of parent.children as RootContent[]) {
    if (child.type === 'mdxJsxFlowElement') visitSteps(w, child);
    else if (isWrapped(child, 'steps')) for (const step of (child as unknown as Wrapped).children) for (const c of (step as unknown as Wrapped).children) if (c.type === 'mdxJsxFlowElement') visitSteps(w, c);
  }
}

/** An admonition titled "Prerequisites" or "Before you begin": its title, and its content without the title. */
function prerequisitesAdmonition(node: RootContent): { title: string; body: RootContent[] } | null {
  if (node.type !== 'containerDirective' || !ADMONITIONS.has(node.name)) return null;
  const [label, ...body] = node.children as RootContent[];
  if (label?.type !== 'paragraph' || !(label.data as { directiveLabel?: boolean } | undefined)?.directiveLabel) return null;
  const title = squash(text(label));
  return PREREQUISITES.test(title) && body.length ? { title, body } : null;
}

/** Wraps each prerequisites block in `children`; a stepper ends a heading's block. */
function wrapPrerequisites(w: Writer, children: RootContent[]): RootContent[] {
  const out: RootContent[] = [];
  let i = 0;
  while (i < children.length) {
    const node = children[i++];
    const admonition = prerequisitesAdmonition(node);
    if (admonition) {
      const { body } = admonition;
      const indent = w.indent(start(node));
      w.replace(start(node), start(body[0]), `<Prerequisites title="${admonition.title.replace(/"/g, '&quot;')}">\n${indent.trimEnd()}\n${indent}`);
      w.replace(end(body.at(-1)!), end(node), `\n${indent.trimEnd()}\n${indent}</Prerequisites>`);
      w.written.prerequisites++;
      out.push(wrapped('prerequisites', [node]));
      continue;
    }
    const depth = depthOf(node);
    if ((depth !== 2 && depth !== 3) || !PREREQUISITES.test(text(node).trim())) { out.push(node); continue; }
    const from = i;
    while (i < children.length && !isWrapped(children[i], 'steps') && !(depthOf(children[i]) && depthOf(children[i]) <= depth)) i++;
    const last = i - trailingBreaks(children.slice(from, i));
    if (last === from) { out.push(node, ...children.slice(from, i)); continue; } // nothing to box
    w.wrap(node, children[last - 1], '<Prerequisites>', 'Prerequisites');
    w.written.prerequisites++;
    out.push(wrapped('prerequisites', [node, ...children.slice(from, last)]), ...children.slice(last, i));
  }
  return out;
}

function visitPrerequisites(w: Writer, node: Node): void {
  if (!('children' in node) || isComponent(node) || isWrapped(node, 'prerequisites')) return;
  const parent = node as Parent;
  parent.children = wrapPrerequisites(w, parent.children as RootContent[]);
  for (const child of parent.children as RootContent[]) visitPrerequisites(w, child);
}

/** Nodes that render nothing: ESM and MDX comments. */
const silent = (node: RootContent): boolean =>
  node.type === 'mdxjsEsm' || (node.type === 'mdxFlowExpression' && /^\s*\/\*[\s\S]*\*\/\s*$/.test(node.value));

/** The list of a closing section that is one list of links, optionally after one intro paragraph; else null. */
function closingList(body: RootContent[]): List | null {
  const content = body.filter((n) => !silent(n));
  const intro = content.length === 2 && content[0].type === 'paragraph';
  if (!(content.length === 1 || intro)) return null;
  const list = content[content.length - 1];
  return list.type === 'list' && cardsOfList(list) ? list : null;
}

function wrapClosingSections(w: Writer, children: RootContent[]): void {
  let i = 0;
  while (i < children.length) {
    const node = children[i++];
    const depth = depthOf(node);
    if ((depth !== 2 && depth !== 3) || !CLOSING.test(squash(text(node)))) continue;
    const from = i;
    while (i < children.length && !(depthOf(children[i]) && depthOf(children[i]) <= depth)) i++;
    const list = closingList(children.slice(from, i));
    if (list) { w.wrap(list, list, '<LinkCards>', 'LinkCards'); w.written.linkCards++; }
  }
}

/** Closing sections at every level (the page, JSX blocks, steps, panels); explicit components are left alone. */
function visitClosingSections(w: Writer, node: Node): void {
  if (!('children' in node) || isComponent(node)) return;
  const parent = node as Parent;
  wrapClosingSections(w, parent.children as RootContent[]);
  for (const child of parent.children as RootContent[]) visitClosingSections(w, child);
}

const parser = createProcessor({ remarkPlugins: [remarkGfm, remarkDirective] });

/** Writes the explicit components into MDX that follows the conventions; the text is unchanged where none applies. */
export function writeComponents(source: string, { frontMatter = {} }: { frontMatter?: Record<string, unknown> } = {}): ComponentsResult {
  const none: WrittenComponents = { steps: 0, subSteps: 0, prerequisites: 0, linkCards: 0, renumbered: 0 };
  let tree: Root;
  try {
    tree = parser.parse(source) as Root;
  } catch {
    return { text: source, written: none }; // not MDX: the page's compile check reports it
  }
  const w = new Writer(source, headingIds(tree));
  if (frontMatter.stepper !== false) visitSteps(w, tree);
  if (frontMatter.prerequisites !== false) visitPrerequisites(w, tree);
  if (frontMatter.link_cards !== false) visitClosingSections(w, tree);
  if (!w.edits.length) return { text: source, written: none };
  // Applied from the end of the text; at one offset, the change that ends up last is applied first.
  const sorted = [...w.edits].sort((a, b) => b.from - a.from || place(b) - place(a));
  let text = source;
  for (const e of sorted) text = text.slice(0, e.from) + e.insert + text.slice(e.to);
  // Malformed source (an admonition left open) can put a closing tag where MDX cannot read it: then nothing is written.
  try { parser.parse(text); } catch { return { text: source, written: none }; }
  return { text, written: w.written };
}

/** Where a change ends up among the changes at its offset (see Edit). */
const place = (e: Edit): number => (e.kind === 'edit' ? 0 : e.kind === 'close' ? 1e9 + e.span : 3e9 - e.span);

/**
 * Lines (1-based) of each nested `</Steps>` whose last sub-step is followed by text before it: the rewrite closes a
 * nested <Steps> at the next heading, so such text may belong to the parent step. For a writer to review.
 */
export function subStepReview(source: string): number[] {
  let tree: Root;
  try { tree = parser.parse(source) as Root; } catch { return []; }
  const lines: number[] = [];
  const isSteps = (n: Node): n is Extract<RootContent, { type: 'mdxJsxFlowElement' }> => n.type === 'mdxJsxFlowElement' && n.name === 'Steps';
  const visit = (node: Node, inSteps: boolean): void => {
    if (isSteps(node) && inSteps) {
      const kids = node.children as RootContent[];
      const last = kids.map((k) => k.type).lastIndexOf('heading');
      if (last >= 0 && kids.slice(last + 1).some((k) => k.type !== 'heading' && !silent(k))) lines.push(node.position!.end.line);
    }
    if ('children' in node) for (const child of node.children as RootContent[]) visit(child, inSteps || isSteps(node));
  };
  visit(tree, false);
  return lines;
}
