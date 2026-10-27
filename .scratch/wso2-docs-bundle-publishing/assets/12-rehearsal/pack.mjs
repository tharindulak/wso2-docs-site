// Prototype only (docs bundle rehearsal): turn a Docusaurus section into a draft docs manifest and the list of
// files a bundle carries. No dependencies. Usage, from the repository root:
//   node pack.mjs <section-root> <section-id> <version> <source-commit> <out-dir>
// Writes <out-dir>/wso2-docs.yaml, <out-dir>/files.txt (repo-relative, one per line) and <out-dir>/report.json.
import fs from 'node:fs';
import path from 'node:path';

const [root, sectionId, version, commit, outDir] = process.argv.slice(2);
if (!root || !sectionId || !/^\d+\.\d+\.\d+$/.test(version ?? '') || !/^[0-9a-f]{40}$/.test(commit ?? '') || !outDir) {
  console.error('usage: node pack.mjs <section-root> <section-id> <x.y.z> <40-char commit> <out-dir>');
  process.exit(2);
}
const repo = process.cwd();
const docsDir = path.posix.join(root, 'docs');
const report = { pages: 0, navPages: 0, labelsDropped: [], missingDocs: [], unsupported: [], refsOutside: [], refsMissing: [], symlinks: [], treeWide: [] };

const rel = (p) => path.relative(repo, p).split(path.sep).join('/');
const inRepo = (abs) => !path.relative(repo, abs).startsWith('..') && !path.isAbsolute(path.relative(repo, abs));

function docPath(id) {
  for (const ext of ['.mdx', '.md', '/index.mdx', '/index.md']) {
    const p = path.posix.join(docsDir, id + ext);
    if (fs.existsSync(p)) return p;
  }
  report.missingDocs.push(id);
  return null;
}

function title(p) {
  const src = fs.readFileSync(p, 'utf8');
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  const t = fm?.[1].match(/^(?:sidebar_label|title):\s*["']?(.+?)["']?\s*$/m);
  if (t) return t[1];
  return src.replace(/^---\n[\s\S]*?\n---/, '').match(/^#\s+(.+)$/m)?.[1].trim() ?? null;
}

// Docusaurus sidebar items -> manifest nav items (page, category, link). Doc labels are dropped: a page shows its
// own title; each dropped label that differs from the title is reported.
function navItem(item) {
  if (typeof item === 'string') item = { type: 'doc', id: item };
  if (item.type === 'doc') {
    const p = docPath(item.id);
    if (!p) return null;
    report.navPages++;
    const t = title(p);
    if (item.label && item.label !== t) report.labelsDropped.push({ page: p, label: item.label, title: t });
    return { page: p };
  }
  if (item.type === 'category') {
    const out = { category: item.label };
    if (item.collapsed !== undefined) out.collapsed = item.collapsed;
    if (item.link?.type === 'doc') { const p = docPath(item.link.id); if (p) out.overview = p; }
    else if (item.link) report.unsupported.push({ category: item.label, link: item.link.type });
    out.items = (item.items ?? []).map(navItem).filter(Boolean);
    return out;
  }
  if (item.type === 'link') return { link: item.href, label: item.label };
  report.unsupported.push({ type: item.type });
  return null;
}

const sidebars = JSON.parse(fs.readFileSync(path.posix.join(root, 'sidebars.json'), 'utf8'));
const ids = Object.keys(sidebars);
if (ids.length !== 1) report.unsupported.push({ sidebars: ids });
const nav = sidebars[ids[0]].map(navItem).filter(Boolean);

// Files: every file under docs/, plus files the pages reference by relative path (images, imports).
const files = new Set();
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.posix.join(dir, e.name);
    if (e.isSymbolicLink()) report.symlinks.push(p);
    else if (e.isDirectory()) walk(p);
    else files.add(p);
  }
}
walk(docsDir);
const refRe = /\]\(\s*<?([^)\s>#?]+)|\bsrc=["']([^"'#?]+)|\bfrom\s+["'](\.[^"']+)["']|require\(\s*["'](\.[^"']+)["']\s*\)/g;
for (const f of [...files]) {
  if (!/\.mdx?$/.test(f)) continue;
  report.pages++;
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(refRe)) {
    const ref = decodeURI(m[1] ?? m[2] ?? m[3] ?? m[4]);
    if (/^[a-z][a-z0-9+.-]*:|^\/|^@/i.test(ref)) continue; // URLs, site paths, aliases
    const abs = path.resolve(path.dirname(f), ref);
    if (!inRepo(abs)) { report.refsOutside.push({ page: f, ref }); continue; }
    const r = rel(abs);
    if (r.startsWith(docsDir + '/')) continue; // page links and files already packed
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) { if (fs.lstatSync(abs).isSymbolicLink()) report.symlinks.push(r); else files.add(r); }
    else report.refsMissing.push({ page: f, ref });
  }
}
for (const f of ['redirects.json']) {
  const p = path.posix.join(root, f);
  if (fs.existsSync(p)) { files.add(p); report.treeWide.push(p); }
}

// Draft manifest (YAML by hand: keys and values here are plain, JSON strings are valid YAML scalars).
const y = (v) => JSON.stringify(v);
function emit(items, indent) {
  let s = '';
  for (const it of items) {
    const pad = ' '.repeat(indent);
    if (it.page) s += `${pad}- page: ${y(it.page)}\n`;
    else if (it.link) s += `${pad}- link: ${y(it.link)}\n${pad}  label: ${y(it.label)}\n`;
    else {
      s += `${pad}- category: ${y(it.category)}\n`;
      if (it.collapsed !== undefined) s += `${pad}  collapsed: ${it.collapsed}\n`;
      if (it.overview) s += `${pad}  overview: ${y(it.overview)}\n`;
      s += `${pad}  items:\n` + emit(it.items, indent + 4);
    }
  }
  return s;
}
const manifest = `# Draft docs manifest generated by the bundle rehearsal (prototype). Not a schema yet.
section:
  id: ${y(sectionId)}
  version: ${y(version)}
  format: docusaurus
  root: ${y(root)}
  source_commit: ${y(commit)}
nav:
${emit(nav, 2)}`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'wso2-docs.yaml'), manifest);
fs.writeFileSync(path.join(outDir, 'files.txt'), [...files].sort().join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ files: files.size, pages: report.pages, navPages: report.navPages, labelsDropped: report.labelsDropped.length,
  missingDocs: report.missingDocs.length, unsupported: report.unsupported.length, refsOutside: report.refsOutside.length,
  refsMissing: report.refsMissing.length, symlinks: report.symlinks.length, treeWide: report.treeWide }));
if (report.symlinks.length || report.refsOutside.length) process.exit(1);
