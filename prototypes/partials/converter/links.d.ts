export interface HostedSite {
    /** Current site URL prefix, for example https://apim.docs.wso2.com/en/4.7.0/ */
    prefix: string;
    /** Route of the section on the docs site, for example api-platform/api-manager */
    route: string;
    /** Whether the page at this path (no leading slash, "" for the home page) is a real page here. */
    hosts: (pagePath: string) => boolean;
    /** Whether a file (image, download) at this path (decoded, inside the section) is part of the section here. */
    hasFile?: (filePath: string) => boolean;
}
export interface RewriteOptions {
    /**
     * Origin of the former site the page was served from (https://apim.docs.wso2.com). Root-relative former-site paths
     * (/en/<version>/...) are links on that host: they resolve like the full URL, files included, and go to the former
     * site when this site does not host them.
     */
    origin?: string;
}
/** A file a rewritten link now points at: the caller serves it at /<site.route>/<path>. */
export interface RewrittenFile {
    site: HostedSite;
    path: string;
}
/** Rewrite link targets only: Markdown `](url)`, `href="url"` and `href={"url"}`; with an origin also `src`. */
export declare function rewriteSiteLinks(text: string, sites: HostedSite[], { origin }?: RewriteOptions): {
    text: string;
    rewritten: number;
    files: RewrittenFile[];
};
