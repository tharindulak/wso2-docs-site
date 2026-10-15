// Shared includes as MDX partials, for a content source migrating to Docusaurus. An include that more than one page
// uses, and that renders the same on every one of them, becomes `_partials/<name>.mdx`; each page imports it where
// the include stood. Every other include is inlined, as the build-time conversion does.
import path from 'node:path';
import type { PartialHook } from './types.js';

/** How a page renders: both deployment options merged, or one option alone. */
export type RenderMode = 'merged' | 'cloud' | 'self';

export interface Partial {
  /** Include file (absolute). */
  target: string;
  /** Path under `_partials/`, ending in .mdx. */
  name: string;
  /** How the partial is rendered: merged when merged pages or pages of both options use it. */
  mode: RenderMode;
  /** Stands in for the include in a rendered page until the page is converted. */
  token: string;
}

interface Use { page: string; mode: RenderMode; text: string }

/** `<dir>/includes/a/b.md` -> `a/b.mdx` (path below the nearest `includes` folder; else below the root). */
export function partialName(target: string, root: string): string {
  const rel = path.relative(root, target).split(path.sep);
  const at = rel.lastIndexOf('includes', rel.length - 2);
  return rel.slice(at + 1).join('/').replace(/\.md$/, '.mdx');
}

/** `db/shared-step.mdx` -> `SharedStep`. */
export function componentName(name: string): string {
  const words = path.posix.basename(name, '.mdx').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pascal = words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join('');
  return /^[A-Z]/.test(pascal) ? pascal : `Partial${pascal}`;
}

/**
 * Pass 1 records every stand-alone include as inlining writes it (page, render mode, text); `choose` then picks the
 * partials; pass 2 writes a token instead of each chosen include and remembers which partials each page used.
 */
export class PartialPlan {
  page = '';
  mode: RenderMode = 'merged';
  private readonly uses = new Map<string, Use[]>();
  private chosen = new Map<string, Partial>();
  private used = new Map<string, Partial>();

  readonly collect: PartialHook = (target, render) => {
    const text = render();
    if (!this.uses.has(target)) this.uses.set(target, []);
    this.uses.get(target)!.push({ page: this.page, mode: this.mode, text });
    return text;
  };

  readonly emit: PartialHook = (target, render) => {
    const partial = this.chosen.get(target);
    if (!partial) return render();
    this.used.set(target, partial);
    return partial.token;
  };

  /**
   * Keep includes used by at least `minPages` pages (default: more than one) whose every use matches the include rendered on its own
   * (`standalone`, without the page's own `{% set %}` values) in that use's mode.
   */
  choose(root: string, standalone: (target: string, mode: RenderMode) => string, minPages = 2): Partial[] {
    const kept: Omit<Partial, 'token'>[] = [];
    for (const [target, uses] of [...this.uses].sort(([a], [b]) => a.localeCompare(b))) {
      if (new Set(uses.map((u) => u.page)).size < minPages) continue;
      const modes = new Set(uses.map((u) => u.mode));
      const mode: RenderMode = modes.has('merged') || modes.size > 1 ? 'merged' : [...modes][0]!;
      const expected = new Map<RenderMode, string>();
      const alone = (m: RenderMode): string => { if (!expected.has(m)) expected.set(m, standalone(target, m)); return expected.get(m)!; };
      try {
        if (!uses.every((u) => u.text === alone(u.mode))) continue;
      } catch { continue; }
      kept.push({ target, name: partialName(target, root), mode });
    }
    // Two include folders holding the same file name: those partials keep their full path instead.
    const count = new Map<string, number>();
    for (const p of kept) count.set(p.name, (count.get(p.name) ?? 0) + 1);
    const partials = kept.map((p, i) => ({
      ...p,
      name: count.get(p.name)! > 1 ? path.relative(root, p.target).split(path.sep).join('/').replace(/\.md$/, '.mdx') : p.name,
      token: `WSO2PARTIAL${i}X`,
    }));
    this.chosen = new Map(partials.map((p) => [p.target, p]));
    return partials;
  }

  /** Inline this include after all (its partial could not be written). */
  drop(target: string): void { this.chosen.delete(target); }

  /** Start a page (or partial) in pass 2. */
  begin(page: string, mode: RenderMode): void { this.page = page; this.mode = mode; this.used = new Map(); }

  /** Partials the current page used, in first-use order. */
  get pagePartials(): Partial[] { return [...this.used.values()]; }
}

/**
 * Put the partials into a converted page: each token becomes `<Component />` and the page imports the partial
 * (path relative to `fileRel`, the page's path in the output). Throws when a token did not survive conversion.
 */
export function insertPartials(mdx: string, fileRel: string, partials: Partial[]): string {
  if (!partials.length) return mdx;
  const names = new Set<string>();
  const imports: string[] = [];
  let text = mdx;
  for (const p of partials) {
    let component = componentName(p.name);
    for (let n = 2; names.has(component); n++) component = `${componentName(p.name)}${n}`;
    names.add(component);
    // Alone on its line, or starting a list item (an include written as `1.  {!file!}`).
    const line = new RegExp(`^([ \\t]*(?:(?:[-*+]|\\d+[.)])[ \\t]+)?)${p.token}[ \\t]*$`, 'gm');
    if (!line.test(text)) throw new Error(`Partial ${p.name} lost its place in ${fileRel}`);
    text = text.replace(line, `$1<${component} />`);
    let from = path.posix.relative(path.posix.dirname(fileRel), `_partials/${p.name}`);
    if (!from.startsWith('.')) from = `./${from}`;
    imports.push(`import ${component} from '${from}';`);
  }
  // After the front matter and any imports already at the top of the page.
  const head = text.match(/^(?:---\n[\s\S]*?\n---\n)?(?:\s*import [^\n]*;\n)*/)![0];
  const rest = text.slice(head.length).replace(/^\n+/, '');
  const top = head ? `${head.replace(/\n*$/, '\n')}\n` : '';
  return `${top}${imports.join('\n')}\n\n${rest}`;
}
