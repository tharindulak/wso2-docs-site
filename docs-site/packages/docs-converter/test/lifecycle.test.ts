// Lifecycle stage front matter (status, deprecated_since, replacement, removal): kept through conversion with value
// checks, merged per deployment option on merged pages, and the "(deprecated)" suffix dropped where a badge says it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { convertRendered, splitFrontMatter } from '../src/page.js';
import { convertMkdocsSite, convertMergedSites } from '../src/site.js';
import { tempSource } from './helpers.js';

const front = (mdx: string) => splitFrontMatter(mdx).data;

test('a page keeps its lifecycle stage fields', async () => {
  const { mdx } = await convertRendered('# Roles v1\n\nOld.\n', {
    deploymentOptions: ['Self-hosted'],
    pageData: { frontMatter: { status: 'deprecated', deprecated_since: '7.0.0', replacement: 'roles-v2-rest-api.md', removal: '7.5.0' } },
  });
  const fm = front(mdx);
  assert.equal(fm.status, 'deprecated');
  assert.equal(fm.deprecated_since, '7.0.0');
  assert.equal(fm.replacement, 'roles-v2-rest-api.md');
  assert.equal(fm.removal, '7.5.0');
});

const convertWith = (frontMatter: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  convertRendered('# Page\n\nText.\n', { deploymentOptions: ['WSO2 Cloud', 'Self-hosted'], pageData: { frontMatter }, ...extra });

test('a bad lifecycle value is reported and left out; the page still converts', async () => {
  const unknown = await convertWith({ status: 'Deprecated', deprecated_since: '7.0.0' });
  assert.equal(front(unknown.mdx).status, undefined);
  assert.match(unknown.problems.join('\n'), /status: "Deprecated" is not one of beta, preview, deprecated/);

  const noSince = await convertWith({ status: 'deprecated' });
  assert.equal(front(noSince.mdx).status, 'deprecated', 'the stage still shows');
  assert.match(noSince.problems.join('\n'), /needs deprecated_since/);

  const unquoted = await convertWith({ status: 'deprecated', deprecated_since: 7.2 });
  assert.equal(front(unquoted.mdx).deprecated_since, undefined);
  assert.match(unquoted.problems.join('\n'), /deprecated_since must be a quoted string/);

  const fine = await convertWith({ status: 'beta' });
  assert.deepEqual(fine.problems, []);
  assert.equal(front(fine.mdx).status, 'beta');
});

test('a replacement goes through the unsafe-URL check, and a relative page link must name a page', async () => {
  for (const bad of ['javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,x', 'ftp://host/x', '//evil.example/x']) {
    const r = await convertWith({ status: 'deprecated', deprecated_since: '7.0.0', replacement: bad });
    assert.equal(front(r.mdx).replacement, undefined, bad);
    assert.equal(r.problems.length, 1, bad);
  }
  const exists = (t: string) => t === 'roles-v2-rest-api.md';
  const missing = await convertWith({ status: 'deprecated', deprecated_since: '7.0.0', replacement: 'roles-v3.md' }, { replacementExists: exists });
  assert.match(missing.problems.join('\n'), /replacement names no page: roles-v3\.md/);
  for (const ok of ['roles-v2-rest-api.md#scim', 'https://wso2.com/x/', '/identity/apis/roles-v2/']) {
    const r = await convertWith({ status: 'deprecated', deprecated_since: '7.0.0', replacement: ok }, { replacementExists: exists });
    assert.deepEqual(r.problems, [], ok);
    assert.equal(front(r.mdx).replacement, ok);
  }
});

test('fields that only go with a deprecation are reported on another stage', async () => {
  const r = await convertWith({ status: 'preview', removal: '2027-01' });
  assert.equal(front(r.mdx).removal, undefined);
  assert.match(r.problems.join('\n'), /removal only go with status: deprecated/);
  const orphan = await convertWith({ deprecated_since: '7.0.0' });
  assert.match(orphan.problems.join('\n'), /deprecated_since without status/);
});

test('a YAML error in the page file\'s front matter is reported, not silently dropped', async () => {
  const r = await convertRendered('# Page\n', { deploymentOptions: [], pageData: { frontMatter: {}, error: 'bad indentation of a mapping entry (2:3)' } });
  assert.deepEqual(r.yamlErrors, ['bad indentation of a mapping entry (2:3)']);
  const inline = await convertRendered('---\ntitle: [x\n---\n# Page\n', { deploymentOptions: [] });
  assert.equal(inline.yamlErrors.length, 1);
  assert.match(inline.mdx, /^title: Page$/m, 'the page builds as before');
});

test('where the badge shows Deprecated, the title loses its "(deprecated)" suffix (spec titles and headings)', async () => {
  const spec = await convertRendered('<ApiReference spec="/identity/apis/roles-v1.yaml" />\n', {
    deploymentOptions: ['Self-hosted'], specInfo: () => ({ title: 'SCIM 2.0 Roles V1 API (deprecated)' }),
    pageData: { frontMatter: { status: 'deprecated', deprecated_since: '7.0.0' } },
  });
  assert.equal(front(spec.mdx).title, 'SCIM 2.0 Roles V1 API');
  const heading = await convertRendered('# Recovery v1 (Deprecated)\n\nText.\n', { deploymentOptions: ['Self-hosted'], pageData: { frontMatter: { status: 'deprecated', deprecated_since: '7.0.0' } } });
  assert.equal(front(heading.mdx).title, 'Recovery v1');
  assert.match(heading.mdx, /^# Recovery v1$/m, 'the heading readers see');
  const beta = await convertRendered('# Old thing (deprecated)\n', { deploymentOptions: ['Self-hosted'], pageData: { frontMatter: { status: 'beta' } } });
  assert.equal(front(beta.mdx).title, 'Old thing (deprecated)', 'no Deprecated badge: the suffix stays');
});

test('an MkDocs site reports lifecycle problems and YAML errors per page; the nav label loses "(deprecated)"', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: S\nnav:\n  - APIs:\n      - Roles v1 API (deprecated): apis/roles-v1.md\n      - Roles v2 API: apis/roles-v2.md\n      - Old (deprecated): apis/old.md\n      - Broken: apis/broken.md\n',
    'en/docs/apis/roles-v1.md': '---\nstatus: deprecated\ndeprecated_since: "7.0.0"\nreplacement: roles-v2.md\n---\n# Roles v1\n',
    'en/docs/apis/roles-v2.md': '---\nstatus: deprecated\ndeprecated_since: "7.1.0"\nreplacement: roles-v3.md\n---\n# Roles v2\n',
    'en/docs/apis/old.md': '---\nstatus: retired\n---\n# Old\n',
    'en/docs/apis/broken.md': '---\ntitle: [x\n---\n# Broken\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { sidebar, report } = await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'] }, { outDir: out, route: 's' });
  assert.equal(report.ok, 4, 'every page still converts');
  assert.deepEqual(report.frontMatter.map((p) => [p.page, p.kind]), [['apis/broken.md', 'yaml'], ['apis/old.md', 'lifecycle'], ['apis/roles-v2.md', 'lifecycle']]);
  assert.match(report.frontMatter[2]!.error, /replacement names no page: roles-v3\.md/);
  assert.equal(front(fs.readFileSync(path.join(out, 'apis/roles-v1.md'), 'utf8')).replacement, 'roles-v2.md');
  assert.deepEqual(sidebar[0]!.items!.map((i) => i.label), ['Roles v1 API', 'Roles v2 API', 'Old (deprecated)', 'Broken']);
});

test('a merged page keeps each deployment option\'s stage: flat when they agree, per option under lifecycle when not', async () => {
  const dep = (since: string, more = '') => `---\ntemplate: templates/redoc.html\nstatus: deprecated\ndeprecated_since: "${since}"\n${more}---\n`;
  const root = tempSource({
    'cloud/mkdocs.yml': 'site_name: C\nnav:\n  - Share (deprecated): share.md\n  - Creds (deprecated): creds.md\n  - Same: same.md\n',
    'self/mkdocs.yml': 'site_name: S\nnav:\n  - Share (deprecated): share.md\n  - Creds: creds.md\n  - Same: same.md\n  - Roles v1 (deprecated): roles-v1.md\n  - Bad: bad.md\n',
    'cloud/docs/share.md': `${dep('2026-03', 'replacement: share-v2.md\n')}# Share\n`,
    'self/docs/share.md': `${dep('7.3.0', 'replacement: share-v2.md\n')}# Share\n`,
    'cloud/docs/share-v2.md': '# Share v2\n',
    'self/docs/share-v2.md': '# Share v2\n',
    'cloud/docs/creds.md': `${dep('2026-06')}# Creds (Deprecated)\n`,
    'self/docs/creds.md': '---\ntemplate: templates/redoc.html\n---\n# Creds (Deprecated)\n',
    'cloud/docs/same.md': '---\nstatus: preview\n---\n# Same\n',
    'self/docs/same.md': '---\nstatus: preview\n---\n# Same\n',
    'self/docs/roles-v1.md': `${dep('7.0.0')}# Roles v1\n`,
    'self/docs/bad.md': '---\nstatus: gone\n---\n# Bad\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { sidebar, report } = await convertMergedSites({ cloud: { root, mkdocs: 'cloud/mkdocs.yml' }, self: { root, mkdocs: 'self/mkdocs.yml' } }, { outDir: out, route: 'p' });
  const fm = (rel: string) => front(fs.readFileSync(path.join(out, rel), 'utf8'));
  assert.deepEqual(fm('share.md').lifecycle, {
    'WSO2 Cloud': { status: 'deprecated', deprecated_since: '2026-03', replacement: 'share-v2.md' },
    'Self-hosted': { status: 'deprecated', deprecated_since: '7.3.0', replacement: 'share-v2.md' },
  });
  assert.equal(fm('share.md').status, undefined, 'no flat fields beside the per-option ones');
  assert.deepEqual(fm('creds.md').lifecycle, { 'WSO2 Cloud': { status: 'deprecated', deprecated_since: '2026-06' } });
  assert.equal(fm('creds.md').title, 'Creds', 'the badge says Deprecated (on WSO2 Cloud): the suffix goes');
  assert.equal(fm('same.md').status, 'preview');
  assert.equal(fm('same.md').lifecycle, undefined);
  assert.equal(fm('roles-v1.md').status, 'deprecated');
  assert.deepEqual(report.frontMatter.map((p) => [p.page, p.kind, p.error]), [['bad.md', 'lifecycle', 'Self-hosted: status: "gone" is not one of beta, preview, deprecated']]);
  const labels = sidebar.map((i) => i.label);
  assert.deepEqual(labels, ['Share', 'Creds', 'Same', 'Roles v1', 'Bad']);
});

test('a Docusaurus source (the migrated tree) is held to the same checks, and its sidebar labels follow the badge', async () => {
  const root = tempSource({
    'docusaurus/sidebars.json': JSON.stringify({ docs: [
      { type: 'doc', id: 'apis/share', label: 'V1 (deprecated)' },
      { type: 'doc', id: 'apis/creds', label: 'Creds API (deprecated)' },
      { type: 'doc', id: 'apis/odd', label: 'Odd (deprecated)' },
      { type: 'doc', id: 'apis/share-v2', label: 'V2' },
    ] }),
    'docusaurus/docs/apis/share.md': '---\ntitle: Share API (deprecated)\nlifecycle:\n  WSO2 Cloud: { status: deprecated, deprecated_since: "2026-03", replacement: share-v2.md }\n  Self-hosted: { status: deprecated, deprecated_since: "7.3.0", replacement: share-v3.md }\n---\n\nText.\n',
    'docusaurus/docs/apis/share-v2.md': '---\ntitle: Share v2\n---\n\nText.\n',
    'docusaurus/docs/apis/creds.md': '---\ntitle: Creds\nlifecycle:\n  Hybrid: { status: beta }\n---\n\nText.\n',
    'docusaurus/docs/apis/odd.md': '---\ntitle: Odd\nstatus: deprecated\ndeprecated_since: "7.0.0"\nreplacement: "javascript:alert(1)"\n---\n\nText.\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { sidebar, report } = await (await import('../src/site.js')).prepareDocusaurusDocs(
    { root, docs: 'docusaurus/docs', sidebar: 'docusaurus/sidebars.json', deployment_options: ['WSO2 Cloud', 'Self-hosted'] }, { outDir: out, route: 'identity' });
  const fm = (rel: string) => front(fs.readFileSync(path.join(out, rel), 'utf8'));
  assert.equal(fm('apis/share.md').title, 'Share API');
  assert.deepEqual(fm('apis/share.md').lifecycle, {
    'WSO2 Cloud': { status: 'deprecated', deprecated_since: '2026-03', replacement: 'share-v2.md' },
    'Self-hosted': { status: 'deprecated', deprecated_since: '7.3.0' },
  });
  assert.equal(fm('apis/creds.md').lifecycle, undefined);
  assert.equal(fm('apis/odd.md').replacement, undefined);
  assert.deepEqual(report.frontMatter.map((p) => [p.page, p.error]), [
    ['apis/creds.md', 'lifecycle: "Hybrid" is not a deployment option of the page (WSO2 Cloud, Self-hosted)'],
    ['apis/odd.md', 'replacement is not a safe URL: javascript:alert(1)'],
    ['apis/share.md', 'lifecycle.Self-hosted: replacement names no page: share-v3.md'],
  ]);
  assert.deepEqual(sidebar.map((i) => (i as { label?: string }).label), ['V1', 'Creds API (deprecated)', 'Odd', 'V2']);
});
