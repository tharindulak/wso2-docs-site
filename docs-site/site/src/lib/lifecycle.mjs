// Lifecycle stage badge (Beta, Preview, Deprecated) for doc pages and sidebar entries. Which stage a page shows, and
// for which of its deployment options, comes from the converter's rule (@wso2/docs-converter/lifecycle), which also
// drops "(deprecated)" from titles and sidebar labels where the badge shows Deprecated. Wording: one line per stage
// (planning ticket "Which lifecycle stages, and what each means").
import { lifecycleBadge as shownStage } from '@wso2/docs-converter/lifecycle';

export const STAGES = {
  beta: { label: 'Beta', line: 'Available to everyone; may change before general availability.' },
  preview: { label: 'Preview', line: 'Turn it on in the Console under Feature Preview before use.' },
  deprecated: { label: 'Deprecated', line: 'Still works, but not recommended; it will be removed in a future release.' },
};

/** The page's badge: stage, text ("Deprecated · WSO2 Cloud" when it covers only some options), hover text; or null. */
export function lifecycleBadge(frontMatter) {
  const shown = shownStage(frontMatter ?? {});
  if (!shown) return null;
  const { label, line } = STAGES[shown.stage];
  return { stage: shown.stage, text: shown.scope.length ? `${label} · ${shown.scope.join(', ')}` : label, title: line };
}

/**
 * Front matter with the sidebar fields Docusaurus applies to the page's sidebar entry (sidebar_class_name,
 * sidebar_custom_props), for markdown.parseFrontMatter. The pill itself is CSS (site.css, .lifecycle-entry--<stage>).
 */
export function withLifecycleSidebar(frontMatter) {
  const badge = lifecycleBadge(frontMatter);
  if (!badge) return frontMatter;
  const own = typeof frontMatter.sidebar_class_name === 'string' ? `${frontMatter.sidebar_class_name} ` : '';
  const props = frontMatter.sidebar_custom_props && typeof frontMatter.sidebar_custom_props === 'object' ? frontMatter.sidebar_custom_props : {};
  return {
    ...frontMatter,
    sidebar_class_name: `${own}lifecycle-entry lifecycle-entry--${badge.stage}`,
    sidebar_custom_props: { ...props, lifecycle: badge.stage },
  };
}
