import type { DeploymentOption, SidebarInput, SidebarItem } from './types.js';
export interface DeploymentDefaults {
    deployment_options: DeploymentOption[];
    deployment_overrides?: Record<string, DeploymentOption[]>;
}
/** Deployment options for a page: the longest matching path-prefix override, else the section default. */
export declare function optionsFor(src: DeploymentDefaults, rel: string): DeploymentOption[];
export declare function prefixIds(items: SidebarItem[], prefix: string): SidebarItem[];
/** Expand Docusaurus sidebar shorthand (bare doc ids, { Label: [...] } categories) into full items. */
export declare function normalizeSidebar(items: SidebarInput[] | Record<string, unknown>): SidebarItem[];
export interface CompanionPlacement {
    placement?: Record<string, string>;
    rename?: Record<string, string>;
}
/** Place a cloud companion's top-level sidebar entries into the main sidebar's sections. */
export declare function placeCompanion(mainItems: SidebarInput[], companionItems: SidebarItem[], companion: CompanionPlacement): SidebarItem[];
/**
 * Links for a page MkDocs builds from a theme template (no Markdown body): the section home lists the
 * sidebar's top-level areas; a category's own page lists that category's pages. Each link goes to the first
 * page `usable` accepts (for example, not a redirect).
 */
export declare function overviewLinks(sidebar: SidebarInput[], docId: string, usable?: (id: string) => boolean): Array<{
    label: string;
    id: string;
}>;
