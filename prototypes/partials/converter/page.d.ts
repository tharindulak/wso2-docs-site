import { type SyntaxStats } from './syntax.js';
import type { DeploymentOption } from './types.js';
import type { PageData } from './render.js';
/** Split leading YAML front matter from Markdown. */
export declare function splitFrontMatter(text: string): {
    data: Record<string, unknown>;
    body: string;
};
export type PageErrorKind = 'template' | 'policy' | 'include' | 'compile';
export declare class PageError extends Error {
    readonly kind: PageErrorKind;
    constructor(kind: PageErrorKind, message: string);
}
export interface ConvertOptions {
    deploymentOptions: DeploymentOption[];
    editUrl?: string;
    iframeHosts?: readonly string[];
    /** Front matter and quick-start meta read from the page file itself (see render.splitPageData). */
    pageData?: Partial<PageData>;
    /** Title and summary of an OpenAPI spec referenced by <ApiReference spec>, for pages that have no heading. */
    specInfo?: (spec: string) => {
        title?: string;
        description?: string;
    } | undefined;
    /**
     * Title for a page with no front-matter title, no heading and no spec title (as MkDocs: the nav label, else from
     * the file name). Without it Docusaurus shows the file id.
     */
    fallbackTitle?: string;
}
export type PageStats = SyntaxStats & {
    removed?: string[];
    htmlBlocks?: number;
    format?: 'md';
};
/** Convert rendered Markdown into Docusaurus MDX with front matter. Throws PageError when the page cannot be kept. */
export declare function convertRendered(rendered: string, opts: ConvertOptions): Promise<{
    mdx: string;
    stats: PageStats;
}>;
/** CommonMark has no ESM: import lines would print as text. */
export declare const withoutImports: (text: string) => string;
/** Compile as Docusaurus would (MDX 3 or CommonMark, GFM, directives). Throws PageError('compile') on failure. */
export declare function compileCheck(mdx: string, { format }?: {
    format?: 'mdx' | 'md';
}): Promise<void>;
