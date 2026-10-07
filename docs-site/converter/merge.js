// Render one page for two deployment options at once (content sources whose cloud and self-hosted pages
// share templates, such as docs-is). Agreeing content is kept once; differences become labelled blocks.
import { evaluate, takenBranch, setValue, parse } from './template.js';
import { loadPage, renderSingle, findInclude } from './render.js';

export const CLOUD = 'WSO2 Cloud';
export const SELF_HOSTED = 'Self-hosted';

const inFence = (s) => (s.match(/^[ \t]*(```|~~~)/gm) ?? []).length % 2 === 1;
// Inside an inline code span on the current line (odd number of single backticks so far).
const inInlineCode = (s) => ((s.slice(s.lastIndexOf('\n') + 1).replace(/``+/g, '').match(/`/g) ?? []).length % 2 === 1);
const attr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/[{}]/g, (c) => (c === '{' ? '&#123;' : '&#125;'));
// Indentation of the line being written (content inside admonitions, lists and tabs is indented).
const currentIndent = (s) => { const m = s.match(/(?:^|\n)([ \t]*)$/); return m ? m[1] : ''; };
/** A labelled block at `indent`, keeping the body's own indentation so it stays inside its container. */
function applies(who, body, indent = '') {
  const text = body.replace(/^\s*\n/, '').trimEnd();
  if (!text.trim()) return '';
  // Content that starts on the tag's own line (an indented {% include %} or inline branch) lost the
  // indentation on every later line: Jinja indents only the first. Shift all of it. Content that starts on
  // a new line carries its own indentation; only make sure nothing escapes the container.
  const continuesLine = /^[^\n\s]/.test(body);
  const lines = text.split('\n').map((l, i) => {
    if (!l.trim()) return '';
    if (i === 0) return l.startsWith(indent) ? l : indent + l.replace(/^[ \t]*/, '');
    if (continuesLine) return indent + l;
    return l.startsWith(indent) ? l : indent + l;
  });
  return `\n\n${indent}<Applies to="${who}">\n\n${lines.join('\n')}\n\n${indent}</Applies>\n\n${indent}`;
}

// Inside code, differing branches are marked and the whole code sample is later split into one labelled
// copy per deployment option (a label cannot sit inside code).
const MARK = { cloud: '\u2063C\u2064', self: '\u2063S\u2064', end: '\u2063E\u2064' };

function splitCodeSamples(text) {
  if (!text.includes(MARK.end)) return text;
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(/^([ \t]*)(`{3,}|~{3,})/);
    if (!open) { out.push(lines[i]); continue; }
    let j = i + 1;
    while (j < lines.length && !new RegExp(`^[ \\t]*${open[2][0]}{${open[2].length},}[ \\t]*$`).test(lines[j])) j++;
    const block = lines.slice(i, j + 1).join('\n');
    if (!block.includes(MARK.end)) { out.push(block); i = j; continue; }
    const keep = (side) => block.replace(/\u2063C\u2064([\s\S]*?)\u2063S\u2064([\s\S]*?)\u2063E\u2064/g, (_, c, sh) => (side === 'cloud' ? c : sh));
    const indent = open[1];
    out.push(`${indent}<Applies to="${CLOUD}">\n\n${keep('cloud')}\n\n${indent}</Applies>\n\n${indent}<Applies to="${SELF_HOSTED}">\n\n${keep('self')}\n\n${indent}</Applies>`);
    i = j;
  }
  return out.join('\n');
}

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
      else if (inFence(out.s) || inInlineCode(out.s)) { out.s += `<${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}>`; stats.placeholders++; }
      else if (/\n/.test(cv + sv)) { const ind = currentIndent(out.s); out.s += applies(CLOUD, cv, ind) + applies(SELF_HOSTED, sv, ind); stats.splitBlocks++; }
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
      const cText = bc >= 0 ? renderSingle(node.branches[bc].kids, { ...c.env }, file, c.source) : '';
      const sText = bs >= 0 ? renderSingle(node.branches[bs].kids, { ...s.env }, file, s.source) : '';
      if (inFence(out.s)) {
        out.s += `${MARK.cloud}${cText}${MARK.self}${sText}${MARK.end}`;
        stats.splitsInCode++;
      } else {
        const ind = currentIndent(out.s);
        out.s += applies(CLOUD, cText, ind) + applies(SELF_HOSTED, sText, ind);
      }
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
    return { text: splitCodeSamples(renderMerged(body(cn), cloudFile, sides, sharedNames, stats, { s: '' })), stats };
  }
  stats.diverged = true;
  const text = applies(CLOUD, renderSingle(body(cn), sides.cloud.env, cloudFile, sides.cloud.source))
    + applies(SELF_HOSTED, renderSingle(body(sn), sides.self.env, selfFile, sides.self.source));
  return { text, stats };
}

export { parse };
