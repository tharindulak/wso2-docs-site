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

test('an HTML link to a file under an assets directory bypasses trailingSlash too', () => {
  assert.equal(assetHref({ href: '/integration/micro-integrator/4.3.0/assets/img/x/new.png' }), 'pathname:///integration/micro-integrator/4.3.0/assets/img/x/new.png');
  assert.equal(assetHref({ href: '/identity/assets/attachments/a.zip?dl=1' }), 'pathname:///identity/assets/attachments/a.zip?dl=1');
  assert.equal(assetHref({ href: '/identity/assets/guide/' }), '/identity/assets/guide/', 'a page under an assets-like path');
  assert.equal(assetHref({ href: '/identity/guides/oauth-2.0-grant' }), '/identity/guides/oauth-2.0-grant', 'dotted page outside assets');
});

test('a relative HTML link to a file under assets/ bypasses trailingSlash; schemes and anchors are unchanged', () => {
  assert.equal(assetHref({ href: '../../../assets/img/qsg/build-and-run.png' }), 'pathname://../../../assets/img/qsg/build-and-run.png');
  assert.equal(assetHref({ href: 'assets/a.zip' }), 'pathname://assets/a.zip');
  assert.equal(assetHref({ href: '../guide/' }), '../guide/');
  assert.equal(assetHref({ href: 'mailto:a@b.assets/x.png' }), 'mailto:a@b.assets/x.png');
  assert.equal(assetHref({ href: '#assets/x.png' }), '#assets/x.png');
});
