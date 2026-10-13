/** Tags MDX may keep as JSX. Anything else that looks like a tag is escaped as text. */
export declare const JSX_TAGS: readonly string[];
/**
 * HTML sectioning tags, kept as JSX only where they lay out a block: at the start of a line, or closing one opened at
 * the start of the same line. Inline, the same names are XML in prose (Synapse's `<header name="…"/>`) and stay text.
 */
export declare const BLOCK_JSX_TAGS: readonly string[];
export interface SyntaxStats {
    admonitions: number;
    collapsibles: number;
    tabs: number;
    attrLists: number;
}
/** Apply fn to the parts of text outside fenced and inline code. */
export declare function outsideCode(text: string, fn: (prose: string) => string): string;
/**
 * An MkDocs Redoc embed (`<redoc spec-url="...">`, rendered by the source site's theme script) becomes the
 * docs site's <ApiReference> component. Specs on the site load in the viewer; a spec on another host is only
 * linked, never fetched into the reader's browser (it would be unpinned third-party content).
 */
export declare function redocToApiReference(text: string): {
    text: string;
    count: number;
};
/**
 * Index of the `)` closing a link target that starts at `from` (just after `](`), or -1. Parentheses nest; a quoted
 * title may hold any of them; a blank line ends the paragraph, and so the search.
 */
export declare function targetEnd(s: string, from: number, titles?: boolean): number;
/** A link target as Python-Markdown reads it: the destination (angle brackets removed) and the quoted title, if any. */
export declare function splitTarget(inner: string): {
    dest: string;
    title?: string;
};
/**
 * Whether a URL, as a browser would read it, has a script scheme (javascript:, vbscript:, data:text/html). Character
 * references are decoded, and whitespace and control characters dropped first, so `java\nscript:`, `java\tscript:`
 * and `&#106;avascript:` are caught (a browser strips tabs and newlines from a URL; HTML decodes the references).
 */
export declare function unsafeUrl(url: string): boolean;
/**
 * A destination with its line breaks joined (with the indentation around them) and its tabs dropped, as a browser
 * drops them from a URL, and its remaining whitespace percent-encoded.
 */
export declare const joinTarget: (dest: string) => string;
/**
 * Python-Markdown reads a link or image target up to its closing parenthesis, line breaks and spaces included
 * (`[x](https://github\n.com/a)`, `![a](img/load balancing/x.png)`, `mailto:WSO2 Developer Platform-support@wso2.com`);
 * CommonMark does not, and the link prints as text. Such targets are joined and encoded (joinTarget); a quoted title
 * stays a title. Runs before the site link rewrites, which then see the whole URL.
 */
export declare function linkTargets(text: string): string;
/** Convert MkDocs Markdown to MDX. Returns the body and whether it needs the Tabs imports. */
export declare function toMdx(md: string): {
    body: string;
    usesTabs: boolean;
    stats: SyntaxStats;
};
