// Rewrite MkDocs Material Markdown into Docusaurus MDX. Fenced and inline code are never touched.

const ADMONITION = {
  note: 'note', abstract: 'note', summary: 'note', tldr: 'note', quote: 'note', cite: 'note', example: 'note',
  info: 'info', todo: 'info', question: 'info', help: 'info', faq: 'info',
  tip: 'tip', hint: 'tip', success: 'tip', check: 'tip', done: 'tip',
  important: 'warning', warning: 'warning', caution: 'warning', attention: 'warning',
  danger: 'danger', error: 'danger', failure: 'danger', fail: 'danger', missing: 'danger', bug: 'danger',
};

// Tags MDX may keep as JSX. Anything else that looks like a tag is escaped as text.
export const JSX_TAGS = [
  'Applies', 'DeploymentValue', 'Tabs', 'TabItem', 'ThemedImage', 'Redirect',
  'a', 'abbr', 'b', 'blockquote', 'br', 'button', 'caption', 'code', 'col', 'colgroup', 'dd', 'del', 'details', 'div',
  'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'iframe', 'img', 'input',
  'ins', 'kbd', 'label', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'source', 'span', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'video',
];
const VOID = ['br', 'hr', 'img', 'input', 'col', 'source'];
const NOT_JSX = new RegExp(`<(?!/?(?:${JSX_TAGS.join('|')})(?=[\\s/>]))`, 'g');

const indentOf = (line) => line.match(/^\s*/)[0].length;

/** Lines that belong to an indented MkDocs block starting at `start` under indentation `ind`. */
function takeBlock(lines, start, ind) {
  const body = [];
  let j = start;
  while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) >= ind + 4)) body.push(lines[j++]);
  while (body.length && body[body.length - 1].trim() === '') { body.pop(); j--; }
  return { body: body.map((l) => l.slice(Math.min(indentOf(l), ind + 4))).join('\n'), next: j };
}
const reindent = (text, ws) => text.split('\n').map((l) => (l ? ws + l : l)).join('\n');

function blocks(md, stats) {
  const lines = md.split('\n');
  const out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (f && (!fence || (f[2][0] === fence[0] && f[2].length >= fence.length && !f[3].trim()))) {
      if (!fence) { fence = f[2]; out.push(f[1] + f[2] + fenceInfo(f[3])); } else { fence = null; out.push(line); }
      continue;
    }
    if (fence) { out.push(line); continue; }

    let m = line.match(/^(\s*)(!!!|\?\?\?\+?)\s+([\w-]+)(?:\s+"([^"]*)")?\s*$/);
    if (m) {
      const [, ws, kind, type, title] = m;
      const { body, next } = takeBlock(lines, i + 1, ws.length);
      const inner = reindent(blocks(body, stats), ws);
      if (kind === '!!!') {
        stats.admonitions++;
        out.push(`${ws}:::${ADMONITION[type.toLowerCase()] ?? 'note'}${title ? `[${title.replace(/[[\]]/g, '')}]` : ''}`, '', inner, '', `${ws}:::`);
      } else {
        stats.collapsibles++;
        out.push(`${ws}<details${kind.endsWith('+') ? ' open' : ''}>`, `${ws}<summary>${title || type}</summary>`, '', inner, '', `${ws}</details>`);
      }
      i = next - 1;
      continue;
    }

    m = line.match(/^(\s*)===\+?\s+"([^"]*)"\s*$/);
    if (m) {
      const ws = m[1];
      const items = [];
      let j = i;
      while (j < lines.length && (m = lines[j].match(/^(\s*)===\+?\s+"([^"]*)"\s*$/)) && m[1] === ws) {
        const label = m[2];
        const { body, next } = takeBlock(lines, j + 1, ws.length);
        items.push([label, blocks(body, stats)]);
        j = next;
        while (j < lines.length && lines[j].trim() === '' && /^\s*===\+?\s+"/.test(lines[j + 1] ?? '') && indentOf(lines[j + 1]) === ws.length) j++;
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
function fenceInfo(info) {
  const t = info.trim();
  if (!t) return '';
  const lang = (t.match(/^\{?\s*\.?([\w+#-]+)/) || [])[1] ?? '';
  const title = t.match(/title="([^"]*)"/);
  const hl = t.match(/hl_lines="([^"]*)"/);
  const lines = hl ? ` {${hl[1].trim().split(/\s+/).map((r) => r.replace('-', '-')).join(',')}}` : '';
  return `${lang}${title ? ` title="${title[1]}"` : ''}${lines}`;
}

/** Apply fn to the parts of text outside fenced and inline code. */
export function outsideCode(text, fn) {
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
const placeholderHostLinks = (text) => outsideCode(text, (t) => t.replace(/\[([^\]]*)\]\(([a-z]+:\/\/[^)\s/]*[<>][^)\s]*)\)/gi, (_, label, url) => `${label} (\`${url}\`)`));

function inline(text, stats) {
  return outsideCode(placeholderHostLinks(text), (t) => {
    let s = t;
    s = s.replace(/\{:?\s*[.#]?[\w-]+(=("[^"]*"|'[^']*'|[^\s}]+))?(\s+[.#]?[\w-]+(=("[^"]*"|'[^']*'|[^\s}]+))?)*\s*\}/g, (m) => (m.startsWith('{:') || /=|^\{\s*[.#]/.test(m) ? (stats.attrLists++, '') : m));
    s = s.replace(/\]\(([^)\s]*[<>][^)\s]*)\)/g, (_, url) => `](${url.replace(/</g, '%3C').replace(/>/g, '%3E')})`);
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(/\smarkdown(="1"|=1|="block"|="span")?(?=[\s>])/g, '');
    s = s.replace(new RegExp(`<(${VOID.join('|')})\\b([^>]*?)\\s*/?>`, 'gi'), (_, tag, attrs) => `<${tag.toLowerCase()}${attrs} />`);
    s = s.replace(/<\/(br|hr)\s*>/gi, '');
    s = s.replace(/(<[a-zA-Z][^>]*?)\bclass=/g, '$1className=');
    s = s.replace(/(<[a-zA-Z][^>]*?)\sstyle=("[^"]*"|'[^']*')/g, '$1');
    s = s.replace(/(<[a-zA-Z][^>]*?)\s(colspan|rowspan|tabindex|frameborder|allowfullscreen|cellpadding|cellspacing)=/gi, (_, pre, a) => `${pre} ${({ colspan: 'colSpan', rowspan: 'rowSpan', tabindex: 'tabIndex', frameborder: 'frameBorder', allowfullscreen: 'allowFullScreen', cellpadding: 'cellPadding', cellspacing: 'cellSpacing' })[a.toLowerCase()]}=`);
    s = s.replace(/\{(?!\/\*)/g, '\\{').replace(/(?<!\\)\}/g, '\\}');
    s = s.replace(NOT_JSX, '&lt;');
    return s;
  });
}

/** Convert MkDocs Markdown to MDX. Returns the body and whether it needs the Tabs imports. */
export function toMdx(md) {
  const stats = { admonitions: 0, collapsibles: 0, tabs: 0, attrLists: 0 };
  const body = inline(blocks(md, stats), stats);
  return { body, usesTabs: /<Tabs>/.test(body), stats };
}
