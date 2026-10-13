// Convert one source described by a SourceConfig (wso2-docs.yaml, or a docs-site lock-file section).
import { convertMkdocsSite, convertMergedSites, prepareDocusaurusDocs, emptyReport } from './site.js';
import path from 'node:path';
/** Version of the output layout (docs/, sidebar.json, manifest.json). The docs site rejects versions it does not know. */
export const CONTRACT_VERSION = 1;
export async function convertSource(cfg, root, out) {
    const report = out.report ?? emptyReport();
    const target = { ...out, route: cfg.route, report };
    const edit = cfg.edit_url ? (file) => cfg.edit_url + path.relative(root, file).replace(/\\/g, '/') : undefined;
    if (cfg.kind === 'mkdocs') {
        const { sidebar } = await convertMkdocsSite({
            root, mkdocs: cfg.mkdocs, currentSite: cfg.current_site, editUrl: edit,
            deployment_options: cfg.deployment_options, deployment_overrides: cfg.deployment_overrides,
            only: cfg.only, skip: cfg.skip, nav: { root: cfg.nav_root, drop: cfg.nav_drop, pick: cfg.nav_pick }, iframeHosts: cfg.iframe_hosts,
        }, target);
        return { sidebarId: 'docs', sidebar, report };
    }
    if (cfg.kind === 'mkdocs-merge') {
        const { sidebar } = await convertMergedSites({
            cloud: { root, mkdocs: cfg.cloud.mkdocs, currentSite: cfg.cloud.current_site, editUrl: edit },
            self: { root, mkdocs: cfg.self_hosted.mkdocs, currentSite: cfg.self_hosted.current_site, editUrl: edit },
            sharedNames: cfg.shared_names, iframeHosts: cfg.iframe_hosts,
        }, target);
        return { sidebarId: 'docs', sidebar, report };
    }
    const { sidebarId, sidebar } = await prepareDocusaurusDocs({
        root, docs: cfg.docs, sidebar: cfg.sidebar, currentSite: cfg.current_site, editUrl: edit, shims: cfg.shims,
        deployment_options: cfg.deployment_options, deployment_overrides: cfg.deployment_overrides,
    }, target);
    return { sidebarId, sidebar, report };
}
//# sourceMappingURL=source.js.map