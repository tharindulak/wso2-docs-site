import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlBlocksToJsx } from '../src/html-blocks.js';
import { compileCheck } from '../src/page.js';

const table = `Intro.

<table>
  <tr>
    <td>**Name**</td>
    <td>
        Select one:
        <ul>
            <li>None
            <li>From <code>WSDL</code> {file}</li>
        </ul>
    </td>
  </tr>
</table>

After.`;

test('a multi-line HTML block becomes one well-formed JSX line whose text stays literal, as in MkDocs', async () => {
  const { text, blocks } = htmlBlocksToJsx(table);
  assert.equal(blocks, 1);
  const lines = text.split('\n');
  assert.equal(lines[0], 'Intro.');
  assert.equal(lines.at(-1), 'After.');
  const jsx = lines.find((l) => l.startsWith('<table>'))!;
  assert.match(jsx, /^<table><tbody><tr><td>\{"\*\*Name\*\*"\}<\/td><td>/, 'parser adds tbody; text is a literal string');
  assert.match(jsx, /<li>\{"None"\}<\/li><li>\{"From "\}<code>\{"WSDL"\}<\/code>\{" \{file\}"\}<\/li>/, 'unclosed li repaired, braces stay text');
  await compileCheck(`---\n---\n${text}`);
});

test('indentation is kept so a block stays inside its list item; pre keeps its newlines; attributes become JSX', () => {
  const src = '1. Step\n\n    <div class="note" colspan="2">\n    <pre>a\n  b</pre>\n    </div>\n';
  const { text } = htmlBlocksToJsx(src);
  assert.match(text, /^ {4}<div className=\{"note"\} colSpan=\{"2"\}><pre>\{"a\\n  b"\}<\/pre><\/div>$/m);
});

test('fenced code, one-line HTML and unclosed blocks are left alone', () => {
  const src = '```html\n<table>\n<tr><td>x</td></tr>\n</table>\n```\n\n<div>one line</div>\n\n<table>\n<tr><td>never closed\n';
  assert.deepEqual(htmlBlocksToJsx(src), { text: src, blocks: 0 });
});

test('a placeholder that parses as a tag with an invalid name (dotted, @) stays text; its children stay', async () => {
  const src = '<table>\n<tr><td>Edit `<travelocity.com-home>/WEB-INF/x.properties` and <mail@address.tld>.</td></tr>\n</table>\n';
  const { text, blocks } = htmlBlocksToJsx(src);
  assert.equal(blocks, 1);
  assert.doesNotMatch(text, /(^|[>}])<(travelocity|mail@)/, 'no element with an invalid name');
  assert.match(text, /\{"<travelocity\.com-home>"\}\{"\/WEB-INF\/x\.properties` and "\}\{"<mail@address\.tld>"\}/);
  await compileCheck(`---\n---\n${text}`);
});

/** The page as MDX compiles it (JSX output), to check what renders: links, images and elements. */
async function compiled(text: string): Promise<string> {
  const { compile } = await import('@mdx-js/mdx');
  await compileCheck(`---\n---\n${text}`);
  return String(await compile(text, { jsx: true }));
}

// docs-mi@840cd49e8494 en/docs/reference/connectors/file-connector/file-connector-config.md:1085-1148 (cut down).
// Python-Markdown 3.7 renders the table inside `??? note` as paragraph text: <strong>SMB2</strong>, <a href=...>.
const fileConnector = `??? note "checkExist"
    Check if a given file or folder exists.
    <table>
        <tr>
            <th>Parameter Name</th>
        </tr>
        <tr>
            <td>
                <p> The <code>diskShareAccessMask</code> configuration applies when using the **SMB2** or **SMB3** protocol. Refer to the [SMBJ documentation](https://www.javadoc.io/doc/com.hierynomus/smbj/0.11.3/com/hierynomus/msdtyp/AccessMask.html) for the available access masks.</p>
            </td>
        </tr>
    </table>`;

test('an HTML block nested in a container (indent 4+) renders its inline Markdown, as Python-Markdown does', async () => {
  const { text, blocks } = htmlBlocksToJsx(fileConnector);
  assert.equal(blocks, 1);
  const jsx = text.split('\n').find((l) => l.trimStart().startsWith('<table>'))!;
  assert.match(jsx, /<p>\{"The "\}<code>\{"diskShareAccessMask"\}<\/code>\{" configuration applies when using the "\}<strong>\{"SMB2"\}<\/strong>\{" or "\}<strong>\{"SMB3"\}<\/strong>/);
  assert.match(jsx, /\{" protocol\. Refer to the "\}\[\{"SMBJ documentation"\}\]\(https:\/\/www\.javadoc\.io\/doc\/com\.hierynomus\/smbj\/0\.11\.3\/com\/hierynomus\/msdtyp\/AccessMask\.html\)\{" for the available access masks\."\}<\/p>/);
  const js = await compiled(jsx);
  assert.match(js, /<_components\.a href="https:\/\/www\.javadoc\.io\/doc\/com\.hierynomus\/smbj\/0\.11\.3\/com\/hierynomus\/msdtyp\/AccessMask\.html">\{"SMBJ documentation"\}<\/_components\.a>/);
  assert.match(js, /<strong>\{"SMB2"\}<\/strong>/);
});

// docs-apim@53584be9c5ba en/docs/learn/api-monetization/monetizing-an-api.md:133-138: an <html> wrapper indented 5
// in a list item. Python-Markdown: <a href="#granularity">monetization granularity</a>.
const monetizing = `2. Optionally, preserve the required API usage data table in WSO2 API Manager Analytics.

     <html>
     <div class="admonition note">
     <p class="admonition-title">Note</p>
     <p>This is only mandatory if you customized the API usage-based [monetization granularity](#granularity).</p>
     </div> 
     </html>`;

test('a nested <html> wrapper is taken with its block and dropped; the link inside renders', async () => {
  const { text, blocks } = htmlBlocksToJsx(monetizing);
  assert.equal(blocks, 1);
  assert.equal(text.split('\n').at(-1), '     <div className={"admonition note"}><p className={"admonition-title"}>{"Note"}</p><p>{"This is only mandatory if you customized the API usage-based "}[{"monetization granularity"}](#granularity){"."}</p></div>');
  assert.match(await compiled(text), /<_components\.a href="#granularity">\{"monetization granularity"\}<\/_components\.a>/);
  // docs-apim@53584be9c5ba .../monetizing-an-api.md:778-785: <html> at column 0 makes the indented admonition raw too.
  assert.equal(htmlBlocksToJsx('<html>\n    <div class="admonition note">\n        <p>Please refer the [document](https://stripe.com/docs/payments/cards/collecting) to find out.</p>\n    </div> \n</html>').text,
    '<div className={"admonition note"}><p>{"Please refer the [document](https://stripe.com/docs/payments/cards/collecting) to find out."}</p></div>');
});

// docs-apim@53584be9c5ba en/docs/learn/analytics/analyzing-apim-statistics-with-batch-analytics/viewing-api-statistics.md:466:
// a <table> at column 0 is raw HTML in Python-Markdown; its Markdown stays literal.
test('a top-level HTML block (indent 3 or less) keeps its text literal, as Python-Markdown does', () => {
  const { text } = htmlBlocksToJsx('<table>\n<tr>\n<td>See [Configuring APIM Analytics](../configuring-apim-analytics.md) and **bold**.</td>\n</tr>\n</table>');
  assert.equal(text, '<table><tbody><tr><td>{"See [Configuring APIM Analytics](../configuring-apim-analytics.md) and **bold**."}</td></tr></tbody></table>');
  assert.equal(htmlBlocksToJsx('   <div>\n   [a](b)\n   </div>').text, '   <div>{"[a](b)"}</div>');
});

test('inline Markdown in a nested block: MDX-safe targets and titles, escapes, word-internal underscores, pre left alone', async () => {
  const src = [
    '- item', '',
    '    <table>',
    '    <tr><td>A [l **b**](u v.md "T {x}") ![i [m]](x y.png) [x](a',
    '    b.md) \\*n\\* {c} &lt;t&gt; snake_case_name _u_ __s__ ***bs*** 2 * 3 `{code}` <b>[q](r&amp;s)</b></td></tr>',
    '    <tr><td><pre>[p](q) *y*', '    z</pre></td></tr>',
    '    </table>',
  ].join('\n');
  const jsx = htmlBlocksToJsx(src).text.split('\n').at(-1)!;
  assert.equal(jsx, '    <table><tbody><tr><td>{"A "}[{"l "}<strong>{"b"}</strong>](u%20v.md "T \\{x\\}"){" "}![i \\[m\\]](x%20y.png){" "}[{"x"}](ab.md)'
    + '{" *n* {c} <t> snake_case_name "}<em>{"u"}</em>{" "}<strong>{"s"}</strong>{" "}<strong><em>{"bs"}</em></strong>{" 2 * 3 "}<code>{"{code}"}</code>{" "}'
    + '<b>[{"q"}](r&amp;s)</b></td></tr><tr><td><pre>{"[p](q) *y*\\n    z"}</pre></td></tr></tbody></table>');
  const js = await compiled(htmlBlocksToJsx(src).text);
  assert.match(js, /<_components\.a href="u%20v\.md" title="T \{x\}">/);
  assert.match(js, /<_components\.img src="x%20y\.png" alt="i \[m\]" \/>/);
  assert.match(js, /<_components\.a href="r&amp;s">\{"q"\}/, 'JSX decodes the entity: href is r&s');
});

// docs-is identity-server/5.10.0/docs/learn/configuring-saml-2.0-web-sso.md:91,133: a table indented with a tab in a
// list item (Python-Markdown expands a tab to 4 columns), holding a Markdown link.
test('a tab-indented block is nested (a tab is 4 columns)', () => {
  const src = '2.\tEnter the required values as given below.\n\n\t<table>\n\t\t<tr><td>\n\t\t<p>For more information, see [Getting Started with WUM](https://docs.wso2.com/display/ADMIN44x/Getting+Started+with+WUM).</p>\n\t\t</td></tr>\n\t</table>';
  assert.equal(htmlBlocksToJsx(src).text.split('\n').at(-1), '\t<table><tbody><tr><td><p>{"For more information, see "}[{"Getting Started with WUM"}](https://docs.wso2.com/display/ADMIN44x/Getting+Started+with+WUM){"."}</p></td></tr></tbody></table>');
});

// docs-mi@16f84ae6e39b en/docs/reference/connectors/file-connector/6.x/file-connector-config.md:1708-1718: a ```json
// fence left open at the end of a `??? note` block; the blocks after it are not code.
test('a code fence left open ends with its container', () => {
  const src = '??? note "compress"\n    **Error**\n\n    ```json\n    {\n        "success": false\n    }\n\n??? note "copy"\n    Copies the file.\n    <table>\n        <tr><td>See [SMBJ documentation](https://www.javadoc.io/doc/com.hierynomus/smbj/).</td></tr>\n    </table>\n';
  const { blocks, text } = htmlBlocksToJsx(src);
  assert.equal(blocks, 1);
  assert.match(text, /\[\{"SMBJ documentation"\}\]\(https:\/\/www\.javadoc\.io\/doc\/com\.hierynomus\/smbj\/\)/);
  const outdented = '1. Step\n\n    ```html\n    <table>\n```\n\n<table>\n<tr><td>a</td></tr>\n</table>\n';
  assert.equal(htmlBlocksToJsx(outdented).blocks, 1, 'a less indented closing fence still closes the fence');
});

// docs-apim@d74917be6283 en/docs/tutorials/streaming-api/create-and-publish-websocket-api.md:172-173,264-294 (API-M 4.6;
// 4.2 to 4.5 and latest have the same block). Python-Markdown 3.7 renders a tab set of four <pre><code class="language-bash">
// blocks inside the note: block Markdown after a blank line, which one line of JSX cannot hold.
const websocket = [
  '4. Try out the operations.',
  '     ',
  '          As there are two users connected to `room1`, both of them can send and receive chats via `room1`.',
  '',
  '          <html>',
  '          <div class="admonition note">',
  '          <p class="admonition-title">Note</p>',
  '          <p>',
  '              There are clients (especially browsers) that do not allow you to add headers to the WebSocket handshake.',
  '          </p>',
  '          ',
  '        === "WS-OAuth2"',
  '            ``` bash',
  '            wscat -c "ws://localhost:9099/chats/1.0.0/notifications?access_token=[accesstoken]" ',
  '            ```',
  '  ',
  '        === "WSS-OAuth2"',
  '            ``` bash',
  '            wscat -n -c "wss://localhost:8099/chats/1.0.0/notifications?access_token=[accesstoken]"',
  '            ```',
  '',
  '          </div>',
  '          </html>',
].join('\n');

// docs-apim@c421978b28ec en/docs/learn/kubernetes-operators/k8s-api-operator/enabling-privatejet-mode-to-deploy-apis.md:215-230
// (API-M 3.2): fenced code inside a nested admonition; its <Environment-type> placeholder must stay code.
const privatejet = [
  '1. Step', '',
  '     <html><div class="admonition note">',
  '        <p class="admonition-title">Note</p>',
  '        <p> Super tenant users can customize the container management implementations if required.</p>',
  '        ',
  '    ``` json tab="Format"',
  '    [ContainerMgtConfig]',
  '    <Environment-type> = "<class-name>"',
  '    ```  ',
  '  ',
  '      </div>',
  '      </html>',
].join('\n');

test('a nested block holding block Markdown after a blank line (tabs, fenced code) is left as written', async () => {
  const unwrapped = (t: string) => t.replace(/<\/?html>/g, '');
  assert.deepEqual(htmlBlocksToJsx(websocket), { text: unwrapped(websocket), blocks: 0 }, 'only the <html> wrapper goes');
  assert.deepEqual(htmlBlocksToJsx(privatejet), { text: unwrapped(privatejet), blocks: 0 });
  assert.deepEqual(htmlBlocksToJsx(privatejet, { html: true }), { text: unwrapped(privatejet), blocks: 0 });
  const { convertRendered } = await import('../src/page.js');
  const ws = (await convertRendered(websocket, { deploymentOptions: ['Self-hosted'] })).mdx;
  assert.match(ws, /<TabItem value="tab-0" label="WS-OAuth2">\n\n {8}```bash\n {8}wscat -c "ws:\/\/localhost:9099\/chats\/1\.0\.0\/notifications\?access_token=\[accesstoken\]" \n {8}```/);
  assert.match(ws, /<TabItem value="tab-1" label="WSS-OAuth2">/);
  assert.doesNotMatch(ws, /=== "|<code>\{"bash/, 'no tab marker as text, no flattened code');
  const pj = (await convertRendered(privatejet, { deploymentOptions: ['Self-hosted'] })).mdx;
  assert.match(pj, /```json\n {4}\[ContainerMgtConfig\]\n {4}<Environment-type> = "<class-name>"\n {4}```/);
});

// docs-is guides/account-configurations/account-recovery/password-recovery.md: a nested <table> whose </table> is
// written <table>. Python-Markdown reads a nested block one blank-line chunk at a time, and the browser closes it.
test('a nested block that is never closed ends at its blank line, as Python-Markdown reads it', async () => {
  const src = '5. Configure.\n    <table>\n        <tr><td>A</td></tr>\n    <table>\n        <tr><td>B</td></tr>\n    </table>\n\n6. Next.\n\n    <table>\n        <tr><td>C</td></tr>\n    </table>\n';
  const { text, blocks } = htmlBlocksToJsx(src);
  assert.equal(blocks, 2);
  assert.match(text, /^ {4}<table><tbody><tr><td>\{"A"\}<\/td><\/tr><\/tbody><\/table><table><tbody><tr><td>\{"B"\}<\/td><\/tr><\/tbody><\/table>$/m);
  assert.match(text, /^6\. Next\.$/m);
  await compileCheck(`---\n---\n${text}`);
});

// docs-is asgardeo bot-detection.md: a tip ends the page with a <ul> never closed.
test('a nested block never closed ends with its container or the page', () => {
  const { text, blocks } = htmlBlocksToJsx('Text.\n\n    Flows:\n    <ul>\n    <li>SSO</li>\n    <li>Recovery</li>\nOutside.\n');
  assert.equal(blocks, 1);
  assert.match(text, /^ {4}<ul><li>\{"SSO"\}<\/li><li>\{"Recovery"\}<\/li><\/ul>\nOutside\.$/m);
});
