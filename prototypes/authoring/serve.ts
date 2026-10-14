// PROTOTYPE, throwaway. Answers: "What does writing with the explicit WSO2 content components feel like for an Identity
// Platform writer, and what does the check tell them when they miss one?" (map .scratch/wso2-docs-authoring-components,
// decisions in issues/01-component-api.md and 03-md-or-mdx.md).
//
// For each page: Source (MDX, highlighted, check findings inline), Rendered (@mdx-js/mdx evaluate + react-dom/server
// with the stand-in components), Side by side, and Check output. Pages are re-read on every request: edit a file in
// pages/ and reload. Images come read-only from the docs-is clone.
//
// Run (Node 22.18+, from this folder):  node serve.ts     then open http://127.0.0.1:3027/
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileFor } from '../../docs-site/scripts/serve.mjs';
import { check, format, type Finding } from './check.ts';
import { render } from './render.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3027;
const DOCS_IS = '/Users/admin/Documents/wso2/git/docs/docs-is/docusaurus';
const DOCS = path.join(DOCS_IS, 'docs');

/** Each page: its file and its place in the docs-is tree (for links, link-card descriptions and images). */
const PAGES: Record<string, { file: string; docDir: string; note: string }> = {
  'connect-with-ms-entra': { file: path.join(HERE, 'pages/connect-with-ms-entra.mdx'), docDir: path.join(DOCS, 'references/tutorials'),
    note: 'Real page rewritten by hand: Prerequisites (title form), Steps, nested Steps, explicit ids' },
  'login-flow-builder': { file: path.join(HERE, 'pages/login-flow-builder.mdx'), docDir: path.join(DOCS, 'guides/authentication'),
    note: 'Real page rewritten by hand: Steps on ### headings, LinkCards on the closing list' },
  'missing-components': { file: path.join(HERE, 'pages/missing-components.mdx'), docDir: path.join(DOCS, 'guides/authentication'),
    note: 'Written the old way, for the check' },
  'connect-with-ms-entra.md (today)': { file: path.join(DOCS, 'references/tutorials/connect-with-ms-entra.md'), docDir: path.join(DOCS, 'references/tutorials'),
    note: 'The docs-is page as it is today (read-only), for comparison' },
};
const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rel = (file: string) => file.startsWith(HERE) ? path.relative(HERE, file) : file.replace(DOCS_IS, 'docs-is/docusaurus');
const assetUrl = (file: string) => file.startsWith(DOCS_IS + path.sep) ? `/docs-is/${path.relative(DOCS_IS, file).split(path.sep).join('/')}` : '';

function shell(title: string, page: string | null, body: string) {
  const nav = page ? ['source', 'rendered', 'side', 'check'].map((v) => `<a href="/${v}/${encodeURIComponent(page)}">${v === 'side' ? 'side by side' : v}</a>`).join(' ') : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="/style.css"></head>
<body><div class="bar"><strong>PROTOTYPE</strong><a href="/">index</a>${page ? `<span>${esc(page)}</span>${nav}` : ''}</div>${body}
<script>document.querySelectorAll('[data-tabs]').forEach((t) => t.addEventListener('click', (e) => { const i = e.target.dataset?.tab; if (i === undefined) return;
  t.querySelectorAll('.tabs__item').forEach((x) => x.classList.toggle('tabs__item--active', x.dataset.tab === i));
  t.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== i; }); }));</script></body></html>`;
}

/** Light highlighting of MDX source: front matter, headings, components, directives, explicit ids, fenced code. */
function highlight(source: string, findings: Finding[]) {
  const byLine = new Map<number, Finding[]>();
  for (const f of findings) byLine.set(f.line, [...(byLine.get(f.line) ?? []), f]);
  let fm = false; let fence = false;
  return source.split('\n').map((raw, i) => {
    const n = i + 1;
    let line = esc(raw);
    if (n === 1 && raw === '---') fm = true;
    else if (fm && raw === '---') { fm = false; line = `<span class="t-fm">${line}</span>`; }
    if (fm || (n === 1 && raw === '---')) line = `<span class="t-fm">${line}</span>`;
    else if (/^\s*```/.test(raw)) { fence = !fence; line = `<span class="t-code">${line}</span>`; }
    else if (fence) line = `<span class="t-code">${line}</span>`;
    else {
      line = line.replace(/\{\/\* #[^*]+\*\/\}/g, (m) => `<span class="t-id">${m}</span>`);
      if (/^#{1,6} /.test(raw)) line = `<span class="t-h">${line}</span>`;
      line = line.replace(/&lt;\/?[A-Z][A-Za-z]*(?:[^&]|&(?!gt;))*?\/?&gt;/g, (m) => `<span class="t-jsx">${m}</span>`)
        .replace(/^(\s*:::[a-z]*(?:\[.*\])?)$/, (m) => `<span class="t-dir">${m}</span>`);
    }
    const errs = byLine.get(n);
    const notes = errs ? errs.map((f) => `<span class="note"><b>error</b> ${esc(f.message)} <i>[${f.rule}]</i>\nfix: ${esc(f.fix)}</span>`).join('') : '';
    return `<span class="l${errs ? ' err' : ''}" id="L${n}">${line}</span>${notes}`;
  }).join('');
}

function checkHtml(file: string, findings: Finding[]) {
  const text = esc(format(rel(file), findings))
    .replace(/^(\s+\d+:\d+\s+)error/gm, '$1<span class="e">error</span>')
    .replace(/^(\s+)fix: (.*)$/gm, '$1<span class="fix">fix: $2</span>')
    .replace(/\[([a-z-]+)\]$/gm, '<span class="rule">[$1]</span>')
    .replace(/^(\s+)0 errors$/m, '$1<span class="ok">0 errors</span>');
  return `<pre class="checkout">$ node check.ts ${esc(rel(file))}\n\n${text}</pre>`;
}

async function view(kind: string, name: string, at: string | null): Promise<string> {
  const page = PAGES[name];
  const source = fs.readFileSync(page.file, 'utf8');
  const findings = check(page.file, source);
  if (kind === 'source') return shell(`${name}: source`, name, `<pre class="src">${highlight(source, findings)}</pre>`);
  if (kind === 'check') return shell(`${name}: check`, name, checkHtml(page.file, findings));
  if (kind === 'side') {
    // ?at=<heading id>: both panes start at that heading (the source line holding the id, else 2 lines above it).
    const line = at ? source.split('\n').findIndex((l) => l.includes(`#${at} */}`)) + 1 : 0;
    const jump = line ? `<script>addEventListener('load', () => { const l = document.getElementById('L${Math.max(line - 2, 1)}'); l.parentElement.scrollTop = l.offsetTop - l.parentElement.offsetTop; });</script>` : '';
    return shell(`${name}: side by side`, name, `<div class="split"><pre class="src">${highlight(source, findings)}</pre><iframe src="/rendered/${encodeURIComponent(name)}?bare=1${at ? `#${encodeURIComponent(at)}` : ''}" title="rendered"></iframe></div>${jump}`);
  }
  let html: string;
  try { html = await render(source, page.docDir, assetUrl); } catch (e: any) { html = `<div class="unknown-component">MDX did not compile: ${esc(String(e.message ?? e))}</div>`; }
  return shell(`${name}: rendered`, name, `<article class="doc">${html}</article>`);
}

function index() {
  const rows = Object.entries(PAGES).map(([name, p]) => {
    const n = check(p.file, fs.readFileSync(p.file, 'utf8')).length;
    const u = encodeURIComponent(name);
    return `<tr><td><strong>${esc(name)}</strong><br><small>${esc(p.note)}</small><br><small><code>${esc(rel(p.file))}</code></small></td>
<td><a href="/source/${u}">Source</a></td><td><a href="/rendered/${u}">Rendered</a></td><td><a href="/side/${u}">Side by side</a></td>
<td><a href="/check/${u}">Check</a> (${n} error${n === 1 ? '' : 's'})</td></tr>`;
  }).join('');
  return shell('Authoring prototype', null, `<div class="index"><h1>Writing with WSO2 content components (prototype)</h1>
<p>Question: what does writing with the explicit components feel like for an Identity Platform writer, and what does the check tell them when they miss one? Edit a file in <code>prototypes/authoring/pages/</code> and reload.</p>
<table><tr><th>Page</th><th colspan="4">Views</th></tr>${rows}</table></div>`);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const send = (status: number, type: string, body: string | Buffer) => res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).end(body);
  try {
    if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', index());
    if (url.pathname === '/style.css') return send(200, 'text/css; charset=utf-8', fs.readFileSync(path.join(HERE, 'style.css')));
    if (url.pathname.startsWith('/docs-is/')) {
      const file = fileFor(DOCS_IS, url.pathname.slice('/docs-is'.length));
      const type = file && TYPES[path.extname(file).toLowerCase()];
      if (!file || !type) return send(404, 'text/plain', 'not found');
      return send(200, type, fs.readFileSync(file));
    }
    const m = /^\/(source|rendered|side|check)\/(.+)$/.exec(url.pathname);
    const name = m && decodeURIComponent(m[2]);
    if (m && name && PAGES[name]) {
      let html = await view(m[1], name, url.searchParams.get('at'));
      if (url.searchParams.has('bare')) html = html.replace(/<div class="bar">[\s\S]*?<\/div>/, '');
      return send(200, 'text/html; charset=utf-8', html);
    }
    send(404, 'text/plain', 'not found');
  } catch (e: any) {
    send(500, 'text/plain; charset=utf-8', String(e?.stack ?? e));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Authoring prototype: http://127.0.0.1:${PORT}/`));
