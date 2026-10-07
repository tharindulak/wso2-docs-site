// Jinja subset used by WSO2 MkDocs content sources (see .scratch/wso2-docs-site/issues/13-conversion-contract.md):
// {% if/elif/else/endif %}, {% include %}, {% set %}, {% raw %}, {{ variable }}.
// Conditions are parsed with an allow-listed grammar and never evaluated as code.

const TAG = /\{%-?\s*([\s\S]*?)\s*-?%\}|\{\{\s*([\s\S]*?)\s*\}\}/g;
const RAW = /\{%-?\s*raw\s*-?%\}([\s\S]*?)\{%-?\s*endraw\s*-?%\}/g;

export class TemplateError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'TemplateError';
    this.detail = detail;
  }
}

/** Parse template text into nodes: text, var, if, include, set. */
export function parse(source) {
  const raws = [];
  const text = source.replace(RAW, (_, body) => `\u0000RAW${raws.push(body) - 1}\u0000`);
  const root = { kids: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const pushText = (value) => {
    if (!value) return;
    value.split(/\u0000RAW(\d+)\u0000/).forEach((part, i) => {
      if (part) top().kids.push({ t: 'text', v: i % 2 ? raws[Number(part)] : part });
    });
  };

  let last = 0;
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(text))) {
    pushText(text.slice(last, m.index));
    last = TAG.lastIndex;
    if (m[2] !== undefined) {
      top().kids.push({ t: 'var', expr: m[2] });
      continue;
    }
    const statement = m[1];
    const keyword = statement.split(/\s+/)[0];
    if (keyword === 'if') {
      const node = { t: 'if', branches: [{ cond: statement.slice(2).trim(), kids: [] }] };
      top().kids.push(node);
      stack.push(node.branches[0]);
    } else if (keyword === 'elif' || keyword === 'else') {
      if (stack.length < 2) throw new TemplateError(`Unexpected {% ${keyword} %}`);
      stack.pop();
      const parent = top().kids[top().kids.length - 1];
      const branch = { cond: keyword === 'else' ? 'true' : statement.slice(4).trim(), kids: [] };
      parent.branches.push(branch);
      stack.push(branch);
    } else if (keyword === 'endif') {
      if (stack.length < 2) throw new TemplateError('Unexpected {% endif %}');
      stack.pop();
    } else if (keyword === 'include') {
      const target = statement.match(/^include\s+["']([^"']+)["']\s*$/);
      if (!target) throw new TemplateError(`Unsupported include: ${statement}`);
      top().kids.push({ t: 'include', path: target[1] });
    } else if (keyword === 'set') {
      const s = statement.match(/^set\s+([A-Za-z_]\w*)\s*=\s*([\s\S]*)$/);
      if (!s) throw new TemplateError(`Unsupported set: ${statement}`);
      top().kids.push({ t: 'set', name: s[1], expr: s[2] });
    } else {
      throw new TemplateError(`Unsupported statement {% ${keyword} %}`);
    }
  }
  pushText(text.slice(last));
  if (stack.length !== 1) throw new TemplateError('Unclosed {% if %}');
  return root.kids;
}

// ---- Expressions: or/and/not, comparisons, in / not in, is defined, lists, strings, dotted names ----

const TOKEN = /\s*(?:("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(==|!=|>=|<=|>|<|\(|\)|\[|\]|,)|([A-Za-z_][\w.]*))/y;
const VERSION = /^\d+(\.\d+)+$/;

function tokenize(expr) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  let m;
  while (TOKEN.lastIndex < expr.length && (m = TOKEN.exec(expr))) {
    if (m[1]) tokens.push({ k: 'str', v: m[1].slice(1, -1) });
    else if (m[2]) tokens.push({ k: 'op', v: m[2] });
    else tokens.push({ k: 'id', v: m[3] });
  }
  if (expr.slice(TOKEN.lastIndex).trim()) throw new TemplateError(`Unsupported expression: ${expr}`);
  return tokens;
}

/** Compare like Jinja, except that two version-shaped strings compare numerically (7.10.0 > 7.2.0). */
export function compareValues(a, b) {
  if (typeof a === 'string' && typeof b === 'string' && VERSION.test(a) && VERSION.test(b)) {
    const x = a.split('.').map(Number);
    const y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] ?? 0) - (y[i] ?? 0);
      if (d) return Math.sign(d);
    }
    return 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

const lookup = (name, env) => name.split('.').reduce((o, k) => (o == null ? undefined : o[k]), env);

/** Evaluate a condition or value expression against env. Unknown names are undefined, as in Jinja. */
export function evaluate(expr, env) {
  const tokens = tokenize(expr);
  let i = 0;
  const peek = (v) => tokens[i] && tokens[i].v === v;
  const eat = (v) => {
    if (!peek(v)) throw new TemplateError(`Expected "${v}" in: ${expr}`);
    i++;
  };
  const atom = () => {
    const t = tokens[i++];
    if (!t) throw new TemplateError(`Truncated expression: ${expr}`);
    if (t.v === '(') { const v = or(); eat(')'); return v; }
    if (t.v === '[') {
      const list = [];
      while (!peek(']')) { list.push(atom()); if (peek(',')) i++; }
      eat(']');
      return list;
    }
    if (t.k === 'str') return t.v;
    if (t.k === 'id') {
      if (t.v === 'true' || t.v === 'True') return true;
      if (t.v === 'false' || t.v === 'False') return false;
      if (t.v === 'none' || t.v === 'None') return null;
      if (['and', 'or', 'not', 'in', 'is'].includes(t.v)) throw new TemplateError(`Unexpected "${t.v}" in: ${expr}`);
      return lookup(t.v, env);
    }
    throw new TemplateError(`Unexpected "${t.v}" in: ${expr}`);
  };
  const comparison = () => {
    const a = atom();
    if (peek('is')) {
      i++;
      const negate = peek('not') ? (i++, true) : false;
      eat('defined');
      return negate ? a === undefined : a !== undefined;
    }
    if (peek('not') && tokens[i + 1]?.v === 'in') { i += 2; const l = atom(); return !contains(l, a); }
    if (peek('in')) { i++; return contains(atom(), a); }
    const op = tokens[i]?.k === 'op' && ['==', '!=', '>=', '<=', '>', '<'].includes(tokens[i].v) ? tokens[i++].v : null;
    if (!op) return a;
    const b = atom();
    if (op === '==') return a === b;
    if (op === '!=') return a !== b;
    if (a === undefined || b === undefined || a === null || b === null) return false;
    const c = compareValues(a, b);
    return { '>=': c >= 0, '<=': c <= 0, '>': c > 0, '<': c < 0 }[op];
  };
  const not = () => (peek('not') ? (i++, !not()) : comparison());
  const and = () => { let v = not(); while (peek('and')) { i++; const r = not(); v = Boolean(v) && Boolean(r); } return v; };
  const or = () => { let v = and(); while (peek('or')) { i++; const r = and(); v = Boolean(v) || Boolean(r); } return v; };
  const value = or();
  if (i !== tokens.length) throw new TemplateError(`Unsupported expression: ${expr}`);
  return value;
}

function contains(list, item) {
  if (Array.isArray(list)) return list.includes(item);
  if (typeof list === 'string' && typeof item === 'string') return list.includes(item);
  return false;
}

/** Which branch of an if node is taken in env (-1 when none). */
export function takenBranch(node, env) {
  return node.branches.findIndex((b) => Boolean(evaluate(b.cond, env)));
}

/** Value of a {% set %}: a quoted string is itself a template; anything else is an expression. */
export function setValue(expr, env, render) {
  const s = expr.trim();
  if (/^(["'])[\s\S]*\1$/.test(s)) return render(parse(s.slice(1, -1)), env);
  return evaluate(s, env);
}
