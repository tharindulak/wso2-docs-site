import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentVersion, versionHref, groups } from '../src/lib/versions.mjs';

const doc = {
  section: 'identity', latest: '7.3.0',
  versions: [
    { version: '7.3.0', label: '7.3.0 (Latest)', status: 'latest', path: '/identity/' },
    { version: '7.2.0', label: '7.2.0', status: 'live', path: '/identity/7.2.0/' },
    { version: '5.9.0', label: '5.9.0', status: 'snapshot', path: '/identity/5.9.0/' },
    { version: '5.8.0', label: '5.8.0', status: 'confluence', href: 'https://wso2docs.atlassian.net/wiki/spaces/IS580' },
  ],
};

test('currentVersion is the longest matching path', () => {
  assert.equal(currentVersion(doc, '/identity/7.2.0/guides/x/').version, '7.2.0');
  assert.equal(currentVersion(doc, '/identity/guides/x/').version, '7.3.0');
  assert.equal(currentVersion(doc, '/identity/5.9.0/').version, '5.9.0');
});

test('versionHref keeps the page when the target has it', () => {
  assert.equal(versionHref(doc, '/identity/guides/x/', doc.versions[1], ['', 'guides/x/']), '/identity/7.2.0/guides/x/');
  assert.equal(versionHref(doc, '/identity/7.2.0/guides/x/', doc.versions[0], ['guides/x/']), '/identity/guides/x/');
});

test('versionHref falls back to the version home', () => {
  assert.equal(versionHref(doc, '/identity/guides/new/', doc.versions[2], ['', 'guides/x/']), '/identity/5.9.0/');
  assert.equal(versionHref(doc, '/identity/guides/new/', doc.versions[2], null), '/identity/5.9.0/', 'pages.json unavailable');
  assert.equal(versionHref(doc, '/identity/guides/new', doc.versions[1], ['guides/new/']), '/identity/7.2.0/guides/new/', 'missing trailing slash');
});

test('versionHref falls back to the version landing when its index is excluded (pages.json home)', () => {
  const info = { pages: ['get-started/introduction/', 'guides/x/'], home: 'get-started/introduction/' };
  assert.equal(versionHref(doc, '/identity/guides/new/', doc.versions[2], info), '/identity/5.9.0/get-started/introduction/');
  assert.equal(versionHref(doc, '/identity/guides/x/', doc.versions[2], info), '/identity/5.9.0/guides/x/');
  assert.equal(versionHref(doc, '/identity/guides/new/', doc.versions[2], { pages: [], home: 'https://evil.example/' }), '/identity/5.9.0/', 'home must be a relative page path');
  assert.equal(versionHref(doc, '/identity/guides/new/', doc.versions[2], { pages: [], home: '../x/' }), '/identity/5.9.0/');
});

test('Confluence versions open their own link', () => {
  assert.equal(versionHref(doc, '/identity/guides/x/', doc.versions[3], null), 'https://wso2docs.atlassian.net/wiki/spaces/IS580');
});

test('groups: Latest, previous (live and snapshots), older (Confluence)', () => {
  const g = groups(doc);
  assert.deepEqual([g.current, g.previous, g.older].map((l) => l.map((v) => v.version)), [['7.3.0'], ['7.2.0', '5.9.0'], ['5.8.0']]);
});
