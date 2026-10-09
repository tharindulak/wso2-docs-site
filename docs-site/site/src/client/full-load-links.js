// Same-site links to pages this bundle does not contain (snapshot versions, or the live site from a snapshot)
// load the page from the server instead of rendering this bundle's 404.
import routes from '@generated/routes';
import { matchRoutes } from '@docusaurus/router';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import { inBundle } from '../lib/bundle-routes.mjs';

if (ExecutionEnvironment.canUseDOM) {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || inBundle(routes, url.pathname, matchRoutes)) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(url.href);
  }, true); // capture: runs before Docusaurus Link's React handler
}
