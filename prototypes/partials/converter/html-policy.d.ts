export declare const DEFAULT_IFRAME_HOSTS: readonly string[];
interface EsNode {
    type: string;
    [key: string]: unknown;
}
/** Evaluate an object/array literal without running code: only literals, objects, arrays and plain strings. */
export declare function literalValue(node: EsNode): unknown;
/** Parse a JavaScript literal expression (object, array, string, number) without executing it. */
export declare function parseLiteral(expr: string): unknown;
export interface PolicyResult {
    text: string;
    violations: string[];
    meta: unknown;
}
/** Check and clean converted HTML. */
export declare function applyHtmlPolicy(text: string, { iframeHosts }?: {
    iframeHosts?: readonly string[];
}): PolicyResult;
/** Include markers that survived expansion would silently drop content; treat them as errors. */
export declare function unexpandedMarkers(text: string): string[];
/**
 * Remove <script>, <style> and <link> elements (with their content) and event-handler attributes outside
 * code samples, for pages the policy would otherwise reject. Removing never adds behaviour; anything left is
 * still checked by the policy.
 */
export declare function removeForbiddenElements(text: string): {
    text: string;
    removed: string[];
};
/** Where the element of `tag` opened just before `at` closes, counting nested elements of the same name. */
export declare function closingTag(text: string, tag: string, at: number): {
    start: number;
    end: number;
} | undefined;
export {};
