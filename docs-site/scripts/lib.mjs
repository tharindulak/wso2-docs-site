// Shared helpers for the content pipeline scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { sectionVersions, validateVersions, LIVE_WINDOW_DEFAULT } from './versions.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = path.join(ROOT, '.cache', 'sources');
export const GENERATED = path.join(ROOT, 'generated');
export const LOCK = process.env.DOCS_SITE_LOCK ? path.resolve(process.env.DOCS_SITE_LOCK) : path.join(ROOT, 'content-sources.yaml');

// A fork owner (DOCS_SITE_TEST_OWNER, comma-separated) is honoured in local runs and in CI outside the wso2 organization, so
// a test copy of this repository can build from content forks (a repository variable there). A wso2 repository accepts
// wso2 sources only, whatever the variable says.
export function owners(env = process.env) {
  const inWso2 = (env.GITHUB_REPOSITORY_OWNER ?? '').toLowerCase() === 'wso2';
  return ['wso2', ...(inWso2 ? [] : (env.DOCS_SITE_TEST_OWNER ?? '').split(',').filter((o) => /^[A-Za-z0-9-]+$/.test(o)))];
}
const OWNERS = owners();
export const repoOk = (repo) => { const [owner, name, extra] = String(repo).split('/'); return extra === undefined && OWNERS.includes(owner) && /^(?!\.{1,2}$)[A-Za-z0-9._-]+$/.test(name ?? ''); };
const SHA = /^[0-9a-f]{40}$/;
const BRANCH = /^[A-Za-z0-9._\/-]+$/;
const REL = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]+$/;

/** Load and validate the lock file. Anything unexpected stops the pipeline. */
export function readLock() {
  const lock = yaml.load(fs.readFileSync(LOCK, 'utf8'), { schema: yaml.JSON_SCHEMA });
  for (const p of lock.products) {
    for (const s of p.sections) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) throw new Error(`Section id must be lowercase letters, digits and hyphens, got ${s.id}`);
      validateVersions(s, lock.live_window ?? LIVE_WINDOW_DEFAULT);
      for (const v of sectionVersions(s, lock.live_window ?? LIVE_WINDOW_DEFAULT)) for (const ref of refsOf(v)) {
        if (!repoOk(ref.repo)) throw new Error(`${s.id}: repo must be wso2/<name>, got ${ref.repo}`);
        if (!SHA.test(ref.sha)) throw new Error(`${s.id}: sha must be a full 40-character commit, got ${ref.sha}`);
        if (ref.track !== null && !BRANCH.test(ref.track ?? '')) throw new Error(`${s.id}: track must name the branch the bump bot follows`);
      }
      for (const e of [s.edit, s.cloud_companion?.edit].filter(Boolean)) {
        if (!repoOk(e.repo) || !BRANCH.test(e.branch ?? '')) throw new Error(`${s.id}: edit must name a wso2/<name> repo and a branch`);
      }
      const pr = s.product_repo ?? s.self_hosted?.product_repo;
      if (pr && !repoOk(pr)) throw new Error(`${s.id}: product_repo must be wso2/<name>, got ${pr}`);
      for (const rel of [...(s.sparse ?? []), ...(s.cloud_companion?.sparse ?? []), s.mkdocs, s.docs, s.sidebar, s.cloud?.mkdocs, s.self_hosted?.mkdocs, s.cloud_companion?.mkdocs, s.cloud_companion?.path_prefix, s.tree_root, s.tree_static, s.tree_redirects].filter(Boolean)) {
        if (!REL.test(rel)) throw new Error(`${s.id}: path must be relative and inside the repo: ${rel}`);
      }
      if (!/^[a-z0-9/-]+$/.test(s.route)) throw new Error(`${s.id}: invalid route ${s.route}`);
      if (s.former_route !== undefined && (!/^[a-z0-9][a-z0-9./-]*$/.test(s.former_route) || s.former_route.split('/').some((p) => p === '..' || p === '.'))) {
        throw new Error(`${s.id}: invalid former_route ${s.former_route}`);
      }
    }
  }
  const ids = new Set(['account', ...lock.products.map((p) => p.id)]); // account: the Account and billing hub (site/account)
  for (const id of lock.hide_from_navigation ?? []) if (!ids.has(id)) throw new Error(`hide_from_navigation: no product ${id}`);
  return lock;
}

/** Versions kept live (built from source on every build). */
export const liveWindow = (lock) => lock.live_window ?? LIVE_WINDOW_DEFAULT;

/** The repo@sha references a section reads. */
export function refsOf(section) {
  if (section.kind === 'mkdocs-merge') return [section.cloud, section.self_hosted];
  const own = { repo: section.repo, sha: section.sha, track: section.track };
  return section.cloud_companion ? [own, section.cloud_companion] : [own];
}

export const checkoutDir = (repo, sha) => path.join(CACHE, `${repo.replace('/', '__')}@${sha.slice(0, 12)}`);
