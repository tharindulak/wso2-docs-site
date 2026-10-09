// Broken internal links in built HTML: every same-site href/src must resolve to a file in the output.
// Usage: node scripts/check-links.mjs <build dir> [--under <path prefix>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const walkHtml = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/')).sort();

function resolves(dir, link) {
  let p;
  try {
    p = decodeURI(link.split(/[?#]/)[0]);
  } catch {
    return false;
  }
  if (p.startsWith('/')) p = p.slice(1);
  const file = path.join(dir, p);
  const dirResolved = path.resolve(dir);
  const fileResolved = path.resolve(file);
  if (!fileResolved.startsWith(dirResolved + path.sep) && fileResolved !== dirResolved) return false;
  const candidates = p.endsWith('/') ? [path.join(file, 'index.html')] : [file, path.join(file, 'index.html'), `${file}.html`];
  return candidates.some((f) => fs.existsSync(f) && fs.statSync(f).isFile());
}

export function findBrokenLinks(dir, { under } = {}) {
  const broken = [];
  for (const page of walkHtml(dir)) {
    if (under && !page.startsWith(under)) continue;
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    const links = new Set([...html.matchAll(/\s(?:href|src)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]));
    for (const link of [...links].sort()) if (!resolves(dir, link)) broken.push({ page, link });
  }
  return broken;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, flag, under] = process.argv.slice(2);
  if (!dir || (flag && flag !== '--under') || (flag === '--under' && !under)) { console.error('Usage: node scripts/check-links.mjs <dir> [--under <prefix>]'); process.exit(2); }
  const broken = findBrokenLinks(dir, { under });
  for (const b of broken.slice(0, 50)) console.error(`${b.page}: ${b.link}`);
  console.log(`${broken.length} broken internal link(s)`);
  process.exit(broken.length ? 1 : 0);
}
