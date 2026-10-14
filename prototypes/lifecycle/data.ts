// PROTOTYPE, throwaway. Lifecycle stage data for the badge and deprecation prototypes, read from the fork's MkDocs
// source (the docs site does not carry these fields yet: the converter drops them until the build tickets).
// Pages: front matter `status`, `deprecated_since`, `replacement` in en/asgardeo (WSO2 Cloud) and
// en/identity-server/<version> (Self-hosted). Titles: each version's mkdocs.yml nav label, "(deprecated)" removed.
// Sections: the `!!! deprecated "Title"` admonitions, listed with the Latest page that shows them.
// Beta and Preview have no marked pages yet, so the badge prototype adds clearly flagged samples.
import fs from 'node:fs';
import path from 'node:path';

export type Stage = 'beta' | 'preview' | 'deprecated';
export type Option = 'WSO2 Cloud' | 'Self-hosted';
export interface Marking { stage: Stage; since?: string; replacement?: { url: string; title: string } }
export interface Entry {
  kind: 'page' | 'section';
  url: string;
  built: boolean;
  version: string;
  title: string;
  options: Partial<Record<Option, Marking>>;
  sample?: boolean;
  section?: string;
}

const SOURCES: { dir: string; option: Option; version: string }[] = [
  { dir: 'asgardeo', option: 'WSO2 Cloud', version: 'Latest' },
  { dir: 'identity-server/7.3.0', option: 'Self-hosted', version: 'Latest' },
  { dir: 'identity-server/7.2.0', option: 'Self-hosted', version: '7.2.0' },
  { dir: 'identity-server/7.1.0', option: 'Self-hosted', version: '7.1.0' },
  { dir: 'identity-server/7.0.0', option: 'Self-hosted', version: '7.0.0' },
];

const urlFor = (version: string, rel: string): string =>
  `/identity/${version === 'Latest' ? '' : `${version}/`}${rel.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '/')}`;

/**
 * Nav labels by docs-relative path, from a version's mkdocs.yml ("- Label: path.md" lines). A short label that only
 * names a version ("V1") is prefixed with its parent group ("User sharing management APIs V1").
 */
function navLabels(mkdocs: string): Map<string, string> {
  const out = new Map<string, string>();
  const groups: { indent: number; label: string }[] = [];
  const clean = (l: string): string => l.replace(/\s*\((deprecated|Deprecated)\)\s*/, '').replace(/^['"]|['"]$/g, '').trim();
  for (const line of fs.readFileSync(mkdocs, 'utf8').split('\n')) {
    const m = line.match(/^(\s*)-\s+(.+?):\s*(\S+\.md)?\s*$/);
    if (!m) continue;
    const indent = m[1].length;
    while (groups.length && groups[groups.length - 1].indent >= indent) groups.pop();
    const label = clean(m[2]);
    if (!m[3]) { groups.push({ indent, label }); continue; }
    const parent = groups[groups.length - 1]?.label;
    out.set(m[3], /^v\d+(\.\d+)?$/i.test(label) && parent ? `${parent} ${label}` : label);
  }
  return out;
}

function frontMatter(file: string): Record<string, string> {
  const m = fs.readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  for (const line of (m?.[1] ?? '').split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*"?([^"]*)"?\s*$/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

function walk(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) out.push(...walk(dir, r));
    else if (e.name.endsWith('.md')) out.push(r);
  }
  return out;
}

/** The replacement's nav label; when it reads the same as the deprecated page's, the version in its file name is added. */
function replacementTitle(labels: Map<string, string>, rel: string, repRel: string): string {
  const title = labels.get(repRel) ?? path.posix.basename(repRel, '.md');
  const version = repRel.match(/-(v\d+)-/)?.[1];
  return title === labels.get(rel) && version ? `${title} ${version}` : title;
}

export function lifecycleData(enDir: string, builtRoot: string): Entry[] {
  const byUrl = new Map<string, Entry>();
  for (const s of SOURCES) {
    const docs = path.join(enDir, s.dir, 'docs');
    const labels = navLabels(path.join(enDir, s.dir, 'mkdocs.yml'));
    for (const rel of walk(docs)) {
      const fm = frontMatter(path.join(docs, rel));
      if (!['beta', 'preview', 'deprecated'].includes(fm.status)) continue;
      const url = urlFor(s.version, rel);
      const repRel = fm.replacement ? path.posix.join(path.posix.dirname(rel), fm.replacement) : undefined;
      const entry = byUrl.get(url) ?? {
        kind: 'page', url, version: s.version, options: {},
        built: fs.existsSync(path.join(builtRoot, url, 'index.html')),
        title: labels.get(rel) ?? path.posix.basename(rel, '.md'),
      } as Entry;
      entry.options[s.option] = {
        stage: fm.status as Stage, since: fm.deprecated_since,
        replacement: repRel ? { url: urlFor(s.version, repRel), title: replacementTitle(labels, rel, repRel) } : undefined,
      };
      byUrl.set(url, entry);
    }
  }
  // Scope from the generated pages: an <Applies> block around the section, else the page's deployment options.
  const sections: Entry[] = [
    { url: '/identity/guides/branding/configure-ui-branding/', section: 'Deprecated feature', title: 'Branding: Organization Display Name', scope: ['Self-hosted'] },
    { url: '/identity/guides/authentication/user-attributes/enable-attributes-for-oidc-app/', section: 'Deprecated `sub` attribute behavior in application access tokens', title: '`sub` attribute in application access tokens', scope: ['WSO2 Cloud', 'Self-hosted'] },
    { url: '/identity/guides/authentication/oidc/token-validation-resource-server/', section: 'Deprecated behavior', title: '`username` in introspection responses for application access tokens', scope: ['Self-hosted'] },
  ].map((s) => ({ ...s, kind: 'section', version: 'Latest', built: true,
    options: Object.fromEntries(s.scope.map((o) => [o, { stage: 'deprecated' }])) }) as unknown as Entry);
  return [...byUrl.values(), ...sections];
}

/** Sample markings for stages no page carries yet; shown with a "sample" flag in the prototype bar. */
export const SAMPLES: Entry[] = [
  { kind: 'page', url: '/identity/guides/account-configurations/user-onboarding/self-registration-flow/', built: true, version: 'Latest', sample: true,
    title: 'Self-registration flow (Feature Preview toggle in the Console)', options: { 'WSO2 Cloud': { stage: 'preview' } } },
  { kind: 'page', url: '/identity/guides/authentication/login-flow-ai/', built: true, version: 'Latest', sample: true,
    title: 'Login Flow AI (the source carries a "Beta feature" note for some products)', options: { 'WSO2 Cloud': { stage: 'beta' }, 'Self-hosted': { stage: 'beta' } } },
  { kind: 'page', url: '/identity/guides/branding/branding-ai/', built: true, version: 'Latest', sample: true,
    title: 'Branding AI (sample: Beta on WSO2 Cloud only)', options: { 'WSO2 Cloud': { stage: 'beta' } } },
];
