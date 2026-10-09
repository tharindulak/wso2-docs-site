// Whether this page bundle can render a path itself. Older versions are separate builds (snapshots) served on the same
// domain; a client-side navigation to one would render this bundle's 404, so such links need a full page load.
export function inBundle(routes, pathname, matchRoutes) {
  const matches = matchRoutes(routes, pathname);
  const leaf = matches.at(-1)?.route;
  return Boolean(leaf) && leaf.path !== '*' && !leaf.routes;
}

/**
 * Capture-phase click handler: same-origin links to paths outside this bundle load from the server. Any error while
 * deciding (bad href, router failure) also means a full page load, never a client-side 404.
 * `env` is { routes, matchRoutes, location } (location: window.location in the browser).
 */
export function handleBundleClick(event, env) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = typeof event.target?.closest === 'function' ? event.target.closest('a[href]') : null;
  if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
  let href = anchor.href;
  try {
    const url = new URL(anchor.href, env.location.href);
    href = url.href;
    if (url.origin !== env.location.origin || inBundle(env.routes, url.pathname, env.matchRoutes)) return;
  } catch {
    // fall through to a full load
  }
  event.preventDefault();
  event.stopPropagation();
  env.location.assign(href);
}
