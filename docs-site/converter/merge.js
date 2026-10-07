// Render one page for two deployment options at once (content sources whose cloud and self-hosted pages
// share templates, such as docs-is). Agreeing content is kept once; differences become labelled blocks.
import { evaluate, takenBranch, setValue, parse } from './template.js';
import { loadPage, renderSingle, findInclude } from './render.js';

export const CLOUD = 'WSO2 Cloud';
export const SELF_HOSTED = 'Self-hosted';

const inFence = (s) => (s.match(/^[ \t]*(```|~~~)/gm) ?? []).length % 2 === 1;
const attr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/[{}]/g, (c) => (c === '{' ? '&#123;' : '&#125;'));
const applies = (who, body) => (body.trim() ? `\n\n<Applies to="${who}">\n\n${body.trim()}\n\n</Applies>\n\n` : '');

/**
 * @param sides {{ cloud: {env, source}, self: {env, source} }} per-side variables and source context
 * @param sharedNames {Record<string,string>} value to use when a variable differs but text is shared
 *        (for example product_name -> "WSO2 Identity Platform")
 */
function renderMerged(nodes, file, sides, sharedNames, stats, out) {
  const c = sides.cloud;
  const s = sides.self;
  for (const node of nodes) {
    if (node.t === 'text') { out.s += node.v; continue; }
    if (node.t === 'set') {
      c.env[node.name] = setValue(node.expr, c.env, (n, e) => renderSingle(n, e, file, c.source));
      s.env[node.name] = setValue(node.expr, s.env, (n, e) => renderSingle(n, e, file, s.source));
      continue;
    }
    if (node.t === 'var') {
      const cv = String(evaluate(node.expr, c.env) ?? '');
      const sv = String(evaluate(node.expr, s.env) ?? '');
      const name = node.expr.trim();
      if (cv === sv) out.s += cv;
      else if (name in sharedNames) { out.s += sharedNames[name]; stats.sharedNames++; }
      else if (inFence(out.s)) { out.s += `<${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}>`; stats.placeholders++; }
      else if (/\n/.test(cv + sv)) { out.s += applies(CLOUD, cv) + applies(SELF_HOSTED, sv); stats.splitBlocks++; }
      else { out.s += `<DeploymentValue cloud="${attr(cv)}" selfHosted="${attr(sv)}" />`; stats.values++; }
      continue;
    }
    if (node.t === 'include') {
      const target = findInclude(c.source, file, node.path);
      renderMerged(loadPage(target, c.source), target, sides, sharedNames, stats, out);
      continue;
    }
    if (node.t === 'if') {
      const bc = takenBranch(node, c.env);
      const bs = takenBranch(node, s.env);
      if (bc === bs) {
        if (bc >= 0) renderMerged(node.branches[bc].kids, file, sides, sharedNames, stats, out);
        continue;
      }
      if (inFence(out.s)) stats.splitsInCode++;
      const cText = bc >= 0 ? renderSingle(node.branches[bc].kids, { ...c.env }, file, c.source) : '';
      const sText = bs >= 0 ? renderSingle(node.branches[bs].kids, { ...s.env }, file, s.source) : '';
      out.s += applies(CLOUD, cText) + applies(SELF_HOSTED, sText);
      stats.splitBlocks++;
    }
  }
  return out.s;
}

const shape = (nodes, file, source) => nodes
  .filter((n) => n.t !== 'set' && !(n.t === 'text' && !n.v.trim()))
  .map((n) => (n.t === 'include' ? `inc:${findInclude(source, file, n.path)}` : n.t === 'text' ? `t:${n.v.trim()}` : `${n.t}:${JSON.stringify(n.branches ?? n.expr ?? '')}`));

/**
 * Merge a page that exists on both sides. If both wrapper pages reduce to the same includes, merge node by
 * node; otherwise keep both whole renderings, labelled.
 */
export function mergePage(cloudFile, selfFile, sides, sharedNames = {}) {
  const stats = { sharedNames: 0, placeholders: 0, values: 0, splitBlocks: 0, splitsInCode: 0, diverged: false };
  const cn = loadPage(cloudFile, sides.cloud.source);
  const sn = loadPage(selfFile, sides.self.source);
  const applySets = (nodes, side, file) => {
    for (const n of nodes) if (n.t === 'set') side.env[n.name] = setValue(n.expr, side.env, (x, e) => renderSingle(x, e, file, side.source));
  };
  applySets(cn, sides.cloud, cloudFile);
  applySets(sn, sides.self, selfFile);
  const body = (nodes) => nodes.filter((n) => n.t !== 'set');
  if (JSON.stringify(shape(cn, cloudFile, sides.cloud.source)) === JSON.stringify(shape(sn, selfFile, sides.self.source))) {
    return { text: renderMerged(body(cn), cloudFile, sides, sharedNames, stats, { s: '' }), stats };
  }
  stats.diverged = true;
  const text = applies(CLOUD, renderSingle(body(cn), sides.cloud.env, cloudFile, sides.cloud.source))
    + applies(SELF_HOSTED, renderSingle(body(sn), sides.self.env, selfFile, sides.self.source));
  return { text, stats };
}

export { parse };
