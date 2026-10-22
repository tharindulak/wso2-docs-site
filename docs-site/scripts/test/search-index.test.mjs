import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pagePath, versionIndex, pageRecords, linkOutRecords, badgesFor, buildRecords, recordsWithBadges, writeConfig, writeRelease, SCHEMA } from '../search-index.mjs';

const manifest = {
  products: [
    {
      id: 'integration', name: 'Integration Platform', sections: [{
        id: 'integration-mi', label: 'Micro Integrator', versions: [
          { id: 'integration-mi', version: '4.6.0', status: 'latest' },
          { id: 'integration-mi--v4-5-0', version: '4.5.0', status: 'snapshot' },
          { id: 'integration-mi--v4-0-0', version: '4.0.0', status: 'confluence' },
        ],
      }],
    },
  ],
  linkOut: [
    { id: 'api-analytics', name: 'API Analytics Platform', blurb: 'Powered by Moesif.', href: 'https://www.moesif.com/docs/' },
    { id: 'bad', name: 'Bad', href: 'javascript:alert(1)' },
  ],
};

const page = ({ tag = 'integration-mi', meta = '', body }) => `<!doctype html><html><head>
<meta data-rh="true" name="docusaurus_tag" content="docs-${tag}-current">${meta}
<meta data-rh="true" name="description" content="Page description."></head><body>
<nav class="navbar">Products Search</nav>
<article><nav class="theme-doc-breadcrumbs" aria-label="Breadcrumbs"><ul><li><a>Home</a></li><li>Guides</li><li>Mediators</li></ul></nav>
<div class="older-version-banner">You're viewing 4.5.0.</div>
<div class="deployment-box"><strong>Deployment options:</strong> WSO2 Cloud, Self-hosted</div>
<div class="theme-doc-markdown markdown">${body}</div>
<footer class="theme-doc-footer">Edit this page</footer></article>
<nav class="pagination-nav">Next</nav></body></html>`;

test('pagePath maps built files to site paths', () => {
  assert.equal(pagePath('identity/guides/index.html'), '/identity/guides/');
  assert.equal(pagePath('index.html'), '/');
  assert.equal(pagePath('identity/x.html'), '/identity/x');
});

test('versionIndex maps version ids to product, section and Latest; confluence versions have no pages', () => {
  const index = versionIndex(manifest);
  assert.deepEqual(index.get('integration-mi--v4-5-0'), { product: 'integration', productName: 'Integration Platform', section: 'integration-mi', sectionLabel: '', version: '4.5.0', latest: false }, 'one section: no label');
  const two = versionIndex({ products: [{ ...manifest.products[0], sections: [...manifest.products[0].sections, { id: 'integration-bi', label: 'BI', versions: [{ id: 'integration-bi', status: 'latest' }] }] }] });
  assert.equal(two.get('integration-mi').sectionLabel, 'Micro Integrator');
  assert.equal(index.get('integration-mi').latest, true);
  assert.equal(index.has('integration-mi--v4-0-0'), false);
  assert.equal(index.get('account').productName, 'Account and billing');
});

test('products and the hub hidden from navigation are built but not searchable, and not reported as unknown', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-index-'));
  const write = (file, html) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), html); };
  write('integration/micro-integrator/a/index.html', page({ body: '<h1>A</h1>' }));
  write('account/index.html', page({ tag: 'account', body: '<h1>Account</h1>' }));
  const hidden = { ...manifest, hiddenFromNavigation: ['integration', 'account'] };
  assert.equal(versionIndex(hidden).get('integration-mi').hidden, true);
  assert.equal(versionIndex(manifest).get('integration-mi').hidden, undefined);
  const warnings = [];
  assert.deepEqual([...buildRecords(dir, hidden, (w) => warnings.push(w))].map((r) => r.url), ['https://www.moesif.com/docs/']);
  assert.deepEqual([...buildRecords(dir, manifest)].map((r) => r.url), ['/account/', '/integration/micro-integrator/a/', 'https://www.moesif.com/docs/']);
  assert.deepEqual(warnings, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('pageRecords: one page record, one per h2/h3, chrome left out', () => {
  const where = { ...versionIndex(manifest).get('integration-mi'), versionId: 'integration-mi' };
  const html = page({ body: `<header><h1>Mediators</h1></header><p>Intro <code>text</code>.</p>
    <h2 class="anchor" id="call-mediator">Call mediator<a class="hash-link" href="#call-mediator">​</a></h2><p>Calls an endpoint.</p><ul><li>one</li><li>two</li></ul>
    <h3 id="syntax">Syntax</h3><pre><code>&lt;call/&gt;</code></pre><button>Copy</button><h4>Detail</h4><p>More.</p>` });
  const records = pageRecords(html, '/integration/micro-integrator/mediators/', where);
  assert.equal(records.length, 3);
  const [p, s1, s2] = records;
  assert.deepEqual({ url: p.url, kind: p.kind, rank: p.rank, title: p.title, heading: p.heading, content: p.content },
    { url: '/integration/micro-integrator/mediators/', kind: 'page', rank: 2, title: 'Mediators', heading: '', content: 'Intro text.' });
  assert.equal(p.crumbs, 'Home › Guides › Mediators');
  assert.deepEqual(p.deployment, ['WSO2 Cloud', 'Self-hosted'], 'from the box when the meta is absent');
  assert.deepEqual({ url: s1.url, heading: s1.heading, content: s1.content, kind: s1.kind }, { url: '/integration/micro-integrator/mediators/#call-mediator', heading: 'Call mediator', content: 'Calls an endpoint. one two', kind: 'section' });
  assert.equal(s2.content, '<call/> Detail More.', 'h4 and below stay in the section; buttons are left out');
  for (const r of records) assert.ok(!/Edit this page|Next|viewing|Products|Deployment options/.test(r.content), 'no page chrome');
  assert.equal(new Set(records.map((r) => r.id)).size, 3);
});

test('pageRecords: the lifecycle pill beside the title is page chrome, not content', () => {
  const where = { ...versionIndex(manifest).get('integration-mi'), versionId: 'integration-mi' };
  const html = page({ body: '<header><h1>Roles v1 API</h1></header><p>Old roles.</p>' })
    .replace('<div class="theme-doc-markdown', '<span class="lifecycle-pill lifecycle-pill--title lifecycle--deprecated" title="Still works">Deprecated</span><div class="theme-doc-markdown');
  const [p] = pageRecords(html, '/identity/apis/roles-v1/', where);
  assert.equal(p.content, 'Old roles.');
});

test('pageRecords prefers the wso2:deployment meta and drops unknown options', () => {
  const where = { ...versionIndex(manifest).get('integration-mi'), versionId: 'integration-mi' };
  const [r] = pageRecords(page({ meta: '<meta data-rh="true" name="wso2:deployment" content="Self-hosted,Other">', body: '<h1>T</h1><p>x</p>' }), '/a/', where);
  assert.deepEqual(r.deployment, ['Self-hosted']);
});

test('pageRecords: redirect pages and pages without an article give nothing; empty intros use the description', () => {
  const where = { ...versionIndex(manifest).get('integration-mi'), versionId: 'integration-mi' };
  assert.deepEqual(pageRecords(page({ meta: '<meta http-equiv="refresh" content="0; url=https://x">', body: '<h1>T</h1>' }), '/a/', where), []);
  assert.deepEqual(pageRecords(page({ meta: '<meta name="robots" content="noindex">', body: '<h1>T</h1>' }), '/a/', where), []);
  assert.deepEqual(pageRecords('<html><body><p>no article</p></body></html>', '/a/', where), []);
  assert.equal(pageRecords(page({ body: '<h1>T</h1><h2 id="a">A</h2><p>x</p>' }), '/a/', where)[0].content, 'Page description.');
});

test('pageRecords: the site-wide noindex of a DOCS_NO_INDEX build does not empty the index; page-level noindex still does', () => {
  const where = { ...versionIndex(manifest).get('integration-mi'), versionId: 'integration-mi' };
  const site = page({ meta: '<meta data-rh="true" name="robots" content="noindex, nofollow">', body: '<h1>T</h1><p>x</p>' });
  const excluded = page({ meta: '<meta data-rh="true" name="robots" content="noindex">', body: '<h1>T</h1><p>x</p>' });
  assert.equal(pageRecords(site, '/a/', where, { siteNoIndex: true }).length, 1);
  assert.deepEqual(pageRecords(site, '/a/', where), []);
  assert.deepEqual(pageRecords(excluded, '/a/', where, { siteNoIndex: true }), []);
});

test('linkOutRecords: one record per https link-out product', () => {
  const records = linkOutRecords(manifest);
  assert.equal(records.length, 1);
  assert.deepEqual({ url: records[0].url, title: records[0].title, kind: records[0].kind, latest: records[0].latest, content: records[0].content },
    { url: 'https://www.moesif.com/docs/', title: 'API Analytics Platform', kind: 'link-out', latest: true, content: 'Docs for API Analytics Platform are on moesif.com. Powered by Moesif.' });
});

test('badgesFor: shown only when a page lacks some option its product has', () => {
  const options = new Map([['identity', new Set(['WSO2 Cloud', 'Self-hosted'])], ['healthcare', new Set(['Self-hosted'])]]);
  assert.deepEqual(badgesFor({ product: 'identity', deployment: ['Self-hosted'] }, options), ['Self-hosted']);
  assert.deepEqual(badgesFor({ product: 'identity', deployment: ['WSO2 Cloud', 'Self-hosted'] }, options), []);
  assert.deepEqual(badgesFor({ product: 'healthcare', deployment: ['Self-hosted'] }, options), [], 'one option for the whole product says nothing');
  assert.deepEqual(badgesFor({ product: 'identity', deployment: [] }, options), []);
});

test('buildRecords and recordsWithBadges over a build directory', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-index-'));
  const write = (file, html) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), html); };
  write('index.html', '<html><head></head><body><h1>Home</h1></body></html>');
  write('integration/micro-integrator/a/index.html', page({ body: '<h1>A</h1><p>both</p>' }));
  write('integration/micro-integrator/4.5.0/b/index.html', page({ tag: 'integration-mi--v4-5-0', meta: '<meta name="wso2:deployment" content="Self-hosted">', body: '<h1>B</h1><p>old</p>' }));
  write('other/index.html', page({ tag: 'removed-section', body: '<h1>C</h1>' }));
  const warnings = [];
  const plain = [...buildRecords(dir, manifest, (w) => warnings.push(w))];
  assert.deepEqual(plain.map((r) => r.url), ['/integration/micro-integrator/4.5.0/b/', '/integration/micro-integrator/a/', 'https://www.moesif.com/docs/']);
  assert.deepEqual(warnings, ['skipped 1 pages of unknown version id removed-section']);
  const records = [];
  for await (const r of recordsWithBadges(dir, manifest, path.join(dir, 'records.jsonl'))) records.push(r);
  assert.deepEqual(records.map((r) => [r.version_id, r.latest, r.badges]), [
    ['integration-mi--v4-5-0', false, ['Self-hosted']], ['integration-mi', true, []], ['api-analytics', true, []],
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('writeRelease writes the records and the schema the gate indexes, inside the build', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-release-'));
  async function* records() { yield { id: 'a', title: 'A' }; yield { id: 'b', title: 'B' }; }
  assert.equal(await writeRelease(records(), dir), 2);
  const lines = fs.readFileSync(path.join(dir, '_search/records.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((r) => r.id), ['a', 'b']);
  const schema = JSON.parse(fs.readFileSync(path.join(dir, '_search/schema.json'), 'utf8'));
  assert.deepEqual(schema, JSON.parse(JSON.stringify(SCHEMA)));
  assert.equal(schema.name, undefined, 'the gate names the collection');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('writeConfig writes the same validated settings into every directory, creating it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-config-'));
  const build = path.join(dir, 'build');
  const local = path.join(dir, 'cache', 'search-public');
  fs.mkdirSync(build);
  writeConfig([build, local], 'http://localhost:8108/', 'abcdefgh12');
  for (const d of [build, local]) assert.deepEqual(JSON.parse(fs.readFileSync(path.join(d, 'search-config.json'), 'utf8')), { url: 'http://localhost:8108', key: 'abcdefgh12', collection: 'docs' });
  assert.throws(() => writeConfig([build], 'http://search.example.com', 'abcdefgh12'), /https/);
  fs.rmSync(dir, { recursive: true, force: true });
});
