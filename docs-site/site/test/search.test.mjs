import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  searchContext, searchFilter, groupHits, splitMarked, hitMeta, hitHref, searchPageHref, webSearchHref, readSearchConfig, hasProductScope,
  settingsFrom, isLocalHost,
  MARK_START as S, MARK_END as E,
} from '../src/lib/search.mjs';

const catalogue = {
  products: [
    { id: 'identity', name: 'Identity Platform', sections: [{ pluginId: 'identity' }] },
    { id: 'integration', name: 'Integration Platform', sections: [{ pluginId: 'integration-integrator' }, { pluginId: 'integration-mi' }] },
    { id: 'api-analytics', name: 'API Analytics Platform', href: 'https://www.moesif.com/docs/' },
  ],
};
const versionInfo = {
  identity: { sectionId: 'identity', status: 'latest' },
  'integration-mi': { sectionId: 'integration-mi', status: 'latest' },
  'integration-mi--v4-5-0': { sectionId: 'integration-mi', status: 'snapshot' },
};

test('searchContext finds the product of the viewed version', () => {
  assert.deepEqual(searchContext(catalogue, versionInfo, 'integration-mi--v4-5-0'),
    { product: 'integration', productName: 'Integration Platform', section: 'integration-mi', versionId: 'integration-mi--v4-5-0', latest: false });
  assert.equal(searchContext(catalogue, versionInfo, 'identity').latest, true);
  assert.equal(searchContext(catalogue, versionInfo, undefined), null, 'home and search pages');
  assert.equal(searchContext(catalogue, versionInfo, 'unknown'), null);
  assert.equal(searchContext(catalogue, versionInfo, 'account').product, 'account');
});

test('only product pages offer a product scope', () => {
  assert.equal(hasProductScope(searchContext(catalogue, versionInfo, 'identity')), true);
  assert.equal(hasProductScope(searchContext(catalogue, versionInfo, 'account')), false, 'hub pages search all products');
  assert.equal(hasProductScope(null), false);
});

test('searchFilter: Latest everywhere outside a product, all products', () => {
  assert.equal(searchFilter(null, 'product'), '(latest:=true)');
  assert.equal(searchFilter(searchContext(catalogue, versionInfo, 'account'), 'product'), '(latest:=true)');
});

test('searchFilter: product scope adds the hub', () => {
  const ctx = searchContext(catalogue, versionInfo, 'identity');
  assert.equal(searchFilter(ctx, 'product'), '(latest:=true) && product:=[`identity`, `account`]');
  assert.equal(searchFilter(ctx, 'all'), '(latest:=true)');
});

test('searchFilter: an older version searches that section at that version, everything else at Latest', () => {
  const ctx = searchContext(catalogue, versionInfo, 'integration-mi--v4-5-0');
  assert.equal(searchFilter(ctx, 'all'), '((latest:=true && section:!=`integration-mi`) || version_id:=`integration-mi--v4-5-0`)');
  assert.equal(searchFilter(ctx, 'product'),
    '((latest:=true && section:!=`integration-mi`) || version_id:=`integration-mi--v4-5-0`) && product:=[`integration`, `account`]');
});

test('searchFilter: deployment options are an OR, unknown values and backticks are dropped', () => {
  assert.equal(searchFilter(null, 'all', ['Self-hosted', 'WSO2 Cloud']), '(latest:=true) && deployment:=[`Self-hosted`, `WSO2 Cloud`]');
  assert.equal(searchFilter(null, 'all', ['x` || latest:=false']), '(latest:=true)');
  const hostile = { product: 'a` || product:!=`b', productName: 'x', section: 's`', versionId: 'v`', latest: false };
  assert.equal(searchFilter(hostile, 'product'), '((latest:=true && section:!=`s`) || version_id:=`v`) && product:=[`a || product:!=b`, `account`]', 'no value escapes its backticks');
});

test('groupHits: current product, then hub, then others by best hit', () => {
  let n = 0;
  const h = (product) => ({ document: { product, product_name: product.toUpperCase(), url: `/${product}/${n++}/` } });
  const groups = groupHits([h('api'), h('account'), h('identity'), h('api'), h('integration'), h('identity')], 'identity');
  assert.deepEqual(groups.map((g) => g.product), ['identity', 'account', 'api', 'integration']);
  assert.equal(groups[1].name, 'Account and billing');
  assert.equal(groups[2].hits.length, 2);
  assert.deepEqual(groupHits([h('api'), h('account')], undefined).map((g) => g.product), ['account', 'api']);
});

test('groupHits shows a heading repeated on one page once', () => {
  const d = (url, heading) => ({ document: { product: 'identity', url, heading } });
  const [g] = groupHits([d('/a/#x', 'From a SAML app'), d('/a/#x-1', 'From a SAML app'), d('/a/', ''), d('/b/#x', 'From a SAML app')], 'identity');
  assert.deepEqual(g.hits.map((h) => h.document.url), ['/a/#x', '/a/', '/b/#x']);
});

test('splitMarked renders highlights as text parts, HTML stays text', () => {
  assert.deepEqual(splitMarked(`Set up ${S}SAML${E} <b>apps</b>`), [{ text: 'Set up ', mark: false }, { text: 'SAML', mark: true }, { text: ' <b>apps</b>', mark: false }]);
  assert.deepEqual(splitMarked(undefined), []);
});

test('hitMeta shows the version only when it is not Latest', () => {
  assert.equal(hitMeta({ section_label: 'Micro Integrator', version: '4.6.0', latest: true }), 'Micro Integrator');
  assert.equal(hitMeta({ section_label: 'Micro Integrator', version: '4.5.0', latest: false }), 'Micro Integrator · 4.5.0');
  assert.equal(hitMeta({ product: 'account', section_label: 'Account and billing', latest: true }), '');
  assert.equal(hitMeta({ kind: 'link-out', section_label: '' }), '');
});

test('hitHref allows site paths and https link-outs only', () => {
  assert.equal(hitHref({ url: '/identity/guides/#x' }), '/identity/guides/#x');
  assert.equal(hitHref({ url: '//evil.example/' }), null);
  assert.equal(hitHref({ url: 'javascript:alert(1)' }), null);
  assert.equal(hitHref({ kind: 'link-out', url: 'https://www.moesif.com/docs/' }), 'https://www.moesif.com/docs/');
  assert.equal(hitHref({ kind: 'link-out', url: 'http://www.moesif.com/docs/' }), null);
});

test('searchPageHref carries scope and version only inside a product', () => {
  const ctx = searchContext(catalogue, versionInfo, 'integration-mi--v4-5-0');
  assert.equal(searchPageHref('mediator', 'product', ctx), '/search?q=mediator&scope=product&from=integration-mi--v4-5-0');
  assert.equal(searchPageHref('a&b', 'all', null), '/search?q=a%26b');
});

test('webSearchHref restricts the query to the site host', () => {
  assert.equal(webSearchHref('saml sso', 'https://wso2.com'), 'https://duckduckgo.com/?q=site%3Awso2.com+saml+sso');
});

test('readSearchConfig accepts https or local http, a plain key and collection', () => {
  assert.deepEqual(readSearchConfig({ url: 'https://search.example.com/', key: 'abcDEF123_-xyz', collection: 'docs' }), { url: 'https://search.example.com', key: 'abcDEF123_-xyz', collection: 'docs' });
  assert.equal(readSearchConfig({ url: 'http://localhost:8108', key: 'abcdefgh', collection: 'docs' }).url, 'http://localhost:8108');
  assert.equal(readSearchConfig({ url: 'http://search.example.com', key: 'abcdefgh', collection: 'docs' }), null);
  assert.equal(readSearchConfig({ url: 'https://x.example', key: 'short', collection: 'docs' }), null);
  assert.equal(readSearchConfig({ url: 'https://x.example', key: 'abcdefgh', collection: '../keys' }), null);
  assert.equal(readSearchConfig(null), null);
});

test('settingsFrom tells missing settings from invalid ones', () => {
  assert.deepEqual(settingsFrom(false, undefined), { config: null, reason: 'missing' }, '404');
  assert.deepEqual(settingsFrom(true, undefined), { config: null, reason: 'missing' }, 'an HTML page, not JSON');
  assert.deepEqual(settingsFrom(true, { url: 'http://evil.example', key: 'abcdefgh', collection: 'docs' }), { config: null, reason: 'invalid' });
  assert.deepEqual(settingsFrom(true, { url: 'http://localhost:8108', key: 'abcdefgh', collection: 'docs' }),
    { config: { url: 'http://localhost:8108', key: 'abcdefgh', collection: 'docs' }, reason: null });
});

test('isLocalHost: only loopback names get the setup hint', () => {
  assert.equal(isLocalHost('localhost'), true);
  assert.equal(isLocalHost('127.0.0.1'), true);
  assert.equal(isLocalHost('wso2.com'), false);
  assert.equal(isLocalHost('localhost.evil.example'), false);
});
