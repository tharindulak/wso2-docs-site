import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { redirectMaps, redirectTarget, redirectPageHtml, redirectPageTarget, collapseRedirects, writeRedirectPages, type RedirectContext } from '../src/redirects.js';

const published = new Set(['get-started/streaming-quick-start-guide.md', 'get-started/api-manager-quick-start-guide.md', 'index.md', 'guides/index.md']);
const ctx: RedirectContext = {
  route: 'api-platform/api-manager/4.2.0',
  currentSite: 'https://apim.docs.wso2.com/en/4.2.0/',
  toSection: (p) => (p.startsWith('skipped/') ? null : p),
  hostedUrl: (p) => (published.has(p) ? p.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '/') : null),
};

test('redirectMaps reads the redirects plugin, ignoring other plugins and non-string targets', () => {
  const config = { plugins: ['search', { 'markdownextradata': {} }, { redirects: { redirect_maps: { 'a.md': 'b.md', 'c.md': 3, 'd.md': 'https://x.example/' } } }] };
  assert.deepEqual(redirectMaps(config), [['a.md', 'b.md'], ['d.md', 'https://x.example/']]);
  assert.deepEqual(redirectMaps({}), []);
  assert.deepEqual(redirectMaps({ plugins: [{ redirects: null }] }), []);
});

test('redirectTarget: former-site URLs and page paths go to the page here when it is published', () => {
  assert.equal(redirectTarget('https://apim.docs.wso2.com/en/4.2.0/get-started/streaming-quick-start-guide/', ctx), '/api-platform/api-manager/4.2.0/get-started/streaming-quick-start-guide/');
  assert.equal(redirectTarget('https://apim.docs.wso2.com/en/4.2.0/guides/', ctx), '/api-platform/api-manager/4.2.0/guides/', 'folder index page');
  assert.equal(redirectTarget('https://apim.docs.wso2.com/en/4.2.0/', ctx), '/api-platform/api-manager/4.2.0/', 'home page');
  assert.equal(redirectTarget('get-started/api-manager-quick-start-guide.md#step-1', ctx), '/api-platform/api-manager/4.2.0/get-started/api-manager-quick-start-guide/#step-1');
});

test('redirectTarget: unpublished pages go to the former site; other https sites stay as written', () => {
  assert.equal(redirectTarget('https://apim.docs.wso2.com/en/4.2.0/not/here/', ctx), 'https://apim.docs.wso2.com/en/4.2.0/not/here/');
  assert.equal(redirectTarget('not/here.md', ctx), 'https://apim.docs.wso2.com/en/4.2.0/not/here/');
  assert.equal(redirectTarget('https://mi.docs.wso2.com/en/4.3.0/get-started/quick-start-guide', ctx), 'https://mi.docs.wso2.com/en/4.3.0/get-started/quick-start-guide');
});

test('redirectTarget refuses other schemes, absolute and escaping paths', () => {
  for (const to of ['javascript:alert(1)', 'http://apim.docs.wso2.com/en/4.2.0/x/', '/etc/passwd.md', '../outside.md', 'data:text/html,x', 'https://x.example/"><script>', 'page']) {
    assert.equal(redirectTarget(to, ctx), null, to);
  }
});

test('writeRedirectPages writes one page per old URL the section owns, never over a real page', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'redirects-'));
  const maps: Array<[string, string]> = [
    ['get-started/quick-start-guide/streaming-qsg.md', 'https://apim.docs.wso2.com/en/4.2.0/get-started/streaming-quick-start-guide/'],
    ['get-started/quick-start-guide/integration-qsg.md', 'https://mi.docs.wso2.com/en/4.3.0/get-started/quick-start-guide'],
    ['get-started/api-manager-quick-start-guide.md', 'index.md'], // still a published page: left alone
    ['skipped/old.md', 'index.md'], // another section's page
    ['../escape.md', 'index.md'],
    ['old/README.md', 'guides/index.md'],
    ['bad.md', 'javascript:alert(1)'],
  ];
  assert.equal(writeRedirectPages(maps, dir, ctx), 3);
  const page = (p: string): string => fs.readFileSync(path.join(dir, p, 'index.html'), 'utf8');
  assert.match(page('get-started/quick-start-guide/streaming-qsg'), /url=\/api-platform\/api-manager\/4\.2\.0\/get-started\/streaming-quick-start-guide\//);
  assert.match(page('get-started/quick-start-guide/integration-qsg'), /url=https:\/\/mi\.docs\.wso2\.com\/en\/4\.3\.0\/get-started\/quick-start-guide/);
  assert.match(page('old'), /url=\/api-platform\/api-manager\/4\.2\.0\/guides\//);
  for (const p of ['get-started/api-manager-quick-start-guide', 'skipped/old', 'bad']) assert.equal(fs.existsSync(path.join(dir, p, 'index.html')), false, p);
  assert.equal(fs.existsSync(path.join(path.dirname(dir), 'escape')), false);
  assert.equal(writeRedirectPages(maps, dir, ctx), 0, 'existing files are kept');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('redirectPageHtml escapes the target and is not indexed', () => {
  const html = redirectPageHtml('/a/?x="1"&y=<2>');
  assert.match(html, /url=\/a\/\?x=&quot;1&quot;&amp;y=&lt;2&gt;/);
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test('redirectPageTarget reads only the pages redirectPageHtml writes', () => {
  assert.equal(redirectPageTarget(redirectPageHtml('https://x.example/a?b=1&c=2')), 'https://x.example/a?b=1&c=2');
  assert.equal(redirectPageTarget(redirectPageHtml('/p/a/#s')), '/p/a/#s');
  assert.equal(redirectPageTarget('<html><head><meta http-equiv="refresh" content="0; url=https://x.example/"></head></html>'), null);
});

test('collapseRedirects sends each old URL to the end of its chain and leaves loops and self-targets alone', () => {
  const pages = new Map([
    ['/p/a/', '/p/b/'], ['/p/b/', '/p/c/#part'], ['/p/c/', '/p/page/'], // a -> b -> c -> page
    ['/p/x/', '/p/y/'], ['/p/y/', '/p/x/'], // a loop
    ['/p/s/', '/p/t/'], ['/p/t/', '/p/s/'],
    ['/p/out/', 'https://old.example/gone/'],
    ['/p/in/', '/p/out/'],
  ]);
  assert.deepEqual(Object.fromEntries(collapseRedirects(pages)), { '/p/a/': '/p/page/', '/p/b/': '/p/page/', '/p/in/': 'https://old.example/gone/' });
});
