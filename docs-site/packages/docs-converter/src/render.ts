// Render MkDocs page sources for one deployment option: Jinja subset plus the include syntaxes found in
// WSO2 content sources ({% include %}, markdown-include {!file!}, pymdownx.snippets --8<--).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { parse, evaluate, takenBranch, setValue, TemplateError } from './template.js';
import { parseLiteral } from './html-policy.js';
import type { Env, Source, TemplateNode } from './types.js';

/** Resolve a path inside the source root; anything escaping the repository is refused. */
export function insideRoot(source: Source, candidate: string): string {
  const resolved = path.resolve(candidate);
  const root = path.resolve(source.root) + path.sep;
  if (!resolved.startsWith(root)) throw new TemplateError(`Include escapes the content source: ${candidate}`);
  return resolved;
}

function readInside(source: Source, file: string): string {
  return fs.readFileSync(insideRoot(source, file), 'utf8');
}

export function findInclude(source: Source, fromFile: string, target: string): string {
  const bases = [path.dirname(fromFile), ...source.includeBases];
  for (const base of bases) {
    const candidate = path.resolve(base, target.trim());
    if (!candidate.startsWith(path.resolve(source.root) + path.sep)) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new TemplateError(`Include not found: ${target.trim()} (from ${path.relative(source.root, fromFile)})`);
}

/** Expand markdown-include and snippets markers, and the {{#var#}} variable form, before templating. */
export function expandMarkers(text: string, fromFile: string, source: Source, depth = 0): string {
  if (depth > 8) throw new TemplateError(`Include nesting too deep at ${path.relative(source.root, fromFile)}`);
  const inline = (target: string): string => {
    const file = findInclude(source, fromFile, target);
    return expandMarkers(readInside(source, file), file, source, depth + 1);
  };
  return text
    .replace(/\{!\s*([^!\n]+?)\s*!\}/g, (_, target: string) => inline(target))
    .replace(/^[ \t]*--8<--[ \t]+["']([^"'\n]+)["'][ \t]*$/gm, (_, target: string) => inline(target))
    .replace(/\{\{#([A-Za-z_]\w*)#\}\}/g, '{{ $1 }}');
}

/**
 * Parse a front-matter block. A YAML error, or YAML that is not a mapping, gives no fields (as before) and the error,
 * for the caller to report.
 */
export function loadFrontMatter(block: string): { data: Record<string, unknown>; error?: string } {
  let data: unknown;
  try { data = yaml.load(block, { schema: yaml.JSON_SCHEMA }) ?? {}; } catch (e) {
    return { data: {}, error: `front matter is not valid YAML: ${String((e as Error).message).split('\n')[0]!.slice(0, 160)}` };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { data: {}, error: 'front matter is not a YAML mapping' };
  return { data: data as Record<string, unknown> };
}

const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;
const QUICK_START_META = /<script>\s*(?:const|let|var)\s+meta\s*=\s*([\s\S]*?);?\s*<\/script>\s*/;

export interface PageData { frontMatter: Record<string, unknown>; meta?: unknown; /** Why the front matter gave no fields (invalid YAML). */ error?: string }

/**
 * Page data that lives outside the content: YAML front matter (for example `template:`) and the quick-start
 * `<script>const meta = {...}</script>` literal. Both are removed from the body and returned as data, so they
 * never render and never make two otherwise identical wrapper pages look different.
 */
export function splitPageData(text: string): PageData & { body: string } {
  let body = text;
  let frontMatter: Record<string, unknown> = {};
  let error: string | undefined;
  let meta: unknown;
  const fm = body.match(FRONT_MATTER);
  if (fm) {
    ({ data: frontMatter, error } = loadFrontMatter(fm[1]!));
    body = body.slice(fm[0].length);
  }
  const m = body.match(QUICK_START_META);
  if (m) {
    try { meta = parseLiteral(m[1]!); } catch (e) {
      throw new TemplateError(`quick-start meta is not a plain literal: ${(e as Error).message}`);
    }
    body = body.replace(m[0], '');
  }
  return { frontMatter, meta, body, ...(error ? { error } : {}) };
}

/** Front matter and quick-start metadata of a page file. */
export function readPageData(file: string, source: Source): PageData {
  const { frontMatter, meta, error } = splitPageData(readInside(source, file));
  return { frontMatter, meta, ...(error ? { error } : {}) };
}

/** Parse a file after marker expansion, without its page data (front matter, quick-start meta). */
export function loadPage(file: string, source: Source): TemplateNode[] {
  return parse(expandMarkers(splitPageData(readInside(source, file)).body, file, source));
}

/** A page MkDocs does not template: include markers expand, everything else is text. */
export function loadPlain(file: string, source: Source): TemplateNode[] {
  return [{ t: 'text', v: expandMarkers(splitPageData(readInside(source, file)).body, file, source) }];
}

const inFence = (s: string): boolean => (s.match(/^[ \t]*(```|~~~)/gm) ?? []).length % 2 === 1;

/** An include whose text would fill its own lines (only indentation before it, a line break after), outside code. */
export function standsAlone(before: string, next: TemplateNode | undefined): boolean {
  return /(?:^|\n)[ \t]*$/.test(before) && (!next || (next.t === 'text' && /^[ \t]*(?:\r?\n|$)/.test(next.v))) && !inFence(before);
}

/** The same source with includes always inlined (content rendered for one option inside a merged page). */
export const inlining = (source: Source): Source => (source.partials ? { root: source.root, includeBases: source.includeBases } : source);

/** Render nodes for one deployment option, the way MkDocs does today. env is mutated by {% set %}. */
export function renderSingle(nodes: TemplateNode[], env: Env, file: string, source: Source): string {
  let out = '';
  for (const [index, node] of nodes.entries()) {
    if (node.t === 'text') out += node.v;
    else if (node.t === 'set') env[node.name] = setValue(node.expr, env, (n, e) => renderSingle(n, e, file, source));
    else if (node.t === 'var') out += String(evaluate(node.expr, env) ?? '');
    else if (node.t === 'include') {
      const target = findInclude(source, file, node.path);
      const render = (): string => renderSingle(loadPage(target, source), env, target, source);
      out += source.partials && standsAlone(out, nodes[index + 1]) ? source.partials(target, render) : render();
    } else if (node.t === 'if') {
      const b = takenBranch(node, env);
      if (b >= 0) out += renderSingle(node.branches[b]!.kids, env, file, source);
    }
  }
  return out;
}
