// HTML allow-list for converted content (conversion contract: the safety boundary for auto-merged bumps).
// Violations fail the page. Applied outside fenced and inline code only.
import { parseExpressionAt } from 'acorn';
import { outsideCode, targetEnd, unsafeUrl } from './syntax.js';

export const DEFAULT_IFRAME_HOSTS: readonly string[] = ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'];
const FORBIDDEN_TAGS = ['script', 'style', 'form', 'object', 'embed', 'base', 'meta', 'link', 'frame', 'frameset', 'applet'];

// Minimal ESTree shapes for literal evaluation (acorn's types are not needed beyond these).
interface EsNode { type: string; [key: string]: unknown }

/** Evaluate an object/array literal without running code: only literals, objects, arrays and plain strings. */
export function literalValue(node: EsNode): unknown {
  switch (node.type) {
    case 'Literal': return node.value;
    case 'TemplateLiteral': {
      if ((node.expressions as unknown[]).length) throw new Error('Template expressions are not allowed');
      return (node.quasis as Array<{ value: { cooked: string } }>).map((q) => q.value.cooked).join('');
    }
    case 'ArrayExpression': return (node.elements as Array<EsNode | null>).map((e) => (e ? literalValue(e) : null));
    case 'ObjectExpression': {
      const out: Record<string, unknown> = {};
      for (const p of node.properties as EsNode[]) {
        if (p.type !== 'Property' || p.computed || p.kind !== 'init') throw new Error('Only plain properties are allowed');
        const keyNode = p.key as EsNode;
        const key = keyNode.type === 'Identifier' ? String(keyNode.name) : String(literalValue(keyNode));
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error(`Forbidden key ${key}`);
        out[key] = literalValue(p.value as EsNode);
      }
      return out;
    }
    case 'UnaryExpression': {
      const arg = node.argument as EsNode;
      if (node.operator === '-' && arg.type === 'Literal' && typeof arg.value === 'number') return -arg.value;
      break;
    }
    default:
  }
  throw new Error(`Unsupported value: ${node.type}`);
}

/** Parse a JavaScript literal expression (object, array, string, number) without executing it. */
export function parseLiteral(expr: string): unknown {
  return literalValue(parseExpressionAt(expr, 0, { ecmaVersion: 2022 }) as unknown as EsNode);
}

const QUICK_START_META = /<script>\s*(?:const|let|var)\s+meta\s*=\s*([\s\S]*?);?\s*<\/script>/;

export interface PolicyResult { text: string; violations: string[]; meta: unknown }

/** Check and clean converted HTML. */
export function applyHtmlPolicy(text: string, { iframeHosts = DEFAULT_IFRAME_HOSTS }: { iframeHosts?: readonly string[] } = {}): PolicyResult {
  const violations: string[] = [];
  let meta: unknown;
  const cleaned = outsideCode(text, (t) => {
    const s = t.replace(QUICK_START_META, (whole, expr: string) => {
      try {
        meta = parseLiteral(expr);
        return '';
      } catch (e) {
        violations.push(`quick-start meta is not a plain literal: ${(e as Error).message}`);
        return whole;
      }
    });
    for (const tag of FORBIDDEN_TAGS) {
      if (new RegExp(`<${tag}(?=[\\s>/])`, 'i').test(s)) violations.push(`<${tag}> is not allowed`);
    }
    for (const m of s.matchAll(/<[a-zA-Z][\w-]*(?:\s[^>]*)?\son[a-z]+\s*=/gi)) violations.push(`event handler attribute: ${m[0].slice(0, 60)}`);
    // URLs are checked as a browser reads them (unsafeUrl): references decoded, whitespace and control characters dropped.
    for (const m of s.matchAll(/\b(?:href|src|action|formaction|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)) {
      if (unsafeUrl(m[1]!.replace(/^["']|["']$/g, ''))) violations.push(`unsafe URL: ${m[0].slice(0, 60)}`);
    }
    for (const m of s.matchAll(/\]\(/g)) {
      const start = m.index! + 2;
      const end = targetEnd(s, start);
      const target = s.slice(start, end < 0 ? Math.min(s.length, start + 200) : end).replace(/^\s*<|>\s*$/g, '');
      if (unsafeUrl(target)) violations.push(`unsafe Markdown link: ${s.slice(m.index!, m.index! + 40)}`);
    }
    for (const m of s.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      let host = '';
      try { host = new URL(m[1]!).host; } catch { /* relative or malformed */ }
      if (!iframeHosts.includes(host)) violations.push(`iframe host not allowed: ${host || m[1]!.slice(0, 60)}`);
    }
    return s;
  });
  return { text: cleaned, violations, meta };
}

/** Include markers that survived expansion would silently drop content; treat them as errors. */
export function unexpandedMarkers(text: string): string[] {
  const found: string[] = [];
  outsideCode(text, (t) => {
    for (const m of t.matchAll(/\{![^!\n]+!\}|^[ \t]*--8<--.*$|\{%-?\s*include\b[^%]*%\}/gm)) found.push(m[0].trim().slice(0, 80));
    return t;
  });
  return found;
}

/**
 * Remove <script>, <style> and <link> elements (with their content) and event-handler attributes outside
 * code samples, for pages the policy would otherwise reject. Removing never adds behaviour; anything left is
 * still checked by the policy.
 */
export function removeForbiddenElements(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const cleaned = outsideCode(text, (t) => navigationLinks(removed, t
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (_, tag: string) => (removed.push(tag.toLowerCase()), ''))
    .replace(/<link\b[^>]*>/gi, () => (removed.push('link'), '')))
    .replace(/<[a-zA-Z][\w-]*\b[^>]*>/g, (tag) => tag.replace(/\s(on[a-z]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (_, attr: string) => (removed.push(attr.toLowerCase()), ''))));
  return { text: cleaned, removed };
}

// An onclick that only opens a page (home page cards: `<div class="card" onclick="location.href='guides/x/';">`).
const NAV_ONCLICK = /\sonclick\s*=\s*(["'])\s*(?:(?:window|document)\.)?location(?:\.href)?\s*=\s*(?!\1)(["'])([^"'<>]+)\2\s*;?\s*\1/i;

/**
 * A div or span whose onclick only opens a page becomes a link to that page (the handler goes with it), so the card
 * still leads somewhere once handlers are removed. Not when it holds a link (links never nest). The URL is then
 * checked by the policy like any href.
 */
function navigationLinks(removed: string[], text: string): string {
  let out = '';
  let from = 0;
  const open = /<(div|span)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  for (let m = open.exec(text); m; m = open.exec(text)) {
    const nav = m[2]!.match(NAV_ONCLICK);
    if (!nav) continue;
    const end = closingTag(text, m[1]!, open.lastIndex);
    if (!end || /<a\b/i.test(text.slice(open.lastIndex, end.start))) continue;
    const attrs = m[2]!.replace(nav[0], '');
    removed.push('onclick');
    out += `${text.slice(from, m.index)}<a href="${nav[3]}"${attrs}>${text.slice(open.lastIndex, end.start)}</a>`;
    from = end.end;
    open.lastIndex = end.end;
  }
  return out + text.slice(from);
}

/** Where the element of `tag` opened just before `at` closes, counting nested elements of the same name. */
export function closingTag(text: string, tag: string, at: number): { start: number; end: number } | undefined {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
  re.lastIndex = at;
  let depth = 1;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[2]) continue;
    depth += m[1] ? -1 : 1;
    if (!depth) return { start: m.index, end: re.lastIndex };
  }
  return undefined;
}
