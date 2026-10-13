// `wso2-docs.yaml`: what a content repo tells the converter. Same field names as a docs site lock-file section,
// without the repo and commit (the CLI runs inside the repo).
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
export class ConfigError extends Error {
    constructor(message) { super(message); this.name = 'ConfigError'; }
}
const REL = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/@-]+$/;
const ROUTE = /^[a-z0-9][a-z0-9/-]*$/;
function relPath(value, field) {
    if (typeof value !== 'string' || !REL.test(value))
        throw new ConfigError(`${field} must be a relative path inside the repository, got ${JSON.stringify(value)}`);
    return value;
}
/** Load and validate a config file. Paths must stay inside the repository. */
export function loadConfig(file, root) {
    if (!fs.existsSync(file))
        throw new ConfigError(`Config file not found: ${file}`);
    const raw = yaml.load(fs.readFileSync(file, 'utf8'), { schema: yaml.JSON_SCHEMA });
    if (!raw || typeof raw !== 'object')
        throw new ConfigError(`${file} is empty or not a mapping`);
    const kind = raw.kind;
    if (kind !== 'mkdocs' && kind !== 'mkdocs-merge' && kind !== 'docusaurus')
        throw new ConfigError('kind must be mkdocs, mkdocs-merge or docusaurus');
    const route = raw.route ?? 'docs';
    if (!ROUTE.test(route))
        throw new ConfigError(`route must be lowercase letters, digits, - and /, got ${JSON.stringify(route)}`);
    if (!Array.isArray(raw.deployment_options) && kind !== 'mkdocs-merge')
        throw new ConfigError('deployment_options must list the deployment options of the pages');
    if (kind === 'mkdocs')
        relPath(raw.mkdocs, 'mkdocs');
    if (kind === 'mkdocs-merge') {
        relPath(raw.cloud?.mkdocs, 'cloud.mkdocs');
        relPath(raw.self_hosted?.mkdocs, 'self_hosted.mkdocs');
    }
    if (kind === 'docusaurus') {
        relPath(raw.docs, 'docs');
        relPath(raw.sidebar, 'sidebar');
    }
    for (const s of raw.skip ?? [])
        relPath(s, 'skip');
    if (raw.only)
        relPath(raw.only, 'only');
    let excludeList = [];
    if (Array.isArray(raw.exclude))
        excludeList = raw.exclude.map(String);
    else if (typeof raw.exclude === 'string') {
        const f = path.join(root, relPath(raw.exclude, 'exclude'));
        excludeList = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
    }
    return { ...raw, kind, route, deployment_options: raw.deployment_options ?? [], excludeList };
}
//# sourceMappingURL=config.js.map