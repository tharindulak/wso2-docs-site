// The docs manifest: the `section` and `nav` parts of `wso2-docs.yaml`. `section` names what a docs bundle releases;
// `nav` is the section's side navigation, plain data (no sidebar code runs). Pages are repo-relative paths.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { ConfigError } from './config.js';
import type { SidebarInput } from './types.js';

export interface NavPage { page: string; label?: string }
export interface NavCategory { category: string; collapsed?: boolean; overview?: string; items: NavItem[] }
export interface NavLink { link: string; label: string }
export type NavItem = NavPage | NavCategory | NavLink;

export interface ManifestSection {
  /** Section id in the docs site's lock file. */
  id: string;
  /** Shown in release titles; defaults to the id. */
  label?: string;
  /** Three-segment version, or `latest` for sections with no versions (released from `release/latest`). */
  version: string;
  /** Docs release tag prefix: `v`, or `<component>/v` with one path segment. */
  release_tag: string;
  /** Repo-relative folders a bundle may also carry, besides the section's own folder. */
  include?: string[];
  /** Added by `wso2-docs bundle`: the commit the bundle was packed from. */
  source_commit?: string;
}

const REL = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/@ -]+$/;
const ID = /^[a-z0-9][a-z0-9-]*$/;
const VERSION = /^(?:\d+\.\d+\.\d+|latest)$/;
const TAG_PREFIX = /^(?:[a-z0-9][a-z0-9-]*\/)?v$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function relPath(value: unknown, field: string): string {
  if (typeof value !== 'string' || !REL.test(value) || value.includes('//')) throw new ConfigError(`${field} must be a relative path inside the repository, got ${JSON.stringify(value)}`);
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new ConfigError(`${field} must be non-empty text of at most 200 characters`);
  return value;
}

function onlyKeys(raw: Record<string, unknown>, keys: string[], field: string): void {
  const extra = Object.keys(raw).filter((k) => !keys.includes(k));
  if (extra.length) throw new ConfigError(`${field} has unknown keys: ${extra.join(', ')}`);
}

function navItem(raw: unknown, field: string): NavItem {
  if (!isObject(raw)) throw new ConfigError(`${field} must be a page, category or link entry`);
  if ('page' in raw) {
    onlyKeys(raw, ['page', 'label'], field);
    return { page: relPath(raw.page, `${field}.page`), ...(raw.label !== undefined ? { label: text(raw.label, `${field}.label`) } : {}) };
  }
  if ('category' in raw) {
    onlyKeys(raw, ['category', 'collapsed', 'overview', 'items'], field);
    if (raw.collapsed !== undefined && typeof raw.collapsed !== 'boolean') throw new ConfigError(`${field}.collapsed must be true or false`);
    if (!Array.isArray(raw.items)) throw new ConfigError(`${field}.items must be a list`);
    return {
      category: text(raw.category, `${field}.category`),
      ...(raw.collapsed !== undefined ? { collapsed: raw.collapsed } : {}),
      ...(raw.overview !== undefined ? { overview: relPath(raw.overview, `${field}.overview`) } : {}),
      items: raw.items.map((it, i) => navItem(it, `${field}.items[${i}]`)),
    };
  }
  if ('link' in raw) {
    onlyKeys(raw, ['link', 'label'], field);
    if (typeof raw.link !== 'string' || !/^https:\/\/[^\s]+$/.test(raw.link)) throw new ConfigError(`${field}.link must be an https URL`);
    return { link: raw.link, label: text(raw.label, `${field}.label`) };
  }
  throw new ConfigError(`${field} must have page, category or link`);
}

/** Validate a manifest's `nav`. Throws ConfigError naming the first bad entry. */
export function parseNav(raw: unknown): NavItem[] {
  if (!Array.isArray(raw)) throw new ConfigError('nav must be a list of page, category and link entries');
  return raw.map((it, i) => navItem(it, `nav[${i}]`));
}

/** Validate a manifest's `section`. */
export function parseSection(raw: unknown): ManifestSection {
  if (!isObject(raw)) throw new ConfigError('section must be a mapping with id, version and release_tag');
  onlyKeys(raw, ['id', 'label', 'version', 'release_tag', 'include', 'source_commit'], 'section');
  if (typeof raw.id !== 'string' || !ID.test(raw.id)) throw new ConfigError(`section.id must be a lowercase section id, got ${JSON.stringify(raw.id)}`);
  const version = String(raw.version ?? '');
  if (!VERSION.test(version)) throw new ConfigError(`section.version must be x.y.z or latest, got ${JSON.stringify(raw.version)}`);
  if (typeof raw.release_tag !== 'string' || !TAG_PREFIX.test(raw.release_tag)) throw new ConfigError(`section.release_tag must be v or <component>/v, got ${JSON.stringify(raw.release_tag)}`);
  if (raw.include !== undefined && !Array.isArray(raw.include)) throw new ConfigError('section.include must be a list of folders');
  if (raw.source_commit !== undefined && !/^[0-9a-f]{40}$/.test(String(raw.source_commit))) throw new ConfigError('section.source_commit must be a 40-character commit');
  return {
    id: raw.id,
    ...(raw.label !== undefined ? { label: text(raw.label, 'section.label') } : {}),
    version,
    release_tag: raw.release_tag,
    ...(raw.include !== undefined ? { include: (raw.include as unknown[]).map((f, i) => relPath(f, `section.include[${i}]`)) } : {}),
    ...(raw.source_commit !== undefined ? { source_commit: String(raw.source_commit) } : {}),
  };
}

const PAGE = /\.mdx?$/;

/** Docusaurus doc id of a page under the docs folder: its path without extension, last segment replaced by a front matter id. */
function docIdOf(root: string, docs: string, page: string): string | null {
  const prefix = docs.replace(/\/$/, '') + '/';
  if (!page.startsWith(prefix) || !PAGE.test(page)) return null;
  const file = path.join(root, page);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const rel = page.slice(prefix.length).replace(PAGE, '');
  const fm = fs.readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let id: unknown;
  try { id = fm ? (yaml.load(fm[1]!, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown> | null)?.id : undefined; } catch { id = undefined; }
  if (typeof id === 'string' && /^[A-Za-z0-9._-]+$/.test(id)) return path.posix.join(path.posix.dirname(rel), id).replace(/^\.\//, '');
  return rel;
}

/** Navigation to Docusaurus sidebar items. Pages that do not exist under the docs folder are left out and listed. */
export function navToSidebar(nav: NavItem[], root: string, docs: string): { items: SidebarInput[]; missing: string[] } {
  const missing: string[] = [];
  const doc = (page: string): string | null => { const id = docIdOf(root, docs, page); if (!id) missing.push(page); return id; };
  const conv = (items: NavItem[]): SidebarInput[] => items.flatMap((it): SidebarInput[] => {
    if ('page' in it) { const id = doc(it.page); return id ? [{ type: 'doc', id, ...(it.label ? { label: it.label } : {}) }] : []; }
    if ('link' in it) return [{ type: 'link', href: it.link, label: it.label }];
    const overview = it.overview ? doc(it.overview) : null;
    return [{
      type: 'category', label: it.category,
      ...(it.collapsed !== undefined ? { collapsed: it.collapsed } : {}),
      ...(overview ? { link: { type: 'doc', id: overview } } : {}),
      items: conv(it.items),
    }];
  });
  return { items: conv(nav), missing };
}

/** A Docusaurus sidebar (from sidebars.json) to a navigation, for `manifest init`. Unsupported items are listed. */
export function sidebarToNav(items: SidebarInput[], root: string, docs: string): { nav: NavItem[]; problems: string[] } {
  const problems: string[] = [];
  const byId = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (PAGE.test(e.name)) { const id = docIdOf(root, docs, rel); if (id && !byId.has(id)) byId.set(id, rel); }
    }
  };
  walk(docs.replace(/\/$/, ''));
  const page = (id: string): string | null => { const p = byId.get(id); if (!p) problems.push(`no page for doc id ${id}`); return p ?? null; };
  const conv = (list: SidebarInput[]): NavItem[] => list.flatMap((raw): NavItem[] => {
    const it = (typeof raw === 'string' ? { type: 'doc', id: raw } : raw) as Record<string, unknown>;
    const label = typeof it.label === 'string' ? it.label : undefined;
    if (it.type === 'doc' || it.type === 'ref') { const p = page(String(it.id)); return p ? [{ page: p, ...(label ? { label } : {}) }] : []; }
    if (it.type === 'link') return [{ link: String(it.href), label: label ?? String(it.href) }];
    if (it.type === 'category') {
      const link = it.link as Record<string, unknown> | undefined;
      const overview = link?.type === 'doc' ? page(String(link.id)) : null;
      if (link && link.type !== 'doc') problems.push(`category ${label} links to a ${String(link.type)}, not a page`);
      return [{
        category: label ?? 'Untitled',
        ...(typeof it.collapsed === 'boolean' ? { collapsed: it.collapsed } : {}),
        ...(overview ? { overview } : {}),
        items: conv((it.items as SidebarInput[] | undefined) ?? []),
      }];
    }
    problems.push(`${String(it.type)} items are not supported${it.dirName ? ` (dirName ${String(it.dirName)})` : ''}`);
    return [];
  });
  return { nav: conv(items), problems };
}
