// Raw HTML blocks the MDX parser cannot read (text and blank lines inside table cells, unclosed tags).
// MkDocs passes a raw HTML block through as written; here it is parsed as a browser would (repairing the
// nesting) and written back as one line of well-formed JSX whose text is literal, as it is in MkDocs.
// Input has already passed the HTML policy (no scripts, event handlers or unsafe URLs).
import { parseFragment } from 'parse5';
import { isValidTagName } from './rehype-valid-elements.js';

// Minimal parse5 tree shape used here.
interface P5Node {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: P5Node[];
  content?: { childNodes: P5Node[] };
  parentNode?: P5Node | null;
}

const BLOCK_TAGS = ['table', 'div', 'ul', 'ol', 'dl', 'details', 'blockquote', 'section', 'center'];
const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']);
const NO_TEXT = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'ul', 'ol', 'dl']); // React rejects whitespace here
const BLOCK = new Set([...BLOCK_TAGS, ...NO_TEXT, 'li', 'p', 'pre', 'td', 'th', 'dt', 'dd', 'summary', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'figure', 'caption']);

/** Whitespace-only text a browser would not render: at a block's edge or next to a block element. */
function droppable(node: P5Node): boolean {
  const siblings = node.parentNode?.childNodes ?? [];
  const at = siblings.indexOf(node);
  const isBlock = (n: P5Node | undefined): boolean => Boolean(n?.tagName && BLOCK.has(n.tagName));
  return NO_TEXT.has(node.parentNode?.nodeName ?? '') || at === 0 || at === siblings.length - 1 || isBlock(siblings[at - 1]) || isBlock(siblings[at + 1]);
}
const JSX_ATTR: Record<string, string> = {
  class: 'className', for: 'htmlFor', colspan: 'colSpan', rowspan: 'rowSpan', tabindex: 'tabIndex', cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing', frameborder: 'frameBorder', allowfullscreen: 'allowFullScreen', srcset: 'srcSet', datetime: 'dateTime',
};
const START = new RegExp(`^( *)<(${BLOCK_TAGS.join('|')})\\b[^>]*>`, 'i');
const FENCE = /^\s*(```|~~~)/;

function toJsx(node: P5Node, inPre = false): string {
  if (node.nodeName === '#text') {
    let text = inPre ? node.value ?? '' : (node.value ?? '').replace(/\s+/g, ' ');
    const parentTag = node.parentNode?.tagName;
    if (!inPre && parentTag && BLOCK.has(parentTag)) { // a block's edge whitespace is not rendered
      const siblings = node.parentNode!.childNodes ?? [];
      if (siblings[0] === node) text = text.trimStart();
      if (siblings.at(-1) === node) text = text.trimEnd();
    }
    if (!text.trim() && !inPre && droppable(node)) return '';
    return text ? `{${JSON.stringify(text)}}` : '';
  }
  if (!node.tagName) return (node.childNodes ?? []).map((c) => toJsx(c, inPre)).join(''); // fragment; comments dropped
  if (!isValidTagName(node.tagName)) { // placeholder text such as <host.com-home>: back to text, children follow
    return `{${JSON.stringify(`<${node.tagName}>`)}}${(node.childNodes ?? []).map((c) => toJsx(c, inPre)).join('')}`;
  }
  const attrs = (node.attrs ?? [])
    .filter((a) => /^[a-z_:][\w:.-]*$/i.test(a.name) && a.name !== 'style' && a.name !== 'markdown')
    .map((a) => ` ${JSX_ATTR[a.name] ?? a.name}={${JSON.stringify(a.value)}}`).join('');
  if (VOID.has(node.tagName)) return `<${node.tagName}${attrs} />`;
  const children = ((node.tagName === 'template' ? node.content?.childNodes : node.childNodes) ?? [])
    .map((c) => toJsx(c, inPre || node.tagName === 'pre')).join('');
  return `<${node.tagName}${attrs}>${children}</${node.tagName}>`;
}

/**
 * Rewrite each multi-line top-level HTML block (outside fenced code) as one line of JSX, keeping its
 * indentation so it stays inside a list item. `protect` may swap the JSX for a placeholder.
 */
export function htmlBlocksToJsx(text: string, { protect = (jsx: string) => jsx }: { protect?: (jsx: string) => string } = {}): { text: string; blocks: number } {
  const lines = text.split('\n');
  const out: string[] = [];
  let blocks = 0;
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (FENCE.test(line)) fenced = !fenced;
    const start = !fenced ? line.match(START) : null;
    if (!start) { out.push(line); continue; }
    const tag = start[2]!.toLowerCase();
    const open = new RegExp(`<${tag}\\b`, 'gi');
    const close = new RegExp(`</${tag}\\s*>`, 'gi');
    let depth = 0;
    let end = -1;
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j]!.match(open) ?? []).length - (lines[j]!.match(close) ?? []).length;
      if (depth <= 0) { end = j; break; }
    }
    if (end <= i) { out.push(line); continue; } // one line, or never closed: leave as written
    const jsx = toJsx(parseFragment(lines.slice(i, end + 1).join('\n').trim()) as unknown as P5Node);
    out.push(start[1]! + protect(jsx));
    blocks++;
    i = end;
  }
  return { text: blocks ? out.join('\n') : text, blocks };
}
