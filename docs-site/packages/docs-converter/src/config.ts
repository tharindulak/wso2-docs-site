// `wso2-docs.yaml`: what a content repo tells the converter. Same field names as a docs site lock-file section,
// without the repo and commit (the CLI runs inside the repo).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { DeploymentOption } from './types.js';

export interface SourceConfig {
  kind: 'mkdocs' | 'mkdocs-merge' | 'docusaurus';
  /** Route of the section on the docs site (for absolute links); default "docs". */
  route: string;
  deployment_options: DeploymentOption[];
  deployment_overrides?: Record<string, DeploymentOption[]>;
  /** mkdocs */
  mkdocs?: string;
  only?: string;
  skip?: string[];
  nav_root?: string;
  nav_drop?: string[];
  nav_pick?: Record<string, string | number>;
  current_site?: string;
  /** mkdocs-merge */
  cloud?: { mkdocs: string; current_site?: string };
  self_hosted?: { mkdocs: string; current_site?: string };
  shared_names?: Record<string, string>;
  /** docusaurus */
  docs?: string;
  sidebar?: string;
  shims?: Record<string, string>;
  /** Known failing pages: a list, or a file with one docs-relative path per line. */
  exclude?: string[] | string;
  /** Prefix for "Edit this page" links, for example https://github.com/wso2/docs-is/blob/master/ */
  edit_url?: string;
  iframe_hosts?: string[];
}

export class ConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'ConfigError'; }
}

const REL = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/@-]+$/;
const ROUTE = /^[a-z0-9][a-z0-9/-]*$/;

function relPath(value: unknown, field: string): string {
  if (typeof value !== 'string' || !REL.test(value)) throw new ConfigError(`${field} must be a relative path inside the repository, got ${JSON.stringify(value)}`);
  return value;
}

/** Load and validate a config file. Paths must stay inside the repository. */
export function loadConfig(file: string, root: string): SourceConfig & { excludeList: string[] } {
  if (!fs.existsSync(file)) throw new ConfigError(`Config file not found: ${file}`);
  const raw = yaml.load(fs.readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA }) as Partial<SourceConfig> | null;
  if (!raw || typeof raw !== 'object') throw new ConfigError(`${file} is empty or not a mapping`);
  const kind = raw.kind;
  if (kind !== 'mkdocs' && kind !== 'mkdocs-merge' && kind !== 'docusaurus') throw new ConfigError('kind must be mkdocs, mkdocs-merge or docusaurus');
  const route = raw.route ?? 'docs';
  if (!ROUTE.test(route)) throw new ConfigError(`route must be lowercase letters, digits, - and /, got ${JSON.stringify(route)}`);
  if (!Array.isArray(raw.deployment_options) && kind !== 'mkdocs-merge') throw new ConfigError('deployment_options must list the deployment options of the pages');
  if (kind === 'mkdocs') relPath(raw.mkdocs, 'mkdocs');
  if (kind === 'mkdocs-merge') { relPath(raw.cloud?.mkdocs, 'cloud.mkdocs'); relPath(raw.self_hosted?.mkdocs, 'self_hosted.mkdocs'); }
  if (kind === 'docusaurus') { relPath(raw.docs, 'docs'); relPath(raw.sidebar, 'sidebar'); }
  for (const s of raw.skip ?? []) relPath(s, 'skip');
  if (raw.only) relPath(raw.only, 'only');
  let excludeList: string[] = [];
  if (Array.isArray(raw.exclude)) excludeList = raw.exclude.map(String);
  else if (typeof raw.exclude === 'string') {
    const f = path.join(root, relPath(raw.exclude, 'exclude'));
    excludeList = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
  }
  return { ...(raw as SourceConfig), kind, route, deployment_options: raw.deployment_options ?? [], excludeList };
}
