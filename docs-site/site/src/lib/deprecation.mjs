// Deprecation notices (a box under a deprecated page's title, the deprecated section admonition) and the per-version
// Deprecations page (planning ticket "How deprecation notices and the Deprecations page look"). The page's
// deprecation comes from the converter's rule (@wso2/docs-converter/lifecycle, either front-matter shape); the
// one-line explanation is the Deprecated stage's wording (lifecycle.mjs). No React here.
import { deprecationOf, replacementDocId, replacementTitle } from '@wso2/docs-converter/lifecycle';
import { STAGES } from './lifecycle.mjs';

/** The self-hosted product's name per docs section, where the wording names it ("in Identity Server since 7.3.0"). */
const SELF_HOSTED_NAME = { identity: 'Identity Server' };
/** The self-hosted policy page explaining deprecation, by doc id within a version. */
export const POLICY_DOC_ID = 'references/wso2-identity-server-feature-deprecation';

const optionName = (option, sectionId) => (option === 'Self-hosted' ? SELF_HOSTED_NAME[sectionId] ?? option : option);
const optionPhrase = (option, sectionId) => {
  const name = optionName(option, sectionId);
  return option === 'WSO2 Cloud' ? `on ${name}` : name === option ? name : `in ${name}`;
};

/**
 * "since 7.0.0"; per option when they differ ("on WSO2 Cloud since 2026-03; in Identity Server since 7.3.0") or when
 * `scoped` (the deprecation covers only some of the page's options); "" without dates.
 */
export function sinceText(options, sectionId, { scoped = false } = {}) {
  const dated = options.filter((o) => o.since);
  if (!dated.length) return '';
  if (!scoped && new Set(dated.map((o) => o.since)).size === 1) return `since ${dated[0].since}`;
  return dated.map((o) => `${optionPhrase(o.option, sectionId)} since ${o.since}`).join('; ');
}

/** Removal per option when they differ, like since; null when no option records one. */
function removalText(options, sectionId) {
  const set = options.filter((o) => o.removal);
  if (!set.length) return null;
  if (new Set(set.map((o) => o.removal)).size === 1) return set[0].removal;
  return set.map((o) => `${optionPhrase(o.option, sectionId)} ${o.removal}`).join('; ');
}

/**
 * The notice for a deprecated page, or null: since, the one-line explanation, the distinct replacements (a relative
 * `.md` one resolved with `resolveDoc(docId)` -> { url, title } | null and told apart from the page's own `title`
 * when they read the same; one naming no page is left out: the content build reports it), the policy page of this version (null when it has none), and removal only when recorded.
 */
export function deprecationNotice(frontMatter, { docId, title = '', resolveDoc, sectionId }) {
  const options = deprecationOf(frontMatter ?? {});
  if (!options) return null;
  const replacements = new Map();
  for (const target of new Set(options.map((o) => o.replacement).filter(Boolean))) {
    const doc = replacementDocId(docId, target);
    const id = doc && (resolveDoc(doc.id) ? doc.id : `${doc.id}/index`);
    const found = doc ? resolveDoc(id) : { url: target, title: target };
    const url = found && found.url + (doc?.hash ?? '');
    if (found) replacements.set(url, { url, title: doc ? replacementTitle(found.title, id, title) : found.title });
  }
  const removal = removalText(options, sectionId);
  const pageOptions = Array.isArray(frontMatter.deployment_options) ? frontMatter.deployment_options : [];
  const scoped = pageOptions.some((o) => !options.some((d) => d.option === o));
  return {
    since: sinceText(options, sectionId, { scoped }), line: STAGES.deprecated.line, replacements: [...replacements.values()],
    policy: resolveDoc(POLICY_DOC_ID)?.url ?? null, removal: removal ? `Removal planned: ${removal}` : null,
  };
}

/** The scope line of a section notice ("Applies to WSO2 Cloud and Identity Server."); null when the options are unknown. */
export function scopeText(options, sectionId) {
  if (!options?.length) return null;
  const names = options.map((o) => optionName(o, sectionId));
  return `Applies to ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]}.`;
}

/** A section notice shows the Deprecated tag only when the writer's title does not already say deprecated. */
export const needsDeprecatedTag = (title) => !/deprecat/i.test(title ?? '');

/** Rows of the Deprecations table from a version's index (written by the content build). */
export function deprecationRows(index, sectionId) {
  return (index?.entries ?? []).map((e) => ({
    kind: e.kind, name: e.title, url: e.url ?? null, page: e.page ?? null,
    scope: e.options.map((o) => optionName(o.option, sectionId)).filter(Boolean).join(', '),
    since: sinceText(e.options, sectionId).replace(/^since /, ''),
    replacements: e.replacements, removal: removalText(e.options, sectionId) ?? 'Not announced',
  }));
}

/**
 * Tabs to the Deprecations pages of the section's versions: from /<route>/versions.json (`doc`) and each version's
 * pages.json (`pagesByPath`, keyed by version path; { pages } or a bare list), the versions that have one.
 */
export function deprecationTabs(doc, pagesByPath, pathname) {
  return (doc?.versions ?? []).filter((v) => v.path).flatMap((v) => {
    const info = pagesByPath[v.path];
    const pages = Array.isArray(info) ? info : Array.isArray(info?.pages) ? info.pages : [];
    if (!pages.includes('deprecations/')) return [];
    const href = `${v.path}deprecations/`;
    return [{ label: v.status === 'latest' ? 'Latest' : v.label, href, current: pathname.replace(/\/?$/, '/') === href }];
  });
}
