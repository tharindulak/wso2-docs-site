import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMdx } from '../src/syntax.js';

test('admonitions, including titled and nested in lists', () => {
  const { body } = toMdx('!!! warning "Before you start"\n    Read this.\n\n1. Step\n\n    !!! note\n        Inside.\n');
  assert.match(body, /^:::warning\[Before you start\]\n\nRead this\.\n\n:::/m);
  assert.match(body, /^ {4}:::note\n\n {4}Inside\.\n\n {4}:::/m);
});

test('collapsibles and tabs', () => {
  const { body, usesTabs } = toMdx('??? tip "More"\n    Hidden.\n\n=== "Java"\n    ```java\n    a();\n    ```\n\n=== "Go"\n    b\n');
  assert.match(body, /<details>\n<summary>More<\/summary>/);
  assert.match(body, /<Tabs>\n<TabItem value="tab-0" label="Java">/);
  assert.match(body, /<TabItem value="tab-1" label="Go">/);
  assert.equal(usesTabs, true);
});

test('code is never rewritten; fence attributes become Docusaurus metadata', () => {
  const { body } = toMdx('```js hl_lines="1 3" title="a.js"\nconst x = {a: 1}; // <b>\n```\nUse `{x}` and <b>bold</b>.');
  assert.match(body, /```js title="a\.js" \{1,3\}\nconst x = \{a: 1\}; \/\/ <b>\n```/);
  assert.match(body, /Use `\{x\}` and <b>bold<\/b>\./);
});

test('escapes braces and unknown tags in prose; fixes HTML for JSX', () => {
  const { body } = toMdx('Set {org_name} for <tenant-domain>.\n<img src="a.png" class="x" style="border:0"><br>\n[Link](x.md){:target="_blank"}\n<!-- hidden -->');
  assert.match(body, /Set \\\{org_name\\\} for &lt;tenant-domain>\./);
  assert.match(body, /<img src="a\.png" className="x" \/><br \/>/);
  assert.match(body, /\[Link\]\(x\.md\)\n/);
  assert.doesNotMatch(body, /hidden/);
});

test('placeholders in link URLs: in the host the link becomes code, in the path it is encoded', () => {
  assert.equal(toMdx('[Portal](https://<APIM_HOST>:9443/devportal)').body, 'Portal (`https://<APIM_HOST>:9443/devportal`)');
  assert.equal(toMdx('[API](https://api.example.com/<org>/x)').body, '[API](https://api.example.com/%3Corg%3E/x)');
});

test('Markdown autolinks become links, so the closing > is not read as part of the URL', () => {
  assert.equal(toMdx('Open <http://localhost:3000> in a browser.').body, 'Open [http://localhost:3000](http://localhost:3000) in a browser.');
  assert.equal(toMdx('Root context (<https://apis.com:9443>).').body, 'Root context ([https://apis.com:9443](https://apis.com:9443)).');
  assert.equal(toMdx('`<http://localhost:3000>`').body, '`<http://localhost:3000>`', 'code untouched');
});

test('bare placeholder URLs stay text, so Docusaurus does not try to parse them as links', () => {
  const { body } = toMdx('Requests go to http://host:port/healthcare or http://username:password@proxyhost:port/. Real: https://wso2.com/x.');
  assert.equal(body, 'Requests go to http:&#47;/host:port/healthcare or http:&#47;/username:password@proxyhost:port/. Real: https://wso2.com/x.');
  assert.equal(toMdx('`http://host:port/x` and [l](https://wso2.com/a)').body, '`http://host:port/x` and [l](https://wso2.com/a)');
});

test('Redoc embeds become <ApiReference>; options kept; external https specs only linked; anything else stays text', async () => {
  const { redocToApiReference } = await import('../src/syntax.js');
  const r = (s: string) => redocToApiReference(s).text;
  assert.equal(r(`<redoc spec-url="/identity/apis/restapis/scim2.yaml" theme='{ "colors": { "primary": { "main": "#ff7300" } } }'></redoc>`), '<ApiReference spec="/identity/apis/restapis/scim2.yaml" />');
  assert.equal(r(`<redoc spec-url='../publisher-v4.yaml'></redoc>`), '<ApiReference spec="../publisher-v4.yaml" />');
  assert.equal(r('<redoc expand-single-schema-field="true" schema-expansion-level="3" spec-url="x.yaml">'), '<ApiReference spec="x.yaml" schemaExpansionLevel="3" expandSingleSchemaField />');
  assert.equal(r(`<redoc spec-url='https://raw.githubusercontent.com/wso2/docs-apk/refs/heads/1.2.0/a.yaml'></redoc>`), '<ApiReference specLink="https://raw.githubusercontent.com/wso2/docs-apk/refs/heads/1.2.0/a.yaml" />');
  assert.equal(r(`<redoc spec-url="javascript:alert(1)"></redoc>`), `<redoc spec-url="javascript:alert(1)"></redoc>`);
  assert.equal(r('<redoc spec-url=../../apis/restapis/account-recovery.yaml></redoc>'), '<ApiReference spec="../../apis/restapis/account-recovery.yaml" />', 'unquoted attribute');
  assert.equal(r('<redoc></redoc>'), '<redoc></redoc>');
  assert.match(toMdx('<redoc spec-url="/a/b.yaml"></redoc>').body, /^<ApiReference spec="\/a\/b\.yaml" \/>$/);
  assert.match(toMdx('<redoc spec-url="javascript:x"></redoc>').body, /^&lt;redoc/, 'unconverted embeds are escaped as before');
});

// Python-Markdown 3.7 makes each of these a link or image (href/src as written; a browser drops the newline).
test('a line break in a link target is joined, as Python-Markdown and the browser read it', () => {
  // docs-apim@808c7e57d4d9 en/docs/design/rate-limiting/advanced-topics/configuring-rate-limiting-api-gateway-cluster.md:5-7
  const gateway = 'with multiple Gateways. In such scenarios, for [Burst Control](/api-platform/api-manager/4.4.0\n/design/rate-limiting/setting-throttling-limits/#burst-control) and [Backend Rate Limiting](/api-platform/api-manager/4.4.0\n/design/rate-limiting/setting-maximum-backend-throughput-limits) to work properly, it requires maintaining';
  assert.equal(toMdx(gateway).body, 'with multiple Gateways. In such scenarios, for [Burst Control](/api-platform/api-manager/4.4.0/design/rate-limiting/setting-throttling-limits/#burst-control) and [Backend Rate Limiting](/api-platform/api-manager/4.4.0/design/rate-limiting/setting-maximum-backend-throughput-limits) to work properly, it requires maintaining');
  // docs-is identity-server/5.10.0/docs/develop/customizing-identity-server-uis.md:12-13, indented in a list item
  assert.equal(toMdx('1. Item\n\n    see [Updating WSO2 Products](https://is.docs.wso2\n    .com/en/latest/administer/getting-wso2-updates/)\n').body,
    '1. Item\n\n    see [Updating WSO2 Products](https://is.docs.wso2.com/en/latest/administer/getting-wso2-updates/)\n');
  // docs-apim@53584be9c5ba .../configure-worker/active-passive.md:23-24, an image
  assert.equal(toMdx('    ![](/r/assets/img/setup-and-install/open_endpoint_after_active_member_changes\n    .png)').body,
    '    ![](/r/assets/img/setup-and-install/open_endpoint_after_active_member_changes.png)');
});

test('spaces in a link or image target are percent-encoded; a quoted title stays a title', () => {
  // docs-is identity-server/5.9.0/docs/administer/load-balancing.md:11
  assert.equal(toMdx('![load-balancing](../../assets/img/administer/load balancing/load-balancing.png)').body,
    '![load-balancing](../../assets/img/administer/load%20balancing/load-balancing.png)');
  // docs-api-platform@f7a46e1d7d8b en/docs/cloud/develop-api-proxy/authentication-and-authorization/secure-api-access-with-azure-ad.md:94
  assert.equal(toMdx('refer to the Azure documentation: [Assign the app to users and groups to restrict access](Assign the app to users and groups to restrict access)').body,
    'refer to the Azure documentation: [Assign the app to users and groups to restrict access](Assign%20the%20app%20to%20users%20and%20groups%20to%20restrict%20access)');
  // docs-choreo-dev@eca033c47c57 en/developer-docs/docs/references/choreo-platform-services-billing-and-upgrades.md:12,
  // after {{ product_name }} renders as "WSO2 Developer Platform"
  assert.equal(toMdx('contact [WSO2 Developer Platform support](mailto:WSO2 Developer Platform-support@wso2.com).').body,
    'contact [WSO2 Developer Platform support](mailto:WSO2%20Developer%20Platform-support@wso2.com).');
  assert.equal(toMdx('[t](a b.md "A title") and [u](<c d.md>) and [v](#Run the \'sample\' scenario) and [w](x.md "T")').body,
    '[t](a%20b.md "A title") and [u](c%20d.md) and [v](#Run%20the%20\'sample\'%20scenario) and [w](x.md "T")');
  // docs-is identity-server/5.9.0/docs/get-started/single-sign-on-and-identity-federation.md:242: a browser drops the
  // tabs from the URL and keeps the spaces
  assert.equal(toMdx('[here](http://code.google.com/p/saml2-consumer-module/downloads/detail?\t\t   name=opensaml2-2.0.0.alpha1-wso2v1.jar)').body,
    '[here](http://code.google.com/p/saml2-consumer-module/downloads/detail?%20%20%20name=opensaml2-2.0.0.alpha1-wso2v1.jar)');
  assert.equal(toMdx('[a](b(c d)e) and [f](g\n\nh) and `[i](j k)`').body, '[a](b(c%20d)e) and [f](g\n\nh) and `[i](j k)`', 'nested parentheses; a blank line ends the search; code untouched');
});

test('joined and encoded targets compile as links', async () => {
  const { compileCheck } = await import('../src/page.js');
  const { compile } = await import('@mdx-js/mdx');
  const body = toMdx('[x](https://github\n.com/a) ![y](a b.png "T") [z](mailto:A B-c@d.com)').body;
  await compileCheck(`---\n---\n${body}`);
  const js = String(await compile(body, { jsx: true }));
  assert.match(js, /href="https:\/\/github\.com\/a"/);
  assert.match(js, /src="a%20b\.png" alt="y" title="T"/);
  assert.match(js, /href="mailto:A%20B-c@d\.com"/);
});
