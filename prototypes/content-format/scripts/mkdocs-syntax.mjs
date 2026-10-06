// PROTOTYPE, throwaway: rewrite MkDocs Material syntax to Docusaurus MDX. Leaves fenced code alone.
const ADM = { note: 'note', info: 'info', tip: 'tip', hint: 'tip', success: 'tip', important: 'warning', warning: 'warning', caution: 'warning', attention: 'warning', danger: 'danger', error: 'danger', failure: 'danger', bug: 'danger' };

export function convert(md, stats) {
  const lines = md.split('\n'); const out = []; let fence = null; let usesTabs = false;
  const indentOf = (l) => l.match(/^\s*/)[0].length;
  const blockBody = (start, ind) => { // lines belonging to an indented MkDocs block
    const body = []; let j = start;
    while (j < lines.length && (lines[j].trim() === '' || indentOf(lines[j]) >= ind + 4)) body.push(lines[j++]);
    while (body.length && body[body.length - 1].trim() === '') { body.pop(); j--; }
    return { body: body.map((l) => l.slice(Math.min(indentOf(l), ind + 4) - ind)).join('\n'), next: j };
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]; const f = l.match(/^\s*(```|~~~)/);
    if (f) { fence = fence ? null : f[1]; out.push(l.replace(/^(\s*```)\s*\{?\s*\.?([\w-]+)[^`]*$/, '$1$2')); continue; }
    if (fence) { out.push(l); continue; }
    let m;
    if ((m = l.match(/^(\s*)(!!!|\?\?\?\+?)\s+([\w-]+)(?:\s+"([^"]*)")?\s*$/))) {
      const [, ws, kind, type, title] = m; const { body, next } = blockBody(i + 1, ws.length);
      const inner = convert(body, stats).body.split('\n').map((x) => (x ? ws + x : x)).join('\n');
      if (kind === '!!!') { stats.admonitions++; out.push(`${ws}:::${ADM[type] || 'note'}${title ? `[${title}]` : ''}`, '', inner, '', `${ws}:::`); }
      else { stats.details++; out.push(`${ws}<details${kind.endsWith('+') ? ' open' : ''}>`, `${ws}<summary>${title || type}</summary>`, '', inner, '', `${ws}</details>`); }
      i = next - 1; continue;
    }
    if ((m = l.match(/^(\s*)===\s+"([^"]*)"\s*$/))) {
      const ws = m[1]; const items = [];
      let j = i;
      while (j < lines.length && (m = lines[j].match(/^(\s*)===\s+"([^"]*)"\s*$/)) && m[1] === ws) {
        const { body, next } = blockBody(j + 1, ws.length); items.push([m[2], convert(body, stats).body]); j = next;
        while (j < lines.length && lines[j].trim() === '' && lines[j + 1]?.match(/^\s*===\s+"/)) j++;
      }
      usesTabs = true; stats.tabs++;
      out.push(`${ws}<Tabs>`, ...items.flatMap(([t, b], k) => [`${ws}<TabItem value="${k}" label="${t.replace(/"/g, '&quot;')}">`, '', b.split('\n').map((x) => (x ? ws + x : x)).join('\n'), '', `${ws}</TabItem>`]), `${ws}</Tabs>`);
      i = j - 1; continue;
    }
    out.push(l);
  }
  let body = out.join('\n');
  // Outside code: attr_list, HTML comments, and HTML that MDX rejects.
  body = mapOutsideCode(body, (t) => {
    const before = t;
    t = t.replace(/\{:\s*[^}]*\}/g, () => (stats.attrList++, ''));
    t = t.replace(/<!--[\s\S]*?-->/g, '');
    t = t.replace(/<(br|hr|img|input)\b([^>]*?)\/?>/gi, (_, tag, a) => `<${tag.toLowerCase()}${a} />`);
    t = t.replace(/\bclass=/g, 'className=').replace(/\sstyle="[^"]*"/g, '');
    // MDX treats { as an expression and < as JSX: escape them unless they start a tag we know is HTML/JSX.
    t = t.replace(/\{(?!\/\*)/g, '\\{').replace(/(?<!\\)\}/g, '\\}');
    t = t.replace(/<(?!\/?(?:Applies|DeploymentValue|Tabs|TabItem|details|summary|a|b|i|em|strong|code|pre|p|div|span|table|thead|tbody|tr|td|th|ul|ol|li|img|br|hr|sup|sub|kbd|input|label|iframe|video|source|h[1-6])\b)/g, '&lt;');
    if (t !== before) stats.htmlTouched++;
    return t;
  });
  return { body, usesTabs: usesTabs || body.includes("<Tabs>") };
}
export function mapOutsideCode(s, fn) {
  return s.split(/(^\s*```[\s\S]*?^\s*```|`[^`\n]*`)/m).map((p, i) => (i % 2 ? p : fn(p))).join('');
}
