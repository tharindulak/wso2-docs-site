// HTML allow-list for converted content (conversion contract: the safety boundary for auto-merged bumps).
// Violations fail the page. Applied outside fenced and inline code only.
import { parseExpressionAt } from 'acorn';
import { outsideCode } from './syntax.js';

export const DEFAULT_IFRAME_HOSTS = ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'];
const FORBIDDEN_TAGS = ['script', 'style', 'form', 'object', 'embed', 'base', 'meta', 'link', 'frame', 'frameset', 'applet'];

/** Evaluate an object/array literal without running code: only literals, objects, arrays and plain strings. */
export function literalValue(node) {
  switch (node.type) {
    case 'Literal': return node.value;
    case 'TemplateLiteral':
      if (node.expressions.length) throw new Error('Template expressions are not allowed');
      return node.quasis.map((q) => q.value.cooked).join('');
    case 'ArrayExpression': return node.elements.map((e) => (e ? literalValue(e) : null));
    case 'ObjectExpression': {
      const out = {};
      for (const p of node.properties) {
        if (p.type !== 'Property' || p.computed || p.kind !== 'init') throw new Error('Only plain properties are allowed');
        const key = p.key.type === 'Identifier' ? p.key.name : literalValue(p.key);
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error(`Forbidden key ${key}`);
        out[key] = literalValue(p.value);
      }
      return out;
    }
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value;
      break;
    default:
  }
  throw new Error(`Unsupported value: ${node.type}`);
}

const QUICK_START_META = /<script>\s*(?:const|let|var)\s+meta\s*=\s*([\s\S]*?);?\s*<\/script>/;

/**
 * Check and clean converted HTML.
 * @returns {{ text: string, violations: string[], meta: object|undefined }}
 */
export function applyHtmlPolicy(text, { iframeHosts = DEFAULT_IFRAME_HOSTS } = {}) {
  const violations = [];
  let meta;
  const cleaned = outsideCode(text, (t) => {
    let s = t.replace(QUICK_START_META, (whole, expr) => {
      try {
        meta = literalValue(parseExpressionAt(expr, 0, { ecmaVersion: 2022 }));
        return '';
      } catch (e) {
        violations.push(`quick-start meta is not a plain literal: ${e.message}`);
        return whole;
      }
    });
    for (const tag of FORBIDDEN_TAGS) {
      if (new RegExp(`<${tag}\\b`, 'i').test(s)) violations.push(`<${tag}> is not allowed`);
    }
    for (const m of s.matchAll(/<[a-zA-Z][^>]*\son[a-z]+\s*=/gi)) violations.push(`event handler attribute: ${m[0].slice(0, 60)}`);
    for (const m of s.matchAll(/\b(?:href|src|action|formaction|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data:text\/html)/gi)) violations.push(`unsafe URL: ${m[0].slice(0, 60)}`);
    for (const m of s.matchAll(/\]\(\s*(?:javascript|vbscript):/gi)) violations.push(`unsafe Markdown link: ${m[0].slice(0, 40)}`);
    for (const m of s.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      let host = '';
      try { host = new URL(m[1]).host; } catch { /* relative or malformed */ }
      if (!iframeHosts.includes(host)) violations.push(`iframe host not allowed: ${host || m[1].slice(0, 60)}`);
    }
    return s;
  });
  return { text: cleaned, violations, meta };
}

/** Include markers that survived expansion would silently drop content; treat them as errors. */
export function unexpandedMarkers(text) {
  const found = [];
  outsideCode(text, (t) => {
    for (const m of t.matchAll(/\{![^!\n]+!\}|^[ \t]*--8<--.*$|\{%-?\s*include\b[^%]*%\}/gm)) found.push(m[0].trim().slice(0, 80));
    return t;
  });
  return found;
}
