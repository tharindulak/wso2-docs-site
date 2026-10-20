import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteUrl, noIndex, siteKeySuffix, DEFAULT_SITE_URL } from '../src/lib/site-url.mjs';

test('site URL: wso2.com unless a deploy names an https origin', () => {
  assert.equal(siteUrl({}), DEFAULT_SITE_URL);
  assert.equal(siteUrl({ DOCS_SITE_URL: 'https://141-148-145-173.sslip.io' }), 'https://141-148-145-173.sslip.io');
  for (const bad of ['http://example.com', 'https://example.com/', 'https://example.com/docs', 'https://Example.com', 'javascript:alert(1)', 'https://-a.com'])
    assert.throws(() => siteUrl({ DOCS_SITE_URL: bad }), /https origin/, bad);
});

test('noindex and the snapshot key suffix; the default site keeps an empty suffix', () => {
  assert.equal(noIndex({}), false);
  assert.equal(noIndex({ DOCS_NO_INDEX: '1' }), true);
  assert.equal(siteKeySuffix({}), '', 'keys stored before these settings stay valid');
  assert.equal(siteKeySuffix({ DOCS_SITE_URL: 'https://a.example', DOCS_NO_INDEX: '1' }), '+url=https://a.example+noindex');
  assert.notEqual(siteKeySuffix({ DOCS_NO_INDEX: '1' }), siteKeySuffix({}));
});
