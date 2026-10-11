// Lock-file version model: every section, old shape (sha at section level) or new (versions: list), becomes a list
// of version sources, newest first. A version source looks like a section, so the pipeline converts it unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { compareValues, splitFrontMatter, walk, mkdocsUrl } from '@wso2/docs-converter';

export const LIVE_WINDOW_DEFAULT = 2;
const VERSION = /^\d+\.\d+\.\d+$/;
const SHA = /^[0-9a-f]{40}$/;
const REF = /^[A-Za-z0-9._\/-]+$/;
const REL = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]+$/;
const REDIRECT = "from '@site/src/components/Redirect'";

export const versionId = (sectionId, version, isLatest) => (isLatest || !version ? sectionId : `${sectionId}--v${version.replace(/\./g, '-')}`);

/** The version list of a section: its own, or its self-hosted side's (merged sections). */
const listOf = (section) => section.versions ?? section.self_hosted?.versions ?? null;

/** release: ref is the docs-release tag of this version (with or without a fourth segment); folder: a path override. */
export function sourceKind(section, v) {
  const tag = `${section.release_tag ?? 'v'}${v.version}`;
  if (v.ref === tag || v.ref.startsWith(`${tag}.`)) return 'release';
  return v.mkdocs || v.docs || section.docs_root ? 'folder' : 'branch';
}

/** The release base a tag stands for: "v4.5.0.1" -> "4.5.0"; null when the ref is not a release tag. */
const releaseBase = (section, ref) => {
  const prefix = section.release_tag ?? 'v';
  if (!ref.startsWith(prefix)) return null;
  const m = ref.slice(prefix.length).match(/^(\d+\.\d+\.\d+)(\.\d+)?$/);
  return m ? m[1] : null;
};

/** mkdocs.yml of a version from the section's version_folder pattern (en/identity-server/{version}/mkdocs.yml), if any. */
export const folderOf = (section, version) => {
  const pattern = section.version_folder ?? section.self_hosted?.version_folder;
  return pattern ? pattern.replaceAll('{version}', version) : undefined;
};

export function sectionVersions(section, liveWindow = LIVE_WINDOW_DEFAULT) {
  const list = listOf(section);
  if (!list) {
    const version = section.self_hosted?.version ?? section.version ?? null;
    return [{ ...section, sectionId: section.id, version, status: 'latest', source: 'legacy', versionLabel: version ? `${version} (Latest)` : 'Latest' }];
  }
  return list.map((v, i) => {
    const latest = i === 0;
    const base = {
      sectionId: section.id, id: versionId(section.id, v.version, latest), version: v.version,
      status: latest ? 'latest' : i < liveWindow ? 'live' : 'snapshot', source: sourceKind(section, v),
      versionLabel: latest ? `${v.version} (Latest)` : v.version,
      route: latest ? section.route : `${section.route}/${v.version}`, former_site: section.former_site,
    };
    const pick = { sha: v.sha, track: v.track ? v.ref : null, ref: v.ref };
    const folder = folderOf(section, v.version);
    const overrides = Object.fromEntries(['mkdocs', 'docs', 'sidebar', 'sparse', 'nav_pick', 'skip', 'deployment_overrides']
      .filter((k) => v[k] !== undefined).map((k) => [k, v[k]]));
    if (folder && overrides.mkdocs === undefined) overrides.mkdocs = folder;
    // A component's version folder inside one MkDocs site: the folder is the section root, its former site the folder's URL.
    if (section.docs_root) {
      overrides.docs_root = section.docs_root.replaceAll('{version}', v.version);
      if (section.former_site) overrides.current_site = section.former_site.replaceAll('{version}', v.version);
    }
    const exclude = v.exclude ?? [];
    if (section.kind === 'mkdocs-merge') {
      const sh = section.self_hosted;
      if (latest) return { ...section, ...base, exclude, self_hosted: { ...sh, ...overrides, ...pick, version: v.version } };
      return {
        ...base, kind: 'mkdocs', label: section.label, repo: sh.repo, mkdocs: overrides.mkdocs, sparse: v.sparse ?? section.sparse, ...pick,
        exclude, deployment_options: ['Self-hosted'], current_site: (section.former_site ?? '').replace('{version}', v.version),
      };
    }
    if (latest) return { ...section, ...overrides, ...base, ...pick, exclude };
    const { cloud_companion: _c, deployment_overrides: _d, aliases: _a, ...rest } = section;
    return {
      ...rest, ...overrides, ...base, ...pick, exclude, deployment_options: ['Self-hosted'],
      deployment_overrides: overrides.deployment_overrides, current_site: (section.former_site ?? section.current_site ?? '').replace('{version}', v.version),
    };
  });
}

export const confluenceVersions = (section) => (section.older_versions && Array.isArray(section.older_versions) ? section.older_versions : []);

export function validateVersions(section, liveWindow) {
  const list = listOf(section);
  if (!list) return;
  const id = section.id;
  if (!Array.isArray(list) || !list.length) throw new Error(`${id}: versions must list at least one version`);
  for (const v of list) {
    if (!VERSION.test(String(v.version))) throw new Error(`${id}: version ${v.version} must be numeric (for example 4.6.0)`);
    if (!SHA.test(v.sha ?? '')) throw new Error(`${id} ${v.version}: sha must be a full 40-character commit`);
    if (!REF.test(v.ref ?? '')) throw new Error(`${id} ${v.version}: ref must name a branch or tag`);
    for (const rel of [v.mkdocs, v.docs, v.sidebar, ...(v.sparse ?? [])].filter(Boolean)) {
      if (!REL.test(rel)) throw new Error(`${id} ${v.version}: path must be relative and inside the repo: ${rel}`);
    }
    const folder = folderOf(section, String(v.version));
    if (folder !== undefined && (!REL.test(folder) || !(section.version_folder ?? section.self_hosted.version_folder).includes('{version}'))) {
      throw new Error(`${id}: version_folder must be a relative path inside the repo with {version}`);
    }
    if (section.kind === 'mkdocs-merge' && !v.mkdocs && !folder && !(v === list[0] && section.self_hosted.mkdocs)) {
      throw new Error(`${id} ${v.version}: mkdocs is required (or set self_hosted.version_folder)`);
    }
    const base = releaseBase(section, v.ref);
    if (base && base !== v.version) throw new Error(`${id}: ref ${v.ref} is a release of another version than ${v.version}`);
  }
  for (let i = 1; i < list.length; i++) {
    if (compareValues(list[i - 1].version, list[i].version) <= 0) throw new Error(`${id}: versions must be newest first, without duplicates`);
  }
  const tracked = list.slice(1).find((v) => v.track);
  if (tracked) throw new Error(`${id}: only Latest (${list[0].version}) may track a branch; ${tracked.version} is pinned`);
  for (const o of confluenceVersions(section)) {
    if (!/^https:\/\/[^\s]+$/.test(o.href ?? '')) throw new Error(`${id}: older version ${o.version} href must be https`);
  }
  if (section.former_site && !section.former_site.includes('{version}')) throw new Error(`${id}: former_site must contain {version}`);
  if (section.docs_root !== undefined && (!REL.test(section.docs_root.replace('{version}', 'v')) || !section.docs_root.endsWith('/') || section.docs_root.split('/').filter((p) => p === '{version}').length !== 1)) {
    throw new Error(`${id}: docs_root must be a relative folder (ending in /) with one {version} segment`);
  }
  if (!Number.isInteger(liveWindow) || liveWindow < 1 || liveWindow > 3) throw new Error(`live_window must be 1, 2 or 3`);
}

/** Replace one version entry's exclude list in the lock-file text, keeping everything else as written. */
export function replaceExclude(text, sectionId, version, list) {
  const start = text.indexOf(`- id: ${sectionId}\n`);
  if (start < 0) throw new Error(`Section ${sectionId} not found in the lock file`);
  const entry = new RegExp(`\\n( *)- version: ${version.replace(/\./g, '\\.')}\\n`).exec(text.slice(start));
  if (!entry) throw new Error(`${sectionId}: version ${version} not found in the lock file`);
  const at = start + entry.index + entry[0].length;
  const keyIndent = ' '.repeat(entry[1].length + 2);
  const itemIndent = ' '.repeat(entry[1].length + 4);
  const rest = text.slice(at);
  const end = rest.search(new RegExp(`\\n {0,${entry[1].length}}\\S`));
  const body = end < 0 ? rest : rest.slice(0, end + 1);
  const replaced = body.replace(new RegExp(`(^|\\n)${keyIndent}exclude:[ \\t]*(?:\\[\\]|(?:\\n${itemIndent}- .*)+)`),
    `$1${keyIndent}exclude:${list.length ? `\n${list.map((p) => `${itemIndent}- ${p}`).join('\n')}` : ' []'}`);
  return text.slice(0, at) + replaced + rest.slice(body.length);
}

/** URL paths of the real pages in a generated docs folder, relative to the version base ("" is the home page). */
export function pagePaths(docsDir) {
  const out = new Set();
  for (const rel of walk(docsDir, (r) => r.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(docsDir, rel), 'utf8');
    if (text.includes(REDIRECT)) continue;
    const slug = splitFrontMatter(text).data.slug;
    const p = typeof slug === 'string' ? slug.replace(/^\//, '') : rel.replace(/\\/g, '/').replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '/');
    out.add(p.replace(/^\/$/, ''));
  }
  return [...out].sort();
}

/**
 * Where a page of a shared MkDocs source lives on this site, for links between sections reading that source (API
 * Platform: each component's version folders are a section, docs_root; the rest is the platform section and API
 * Manager's cloud companion). A component folder maps to that version's route (Latest without a version segment; a
 * version not in the lock to the section root); `next/` folders are not published and stay as written. Other pages
 * map to the section or companion whose only/skip takes them. Null when no section reads a docs_root from the source.
 */
export function outsideLinks(lock, src) {
  const same = (x) => x && x.repo === src.repo && x.mkdocs === src.mkdocs;
  const sections = lock.products.flatMap((p) => p.sections);
  const components = sections.filter((s) => s.docs_root && same(s));
  if (!components.length) return null;
  const hosts = [
    ...sections.filter((s) => !s.docs_root && s.kind === 'mkdocs' && same(s)).map((s) => ({ only: s.only, skip: s.skip ?? [], route: s.route })),
    ...sections.filter((s) => same(s.cloud_companion)).map((s) => ({
      only: s.cloud_companion.only, skip: s.cloud_companion.skip ?? [], route: s.cloud_companion.path_prefix ? `${s.route}/${s.cloud_companion.path_prefix}` : s.route,
    })),
  ];
  const url = (route, page) => `/${route}/${mkdocsUrl(/\.md$/.test(page) || page === '' ? page : `${page.replace(/\/$/, '')}/index.md`)}`;
  return (docsPath) => {
    for (const s of components) {
      const [head, tail] = s.docs_root.split('{version}');
      if (!docsPath.startsWith(head)) continue;
      const rest = docsPath.slice(head.length);
      const at = rest.indexOf(tail);
      if (at <= 0) continue;
      const version = rest.slice(0, at);
      if (version === 'next') return null;
      const i = s.versions.findIndex((v) => String(v.version) === version);
      return i < 0 ? `/${s.route}/` : url(i === 0 ? s.route : `${s.route}/${version}`, rest.slice(at + tail.length));
    }
    const page = /\.md$/.test(docsPath) ? docsPath : `${docsPath.replace(/\/$/, '')}/index.md`;
    const host = hosts.find((h) => (!h.only || page.startsWith(h.only)) && !h.skip.some((p) => page.startsWith(p)));
    return host ? url(host.route, docsPath) : null;
  };
}
