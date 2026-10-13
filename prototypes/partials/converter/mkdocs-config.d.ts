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
    /** Whether MkDocs renders Jinja in pages (markdownextradata or macros plugin). */
    templating: boolean;
}
/** Load and merge an mkdocs.yml (and its INHERIT chain). Duplicate keys: last wins, as PyYAML does. */
export declare function readMkdocsYml(file: string, seen?: Set<string>): MkdocsConfig;
/** MkDocs renders {{ }} and {% %} in pages only through a templating plugin; without one they are text. */
export declare function usesTemplating(config: MkdocsConfig): boolean;
/** Everything the converter needs from one MkDocs site. */
export declare function mkdocsSite(ymlFile: string): MkdocsSite;
