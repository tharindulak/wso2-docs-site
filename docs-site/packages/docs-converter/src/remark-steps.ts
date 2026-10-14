// Runs of `Step N` headings render as a stepper, without author changes (about 1,000 pages write procedures this way).
// The source keeps `## Step N: Title`, so MkDocs preview, Markdown output and search are unchanged. On the site each
// step is wrapped with its content, the circle shows the author's number, and the prefix moves into a visually hidden
// span, so anchors and screen readers still read "Step N:". A `Step N.M` sub-step inside a step shows its number as a
// badge, its prefix hidden the same way. Runs in the site build, after Docusaurus has set heading ids and the table of
// contents, so both MkDocs and Docusaurus-kind sources get it. A page opts out with `stepper: false` in front matter.
// Styles: .steps in the site CSS.
import type { Heading, Parent, PhrasingContent, Root, RootContent } from 'mdast';

/** `Step 1:`, `Step 1 -`, `Step 1 –`, `Step 1.` or `Step 1 Title`; not the `Step 1.1` sub-step form. */
const STEP = /^Step\s+(\d+)(?!\.\d)\s*[:.\-–]?\s+/i;
/** A sub-step inside a step: `Step 1.1:` and the same separators. */
const SUB_STEP = /^Step\s+(\d+\.\d+)\s*[:.\-–]?\s+/i;

/** Block containers whose children can hold a run: the page, and JSX blocks such as Applies and TabItem. */
const CONTAINERS = new Set(['root', 'mdxJsxFlowElement']);

const text = (node: RootContent | PhrasingContent): string =>
  'value' in node ? String(node.value) : 'children' in node ? (node.children as PhrasingContent[]).map(text).join('') : '';

const depthOf = (node: RootContent): number => (node.type === 'heading' ? node.depth : 0);

const stepNumber = (node: RootContent): number | null => {
  if (node.type !== 'heading') return null;
  const m = STEP.exec(text(node));
  return m ? Number(m[1]) : null;
};

/** A block that renders as `<div>` with the given class; mdast-util-to-hast reads `data.hName` for unknown nodes. */
const block = (className: string, children: RootContent[], props: Record<string, string> = {}): RootContent =>
  ({ type: 'steps', children, data: { hName: 'div', hProperties: { className: [className], ...props } } }) as unknown as RootContent;

/** Moves the "Step N: " prefix of a heading's leading text into a span the site hides visually. */
function hidePrefix(heading: Heading, prefix: RegExp = STEP): void {
  const [first, ...rest] = heading.children;
  if (first?.type !== 'text') return;
  const m = prefix.exec(first.value);
  if (!m) return;
  const span = { type: 'stepPrefix', children: [{ type: 'text', value: m[0] }], data: { hName: 'span', hProperties: { className: ['steps__prefix'] } } };
  const remainder = first.value.slice(m[0].length);
  heading.children = [span as unknown as PhrasingContent, ...(remainder ? [{ ...first, value: remainder }] : []), ...rest];
}

/**
 * A `Step N.M` heading inside a step shows its number as a badge (CSS reads `data-substep`), and its prefix is hidden
 * like a step's. The heading keeps its id and TOC entry, set before this plugin runs.
 */
function markSubStep(heading: Heading): void {
  const m = SUB_STEP.exec(text(heading));
  if (!m) return;
  hidePrefix(heading, SUB_STEP);
  const data = (heading.data ??= {}) as { hProperties?: Record<string, unknown> };
  const props = (data.hProperties ??= {});
  const className = props.className;
  props.className = [...(Array.isArray(className) ? className : className ? [String(className)] : []), 'steps__substep'];
  props.dataSubstep = m[1];
}

/**
 * Wraps each run in `children`: Step headings at one level, each number above the previous; a step's content runs to
 * the next heading at its level or above. A lone Step heading stays as written.
 */
function wrapRuns(children: RootContent[]): RootContent[] {
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
      const start = i++;
      while (i < children.length && !(depthOf(children[i]) && depthOf(children[i]) <= depth)) i++;
      steps.push({ n, nodes: children.slice(start, i) });
      previous = n;
      n = i < children.length ? stepNumber(children[i]) : null;
    }
    if (steps.length < 2) { out.push(...steps[0].nodes); continue; }
    out.push(block('steps', steps.map(({ n: num, nodes }) => {
      hidePrefix(nodes[0] as Heading);
      nodes.slice(1).forEach((node) => { if (depthOf(node) > depth) markSubStep(node as Heading); });
      return block('steps__step', nodes, { dataStep: String(num) });
    })));
  }
  return out;
}

function visit(node: Root | RootContent): void {
  if (!('children' in node)) return;
  const parent = node as Parent;
  if (CONTAINERS.has(node.type)) parent.children = wrapRuns(parent.children as RootContent[]);
  // Into the steps just made too: a step can hold a JSX block with its own run.
  for (const child of parent.children) if (CONTAINERS.has(child.type) || child.type === ('steps' as string)) visit(child);
}

export default function remarkSteps() {
  // Docusaurus puts the page's front matter on the file it compiles (mdx-loader processor.js).
  return (tree: Root, file: { data: object }): void => {
    if ((file.data as { frontMatter?: { stepper?: unknown } }).frontMatter?.stepper === false) return;
    visit(tree);
  };
}
