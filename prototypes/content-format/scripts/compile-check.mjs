// PROTOTYPE: compile every converted page with MDX 3 (+ GFM + directives, as Docusaurus does) and bucket the errors.
import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
const dir = process.argv[2];
const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.mdx') && files.push(path.join(d, e.name)); })(dir);
const buckets = {}; const failures = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8').replace(/^---[\s\S]*?---\n/, '');
  try { await compile(src, { remarkPlugins: [remarkGfm, remarkDirective] }); }
  catch (e) {
    const msg = String(e.reason || e.message).replace(/`[^`]*`/g, '`…`').replace(/\d+/g, 'N').slice(0, 90);
    buckets[msg] = (buckets[msg] || 0) + 1; failures.push({ file: path.relative(dir, f), line: e.line, msg: String(e.reason || e.message).slice(0, 160) });
  }
}
fs.writeFileSync(path.join(dir, '..', '..', 'compile-failures.json'), JSON.stringify(failures, null, 2));
console.log(`compiled ${files.length - failures.length}/${files.length}`);
console.log(Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([m, n]) => `${String(n).padStart(4)}  ${m}`).join('\n'));
