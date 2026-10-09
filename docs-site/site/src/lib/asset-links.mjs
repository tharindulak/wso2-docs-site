// Markdown links to files (Docusaurus requires them to /assets/files/<name>-<hash>.<ext> and marks them
// data-noBrokenLinkCheck) must not get trailingSlash: `x.png/` 404s on a static host. pathname:// is
// Docusaurus Link's escape hatch: the base URL is kept, the trailing slash and client routing are skipped.

/** The href to give Docusaurus Link for MDX link props. */
export function assetHref(props) {
  const { href } = props;
  if (!props['data-noBrokenLinkCheck'] || typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
  return `pathname://${href}`;
}
