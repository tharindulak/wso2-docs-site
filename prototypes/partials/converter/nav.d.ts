import type { MkdocsNav, SidebarItem } from './types.js';
/**
 * Convert an MkDocs nav to sidebar items. Entries whose page is not `known` are dropped and reported.
 * @param known whether a doc id exists in the generated docs
 */
export declare function navToSidebar(nav: MkdocsNav | undefined, known: (id: string) => boolean, dropped?: string[]): SidebarItem[];
/**
 * Merge `extra` into `base`: matching docs and same-label categories merge; items only in `extra`
 * are inserted after the nearest preceding item they share with `base`.
 */
export declare function mergeSidebars(base: SidebarItem[], extra: SidebarItem[]): SidebarItem[];
/** Ids referenced anywhere in a sidebar. */
export declare function sidebarDocIds(items: SidebarItem[], acc?: Set<string>): Set<string>;
export interface NavSelection {
    root?: string;
    drop?: string[];
    pick?: Record<string, string | number>;
    release?: string;
    strip?: string;
    outside?: (docsPath: string) => string | null;
}
/**
 * Narrow a MkDocs `nav:` for one section: `root` takes a top-level entry's children, `release` then takes the
 * children of one release under it (a component's version folder), `drop` removes top-level entries, `pick`
 * replaces a versioned entry's children with those of one release, and `strip` removes a folder prefix from page
 * paths (the folder is the section root); `outside` gives other pages' site paths (labelled entries become links).
 */
export declare function selectNav(nav: MkdocsNav | undefined, { root, drop, pick, release, strip, outside }?: NavSelection): MkdocsNav;
