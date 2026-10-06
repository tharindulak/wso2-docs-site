// PROTOTYPE: Oxygen UI 0.15.0's ESM bundle imports 'prismjs/components/prism-*' without extensions,
// which webpack's strict ESM resolution rejects. Relax it for that package only.
// Variants B and C alias Oxygen UI to a stub (only variant A's Root and Navbar import it).
const path = require('path');
module.exports = (context) => ({
  name: 'oxygen-webpack',
  configureWebpack() {
    const stub = context.siteConfig.customFields.variant !== 'A'
      ? { resolve: { alias: { '@wso2/oxygen-ui$': path.resolve(__dirname, '../src/components/oxygen-stub.js') } } }
      : {};
    return { ...stub, module: { rules: [{ test: /[\\/]@wso2[\\/]oxygen-ui[\\/].*\.js$/, resolve: { fullySpecified: false } }] } };
  },
});
