// WSO2 docs site. Product sections come from ../generated/manifest.json, written by scripts/build-content.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Subpath imports: the plugins alone, without loading the converter (and its ES-module-only dependencies) into the config.
import rehypeValidElements from '@wso2/docs-converter/rehype-valid-elements';
import remarkSteps from '@wso2/docs-converter/remark-steps';

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
    remarkPlugins: [remarkSteps], // runs of `Step N` headings render as a stepper; after heading ids and the TOC
    rehypePlugins: [rehypeValidElements], // CommonMark (fallback) pages: text like <mail@address> is not an element
    // MkDocs keeps number prefixes ("2.x/", "01-intro") in URLs; only Docusaurus doc sets expect them stripped.
    ...(section.kind === 'docusaurus' ? {} : { numberPrefixParser: false }),
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

// Navigation data for the theme: products with their sections, plus link-out entries.
const catalogue = {
  groups: manifest.groups,
  products: [
    ...manifest.products.map(({ id, name, group, blurb, sections }) => ({ id, name, group, blurb, sections: sections.map(({ id: sid, label, route, landing }) => ({
      pluginId: sid, label, path: `/${route}/`, landing: `/${route}/${snapshot ? '' : landing ?? ''}`, versionsUrl: `/${route}/versions.json`,
    })) })),
    ...manifest.linkOut.map((p) => ({ ...p, href: p.href })),
  ],
};

export default {
  title: 'WSO2 Docs',
  tagline: 'Documentation for every WSO2 product, cloud and self-hosted.',
  url: 'https://wso2.com',
  baseUrl: '/',
  trailingSlash: true,
  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',
  markdown: { format: 'mdx', mermaid: true, hooks: { onBrokenMarkdownLinks: 'warn', onBrokenMarkdownImages: 'warn' } },
  future: { v4: false }, // Faster bundler broke on near-identical versioned MDX in docs-agent-platform; re-test before enabling.
  // The last entry serves redoc.standalone.js for API pages (src/components/ApiReference.js).
  // A snapshot build serves only its own version's files: generated/static (every live product) stays with the live build.
  // Local search settings (.cache/search-public/search-config.json, written by scripts/search-index.mjs) reach dev and
  // quick builds; never snapshots, which must not depend on the environment. A deploy writes its own into the output.
  staticDirectories: ['static', ...(snapshot ? [] : [path.join(generated, 'static')]), ...versionStatics, path.resolve(here, '../node_modules/redoc/bundles'),
    ...(!snapshot && fs.existsSync(searchPublic) ? [searchPublic] : [])],
  themes: ['@docusaurus/theme-mermaid'],
  presets: [['classic', { docs: false, blog: false, theme: { customCss: ['./src/css/oxygen.css', './src/css/site.css'] } }]],
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
    footer: { style: 'dark', copyright: `Copyright © ${new Date().getFullYear()} WSO2 LLC.` },
  },
};
