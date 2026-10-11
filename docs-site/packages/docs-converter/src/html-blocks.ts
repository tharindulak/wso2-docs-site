// Raw HTML blocks the MDX parser cannot read (text and blank lines inside table cells, unclosed tags).
// The block is parsed as a browser would (repairing the nesting) and written back as one line of well-formed JSX.
// Python-Markdown passes an HTML block through as written only at document level (indented 3 spaces or less):
// there its text stays literal. A block indented 4 or more (inside a list item, admonition, details or tab) is
// paragraph text holding inline HTML, so its links, images, emphasis and code spans render; here they become
// Markdown links and images (which the later link rewrites and Docusaurus resolve) and JSX elements.
// Input has already passed the HTML policy (no scripts, event handlers or unsafe URLs).
import { parseFragment } from 'parse5';
import { isValidTagName } from './rehype-valid-elements.js';
import { joinTarget, splitTarget, targetEnd, unsafeUrl } from './syntax.js';

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
// <html> wraps admonition markup in some sources (`<html><div class="admonition note">`); the parser drops it. At
// document level it makes everything up to </html> raw, indented lines included.
const START = new RegExp(`^([ \\t]*)<(html|${BLOCK_TAGS.join('|')})\\b[^>]*>`, 'i');
const FENCE = /^\s*(```|~~~)/;
const HTML_TAG = /<\/?html\b[^>]*>/gi;
/** Indentation from which Python-Markdown reads an HTML block as Markdown text (it is inside a container). */
const NESTED = 4;
/** Width of an indentation, a tab reaching the next multiple of 4 (Python-Markdown's tab_length). */
const width = (indent: string): number => [...indent].reduce((w, c) => (c === '\t' ? w + 4 - (w % 4) : w + 1), 0);

/**
 * What a block is written as: one line of JSX for MDX, or (CommonMark pages, `mdx.format: md`) one line of HTML,
 * which CommonMark keeps raw. `markdown` renders the inline Markdown of its text (a nested block).
 */
export interface Out { html: boolean; markdown: boolean }

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A line break in a value or in <pre> text is a character reference, so the block stays on one line.
const escapeAttr = (text: string): string => escapeHtml(text).replace(/"/g, '&quot;').replace(/\r?\n/g, '&#10;');
/** Text as a JSX string literal or escaped HTML, whitespace collapsed as a browser renders it. */
const literal = (text: string, out: Out): string => {
  const t = text.replace(/\s+/g, ' ');
  return !t ? '' : out.html ? escapeHtml(t) : `{${JSON.stringify(t)}}`;
};
/** A link or image target for MDX: whitespace joined and encoded, characters MDX would read as syntax percent-encoded. */
const mdxTarget = (dest: string): string => joinTarget(dest)
  .replace(/[<>{}()"\\`]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(/&/g, '&amp;');
/** Backslash-escaped Markdown text (an image's alt, a title): every ASCII punctuation character escaped. */
const escaped = (text: string): string => text.replace(/\s+/g, ' ').replace(/[!-/:-@[-`{-~]/g, '\\$&');
const unquote = (title: string): string => title.slice(1, -1).replace(/\\(.)/g, '$1');
// Python-Markdown's backslash escapes.
const ESCAPABLE = '\\`*_{}[]()#+-.!';

interface ParsedLink { label: string; dest: string; title?: string; end: number }

/** `[label](target)` at `at` (the `[`), labels nesting brackets as Python-Markdown reads them. */
function linkAt(s: string, at: number): ParsedLink | null {
  let depth = 0;
  for (let j = at; j < s.length; j++) {
    const c = s[j]!;
    if (c === '\\') { j++; continue; }
    if (c === '[') depth++;
    else if (c === ']' && --depth === 0) {
      if (s[j + 1] !== '(') return null;
      const end = targetEnd(s, j + 2);
      return end < 0 ? null : { label: s.slice(at + 1, j), ...splitTarget(s.slice(j + 2, end)), end: end + 1 };
    }
  }
  return null;
}

/**
 * A link or image. MDX: Markdown syntax, which the later link rewrites and Docusaurus resolve. HTML: an element; a
 * relative link to a .md file stays text there (MkDocs would rewrite it to the page URL, which only Docusaurus can
 * do, from Markdown).
 */
function linkOut(link: ParsedLink, image: boolean, out: Out): string | null {
  if (unsafeUrl(link.dest)) return null; // a script URL stays text
  if (!out.html) {
    const target = `(${mdxTarget(link.dest)}${link.title ? ` "${escaped(unquote(link.title))}"` : ''})`;
    return image ? `![${escaped(link.label)}]${target}` : `[${inlineMarkdown(link.label, out)}]${target}`;
  }
  const url = joinTarget(link.dest);
  if (!image && !/^[a-z][\w+.-]*:|^[/#]/i.test(url) && /\.md(?:[#?]|$)/i.test(url)) return null;
  const title = link.title ? ` title="${escapeAttr(unquote(link.title))}"` : '';
  return image ? `<img src="${escapeAttr(url)}" alt="${escapeAttr(link.label.replace(/\s+/g, ' '))}"${title} />`
    : `<a href="${escapeAttr(url)}"${title}>${inlineMarkdown(link.label, out)}</a>`;
}

/** Emphasis at `at` as Python-Markdown's em_strong patterns read it (underscores only at word boundaries). */
function emphasisAt(s: string, at: number, out: Out): { text: string; end: number } | null {
  const rest = s.slice(at);
  const before = s[at - 1] ?? '';
  if (/^(\*{1,3}|_{1,3})(?=\s|$)/.test(rest) && (!before || /\s/.test(before))) return null; // a lone * or _
  const wrap = (m: RegExpMatchArray | null, open: string, close: string): { text: string; end: number } | null =>
    (m ? { text: `${open}${inlineMarkdown(m[1]!, out)}${close}`, end: at + m[0].length } : null);
  if (rest[0] === '*') {
    return wrap(rest.match(/^\*\*\*([\s\S]+?)\*\*\*/), '<strong><em>', '</em></strong>')
      ?? wrap(rest.match(/^\*\*([\s\S]+?)\*\*/), '<strong>', '</strong>')
      ?? wrap(rest.match(/^\*([^*]+)\*/), '<em>', '</em>');
  }
  if (/\w/.test(before)) return null;
  return wrap(rest.match(/^___(?!_)([\s\S]+?)(?<!_)___(?!\w)/), '<strong><em>', '</em></strong>')
    ?? wrap(rest.match(/^__(?!_)([\s\S]+?)(?<!_)__(?!\w)/), '<strong>', '</strong>')
    ?? wrap(rest.match(/^_(?!_)([\s\S]+?)(?<!_)_(?!\w)/), '<em>', '</em>');
}

/**
 * Inline Markdown in the text of a nested HTML block (links, images, code spans, emphasis, backslash escapes), as
 * Python-Markdown renders it. MDX: links and images stay Markdown (targets made MDX-safe), code spans and emphasis
 * become JSX elements, other text is a string literal. HTML: elements and escaped text.
 */
export function inlineMarkdown(s: string, out: Out = { html: false, markdown: true }): string {
  let result = '';
  let text = '';
  const emit = (markup: string): void => { result += literal(text, out) + markup; text = ''; };
  for (let i = 0; i < s.length;) {
    const c = s[i]!;
    if (c === '\\' && ESCAPABLE.includes(s[i + 1] ?? '\n')) { text += s[i + 1]; i += 2; continue; }
    if (c === '`') {
      const m = s.slice(i).match(/^(`+)([\s\S]+?)(?<!`)\1(?!`)/);
      const run = m ? m[0] : s.slice(i).match(/^`+/)![0];
      if (m) emit(`<code>${literal(m[2]!.trim(), out)}</code>`); else text += run;
      i += run.length;
      continue;
    }
    if (c === '[' || (c === '!' && s[i + 1] === '[')) {
      const image = c === '!';
      const link = linkAt(s, image ? i + 1 : i);
      const markup = link && linkOut(link, image, out);
      if (link && markup !== null) { emit(markup); i = link.end; continue; }
    }
    if (c === '*' || c === '_') {
      const em = emphasisAt(s, i, out);
      if (em) { emit(em.text); i = em.end; continue; }
      const run = s.slice(i).match(/^[*_]+/)![0];
      text += run;
      i += run.length;
      continue;
    }
    text += c;
    i++;
  }
  return result + literal(text, out);
}

function serialize(node: P5Node, out: Out, inPre = false): string {
  if (node.nodeName === '#text') {
    let text = node.value ?? '';
    if (inPre) return !text ? '' : out.html ? escapeHtml(text).replace(/\r?\n/g, '&#10;') : `{${JSON.stringify(text)}}`;
    const parentTag = node.parentNode?.tagName;
    if (parentTag && BLOCK.has(parentTag)) { // a block's edge whitespace is not rendered
      const siblings = node.parentNode!.childNodes ?? [];
      if (siblings[0] === node) text = text.trimStart();
      if (siblings.at(-1) === node) text = text.trimEnd();
    }
    if (!text.trim() && droppable(node)) return '';
    return out.markdown ? inlineMarkdown(text, out) : literal(text, out);
  }
  const kids = (nodes: P5Node[] | undefined, pre = inPre): string => (nodes ?? []).map((c) => serialize(c, out, pre)).join('');
  if (!node.tagName) return kids(node.childNodes); // fragment; comments dropped
  if (!isValidTagName(node.tagName)) { // placeholder text such as <host.com-home>: back to text, children follow
    return `${out.html ? escapeHtml(`<${node.tagName}>`) : `{${JSON.stringify(`<${node.tagName}>`)}}`}${kids(node.childNodes)}`;
  }
  const attrs = (node.attrs ?? [])
    .filter((a) => /^[a-z_:][\w:.-]*$/i.test(a.name) && a.name !== 'style' && a.name !== 'markdown')
    .map((a) => (out.html ? ` ${a.name}="${escapeAttr(a.value)}"` : ` ${JSX_ATTR[a.name] ?? a.name}={${JSON.stringify(a.value)}}`)).join('');
  if (VOID.has(node.tagName)) return `<${node.tagName}${attrs} />`;
  const children = kids(node.tagName === 'template' ? node.content?.childNodes : node.childNodes, inPre || node.tagName === 'pre');
  return `<${node.tagName}${attrs}>${children}</${node.tagName}>`;
}

/** A code fence, tab or admonition line after a blank line: block Markdown inside the lines of an HTML block. */
const blockMarkdown = (lines: string[]): boolean =>
  lines.some((l, k) => k > 0 && !lines[k - 1]!.trim() && /^\s*(?:```|~~~|===\+?\s|!!!\s|\?\?\?\+?\s)/.test(l));

/**
 * Rewrite each multi-line HTML block (outside fenced code) as one line of JSX, keeping its indentation so it
 * stays inside a list item. A block indented NESTED or more has its inline Markdown rendered (see the header).
 * `protect` may swap the JSX for a placeholder. With `html` (the CommonMark fallback), only nested blocks are
 * rewritten, as one line of HTML; CommonMark keeps a top-level block raw, as Python-Markdown does.
 */
export function htmlBlocksToJsx(text: string, { protect = (jsx: string) => jsx, html = false }: { protect?: (jsx: string) => string; html?: boolean } = {}): { text: string; blocks: number } {
  const lines = text.split('\n');
  const out: string[] = [];
  let blocks = 0;
  let fence: number | null = null; // indentation of the open code fence
  let unwrap = -1; // the line closing an <html> wrapper left as written
  for (let i = 0; i < lines.length; i++) {
    const line = i === unwrap ? lines[i]!.replace(HTML_TAG, '') : lines[i]!;
    const indent = width(line.match(/^[ \t]*/)![0]);
    // A fence left open ends with its container (a less indented line other than a closing fence), as in
    // Python-Markdown and CommonMark.
    if (FENCE.test(line)) fence = fence === null ? indent : null;
    else if (fence !== null && line.trim() && indent < fence) fence = null;
    const start = fence === null ? line.match(START) : null;
    if (!start) { out.push(line); continue; }
    const tag = start[2]!.toLowerCase();
    const nested = width(start[1]!) >= NESTED;
    const open = new RegExp(`<${tag}\\b`, 'gi');
    const close = new RegExp(`</${tag}\\s*>`, 'gi');
    let depth = 0;
    let end = -1;
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j]!.match(open) ?? []).length - (lines[j]!.match(close) ?? []).length;
      if (depth <= 0) { end = j; break; }
    }
    if (end <= i || (html && !nested)) { out.push(line); continue; } // one line, never closed, or raw in CommonMark: as written
    // Python-Markdown renders each blank-line chunk of a nested block on its own, so a code fence, tab set or
    // admonition after a blank line is block Markdown, which one line of JSX cannot hold: leave the block as written
    // (its inner blocks are looked at line by line, and the Markdown around them converts as usual).
    if (nested && blockMarkdown(lines.slice(i + 1, end + 1))) {
      // An <html> wrapper is dropped (as a browser ignores it) rather than printed as text.
      if (tag === 'html') { out.push(line.replace(HTML_TAG, '')); unwrap = end; } else out.push(line);
      continue;
    }
    const fragment = parseFragment(lines.slice(i, end + 1).join('\n').trim()) as unknown as P5Node;
    out.push(start[1]! + protect(serialize(fragment, { html, markdown: nested })));
    blocks++;
    i = end;
  }
  return { text: blocks || unwrap >= 0 ? out.join('\n') : text, blocks };
}
