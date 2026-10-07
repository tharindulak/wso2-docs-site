// WSO2 docs site. Product sections come from ../generated/manifest.json, written by scripts/build-content.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const generated = path.resolve(here, '../generated');
const manifestFile = path.join(generated, 'manifest.json');
if (!fs.existsSync(manifestFile)) throw new Error('Run `npm run content` first: generated/manifest.json is missing.');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

const docsPlugins = manifest.products.flatMap((product) => product.sections.map((section) => [
  '@docusaurus/plugin-content-docs',
  {
    id: section.id,
    path: path.join(generated, 'docs', section.id),
    routeBasePath: section.route,
    sidebarPath: path.join(generated, 'sidebars', section.sidebar),
    sidebarCollapsed: true,
    versions: { current: { label: section.version ? `${section.version} (Latest)` : 'Latest' } },
  },
]));

// Navigation data for the theme: products with their sections, plus link-out entries.
const catalogue = {
  groups: manifest.groups,
  products: [
    ...manifest.products.map((p) => ({ ...p, sections: p.sections.map(({ id, label, route, version, olderVersions, landing }) => ({ pluginId: id, label, path: `/${route}/`, landing: `/${route}/${landing ?? ''}`, version, olderVersions })) })),
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
  staticDirectories: ['static', path.join(generated, 'static')],
  themes: ['@docusaurus/theme-mermaid'],
  presets: [['classic', { docs: false, blog: false, theme: { customCss: ['./src/css/oxygen.css', './src/css/site.css'] } }]],
  plugins: [
    ...docsPlugins,
    ['@docusaurus/plugin-content-docs', { id: 'account', path: path.join(here, 'account'), routeBasePath: 'account', sidebarPath: path.join(here, 'account-sidebars.js') }],
    './plugins/color-scheme-sync.js',
    './plugins/module-resolution.js',
  ],
  customFields: { catalogue },
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: { title: 'WSO2 Docs', items: [] },
    docs: { sidebar: { hideable: true } },
    footer: { style: 'dark', copyright: `Copyright © ${new Date().getFullYear()} WSO2 LLC.` },
  },
};
