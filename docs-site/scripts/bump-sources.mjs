// Bump bot: move Latest's pinned commit to the head of its tracked branch (older versions stay pinned), apply docs
// fix releases, and propose version promotions when a docs repo releases a version the product has released. Run hourly by .github/workflows/content-bump.yml.
// Usage: node scripts/bump-sources.mjs [--write] [--bumps | --promotions] [--json out.json]
//   --bumps (content bumps + docs fix releases) / --promotions (new versions + legacy product-repo promotion) limit
//   the run to one kind, so each lands in its own pull request.
//   Without --write it only reports. Content bumps auto-merge once the build passes; promotions need approval.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readLock, LOCK } from './lib.mjs';
import { compareValues } from '@wso2/docs-converter';
import { planBumps, applyBumps, planDocsReleases, applyDocsRelease } from './bump-lib.mjs';

const args = process.argv.slice(2);
const write = args.includes('--write');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const SHA = /^[0-9a-f]{40}$/;
const doBumps = !args.includes('--promotions');
const doPromotions = !args.includes('--bumps');

function headOf(repo, branch) {
  const out = execFileSync('git', ['ls-remote', `https://github.com/${repo}.git`, `refs/heads/${branch}`], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).toString().trim();
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

const TAG = /^[A-Za-z0-9._\/-]+$/;

/** Commit a tag points at, preferring the peeled commit of an annotated tag. */
async function tagSha(repo, tag) {
  if (!TAG.test(tag)) throw new Error(`${repo}: unsafe tag ${tag}`);
  const out = execFileSync('git', ['ls-remote', `https://github.com/${repo}.git`, `refs/tags/${tag}`, `refs/tags/${tag}^{}`], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).toString().trim().split('\n');
  const line = out.find((l) => l.endsWith('^{}')) ?? out[0];
  const sha = line?.split(/\s+/)[0];
  if (!SHA.test(sha ?? '')) throw new Error(`${repo}: no commit for tag ${tag}`);
  return sha;
}

const lock = readLock();
let text = fs.readFileSync(LOCK, 'utf8');
/** All releases of a repo, newest first (paged; capped at 1,000). */
async function releases(repo) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const r = (await github(`repos/${repo}/releases?per_page=100&page=${page}`)) ?? [];
    all.push(...r);
    if (r.length < 100) break;
  }
  return all;
}

/** Whether a file exists in a repo at a tag (a version folder's mkdocs.yml). */
async function fileAt(repo, tag, file) {
  if (!TAG.test(tag) || !/^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]+$/.test(file)) throw new Error(`${repo}: unsafe tag or path ${tag} ${file}`);
  return Boolean(await github(`repos/${repo}/contents/${file}?ref=${encodeURIComponent(tag)}`));
}

const kinds = [...(doBumps ? ['fix'] : []), ...(doPromotions ? ['new'] : [])];
const proposals = await planDocsReleases(lock, { releasesOf: releases, productReleasesOf: releases, tagSha, fileAt }, kinds);

// 1. Content bumps (Latest only) and docs fix releases.
const bumps = doBumps ? planBumps(lock, headOf) : [];
const fixes = doBumps ? proposals.filter((p) => p.type === 'fix') : [];
text = applyBumps(text, bumps);
for (const f of fixes) text = applyDocsRelease(text, f);

// 2. Promotions: a docs release the product has also released, then the legacy product-repo check.
const promotions = [];
for (const p of doPromotions ? proposals : []) {
  if (p.type === 'new') {
    text = applyDocsRelease(text, p);
    promotions.push({ section: p.section, from: null, to: p.version, tag: p.tag, docsReady: true, reason: null });
  } else if (p.type === 'missing-product-release') {
    promotions.push({ section: p.section, from: null, to: p.version, tag: p.tag, docsReady: false, reason: 'missing-product-release', product_repo: p.productRepo });  } else if (p.type === 'missing-version-folder') {
    promotions.push({ section: p.section, from: null, to: p.version, tag: p.tag, docsReady: false, reason: 'missing-version-folder', mkdocs: p.mkdocs });
  }
}

// Legacy: a newer GA release of a self-hosted distribution whose docs follow the version-in-path convention.
for (const product of doPromotions ? lock.products : []) {
  for (const section of product.sections) {
    if (section.versions || section.self_hosted?.versions) continue; // versioned sections promote through docs releases
    const sh = section.self_hosted;
    if (!sh?.product_repo || !sh.version) continue;
    const releases = (await github(`repos/${sh.product_repo}/releases?per_page=20`)) ?? [];
    const latest = releases.filter((r) => !r.prerelease && !r.draft).map((r) => r.tag_name.replace(/^v/, ''))
      .filter((v) => /^\d+(\.\d+)+$/.test(v)).sort(compareValues).at(-1);
    if (!latest || compareValues(latest, sh.version) <= 0) continue;
    const mkdocs = sh.mkdocs.replace(sh.version, latest);
    const docsReady = mkdocs !== sh.mkdocs && Boolean(await github(`repos/${sh.repo}/contents/${mkdocs}?ref=${sh.track}`));
    promotions.push({ section: section.id, from: sh.version, to: latest, mkdocs, docsReady, reason: docsReady ? null : 'missing-docs' });
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

const report = { bumps, fixes, promotions };
console.log(JSON.stringify(report, null, 2));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
if (write && (bumps.length || fixes.length || promotions.some((p) => p.docsReady))) fs.writeFileSync(LOCK, text);
