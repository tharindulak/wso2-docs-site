// The Deprecations index of one docs version (planning ticket "How deprecation notices and the Deprecations page
// look"): pages marked deprecated in front matter (flat or per deployment option), section notices (the `deprecated`
// admonition type, or a warning titled "Deprecated …"), and the entries of a hand-kept `deprecations.yml` (deprecations
// without a page). build-content.mjs writes the index per version into generated/ with a page that renders it
// (deprecationsPage) and a sidebar entry (withDeprecationsEntry). Replacements are resolved here to the target page's
// URL and title; one naming no page is dropped and reported.
import yaml from 'js-yaml';
import { splitFrontMatter } from './page.js';
import { deprecationOf, isDeprecatedAdmonition, replacementDocId, replacementTitle } from './lifecycle.js';
import { unsafeUrl } from './syntax.js';

/** A converted page of the version: its doc id, site URL and file text (front matter and MDX). */
export interface IndexPage { id: string; url: string; text: string }

/** One entry of the index; `options` holds per deployment option the since and removal values (option "" when none). */
export interface DeprecationEntry {
  kind: 'page' | 'section' | 'listed';
  title: string;
  /** The page (for a section, the page holding it); for a listed entry its link, or null. */
  url: string | null;
  /** For a section: the title of its page. */
  page?: string;
  options: { option: string; since?: string; removal?: string }[];
  /** Distinct replacements, resolved. */
  replacements: { url: string; title: string }[];
}

/** A `deprecations.yml` entry, checked; `replacement` and `link` as written. */
export interface ListedDeprecation { title: string; options: string[]; since: string; replacement?: string; removal?: string; link?: string }

const FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;
const OPEN = /^[ \t]*:::([A-Za-z]+)(?:\[(.*)\])?[ \t]*$/;
const APPLIES_OPEN = /^[ \t]*<Applies to="([^"]+)">[ \t]*$/;
const APPLIES_CLOSE = /^[ \t]*<\/Applies>[ \t]*$/;

/** The section deprecation notices of a page body, in order, with the option of an `<Applies>` block around each. */
export function deprecatedSections(body: string): { title: string; option?: string }[] {
  const out: { title: string; option?: string }[] = [];
  const applies: string[] = [];
  for (const line of body.replace(FENCE, '').split('\n')) {
    const open = line.match(APPLIES_OPEN);
    if (open) { applies.push(open[1]!); continue; }
    if (APPLIES_CLOSE.test(line)) { applies.pop(); continue; }
    const m = line.match(OPEN);
    if (!m || !isDeprecatedAdmonition(m[1]!, m[2])) continue;
    const option = applies[applies.length - 1];
    out.push({ title: m[2]?.trim() || 'Deprecated', ...(option ? { option } : {}) });
  }
  return out;
}

/** Sidebar categories above each doc id. */
function trails(items: unknown[], trail: string[] = [], out = new Map<string, string[]>()): Map<string, string[]> {
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const i = item as { type?: unknown; id?: unknown; label?: unknown; items?: unknown };
    if (i.type === 'doc' && typeof i.id === 'string' && !out.has(i.id)) out.set(i.id, trail);
    if (Array.isArray(i.items)) trails(i.items, typeof i.label === 'string' ? [...trail, i.label] : trail, out);
  }
  return out;
}

export interface IndexInput {
  pages: IndexPage[];
  /** The version's sidebar items, to tell apart pages with the same title. */
  sidebar?: unknown[];
  /** Entries of the version's deprecations.yml. */
  listed?: ListedDeprecation[];
}

/** The version's Deprecations index: pages, then sections, then listed entries; problems name the page and the issue. */
export function deprecationIndex({ pages, sidebar = [], listed = [] }: IndexInput): { entries: DeprecationEntry[]; problems: string[] } {
  const problems: string[] = [];
  const parsed = pages.map((p) => ({ ...p, ...splitFrontMatter(p.text) }));
  const titleOf = (p: (typeof parsed)[number]): string => (typeof p.data.title === 'string' && p.data.title.trim() ? p.data.title.trim() : p.id.split('/').pop()!);
  const byId = new Map(parsed.map((p) => [p.id, p]));
  const byUrl = new Map(parsed.map((p) => [p.url, p]));
  /** A replacement or link as a URL and title; relative `.md` paths resolve against `fromId`. Undefined: names no page. */
  const resolve = (fromId: string, target: string, fromTitle = ''): { url: string; title: string } | undefined => {
    const doc = replacementDocId(fromId, target);
    if (doc) {
      const p = byId.get(doc.id) ?? byId.get(`${doc.id}/index`);
      return p ? { url: `${p.url}${doc.hash}`, title: replacementTitle(titleOf(p), p.id, fromTitle) } : undefined;
    }
    const p = byUrl.get(target.split('#')[0]!);
    return { url: target, title: p ? titleOf(p) : target };
  };
  const replacementsOf = (fromId: string, label: string, targets: (string | undefined)[], fromTitle = ''): DeprecationEntry['replacements'] => {
    const out = new Map<string, { url: string; title: string }>();
    for (const t of new Set(targets.filter((x): x is string => Boolean(x)))) {
      const r = resolve(fromId, t, fromTitle);
      if (r) out.set(r.url, r);
      else problems.push(`${label}: replacement names no page: ${t}`);
    }
    return [...out.values()];
  };

  const pageEntries: (DeprecationEntry & { id: string })[] = [];
  const sectionEntries: DeprecationEntry[] = [];
  for (const p of parsed) {
    const dep = deprecationOf(p.data);
    if (dep) {
      pageEntries.push({
        id: p.id, kind: 'page', title: titleOf(p), url: p.url,
        options: dep.map(({ option, since, removal }) => ({ option, ...(since ? { since } : {}), ...(removal ? { removal } : {}) })),
        replacements: replacementsOf(p.id, p.id, dep.map((d) => d.replacement), titleOf(p)),
      });
    }
    const pageOptions = Array.isArray(p.data.deployment_options) ? (p.data.deployment_options as string[]) : [''];
    for (const s of deprecatedSections(p.body)) {
      sectionEntries.push({ kind: 'section', title: s.title, url: p.url, page: titleOf(p), options: (s.option ? [s.option] : pageOptions).map((option) => ({ option })), replacements: [] });
    }
  }
  // Same titles: add the first sidebar category where the pages' places differ.
  const places = trails(sidebar);
  const placeOf = (id: string): string[] => places.get(id) ?? id.split('/').slice(0, -1);
  const titles = pageEntries.map((e) => {
    const same = pageEntries.filter((x) => x !== e && x.title === e.title);
    const own = placeOf(e.id);
    const depth = same.length ? own.findIndex((label, i) => same.some((x) => placeOf(x.id)[i] !== label)) : -1;
    return depth >= 0 ? `${e.title} (${own[depth]})` : e.title;
  });
  pageEntries.forEach((e, i) => { e.title = titles[i]!; Reflect.deleteProperty(e, 'id'); });

  const listedEntries: DeprecationEntry[] = listed.map((l) => {
    const link = l.link ? resolve('', l.link) : undefined;
    if (l.link && !link) problems.push(`deprecations.yml (${l.title}): link names no page: ${l.link}`);
    return {
      kind: 'listed', title: l.title, url: link?.url ?? null,
      options: (l.options.length ? l.options : ['']).map((option) => ({ option, since: l.since, ...(l.removal ? { removal: l.removal } : {}) })),
      replacements: replacementsOf('', `deprecations.yml (${l.title})`, [l.replacement]),
    };
  });
  return { entries: [...pageEntries, ...sectionEntries, ...listedEntries], problems };
}

/** A replacement or link from deprecations.yml: an http(s) URL, a site path or a relative page link. */
const linkProblem = (field: string, v: string): string | undefined =>
  unsafeUrl(v) || (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) || v.startsWith('//') ? `${field} is not a safe URL: ${v.slice(0, 80)}` : undefined;

/**
 * Entries of a `deprecations.yml` (a list of { title, deprecated_since, replacement, removal, link }), for the given
 * deployment options; an entry without title or deprecated_since is left out and reported, as is an unsafe link.
 */
export function readDeprecationsList(text: string, options: string[]): { listed: ListedDeprecation[]; problems: string[] } {
  let data: unknown;
  try { data = yaml.load(text, { schema: yaml.JSON_SCHEMA }); } catch (e) { return { listed: [], problems: [`deprecations.yml is not valid YAML: ${(e as Error).message.split('\n')[0]}`] }; }
  if (data === undefined || data === null) return { listed: [], problems: [] };
  if (!Array.isArray(data)) return { listed: [], problems: ['deprecations.yml must be a list of entries'] };
  const listed: ListedDeprecation[] = [];
  const problems: string[] = [];
  data.forEach((raw, i) => {
    const e = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const str = (k: string): string | undefined => (typeof e[k] === 'string' && (e[k] as string).trim() ? (e[k] as string).trim() : typeof e[k] === 'number' ? String(e[k]) : undefined);
    const title = str('title');
    const where = `deprecations.yml entry ${i + 1}${title ? ` (${title})` : ''}`;
    if (!title) { problems.push(`${where}: needs a title`); return; }
    const since = str('deprecated_since');
    if (!since) { problems.push(`${where}: needs deprecated_since (quoted: "7.3.0" or "2026-09")`); return; }
    const entry: ListedDeprecation = { title, options, since };
    for (const k of ['replacement', 'link'] as const) {
      const v = str(k);
      if (!v) continue;
      const problem = linkProblem(k, v);
      if (problem) problems.push(`${where}: ${problem}`);
      else entry[k] = v;
    }
    const removal = str('removal');
    if (removal) entry.removal = removal;
    listed.push(entry);
  });
  return { listed, problems };
}

/** The doc id and sidebar label of the Deprecations page, at the version's root (`<route>/deprecations/`). */
export const DEPRECATIONS_ID = 'deprecations';
const FEATURE_DEPRECATION = 'references/wso2-identity-server-feature-deprecation';

/** The Deprecations page: the site's Deprecations component over the version's index file (`indexImport`, relative to the page). */
export function deprecationsPage(indexImport: string): string {
  const front = yaml.dump({
    title: 'Deprecations',
    description: 'Features and APIs deprecated in this version: still working, not recommended, to be removed in a future release.',
    hide_table_of_contents: true, pagination_prev: null, pagination_next: null,
  });
  return `---\n${front}---\n\nimport Deprecations from '@site/src/components/Deprecations';\nimport index from '${indexImport}';\n\n<Deprecations index={index} />\n`;
}

/** The sidebar with the Deprecations page after the Feature deprecation reference page, else last; unchanged when listed. */
export function withDeprecationsEntry<T>(items: T[]): T[] {
  const entry = { type: 'doc', id: DEPRECATIONS_ID, label: 'Deprecations' } as unknown as T;
  const has = (list: unknown[]): boolean => list.some((i) => i && typeof i === 'object' && ((i as { id?: unknown }).id === DEPRECATIONS_ID || (Array.isArray((i as { items?: unknown }).items) && has((i as { items: unknown[] }).items))));
  if (has(items)) return items;
  let placed = false;
  const place = (list: T[]): T[] => list.flatMap((i) => {
    if (placed || !i || typeof i !== 'object') return [i];
    const item = i as { type?: unknown; id?: unknown; items?: unknown };
    if (item.type === 'doc' && item.id === FEATURE_DEPRECATION) { placed = true; return [i, entry]; }
    return Array.isArray(item.items) ? [{ ...item, items: place(item.items as T[]) } as T] : [i];
  });
  const out = place(items);
  return placed ? out : [...items, entry];
}
