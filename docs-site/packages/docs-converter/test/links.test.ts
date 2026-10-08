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
  assert.deepEqual(rewriteSiteLinks(src, sites), { text: src, rewritten: 0 });
});
