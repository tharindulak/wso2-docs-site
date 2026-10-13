import type { Env, Source, TemplateNode } from './types.js';
/** Resolve a path inside the source root; anything escaping the repository is refused. */
export declare function insideRoot(source: Source, candidate: string): string;
export declare function findInclude(source: Source, fromFile: string, target: string): string;
/** Expand markdown-include and snippets markers, and the {{#var#}} variable form, before templating. */
export declare function expandMarkers(text: string, fromFile: string, source: Source, depth?: number): string;
export interface PageData {
    frontMatter: Record<string, unknown>;
    meta?: unknown;
}
/**
 * Page data that lives outside the content: YAML front matter (for example `template:`) and the quick-start
 * `<script>const meta = {...}</script>` literal. Both are removed from the body and returned as data, so they
 * never render and never make two otherwise identical wrapper pages look different.
 */
export declare function splitPageData(text: string): PageData & {
    body: string;
};
/** Front matter and quick-start metadata of a page file. */
export declare function readPageData(file: string, source: Source): PageData;
/** Parse a file after marker expansion, without its page data (front matter, quick-start meta). */
export declare function loadPage(file: string, source: Source): TemplateNode[];
/** A page MkDocs does not template: include markers expand, everything else is text. */
export declare function loadPlain(file: string, source: Source): TemplateNode[];
/** Render nodes for one deployment option, the way MkDocs does today. env is mutated by {% set %}. */
export declare function renderSingle(nodes: TemplateNode[], env: Env, file: string, source: Source): string;
