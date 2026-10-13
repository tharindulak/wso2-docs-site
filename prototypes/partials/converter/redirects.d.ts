import type { MkdocsConfig } from './mkdocs-config.js';
/** The plugin's redirect_maps, old docs_dir page path -> target (a docs_dir page path or a URL), in file order. */
export declare function redirectMaps(config: MkdocsConfig): Array<[string, string]>;
export interface RedirectContext {
    /** Section route on the docs site, for example api-platform/api-manager/4.2.0 */
    route: string;
    /** The section's URL prefix on its former site, for example https://apim.docs.wso2.com/en/4.2.0/ */
    currentSite?: string;
    /** A docs_dir page path as a path inside this section (only, skip and docsRoot applied), or null when not its own. */
    toSection: (docsPath: string) => string | null;
    /** Site URL (relative to the section) of a page this section publishes, from its section path, or null. */
    hostedUrl: (sectionPath: string) => string | null;
}
/**
 * Where an old URL now goes: the page here when the section publishes it, else the target on its former site, else
 * any other https URL as written. Null for anything else (other schemes, paths leaving the section).
 */
export declare function redirectTarget(to: string, ctx: RedirectContext): string | null;
/** A redirect page as the MkDocs plugin writes one: meta refresh, canonical link, not indexed. */
export declare const redirectPageHtml: (target: string) => string;
/**
 * Write a redirect page at each old URL in `maps` that the section owns and that no published page uses, under
 * staticDir (served at /<route>/). Returns how many pages were written.
 */
export declare function writeRedirectPages(maps: Array<[string, string]>, staticDir: string, ctx: RedirectContext): number;
