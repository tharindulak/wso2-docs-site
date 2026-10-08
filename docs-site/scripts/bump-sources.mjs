// Bump bot: move each content source's pinned commit to the head of its tracked branch, and propose version
// promotions when a product publishes a newer GA release. Run hourly by .github/workflows/content-bump.yml.
// Usage: node scripts/bump-sources.mjs [--write] [--bumps | --promotions] [--json out.json]
//   --bumps / --promotions limit the run to one kind, so each lands in its own pull request.
//   Without --write it only reports. Content bumps auto-merge once the build passes; promotions need approval.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readLock, refsOf, LOCK } from './lib.mjs';
import { compareValues } from '@wso2/docs-converter';

const args = process.argv.slice(2);
const write = args.includes('--write');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const SHA = /^[0-9a-f]{40}$/;
const doBumps = !args.includes('--promotions');
const doPromotions = !args.includes('--bumps');

function headOf(repo, branch) {
  const out = execFileSync('git', ['ls-remote', `https://github.com/${repo}.git`, `refs/heads/${branch}`], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  const sha = out.split(/\s+/)[0];
  if (!SHA.test(sha ?? '')) throw new Error(`${repo}: no commit for branch ${branch}`);
  return sha;
}

async function github(pathname) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'wso2-docs-site-bump' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/${pathname}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${pathname}: ${res.status}`);
  return res.json();
}

const lock = readLock();
let text = fs.readFileSync(LOCK, 'utf8');
const bumps = [];
const promotions = [];

// 1. Content bumps: one head lookup per repo and branch.
const heads = new Map();
for (const product of doBumps ? lock.products : []) {
  for (const section of product.sections) {
    for (const ref of refsOf(section)) {
      const key = `${ref.repo}#${ref.track}`;
      if (!heads.has(key)) heads.set(key, headOf(ref.repo, ref.track));
      const head = heads.get(key);
      if (head !== ref.sha && !bumps.some((b) => b.repo === ref.repo && b.from === ref.sha)) {
        bumps.push({ repo: ref.repo, track: ref.track, from: ref.sha, to: head, compare: `https://github.com/${ref.repo}/compare/${ref.sha}...${head}` });
      }
    }
  }
}
for (const b of bumps) text = text.replaceAll(`sha: ${b.from}`, `sha: ${b.to}`);

// 2. Promotions: a newer GA release of a self-hosted distribution whose docs follow the version-in-path convention.
for (const product of doPromotions ? lock.products : []) {
  for (const section of product.sections) {
    const sh = section.self_hosted;
    if (!sh?.product_repo || !sh.version) continue;
    const releases = (await github(`repos/${sh.product_repo}/releases?per_page=20`)) ?? [];
    const latest = releases.filter((r) => !r.prerelease && !r.draft).map((r) => r.tag_name.replace(/^v/, ''))
      .filter((v) => /^\d+(\.\d+)+$/.test(v)).sort(compareValues).at(-1);
    if (!latest || compareValues(latest, sh.version) <= 0) continue;
    const mkdocs = sh.mkdocs.replace(sh.version, latest);
    const docsReady = mkdocs !== sh.mkdocs && Boolean(await github(`repos/${sh.repo}/contents/${mkdocs}?ref=${sh.track}`));
    promotions.push({ section: section.id, from: sh.version, to: latest, mkdocs, docsReady });
    if (docsReady && write) {
      const start = text.indexOf(`\n      - id: ${section.id}\n`); // section entries are indented 6 spaces
      if (start < 0) throw new Error(`Section ${section.id} not found in the lock file`);
      const block = text.slice(start + 1);
      const end = block.slice(1).search(/\n {6}- id: |\n {2}- id: |\n[a-z_]+:/) + 1;
      const old = end > 0 ? block.slice(0, end) : block;
      // Move every version-bearing path to the new release, then point "Older versions" at the previous site.
      const updated = old
        .replace(`version: ${sh.version}`, `version: ${latest}`)
        .replaceAll(`/${sh.version}`, `/${latest}`)
        .replace(/older_versions: \S+/, `older_versions: ${sh.current_site}`);
      text = text.replace(old, updated);
    }
  }
}

const report = { bumps, promotions };
console.log(JSON.stringify(report, null, 2));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
if (write && (bumps.length || promotions.some((p) => p.docsReady))) fs.writeFileSync(LOCK, text);
