// Read an MkDocs configuration the way MkDocs does for what the converter needs: docs_dir, nav, extra,
// markdown extension base paths. Follows INHERIT. Python- and env-specific YAML tags are neutralised.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { MkdocsNav } from './types.js';

export interface MkdocsConfig {
  INHERIT?: string;
  docs_dir?: string;
  nav?: MkdocsNav;
  extra?: Record<string, unknown>;
  markdown_extensions?: unknown[];
  [key: string]: unknown;
}

export interface MkdocsSite {
  config: MkdocsConfig;
  docsDir: string;
  extra: Record<string, unknown>;
  nav: MkdocsNav | undefined;
  includeBases: string[];
}

function sanitize(raw: string): string {
  return raw
    .replace(/!!python\/[^\s]+/g, 'null')
    .replace(/!ENV\s*\[\s*[A-Za-z_]+\s*,\s*('[^']*'|"[^"]*"|[^\]\n]*)\]/g, '$1')
    .replace(/!ENV\s*\[\s*([A-Za-z_]+)\s*\]/g, 'null')
    .replace(/!ENV\s+[A-Za-z_]+/g, 'null')
    .replace(/!relative\s*/g, '');
}

/** Load and merge an mkdocs.yml (and its INHERIT chain). Duplicate keys: last wins, as PyYAML does. */
export function readMkdocsYml(file: string, seen = new Set<string>()): MkdocsConfig {
  const resolved = path.resolve(file);
  if (seen.has(resolved)) throw new Error(`INHERIT cycle at ${file}`);
  seen.add(resolved);
  const doc = (yaml.load(sanitize(fs.readFileSync(resolved, 'utf8')), { json: true, schema: yaml.JSON_SCHEMA }) ?? {}) as MkdocsConfig;
  if (!doc.INHERIT) return doc;
  const base = readMkdocsYml(path.resolve(path.dirname(resolved), doc.INHERIT), seen);
  return { ...base, ...doc, extra: { ...(base.extra ?? {}), ...(doc.extra ?? {}) } };
}

function extensionOptions(config: MkdocsConfig, name: string): Record<string, unknown> | undefined {
  for (const e of config.markdown_extensions ?? []) {
    if (e && typeof e === 'object' && (e as Record<string, unknown>)[name]) return (e as Record<string, Record<string, unknown>>)[name];
  }
  return undefined;
}

/** Everything the converter needs from one MkDocs site. */
export function mkdocsSite(ymlFile: string): MkdocsSite {
  const config = readMkdocsYml(ymlFile);
  const dir = path.dirname(path.resolve(ymlFile));
  const docsDir = path.resolve(dir, config.docs_dir ?? 'docs');
  const bases = [extensionOptions(config, 'markdown_include.include')?.base_path, extensionOptions(config, 'pymdownx.snippets')?.base_path]
    .flat().filter((b): b is string => typeof b === 'string' && Boolean(b)).map((b) => path.resolve(dir, b));
  return { config, docsDir, extra: config.extra ?? {}, nav: config.nav, includeBases: [...bases, docsDir, dir] };
}
