import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteSiteLinks } from '../src/links.js';

const hosted = new Set(['', 'get-started/overview', 'deploy/install']);
const sites = [
  { prefix: 'https://mi.docs.wso2.com/en/latest/', route: 'integration/micro-integrator', hosts: (p: string) => hosted.has(p) },
  { prefix: 'https://mi.docs.wso2.com/en/4.7.0/', route: 'integration/micro-integrator', hosts: (p: string) => hosted.has(p) },
];

test('links to hosted Latest pages become internal; anchors kept', () => {
  const { text, rewritten } = rewriteSiteLinks('See [overview](https://mi.docs.wso2.com/en/latest/get-started/overview/#steps) and <a href="https://mi.docs.wso2.com/en/4.7.0/deploy/install">install</a>, <a href={"https://mi.docs.wso2.com/en/latest"}>home</a>.', sites);
  assert.equal(text, 'See [overview](/integration/micro-integrator/get-started/overview/#steps) and <a href="/integration/micro-integrator/deploy/install/">install</a>, <a href={"/integration/micro-integrator/"}>home</a>.');
  assert.equal(rewritten, 3);
});

test('older releases, pages not hosted, other sites and code samples stay as they are', () => {
  const src = '[old](https://mi.docs.wso2.com/en/4.2.0/get-started/overview/) [gone](https://mi.docs.wso2.com/en/latest/not/here/) [ext](https://example.com/x) `curl https://mi.docs.wso2.com/en/latest/deploy/install/`\n\n```\n[x](https://mi.docs.wso2.com/en/latest/deploy/install/)\n```';
  assert.deepEqual(rewriteSiteLinks(src, sites), { text: src, rewritten: 0, files: [] });
});

const files = new Set(['assets/img/learn/operations.png', 'assets/files/a b.zip']);
const apim = [
  { prefix: 'https://apim.docs.wso2.com/en/4.6.0/', route: 'api-manager/4.6.0', hosts: (p: string) => p === 'administer/users' || p === '', hasFile: (p: string) => files.has(p) },
];

test('root-relative former-site paths on the version\'s own host resolve like full URLs, assets included', () => {
  const src = [
    '[![Ops](/en/4.6.0/assets/img/learn/operations.png)](/en/4.6.0/assets/img/learn/operations.png)',
    '<a href="/en/4.6.0/administer/users/#add">Users</a> <img src="/en/4.6.0/assets/img/learn/operations.png" />',
    '[zip](/en/4.6.0/assets/files/a%20b.zip)',
  ].join('\n');
  const { text, rewritten, files: copied } = rewriteSiteLinks(src, apim, { origin: 'https://apim.docs.wso2.com' });
  assert.equal(text, [
    '[![Ops](/api-manager/4.6.0/assets/img/learn/operations.png)](/api-manager/4.6.0/assets/img/learn/operations.png)',
    '<a href="/api-manager/4.6.0/administer/users/#add">Users</a> <img src="/api-manager/4.6.0/assets/img/learn/operations.png" />',
    '[zip](/api-manager/4.6.0/assets/files/a%20b.zip)',
  ].join('\n'));
  assert.equal(rewritten, 5);
  assert.deepEqual([...new Set(copied.map((f) => f.path))].sort(), ['assets/files/a b.zip', 'assets/img/learn/operations.png']);
  assert.equal(copied[0]!.site, apim[0]);
});

test('root-relative former-site paths not hosted here go to the former site, as the full URL would', () => {
  const src = '[old](/en/4.5.0/administer/users/) [missing](/en/4.6.0/not/here/) ![gone](/en/4.6.0/assets/none.png) [bare](/install-and-setup/x/) `[c](/en/4.6.0/administer/users/)`';
  const { text, rewritten, files: copied } = rewriteSiteLinks(src, apim, { origin: 'https://apim.docs.wso2.com' });
  assert.equal(text, '[old](https://apim.docs.wso2.com/en/4.5.0/administer/users/) [missing](https://apim.docs.wso2.com/en/4.6.0/not/here/) ![gone](https://apim.docs.wso2.com/en/4.6.0/assets/none.png) [bare](/install-and-setup/x/) `[c](/en/4.6.0/administer/users/)`');
  assert.equal(rewritten, 3, 'each link sent to the former site is a change the caller must write');
  assert.deepEqual(copied, []);
});

test('a page whose only root-relative link is not hosted is still reported as changed', () => {
  const src = 'See [old](/en/4.5.0/administer/users/).';
  const { text, rewritten } = rewriteSiteLinks(src, apim, { origin: 'https://apim.docs.wso2.com' });
  assert.equal(text, 'See [old](https://apim.docs.wso2.com/en/4.5.0/administer/users/).');
  assert.equal(rewritten, 1);
});

test('without an origin, root-relative paths stay; full URLs to files stay external; no path escapes the section', () => {
  const src = '[a](/en/4.6.0/administer/users/) [f](https://apim.docs.wso2.com/en/4.6.0/assets/img/learn/operations.png)';
  assert.equal(rewriteSiteLinks(src, apim).text, src);
  const escape = [
    '![x](/en/4.6.0/assets/../../../../etc/passwd) ![y](/en/4.6.0/assets/%2e%2e/%2e%2e/secret.png)',
    '![b](/en/4.6.0/assets\\..\\..\\secret.png) ![c](/en/4.6.0/assets/..%5c..%5csecret.png) ![d](/en/4.6.0/assets/..%2f..%2fsecret.png)',
    '![e](/en/4.6.0/assets/%5C..%5Csecret.png) ![f](/en/4.6.0/assets/x%2Fy.png)',
  ].join(' ');
  const seen: string[] = [];
  const probing = [{ ...apim[0]!, hasFile: (p: string) => { seen.push(p); return true; } }];
  const out = rewriteSiteLinks(escape, probing, { origin: 'https://apim.docs.wso2.com' });
  assert.deepEqual(out.files, []);
  assert.deepEqual(seen, []);
});
