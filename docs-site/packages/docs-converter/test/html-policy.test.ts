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
