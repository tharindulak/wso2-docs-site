import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetHref } from '../src/lib/asset-links.mjs';

test('a Markdown link to a file (Docusaurus marks it data-noBrokenLinkCheck) bypasses trailingSlash', () => {
  assert.equal(assetHref({ href: '/assets/files/x-0a1b.png', 'data-noBrokenLinkCheck': true }), 'pathname:///assets/files/x-0a1b.png');
  assert.equal(assetHref({ href: '/assets/files/a.zip#part', 'data-noBrokenLinkCheck': true }), 'pathname:///assets/files/a.zip#part');
});

test('page links, external links and already-escaped links are unchanged', () => {
  assert.equal(assetHref({ href: '/identity/guides/' }), '/identity/guides/');
  assert.equal(assetHref({ href: '/identity/7.2.0' }), '/identity/7.2.0', 'a version route is a page, not a file');
  assert.equal(assetHref({ href: 'https://x.org/a.zip', 'data-noBrokenLinkCheck': true }), 'https://x.org/a.zip');
  assert.equal(assetHref({ href: 'pathname:///a.zip', 'data-noBrokenLinkCheck': true }), 'pathname:///a.zip');
  assert.equal(assetHref({}), undefined);
});
