// Broken internal links in built HTML: every same-site href/src (absolute, or relative to the page's URL) and every
// API reference spec (data-spec) must resolve to a file in the output.
// Usage: node scripts/check-links.mjs <build dir> [--under <path prefix>] [--baselines <dir>] [--record-live]
//   --baselines <dir>  fail only on broken links missing from every baseline file in <dir> (the per-version files
//                      plus live.json); for the merged output, where known source breakage is listed, not fixed.
//   --record-live      with --baselines: write <dir>/live.json, the broken links no per-version file lists, and
//                      <dir>/literal-markdown.json, the literal Markdown counts per page (below).
// It also counts literal Markdown link and image syntax (`![`, `](`) left in rendered paragraph text: a link or
// image that failed to parse is not a link, so the link check cannot see it. With --baselines a page fails only when
// its count exceeds the one in literal-markdown.json; without, any occurrence fails.
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

/**
 * Routes of the snapshots `snapshots.mjs assemble --allow-missing` left out of the build (pull-request CI): links into
 * them cannot resolve here, so the check skips them. A deploy assembles every snapshot and writes no file.
 */
export const PENDING_FILE = '.pending-snapshots.json';
export const pendingRoutes = (dir) => (fs.existsSync(path.join(dir, PENDING_FILE)) ? JSON.parse(fs.readFileSync(path.join(dir, PENDING_FILE), 'utf8')) : []);
export const intoPending = (broken, routes) => broken.filter((b) => routes.some((r) => b.target.startsWith(`/${r}/`)));

/** Literal Markdown link/image syntax in one paragraph's text: `![alt](` or `[text](` counts once, a lone `![` or `](` once. */
export function literalMarkdownCount(text) {
  return (text.match(/!?\[[^\]\n]*\]\(|!\[|\]\(/g) ?? []).length;
}

/** Pages whose rendered <p> text (outside <code>) holds literal Markdown link or image syntax: { page, count }[]. */
export function findLiteralMarkdown(dir, { under } = {}) {
  const found = [];
  for (const page of walkHtml(dir)) {
    if (under && !page.startsWith(under)) continue;
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    let count = 0;
    for (const [, inner] of html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)) {
      count += literalMarkdownCount(inner.replace(/<code[\s>][\s\S]*?<\/code>/g, ' ').replace(/<[^>]*>/g, ''));
    }
    if (count) found.push({ page, count });
  }
  return found;
}

export const LITERAL_BASELINE = 'literal-markdown.json';

/** Pages with more literal Markdown than the baseline ({ page: count }) allows. */
export function literalOverBaseline(found, baseline = {}) {
  return found.filter((f) => f.count > (Object.hasOwn(baseline, f.page) ? baseline[f.page] : 0));
}

const linkKey = (b) => `${b.page}\n${b.link}`;
const byKey = (x, y) => (linkKey(x) < linkKey(y) ? -1 : linkKey(x) > linkKey(y) ? 1 : 0);
export const LIVE_BASELINE = 'live.json';

/** Known broken links from a baselines folder: { versions: every per-version file, live: live.json }. */
export function readBaselines(dir) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  return {
    versions: files.filter((f) => f !== LIVE_BASELINE && f !== LITERAL_BASELINE).flatMap(read),
    live: files.includes(LIVE_BASELINE) ? read(LIVE_BASELINE) : [],
    literal: files.includes(LITERAL_BASELINE) ? read(LITERAL_BASELINE) : {},
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
  const all = findBrokenLinks(dir, { under });
  const skipped = new Set(intoPending(all, pendingRoutes(dir)));
  const broken = all.filter((b) => !skipped.has(b));
  if (skipped.size) console.log(`${skipped.size} broken link(s) into pending snapshots not checked (${pendingRoutes(dir).length} pending)`);
  const literal = findLiteralMarkdown(dir, { under });
  const reportLiteral = (over) => {
    for (const f of over.slice(0, 50)) console.error(`${f.page}: ${f.count} literal Markdown sequence(s) in paragraph text`);
    console.log(`${literal.reduce((n, f) => n + f.count, 0)} literal Markdown sequence(s) on ${literal.length} page(s), ${over.length} page(s) over the baseline`);
  };
  if (!baselines) {
    for (const b of broken.slice(0, 50)) console.error(`${b.page}: ${b.link}`);
    console.log(`${broken.length} broken internal link(s)`);
    reportLiteral(literal);
    process.exit(broken.length || literal.length ? 1 : 0);
  }
  const known = readBaselines(baselines);
  if (record) {
    const live = sortedPairs(notIn(broken, known.versions));
    fs.writeFileSync(path.join(baselines, LIVE_BASELINE), `${JSON.stringify(live, null, 1)}\n`);
    console.log(`recorded ${live.length} broken link(s) in ${path.join(baselines, LIVE_BASELINE)}`);
    const counts = Object.fromEntries(literal.map((f) => [f.page, f.count]));
    fs.writeFileSync(path.join(baselines, LITERAL_BASELINE), `${JSON.stringify(counts, null, 1)}\n`);
    console.log(`recorded ${literal.length} page(s) with literal Markdown in ${path.join(baselines, LITERAL_BASELINE)}`);
  }
  const fresh = notIn(broken, known.versions, record ? notIn(broken, known.versions) : known.live);
  for (const b of fresh.slice(0, 50)) console.error(`${b.page}: ${b.link}`);
  console.log(`${broken.length} broken internal link(s), ${broken.length - fresh.length} in baselines, ${fresh.length} new`);
  const over = record ? [] : literalOverBaseline(literal, known.literal);
  reportLiteral(over);
  process.exit(fresh.length || over.length ? 1 : 0);
}
