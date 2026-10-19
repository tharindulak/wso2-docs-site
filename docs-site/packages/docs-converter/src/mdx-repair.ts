// Last resort before CommonMark: repair the spots MDX cannot read in a converted page, one at a time, where the MDX
// parser reports them. Each repair shows the page as a browser shows its source:
//   - tag-like text that is no known tag (`<IS_HOME>` after a broken code span, `<user@host>`) is escaped as text;
//   - a closing tag with no open tag (`</b>`, a stray `</thead>`), or none open in its block, is dropped, as a browser
//     ignores it;
//   - a known tag's attributes are made JSX: unquoted values quoted (`width=800px`), names JSX cannot hold dropped
//     (Vue's `:href="$withBase(...)"`, which no browser reads either);
//   - an anchor that links nowhere (`<a name="…">`) left open becomes an empty anchor;
//   - a brace that opens an expression MDX cannot parse is escaped (code is never touched);
//   - a link whose absolute URL cannot be parsed (it would stop the Docusaurus build) becomes its label.
// Anything else (a known element left open, misnested elements) is left for the CommonMark fallback.
import { compile, createProcessor } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { JSX_TAGS } from './syntax.js';

interface Point { line?: number; column?: number; offset?: number }
interface ParseError { reason?: string; ruleId?: string; source?: string; place?: Point | { start: Point; end: Point } }

const KNOWN = new Set(JSX_TAGS);
const NAME = /^[A-Za-z][\w.-]*/;
const plugins = { remarkPlugins: [remarkGfm, remarkDirective] };
const markdown = createProcessor({ format: 'md', ...plugins });
const mdx = createProcessor(plugins);

type MdNode = { type: string; url?: string; position?: { start: Point; end: Point }; children?: MdNode[] };

/** The text with its first link to an absolute URL that cannot be parsed replaced by the link's label; else null. */
function unparsableLink(text: string): string | null {
  const find = (node: MdNode): MdNode | undefined => {
    if (node.type === 'link' && node.url && /^[a-z][\w+.-]*:\/\//i.test(node.url)) {
      try { new URL(node.url); } catch { return node; }
    }
    for (const child of node.children ?? []) { const found = find(child); if (found) return found; }
    return undefined;
  };
  const link = find(mdx.parse(text) as unknown as MdNode);
  if (!link?.position) return null;
  const kids = link.children ?? [];
  const label = kids.length && kids[0]!.position && kids.at(-1)!.position ? text.slice(kids[0]!.position.start.offset, kids.at(-1)!.position!.end.offset) : '';
  return text.slice(0, link.position.start.offset) + label + text.slice(link.position.end.offset);
}

/** Offset of a 1-based line and column in `text`. */
function offsetOf(text: string, line: number, column: number): number {
  let at = 0;
  for (let l = 1; l < line; l++) at = text.indexOf('\n', at) + 1;
  return at + column - 1;
}

const startOf = (place: ParseError['place']): number | undefined => (place && 'start' in place ? place.start.offset : place?.offset);

/** Ranges of code (fenced, indented and inline) as CommonMark reads the text. */
function codeRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const visit = (node: { type: string; position?: { start: Point; end: Point }; children?: unknown[] }): void => {
    if ((node.type === 'code' || node.type === 'inlineCode') && node.position) ranges.push([node.position.start.offset!, node.position.end.offset!]);
    for (const child of (node.children ?? []) as (typeof node)[]) visit(child);
  };
  visit(markdown.parse(text) as unknown as Parameters<typeof visit>[0]);
  return ranges;
}

/** Braces outside code that are not escaped: where an MDX expression may open or close. */
function braces(text: string): Array<{ at: number; open: boolean }> {
  const code = codeRanges(text);
  const out: Array<{ at: number; open: boolean }> = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== '{' && c !== '}') continue;
    let slashes = 0;
    while (text[i - 1 - slashes] === '\\') slashes++;
    if (slashes % 2 || code.some(([a, b]) => i >= a && i < b)) continue;
    out.push({ at: i, open: c === '{' });
  }
  return out;
}

const escapeAt = (text: string, at: number, escaped: string): string => text.slice(0, at) + escaped + text.slice(at + 1);

/** The tag starting at `lt` with JSX attributes: names JSX cannot hold dropped, unquoted values quoted. */
function jsxAttributes(text: string, lt: number): string | null {
  const end = text.indexOf('>', lt);
  if (end < 0) return null;
  const tag = text.slice(lt, end + 1);
  const m = /^<([A-Za-z][\w.-]*)([\s\S]*?)(\/?)>$/.exec(tag);
  if (!m) return null;
  const attrs: string[] = [];
  for (const a of m[2]!.matchAll(/([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
    const [, name, value] = a;
    if (!/^[A-Za-z_][\w.-]*$/.test(name!)) continue;
    if (value === undefined) { attrs.push(name!); continue; }
    attrs.push(/^["']/.test(value) ? `${name}=${value}` : `${name}="${value.replace(/["']/g, '')}"`);
  }
  const fixed = `<${m[1]}${attrs.map((a) => ` ${a}`).join('')}${m[3] ? ' /' : ''}>`;
  return fixed === tag ? null : text.slice(0, lt) + fixed + text.slice(end + 1);
}

/** The text with the spot `error` reports repaired, or null when this is not a spot repaired here. */
function repairOne(text: string, error: ParseError): string | null {
  const reason = error.reason ?? '';
  const at = startOf(error.place);
  if (error.source === 'micromark-extension-mdx-expression') {
    const all = braces(text);
    let target: number | undefined;
    if (error.ruleId === 'unexpected-eof') {
      const stack: number[] = [];
      for (const b of all) if (b.open) stack.push(b.at); else stack.pop();
      target = stack[0];
    } else if (at !== undefined) {
      target = all.filter((b) => b.open && b.at < at).at(-1)?.at;
    }
    return target === undefined ? null : `${text.slice(0, target)}\\${text.slice(target)}`;
  }
  if (error.ruleId === 'unexpected-closing-slash' && at !== undefined) {
    const lt = text.lastIndexOf('<', at);
    const gt = text.indexOf('>', at);
    return lt < 0 || gt < 0 || /\n\s*\n/.test(text.slice(lt, gt)) ? null : text.slice(0, lt) + text.slice(gt + 1);
  }
  if (error.ruleId === 'end-tag-mismatch' && /^Unexpected closing tag `<\/[^`]*>`/.test(reason) && error.place && 'start' in error.place) {
    // A closing tag for an element not open in this block: a browser ignores it.
    const [from, to] = [error.place.start.offset!, error.place.end.offset!];
    return /^<\/[^>]*>$/.test(text.slice(from, to)) ? text.slice(0, from) + text.slice(to) : null;
  }
  if (error.ruleId === 'end-tag-mismatch') {
    const m = /^Expected a closing tag for `<([^>`]*)>` \((\d+):(\d+)-/.exec(reason);
    if (!m) return null;
    const lt = offsetOf(text, Number(m[2]), Number(m[3]));
    if (m[1] === 'a') {
      // An anchor that links nowhere (<a name="…">, from Confluence) left open: an empty anchor, as a browser keeps it.
      const tag = /^<a\b[^>]*>/.exec(text.slice(lt))?.[0];
      return tag && !/\shref=/.test(tag) && !tag.endsWith('/>') ? text.slice(0, lt) + tag.slice(0, -1).trimEnd() + ' />' + text.slice(lt + tag.length) : null;
    }
    if (KNOWN.has(m[1]!)) return null;
    return text[lt] === '<' ? escapeAt(text, lt, '&lt;') : null;
  }
  if (error.ruleId === 'unexpected-character' && at !== undefined) {
    const lt = text.lastIndexOf('<', at);
    if (lt < 0) return null;
    const name = NAME.exec(text.slice(lt + 1))?.[0] ?? '';
    const inName = / in name\b/.test(reason); // the tag's own name: `<user@host>` is text
    if (!KNOWN.has(name) || inName) return escapeAt(text, lt, '&lt;');
    return jsxAttributes(text, lt);
  }
  return null;
}

/**
 * `text` repaired until it compiles as MDX (see the header). When a spot it cannot repair remains (or more than
 * `attempts` spots), `error` is that spot's parse error and `text` the text repaired so far.
 */
export async function repairMdx(text: string, { attempts = 200 } = {}): Promise<{ text: string; repairs: number; error?: string }> {
  let current = text;
  let repairs = 0;
  for (;;) {
    try {
      await compile(current, plugins);
      const relinked = repairs < attempts ? unparsableLink(current) : null;
      if (relinked === null) return { text: current, repairs };
      current = relinked;
      repairs++;
    } catch (e) {
      const err = e as ParseError & { line?: number };
      const next = repairs < attempts ? repairOne(current, err) : null;
      if (next === null || next === current) return { text: current, repairs, error: `${err.reason ?? String(e)}${err.line ? ` (line ${err.line})` : ''}` };
      current = next;
      repairs++;
    }
  }
}
