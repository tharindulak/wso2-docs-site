// Render one page for two deployment options at once (content sources whose cloud and self-hosted pages
// share templates, such as docs-is). Agreeing content is kept once; differences become labelled blocks.
import { evaluate, takenBranch, setValue } from './template.js';
import { loadPage, renderSingle, findInclude } from './render.js';
import type { Env, Source, TemplateNode } from './types.js';

export const CLOUD = 'WSO2 Cloud';
export const SELF_HOSTED = 'Self-hosted';

export interface MergeSide { env: Env; source: Source }
export interface MergeSides { cloud: MergeSide; self: MergeSide }
export interface MergeStats {
  sharedNames: number; placeholders: number; values: number; splitBlocks: number; splitsInCode: number; diverged: boolean;
}

const inFence = (s: string): boolean => (s.match(/^[ \t]*(```|~~~)/gm) ?? []).length % 2 === 1;
// Inside an inline code span on the current line (odd number of single backticks so far).
const inInlineCode = (s: string): boolean => ((s.slice(s.lastIndexOf('\n') + 1).replace(/``+/g, '').match(/`/g) ?? []).length % 2 === 1);
const attr = (v: unknown): string => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/[{}]/g, (c) => (c === '{' ? '&#123;' : '&#125;'));
// Inside a Markdown link or image target on the current line (`](` not yet closed).
const inLinkTarget = (s: string): boolean => /\]\([^()\n]*$/.test(s.slice(s.lastIndexOf('\n') + 1));
// Indentation of the line being written (content inside admonitions, lists and tabs is indented).
const currentIndent = (s: string): string => s.match(/(?:^|\n)([ \t]*)$/)?.[1] ?? '';
// A value fills its line when only indentation precedes it and a line break (or the end) follows it.
const atLineStart = (s: string): boolean => /(?:^|\n)[ \t]*$/.test(s);
const endsLine = (next: TemplateNode | undefined): boolean => !next || (next.t === 'text' && /^[ \t]*(?:\r?\n|$)/.test(next.v));
// A value that is Markdown structure rather than a word or URL: list item, heading, quote, admonition,
// tabs, HTML block, or a link.
const isMarkdownBlock = (v: string): boolean => /^\s*(?:[-*+]\s|\d+\.\s|#{1,6}\s|>\s|!!!|\?\?\?|===|<[A-Za-z])/.test(v) || /\]\(/.test(v);

/** A labelled block at `indent`, keeping the body's own indentation so it stays inside its container. */
function applies(who: string, body: string, indent = ''): string {
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
const MARK = { cloud: '⁣C⁤', self: '⁣S⁤', end: '⁣E⁤' };

function splitCodeSamples(text: string): string {
  if (!text.includes(MARK.end)) return text;
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i]!.match(/^([ \t]*)(`{3,}|~{3,})/);
    if (!open) { out.push(lines[i]!); continue; }
    let j = i + 1;
    const fenceChar = open[2]![0];
    while (j < lines.length && !new RegExp(`^[ \\t]*${fenceChar}{${open[2]!.length},}[ \\t]*$`).test(lines[j]!)) j++;
    const block = lines.slice(i, j + 1).join('\n');
    if (!block.includes(MARK.end)) { out.push(block); i = j; continue; }
    const keep = (side: 'cloud' | 'self'): string =>
      block.replace(/⁣C⁤([\s\S]*?)⁣S⁤([\s\S]*?)⁣E⁤/g, (_, c: string, sh: string) => (side === 'cloud' ? c : sh));
    const indent = open[1]!;
    out.push(`${indent}<Applies to="${CLOUD}">\n\n${keep('cloud')}\n\n${indent}</Applies>\n\n${indent}<Applies to="${SELF_HOSTED}">\n\n${keep('self')}\n\n${indent}</Applies>`);
    i = j;
  }
  return out.join('\n');
}

// A differing value inside a link target is marked, and the link is later written once per deployment option
// (splitLinks): a component cannot sit inside a URL.
const LINK = { cloud: '\u2063c\u2064', self: '\u2063s\u2064', end: '\u2063e\u2064' };
const LINK_VALUE = new RegExp(`${LINK.cloud}([\\s\\S]*?)${LINK.self}([\\s\\S]*?)${LINK.end}`, 'g');

/**
 * Each link whose target holds marked values becomes one link per deployment option, labelled as
 * <DeploymentValue> labels a value: `[x](/a) (WSO2 Cloud) / [x](/b) (Self-hosted)`. An option whose value is empty
 * gets no link, and the other is labelled "only". Marks outside any link fall back to <DeploymentValue>.
 */
function splitLinks(text: string): string {
  if (!text.includes(LINK.end)) return text;
  const side = (url: string, k: 1 | 2): { url: string; empty: boolean } => {
    let empty = false;
    const out = url.replace(LINK_VALUE, (...m: string[]) => { if (!m[k]) empty = true; return m[k]!; });
    return { url: out, empty };
  };
  const linked = text.replace(/(!?\[(?:[^[\]\n]|\[[^\]\n]*\])*\])\(([^()\n]*)\)/g, (whole, label: string, url: string) => {
    if (!url.includes(LINK.end)) return whole;
    const c = side(url, 1);
    const s = side(url, 2);
    if (c.empty) return `${label}(${s.url}) <small>(${SELF_HOSTED} only)</small>`;
    if (s.empty) return `${label}(${c.url}) <small>(${CLOUD} only)</small>`;
    return `${label}(${c.url}) <small>(${CLOUD})</small> / ${label}(${s.url}) <small>(${SELF_HOSTED})</small>`;
  });
  return linked.replace(LINK_VALUE, (_, c: string, s: string) => `<DeploymentValue cloud="${attr(c)}" selfHosted="${attr(s)}" />`);
}

function renderMerged(nodes: TemplateNode[], file: string, sides: MergeSides, sharedNames: Record<string, string>, stats: MergeStats, out: { s: string }): string {
  const c = sides.cloud;
  const s = sides.self;
  for (const [index, node] of nodes.entries()) {
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
      else if (/\n/.test(cv + sv) || (atLineStart(out.s) && endsLine(nodes[index + 1]) && (!cv || !sv || isMarkdownBlock(cv) || isMarkdownBlock(sv)))) {
        // Content, not a value: a value filling its whole line that exists for one option only, or is
        // Markdown structure (a list item, a link). Labelled blocks; an empty side gets none.
        const ind = currentIndent(out.s);
        out.s += applies(CLOUD, cv, ind) + applies(SELF_HOSTED, sv, ind);
        stats.splitBlocks++;
      }
      else if (inLinkTarget(out.s)) { out.s += `${LINK.cloud}${cv}${LINK.self}${sv}${LINK.end}`; stats.values++; }
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
        if (bc >= 0) renderMerged(node.branches[bc]!.kids, file, sides, sharedNames, stats, out);
        continue;
      }
      const cText = bc >= 0 ? renderSingle(node.branches[bc]!.kids, { ...c.env }, file, c.source) : '';
      const sText = bs >= 0 ? renderSingle(node.branches[bs]!.kids, { ...s.env }, file, s.source) : '';
      if (inFence(out.s)) {
        out.s += `${MARK.cloud}${cText}${MARK.self}${sText}${MARK.end}`;
        stats.splitsInCode++;
      } else if (inLinkTarget(out.s) && !/\n/.test(cText + sText)) {
        out.s += `${LINK.cloud}${cText}${LINK.self}${sText}${LINK.end}`; // a path chosen by branch (see splitLinks)
      } else {
        const ind = currentIndent(out.s);
        out.s += applies(CLOUD, cText, ind) + applies(SELF_HOSTED, sText, ind);
      }
      stats.splitBlocks++;
    }
  }
  return out.s;
}

const shape = (nodes: TemplateNode[], file: string, source: Source): string[] => nodes
  .filter((n) => n.t !== 'set' && !(n.t === 'text' && !n.v.trim()))
  .map((n) => (n.t === 'include' ? `inc:${findInclude(source, file, n.path)}`
    : n.t === 'text' ? `t:${n.v.trim()}`
      : `${n.t}:${JSON.stringify(n.t === 'if' ? n.branches : n.t === 'var' ? n.expr : '')}`));

/**
 * Merge a page that exists on both sides. If both wrapper pages reduce to the same includes, merge node by
 * node; otherwise keep both whole renderings, labelled.
 * @param sharedNames value to use when a variable differs but text is shared (product_name -> "WSO2 Identity Platform")
 */
export function mergePage(cloudFile: string, selfFile: string, sides: MergeSides, sharedNames: Record<string, string> = {}): { text: string; stats: MergeStats } {
  const stats: MergeStats = { sharedNames: 0, placeholders: 0, values: 0, splitBlocks: 0, splitsInCode: 0, diverged: false };
  const cn = loadPage(cloudFile, sides.cloud.source);
  const sn = loadPage(selfFile, sides.self.source);
  const applySets = (nodes: TemplateNode[], side: MergeSide, file: string): void => {
    for (const n of nodes) if (n.t === 'set') side.env[n.name] = setValue(n.expr, side.env, (x, e) => renderSingle(x, e, file, side.source));
  };
  applySets(cn, sides.cloud, cloudFile);
  applySets(sn, sides.self, selfFile);
  const body = (nodes: TemplateNode[]): TemplateNode[] => nodes.filter((n) => n.t !== 'set');
  if (JSON.stringify(shape(cn, cloudFile, sides.cloud.source)) === JSON.stringify(shape(sn, selfFile, sides.self.source))) {
    return { text: splitLinks(splitCodeSamples(renderMerged(body(cn), cloudFile, sides, sharedNames, stats, { s: '' }))), stats };
  }
  stats.diverged = true;
  const text = applies(CLOUD, renderSingle(body(cn), sides.cloud.env, cloudFile, sides.cloud.source))
    + applies(SELF_HOSTED, renderSingle(body(sn), sides.self.env, selfFile, sides.self.source));
  return { text, stats };
}
