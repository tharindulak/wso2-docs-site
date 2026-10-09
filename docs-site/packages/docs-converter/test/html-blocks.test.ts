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
