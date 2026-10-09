// Broken internal links in built HTML: every same-site href/src (absolute, or relative to the page's URL) and every
// API reference spec (data-spec) must resolve to a file in the output.
// Usage: node scripts/check-links.mjs <build dir> [--under <path prefix>] [--baselines <dir>] [--record-live]
//   --baselines <dir>  fail only on broken links missing from every baseline file in <dir> (the per-version files
//                      plus live.json); for the merged output, where known source breakage is listed, not fixed.
//   --record-live      with --baselines: write <dir>/live.json, the broken links no per-version file lists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const walkHtml = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/')).sort();

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Site path a link on `page` points to, or null for external links, fragments and other schemes. */
export function targetOf(page, link) {
  if (link.startsWith('//') || link.startsWith('#') || SCHEME.test(link) || !link.trim()) return null;
  if (link.startsWith('/')) return link;
  const dir = `/${page}`.replace(/[^/]*$/, ''); // a/b/index.html -> /a/b/
  const [p, rest = ''] = link.split(/(?=[?#])/);
  const resolved = path.posix.resolve(dir, p);
  return `${resolved}${p.endsWith('/') && resolved !== '/' ? '/' : ''}${rest}`;
}

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

/** Broken links as { page, link, target }: link as written, target the site path it resolves to. */
export function findBrokenLinks(dir, { under } = {}) {
  const broken = [];
  for (const page of walkHtml(dir)) {
    if (under && !page.startsWith(under)) continue;
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    const links = new Set([...html.matchAll(/\s(?:href|src|data-spec)="([^"]*)"/g)].map((m) => m[1]));
    for (const link of [...links].sort()) {
      const target = targetOf(page, link);
      if (target !== null && !resolves(dir, target)) broken.push({ page, link, target });
    }
  }
  return broken;
}

const linkKey = (b) => `${b.page}\n${b.link}`;
const byKey = (x, y) => (linkKey(x) < linkKey(y) ? -1 : linkKey(x) > linkKey(y) ? 1 : 0);
export const LIVE_BASELINE = 'live.json';

/** Known broken links from a baselines folder: { versions: every per-version file, live: live.json }. */
export function readBaselines(dir) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  return {
    versions: files.filter((f) => f !== LIVE_BASELINE).flatMap(read),
    live: files.includes(LIVE_BASELINE) ? read(LIVE_BASELINE) : [],
  };
}

/** Broken links not in any of the lists (each { page, link }[]). */
export function notIn(broken, ...lists) {
  const known = new Set(lists.flat().map(linkKey));
  return broken.filter((b) => !known.has(linkKey(b)));
}

export const sortedPairs = (list) => list.map(({ page, link }) => ({ page, link })).sort(byKey);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const dir = args[0];
  const under = opt('--under');
  const baselines = opt('--baselines');
  const record = args.includes('--record-live');
  const usage = () => { console.error('Usage: node scripts/check-links.mjs <dir> [--under <prefix>] [--baselines <dir> [--record-live]]'); process.exit(2); };
  if (!dir || dir.startsWith('--') || (args.includes('--under') && !under) || (args.includes('--baselines') && !baselines) || (record && !baselines)) usage();
  const broken = findBrokenLinks(dir, { under });
  if (!baselines) {
    for (const b of broken.slice(0, 50)) console.error(`${b.page}: ${b.link}`);
    console.log(`${broken.length} broken internal link(s)`);
    process.exit(broken.length ? 1 : 0);
  }
  const known = readBaselines(baselines);
  if (record) {
    const live = sortedPairs(notIn(broken, known.versions));
    fs.writeFileSync(path.join(baselines, LIVE_BASELINE), `${JSON.stringify(live, null, 1)}\n`);
    console.log(`recorded ${live.length} broken link(s) in ${path.join(baselines, LIVE_BASELINE)}`);
  }
  const fresh = notIn(broken, known.versions, record ? notIn(broken, known.versions) : known.live);
  for (const b of fresh.slice(0, 50)) console.error(`${b.page}: ${b.link}`);
  console.log(`${broken.length} broken internal link(s), ${broken.length - fresh.length} in baselines, ${fresh.length} new`);
  process.exit(fresh.length ? 1 : 0);
}
