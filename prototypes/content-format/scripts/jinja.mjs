// PROTOTYPE, throwaway: the subset of Jinja that docs-is uses (if/elif/else, include, set, raw, {{ var }}).
// Conditions are parsed with an allow-listed grammar, never evaluated as code.
import fs from 'node:fs';
import path from 'node:path';

const TAG = /\{%-?\s*([\s\S]*?)\s*-?%\}|\{\{\s*([\s\S]*?)\s*\}\}/g;

export function parse(src) {
  // Pull {% raw %} blocks out first: their content is literal.
  const raws = [];
  src = src.replace(/\{%-?\s*raw\s*-?%\}([\s\S]*?)\{%-?\s*endraw\s*-?%\}/g, (_, body) => `\u0000RAW${raws.push(body) - 1}\u0000`);
  const root = { kids: [] }; const stack = [root];
  const top = () => stack[stack.length - 1];
  const text = (v) => { if (v) top().kids.push(...v.split(/\u0000RAW(\d+)\u0000/).map((s, i) => ({ t: 'text', v: i % 2 ? raws[+s] : s }))); };
  let last = 0, m;
  while ((m = TAG.exec(src))) {
    text(src.slice(last, m.index)); last = TAG.lastIndex;
    if (m[2] !== undefined) { top().kids.push({ t: 'var', expr: m[2] }); continue; }
    const st = m[1]; const kw = st.split(/\s+/)[0];
    if (kw === 'if') { const n = { t: 'if', branches: [{ cond: st.slice(2).trim(), kids: [] }] }; top().kids.push(n); stack.push(n.branches[0]); }
    else if (kw === 'elif' || kw === 'else') { stack.pop(); const n = findIf(stack); const b = { cond: kw === 'else' ? 'true' : st.slice(4).trim(), kids: [] }; n.branches.push(b); stack.push(b); }
    else if (kw === 'endif') { stack.pop(); }
    else if (kw === 'include') top().kids.push({ t: 'include', path: st.match(/["']([^"']+)["']/)[1] });
    else if (kw === 'set') { const s = st.match(/^set\s+([A-Za-z_]\w*)\s*=\s*([\s\S]*)$/); top().kids.push({ t: 'set', name: s[1], expr: s[2] }); }
    else top().kids.push({ t: 'unknown', v: m[0] });
  }
  text(src.slice(last));
  return root.kids;
}
function findIf(stack) { const p = stack[stack.length - 1].kids; return p[p.length - 1]; }

// ---- expression grammar: or/and/not, comparisons, in/not in, is defined, lists, strings, names ----
function lex(s) {
  const out = []; const re = /\s*(?:("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(==|!=|>=|<=|>|<|\(|\)|\[|\]|,)|([A-Za-z_][\w.]*))/y;
  let m; while (re.lastIndex < s.length && (m = re.exec(s))) {
    if (m[1]) out.push({ k: 'str', v: m[1].slice(1, -1) }); else if (m[2]) out.push({ k: 'op', v: m[2] }); else out.push({ k: 'id', v: m[3] });
  }
  if (re.lastIndex < s.trimEnd().length) throw new Error(`Unsupported expression: ${s}`);
  return out;
}
export function evaluate(expr, env) {
  const tk = lex(expr); let i = 0;
  const peek = (v) => tk[i] && tk[i].v === v; const eat = (v) => { if (!peek(v)) throw new Error(`Expected ${v} in ${expr}`); i++; };
  const atom = () => {
    const t = tk[i++]; if (!t) throw new Error(`Truncated: ${expr}`);
    if (t.v === '(') { const v = or(); eat(')'); return v; }
    if (t.v === '[') { const l = []; while (!peek(']')) { l.push(atom()); if (peek(',')) i++; } eat(']'); return l; }
    if (t.k === 'str') return t.v;
    if (t.v === 'true') return true; if (t.v === 'false') return false;
    if (t.k === 'id') return t.v.split('.').reduce((o, k) => (o == null ? undefined : o[k]), env);
    throw new Error(`Bad token ${t.v} in ${expr}`);
  };
  const cmp = () => {
    const a = atom();
    if (peek('is')) { i++; const neg = peek('not') && ++i; eat('defined'); return neg ? a === undefined : a !== undefined; }
    if (peek('not') && tk[i + 1]?.v === 'in') { i += 2; const l = atom(); return !(Array.isArray(l) && l.includes(a)); }
    if (peek('in')) { i++; const l = atom(); return Array.isArray(l) ? l.includes(a) : String(l ?? '').includes(a); }
    const op = tk[i]?.k === 'op' && ['==', '!=', '>=', '<=', '>', '<'].includes(tk[i].v) ? tk[i++].v : null;
    if (!op) return a;
    const b = atom(); if (a === undefined || b === undefined) return op === '!=';
    // Jinja compares strings lexically; keep that (so "7.10.0" > "7.2.0" is false, as in today's docs).
    return { '==': a === b, '!=': a !== b, '>=': a >= b, '<=': a <= b, '>': a > b, '<': a < b }[op];
  };
  const not = () => (peek('not') ? (i++, !not()) : cmp());
  const and = () => { let v = not(); while (peek('and')) { i++; const r = not(); v = v && r; } return v; };
  const or = () => { let v = and(); while (peek('or')) { i++; const r = and(); v = v || r; } return v; };
  const v = or(); if (i !== tk.length) throw new Error(`Trailing tokens in ${expr}`); return v;
}

export const load = (file) => parse(fs.readFileSync(file, 'utf8'));
export const resolveInclude = (fromFile, p) => path.resolve(path.dirname(fromFile), p);

// Render one side fully, the way MkDocs does today.
export function renderSingle(nodes, env, file, stats) {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += n.v;
    else if (n.t === 'set') env[n.name] = renderValue(n.expr, env, file, stats);
    else if (n.t === 'var') out += String(evaluate(n.expr, env) ?? '');
    else if (n.t === 'include') { const f = resolveInclude(file, n.path); out += renderSingle(load(f), env, f, stats); }
    else if (n.t === 'if') { const b = n.branches.find((b) => evaluate(b.cond, env)); if (b) out += renderSingle(b.kids, env, file, stats); }
    else { stats.unknown++; out += n.v; }
  }
  return out;
}
// A {% set x = "..." %} value can itself be Markdown with Jinja inside.
function renderValue(expr, env, file, stats) {
  const s = expr.trim(); const q = s[0];
  if (q === '"' || q === "'") return renderSingle(parse(s.slice(1, -1)), env, file, stats);
  return evaluate(s, env);
}
