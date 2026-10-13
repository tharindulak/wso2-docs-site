import type { Env, TemplateNode, Branch } from './types.js';
export declare class TemplateError extends Error {
    readonly detail: unknown;
    constructor(message: string, detail?: unknown);
}
/** Parse template text into nodes: text, var, if, include, set. */
export declare function parse(source: string): TemplateNode[];
/** Compare like Jinja, except that two version-shaped strings compare numerically (7.10.0 > 7.2.0). */
export declare function compareValues(a: unknown, b: unknown): number;
/** Evaluate a condition or value expression against env. Unknown names are undefined, as in Jinja. */
export declare function evaluate(expr: string, env: Env): unknown;
/** Which branch of an if node is taken in env (-1 when none). */
export declare function takenBranch(node: {
    branches: Branch[];
}, env: Env): number;
/** Value of a {% set %}: a quoted string is itself a template; anything else is an expression. */
export declare function setValue(expr: string, env: Env, render: (nodes: TemplateNode[], env: Env) => string): unknown;
