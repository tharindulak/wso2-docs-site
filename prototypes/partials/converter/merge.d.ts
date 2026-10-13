import type { Env, Source } from './types.js';
export declare const CLOUD = "WSO2 Cloud";
export declare const SELF_HOSTED = "Self-hosted";
export interface MergeSide {
    env: Env;
    source: Source;
}
export interface MergeSides {
    cloud: MergeSide;
    self: MergeSide;
}
export interface MergeStats {
    sharedNames: number;
    placeholders: number;
    values: number;
    splitBlocks: number;
    splitsInCode: number;
    diverged: boolean;
}
/**
 * Merge a page that exists on both sides. If both wrapper pages reduce to the same includes, merge node by
 * node; otherwise keep both whole renderings, labelled.
 * @param sharedNames value to use when a variable differs but text is shared (product_name -> "WSO2 Identity Platform")
 */
export declare function mergePage(cloudFile: string, selfFile: string, sides: MergeSides, sharedNames?: Record<string, string>): {
    text: string;
    stats: MergeStats;
};
