// PROTOTYPE, throwaway: render one shared docs-is page for BOTH deployment options at once.
// Where cloud and self-hosted agree, text is kept once; where they differ, both are kept and labelled.
import { evaluate, load, resolveInclude, renderSingle, parse } from './jinja.mjs';

const CLOUD = 'WSO2 Cloud', SELF = 'Self-hosted';
export const SHARED_PRODUCT_NAME = 'WSO2 Identity Platform'; // naming decision pending; see ticket answer

const inFence = (s) => (s.match(/^\s*(```|~~~)/gm) || []).length % 2 === 1;
const applies = (who, body) => (body.trim() ? `\n\n<Applies to="${who}">\n\n${body.trim()}\n\n</Applies>\n\n` : '');

export function renderMerged(nodes, envC, envS, file, stats, out = { s: '' }) {
  for (const n of nodes) {
    if (n.t === 'text') out.s += n.v;
    else if (n.t === 'set') {
      // Wrapper-level sets are applied per side by the caller; a set inside shared content applies to both.
      for (const env of [envC, envS]) env[n.name] = renderSingle(parse(n.expr.trim().replace(/^["']|["']$/g, '')), env, file, stats);
    } else if (n.t === 'var') {
      const c = evaluate(n.expr, envC), s = evaluate(n.expr, envS);
      if (String(c ?? '') === String(s ?? '')) { out.s += c ?? ''; continue; }
      const name = n.expr.trim();
      if (name === 'product_name') { stats.productNameShared++; out.s += SHARED_PRODUCT_NAME; continue; }
      stats.varsDiffer[name] = (stats.varsDiffer[name] || 0) + 1;
      if (inFence(out.s)) out.s += `<${name.toUpperCase()}>`;           // code sample: placeholder
      else if (/\n/.test(String(c ?? '') + String(s ?? ''))) { out.s += applies(CLOUD, String(c ?? '')) + applies(SELF, String(s ?? '')); stats.blocksSplit++; }
      else out.s += `<DeploymentValue cloud="${esc(c)}" selfHosted="${esc(s)}" />`;
    } else if (n.t === 'include') {
      const f = resolveInclude(file, n.path); renderMerged(load(f), envC, envS, f, stats, out);
    } else if (n.t === 'if') {
      const bc = n.branches.findIndex((b) => evaluate(b.cond, envC));
      const bs = n.branches.findIndex((b) => evaluate(b.cond, envS));
      stats.conditionals++;
      if (bc === bs) { if (bc >= 0) renderMerged(n.branches[bc].kids, envC, envS, file, stats, out); stats.conditionalsAgree++; continue; }
      if (inFence(out.s)) stats.splitInsideCode++;
      const c = bc >= 0 ? renderSingle(n.branches[bc].kids, { ...envC }, file, stats) : '';
      const s = bs >= 0 ? renderSingle(n.branches[bs].kids, { ...envS }, file, stats) : '';
      out.s += applies(CLOUD, c) + applies(SELF, s); stats.blocksSplit++;
    } else { stats.unknown++; out.s += n.v; }
  }
  return out.s;
}
const esc = (v) => String(v ?? '').replace(/"/g, '&quot;');

// Shared path: if both wrappers reduce to the same includes, merge node by node; else keep two whole pages.
export function mergePage(cFile, sFile, envC, envS, stats) {
  const cn = load(cFile), sn = load(sFile);
  for (const n of cn) if (n.t === 'set') envC[n.name] = renderSingle(parse(n.expr.trim().replace(/^["']|["']$/g, '')), envC, cFile, stats);
  for (const n of sn) if (n.t === 'set') envS[n.name] = renderSingle(parse(n.expr.trim().replace(/^["']|["']$/g, '')), envS, sFile, stats);
  const shape = (nodes, f) => nodes.filter((n) => n.t !== 'set' && !(n.t === 'text' && !n.v.trim()))
    .map((n) => (n.t === 'include' ? 'inc:' + resolveInclude(f, n.path) : n.t === 'text' ? 't:' + n.v.trim() : n.t + ':' + JSON.stringify(n.branches ?? n.expr ?? '')));
  if (JSON.stringify(shape(cn, cFile)) === JSON.stringify(shape(sn, sFile))) {
    return { kind: 'merged', body: renderMerged(cn.filter((n) => n.t !== 'set'), envC, envS, cFile, stats) };
  }
  return { kind: 'diverged', body: applies(CLOUD, renderSingle(cn.filter((n) => n.t !== 'set'), envC, cFile, stats)) + applies(SELF, renderSingle(sn.filter((n) => n.t !== 'set'), envS, sFile, stats)) };
}
