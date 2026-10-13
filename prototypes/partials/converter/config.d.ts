import type { DeploymentOption } from './types.js';
export interface SourceConfig {
    kind: 'mkdocs' | 'mkdocs-merge' | 'docusaurus';
    /** Route of the section on the docs site (for absolute links); default "docs". */
    route: string;
    deployment_options: DeploymentOption[];
    deployment_overrides?: Record<string, DeploymentOption[]>;
    /** mkdocs */
    mkdocs?: string;
    only?: string;
    skip?: string[];
    nav_root?: string;
    nav_drop?: string[];
    nav_pick?: Record<string, string | number>;
    current_site?: string;
    /** mkdocs-merge */
    cloud?: {
        mkdocs: string;
        current_site?: string;
    };
    self_hosted?: {
        mkdocs: string;
        current_site?: string;
    };
    shared_names?: Record<string, string>;
    /** docusaurus */
    docs?: string;
    sidebar?: string;
    shims?: Record<string, string>;
    /** Known failing pages: a list, or a file with one docs-relative path per line. */
    exclude?: string[] | string;
    /** Prefix for "Edit this page" links, for example https://github.com/wso2/docs-is/blob/master/ */
    edit_url?: string;
    iframe_hosts?: string[];
}
export declare class ConfigError extends Error {
    constructor(message: string);
}
/** Load and validate a config file. Paths must stay inside the repository. */
export declare function loadConfig(file: string, root: string): SourceConfig & {
    excludeList: string[];
};
