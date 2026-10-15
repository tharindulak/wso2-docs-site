import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMdx } from '../src/syntax.js';

test('a deprecated admonition stays a deprecated admonition (the site renders it as a section deprecation notice), keeping its title', () => {
  const { body } = toMdx('!!! deprecated "Deprecated feature"\n    Use the root organization name.\n');
  assert.match(body, /^:::deprecated\[Deprecated feature\]\n\nUse the root organization name\.\n\n:::/m);
  assert.match(toMdx('!!! deprecated\n    Old.\n').body, /^:::deprecated\n\nOld\.\n\n:::/m);
});

test('admonitions, including titled and nested in lists', () => {
  const { body } = toMdx('!!! warning "Before you start"\n    Read this.\n\n1. Step\n\n    !!! note\n        Inside.\n');
  assert.match(body, /^:::warning\[Before you start\]\n\nRead this\.\n\n:::/m);
  assert.match(body, /^ {4}:::note\n\n {4}Inside\.\n\n {4}:::/m);
});

// docs-is 5.x setup/setting-up-separate-databases-for-clustering.md: a tip nested in a warning. With equal fences the
// first ::: closes the warning, the tip is left open and a stray ::: prints; Docusaurus wants the outer fence longer.
test('an admonition holding an admonition gets the longer fence', () => {
  const { body } = toMdx('!!! warning "H2"\n    Not for production.\n\n    !!! tip "Before you begin"\n        Optional.\n\nAfter.\n');
  assert.match(body, /^::::warning\[H2\]\n\nNot for production\.\n\n:::tip\[Before you begin\]\n\nOptional\.\n\n:::\n\n::::\n\nAfter\./m);
});

test('collapsibles and tabs', () => {
  const { body, usesTabs } = toMdx('??? tip "More"\n    Hidden.\n\n=== "Java"\n    ```java\n    a();\n    ```\n\n=== "Go"\n    b\n');
  assert.match(body, /<details>\n<summary>More<\/summary>/);
  assert.match(body, /<Tabs>\n<TabItem value="tab-0" label="Java">/);
  assert.match(body, /<TabItem value="tab-1" label="Go">/);
  assert.equal(usesTabs, true);
});

// docs-choreo-dev manage-message-brokers/create-choreo-managed-kafka-services.md: a tab holding an indented Go sample.
// MDX reads no indented code, so unfenced its lines showed as paragraphs with their braces escaped.
test('an indented code block is fenced, in a tab or at the top level; list continuations and HTML stay as they are', () => {
  const tab = toMdx('=== "Producer"\n\n\n        package main\n\n        func main() {\n            run()\n        }\n\nAfter.\n').body;
  assert.match(tab, /<TabItem value="tab-0" label="Producer">\n+```\npackage main\n\nfunc main\(\) \{\n    run\(\)\n\}\n```\n\n<\/TabItem>/);
  assert.match(toMdx('Run:\n\n    mvn {x}\n\nDone.\n').body, /^```\nmvn \{x\}\n```\n\nDone\./m);
  assert.match(toMdx('1. Step\n\n    More about the step.\n').body, /^ {4}More about the step\.$/m);
  assert.match(toMdx('- a\n- b\n\n    Still b.\n\nText.\n').body, /^ {4}Still b\.$/m);
  assert.match(toMdx('<div>\n\n    Inside.\n\n</div>\n').body, /^ {4}Inside\.$/m);
  assert.match(toMdx('??? "No type"\n\n    **Bold**\n').body, /^ {4}\*\*Bold\*\*$/m);
});

// docs-is 7.1.0 deploy/product-compatibility.md: a collapsible body whose first line is indented with a tab.
test('a tab in the indentation counts to the next 4-column stop, as in Python-Markdown; fenced code keeps its tabs', () => {
  const { body } = toMdx('??? note "IWA"\n\n\tNot supported.\n\n    Use Kerberos.\n\n```\n\tx\n```\n');
  assert.match(body, /^<details>\n<summary>IWA<\/summary>\n+Not supported\.\n\nUse Kerberos\.\n\n<\/details>/m);
  assert.match(body, /^```\n\tx\n```/m);
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
  assert.equal(toMdx('1. Step\n\n    ![](/r/assets/img/setup-and-install/open_endpoint_after_active_member_changes\n    .png)').body,
    '1. Step\n\n    ![](/r/assets/img/setup-and-install/open_endpoint_after_active_member_changes.png)');
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

test('the explicit content components a source writes stay JSX', () => {
  const { body } = toMdx('<Steps start="2">\n\n## A\n\n</Steps>\n\n<Prerequisites title="Before you begin">\n\nx\n\n</Prerequisites>\n\n<LinkCards>\n\n- [a](a.md)\n\n</LinkCards>\n');
  assert.match(body, /^<Steps start="2">$/m);
  assert.match(body, /^<\/Steps>$/m);
  assert.match(body, /^<Prerequisites title="Before you begin">$/m);
  assert.match(body, /^<LinkCards>$/m);
  assert.doesNotMatch(body, /&lt;/);
});

// docs-is sdks/nextjs/middleware/asgardeo-middleware.md: Python-Markdown's tables keep a `|` inside a code span in the
// cell; GFM splits the cell there unless the pipe is escaped (and then shows it unescaped in the code).
test('a pipe inside a code span in a table row is escaped, so the cell keeps it', () => {
  const { body } = toMdx('| Property | Type |\n|---|---|\n| `getSession` | `() => Promise<T | undefined>` |\n\nText `a | b` stays.\n');
  assert.match(body, /^\| `getSession` \| `\(\) => Promise<T \\\| undefined>` \|$/m);
  assert.match(body, /Text `a \| b` stays\./);
});

test('a table row inside fenced code keeps its pipes', () => {
  assert.match(toMdx('```\n| `a | b` |\n```\n').body, /^\| `a \| b` \|$/m);
});

// docs-is asgardeo guides/account-configurations/login-security/bot-detection.md: a section commented out with its
// code blocks. A browser hides the whole comment; read fence by fence, its last fence ("``` -->") never closes.
test('an HTML comment holding code blocks is removed whole; comments inside code stay', () => {
  const { body } = toMdx('Intro.\n\n<!-- ## Old\n\n```toml\n[a]\n```\n\nText.\n``` -->\n\nKept.\n\n```xml\n<!-- in code -->\n<a/>\n```\n');
  assert.doesNotMatch(body, /Old|\[a\]|Text\./);
  assert.match(body, /Intro\.\n+Kept\./);
  assert.match(body, /```xml\n<!-- in code -->\n<a\/>\n```/);
});
