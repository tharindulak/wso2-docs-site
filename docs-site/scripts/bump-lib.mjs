// docs-site/scripts/bump-lib.mjs
// Bump planning, kept free of network calls so it can be tested: callers pass headOf, releasesOf, productReleasesOf, tagSha.
import { compareValues } from '@wso2/docs-converter';
import { refsOf } from './lib.mjs';
import { sectionVersions } from './versions.mjs';

export function planBumps(lock, headOf) {
  const heads = new Map();
  const bumps = [];
  for (const product of lock.products) for (const section of product.sections) for (const v of sectionVersions(section, lock.live_window ?? 2)) {
    for (const ref of refsOf(v)) {
      if (!ref.track) continue; // pinned (older versions, release refs)
      const key = `${ref.repo}#${ref.track}`;
      if (!heads.has(key)) heads.set(key, headOf(ref.repo, ref.track));
      const head = heads.get(key);
      if (head !== ref.sha && !bumps.some((b) => b.repo === ref.repo && b.from === ref.sha)) {
        bumps.push({ repo: ref.repo, track: ref.track, from: ref.sha, to: head, compare: `https://github.com/${ref.repo}/compare/${ref.sha}...${head}` });
      }
    }
  }
  return bumps;
}

export const applyBumps = (text, bumps) => bumps.reduce((t, b) => t.replaceAll(`sha: ${b.from}`, `sha: ${b.to}`), text);

const ga = (releases) => releases.filter((r) => !r.draft && !r.prerelease).map((r) => r.tag_name);

/** Docs releases: a fourth segment fixes a listed version; a newer version needs the product's own GA release. */
export async function planDocsReleases(lock, { releasesOf, productReleasesOf, tagSha }) {
  const proposals = [];
  for (const product of lock.products) for (const section of product.sections) {
    const list = section.versions ?? section.self_hosted?.versions;
    if (!list) continue;
    const repo = section.repo ?? section.self_hosted.repo;
    const productRepo = section.product_repo ?? section.self_hosted?.product_repo;
    const prefix = section.release_tag ?? 'v';
    const tags = ga(await releasesOf(repo)).filter((t) => t.startsWith(prefix))
      .map((t) => ({ tag: t, m: t.slice(prefix.length).match(/^(\d+\.\d+\.\d+)(?:\.(\d+))?$/) })).filter((x) => x.m)
      .map(({ tag, m }) => ({ tag, base: m[1], fix: Number(m[2] ?? 0) }));
    const latest = list[0].version;
    for (const v of list) {
      const current = v.ref.startsWith(`${prefix}${v.version}`) ? Number(v.ref.slice(`${prefix}${v.version}`.length + 1) || 0) : -1;
      const best = tags.filter((t) => t.base === v.version && t.fix > current).sort((a, b) => b.fix - a.fix)[0];
      if (best && (current >= 0 || best.fix > 0)) proposals.push({ type: 'fix', section: section.id, version: v.version, base: v.version, tag: best.tag, sha: await tagSha(repo, best.tag) });
    }
    const productTags = productRepo ? new Set(ga(await productReleasesOf(productRepo)).map((t) => t.replace(/^v/, ''))) : new Set();
    const newer = [...new Set(tags.filter((t) => compareValues(t.base, latest) > 0).map((t) => t.base))].sort(compareValues);
    for (const base of newer) {
      const tag = tags.filter((t) => t.base === base).sort((a, b) => b.fix - a.fix)[0].tag;
      if (productTags.has(base)) proposals.push({ type: 'new', section: section.id, version: base, base, tag, sha: await tagSha(repo, tag) });
      else proposals.push({ type: 'missing-product-release', section: section.id, version: base, base, tag });
    }
  }
  return proposals;
}

/** Edit the lock-file text for one proposal, keeping the hand-written layout. */
export function applyDocsRelease(text, p) {
  const start = text.indexOf(`- id: ${p.section}\n`);
  if (start < 0) throw new Error(`Section ${p.section} not found in the lock file`);
  const head = text.slice(0, start);
  let body = text.slice(start);
  if (p.type === 'fix') {
    const re = new RegExp(`(\\n( *)- version: ${p.version.replace(/\./g, '\\.')}\\n\\2  ref: )\\S+(\\n\\2  sha: )[0-9a-f]{40}`);
    if (!re.test(body)) throw new Error(`${p.section}: version ${p.version} not found`);
    return head + body.replace(re, `$1${p.tag}$3${p.sha}`);
  }
  if (p.type === 'new') {
    const m = /\n( *)versions:\n( *)- version: /.exec(body);
    if (!m) throw new Error(`${p.section}: versions list not found`);
    const item = m[2];
    const key = `${item}  `;
    body = body.replace(new RegExp(`\\n${key}track: true`), ''); // only Latest tracks, and a release is not followed
    const entry = `${item}- version: ${p.version}\n${key}ref: ${p.tag}\n${key}sha: ${p.sha}\n${key}exclude: []\n`;
    return head + body.replace(`\n${m[1]}versions:\n`, `\n${m[1]}versions:\n${entry}`);
  }
  throw new Error(`${p.type} proposals do not change the lock file`);
}
