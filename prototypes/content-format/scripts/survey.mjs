// PROTOTYPE, throwaway: measure how much of every product's docs converts and compiles as Docusaurus MDX.
// Usage: node scripts/survey.mjs <dir containing sparse clones> <out json>
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { renderSingle, load, parse } from './jinja.mjs';
import { convert } from './mkdocs-syntax.mjs';

const [srcDir, outFile] = process.argv.slice(2);
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return ['.git', 'node_modules', 'build', '.docusaurus'].includes(e.name) ? [] : walk(p);
  return /\.mdx?$/.test(e.name) ? [p] : [];
}) : [];
// mkdocs.yml uses Python-specific tags; strip them before parsing (we only need `extra` and `docs_dir`).
const readYml = (f) => {
  const raw = fs.readFileSync(f, 'utf8').replace(/!!python\/[^\s]+/g, 'null').replace(/!ENV\s*\[\s*[A-Z_]+\s*,\s*('[^']*'|"[^"]*"|[^\]]*)\]/g, '$1').replace(/!ENV\s*/g, '').replace(/!relative\s*/g, '');
  const y = yaml.load(raw, { json: true }) || {}; // json: duplicate keys allowed, last wins (as MkDocs/PyYAML)
  if (y.INHERIT) { const base = readYml(path.resolve(path.dirname(f), y.INHERIT)); return { ...base, ...y, extra: { ...(base.extra || {}), ...(y.extra || {}) } }; }
  return y;
};
const bucket = (m) => String(m).replace(/`[^`]*`/g, '`…`').replace(/\d+/g, 'N').slice(0, 70);
async function compileOk(src, format) {
  try { await compile(src, { format, remarkPlugins: [remarkGfm, remarkDirective] }); return null; } catch (e) { return bucket(e.reason || e.message); }
}
const count = (s, re) => (s.match(re) || []).length;

// markdown-include `{!path!}` and pymdownx.snippets `--8<-- "path"`: inline the file (searched relative to the
// extension's base_path, the docs dir, the page and the config dir). `{{#var#}}` (docs-security) -> `{{ var }}`.
function expandIncludes(text, file, cfg, yml, docsDir, r, depth = 0) {
  const ext = (cfg.markdown_extensions || []).reduce((o, e) => (typeof e === 'object' && e ? { ...o, ...e } : o), {});
  const bases = [ext['markdown_include.include']?.base_path, ext['pymdownx.snippets']?.base_path].flat().filter(Boolean)
    .map((b) => path.resolve(path.dirname(yml), b)).concat([docsDir, path.dirname(file), path.dirname(yml)]);
  const find = (p) => bases.map((b) => path.resolve(b, p)).find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  const inline = (p) => { const hit = find(p.trim()); if (!hit) { r.missingIncludes = (r.missingIncludes || 0) + 1; return ''; }
    r.includesExpanded = (r.includesExpanded || 0) + 1; return depth < 5 ? expandIncludes(fs.readFileSync(hit, 'utf8'), hit, cfg, yml, docsDir, r, depth + 1) : ''; };
  return text.replace(/\{!\s*([^!]+?)\s*!\}/g, (_, p) => inline(p))
    .replace(/^[ \t]*--8<--[ \t]+["']([^"']+)["'][ \t]*$/gm, (_, p) => inline(p))
    .replace(/\{\{#([A-Za-z_]\w*)#\}\}/g, '{{ $1 }}');
}
async function surveyMkdocs(repo, yml) {
  const cfg = readYml(yml); const docsDir = path.resolve(path.dirname(yml), cfg.docs_dir || 'docs');
  const env = { ...(cfg.extra || {}), config: cfg, site_name: cfg.site_name };
  const files = walk(docsDir); const r = { tool: 'MkDocs', config: path.relative(repo, yml), pages: files.length, convertFail: 0, compileOk: 0, errors: {}, convertErrors: {}, constructs: {} };
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    for (const [k, re] of Object.entries({ 'jinja if': /\{%-?\s*if\b/g, 'include': /\{%-?\s*include\b/g, 'snippets --8<--': /--8<--/g, 'macro/for/filter': /\{%-?\s*(macro|for)\b|\{\{[^}]*\|[^}]*\}\}/g, 'raw HTML': /<(div|table|img|span|br|details|iframe)\b/gi, 'script': /<script\b/gi })) r.constructs[k] = (r.constructs[k] || 0) + count(raw, re);
    let body;
    try { body = renderSingle(parse(expandIncludes(raw, f, cfg, yml, docsDir, r)), { ...env }, f, { unknown: 0 }); }
    catch (e) { r.convertFail++; const b = bucket(e.message).replace(/'[^']*'/g, "'…'").slice(0, 50); r.convertErrors[b] = (r.convertErrors[b] || 0) + 1; continue; }
    const { body: mdx } = convert(body, { admonitions: 0, details: 0, tabs: 0, attrList: 0, htmlTouched: 0 });
    const err = await compileOk(mdx, 'mdx');
    if (!err) r.compileOk++; else r.errors[err] = (r.errors[err] || 0) + 1;
  }
  return r;
}
async function surveyDocusaurus(repo, cfgFile) {
  const cfgDir = path.dirname(cfgFile); const cfgSrc = fs.readFileSync(cfgFile, 'utf8');
  const detect = /format:\s*['"]detect['"]/.test(cfgSrc);
  const files = walk(cfgDir).filter((f) => !/(^|\/)(\w+_versioned_docs|src|blog|static|\.github)\/|(^|\/)(README|CONTRIBUTING|CLAUDE|AGENTS)\.md$/.test(path.relative(cfgDir, f)));
  const r = { tool: 'Docusaurus', config: path.relative(repo, cfgFile), pages: files.length, convertFail: 0, compileOk: 0, errors: {}, convertErrors: {}, constructs: {}, note: detect ? 'markdown.format detect: .md compiled as CommonMark' : '' };
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8').replace(/^---[\s\S]*?\n---\n/, '');
    const err = await compileOk(src, detect && f.endsWith('.md') ? 'md' : 'mdx');
    if (!err) r.compileOk++; else r.errors[err] = (r.errors[err] || 0) + 1;
  }
  return r;
}
const results = {};
for (const repo of fs.readdirSync(srcDir).sort()) {
  if (repo === 'docs-is') continue; // measured in the content-format prototype
  const root = path.join(srcDir, repo); if (!fs.existsSync(path.join(root, '.git'))) continue;
  const ymls = walk(root).length && fs.readdirSync(root, { recursive: true }).filter((f) => /(^|[\\/])mkdocs\.yml$/.test(f) && !/node_modules/.test(f));
  const dcfg = fs.readdirSync(root, { recursive: true }).find((f) => /(^|[\\/])docusaurus\.config\.(ts|js|mjs)$/.test(f) && !/node_modules/.test(f));
  results[repo] = [];
  if (dcfg) results[repo].push(await surveyDocusaurus(root, path.join(root, dcfg)));
  else for (const y of ymls) { try { results[repo].push(await surveyMkdocs(root, path.join(root, y))); } catch (e) { results[repo].push({ tool: 'MkDocs', config: y, error: e.message.slice(0, 120) }); } }
  for (const r of results[repo]) console.log(`${repo.padEnd(22)} incl+${String(r.includesExpanded ?? 0).padStart(4)} miss ${String(r.missingIncludes ?? 0).padStart(3)} ${(r.config || '').padEnd(28)} ${r.tool.padEnd(10)} pages ${String(r.pages ?? '-').padStart(4)}  convertFail ${String(r.convertFail ?? '-').padStart(3)}  compileOk ${String(r.compileOk ?? '-').padStart(4)} (${r.pages ? Math.round(100 * r.compileOk / r.pages) : 0}%) ${r.error ?? ''}`);
}
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
