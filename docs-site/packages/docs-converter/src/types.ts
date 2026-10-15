// Shared types for the converter.

/** A deployment option label shown on pages: WSO2 Cloud, Hybrid or Self-hosted. */
export type DeploymentOption = string;

/** Template variables (MkDocs `extra`, `{% set %}` values). */
export type Env = Record<string, unknown>;

/** Where page files may be read from and how includes resolve. Includes never escape `root`. */
export interface Source {
  root: string;
  includeBases: string[];
  /** Decides what an include standing as a block of its own becomes (see partials.ts); absent, includes are inlined. */
  partials?: PartialHook;
  /** The same for a markdown-include `{!file!}` marker on a line of its own (one MkDocs site, convertMkdocsSite). */
  markerPartials?: PartialHook;
}

/**
 * Called for an include that fills its own lines, outside code and links. `render` gives the text inlining
 * would write; the hook returns that text or a stand-in for it.
 */
export type PartialHook = (target: string, render: () => string) => string;

export interface Branch {
  cond: string;
  kids: TemplateNode[];
}

export type TemplateNode =
  | { t: 'text'; v: string }
  | { t: 'var'; expr: string }
  | { t: 'if'; branches: Branch[] }
  | { t: 'include'; path: string }
  | { t: 'set'; name: string; expr: string };

/** A Docusaurus sidebar item (full form). Shorthand forms are expanded by `normalizeSidebar`. */
export interface SidebarItem {
  type: string;
  id?: string;
  label?: string;
  href?: string;
  link?: { type: string; id?: string; [key: string]: unknown };
  items?: SidebarItem[];
  [key: string]: unknown;
}

/** Docusaurus accepts shorthand: bare doc ids and `{ Label: [...] }` categories. */
export type SidebarInput = SidebarItem | string | Record<string, unknown>;

/** MkDocs `nav:` as parsed from YAML. */
export type MkdocsNav = Array<string | Record<string, unknown>>;
