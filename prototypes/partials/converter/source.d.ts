import { type SiteOutput, type SiteReport } from './site.js';
import type { SourceConfig } from './config.js';
import type { SidebarInput } from './types.js';
/** Version of the output layout (docs/, sidebar.json, manifest.json). The docs site rejects versions it does not know. */
export declare const CONTRACT_VERSION = 1;
export declare function convertSource(cfg: SourceConfig, root: string, out: Omit<SiteOutput, 'route'>): Promise<{
    sidebarId: string;
    sidebar: SidebarInput[];
    report: SiteReport;
}>;
