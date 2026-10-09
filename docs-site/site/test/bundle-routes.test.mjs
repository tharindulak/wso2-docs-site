import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { inBundle, handleBundleClick } from '../src/lib/bundle-routes.mjs';

const require = createRequire(import.meta.url);
const { matchRoutes } = require('react-router-config');
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

// Resolves a client-module import the way Docusaurus's webpack aliases do (@docusaurus/X -> core client exports).
function resolveClientImport(spec) {
  if (spec.startsWith('@docusaurus/')) return require.resolve(`@docusaurus/core/lib/client/exports/${spec.slice('@docusaurus/'.length)}.js`);
  if (spec.startsWith('.')) return new URL(spec, pathToFileURL(require.resolve('../src/client/full-load-links.js'))).pathname;
  return require.resolve(spec);
}

test('every named import of the click-guard client module exists in its source module', async () => {
  // A missing named export only warns in webpack and becomes undefined at run time (matchRoutes from @docusaurus/router did).
  const src = readFileSync(new URL('../src/client/full-load-links.js', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import\s+(.+?)\s+from\s+'([^']+)';/gm)];
  assert.ok(imports.length >= 3);
  for (const [, clause, spec] of imports) {
    if (spec.startsWith('@generated/')) continue;
    const mod = await import(pathToFileURL(resolveClientImport(spec)).href);
    const named = /\{([^}]*)\}/.exec(clause)?.[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean) ?? [];
    for (const name of named) assert.equal(typeof mod[name], 'function', `${spec} exports ${name}`);
    if (!clause.trim().startsWith('{')) assert.ok(mod.default !== undefined, `${spec} has a default export`);
  }
});

function click(href, { target = '', button = 0 } = {}) {
  const calls = { prevented: false, stopped: false };
  const anchor = { href, target, hasAttribute: () => false };
  const event = {
    defaultPrevented: false, button, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    target: { closest: () => anchor },
    preventDefault() { calls.prevented = true; },
    stopPropagation() { calls.stopped = true; },
  };
  return { event, calls };
}

function env(overrides = {}) {
  const assigned = [];
  const location = { href: 'https://docs.example/identity/7.2.0/', origin: 'https://docs.example', assign: (u) => assigned.push(u) };
  return { assigned, env: { routes, matchRoutes, location, ...overrides } };
}

test('a link outside the bundle loads from the server', () => {
  const { event, calls } = click('https://docs.example/identity/7.1.0/guides/');
  const { assigned, env: e } = env();
  handleBundleClick(event, e);
  assert.equal(calls.prevented, true);
  assert.deepEqual(assigned, ['https://docs.example/identity/7.1.0/guides/']);
});

test('a link inside the bundle and an external link are left to the browser and Link', () => {
  for (const href of ['https://docs.example/identity/guides/', 'https://other.example/x/']) {
    const { event, calls } = click(href);
    const { assigned, env: e } = env();
    handleBundleClick(event, e);
    assert.equal(calls.prevented, false, href);
    assert.deepEqual(assigned, []);
  }
});

test('an error while deciding means a full page load, not a client-side 404', () => {
  const { event, calls } = click('https://docs.example/identity/guides/');
  const { assigned, env: e } = env({ matchRoutes: undefined });
  handleBundleClick(event, e);
  assert.equal(calls.prevented, true);
  assert.deepEqual(assigned, ['https://docs.example/identity/guides/']);
});
