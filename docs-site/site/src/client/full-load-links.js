// Same-site links to pages this bundle does not contain (snapshot versions, or the live site from a snapshot)
// load the page from the server instead of rendering this bundle's 404.
// matchRoutes comes from react-router-config (as Docusaurus's own preload.js does): @docusaurus/router does not export it.
import routes from '@generated/routes';
import { matchRoutes } from 'react-router-config';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import { handleBundleClick } from '../lib/bundle-routes.mjs';

if (ExecutionEnvironment.canUseDOM) {
  document.addEventListener('click', (event) => handleBundleClick(event, { routes, matchRoutes, location: window.location }), true); // capture: runs before Docusaurus Link's React handler
}
