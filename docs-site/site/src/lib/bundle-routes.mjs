// Whether this page bundle can render a path itself. Older versions are separate builds (snapshots) served on the same
// domain; a client-side navigation to one would render this bundle's 404, so such links need a full page load.
export function inBundle(routes, pathname, matchRoutes) {
  const matches = matchRoutes(routes, pathname);
  const leaf = matches.at(-1)?.route;
  return Boolean(leaf) && leaf.path !== '*' && !leaf.routes;
}
