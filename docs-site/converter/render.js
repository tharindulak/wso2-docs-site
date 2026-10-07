// Render MkDocs page sources for one deployment option: Jinja subset plus the include syntaxes found in
// WSO2 content sources ({% include %}, markdown-include {!file!}, pymdownx.snippets --8<--).
import fs from 'node:fs';
import path from 'node:path';
import { parse, evaluate, takenBranch, setValue, TemplateError } from './template.js';

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

/** Parse a file after marker expansion. */
export function loadPage(file, source) {
  return parse(expandMarkers(readInside(source, file), file, source));
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
