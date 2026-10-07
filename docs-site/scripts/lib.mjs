// Shared helpers for the content pipeline scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = path.join(ROOT, '.cache', 'sources');
export const GENERATED = path.join(ROOT, 'generated');
export const LOCK = path.join(ROOT, 'content-sources.yaml');

const REPO = /^wso2\/[A-Za-z0-9._-]+$/;
const SHA = /^[0-9a-f]{40}$/;
const REL = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]+$/;

/** Load and validate the lock file. Anything unexpected stops the pipeline. */
export function readLock() {
  const lock = yaml.load(fs.readFileSync(LOCK, 'utf8'), { schema: yaml.JSON_SCHEMA });
  for (const p of lock.products) {
    for (const s of p.sections) {
      for (const ref of refsOf(s)) {
        if (!REPO.test(ref.repo)) throw new Error(`${s.id}: repo must be wso2/<name>, got ${ref.repo}`);
        if (!SHA.test(ref.sha)) throw new Error(`${s.id}: sha must be a full 40-character commit, got ${ref.sha}`);
      }
      for (const rel of [...(s.sparse ?? []), s.mkdocs, s.docs, s.sidebar, s.cloud?.mkdocs, s.self_hosted?.mkdocs].filter(Boolean)) {
        if (!REL.test(rel)) throw new Error(`${s.id}: path must be relative and inside the repo: ${rel}`);
      }
      if (!/^[a-z0-9/-]+$/.test(s.route)) throw new Error(`${s.id}: invalid route ${s.route}`);
    }
  }
  return lock;
}

/** The repo@sha references a section reads. */
export function refsOf(section) {
  if (section.kind === 'mkdocs-merge') return [section.cloud, section.self_hosted];
  return [{ repo: section.repo, sha: section.sha }];
}

export const checkoutDir = (repo, sha) => path.join(CACHE, `${repo.replace('/', '__')}@${sha.slice(0, 12)}`);
