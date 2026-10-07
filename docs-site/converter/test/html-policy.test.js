import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHtmlPolicy, unexpandedMarkers } from '../html-policy.js';

const v = (t) => applyHtmlPolicy(t).violations;

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
