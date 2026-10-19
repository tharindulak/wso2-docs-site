// Rewrite MkDocs Material Markdown into Docusaurus MDX. Fenced and inline code are never touched.

const ADMONITION: Record<string, string> = {
  note: 'note', abstract: 'note', summary: 'note', tldr: 'note', quote: 'note', cite: 'note', example: 'note',
  info: 'info', todo: 'info', question: 'info', help: 'info', faq: 'info',
  tip: 'tip', hint: 'tip', success: 'tip', check: 'tip', done: 'tip',
  important: 'warning', warning: 'warning', caution: 'warning', attention: 'warning',
  // Lifecycle stage marking: the site registers `deprecated` as an admonition type (section deprecation notice).
  deprecated: 'deprecated',
  danger: 'danger', error: 'danger', failure: 'danger', fail: 'danger', missing: 'danger', bug: 'danger',
};

/** Tags MDX may keep as JSX. Anything else that looks like a tag is escaped as text. */
export const JSX_TAGS: readonly string[] = [
  'Applies', 'DeploymentValue', 'Tabs', 'TabItem', 'ThemedImage', 'Redirect', 'ApiReference', 'Steps', 'Prerequisites', 'LinkCards',
  'a', 'abbr', 'b', 'blockquote', 'br', 'button', 'caption', 'center', 'code', 'col', 'colgroup', 'dd', 'del', 'details',
  'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'iframe', 'img',
  'input', 'ins', 'kbd', 'label', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'source', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'video', 'wbr',
];
/**
 * HTML sectioning tags, kept as JSX only where they lay out a block: at the start of a line, or closing one opened at
 * the start of the same line. Inline, the same names are XML in prose (Synapse's `<header name="…"/>`) and stay text.
 */
export const BLOCK_JSX_TAGS: readonly string[] = ['article', 'aside', 'footer', 'header', 'main', 'nav', 'section'];
const VOID = ['br', 'hr', 'img', 'input', 'col', 'source', 'wbr'];
const BLOCK_JSX = BLOCK_JSX_TAGS.map((t) => `(?<=^[ \\t]*<)/?${t}(?=[\\s/>])|(?<=^[ \\t]*<${t}[\\s>][^\\n]*<)/${t}\\s*>`).join('|');
const NOT_JSX = new RegExp(`<(?!/?(?:${JSX_TAGS.join('|')})(?=[\\s/>])|${BLOCK_JSX})`, 'gm');
// <html>, <head> and <body> wrapping part of a page (Python-Markdown passes them through; browsers drop them): on a
// line of their own or next to another tag. In a sentence the name stays text.
const WRAPPER = /^[ \t]*<\/?(?:html|head|body)\b[^>]*>[ \t]*(?:\n|$)|<\/?(?:html|head|body)\b[^>]*>(?=[ \t]*<)|(?<=>[ \t]*)<\/?(?:html|head|body)\b[^>]*>/gim;

export interface SyntaxStats { admonitions: number; collapsibles: number; tabs: number; attrLists: number }

const indentOf = (line: string): number => (line.match(/^\s*/)?.[0] ?? '').length;

/** Lines that belong to an indented MkDocs block starting at `start` under indentation `ind`. */
function takeBlock(lines: string[], start: number, ind: number): { body: string; next: number } {
  const body: string[] = [];
  let j = start;
  while (j < lines.length && (lines[j]!.trim() === '' || indentOf(lines[j]!) >= ind + 4)) body.push(lines[j++]!);
  while (body.length && body[body.length - 1]!.trim() === '') { body.pop(); j--; }
  return { body: body.map((l) => l.slice(Math.min(indentOf(l), ind + 4))).join('\n'), next: j };
}
const reindent = (text: string, ws: string): string => text.split('\n').map((l) => (l ? ws + l : l)).join('\n');

const LIST_ITEM = /^ {0,3}(?:[-*+]|\d+\.)\s/;
const MKDOCS_BLOCK = /^\s*(?:`{3,}|~{3,}|!!!|\?\?\?|===)/;

/**
 * An indented code block (a blank line, then lines indented 4 or more, outside a list), fenced: MDX reads no
 * indented code, so its lines would show as paragraphs. A tab or admonition body starting with one is the common case.
 */
function indentedCode(lines: string[], i: number, inList: boolean): { fenced: string[]; next: number } | null {
  if (inList || indentOf(lines[i]!) < 4 || !lines[i]!.trim() || (i > 0 && lines[i - 1]!.trim())) return null;
  let prev = i - 1;
  while (prev >= 0 && !lines[prev]!.trim()) prev--;
  // After an HTML line or a MkDocs block header left unconverted (`??? "Title"`), the indent is not code's.
  if (prev >= 0 && (indentOf(lines[prev]!) >= 4 || /^\s*(?:<|!!!|\?\?\?|===)/.test(lines[prev]!))) return null;
  const { body, next } = takeBlock(lines, i, 0);
  if (body.split('\n').some((l) => MKDOCS_BLOCK.test(l))) return null;
  return { fenced: ['```', body, '```'], next };
}

function blocks(md: string, stats: SyntaxStats): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let fence: string | null = null;
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const f = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (f && (!fence || (f[2]![0] === fence[0] && f[2]!.length >= fence.length && !f[3]!.trim()))) {
      if (!fence) { fence = f[2]!; out.push(f[1]! + f[2]! + fenceInfo(f[3]!)); } else { fence = null; out.push(line); }
      continue;
    }
    if (fence) { out.push(line); continue; }
    // Python-Markdown reads `###Title###` as a heading; CommonMark needs a space after the hashes and drops the closing ones.
    const heading = line.match(/^( {0,3})(#{1,6})([^#\s].*?)[ \t]*#*[ \t]*$/);
    if (heading) { out.push(`${heading[1]}${heading[2]} ${heading[3]}`); continue; }

    if (LIST_ITEM.test(line)) inList = true;
    else if (line.trim() && indentOf(line) === 0 && !lines[i - 1]?.trim()) inList = false;
    const code = indentedCode(lines, i, inList);
    if (code) { out.push(...code.fenced); i = code.next - 1; continue; }

    let m = line.match(/^(\s*)(!!!|\?\?\?\+?)\s+([\w-]+)(?:\s+"([^"]*)")?\s*$/);
    if (m) {
      const [, ws = '', kind = '', type = '', title] = m;
      const { body, next } = takeBlock(lines, i + 1, ws.length);
      const inner = reindent(blocks(body, stats), ws);
      if (kind === '!!!') {
        stats.admonitions++;
        // An admonition holding admonitions takes a longer fence than theirs, so its own closes it (Docusaurus nesting).
        const innerFence = Math.max(2, ...[...inner.matchAll(/^[ \t]*(:{3,})[a-z]/gm)].map((f) => f[1]!.length));
        const fence = ':'.repeat(innerFence + 1);
        out.push(`${ws}${fence}${ADMONITION[type.toLowerCase()] ?? 'note'}${title ? `[${title.replace(/[[\]]/g, '')}]` : ''}`, '', inner, '', `${ws}${fence}`);
      } else {
        stats.collapsibles++;
        out.push(`${ws}<details${kind.endsWith('+') ? ' open' : ''}>`, `${ws}<summary>${title || type}</summary>`, '', inner, '', `${ws}</details>`);
      }
      i = next - 1;
      continue;
    }

    m = line.match(/^(\s*)===\+?\s+"([^"]*)"\s*$/);
    if (m) {
      const ws = m[1]!;
      const items: Array<[string, string]> = [];
      let j = i;
      let t: RegExpMatchArray | null;
      while (j < lines.length && (t = lines[j]!.match(/^(\s*)===\+?\s+"([^"]*)"\s*$/)) && t[1] === ws) {
        const label = t[2]!;
        const { body, next } = takeBlock(lines, j + 1, ws.length);
        items.push([label, blocks(body, stats)]);
        j = next;
        while (j < lines.length && lines[j]!.trim() === '' && /^\s*===\+?\s+"/.test(lines[j + 1] ?? '') && indentOf(lines[j + 1]!) === ws.length) j++;
      }
      stats.tabs++;
      out.push(`${ws}<Tabs>`);
      items.forEach(([label, body], k) => out.push(
        `${ws}<TabItem value="tab-${k}" label="${label.replace(/"/g, '&quot;')}">`, '', reindent(body, ws), '', `${ws}</TabItem>`));
      out.push(`${ws}</Tabs>`);
      i = j - 1;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

// ```java hl_lines="2" linenums="1" title="x"  ->  ```java title="x" {2}
function fenceInfo(info: string): string {
  const t = info.trim();
  if (!t) return '';
  const lang = t.match(/^\{?\s*\.?([\w+#-]+)/)?.[1] ?? '';
  const title = t.match(/title="([^"]*)"/);
  const hl = t.match(/hl_lines="([^"]*)"/);
  const lines = hl ? ` {${hl[1]!.trim().split(/\s+/).join(',')}}` : '';
  return `${lang}${title ? ` title="${title[1]}"` : ''}${lines}`;
}

/** Apply fn to the parts of text outside fenced and inline code. */
export function outsideCode(text: string, fn: (prose: string) => string): string {
  const parts = text.split(/(^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\2[ \t]*$|(`+)[^`\n]+?\3)/m);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === undefined) continue;
    // split() with capture groups interleaves: [text, wholeMatch, fenceGroup, tickGroup, text, ...]
    const k = i % 4;
    if (k === 0) out += fn(p);
    else if (k === 1) out += p;
  }
  return out;
}

// A placeholder in a link's host (https://<HOST>:9443/x) is not a URL; show it as code for the reader to fill in.
// Done before the code/prose split so the new code span is protected from prose escaping.
const placeholderHostLinks = (text: string): string =>
  outsideCode(text, (t) => t.replace(/\[([^\]]*)\]\(([a-z]+:\/\/[^)\s/]*[<>][^)\s]*)\)/gi, (_, label: string, url: string) => `${label} (\`${url}\`)`));

const validUrl = (url: string): boolean => { try { new URL(url); return true; } catch { return false; } };

const JSX_ATTRS: Record<string, string> = {
  colspan: 'colSpan', rowspan: 'rowSpan', tabindex: 'tabIndex', frameborder: 'frameBorder',
  allowfullscreen: 'allowFullScreen', cellpadding: 'cellPadding', cellspacing: 'cellSpacing',
};

const attrValue = (attrs: string, name: string): string | undefined =>
  attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'))?.slice(1).find((v) => v !== undefined);

/**
 * An MkDocs Redoc embed (`<redoc spec-url="...">`, rendered by the source site's theme script) becomes the
 * docs site's <ApiReference> component. Specs on the site load in the viewer; a spec on another host is only
 * linked, never fetched into the reader's browser (it would be unpinned third-party content).
 */
export function redocToApiReference(text: string): { text: string; count: number } {
  let count = 0;
  const out = text.replace(/<redoc\b([^>]*)>(?:\s*<\/redoc\s*>)?/gi, (whole, attrs: string) => {
    const spec = attrValue(attrs, 'spec-url');
    if (!spec || /[\s"'<>{}]/.test(spec)) return whole;
    count++;
    if (/^[a-z][\w+.-]*:/i.test(spec)) {
      if (!/^https:\/\/[^/]/i.test(spec)) { count--; return whole; } // only https links; anything else stays text
      return `<ApiReference specLink="${spec}" />`;
    }
    const props = [`spec="${spec}"`];
    const level = attrValue(attrs, 'schema-expansion-level');
    if (level && /^(\d+|all)$/.test(level)) props.push(`schemaExpansionLevel="${level}"`);
    if (attrValue(attrs, 'expand-single-schema-field') === 'true') props.push('expandSingleSchemaField');
    return `<ApiReference ${props.join(' ')} />`;
  });
  return { text: out, count };
}

/**
 * Index of the `)` closing a link target that starts at `from` (just after `](`), or -1. Parentheses nest; a quoted
 * title may hold any of them; a blank line ends the paragraph, and so the search.
 */
export function targetEnd(s: string, from: number, titles = true): number {
  let depth = 0;
  let quote = '';
  for (let i = from; i < s.length && i < from + 2000; i++) {
    const c = s[i]!;
    if (c === '\\') { i++; continue; }
    if (c === '\n' && /^[ \t]*\r?\n/.test(s.slice(i + 1))) break;
    if (quote) { if (c === quote && /^[ \t]*\)/.test(s.slice(i + 1))) quote = ''; continue; }
    if (titles && (c === '"' || c === "'") && /\s/.test(s[i - 1] ?? '')) { quote = c; continue; }
    if (c === '(') depth++;
    else if (c === ')' && depth-- === 0) return i;
  }
  return titles ? targetEnd(s, from, false) : -1; // a quote that opens no title (`#the 'x' step`)
}

/** A link target as Python-Markdown reads it: the destination (angle brackets removed) and the quoted title, if any. */
export function splitTarget(inner: string): { dest: string; title?: string } {
  const t = inner.trim();
  const m = t.match(/^([\s\S]*?)\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/);
  const dest = (m ? m[1]! : t).trim();
  return { dest: /^<[^<>]*>$/.test(dest) ? dest.slice(1, -1) : dest, title: m?.[2] };
}

const NAMED: Record<string, string> = { colon: ':', tab: '\t', newline: '\n', amp: '&', sol: '/', lpar: '(', rpar: ')', quot: '"', apos: "'" };

/**
 * Whether a URL, as a browser would read it, has a script scheme (javascript:, vbscript:, data:text/html). Character
 * references are decoded, and whitespace and control characters dropped first, so `java\nscript:`, `java\tscript:`
 * and `&#106;avascript:` are caught (a browser strips tabs and newlines from a URL; HTML decodes the references).
 */
export function unsafeUrl(url: string): boolean {
  let s = url;
  for (let i = 0; i < 3; i++) { // &amp;#106; decodes twice in some paths
    const next = s.replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, n: string) => {
      const code = n[0] === 'x' || n[0] === 'X' ? parseInt(n.slice(1), 16) : parseInt(n, 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/&([a-z]+);/gi, (m, name: string) => NAMED[name.toLowerCase()] ?? m);
    if (next === s) break;
    s = next;
  }
  s = s.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  return /^(?:javascript|vbscript):|^data:text\/html/.test(s);
}

/**
 * A destination with its line breaks joined (with the indentation around them) and its tabs dropped, as a browser
 * drops them from a URL, and its remaining whitespace percent-encoded.
 */
export const joinTarget = (dest: string): string => dest.replace(/[ \t]*\r?\n[ \t]*/g, '').replace(/\t/g, '').trim()
  .replace(/\s/g, (c) => (c === ' ' ? '%20' : encodeURIComponent(c)));

/**
 * Python-Markdown reads a link or image target up to its closing parenthesis, line breaks and spaces included
 * (`[x](https://github\n.com/a)`, `![a](img/load balancing/x.png)`, `mailto:WSO2 Developer Platform-support@wso2.com`);
 * CommonMark does not, and the link prints as text. Such targets are joined and encoded (joinTarget); a quoted title
 * stays a title. Runs before the site link rewrites, which then see the whole URL.
 */
export function linkTargets(text: string): string {
  let out = '';
  let last = 0;
  const re = /\]\(/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = m.index + 2;
    const end = targetEnd(text, start);
    if (end < 0) continue;
    re.lastIndex = end;
    const inner = text.slice(start, end);
    const { dest, title } = splitTarget(inner);
    if (!/\s/.test(dest) && !/^\s*</.test(inner)) continue; // already a CommonMark target
    if (unsafeUrl(dest)) continue; // never join a script URL into a link (the HTML policy rejects the page anyway)
    out += `${text.slice(last, start)}${joinTarget(dest)}${title ? ` ${title}` : ''}`;
    last = end;
  }
  return last ? out + text.slice(last) : text;
}

/** In a table row, a `|` inside a code span is escaped: GFM would end the cell there; Python-Markdown does not. */
function tablePipes(text: string): string {
  let fence: string | null = null;
  return text.split('\n').map((line) => {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f && (!fence || (f[1]![0] === fence[0] && f[1]!.length >= fence.length))) { fence = fence ? null : f[1]!; return line; }
    if (fence || !/^[ \t]*\|.*\|[ \t]*$/.test(line)) return line;
    return line.replace(/(`+)([^`]+?)\1(?!`)/g, (_, ticks: string, code: string) => `${ticks}${code.replace(/(?<!\\)\|/g, '\\|')}${ticks}`);
  }).join('\n');
}

function inline(text: string, stats: SyntaxStats): string {
  return outsideCode(placeholderHostLinks(tablePipes(text)), (t) => {
    let s = redocToApiReference(t).text;
    s = linkTargets(s);
    s = s.replace(/\{:?\s*[.#]?[\w-]+(=("[^"]*"|'[^']*'|[^\s}]+))?(\s+[.#]?[\w-]+(=("[^"]*"|'[^']*'|[^\s}]+))?)*\s*\}/g,
      (m) => (m.startsWith('{:') || /=|^\{\s*[.#]/.test(m) ? (stats.attrLists++, '') : m));
    s = s.replace(/\]\(([^)\s]*[<>][^)\s]*)\)/g, (_, url: string) => `](${url.replace(/</g, '%3C').replace(/>/g, '%3E')})`);
    s = s.replace(/<((?:https?|ftp):\/\/[^\s<>]+)>/gi, '[$1]($1)'); // autolinks: MDX has none, and escaping the < leaves the > in the URL
    // GFM would autolink a placeholder URL (host:port) that Docusaurus cannot parse.
    s = s.replace(/(^|[^\w(\["'=/])(https?):\/\/([^\s<>()[\]"'`]+)/g,
      (m, pre: string, scheme: string, rest: string) => (validUrl(`${scheme}://${rest.replace(/[.,;:!?]+$/, '')}`) ? m : `${pre}${scheme}:&#47;/${rest}`));
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(WRAPPER, '');
    s = s.replace(/^[ \t]*\[\/\/\]:?[ \t]*#?[ \t]*\(?STEPS_(START|END)\)?[ \t]*$/gm, ''); // quick-start template step markers
    s = s.replace(/\smarkdown(="1"|=1|="block"|="span")?(?=[\s>])/g, '');
    s = s.replace(new RegExp(`<(${VOID.join('|')})\\b([^>]*?)\\s*/?>`, 'gi'), (_, tag: string, attrs: string) => `<${tag.toLowerCase()}${attrs} />`);
    s = s.replace(/<\/(br|hr)\s*>/gi, '');
    s = s.replace(/(<[a-zA-Z][^>]*?)\bclass=/g, '$1className=');
    s = s.replace(/(<[a-zA-Z][^>]*?)\sstyle=("[^"]*"|'[^']*')/g, '$1');
    s = s.replace(/(<[a-zA-Z][^>]*?)\s(colspan|rowspan|tabindex|frameborder|allowfullscreen|cellpadding|cellspacing)=/gi,
      (_, pre: string, a: string) => `${pre} ${JSX_ATTRS[a.toLowerCase()]}=`);
    s = s.replace(/\{(?!\/\*)/g, '\\{').replace(/(?<!\\)\}/g, '\\}');
    s = s.replace(NOT_JSX, '&lt;');
    return s;
  });
}

/**
 * HTML comments that open a line outside code and hold a code fence, removed whole: a browser hides them, fences and
 * all, while read fence by fence their last fence (often "``` -->") never closes. Other comments go later (inline).
 */
function fencedComments(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f && (!fence || (f[1]![0] === fence[0] && f[1]!.length >= fence.length))) { fence = fence ? null : f[1]!; out.push(line); continue; }
    if (!fence && /^\s*<!--/.test(line) && !line.includes('-->')) {
      let j = i + 1;
      while (j < lines.length && !lines[j]!.includes('-->')) j++;
      const inside = lines.slice(i + 1, j);
      if (j < lines.length && inside.concat(lines[j]!).some((l) => /^\s*(`{3,}|~{3,})/.test(l))) {
        const after = lines[j]!.slice(lines[j]!.indexOf('-->') + 3);
        if (after.trim()) out.push(after);
        i = j;
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Tabs in a line's indentation as spaces, to 4-column stops (Python-Markdown's tab_length); code fences kept as written. */
function expandIndentTabs(md: string): string {
  let fence: string | null = null;
  return md.split('\n').map((line) => {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f && (!fence || (f[1]![0] === fence[0] && f[1]!.length >= fence.length))) { fence = fence ? null : f[1]!; return line; }
    if (fence) return line;
    return line.replace(/^[ \t]*\t[ \t]*/, (ws) => ws.split('').reduce((acc, c) => (c === '\t' ? acc + ' '.repeat(4 - (acc.length % 4)) : acc + c), ''));
  }).join('\n');
}

/** Convert MkDocs Markdown to MDX. Returns the body and whether it needs the Tabs imports. */
export function toMdx(md: string): { body: string; usesTabs: boolean; stats: SyntaxStats } {
  const stats: SyntaxStats = { admonitions: 0, collapsibles: 0, tabs: 0, attrLists: 0 };
  const body = inline(blocks(expandIndentTabs(fencedComments(md)), stats), stats);
  return { body, usesTabs: /<Tabs>/.test(body), stats };
}
