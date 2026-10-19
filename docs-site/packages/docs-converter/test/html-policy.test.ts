import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHtmlPolicy, unexpandedMarkers, removeForbiddenElements } from '../src/html-policy.js';

const v = (t: string) => applyHtmlPolicy(t).violations;

test('rejects scripts, styles, forms, handlers and javascript: URLs', () => {
  assert.ok(v('<script>alert(1)</script>').length);
  assert.ok(v('<style>body{}</style>').length);
  assert.ok(v('<form action="/x"></form>').length);
  assert.ok(v('<img src="x" onerror="alert(1)">').length);
  assert.ok(v('<a href="javascript:alert(1)">x</a>').length);
  assert.ok(v('[x](javascript:alert(1))').length);
});

// Line breaks and tabs in a target are joined (syntax.ts linkTargets, as a browser does) and nested HTML text is
// entity-decoded, so the check reads the URL as a browser would.
test('rejects script URLs split by whitespace or control characters, or written with character references', () => {
  for (const t of [
    '[x](java\nscript:alert(1))', '[x](java\tscript:alert(1))', '[x]( java\n  script:alert(1) "t")', '[x](<javascript:alert(1)>)',
    '    <table><tr><td>[x](&#106;avascript:alert(1))</td></tr></table>', '[x](&#x6A;ava&#x73;cript&colon;alert(1))',
    '[x](JaVaScRiPt:alert(1))', '[x](java\u0000script:x)', '[x](vb\nscript:x)', '[x](data:text/html,<b>x</b>)',
    '<a href="java\nscript:alert(1)">x</a>', '<a href="java&#10;script:alert(1)">x</a>', "<a href='&#106;avascript:x'>x</a>",
    '<a href=java&#9;script:x>x</a>', '<img src=" javascript:x">',
  ]) assert.ok(v(t).length, JSON.stringify(t));
  for (const t of ['[x](https://a.com/java script)', '[x](#javascript-sdk)', '[java](script.md)', '<a href="/docs/javascript/">x</a>', '[x](../javascript:y)']) {
    assert.deepEqual(v(t), [], JSON.stringify(t));
  }
});

test('a script URL is never joined into a link, whatever the policy says', async () => {
  const { toMdx } = await import('../src/syntax.js');
  const { inlineMarkdown } = await import('../src/html-blocks.js');
  assert.equal(toMdx('[x](java\nscript:alert(1))').body, '[x](java\nscript:alert(1))');
  assert.equal(inlineMarkdown('[x](java\nscript:alert\\(1\\))'), '{"[x](java script:alert(1))"}');
  assert.equal(inlineMarkdown('[x](javascript:y)', { html: true, markdown: true }), '[x](javascript:y)');
});

test('allows iframes only from allow-listed hosts', () => {
  assert.equal(v('<iframe src="https://www.youtube.com/embed/abc"></iframe>').length, 0);
  assert.ok(v('<iframe src="https://evil.example/x"></iframe>').length);
});

test('ignores code samples', () => {
  assert.equal(v('```html\n<script src="/main.js"></script>\n```\nInline `<script>`').length, 0);
});

test('turns quick-start meta into data without running it', () => {
  const r = applyHtmlPolicy('<script>\n  const meta = { what_you_will_learn: ["A", "B"], time: 10 };\n</script>\nBody');
  assert.deepEqual(r.meta, { what_you_will_learn: ['A', 'B'], time: 10 });
  assert.equal(r.violations.length, 0);
  assert.doesNotMatch(r.text, /script/);
  assert.ok(applyHtmlPolicy('<script>const meta = { a: fetch("x") };</script>').violations.length);
  assert.ok(applyHtmlPolicy('<script>const meta = { ["__proto__"]: 1 };</script>').violations.length);
  assert.ok(applyHtmlPolicy('<script>const meta = { __proto__: { polluted: 1 } };</script>').violations.length);
});

test('finds include markers that were not expanded', () => {
  assert.deepEqual(unexpandedMarkers('a {!x.md!} b'), ['{!x.md!}']);
  assert.equal(unexpandedMarkers('```\n{!x.md!}\n```').length, 0);
});

test('placeholders that look like tags are not violations', () => {
  assert.equal(v('Use <base-url>/x and <link-name> in the <form-id> field.').length, 0);
  assert.ok(v('<base href="https://x">').length);
  assert.ok(v('<link rel="stylesheet" href="x.css">').length);
});

test('removeForbiddenElements drops scripts, styles and links with their content; code samples stay', () => {
  const src = 'A <style>.x{}</style>\n<script src="x.js"></script>\n<SCRIPT>\nalert(1)\n</SCRIPT>\n<link rel="stylesheet" href="x.css">\n\n```html\n<script>kept()</script>\n```\nB';
  const { text, removed } = removeForbiddenElements(src);
  assert.deepEqual(removed.sort(), ['link', 'script', 'script', 'style']);
  assert.doesNotMatch(text.replace(/```html[\s\S]*```/, ''), /script|style|link|alert/i);
  assert.match(text, /<script>kept\(\)<\/script>/);
  assert.deepEqual(applyHtmlPolicy(text).violations, []);
});

test('removeForbiddenElements leaves an unclosed script for the policy to reject', () => {
  const { text } = removeForbiddenElements('<script>never closed');
  assert.match(applyHtmlPolicy(text).violations[0], /<script>/);
});

test('removeForbiddenElements removes every event handler on a tag', () => {
  const { text, removed } = removeForbiddenElements('<img src="a.png" onerror="x()" onload=\'y()\' alt="a">');
  assert.equal(text, '<img src="a.png" alt="a">');
  assert.deepEqual(removed, ['onerror', 'onload']);
});

test('removeForbiddenElements turns a navigation-only onclick on a div or span into a link to the same page', () => {
  const card = '<div class="card" onclick="location.href=\'get-started/quick-start/\';">\n  <div class="card-icon"><div>x</div></div>\n  <p class="title">Quick Start</p>\n</div>\n<div>after</div>';
  const { text, removed } = removeForbiddenElements(card);
  assert.equal(text, '<a href="get-started/quick-start/" class="card">\n  <div class="card-icon"><div>x</div></div>\n  <p class="title">Quick Start</p>\n</a>\n<div>after</div>');
  assert.deepEqual(removed, ['onclick']);
  assert.deepEqual(applyHtmlPolicy(text).violations, []);
  const kept = (h: string) => removeForbiddenElements(h).text;
  assert.equal(kept('<div onclick="window.open(\'https://x.com\', \'_blank\')">x</div>'), '<div>x</div>', 'other handlers are only removed');
  assert.equal(kept('<div onclick="location.href=\'a/\'"><a href="b/">b</a></div>'), '<div><a href="b/">b</a></div>', 'links never nest');
  assert.equal(kept('<td onclick="location.href=\'a/\'">x</td>'), '<td>x</td>', 'table structure stays');
  assert.match(applyHtmlPolicy(kept('<div onclick="location.href=\'javascript:alert(1)\'">x</div>')).violations[0]!, /javascript/i, 'the URL is still checked');
});
