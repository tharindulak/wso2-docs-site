// docs-site/scripts/bump-lib.mjs
// Bump planning, kept free of network calls so it can be tested: callers pass headOf, releasesOf, productReleasesOf, tagSha.
import { compareValues } from '@wso2/docs-converter';
import { refsOf, repoOk } from './lib.mjs';
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
      if (head !== ref.sha && !bumps.some((b) => b.repo === ref.repo && b.track === ref.track && b.from === ref.sha)) {
        bumps.push({ repo: ref.repo, track: ref.track, from: ref.sha, to: head, compare: `https://github.com/${ref.repo}/compare/${ref.sha}...${head}` });
      }
    }
  }
  return bumps;
}

/**
 * Apply bumps to the lock-file text. Only a sha in a mapping that tracks the bump's branch changes: one with
 * `track: <branch>` (a section, cloud or companion block) or `track: true` with `ref: <branch>` (Latest's version
 * entry). Older versions often pin the same commit (folders on one branch) and must stay pinned.
 */
export function applyBumps(text, bumps) {
  const lines = text.split('\n');
  for (const b of bumps) {
    for (let i = 0; i < lines.length; i++) {
      const m = /^( *)(- )?sha: ([0-9a-f]{40})\s*$/.exec(lines[i]);
      if (!m || m[3] !== b.from) continue;
      const col = m[1].length + (m[2] ? 2 : 0);
      const siblings = mappingKeys(lines, i, col, Boolean(m[2]));
      const tracks = siblings.track === b.track || (siblings.track === 'true' && siblings.ref === b.track);
      if (tracks) lines[i] = lines[i].replace(b.from, b.to);
    }
  }
  return lines.join('\n');
}

/** Scalar keys of the YAML block mapping that contains line i, whose keys sit at column col. */
function mappingKeys(lines, i, col, startsItem) {
  const keys = {};
  const indent = (l) => l.length - l.trimStart().length;
  const take = (l) => { const k = /^ *(?:- )?([A-Za-z_]+):[ \t]*(.*?)\s*(?:#.*)?$/.exec(l); if (k && !(k[1] in keys)) keys[k[1]] = k[2]; };
  const own = (l) => l.trim() && indent(l) === col && !l.trimStart().startsWith('- ');
  // Upwards to the item start (a "- key:" line whose key sits at col) or a less-indented line.
  let start = i;
  if (!startsItem) {
    for (let j = i - 1; j >= 0; j--) {
      const l = lines[j];
      if (!l.trim() || l.trimStart().startsWith('#')) continue;
      if (indent(l) > col || (indent(l) === col && l.trimStart().startsWith('- '))) continue; // nested value
      if (own(l)) { start = j; continue; }
      if (indent(l) === col - 2 && l.trimStart().startsWith('- ')) start = j;
      break;
    }
  }
  take(lines[start]);
  for (let j = start + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim() || l.trimStart().startsWith('#')) continue;
    if (indent(l) > col || (indent(l) === col && l.trimStart().startsWith('- '))) continue; // nested value
    if (!own(l)) break;
    take(l);
  }
  return keys;
}

const ga = (releases) => releases.filter((r) => !r.draft && !r.prerelease).map((r) => r.tag_name);

const REL = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]+$/;

/** The mkdocs.yml of a version, for sections whose versions live in per-version folders ({version} in the pattern). */
export function versionFolder(section, version) {
  const pattern = section.version_folder ?? section.self_hosted?.version_folder;
  if (!pattern) return null;
  const rel = pattern.replaceAll('{version}', version);
  if (!pattern.includes('{version}') || !REL.test(rel)) throw new Error(`${section.id}: version_folder must be a relative path with {version}, got ${pattern}`);
  return rel;
}

/**
 * Docs releases: a fourth segment fixes a listed version; a newer version needs the product's own GA release and,
 * for sections with per-version folders, its folder at the tag. `kinds` limits planning (and network calls) to
 * 'fix' and/or 'new'. A tracking Latest follows its branch and takes no fix releases (they could move it backwards).
 */
export async function planDocsReleases(lock, { releasesOf, productReleasesOf, tagSha, fileAt }, kinds = ['fix', 'new']) {
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
    for (const v of kinds.includes('fix') ? list : []) {
      if (v.track) continue;
      const current = v.ref.startsWith(`${prefix}${v.version}`) ? Number(v.ref.slice(`${prefix}${v.version}`.length + 1) || 0) : -1;
      const best = tags.filter((t) => t.base === v.version && t.fix > current).sort((a, b) => b.fix - a.fix)[0];
      if (best && (current >= 0 || best.fix > 0)) proposals.push({ type: 'fix', section: section.id, version: v.version, base: v.version, tag: best.tag, sha: await tagSha(repo, best.tag) });
    }
    if (!kinds.includes('new')) continue;
    if (productRepo && !repoOk(productRepo)) throw new Error(`${section.id}: product_repo must be wso2/<name>, got ${productRepo}`);
    const productTags = productRepo ? new Set(ga(await productReleasesOf(productRepo)).map((t) => t.replace(/^v/, ''))) : new Set();
    const newer = [...new Set(tags.filter((t) => compareValues(t.base, latest) > 0).map((t) => t.base))].sort(compareValues);
    for (const base of newer) {
      const tag = tags.filter((t) => t.base === base).sort((a, b) => b.fix - a.fix)[0].tag;
      if (!productTags.has(base)) {
        proposals.push({ type: 'missing-product-release', section: section.id, version: base, base, tag, productRepo: productRepo ?? null });
        continue;
      }
      const mkdocs = versionFolder(section, base);
      if (mkdocs && !(await fileAt(repo, tag, mkdocs))) {
        proposals.push({ type: 'missing-version-folder', section: section.id, version: base, base, tag, mkdocs });
        continue;
      }
      proposals.push({ type: 'new', section: section.id, version: base, base, tag, sha: await tagSha(repo, tag), ...(mkdocs ? { mkdocs } : {}) });
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
    // A release ref is pinned, never followed: drop track from the fixed version.
    return head + body.replace(re, `$1${p.tag}$3${p.sha}`).replace(new RegExp(`(ref: ${p.tag.replace(/[.]/g, '\\.')}\\n *sha: [0-9a-f]{40})\\n *track: \\S+`), '$1');
  }
  if (p.type === 'new') {
    const m = /\n( *)versions:\n( *)- version: /.exec(body);
    if (!m) throw new Error(`${p.section}: versions list not found`);
    const item = m[2];
    const key = `${item}  `;
    body = body.replace(new RegExp(`\\n${key}track: true`), ''); // only Latest tracks, and a release is not followed
    if (p.mkdocs && !REL.test(p.mkdocs)) throw new Error(`${p.section}: unsafe mkdocs path ${p.mkdocs}`);
    const folder = p.mkdocs ? `${key}mkdocs: ${p.mkdocs}\n` : '';
    const entry = `${item}- version: ${p.version}\n${key}ref: ${p.tag}\n${key}sha: ${p.sha}\n${folder}${key}exclude: []\n`;
    return head + body.replace(`\n${m[1]}versions:\n`, `\n${m[1]}versions:\n${entry}`);
  }
  throw new Error(`${p.type} proposals do not change the lock file`);
}
