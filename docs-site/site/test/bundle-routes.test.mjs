import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { inBundle } from '../src/lib/bundle-routes.mjs';

// react-router-config is what @docusaurus/router's matchRoutes re-exports; resolvable from docs-site.
const { matchRoutes } = createRequire(import.meta.url)('react-router-config');
const routes = [
  { path: '/identity/7.2.0', routes: [{ path: '/identity/7.2.0/', exact: true }, { path: '/identity/7.2.0/guides/', exact: true }] },
  { path: '/identity', routes: [{ path: '/identity/', exact: true }, { path: '/identity/guides/', exact: true }] },
  { path: '/', exact: true },
  { path: '*' },
];

test('pages in the bundle are client-side routes', () => {
  assert.equal(inBundle(routes, '/identity/guides/', matchRoutes), true);
  assert.equal(inBundle(routes, '/identity/7.2.0/guides/', matchRoutes), true);
  assert.equal(inBundle(routes, '/', matchRoutes), true);
});

test('outside routes are not in the bundle', () => {
  assert.equal(inBundle(routes, '/identity/7.1.0/guides/', matchRoutes), false, 'snapshot under a live parent route');
  assert.equal(inBundle(routes, '/integration/micro-integrator/', matchRoutes), false, 'catch-all only');
});
