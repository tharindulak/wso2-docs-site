// Render MkDocs page sources for one deployment option: Jinja subset plus the include syntaxes found in
// WSO2 content sources ({% include %}, markdown-include {!file!}, pymdownx.snippets --8<--).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { parseExpressionAt } from 'acorn';
import { parse, evaluate, takenBranch, setValue, TemplateError } from './template.js';
import { literalValue } from './html-policy.js';

/**
 * A source context: where files may be read from and how includes resolve.
 * @typedef {{ root: string, includeBases: string[] }} Source
 */

/** Resolve a path inside the source root; anything escaping the repository is refused. */
export function insideRoot(source, candidate) {
  const resolved = path.resolve(candidate);
  const root = path.resolve(source.root) + path.sep;
  if (!resolved.startsWith(root)) throw new TemplateError(`Include escapes the content source: ${candidate}`);
  return resolved;
}

function readInside(source, file) {
  return fs.readFileSync(insideRoot(source, file), 'utf8');
}

function findInclude(source, fromFile, target) {
  const bases = [path.dirname(fromFile), ...source.includeBases];
  for (const base of bases) {
    const candidate = path.resolve(base, target.trim());
    if (!candidate.startsWith(path.resolve(source.root) + path.sep)) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new TemplateError(`Include not found: ${target.trim()} (from ${path.relative(source.root, fromFile)})`);
}

/** Expand markdown-include and snippets markers, and the {{#var#}} variable form, before templating. */
export function expandMarkers(text, fromFile, source, depth = 0) {
  if (depth > 8) throw new TemplateError(`Include nesting too deep at ${path.relative(source.root, fromFile)}`);
  const inline = (target) => {
    const file = findInclude(source, fromFile, target);
    return expandMarkers(readInside(source, file), file, source, depth + 1);
  };
  return text
    .replace(/\{!\s*([^!\n]+?)\s*!\}/g, (_, target) => inline(target))
    .replace(/^[ \t]*--8<--[ \t]+["']([^"'\n]+)["'][ \t]*$/gm, (_, target) => inline(target))
    .replace(/\{\{#([A-Za-z_]\w*)#\}\}/g, '{{ $1 }}');
}

const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;
const QUICK_START_META = /<script>\s*(?:const|let|var)\s+meta\s*=\s*([\s\S]*?);?\s*<\/script>\s*/;

/**
 * Page data that lives outside the content: YAML front matter (for example `template:`) and the quick-start
 * `<script>const meta = {...}</script>` literal. Both are removed from the body and returned as data, so they
 * never render and never make two otherwise identical wrapper pages look different.
 */
export function splitPageData(text) {
  let body = text;
  let frontMatter = {};
  let meta;
  const fm = body.match(FRONT_MATTER);
  if (fm) {
    try { frontMatter = yaml.load(fm[1], { schema: yaml.JSON_SCHEMA }) ?? {}; } catch { frontMatter = {}; }
    body = body.slice(fm[0].length);
  }
  const m = body.match(QUICK_START_META);
  if (m) {
    try { meta = literalValue(parseExpressionAt(m[1], 0, { ecmaVersion: 2022 })); } catch (e) {
      throw new TemplateError(`quick-start meta is not a plain literal: ${e.message}`);
    }
    body = body.replace(m[0], '');
  }
  return { frontMatter: typeof frontMatter === 'object' ? frontMatter : {}, meta, body };
}

/** Front matter and quick-start metadata of a page file. */
export function readPageData(file, source) {
  const { frontMatter, meta } = splitPageData(readInside(source, file));
  return { frontMatter, meta };
}

/** Parse a file after marker expansion, without its page data (front matter, quick-start meta). */
export function loadPage(file, source) {
  return parse(expandMarkers(splitPageData(readInside(source, file)).body, file, source));
}

/** Render nodes for one deployment option, the way MkDocs does today. env is mutated by {% set %}. */
export function renderSingle(nodes, env, file, source) {
  let out = '';
  for (const node of nodes) {
    if (node.t === 'text') out += node.v;
    else if (node.t === 'set') env[node.name] = setValue(node.expr, env, (n, e) => renderSingle(n, e, file, source));
    else if (node.t === 'var') out += String(evaluate(node.expr, env) ?? '');
    else if (node.t === 'include') {
      const target = findInclude(source, file, node.path);
      out += renderSingle(loadPage(target, source), env, target, source);
    } else if (node.t === 'if') {
      const b = takenBranch(node, env);
      if (b >= 0) out += renderSingle(node.branches[b].kids, env, file, source);
    }
  }
  return out;
}

export { findInclude };
