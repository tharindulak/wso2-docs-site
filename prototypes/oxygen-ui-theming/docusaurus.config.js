// PROTOTYPE, throwaway. Question: how should Oxygen UI theme a Docusaurus docs site?
// Three variants, one production build each (SSR matters, so no runtime ?variant= switch):
//   A: OxygenUIThemeProvider wraps the whole site; MUI navbar and deployment block.
//   B: Oxygen tokens copied into Infima CSS variables; no MUI at runtime.
//   C: B's CSS + bare MUI ThemeProvider (no CssBaseline) only around two widgets.
const VARIANT = process.env.VARIANT || 'B';
const PORTS = { A: 3001, B: 3002, C: 3003 };

const productDropdown = {
  type: 'dropdown',
  label: 'Products',
  position: 'left',
  items: [
    { label: 'Identity Platform', to: '/identity/' },
    { label: 'Integration Platform', to: '/integration/' },
  ],
};

module.exports = {
  title: `WSO2 Docs (prototype ${VARIANT})`,
  url: 'http://localhost',
  baseUrl: '/',
  onBrokenLinks: 'warn',
  customFields: { variant: VARIANT, ports: PORTS, showSwitcher: process.env.SHOW_SWITCHER === '1' },
  stylesheets: [],
  presets: [
    ['classic', {
      docs: { id: 'identity', path: 'content/identity', routeBasePath: 'identity', sidebarPath: undefined },
      blog: false,
      theme: { customCss: VARIANT === 'A' ? ['./src/css/variant-a.css'] : ['./src/css/oxygen-infima.css'] },
    }],
  ],
  plugins: [
    ['@docusaurus/plugin-content-docs', { id: 'integration', path: 'content/integration', routeBasePath: 'integration' }],
    './plugins/color-scheme-sync',
    './plugins/oxygen-webpack',
  ],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'WSO2 Docs',
      items: [
        VARIANT === 'C' ? { type: 'custom-productSwitcher', position: 'left' } : productDropdown,
        { type: 'docSidebar', docsPluginId: 'identity', sidebarId: 'defaultSidebar', label: 'Identity Platform', position: 'left' },
        { type: 'docSidebar', docsPluginId: 'integration', sidebarId: 'defaultSidebar', label: 'Integration Platform', position: 'left' },
      ],
    },
  },
};
