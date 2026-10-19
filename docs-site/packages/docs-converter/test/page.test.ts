import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertRendered, PageError, compileCheck } from '../src/page.js';

test('produces compiled MDX with front matter, imports and deployment options', async () => {
  const { mdx } = await convertRendered('---\ntitle: TOTP\ntemplate: x.html\n---\n# TOTP\n\n!!! note\n    Hi {name}.\n\n<Applies to="WSO2 Cloud">\n\nCloud.\n\n</Applies>\n', { deploymentOptions: ['WSO2 Cloud', 'Self-hosted'], editUrl: 'https://github.com/wso2/docs-is/edit/main/x.md' });
  assert.match(mdx, /^---\ntitle: TOTP\nmkdocs_template: x\ndeployment_options:\n {2}- WSO2 Cloud\n {2}- Self-hosted\ncustom_edit_url: https:\/\/github\.com/);
  assert.doesNotMatch(mdx, /^template:/m);
  assert.match(mdx, /import Applies from '@site\/src\/components\/Applies';/);
  assert.match(mdx, /:::note\n\nHi \\\{name\\\}\./);
});

test('policy and include failures surface as PageError with a kind (compile failures fall back to CommonMark)', async () => {
  await assert.rejects(convertRendered('<a href="javascript:x()">x</a>', { deploymentOptions: [] }), (e: any) => e instanceof PageError && e.kind === 'policy');
  await assert.rejects(convertRendered('{!x.md!}', { deploymentOptions: [] }), (e: any) => e.kind === 'include');
});

test('title falls back to the first heading; MkDocs template and quick-start data are kept as front matter', async () => {
  const { mdx } = await convertRendered('\n[//] STEPS_START\n\n# React Quickstart\n\nBody.\n', { deploymentOptions: [], pageData: { frontMatter: { template: 'templates/quick-start.html' }, meta: { what_you_will_learn: ['A'] } } });
  assert.match(mdx, /^title: React Quickstart$/m);
  assert.match(mdx, /^mkdocs_template: quick-start$/m);
  assert.match(mdx, /^quick_start:\n {2}what_you_will_learn:\n {4}- A$/m);
  assert.doesNotMatch(mdx, /STEPS_START/);
});

test('a page that fails only on a raw HTML table converts once the table is rewritten; other pages are untouched', async () => {
  const opts = { deploymentOptions: ['Self-hosted'] };
  const broken = '# API\n\n<table>\n<tr>\n<td>Context</td>\n<td>\nThe API context.\n<ul><li>Must be unique</ul>\n</td>\n</tr>\n</table>\n\nNext **step**.\n';
  const { mdx, stats } = await convertRendered(broken, opts);
  assert.equal(stats.htmlBlocks, 1);
  assert.match(mdx, /<table><tbody><tr><td>\{"Context"\}<\/td><td>\{"The API context\. "\}<ul><li>\{"Must be unique"\}<\/li><\/ul><\/td><\/tr><\/tbody><\/table>/);
  assert.match(mdx, /Next \*\*step\*\*\./, 'Markdown outside the block is converted as usual');
  const fine = await convertRendered('# Fine\n\n<table>\n<tr><td>ok</td></tr>\n</table>\n', opts);
  assert.equal(fine.stats.htmlBlocks ?? 0, 0);
  assert.match(fine.mdx, /<tr><td>ok<\/td><\/tr>/);
});

// docs-is 7.2.0 deploy/deployment-guide.md: a TODO comment holding an <ol> with an image of a file the version lacks.
test('an HTML block inside an HTML comment stays hidden when the page\'s HTML blocks are rewritten', async () => {
  const src = '# Guide\n\n<table>\n  <tr>\n    <td>A\n\n    B</td>\n  </tr>\n</table>\n\n<!-- TODO check it,\n\n<ol>\n    <li><p><img src="/x/assets/a.png" alt="A"></p></li>\n</ol> -->\n\nAfter.\n';
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: [] });
  assert.equal(stats.htmlBlocks, 1, 'only the table is rewritten');
  assert.doesNotMatch(mdx, /TODO|a\.png|-->|--&gt;/);
  assert.match(mdx, /<table><tbody><tr><td>\{"A B"\}<\/td><\/tr><\/tbody><\/table>\n+After\.\n$/);
});

test('a page MDX cannot read falls back to CommonMark, with scripts removed, and stays a real page', async () => {
  const opts = { deploymentOptions: ['Self-hosted'] };
  const src = '# Odd\n\nText with {braces and <!DOCTYPE stray> markup <b>bold</i>.\n\n<script>track()</script>\n\n!!! note\n    Kept.\n';
  const { mdx, stats } = await convertRendered(src, opts);
  assert.equal(stats.format, 'md');
  assert.deepEqual(stats.removed, ['script']);
  assert.match(mdx, /^mdx:\n {2}format: md$/m);
  assert.doesNotMatch(mdx, /track\(\)|^import /m);
  assert.match(mdx, /:::note/);
});

test('event handler attributes are removed; javascript: URLs still reject the page', async () => {
  const { mdx, stats } = await convertRendered('<div class="card" onclick="location.href=\'x/\'">Card</div>\n', { deploymentOptions: [] });
  assert.doesNotMatch(mdx, /onclick|location/);
  assert.deepEqual(stats.removed, ['onclick']);
  await assert.rejects(convertRendered('<a href="javascript:x()">x</a>', { deploymentOptions: [] }), (e: any) => e.kind === 'policy');
});

test('the compile check rejects a link URL Docusaurus cannot parse', async () => {
  await assert.rejects(compileCheck('---\n---\n[x](http://host:port/a)\n'), (e: any) => e.kind === 'compile' && /cannot be parsed/.test(e.message));
});

test('CommonMark fallback pages keep HTML class attributes', async () => {
  const { mdx, stats } = await convertRendered('<table>\n<tr class="odd">\n<td>a {b</td>\n</tr>\n</table>\n\nx <!DOCTYPE y> z\n', { deploymentOptions: [] });
  if (stats.format === 'md') assert.match(mdx, /<tr class="odd">/);
  assert.doesNotMatch(mdx, /format: md[\s\S]*className=/);
});

test('an API reference page takes its title and summary from the spec and gets the full width', async () => {
  const { mdx } = await convertRendered('<redoc spec-url="/identity/apis/restapis/scim2.yaml"></redoc>\n', {
    deploymentOptions: ['WSO2 Cloud'],
    specInfo: (spec) => (spec === '/identity/apis/restapis/scim2.yaml' ? { title: 'SCIM 2.0 Agents API', description: 'Manage agents.' } : undefined),
  });
  assert.match(mdx, /^title: SCIM 2\.0 Agents API$/m);
  assert.match(mdx, /^description: Manage agents\.$/m);
  assert.match(mdx, /^hide_table_of_contents: true$/m);
  assert.match(mdx, /import ApiReference from '@site\/src\/components\/ApiReference';\n\n<ApiReference spec="\/identity\/apis\/restapis\/scim2\.yaml" \/>/);
});

test('a page with no title and no heading takes the fallback title; a title or heading always wins', async () => {
  const opts = { deploymentOptions: ['Self-hosted' as const], fallbackTitle: 'Home: start' };
  const plain = (await convertRendered('Some text.\n', opts)).mdx;
  assert.match(plain, /^title: 'Home: start'$/m, 'YAML-escaped');
  assert.match((await convertRendered('# Real heading\n\nText.\n', opts)).mdx, /^title: Real heading$/m);
  assert.match((await convertRendered('---\ntitle: Front\n---\nText.\n', opts)).mdx, /^title: Front$/m);
  assert.doesNotMatch((await convertRendered('---\ntemplate: templates/home.html\n---\n', opts)).mdx, /^title:/m, 'empty template pages are filled later');
});

// docs-apim@5a85a65d8d6d en/docs/design/advanced-topics/block-subscription-to-an-api.md:42-47 and :100, with a <b>
// left open (no repair closes a known element), so the page is CommonMark; the admonition nested in the list item
// still renders its link (Python-Markdown 3.7: <a href="{{base_path}}/design/...">Create and Publish an API</a>).
test('on a CommonMark page, an HTML block nested in a list item becomes one line of HTML with its Markdown rendered', async () => {
  const src = [
    '# Block', '',
    '1.  Sign in to the Developer Portal.', '',
    '         <html>',
    '         <div class="admonition tip"> ',
    '         <p class="admonition-title">Tip</p>',
    '         <p>For more information, see [Create and Publish an API](/r/design/create-api/create-rest-api/create-a-rest-api/) or [x](x.md), **b** `a &lt; b`.</p>',
    '         </div>',
    '         </html>', '',
    '2.  Click **Subscriptions**.', '',
    '         <a href="/r/assets/img/learn/subscriptions-menu.png" alt="subscriptions menu"><img src="/r/assets/img/learn/subscriptions-menu.png" width=250></a>', '',
    '         <div>', '         <svg><path d="M1,2', 'C3,4"></path></svg><pre>a', 'b</pre>', '         </div>', '',
    '<table>', '<tr><td>Top [level](y.md)</td></tr>', '</table>', '',
    'Text <b>left open.', '',
  ].join('\n');
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: ['Self-hosted'] });
  assert.equal(stats.format, 'md');
  assert.match(mdx, /^ {9}<div class="admonition tip"><p class="admonition-title">Tip<\/p><p>For more information, see <a href="\/r\/design\/create-api\/create-rest-api\/create-a-rest-api\/">Create and Publish an API<\/a> or \[x\]\(x\.md\), <strong>b<\/strong> <code>a &lt; b<\/code>\.<\/p><\/div>$/m,
    'a relative .md link stays text: only Docusaurus could resolve it, from Markdown');
  assert.match(mdx, /^<table>\n<tr><td>Top \[level\]\(y\.md\)<\/td><\/tr>\n<\/table>$/m, 'a top-level block stays raw');
  assert.match(mdx, /^ {9}<div><svg><path d="M1,2&#10;C3,4"><\/path><\/svg><pre>a&#10;b<\/pre><\/div>$/m, 'line breaks in values and <pre> keep the block on one line');
});

// docs-apim (API-M 4.2) expose-a-kafka-topic-as-a-managed-websocket-api.md: a nested <html> note holding tabs after a
// blank line. The block is left as written, so the code stays code; on a CommonMark page the wrapper is dropped too.
test('a nested <html> block left as written loses its wrapper, not its tabs or code, on a CommonMark page', async () => {
  const src = [
    '1. Invoke the API.', '',
    '        <html>', '        <div class="admonition note">', '        <p class="admonition-title">Note</p>', '        <p>Send the token as a query parameter:</p>', '',
    '        === "WS"', '            ``` java', '            wscat -c "ws://localhost:9104/x?access_token=[accesstoken]"', '            ```', '',
    '        </div>', '        </html>', '',
    '2. Next <img src="/r/a.png" width=250>', '',
    'Text <b>left open.', '',
  ].join('\n');
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: ['Self-hosted'] });
  assert.equal(stats.format, 'md');
  assert.doesNotMatch(mdx, /&lt;\/?html|<\/?html>/);
  assert.match(mdx, /```java\n {8}wscat -c "ws:\/\/localhost:9104\/x\?access_token=\[accesstoken\]"\n {8}```/);
});

test('a page following the conventions gets the explicit components: steps, prerequisites, link cards', async () => {
  const src = '# Set up\n\n!!! note "Before you begin"\n    Get an account.\n\n## Step 1: Install\n\nDo a.\n\n## Step 2: Run\n\nDo b.\n\n## See also\n\n- [Users](users.md) - Manage users.\n';
  const { mdx } = await convertRendered(src, { deploymentOptions: ['Self-hosted'] });
  assert.match(mdx, /<Prerequisites title="Before you begin">\n\nGet an account\.\n\n<\/Prerequisites>/);
  assert.match(mdx, /<Steps>\n\n## Install \{\/\* #step-1-install \*\/\}\n\nDo a\.\n\n## Run \{\/\* #step-2-run \*\/\}\n\nDo b\.\n\n<\/Steps>/);
  assert.match(mdx, /<LinkCards>\n\n- \[Users\]\(users\.md\) - Manage users\.\n\n<\/LinkCards>/);
  assert.doesNotMatch(mdx, /^import /m, 'the components are registered on the site, not imported');
});

test('the opt-outs in front matter keep a convention as written', async () => {
  const { mdx } = await convertRendered('---\nstepper: false\n---\n## Step 1: Install\n\na\n\n## Step 2: Run\n\nb\n', { deploymentOptions: [] });
  assert.match(mdx, /## Step 1: Install/);
  assert.doesNotMatch(mdx, /<Steps>/);
});

test('a CommonMark fallback page gets no components: it could not render them', async () => {
  const src = '# Odd\n\nText with {braces and <!DOCTYPE stray> markup <b>bold</i>.\n\n## Step 1: A\n\na\n\n## Step 2: B\n\nb\n';
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: [] });
  assert.equal(stats.format, 'md');
  assert.match(mdx, /## Step 1: A/);
  assert.doesNotMatch(mdx, /<Steps>/);
});

// docs-is 6.0.0 deploy/security/prevent-browser-caching.md:18: a broken code span (two backticks open, one closes)
// leaves a placeholder that MDX reads as a tag. Python-Markdown shows the text; so does the page here, as MDX.
test('tag-like placeholder text that MDX reads as a tag is shown as text, and the page stays MDX', async () => {
  const src = '# Cache\n\nAdd it to the ``<IS_HOME>/repository/conf/web.xml` file.\n\nMail <user@example.com> too.\n\n## Step 1: A\n\na\n\n## Step 2: B\n\nb\n';
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: [] });
  assert.equal(stats.format, undefined);
  assert.match(mdx, /``&lt;IS_HOME>\/repository\/conf\/web\.xml` file\./);
  assert.match(mdx, /Mail &lt;user@example\.com> too\./);
  assert.match(mdx, /<Steps>/, 'an MDX page gets its components');
  await compileCheck(mdx);
});

// docs-is quick-starts/springboot.md: a tab's code block indented partly with tabs. Python-Markdown expands tabs to
// 4 columns first, so the block stays in the tab; read as one column each, the tab ends early and MDX fails.
test('a page that fails only on tab-indented lines converts as MDX with the tabs expanded as Python-Markdown does', async () => {
  const src = '# Install\n\n=== "Maven"\n\n    ```xml\n\t<dependency>\n\t\t<groupId>x</groupId>\n\t</dependency>\n    ```\n\n=== "Gradle"\n\n    ```groovy\n    implementation \'x\'\n    ```\n';
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: [] });
  assert.equal(stats.format, undefined);
  assert.match(mdx, /<TabItem value="tab-0" label="Maven">\n+```xml\n<dependency>\n {4}<groupId>x<\/groupId>\n<\/dependency>\n```\n\n<\/TabItem>/);
  await compileCheck(mdx);
});

// docs-is 5.x learn/configuring-saml-2.0-web-sso.md: a table of SAML context classes links each to a URL no browser
// can open (http://urnoasisnamestcSAML:2.0:...), which stops the Docusaurus build. The label stays, as text.
test('on a page that otherwise needs repairs, a link URL Docusaurus cannot parse becomes its label', async () => {
  const src = '# SAML\n\n| Class | URN |\n|---|---|\n| Kerberos | [urn:Kerberos](http://urnoasis:2.0:ac:classes:Kerberos) |\n\nUse ``<IS_HOME>/x` here.\n';
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: [] });
  assert.equal(stats.format, undefined);
  assert.match(mdx, /\| Kerberos \| urn:Kerberos \|/);
  await compileCheck(mdx);
});

// docs-is deploy/deployment-guide.md: a table in a collapsible is followed by a stray </li></ul>, which a browser ignores.
test('a closing tag that closes nothing open in its block is dropped, and the page stays MDX', async () => {
  const src = '# Guide\n\n??? tip "Caching"\n    Text.\n\n    <table><tr><td>a</td></tr></table>\n    </li>\n\nAfter.\n';
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: [] });
  assert.equal(stats.format, undefined);
  assert.doesNotMatch(mdx, /<\/li>/);
  await compileCheck(mdx);
});

// docs-is 5.x learn/configuring-email-otp.md: a Confluence anchor (<a name="…">) never closed; a browser makes it an
// empty anchor and goes on.
test('an anchor with no link, never closed, becomes an empty anchor, and the page stays MDX', async () => {
  const src = '# OTP\n\n1.  First.\n\n2.  <a name="client-ID">Select the **Web application** option.\n    Enter the URI.\n';
  const { mdx, stats } = await convertRendered(src, { deploymentOptions: [] });
  assert.equal(stats.format, undefined);
  assert.match(mdx, /2\. {2}<a name="client-ID" \/>Select the \*\*Web application\*\* option\./);
  await compileCheck(mdx);
});
