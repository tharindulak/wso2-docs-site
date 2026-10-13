/**
 * What a block is written as: one line of JSX for MDX, or (CommonMark pages, `mdx.format: md`) one line of HTML,
 * which CommonMark keeps raw. `markdown` renders the inline Markdown of its text (a nested block).
 */
export interface Out {
    html: boolean;
    markdown: boolean;
}
/**
 * Inline Markdown in the text of a nested HTML block (links, images, code spans, emphasis, backslash escapes), as
 * Python-Markdown renders it. MDX: links and images stay Markdown (targets made MDX-safe), code spans and emphasis
 * become JSX elements, other text is a string literal. HTML: elements and escaped text.
 */
export declare function inlineMarkdown(s: string, out?: Out): string;
/**
 * Rewrite each multi-line HTML block (outside fenced code) as one line of JSX, keeping its indentation so it
 * stays inside a list item. A block indented NESTED or more has its inline Markdown rendered (see the header).
 * `protect` may swap the JSX for a placeholder. With `html` (the CommonMark fallback), only nested blocks are
 * rewritten, as one line of HTML; CommonMark keeps a top-level block raw, as Python-Markdown does.
 */
export declare function htmlBlocksToJsx(text: string, { protect, html }?: {
    protect?: (jsx: string) => string;
    html?: boolean;
}): {
    text: string;
    blocks: number;
};
