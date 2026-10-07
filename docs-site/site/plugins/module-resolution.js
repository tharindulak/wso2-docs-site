// The docs-site package is an ES module package ("type": "module") for its Node scripts. Webpack would then
// require file extensions on every import in site code and generated content, which content sources do not
// use (Docusaurus projects normally import without extensions). Relax that for site and content modules only.
export default function moduleResolution() {
  return {
    name: 'module-resolution',
    configureWebpack() {
      // Must not match ".mdx": Docusaurus's MDX fallback treats any rule matching it as a content rule and
      // reads its `include`. Generated content pages are always written as ".md".
      return { module: { rules: [{ test: /\.(m?js|jsx|md)$/, resolve: { fullySpecified: false } }] } };
    },
  };
}
