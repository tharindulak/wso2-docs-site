// PROTOTYPE, throwaway: unified "Latest" Identity Platform docs converted from docs-is (Asgardeo + IS 7.3.0).
const failed = require('./compile-failures.json').map((f) => f.file);
module.exports = {
  title: 'Deployment label prototype', url: 'http://localhost', baseUrl: '/',
  onBrokenLinks: 'ignore', onBrokenMarkdownLinks: 'ignore', onBrokenAnchors: 'ignore',
  markdown: { hooks: { onBrokenMarkdownImages: 'ignore' } },
  presets: [['classic', { blog: false, theme: { customCss: ['./src/oxygen-infima.css', './src/custom.css'] },
    docs: { path: 'content/identity', routeBasePath: 'identity', exclude: failed, sidebarCollapsed: true } }]],
  plugins: ['./plugins/color-scheme-sync'],
  customFields: { showSwitcher: process.env.SHOW_SWITCHER === '1' },
  themeConfig: { navbar: { title: 'Identity Platform (prototype)' } },
};
