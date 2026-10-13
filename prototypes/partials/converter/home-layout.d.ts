/**
 * Apply fn to the prose of a Markdown text: outside fenced code, indented code and inline code. An indented code
 * block is a run of lines indented 4 or more after a blank line, outside a raw HTML block that starts at column 0
 * (as Python-Markdown reads it: inside such a block nothing is code, which keeps indented home layouts as prose).
 * Anything doubtful counts as code, so it is left unchanged.
 */
export declare function outsideAllCode(text: string, fn: (prose: string) => string): string;
/** A page body with its own `<h1>` element outside code (MkDocs Material then shows no title of its own). */
export declare function hasHtmlH1(text: string): boolean;
/** A page body built on a custom MkDocs home layout (WSO2 themes: `<div class="homePage">`), outside code. */
export declare function isHomeLayout(text: string): boolean;
/**
 * Give every link visible text. An anchor whose only content is icon elements loses the icons (they cannot render
 * here) and takes, in order, its `title` or `aria-label`, the nearest preceding heading in the same wrapper, or the
 * link's host. An empty anchor (only whitespace, `&nbsp;`, comments or `<br>`) takes its `title` or `aria-label`;
 * without one it is dropped, keeping an `id` or `name` as a plain target. Any other child (an element, a component)
 * keeps the anchor as written. Same-page anchors (`href="#..."`), anchors without an href, and code are left alone.
 */
export declare function nameIconLinks(text: string): string;
/**
 * Image lightboxes the former theme drove with a script (docs-updates): a trigger `<a class="open-modal" data-open>`
 * around an image, and a `<div class="modal">` dialog with a close control that its CSS hid until opened. Without
 * that script and CSS the dialog would show inline, close button and all; it repeats the image, so it is dropped and
 * the trigger keeps only its image. Code is left alone.
 */
export declare function dropScriptedModals(text: string): string;
