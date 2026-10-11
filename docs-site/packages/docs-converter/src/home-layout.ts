// Custom MkDocs home layouts (`<div class="homePage">`) and links that only the former site's theme made visible:
// an anchor holding just a Font Awesome icon, or an empty anchor its CSS filled with a background image.
// The docs site loads neither, so such a link would be invisible and nameless.
import { outsideCode } from './syntax.js';

/** A page body built on a custom MkDocs home layout (WSO2 themes: `<div class="homePage">`). */
export const isHomeLayout = (text: string): boolean => /<div\b[^>]*\bclass(?:Name)?=\{?["'][^"']*\bhomePage\b/.test(text);

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// An icon element: an empty <i>, or an empty <span> whose class names an icon. It shows only through an icon font
// or stylesheet the docs site does not load.
const ICON = /<i\b[^>]*>\s*<\/i\s*>|<span\b[^>]*\bclass(?:Name)?=["'][^"']*\b(?:fa[a-z-]*|icon[a-z-]*)\b[^"']*["'][^>]*>\s*<\/span\s*>/gi;

const attr = (attrs: string, name: string): string | undefined =>
  attrs.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find((v) => v !== undefined)?.trim() || undefined;
const textOf = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const escapeText = (s: string): string => s.replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Start of the element that encloses position `at` (0 when none does). */
function parentStart(text: string, at: number): number {
  const tags = [...text.slice(0, at).matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)];
  let depth = 0;
  for (let i = tags.length - 1; i >= 0; i--) {
    const [, closing, name, self] = tags[i]!;
    if (self || VOID.has(name!.toLowerCase())) continue;
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

export interface LinkStats { named: number; dropped: number }

/**
 * Give every link visible text. An anchor whose only content is icon elements loses the icons (they cannot render
 * here) and takes, in order, its `title` or `aria-label`, the nearest preceding heading in the same wrapper, or the
 * link's host. An empty anchor (no text, no image, no icon) takes its `title` or `aria-label`; without one it is
 * dropped, keeping an `id` or `name` as a plain target. Same-page anchors (`href="#..."`) and anchors without
 * href are left alone: they are jump targets, not links a reader follows.
 */
export function nameIconLinks(text: string): { text: string; stats: LinkStats } {
  const stats: LinkStats = { named: 0, dropped: 0 };
  const out = outsideCode(text, (prose) => prose.replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (whole, attrs: string, inner: string, offset: number) => {
    if (/<a\b/i.test(inner)) return whole;
    const href = attr(attrs, 'href');
    if (!href) return whole;
    const icons = inner.match(ICON)?.length ?? 0;
    const rest = inner.replace(ICON, '');
    if (textOf(rest) || /<(?:img|svg|picture|video)\b/i.test(rest)) return whole;
    const label = attr(attrs, 'title') ?? attr(attrs, 'aria-label');
    if (icons) {
      const name = label ?? precedingHeading(prose, offset) ?? hrefName(href);
      if (!name) return whole;
      stats.named++;
      return `<a${attrs}>${escapeText(name)}</a>`;
    }
    if (href.startsWith('#')) return whole;
    if (label) {
      stats.named++;
      return `<a${attrs}>${escapeText(label)}</a>`;
    }
    stats.dropped++;
    const target = attrs.match(/\s(?:id|name)\s*=\s*(?:"[^"]*"|'[^']*')/i)?.[0];
    return target ? `<a${target}></a>` : '';
  }));
  return { text: out, stats };
}
