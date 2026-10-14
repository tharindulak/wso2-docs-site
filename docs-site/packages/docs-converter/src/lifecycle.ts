// Lifecycle stage front matter: `status: beta | preview | deprecated` (no status: generally available), and for a
// deprecation `deprecated_since` (required), `replacement` and `removal` (optional). A page of one deployment option,
// or one whose options all carry the same fields, keeps them flat; a merged page whose options differ carries them per
// option under `lifecycle` (`lifecycle: { WSO2 Cloud: { status: deprecated, ... } }`; an option missing from it is
// generally available). The docs site shows one badge per page (lifecycleBadge) and reads this module in the browser
// too, so it has no Node imports.
import { unsafeUrl } from './syntax.js';
import type { SidebarItem } from './types.js';

export const STAGES = ['beta', 'preview', 'deprecated'] as const;
export type Stage = (typeof STAGES)[number];
export interface Lifecycle { status: Stage; deprecated_since?: string; replacement?: string; removal?: string }

/** Flat lifecycle fields, and the per-option key of a merged page. */
export const LIFECYCLE_FIELDS = ['status', 'deprecated_since', 'replacement', 'removal'] as const;
export const BY_OPTION = 'lifecycle';

const DEPRECATION_FIELDS = ['deprecated_since', 'replacement', 'removal'] as const;
const isStage = (v: unknown): v is Stage => typeof v === 'string' && (STAGES as readonly string[]).includes(v);

export interface CheckOptions {
  /** Whether a relative `.md` replacement (anchor removed) names a page; unset: not checked. */
  replacementExists?: (target: string) => boolean;
}

/** Valid lifecycle fields of one page (or one option of it), and what is wrong with the rest. */
export function checkLifecycle(fields: Record<string, unknown>, { replacementExists }: CheckOptions = {}): { lifecycle?: Lifecycle; problems: string[] } {
  const problems: string[] = [];
  const present = LIFECYCLE_FIELDS.filter((k) => fields[k] !== undefined && fields[k] !== null);
  if (!present.length) return { problems };
  const status = fields.status;
  if (status === undefined || status === null) return { problems: [`${present.join(', ')} without status: deprecated`] };
  if (!isStage(status)) return { problems: [`status: ${JSON.stringify(status)} is not one of ${STAGES.join(', ')}`] };
  const lifecycle: Lifecycle = { status };
  if (status !== 'deprecated') {
    const extra = DEPRECATION_FIELDS.filter((k) => fields[k] !== undefined && fields[k] !== null);
    if (extra.length) problems.push(`${extra.join(', ')} only go with status: deprecated`);
    return { lifecycle, problems };
  }
  const text = (k: (typeof DEPRECATION_FIELDS)[number]): string | undefined => {
    const v = fields[k];
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'string' && v.trim()) return v.trim();
    problems.push(`${k} must be a quoted string, not ${JSON.stringify(v)}`);
    return undefined;
  };
  const since = text('deprecated_since');
  if (since) lifecycle.deprecated_since = since;
  else if (fields.deprecated_since === undefined || fields.deprecated_since === null) problems.push('status: deprecated needs deprecated_since (quoted: "7.3.0" or "2026-09")');
  const replacement = text('replacement');
  if (replacement) {
    const problem = replacementProblem(replacement, replacementExists);
    if (problem) problems.push(problem);
    else lifecycle.replacement = replacement;
  }
  const removal = text('removal');
  if (removal) lifecycle.removal = removal;
  return { lifecycle, problems };
}

/** A replacement is an http(s) URL, a site path, or a relative page link; a relative .md link must name a page. */
function replacementProblem(target: string, exists?: (target: string) => boolean): string | undefined {
  if (unsafeUrl(target)) return `replacement is not a safe URL: ${target.slice(0, 80)}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^https?:\/\//i.test(target)) return `replacement must be an http(s) URL or a page link: ${target.slice(0, 80)}`;
  if (target.startsWith('//')) return `replacement must be an http(s) URL or a page link: ${target.slice(0, 80)}`;
  const page = target.split('#')[0]!;
  if (exists && !/^[a-z][a-z0-9+.-]*:|^\//i.test(page) && /\.mdx?$/.test(page) && !exists(page)) return `replacement names no page: ${target.slice(0, 80)}`;
  return undefined;
}

const plain = (l: Lifecycle): Record<string, string> => Object.fromEntries(LIFECYCLE_FIELDS.filter((k) => l[k] !== undefined).map((k) => [k, l[k]!]));

/**
 * Front matter for lifecycle stages that may differ by deployment option: flat fields when every option of the page
 * carries the same ones, else `lifecycle` with the options that carry a stage.
 */
export function lifecycleFrontMatter(byOption: Record<string, Lifecycle | undefined>, options: readonly string[]): Record<string, unknown> {
  const marked = options.filter((o) => byOption[o]);
  if (!marked.length) return {};
  const key = (o: string): string => JSON.stringify(plain(byOption[o]!));
  if (marked.length === options.length && marked.every((o) => key(o) === key(marked[0]!))) return plain(byOption[marked[0]!]!);
  return { [BY_OPTION]: Object.fromEntries(marked.map((o) => [o, plain(byOption[o]!)])) };
}

/** The lifecycle fields of a page's front matter, flat or per option, validated; per option keys must be the page's options. */
export function checkPageLifecycle(front: Record<string, unknown>, options: readonly string[], check: CheckOptions = {}): { fields: Record<string, unknown>; problems: string[] } {
  const map = front[BY_OPTION];
  if (map === undefined || map === null) {
    const { lifecycle, problems } = checkLifecycle(front, check);
    return { fields: lifecycle ? plain(lifecycle) : {}, problems };
  }
  const problems: string[] = [];
  const flat = LIFECYCLE_FIELDS.filter((k) => front[k] !== undefined);
  if (flat.length) problems.push(`${flat.join(', ')} beside ${BY_OPTION}: per-option stages go under ${BY_OPTION} only`);
  if (typeof map !== 'object' || Array.isArray(map)) return { fields: {}, problems: [...problems, `${BY_OPTION} must map deployment options to stages`] };
  const byOption: Record<string, Lifecycle | undefined> = {};
  for (const [option, value] of Object.entries(map as Record<string, unknown>)) {
    if (!options.includes(option)) { problems.push(`${BY_OPTION}: "${option}" is not a deployment option of the page (${options.join(', ') || 'none'})`); continue; }
    if (!value || typeof value !== 'object') { problems.push(`${BY_OPTION}.${option} must hold the stage fields`); continue; }
    const r = checkLifecycle(value as Record<string, unknown>, check);
    problems.push(...r.problems.map((p) => `${BY_OPTION}.${option}: ${p}`));
    byOption[option] = r.lifecycle;
  }
  return { fields: lifecycleFrontMatter(byOption, options), problems };
}

const DEPRECATED_SUFFIX = /\s*\(deprecated\)\s*$/i;

/** A title or label without its "(deprecated)" suffix, which the badge replaces. */
export const withoutDeprecatedSuffix = (label: string): string => label.replace(DEPRECATED_SUFFIX, '');

/**
 * Replace the lifecycle fields of `front` (which holds `deployment_options` and `title`) with their checked values;
 * where the badge shows Deprecated, the title loses its "(deprecated)" suffix.
 */
export function applyLifecycle(front: Record<string, unknown>, check: CheckOptions = {}): { front: Record<string, unknown>; problems: string[] } {
  const options = Array.isArray(front.deployment_options) ? (front.deployment_options as string[]) : [];
  const { fields, problems } = checkPageLifecycle(front, options, check);
  const out = Object.fromEntries(Object.entries(front).filter(([k]) => !(LIFECYCLE_FIELDS as readonly string[]).includes(k) && k !== BY_OPTION));
  Object.assign(out, fields);
  if (typeof out.title === 'string' && lifecycleBadge(out)?.stage === 'deprecated') out.title = withoutDeprecatedSuffix(out.title);
  return { front: out, problems };
}

/** Badge precedence when a page's options differ: Preview tells the reader what to do, so it wins. */
const PRECEDENCE: Stage[] = ['preview', 'deprecated', 'beta'];

/**
 * The one badge a page shows: its stage, and the deployment options it covers when that is only some of the page's
 * (empty scope: all of them). Null for a generally available page. Unchecked values are ignored.
 */
export function lifecycleBadge(front: Record<string, unknown>): { stage: Stage; scope: string[] } | null {
  const options = Array.isArray(front.deployment_options) ? (front.deployment_options as unknown[]).filter((o): o is string => typeof o === 'string') : [];
  const map = front[BY_OPTION];
  const byOption: [string, Stage][] = map && typeof map === 'object' && !Array.isArray(map)
    ? Object.entries(map as Record<string, unknown>).flatMap(([o, v]) => {
      const s = (v as { status?: unknown } | null)?.status;
      return isStage(s) && (!options.length || options.includes(o)) ? [[o, s] as [string, Stage]] : [];
    })
    : isStage(front.status) ? (options.length ? options : ['']).map((o) => [o, front.status as Stage] as [string, Stage]) : [];
  const stage = PRECEDENCE.find((s) => byOption.some(([, b]) => b === s));
  if (!stage) return null;
  const covered = byOption.filter(([, b]) => b === stage).map(([o]) => o);
  const all = options.length ? options : covered;
  return { stage, scope: all.every((o) => covered.includes(o)) ? [] : covered };
}

/** Sidebar items (recursively) without the "(deprecated)" suffix on pages whose badge shows Deprecated. */
export function withoutDeprecatedLabels<T extends SidebarItem | Record<string, unknown> | string>(items: T[], stageOf: (docId: string) => Stage | null | undefined): T[] {
  return items.map((item) => {
    if (typeof item !== 'object' || item === null) return item;
    const i = item as { type?: unknown; id?: unknown; label?: unknown; items?: unknown };
    let next: Record<string, unknown> = item as Record<string, unknown>;
    if (i.type === 'doc' && typeof i.id === 'string' && typeof i.label === 'string' && stageOf(i.id) === 'deprecated') {
      next = { ...next, label: withoutDeprecatedSuffix(i.label) };
    }
    if (Array.isArray(i.items)) next = { ...next, items: withoutDeprecatedLabels(i.items as T[], stageOf) };
    return next as T;
  });
}

/**
 * Whether an admonition is a section deprecation notice: the `deprecated` type, or a warning titled "Deprecated …"
 * (sources written before the type existed). The title is plain text (code marks removed).
 */
export const isDeprecatedAdmonition = (type: string, title: string | undefined): boolean =>
  type === 'deprecated' || (type === 'warning' && /^deprecated\b/i.test((title ?? '').replace(/`/g, '').trim()));

/** One deployment option's deprecation: since when, and the replacement and removal as written (`option` "" when the page names none). */
export interface OptionDeprecation { option: string; since?: string; replacement?: string; removal?: string }

/** A page's deprecation per deployment option, from flat fields or the per-option map; null when it is not deprecated. */
export function deprecationOf(front: Record<string, unknown>): OptionDeprecation[] | null {
  const options = Array.isArray(front.deployment_options) ? (front.deployment_options as unknown[]).filter((o): o is string => typeof o === 'string') : [];
  const map = front[BY_OPTION];
  const entries: [string, Record<string, unknown>][] = map && typeof map === 'object' && !Array.isArray(map)
    ? Object.entries(map as Record<string, unknown>).filter((e): e is [string, Record<string, unknown>] => Boolean(e[1]) && typeof e[1] === 'object')
    : map === undefined || map === null ? (options.length ? options : ['']).map((o) => [o, front]) : [];
  const out = entries.filter(([, f]) => f.status === 'deprecated').map(([option, f]) => {
    const d: OptionDeprecation = { option };
    for (const [k, field] of [['since', 'deprecated_since'], ['replacement', 'replacement'], ['removal', 'removal']] as const) {
      if (typeof f[field] === 'string' && (f[field] as string).trim()) d[k] = (f[field] as string).trim();
    }
    return d;
  });
  return out.length ? out : null;
}

/** The doc id a relative `.md` replacement names, resolved against the page's doc id, and its anchor; null for a URL or site path. */
export function replacementDocId(pageId: string, replacement: string): { id: string; hash: string } | null {
  const [file = '', ...rest] = replacement.split('#');
  if (/^[a-z][a-z0-9+.-]*:|^\//i.test(file) || !/\.mdx?$/.test(file)) return null;
  const parts = pageId.split('/').slice(0, -1);
  for (const part of file.replace(/\.mdx?$/, '').split('/')) {
    if (part === '..') { if (!parts.length) return null; parts.pop(); } else if (part && part !== '.') parts.push(part);
  }
  return { id: parts.join('/'), hash: rest.length ? `#${rest.join('#')}` : '' };
}

/** A replacement's title as shown; when it reads the same as the deprecated page's, the version in its file name ("-v2-") is added. */
export function replacementTitle(title: string, docId: string, pageTitle: string): string {
  if (title.trim().toLowerCase() !== pageTitle.trim().toLowerCase()) return title;
  const version = docId.split('/').pop()!.match(/(?:^|-)v(\d+)(?:-|$)/i)?.[1];
  return version ? `${title} V${version}` : title;
}
