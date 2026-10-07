import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, evaluate, compareValues, TemplateError } from '../template.js';

const env = { product_name: 'WSO2 Identity Server', is_version: '7.3.0', content: { ext: 'p12' } };

test('comparisons, boolean logic and membership', () => {
  assert.equal(evaluate('product_name == "WSO2 Identity Server" and is_version > "7.2.0"', env), true);
  assert.equal(evaluate('product_name == "WSO2 Identity Platform" or (is_version is defined and is_version >= "7.3.0")', env), true);
  assert.equal(evaluate('is_version not in ["7.0.0", "7.1.0"]', env), true);
  assert.equal(evaluate('is_version in ["7.0.0", "7.1.0"]', env), false);
  assert.equal(evaluate('not missing is defined', env), true);
  assert.equal(evaluate('content.ext', env), 'p12');
  assert.equal(evaluate('missing == "x"', env), false);
});

test('version-shaped strings compare numerically (fixes Jinja string order)', () => {
  assert.equal(compareValues('7.10.0', '7.2.0'), 1);
  assert.equal(evaluate('v > "7.2.0"', { v: '7.10.0' }), true);
  assert.equal(compareValues('b', 'a'), 1);
});

test('refuses anything outside the allow-listed grammar', () => {
  for (const expr of ['x if y else z', 'name | upper', 'foo()', 'a + b', '__import__("os")']) {
    assert.throws(() => evaluate(expr, env), TemplateError, expr);
  }
});

test('parses nested conditionals, raw blocks and set', () => {
  const nodes = parse('{% set a = "x" %}{% if a == "x" %}{% if b %}B{% else %}A{% endif %}{% elif c %}C{% endif %}{% raw %}{{ kept }}{% endraw %}');
  assert.equal(nodes[0].t, 'set');
  assert.equal(nodes[1].t, 'if');
  assert.equal(nodes[1].branches.length, 2);
  assert.equal(nodes.at(-1).v, '{{ kept }}');
});

test('reports unbalanced and unsupported statements', () => {
  assert.throws(() => parse('{% if a %}x'), /Unclosed/);
  assert.throws(() => parse('{% endif %}'), /Unexpected/);
  assert.throws(() => parse('{% for x in y %}{% endfor %}'), /Unsupported statement/);
  assert.throws(() => parse('{% macro m() %}{% endmacro %}'), /Unsupported statement/);
});

test('a string literal may contain }} or %}, as in Jinja: {{ \'{{code}}\' }} prints {{code}}', () => {
  const nodes = parse("Use {{ '{{confirmation-code}}' }} and {{ \"{%x%}\" }}.");
  assert.deepEqual(nodes.map((n) => n.t), ['text', 'var', 'text', 'var', 'text']);
  assert.equal(evaluate(nodes[1].expr, {}), '{{confirmation-code}}');
  assert.equal(evaluate(nodes[3].expr, {}), '{%x%}');
});
