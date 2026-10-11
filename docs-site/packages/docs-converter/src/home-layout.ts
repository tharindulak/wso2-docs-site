// Custom MkDocs home layouts (`<div class="homePage">`) and links that only the former site's theme made visible:
// an anchor holding just a Font Awesome icon, or an empty anchor its CSS filled with a background image.
// The docs site loads neither, so such a link would be invisible and nameless.
import { outsideCode } from './syntax.js';

/**
 * Apply fn to the prose of a Markdown text: outside fenced code, indented code and inline code. An indented code
 * block is a run of lines indented 4 or more after a blank line, outside a raw HTML block that starts at column 0
 * (as Python-Markdown reads it: inside such a block nothing is code, which keeps indented home layouts as prose).
 * Anything doubtful counts as code, so it is left unchanged.
 */
export function outsideAllCode(text: string, fn: (prose: string) => string): string {
  const lines = text.split('\n');
  const code: boolean[] = new Array(lines.length).fill(false);
  const blank = (l: string): boolean => l.trim() === '';
  let htmlEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fence = line.match(/^[ \t]*(`{3,}|~{3,})/);
    if (fence && i > htmlEnd) {
      let j = i + 1;
      while (j < lines.length && !new RegExp(`^[ \\t]*${fence[1]}[ \\t]*$`).test(lines[j]!)) j++;
      for (let k = i; k <= Math.min(j, lines.length - 1); k++) code[k] = true;
      i = j;
      continue;
    }
    if (i > htmlEnd) {
      const open = line.match(/^<([a-zA-Z][\w-]*)\b/);
      if (open) htmlEnd = htmlBlockEnd(lines, i, open[1]!);
    }
    if (i <= htmlEnd) continue;
    if (/^(?: {4}|\t)/.test(line) && !blank(line) && (i === 0 || blank(lines[i - 1]!) || code[i - 1])) {
      // Lines after a blank line, or continuing a code run (blank lines inside the run are code too).
      let j = i;
      while (j < lines.length && (blank(lines[j]!) || /^(?: {4}|\t)/.test(lines[j]!))) code[j++] = true;
      i = j - 1;
    }
  }
  let out = '';
  let run = '';
  lines.forEach((line, i) => {
    const piece = i < lines.length - 1 ? `${line}\n` : line;
    if (!code[i]) { run += piece; return; }
    out += outsideCode(run, fn) + piece;
    run = '';
  });
  return out + outsideCode(run, fn);
}

/** Last line of a raw HTML block opened by `tag` at line `start`: its matching close tag, else the next blank line. */
function htmlBlockEnd(lines: string[], start: number, tag: string): number {
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
  for (let i = start; i < lines.length; i++) {
    for (const m of lines[i]!.matchAll(re)) {
      if (m[2]) continue;
      depth += m[1] ? -1 : 1;
      if (depth === 0) return i;
    }
  }
  let i = start;
  while (i + 1 < lines.length && lines[i + 1]!.trim() !== '') i++;
  return i;
}

/** A page body built on a custom MkDocs home layout (WSO2 themes: `<div class="homePage">`), outside code. */
export function isHomeLayout(text: string): boolean {
  let found = false;
  outsideAllCode(text, (prose) => {
    found ||= /<div\b[^>]*\bclass(?:Name)?=\{?["']?[^"'>}]*\bhomePage\b/.test(prose);
    return prose;
  });
  return found;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// Attributes of a tag, with quoted values that may hold `>`.
const ATTRS = String.raw`((?:[^>"']|"[^"]*"|'[^']*')*)`;
// An icon element: an empty <i>, or an empty <span> whose class names an icon. It shows only through an icon font
// or stylesheet the docs site does not load.
const ICON = new RegExp(String.raw`<i\b${ATTRS}>\s*</i\s*>|<span\b[^>]*\bclass(?:Name)?=(?:["'][^"']*\b(?:fa[a-z-]*|icon[a-z-]*)\b[^"']*["']|(?:fa|icon)[\w-]*)[^>]*>\s*</span\s*>`, 'gi');
const ANCHOR = new RegExp(String.raw`<a\b${ATTRS}>([\s\S]*?)</a\s*>`, 'gi');

/** An attribute's value, quoted or not (JSX expression values are not read). */
const attr = (attrs: string, name: string): string | undefined =>
  attrs.match(new RegExp(String.raw`(?:^|\s)${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60{]+))`, 'i'))?.slice(1).find((v) => v !== undefined)?.trim() || undefined;
const textOf = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const escapeText = (s: string): string => s.replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Markup that renders nothing: whitespace, non-breaking spaces, comments and line breaks only. */
const isEmptyMarkup = (html: string): boolean =>
  html.replace(/<!--[\s\S]*?-->/g, '').replace(/&nbsp;|&#160;|&#xa0;/gi, '').replace(/<br\s*\/?>/gi, '').trim() === '';

/** Start of the element that encloses position `at` (0 when none does). */
function parentStart(text: string, at: number): number {
  const tags = [...text.slice(0, at).matchAll(new RegExp(String.raw`<(/?)([a-zA-Z][\w-]*)\b${ATTRS}>`, 'g'))];
  let depth = 0;
  for (let i = tags.length - 1; i >= 0; i--) {
    const [, closing, name, attrs] = tags[i]!;
    if (attrs!.trimEnd().endsWith('/') || VOID.has(name!.toLowerCase())) continue;
    if (closing) depth++;
    else if (depth === 0) return tags[i]!.index!;
    else depth--;
  }
  return 0;
}

/** Text of the last heading between the enclosing element's start and `at`. */
function precedingHeading(text: string, at: number): string | undefined {
  const region = text.slice(parentStart(text, at), at);
  const headings = [...region.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)];
  return headings.length ? textOf(headings.at(-1)![2]!) || undefined : undefined;
}

/** A name from the link target: its host, else its last path segment. */
function hrefName(href: string): string | undefined {
  try { return new URL(href).host || undefined; } catch { /* relative */ }
  const last = href.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').at(-1);
  return last ? last.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || undefined : undefined;
}

/**
 * Give every link visible text. An anchor whose only content is icon elements loses the icons (they cannot render
 * here) and takes, in order, its `title` or `aria-label`, the nearest preceding heading in the same wrapper, or the
 * link's host. An empty anchor (only whitespace, `&nbsp;`, comments or `<br>`) takes its `title` or `aria-label`;
 * without one it is dropped, keeping an `id` or `name` as a plain target. Any other child (an element, a component)
 * keeps the anchor as written. Same-page anchors (`href="#..."`), anchors without an href, and code are left alone.
 */
export function nameIconLinks(text: string): string {
  return outsideAllCode(text, (prose) => prose.replace(ANCHOR, (whole, attrs: string, inner: string, offset: number) => {
    if (/<a\b/i.test(inner)) return whole;
    const href = attr(attrs, 'href');
    if (!href) return whole;
    const icons = inner.match(ICON)?.length ?? 0;
    if (!isEmptyMarkup(inner.replace(ICON, ''))) return whole;
    const label = attr(attrs, 'title') ?? attr(attrs, 'aria-label');
    if (icons) {
      const name = label ?? precedingHeading(prose, offset) ?? hrefName(href);
      return name ? `<a${attrs}>${escapeText(name)}</a>` : whole;
    }
    if (href.startsWith('#')) return whole;
    if (label) return `<a${attrs}>${escapeText(label)}</a>`;
    const target = attrs.match(/(?:^|\s)(?:id|name)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`{]+)/i)?.[0];
    return target ? `<a ${target.trim()}></a>` : '';
  }));
}
