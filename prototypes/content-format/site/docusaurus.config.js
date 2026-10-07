// PROTOTYPE, throwaway: navigation across the hub and products (?nav=A|B|C), on converted Identity docs
// plus sample Integration Platform sections and older versions. Label = decided variant A.
const failed = require('./compile-failures.json').map((f) => f.file);
const docs = (id, routeBasePath, extra = {}) => ['@docusaurus/plugin-content-docs', { id, path: `content/${id}`, routeBasePath, sidebarCollapsed: true, ...extra }];
module.exports = {
  title: 'WSO2 Docs (navigation prototype)', url: 'http://localhost', baseUrl: '/',
  onBrokenLinks: 'ignore', onBrokenMarkdownLinks: 'ignore', onBrokenAnchors: 'ignore',
  markdown: { hooks: { onBrokenMarkdownImages: 'ignore' } },
  presets: [['classic', { blog: false, theme: { customCss: ['./src/oxygen-infima.css', './src/custom.css'] },
    docs: { id: 'identity', path: 'content/identity', routeBasePath: 'identity', exclude: failed, sidebarCollapsed: true,
      lastVersion: 'current', versions: { current: { label: '7.3.0 (Latest)' }, '7.2.0': { path: '7.2.0' }, '7.1.0': { path: '7.1.0' } } } }]],
  plugins: [
    docs('hub', 'cloud'),
    docs('integration-mi', 'integration/micro-integrator', { lastVersion: 'current', versions: { current: { label: '4.7.0 (Latest)' }, '4.6.0': { path: '4.6.0' }, '4.5.0': { path: '4.5.0' } } }),
    docs('integration-integrator', 'integration/integrator', { lastVersion: 'current', versions: { current: { label: '5.1.x (Latest)' }, '5.0.x': { path: '5.0.x' } } }),
    './plugins/color-scheme-sync',
  ],
  customFields: { showSwitcher: process.env.SHOW_SWITCHER === '1' },
  themeConfig: { navbar: { title: 'WSO2 Docs', items: [] }, colorMode: { respectPrefersColorScheme: true } },
};
