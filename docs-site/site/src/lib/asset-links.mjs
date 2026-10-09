// Links to files must not get trailingSlash: `x.png/` 404s on a static host. They are Markdown links to files
// (Docusaurus requires them to /assets/files/<name>-<hash>.<ext> and marks them data-noBrokenLinkCheck) and HTML
// links into a version's assets/ directory. pathname:// is Docusaurus Link's escape hatch: the base URL is kept,
// the trailing slash and client routing are skipped.

const ASSET_FILE = /\/assets\/(?:[^/?#]+\/)*[^/?#]+\.[A-Za-z0-9]+(?:[?#]|$)/;

/** The href to give Docusaurus Link for MDX link props. */
export function assetHref(props) {
  const { href } = props;
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
  return props['data-noBrokenLinkCheck'] || ASSET_FILE.test(href) ? `pathname://${href}` : href;
}
