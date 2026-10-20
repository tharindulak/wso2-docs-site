// WSO2 docs site. Product sections come from ../generated/manifest.json, written by scripts/build-content.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Subpath imports: the plugins alone, without loading the converter (and its ES-module-only dependencies) into the config.
import rehypeValidElements from '@wso2/docs-converter/rehype-valid-elements';
import remarkLinkedTabs from '@wso2/docs-converter/remark-linked-tabs';
import remarkDeprecatedSections from '@wso2/docs-converter/remark-deprecated-sections';
import remarkComponents from '@wso2/docs-converter/remark-components';
import { withLifecycleSidebar } from './src/lib/lifecycle.mjs';
import { siteUrl, noIndex } from './src/lib/site-url.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const generated = path.resolve(here, '../generated');
const manifestFile = path.join(generated, 'manifest.json');
if (!fs.existsSync(manifestFile)) throw new Error('Run `npm run content` first: generated/manifest.json is missing.');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const searchPublic = path.resolve(here, '../.cache/search-public');

// Quick builds (scripts/build-sections.mjs): DOCS_SECTIONS=id,id builds only those sections. Navigation still
// lists every product; links into sections left out are reported as broken links (warnings).
const selected = (process.env.DOCS_SECTIONS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const known = manifest.products.flatMap((p) => p.sections.map((s) => s.id));
const unknown = selected.filter((id) => !known.includes(id));
if (unknown.length) throw new Error(`DOCS_SECTIONS: unknown section ${unknown.join(', ')}. Known: ${known.join(', ')}`);
const built = (section) => !selected.length || selected.includes(section.id);

// One docs plugin instance per version. Snapshot versions are built only when DOCS_SNAPSHOT names them (the
// assemble step copies that subtree into the final site); Confluence versions have no source and no instance.
const snapshot = process.env.DOCS_SNAPSHOT || null;
const entries = manifest.products.flatMap((product) => product.sections.flatMap((section) =>
  section.versions.filter((v) => v.status !== 'confluence').map((v) => ({ section, v }))));
if (snapshot && !entries.some((e) => e.v.id === snapshot)) throw new Error(`DOCS_SNAPSHOT: unknown version ${snapshot}`);
const included = entries.filter(({ section, v }) => (snapshot ? v.id === snapshot : v.status !== 'snapshot' && built(section)));

const docsPlugins = included.map(({ section, v }) => [
  '@docusaurus/plugin-content-docs',
  {
    id: v.id,
    path: path.join(generated, 'docs', v.id),
    routeBasePath: v.route,
    sidebarPath: path.join(generated, 'sidebars', v.sidebar),
    sidebarCollapsed: true,
    // Tabs blocks offering the same choices switch together; deprecated sections (the `deprecated` admonition type,
    // or a warning titled "Deprecated …") render as section deprecation notices (theme/Admonition/Types); the explicit
    // content components (<Steps>, <Prerequisites>, <LinkCards>) render after heading ids and the TOC are set. The site
    // recognises no writing conventions: the converter writes the components for pages that follow them.
    remarkPlugins: [remarkLinkedTabs, remarkDeprecatedSections, remarkComponents],
    admonitions: { keywords: ['deprecated'] },
    rehypePlugins: [rehypeValidElements], // CommonMark (fallback) pages: text like <mail@address> is not an element
    // MkDocs keeps number prefixes ("2.x/", "01-intro") in URLs; only native Docusaurus doc sets expect them stripped.
    // A tree migrated from MkDocs ships its own sidebar with the prefixes kept (API Manager's connectors/1.x/).
    ...(section.kind === 'docusaurus' && !section.sidebar ? {} : { numberPrefixParser: false }),
    versions: { current: { label: v.label } },
  },
]);
// Older versions ship their own static files (images, downloads) from generated/static-versions/<versionId>/.
const versionStatics = included.filter(({ v }) => v.status !== 'latest').map(({ v }) => path.join(generated, 'static-versions', v.id));
// A snapshot bundle is a function of its key (scripts/snapshots.mjs): it carries only its own version's info, and a
// catalogue from lock-file fields the key's navigation hash covers (groups, product names and blurbs, section labels
// and routes, link-outs). Section links then go to /<route>/, which the live build serves for every section.
const versionInfo = Object.fromEntries(entries.filter(({ v }) => !snapshot || v.id === snapshot).map(({ section, v }) => [v.id, {
  sectionId: section.id, version: v.version, label: v.label, status: v.status, latestPath: `/${section.route}/`, cloud: section.cloud,
}]));

// Hidden from navigation (lock hide_from_navigation): still built, but left out of menus, home page, search and sitemap.
// Live build only: a snapshot's key does not cover the list, so a snapshot keeps the menu it was built with.
const hidden = new Set(snapshot ? [] : manifest.hiddenFromNavigation ?? []);
const hiddenRoutes = manifest.products.filter((p) => hidden.has(p.id)).flatMap((p) => p.sections.map((s) => s.route));

// Navigation data for the theme: products with their sections, plus link-out entries.
const catalogue = {
  groups: manifest.groups,
  accountHidden: hidden.has('account'),
  products: [
    ...manifest.products.map(({ id, name, group, blurb, sections }) => ({ id, name, group, blurb, ...(hidden.has(id) ? { hidden: true } : {}), sections: sections.map(({ id: sid, label, route, landing }) => ({
      pluginId: sid, label, path: `/${route}/`, landing: `/${route}/${snapshot ? '' : landing ?? ''}`, versionsUrl: `/${route}/versions.json`,
    })) })),
    ...manifest.linkOut.map((p) => ({ ...p, href: p.href })),
  ],
};

// A product's entry point, as the Products menu and home cards link it (src/components/catalogue.js productHref): its
// first section's landing. Products have no page at /<product id>/ (API Platform and Integration Platform's sections sit
// below it), so footer links to the bare product route were broken on every page.
function productTo(id) {
  const section = manifest.products.find((p) => p.id === id)?.sections[0];
  if (!section) throw new Error(`footer: no product ${id} in generated/manifest.json`);
  return `/${section.route}/${section.landing ?? ''}`;
}

export default {
  title: 'WSO2 Docs',
  tagline: 'Documentation for every WSO2 product, cloud and self-hosted.',
  url: siteUrl(), // DOCS_SITE_URL for a deploy (src/lib/site-url.mjs)
  baseUrl: '/',
  noIndex: noIndex(), // DOCS_NO_INDEX=1: the test VM
  trailingSlash: true,
  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',
  markdown: {
    format: 'mdx', mermaid: true, hooks: { onBrokenMarkdownLinks: 'warn', onBrokenMarkdownImages: 'warn' },
    // A page's lifecycle stage (status, or lifecycle per deployment option) marks its sidebar entry: a class the
    // sidebar pill is drawn from (site.css) and custom props. Documented hook; the default parser does the parsing.
    parseFrontMatter: async (params) => {
      const result = await params.defaultParseFrontMatter(params);
      return { ...result, frontMatter: withLifecycleSidebar(result.frontMatter) };
    },
  },
  // Docusaurus Faster (Rspack, SWC, LightningCSS, parallel page rendering). Two parts stay off: mdxCrossCompilerCache
  // (the Faster MDX bug once seen with near-identical versioned copies in docs-agent-platform) and swcHtmlMinimizer
  // (it drops attribute quotes and optional </p> tags, which scripts/check-links.mjs relies on). DOCS_FASTER=0 turns
  // the whole block off (standard webpack build) if a source misbehaves.
  future: process.env.DOCS_FASTER === '0' ? { v4: false } : {
    v4: { removeLegacyPostBuildHeadAttribute: true }, // ssgWorkerThreads requires it
    faster: {
      rspackBundler: true,
      rspackPersistentCache: true,
      swcJsLoader: true,
      swcJsMinimizer: true,
      swcHtmlMinimizer: false,
      lightningCssMinimizer: true,
      ssgWorkerThreads: true,
      mdxCrossCompilerCache: false,
    },
  },
  // The last entry serves redoc.standalone.js for API pages (src/components/ApiReference.js).
  // A snapshot build serves only its own version's files: generated/static (every live product) stays with the live build.
  // Local search settings (.cache/search-public/search-config.json, written by scripts/search-index.mjs) reach dev and
  // quick builds; never snapshots, which must not depend on the environment. A deploy writes its own into the output.
  staticDirectories: ['static', ...(snapshot ? [] : [path.join(generated, 'static')]), ...versionStatics, path.resolve(here, '../node_modules/redoc/bundles'),
    ...(!snapshot && fs.existsSync(searchPublic) ? [searchPublic] : [])],
  themes: ['@docusaurus/theme-mermaid'],
  presets: [['classic', { docs: false, blog: false, theme: { customCss: ['./src/css/oxygen.css', './src/css/site.css', './src/css/new-look.css'] },
    sitemap: { ignorePatterns: [...hiddenRoutes, ...(hidden.has('account') ? ['account'] : [])].flatMap((r) => [`/${r}/`, `/${r}/**`]) } }]],
  plugins: [
    ...docsPlugins,
    ['@docusaurus/plugin-content-docs', { id: 'account', path: path.join(here, 'account'), routeBasePath: 'account', sidebarPath: path.join(here, 'account-sidebars.js') }],
    './plugins/color-scheme-sync.js',
    './plugins/module-resolution.js',
  ],
  clientModules: [path.join(here, 'src/client/full-load-links.js')],
  customFields: { catalogue, versionInfo, snapshot },
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: { title: 'WSO2 Docs', items: [] },
    docs: { sidebar: { hideable: true } },
    // Footer columns from the redesign's footer decision: hub sections and CONTEXT.md product names. Status, Support,
    // Get started and the legal links wait for their hub pages and confirmed addresses; the console button is held.
    footer: {
      style: 'dark',
      links: [
        { title: ' ', items: [{ html: '<div class="footer-about"><span class="footer-about__logo">W</span><p>Documentation for WSO2 products: Agent Manager, Identity Platform, API Platform, Integration Platform and API Analytics Platform.</p></div>' }] },
        { title: 'Docs', items: [{ label: 'Overview', to: '/' }, { label: 'Search', to: '/search/' }] },
        { title: 'Products', items: [
          { label: 'Agent Manager', to: productTo('agent-manager') },
          { label: 'Identity Platform', to: productTo('identity') },
          { label: 'API Platform', to: productTo('api-platform') },
          { label: 'Integration Platform', to: productTo('integration') },
          { label: 'API Analytics Platform', href: 'https://www.moesif.com/docs/' },
        ] },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} WSO2 LLC. All rights reserved.`,
    },
  },
};
