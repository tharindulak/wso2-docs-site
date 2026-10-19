# Build the pilot: every version of Identity Platform and Micro Integrator — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve all 14 versions of Identity Platform (Identity Server 7.3.0 to 5.9.0) and Micro Integrator (4.6.0 to 4.2.0) on the docs site. Latest and the previous release are in the live Docusaurus build, and older versions are frozen snapshots merged under the same URLs. A version selector reads a runtime `versions.json`, versions with no source link to Confluence, and the bump bot understands docs releases.

**Architecture:**
- **Lock file:** `content-sources.yaml` gains a per-section `versions:` list. `scripts/versions.mjs` normalises every section, old shape or new, into "version sources", each of which looks like today's section object. That lets `fetch-sources.mjs` and `build-content.mjs` loop over versions with few changes.
- **Live build:** each live version is its own docs plugin instance (`routeBasePath: identity/7.2.0`). Docusaurus orders nested parent routes before their parents (`sortRoutes` in `@docusaurus/core`).
- **Snapshots:** each one is a separate Docusaurus build (`DOCS_SNAPSHOT=<version id>`), packed into a tarball named by a content key, stored behind a small storage interface, and merged into the live output without overwriting.
- **Cross-bundle links:** a client module forces a full page load for links to routes the current bundle does not contain.

**Tech Stack:** Node 22 ESM scripts, `node:test`, TypeScript converter package (`@wso2/docs-converter`), Docusaurus 3.10.2, React 19, MUI 7, GitHub Actions, system `git` and `tar`. No new npm dependencies.

**Spec:** `.scratch/wso2-docs-site-versions/map.md`, plus these decisions:
- `issues/01-latest-source-per-section.md`: Latest rule
- `issues/05-docs-release-convention.md`: docs releases
- `issues/06-lock-file-schema.md`: lock file schema
- `issues/07-build-architecture.md`: build architecture
- `issues/08-pilot-sections.md`: pilot scope and pass criteria

The parent decision `../wso2-docs-site/issues/08-versioning-details.md` supplies the URL scheme and the banner.

## Global Constraints

- **Branch:** `docs-site-versions`, created from `docs-site-build`. Push nothing to any `wso2/*` content repo.
- **URLs:** Latest has no version segment, and older versions use the full release number: `/identity/guides/…` and `/identity/7.2.0/guides/…`.
- **Live window:** Latest plus the previous release (`live_window: 2`, top level of the lock file). It narrows to 1 if the extrapolated full live build exceeds 60 minutes or 14 GB.
- **Tracking:** only Latest may carry `track: true`. Older versions stay pinned.
- **Release tags:** `v<version>` by default, or `<component>/v<version>` through `release_tag`. A fourth segment (`v4.6.0.1`) is a docs fix and still shows as "4.6.0".
- **Labels** come from the lock file, never from the docs' `site_name` or `site_version`.
- **Older versions** are labelled "Deployment options: Self-hosted" on every page. Banner: "You're viewing Self-hosted 7.2.0. For WSO2 Cloud and the latest release, see Latest." For sections without cloud content: "You're viewing 4.4.0. For the latest release, see Latest."
- **Versions with no source** stay on Confluence, listed under "Older versions ↗".
- **Snapshot key:** a hash of the source commit, exclude list, converter version and site chrome version. Any change to the key rebuilds that snapshot.
- **Snapshot storage:** one tarball per snapshot named by its key. The local directory `.cache/snapshots` is the default. The GitHub Release backend (`github-release:docs-site-snapshots`) needs a GitHub remote. This repo has none today, so CI storage is exercised once one exists.
- **Security:**
  - Validate every repo, ref, sha, path and tarball entry before use.
  - Never use a shell.
  - Keep least-privilege tokens, with `contents: write` only on the snapshot upload job.
  - Pin Actions by commit.
  - Add no new npm dependencies.
- **Code style:** match the surrounding code: ESM, `node:` imports, short doc comments, no shell.

## Review Focus

1. **A page that exists in one version but not another.** The selector must land on the target version's home, never on a 404. This is pinned in Task 7, `versionHref falls back to the version home`.
2. **A click from a snapshot page to Latest or to another product,** and from Latest into a snapshot. The browser must do a full page load and must not render the bundle's 404. This is pinned in Task 6, `outside routes are not in the bundle`.
3. **A source with no templating plugin that contains `{{ }}` or `{% %}` text.** The text must survive literally, and Latest IS and MI pages that do use the plugin must render as before. This is pinned in Task 2, and the Task 4 regression run compares page counts.
4. **A crafted or corrupted snapshot tarball** (absolute paths, `..`, or a key mismatch). It must be refused, not extracted. This is pinned in Task 10, `unsafe tar entries are refused`.
5. **Lock-file mistakes:**
   - versions out of order or duplicated
   - `track` on an older version
   - a ref with a fourth segment for a different base version

   Each must stop the pipeline with a message naming the section. This is pinned in Task 1, `validation rejects …`.

---

## File structure

| File | Responsibility |
|---|---|
| `docs-site/scripts/versions.mjs` (new) | Lock-file version model: `sectionVersions`, `versionId`, `sourceKind`, `validateVersions`, `replaceExclude`, `pagePaths`. Pure, tested. |
| `docs-site/scripts/lib.mjs` | `readLock` calls `validateVersions`. `refsOf` works on a version source. |
| `docs-site/scripts/fetch-sources.mjs` | Loops over every version's refs. |
| `docs-site/scripts/build-content.mjs` | Converts every version into `generated/docs/<versionId>`. Writes the manifest `versions`, `<route>/versions.json` and `pages.json`. Version-aware link rewriting and exclude write-back. |
| `docs-site/scripts/check-links.mjs` (new) | Finds broken internal links in built HTML. |
| `docs-site/scripts/snapshot-store.mjs` (new) | Storage interface: local directory or GitHub Release. |
| `docs-site/scripts/snapshots.mjs` (new) | Snapshot keys, `list`, `build <id>`, `assemble <live> <out>`. |
| `docs-site/scripts/bump-lib.mjs` (new) | Pure bump and docs-release planning, plus lock-text edits. |
| `docs-site/scripts/bump-sources.mjs` | Thin CLI over `bump-lib.mjs`. |
| `docs-site/scripts/test/*.test.mjs` (new) | `node:test` tests for the scripts. |
| `docs-site/packages/docs-converter/src/mkdocs-config.ts`, `render.ts`, `site.ts` | Jinja only with a templating plugin. Copy only absolutely referenced assets to static. Markdown images become page-relative. |
| `docs-site/site/docusaurus.config.js` | One plugin instance per included version, snapshot mode, client module, version info in `customFields`. |
| `docs-site/site/src/lib/versions.mjs` (new; `.mjs` because `site/package.json` has no `type`, so Node would load `.js` as CommonJS in tests) | Pure selector logic: `currentVersion`, `versionHref`. |
| `docs-site/site/src/lib/bundle-routes.mjs` (new) | Pure `inBundle(routes, pathname, matchRoutes)`. |
| `docs-site/site/src/client/full-load-links.js` (new) | Click guard: full page load for links outside the bundle. |
| `docs-site/site/src/components/VersionSelect.js`, `ProductBar.js`, `OlderVersionBanner.js` (new), `theme/DocItem/Content/index.js` | Version UI. |
| `docs-site/content-sources.yaml` | IS and MI move to `versions:`, plus `live_window: 2`. |
| `docs-site/CONTENT-RELEASES.md` (new), `README.md`, converter `README.md` | Docs-release convention and the new commands. |
| `.github/workflows/docs-site-snapshots.yml` (new), `docs-site-ci.yml`, `docs-site-content-bump.yml`, `docs-site-version-promotion.yml` | Snapshot matrix, merged link check, docs-release PRs. |

---

### Task 0: Branch and script test harness

**Files:**
- Modify: `docs-site/package.json` (`scripts.test`)
- Create: `docs-site/scripts/test/harness.test.mjs`

- [ ] **Step 1: Create the branch**

```bash
cd /Users/admin/Documents/wso2/Wso2-Cloud
git switch -c docs-site-versions docs-site-build
```

- [ ] **Step 2: Add a smoke test**

```js
// docs-site/scripts/test/harness.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('script tests run', () => assert.ok(true));
```

- [ ] **Step 3: Run script and site tests from `npm test`**

In `docs-site/package.json`, replace the `test` script with:

```json
"test": "npm test -w @wso2/docs-converter && node --test scripts/test/ site/test/",
```

Create `docs-site/site/test/.gitkeep` (empty) so the directory exists.

- [ ] **Step 4: Run it**

Run: `cd docs-site && npm test`
Expected: the converter tests pass, then `script tests run` passes. If `node --test` rejects a directory with no tests, ignore it until Task 6 adds one.

- [ ] **Step 5: Commit**

```bash
git add docs-site/package.json docs-site/scripts/test docs-site/site/test
git commit -m "docs-site: run script and site tests with npm test"
```

---

### Task 1: Version model and validation

**Files:**
- Create: `docs-site/scripts/versions.mjs`
- Modify: `docs-site/scripts/lib.mjs`
- Test: `docs-site/scripts/test/versions.test.mjs`

**Interfaces:**
- Produces:
  - `sectionVersions(section, liveWindow = 2): VersionSource[]`, newest first. A `VersionSource` is a section-shaped object (`kind`, `repo`, `sha`, `track`, `mkdocs`/`docs`/`sidebar`, `sparse`, `exclude`, `deployment_options`, `current_site`, plus `cloud`/`self_hosted`/`cloud_companion` for Latest), extended with:
    - `id: string`: `versionId(...)`
    - `sectionId: string`
    - `version: string | null`
    - `versionLabel: string`: `4.6.0 (Latest)`, `4.5.0` or `Latest`. `label` stays the section's tab label.
    - `status: 'latest' | 'live' | 'snapshot'`
    - `route: string`
    - `source: 'release' | 'branch' | 'folder' | 'legacy'`
  - `versionId(sectionId, version, isLatest): string`: Latest keeps the section id. Others get `${sectionId}--v${version with dots as dashes}`, for example `integration-mi--v4-4-0`, which is a valid Docusaurus plugin id.
  - `confluenceVersions(section): { version, href }[]`
  - `validateVersions(section, liveWindow)`: throws `Error` naming the section.
  - `replaceExclude(text, sectionId, version, list): string`
  - `pagePaths(docsDir): string[]`: page paths relative to the version base, for example `''` or `guides/setup/`, with redirect pages left out.
- Note: `versions.mjs` imports `@wso2/docs-converter`, so `fetch` now needs the built converter. `npm test` and `npm run content` build it. Add `npm run build:converter &&` to the `fetch` script in `package.json`.
- `lib.mjs`: `refsOf(source)` keeps its signature but receives a `VersionSource`. `readLock()` validates versions.

- [ ] **Step 1: Write failing tests**

```js
// docs-site/scripts/test/versions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sectionVersions, versionId, validateVersions, replaceExclude, pagePaths, confluenceVersions } from '../versions.mjs';

const SHA = (c) => c.repeat(40);
const mi = () => ({
  id: 'integration-mi', label: 'Micro Integrator', route: 'integration/micro-integrator', kind: 'mkdocs',
  repo: 'wso2/docs-mi', mkdocs: 'en/mkdocs.yml', sparse: ['en'], deployment_options: ['Self-hosted'],
  current_site: 'https://mi.docs.wso2.com/en/latest/', former_site: 'https://mi.docs.wso2.com/en/{version}/',
  release_tag: 'v',
  versions: [
    { version: '4.6.0', ref: '4.6.0', sha: SHA('a'), track: true, exclude: ['x.md'] },
    { version: '4.5.0', ref: '4.5.0', sha: SHA('b') },
    { version: '4.4.0', ref: 'v4.4.0.2', sha: SHA('c') },
  ],
  older_versions: [{ version: '1.2.0', href: 'https://wso2docs.atlassian.net/wiki/spaces/EI611' }],
});

test('a legacy section is one Latest version that looks like the section', () => {
  const legacy = { id: 'updates', route: 'updates', kind: 'mkdocs', repo: 'wso2/docs-updates', sha: SHA('d'), track: 'master', mkdocs: 'en/mkdocs.yml' };
  const [v] = sectionVersions(legacy);
  assert.equal(v.id, 'updates');
  assert.equal(v.status, 'latest');
  assert.equal(v.source, 'legacy');
  assert.equal(v.sha, SHA('d'));
  assert.equal(v.track, 'master');
  assert.equal(v.route, 'updates');
  assert.equal(v.versionLabel, 'Latest');
  assert.equal(v.label, legacy.label, 'section label untouched');
});

test('versions get ids, routes, statuses, labels and source kinds', () => {
  const vs = sectionVersions(mi(), 2);
  assert.deepEqual(vs.map((v) => [v.id, v.route, v.status, v.versionLabel, v.source]), [
    ['integration-mi', 'integration/micro-integrator', 'latest', '4.6.0 (Latest)', 'branch'],
    ['integration-mi--v4-5-0', 'integration/micro-integrator/4.5.0', 'live', '4.5.0', 'branch'],
    ['integration-mi--v4-4-0', 'integration/micro-integrator/4.4.0', 'snapshot', '4.4.0', 'release'],
  ]);
  assert.equal(vs[0].track, '4.6.0', 'Latest follows its branch');
  assert.equal(vs[1].track, null, 'older versions are pinned');
  assert.deepEqual(vs[0].exclude, ['x.md']);
  assert.deepEqual(vs[1].deployment_options, ['Self-hosted']);
  assert.equal(vs[1].current_site, 'https://mi.docs.wso2.com/en/4.5.0/', 'fallback target is the version on its former site');
  assert.equal(vs[0].former_site, 'https://mi.docs.wso2.com/en/{version}/');
});

test('older versions of a merged section are plain MkDocs, Self-hosted only, without the cloud side', () => {
  const identity = {
    id: 'identity', route: 'identity', kind: 'mkdocs-merge', sparse: ['en'], former_site: 'https://is.docs.wso2.com/en/{version}/',
    cloud: { repo: 'wso2/docs-is', sha: SHA('e'), track: 'master', mkdocs: 'en/asgardeo/mkdocs.yml' },
    self_hosted: {
      repo: 'wso2/docs-is', product_repo: 'wso2/product-is', current_site: 'https://is.docs.wso2.com/en/7.3.0/',
      versions: [
        { version: '7.3.0', ref: 'master', sha: SHA('e'), track: true, mkdocs: 'en/identity-server/7.3.0/mkdocs.yml' },
        { version: '7.2.0', ref: 'master', sha: SHA('e'), mkdocs: 'en/identity-server/7.2.0/mkdocs.yml' },
      ],
    },
  };
  const [latest, prev] = sectionVersions(identity);
  assert.equal(latest.kind, 'mkdocs-merge');
  assert.equal(latest.self_hosted.version, '7.3.0');
  assert.equal(latest.self_hosted.sha, SHA('e'));
  assert.equal(latest.self_hosted.track, 'master');
  assert.equal(latest.self_hosted.mkdocs, 'en/identity-server/7.3.0/mkdocs.yml');
  assert.equal(prev.kind, 'mkdocs');
  assert.equal(prev.repo, 'wso2/docs-is');
  assert.equal(prev.mkdocs, 'en/identity-server/7.2.0/mkdocs.yml');
  assert.equal(prev.source, 'folder');
  assert.equal(prev.cloud, undefined);
  assert.deepEqual(prev.deployment_options, ['Self-hosted']);
});

test('versionId is a valid Docusaurus plugin id', () => {
  assert.equal(versionId('identity', '7.2.0', false), 'identity--v7-2-0');
  assert.equal(versionId('identity', '7.3.0', true), 'identity');
  assert.match(versionId('a-b', '1.10.0', false), /^[a-zA-Z0-9_-]+$/);
});

test('validation rejects unordered, duplicate, malformed and tracked older versions', () => {
  const bad = (edit, message) => { const s = mi(); edit(s); assert.throws(() => validateVersions(s, 2), message); };
  bad((s) => s.versions.reverse(), /integration-mi: versions must be newest first/);
  bad((s) => { s.versions[1].version = '4.6.0'; }, /integration-mi: versions must be newest first/);
  bad((s) => { s.versions[1].track = true; }, /integration-mi: only Latest \(4\.6\.0\) may track/);
  bad((s) => { s.versions[2].ref = 'v4.5.0.1'; }, /integration-mi: ref v4\.5\.0\.1 is a release of another version than 4\.4\.0/);
  bad((s) => { s.versions[0].sha = 'abc'; }, /integration-mi 4\.6\.0: sha must be a full 40-character commit/);
  bad((s) => { s.versions[0].version = '4.6'; }, /integration-mi: version 4\.6 must be numeric/);
  bad((s) => { s.older_versions[0].href = 'http://x'; }, /integration-mi: older version 1\.2\.0 href must be https/);
  bad((s) => { s.versions[1].mkdocs = '../x.yml'; }, /integration-mi 4\.5\.0: path must be relative and inside the repo/);
  assert.doesNotThrow(() => validateVersions(mi(), 2));
});

test('confluenceVersions lists older_versions', () => {
  assert.deepEqual(confluenceVersions(mi()), [{ version: '1.2.0', href: 'https://wso2docs.atlassian.net/wiki/spaces/EI611' }]);
});

test('replaceExclude rewrites one version entry and leaves the rest', () => {
  const text = [
    '      - id: integration-mi',
    '        versions:',
    '          - version: 4.6.0',
    '            ref: 4.6.0',
    '            exclude:',
    '              - a.md',
    '          - version: 4.5.0',
    '            ref: 4.5.0',
    '            exclude: []',
    '      - id: other',
    '        exclude: []',
    '',
  ].join('\n');
  const out = replaceExclude(text, 'integration-mi', '4.5.0', ['b.md', 'c.md']);
  assert.match(out, /- version: 4\.5\.0\n {12}ref: 4\.5\.0\n {12}exclude:\n {14}- b\.md\n {14}- c\.md\n/);
  assert.match(out, /exclude:\n {14}- a\.md\n/, 'other version untouched');
  assert.match(replaceExclude(out, 'integration-mi', '4.6.0', []), /- version: 4\.6\.0\n {12}ref: 4\.6\.0\n {12}exclude: \[\]\n/);
  assert.match(out, /- id: other\n {8}exclude: \[\]/);
});

test('pagePaths lists real pages as URL paths, honours slugs and skips redirects', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  put('index.md', '# Home\n');
  put('guides/setup.md', '# Setup\n');
  put('guides/index.md', '# Guides\n');
  put('ref/ref.md', '---\nslug: /ref/ref/\n---\n# Ref\n');
  put('gone.md', "---\ntitle: Gone\n---\n\nimport Redirect from '@site/src/components/Redirect';\n");
  assert.deepEqual(pagePaths(dir), ['', 'guides/', 'guides/setup/', 'ref/ref/']);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd docs-site && node --test scripts/test/versions.test.mjs`
Expected: FAIL with `Cannot find module '…/scripts/versions.mjs'`.

- [ ] **Step 3: Implement `versions.mjs`**

```js
// docs-site/scripts/versions.mjs
// Lock-file version model: every section, old shape (sha at section level) or new (versions: list), becomes a list
// of version sources, newest first. A version source looks like a section, so the pipeline converts it unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { compareValues, splitFrontMatter, walk } from '@wso2/docs-converter';

export const LIVE_WINDOW_DEFAULT = 2;
const VERSION = /^\d+\.\d+\.\d+$/;
const SHA = /^[0-9a-f]{40}$/;
const REF = /^[A-Za-z0-9._\/-]+$/;
const REL = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]+$/;
const REDIRECT = "from '@site/src/components/Redirect'";

export const versionId = (sectionId, version, isLatest) => (isLatest || !version ? sectionId : `${sectionId}--v${version.replace(/\./g, '-')}`);

/** The version list of a section: its own, or its self-hosted side's (merged sections). */
const listOf = (section) => section.versions ?? section.self_hosted?.versions ?? null;

/** release: ref is the docs-release tag of this version (with or without a fourth segment); folder: a path override. */
export function sourceKind(section, v) {
  const tag = `${section.release_tag ?? 'v'}${v.version}`;
  if (v.ref === tag || v.ref.startsWith(`${tag}.`)) return 'release';
  return v.mkdocs || v.docs ? 'folder' : 'branch';
}

/** The release base a tag stands for: "v4.5.0.1" -> "4.5.0"; null when the ref is not a release tag. */
const releaseBase = (section, ref) => {
  const prefix = section.release_tag ?? 'v';
  if (!ref.startsWith(prefix)) return null;
  const m = ref.slice(prefix.length).match(/^(\d+\.\d+\.\d+)(\.\d+)?$/);
  return m ? m[1] : null;
};

export function sectionVersions(section, liveWindow = LIVE_WINDOW_DEFAULT) {
  const list = listOf(section);
  if (!list) {
    const version = section.self_hosted?.version ?? section.version ?? null;
    return [{ ...section, sectionId: section.id, version, status: 'latest', source: 'legacy', versionLabel: version ? `${version} (Latest)` : 'Latest' }];
  }
  return list.map((v, i) => {
    const latest = i === 0;
    const base = {
      sectionId: section.id, id: versionId(section.id, v.version, latest), version: v.version,
      status: latest ? 'latest' : i < liveWindow ? 'live' : 'snapshot', source: sourceKind(section, v),
      versionLabel: latest ? `${v.version} (Latest)` : v.version,
      route: latest ? section.route : `${section.route}/${v.version}`, former_site: section.former_site,
    };
    const pick = { sha: v.sha, track: v.track ? v.ref : null, ref: v.ref };
    const overrides = Object.fromEntries(['mkdocs', 'docs', 'sidebar', 'sparse', 'nav_pick', 'skip', 'deployment_overrides']
      .filter((k) => v[k] !== undefined).map((k) => [k, v[k]]));
    const exclude = v.exclude ?? [];
    if (section.kind === 'mkdocs-merge') {
      const sh = section.self_hosted;
      if (latest) return { ...section, ...base, exclude, self_hosted: { ...sh, ...overrides, ...pick, version: v.version } };
      return {
        ...base, kind: 'mkdocs', label: section.label, repo: sh.repo, mkdocs: v.mkdocs, sparse: v.sparse ?? section.sparse, ...pick,
        exclude, deployment_options: ['Self-hosted'], current_site: (section.former_site ?? '').replace('{version}', v.version),
      };
    }
    if (latest) return { ...section, ...overrides, ...base, ...pick, exclude };
    const { cloud_companion: _c, deployment_overrides: _d, aliases: _a, ...rest } = section;
    return {
      ...rest, ...overrides, ...base, ...pick, exclude, deployment_options: ['Self-hosted'],
      deployment_overrides: overrides.deployment_overrides, current_site: (section.former_site ?? section.current_site ?? '').replace('{version}', v.version),
    };
  });
}

export const confluenceVersions = (section) => (section.older_versions && Array.isArray(section.older_versions) ? section.older_versions : []);

export function validateVersions(section, liveWindow) {
  const list = listOf(section);
  if (!list) return;
  const id = section.id;
  if (!Array.isArray(list) || !list.length) throw new Error(`${id}: versions must list at least one version`);
  for (const v of list) {
    if (!VERSION.test(String(v.version))) throw new Error(`${id}: version ${v.version} must be numeric (for example 4.6.0)`);
    if (!SHA.test(v.sha ?? '')) throw new Error(`${id} ${v.version}: sha must be a full 40-character commit`);
    if (!REF.test(v.ref ?? '')) throw new Error(`${id} ${v.version}: ref must name a branch or tag`);
    for (const rel of [v.mkdocs, v.docs, v.sidebar, ...(v.sparse ?? [])].filter(Boolean)) {
      if (!REL.test(rel)) throw new Error(`${id} ${v.version}: path must be relative and inside the repo: ${rel}`);
    }
    const base = releaseBase(section, v.ref);
    if (base && base !== v.version) throw new Error(`${id}: ref ${v.ref} is a release of another version than ${v.version}`);
  }
  for (let i = 1; i < list.length; i++) {
    if (compareValues(list[i - 1].version, list[i].version) <= 0) throw new Error(`${id}: versions must be newest first, without duplicates`);
  }
  const tracked = list.slice(1).find((v) => v.track);
  if (tracked) throw new Error(`${id}: only Latest (${list[0].version}) may track a branch; ${tracked.version} is pinned`);
  for (const o of confluenceVersions(section)) {
    if (!/^https:\/\/[^\s]+$/.test(o.href ?? '')) throw new Error(`${id}: older version ${o.version} href must be https`);
  }
  if (section.former_site && !section.former_site.includes('{version}')) throw new Error(`${id}: former_site must contain {version}`);
  if (!Number.isInteger(liveWindow) || liveWindow < 1 || liveWindow > 3) throw new Error(`live_window must be 1, 2 or 3`);
}

/** Replace one version entry's exclude list in the lock-file text, keeping everything else as written. */
export function replaceExclude(text, sectionId, version, list) {
  const start = text.indexOf(`- id: ${sectionId}\n`);
  if (start < 0) throw new Error(`Section ${sectionId} not found in the lock file`);
  const entry = new RegExp(`\\n( *)- version: ${version.replace(/\./g, '\\.')}\\n`).exec(text.slice(start));
  if (!entry) throw new Error(`${sectionId}: version ${version} not found in the lock file`);
  const at = start + entry.index + entry[0].length;
  const keyIndent = ' '.repeat(entry[1].length + 2);
  const itemIndent = ' '.repeat(entry[1].length + 4);
  const rest = text.slice(at);
  const end = rest.search(new RegExp(`\\n {0,${entry[1].length}}\\S`));
  const body = end < 0 ? rest : rest.slice(0, end + 1);
  const replaced = body.replace(new RegExp(`(^|\\n)${keyIndent}exclude:[ \\t]*(?:\\[\\]|(?:\\n${itemIndent}- .*)+)`),
    `$1${keyIndent}exclude:${list.length ? `\n${list.map((p) => `${itemIndent}- ${p}`).join('\n')}` : ' []'}`);
  return text.slice(0, at) + replaced + rest.slice(body.length);
}

/** URL paths of the real pages in a generated docs folder, relative to the version base ("" is the home page). */
export function pagePaths(docsDir) {
  const out = new Set();
  for (const rel of walk(docsDir, (r) => r.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(docsDir, rel), 'utf8');
    if (text.includes(REDIRECT)) continue;
    const slug = splitFrontMatter(text).data.slug;
    const p = typeof slug === 'string' ? slug.replace(/^\//, '') : rel.replace(/\\/g, '/').replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '/');
    out.add(p.replace(/^\/$/, ''));
  }
  return [...out].sort();
}
```

- [ ] **Step 4: Wire validation into `lib.mjs`**

In `docs-site/scripts/lib.mjs`:
- Add the import `import { sectionVersions, validateVersions, LIVE_WINDOW_DEFAULT } from './versions.mjs';`.
- In `readLock()`, before the existing `for (const ref of refsOf(s))` loop, add `validateVersions(s, lock.live_window ?? LIVE_WINDOW_DEFAULT);`.
- Change that loop to `for (const v of sectionVersions(s, lock.live_window ?? LIVE_WINDOW_DEFAULT)) for (const ref of refsOf(v))`.
- Make the `track` check accept `null` for pinned versions: `if (ref.track !== null && !BRANCH.test(ref.track ?? ''))`.
- Export the window: `export const liveWindow = (lock) => lock.live_window ?? LIVE_WINDOW_DEFAULT;`.

- [ ] **Step 5: Run the tests**

Run: `cd docs-site && npm run build:converter && node --test scripts/test/` and `node -e "import('./scripts/lib.mjs').then(m=>m.readLock())"`
Expected: all versions tests PASS, and the current lock file still loads without an error, because no section uses `versions:` yet.

- [ ] **Step 6: Commit**

```bash
git add docs-site/scripts/versions.mjs docs-site/scripts/lib.mjs docs-site/scripts/test/versions.test.mjs
git commit -m "docs-site: lock-file version model with validation"
```

---

### Task 2: Render Jinja only when a templating plugin is on

**Files:**
- Modify: `docs-site/packages/docs-converter/src/mkdocs-config.ts` (add `templating` to `MkdocsSite`)
- Modify: `docs-site/packages/docs-converter/src/render.ts` (add `loadPlain`)
- Modify: `docs-site/packages/docs-converter/src/site.ts:174-200` (`convertMkdocsSite` chooses the loader)
- Modify: `docs-site/packages/docs-converter/src/index.ts` (export `loadPlain`, `usesTemplating`)
- Test: `docs-site/packages/docs-converter/test/site.test.ts`

**Interfaces:**
- Produces: `usesTemplating(config: MkdocsConfig): boolean`, `MkdocsSite.templating: boolean` and `loadPlain(file, source): TemplateNode[]`.

- [ ] **Step 1: Write failing tests** (append to `test/site.test.ts`)

```ts
test('without markdownextradata or macros, {{ }} and {% %} are text, and include markers still expand', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: Old\nplugins:\n  - search\nnav:\n  - Home: index.md\n',
    'en/docs/index.md': '# Old\n\nSend {{token}} and keep {% raw %} as written.\n\n{!includes/note.md!}\n',
    'en/docs/includes/note.md': 'Included.',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { report } = await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml' }, { outDir: out, route: 'old' });
  assert.equal(report.failures.length, 0);
  const page = fs.readFileSync(path.join(out, 'index.md'), 'utf8');
  assert.match(page, /token/);
  assert.match(page, /raw/);
  assert.match(page, /Included\./);
});

test('with markdownextradata (string or mapping form, also through INHERIT), Jinja renders as before', async () => {
  for (const plugins of ['  - markdownextradata\n', '  - markdownextradata: {}\n', '  - macros\n']) {
    const root = tempSource({
      'en/base.yml': `plugins:\n${plugins}`,
      'en/mkdocs.yml': 'INHERIT: base.yml\nsite_name: New\nnav:\n  - Home: index.md\nextra:\n  product_name: Demo\n',
      'en/docs/index.md': '# New\n\nWelcome to {{ product_name }}.\n',
    });
    const out = fs.mkdtempSync(path.join(root, 'out-'));
    await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml' }, { outDir: out, route: 'new' });
    assert.match(fs.readFileSync(path.join(out, 'index.md'), 'utf8'), /Welcome to Demo\./, plugins);
  }
});
```

Also update `mkdocsRepo()` at the top of `test/site.test.ts`, whose page uses `{{ product_name }}`: add `plugins:\n  - markdownextradata\n` to its `en/mkdocs.yml`. Check every other fixture in `test/*.test.ts` that renders `{{ }}` through `convertMkdocsSite` or `convertSource`, and add the plugin line to each (`grep -n "mkdocs.yml" test/*.ts`).

- [ ] **Step 2: Run and confirm failure**

If literal `{{token}}` makes the strict MDX compile fail, the converter's existing CommonMark fallback takes the page; the test still holds, because a fallback is not a failure. If the page lands in `report.failures`, escape `{` and `}` outside code in the `loadPlain` output, using the helpers that `syntax.ts` already uses.

Run: `cd docs-site && npm test -w @wso2/docs-converter`
Expected: the first new test FAILS, because `{{token}}` renders as empty.

- [ ] **Step 3: Implement**

`mkdocs-config.ts`. Add to the `MkdocsSite` interface:

```ts
  /** Whether MkDocs renders Jinja in pages (markdownextradata or macros plugin). */
  templating: boolean;
```

Add the function:

```ts
const TEMPLATING_PLUGINS = ['markdownextradata', 'macros'];

/** MkDocs renders {{ }} and {% %} in pages only through a templating plugin; without one they are text. */
export function usesTemplating(config: MkdocsConfig): boolean {
  const plugins = Array.isArray(config.plugins) ? config.plugins : [];
  return plugins.some((p) => (typeof p === 'string' ? TEMPLATING_PLUGINS.includes(p)
    : p !== null && typeof p === 'object' && Object.keys(p).some((k) => TEMPLATING_PLUGINS.includes(k))));
}
```

In `mkdocsSite()`, return `templating: usesTemplating(config)` with the other fields.

`render.ts`. Add next to `loadPage`:

```ts
/** A page MkDocs does not template: include markers expand, everything else is text. */
export function loadPlain(file: string, source: Source): TemplateNode[] {
  return [{ t: 'text', v: expandMarkers(splitPageData(readInside(source, file)).body, file, source) }];
}
```

`site.ts`, inside `convertMkdocsSite`. Replace `renderSingle(loadPage(file, source), env, file, source)` with:

```ts
renderSingle((site.templating ? loadPage : loadPlain)(file, source), env, file, source)
```

Import `loadPlain` from `./render.js`. In `index.ts`, add `loadPlain` to the `./render.js` export line and `usesTemplating` to the `./mkdocs-config.js` export line.

- [ ] **Step 4: Run the tests**

Run: `cd docs-site && npm test -w @wso2/docs-converter`
Expected: PASS, every test including the earlier ones.

- [ ] **Step 5: Run a regression check on Latest**

Run: `cd docs-site && npm run fetch -- identity integration-mi && npm run content -- identity integration-mi`
Expected: the `ok` counts per section equal the counts before the change, shown with `git stash` or from `generated/content-report.json` on `docs-site-build`. Latest IS and MI both enable `markdownextradata` (checked: `en/identity-server/7.3.0/mkdocs.yml:214`, `docs-mi en/mkdocs.yml`).

- [ ] **Step 6: Commit**

```bash
git add docs-site/packages/docs-converter
git commit -m "docs-converter: render Jinja only when MkDocs has a templating plugin"
```

---

### Task 3: Move Identity Platform and Micro Integrator to `versions:` and fetch every version

**Files:**
- Modify: `docs-site/content-sources.yaml` (the `identity` and `integration-mi` sections, plus top-level `live_window`)
- Modify: `docs-site/scripts/fetch-sources.mjs:20-30`

- [ ] **Step 1: Resolve full commits** (the inventory has 12-character shas)

```bash
for b in 4.6.0 4.5.0 4.4.0 4.3.0 4.2.0; do git ls-remote https://github.com/wso2/docs-mi.git "refs/heads/$b"; done
```

Expected: five `<40-hex>\trefs/heads/<b>` lines, whose first 12 characters match `16f84ae6e39b`, `f62217f74a43`, `4ab09a6fce74`, `5b4f5a8f5e9b` and `840cd49e8494`. If a head has moved since the inventory, use the new head for 4.6.0 (Latest tracks), and for older versions use the head as it is today.

- [ ] **Step 2: Edit the lock file**

Add the top-level `live_window: 2` (after the header comment, before `products:`), with the comment `# versions per section in the live build (Latest plus previous); older ones are snapshots`. Update the header comment so it documents `versions:`, `release_tag`, `former_site` and `older_versions` as the [lock file schema](../.scratch/wso2-docs-site-versions/issues/06-lock-file-schema.md) defines them.

Replace the `integration-mi` section with the block below. Fill in the shas from Step 1, and move the old `exclude: []` to 4.6.0.

```yaml
      - id: integration-mi
        label: Micro Integrator
        route: integration/micro-integrator
        kind: mkdocs
        repo: wso2/docs-mi
        mkdocs: en/mkdocs.yml
        deployment_options: [Self-hosted]
        current_site: https://mi.docs.wso2.com/en/latest/
        former_site: https://mi.docs.wso2.com/en/{version}/
        release_tag: v
        product_repo: wso2/micro-integrator
        sparse: [en]
        # Latest is the newest GA release's branch, not main (main describes unreleased 4.7.0); see ticket 01.
        versions:
          - version: 4.6.0
            ref: 4.6.0
            sha: <full sha of 4.6.0>
            track: true
            exclude: []
          - version: 4.5.0
            ref: 4.5.0
            sha: <full sha of 4.5.0>
            exclude: []
          - version: 4.4.0
            ref: 4.4.0
            sha: <full sha of 4.4.0>
            exclude: []
          - version: 4.3.0
            ref: 4.3.0
            sha: <full sha of 4.3.0>
            exclude: []
          - version: 4.2.0
            ref: 4.2.0
            sha: <full sha of 4.2.0>
            exclude: []
```

Remove `sha`, `track`, `older_versions` and `note` from the old MI section. The note no longer applies, because the label now comes from the lock file.

For `identity`:
- Replace `self_hosted.version`, `self_hosted.sha`, `self_hosted.track` and `self_hosted.mkdocs` with a `versions:` list for 7.3.0, 7.2.0, 7.1.0, 7.0.0, 6.1.0, 6.0.0, 5.11.0, 5.10.0 and 5.9.0:
  - Every entry has `ref: master` and `sha: c2176fcd1b501d78b6261b04f276f8a9902aabbd`, which is today's pin.
  - Every entry has `mkdocs: en/identity-server/<version>/mkdocs.yml`.
  - 7.3.0 has `track: true` and the section's existing exclude list. The others have `exclude: []`.
- Move the section-level `exclude:` into the 7.3.0 entry. The pages it lists are relative to the merged Latest section.
- Widen `sparse` to `[en/asgardeo, en/identity-server, en/includes, en/base.yml, en/theme]`.
- Add `former_site: https://is.docs.wso2.com/en/{version}/` at section level.
- Replace `older_versions:` with the Confluence list below. Before committing, check that each URL loads in a browser (Identity Server 5.8.0 was confirmed in the inventory, returning HTTP 200).

```yaml
        older_versions:
          - { version: 5.8.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS580 }
          - { version: 5.7.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS570 }
          - { version: 5.6.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS560 }
          - { version: 5.5.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS550 }
          - { version: 5.4.1, href: https://wso2docs.atlassian.net/wiki/spaces/IS541 }
          - { version: 5.4.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS540 }
          - { version: 5.3.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS530 }
          - { version: 5.2.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS520 }
          - { version: 5.1.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS510 }
          - { version: 5.0.0, href: https://wso2docs.atlassian.net/wiki/spaces/IS500 }
```

If a space key differs, take the real link from `is.docs.wso2.com/en/versions/`, which the inventory fetched.

- [ ] **Step 3: Fetch per version**

In `fetch-sources.mjs`, import `sectionVersions` from `./versions.mjs` and `liveWindow` from `./lib.mjs`. Replace the `wanted` loop with:

```js
const lock = readLock();
const wanted = new Map(); // repo@sha -> { repo, sha, sparse:Set }
for (const product of lock.products) {
  for (const section of product.sections) {
    for (const v of sectionVersions(section, liveWindow(lock))) {
      if (only.size && !only.has(section.id) && !only.has(v.id)) continue;
      for (const ref of refsOf(v)) {
        const key = `${ref.repo}@${ref.sha}`;
        if (!wanted.has(key)) wanted.set(key, { ...ref, sparse: new Set() });
        const sparse = ref === v.cloud_companion ? v.cloud_companion.sparse : v.sparse;
        for (const p of sparse ?? ['/']) wanted.get(key).sparse.add(p);
      }
    }
  }
}
```

- [ ] **Step 4: Validate and fetch**

Run: `cd docs-site && node -e "import('./scripts/lib.mjs').then(m=>m.readLock())" && npm run fetch -- identity integration-mi`
Expected: no validation error. One `fetched` line for docs-is, because every IS version shares one sha, and five for docs-mi.

- [ ] **Step 5: Commit**

```bash
git add docs-site/content-sources.yaml docs-site/scripts/fetch-sources.mjs
git commit -m "docs-site: Identity Platform and Micro Integrator list every version; fetch per version"
```

---

### Task 4: Convert every version; manifest, `versions.json`, `pages.json`, version-aware links

**Files:**
- Modify: `docs-site/scripts/build-content.mjs`

**Interfaces:**
- Consumes: `sectionVersions`, `confluenceVersions`, `replaceExclude`, `pagePaths` (Task 1) and `liveWindow` (lib).
- Produces:
  - `generated/docs/<versionId>/`, `generated/sidebars/<versionId>.json`
  - Static assets: `generated/static/<route>/` for Latest, and `generated/static-versions/<versionId>/<route>/<version>/` for older versions.
  - Manifest: `manifest.products[].sections[]` keeps today's fields for Latest and adds:
    - `cloud: boolean`
    - `versions: [{ id, version, label, status, route, sidebar, landing }]`, newest first, plus `{ version, label, status: 'confluence', href }`
  - `generated/static/<route>/versions.json`: `{ section, latest, versions: [{ version, label, status, path, href? }] }`, where `path` is `/<route>/` or `/<route>/<version>/`.
  - `pages.json` (a JSON array of `pagePaths`):
    - Latest: `generated/static/<route>/pages.json`
    - Older versions: `generated/static-versions/<versionId>/<route>/<version>/pages.json`

- [ ] **Step 1: Loop over versions**

In `build-content.mjs`:
- Import `sectionVersions`, `confluenceVersions`, `replaceExclude` and `pagePaths` from `./versions.mjs`, and `liveWindow` from `./lib.mjs`.
- Replace the body of `for (const section of product.sections) { … }` so it iterates `const versions = sectionVersions(section, liveWindow(lock));`.
- For each `v`:
  - `outDir = path.join(GENERATED, 'docs', v.id)`
  - `staticDir = v.status === 'latest' ? path.join(GENERATED, 'static', v.route) : path.join(GENERATED, 'static-versions', v.id, v.route)`
  - Call `buildSection(v, outDir, staticDir, sidebarsDir, report)` and `fillTemplatePages(product, v, outDir, sidebarFile)` with `v` in place of `section`. `v` carries `id`, `route`, `kind`, `label` and `exclude`.
  - The `only` filter matches `only.has(section.id) || only.has(v.id)`.
  - Exclude write-back: when `section.versions ?? section.self_hosted?.versions` exists, call `text = replaceExclude(text, section.id, v.version, list)`. Otherwise keep the existing regex path.
  - Collect the per-version exclude changes in `excludeChanges.push({ section, v, list })`, and apply them in the existing `if (lockChanged)` block.
  - Remove `fs.rmSync(path.join(GENERATED, 'static-versions', v.id), { recursive: true, force: true })` before converting a non-Latest version.

The landing computation stays per version (use `v.id` for `docsDir` and the sidebar file). Replace `entry.sections.push({...})` with:

```js
const versionEntries = versions.map((v) => ({ id: v.id, version: v.version, label: v.versionLabel, status: v.status, route: v.route, sidebar: `${v.id}.json`, landing: landingOf(v) }));
const latest = versionEntries[0];
entry.sections.push({
  ...latest, id: section.id, label: section.label, kind: section.kind, cloud: section.kind === 'mkdocs-merge' || Boolean(section.cloud_companion),
  version: versions[0].version, olderVersions: null,
  versions: [...versionEntries, ...confluenceVersions(section).map((o) => ({ version: o.version, label: o.version, status: 'confluence', href: o.href }))],
});
```

Here `landingOf(v)` is the existing landing code, pulled out into a function that takes `v` and reads `generated/docs/<v.id>`. Keep the legacy `olderVersions` behaviour: for sections without `versions:` and with a string `older_versions`, append `{ version: 'older', label: 'Older versions', status: 'confluence', href: section.older_versions }`, so that `VersionSelect` needs only one code path.

- [ ] **Step 2: Write `versions.json` and `pages.json`**

After the product loop, add:

```js
for (const product of manifest.products) for (const s of product.sections) {
  const doc = {
    section: s.id, latest: s.version,
    versions: s.versions.map((v) => (v.status === 'confluence' ? { version: v.version, label: v.label, status: v.status, href: v.href }
      : { version: v.version, label: v.label, status: v.status, path: `/${v.route}/` })),
  };
  write(path.join(GENERATED, 'static', s.route, 'versions.json'), JSON.stringify(doc));
  for (const v of s.versions.filter((x) => x.status !== 'confluence')) {
    const dir = v.status === 'latest' ? path.join(GENERATED, 'static', v.route) : path.join(GENERATED, 'static-versions', v.id, v.route);
    write(path.join(dir, 'pages.json'), JSON.stringify(pagePaths(path.join(GENERATED, 'docs', v.id))));
  }
}
```

- [ ] **Step 3: Make link rewriting version-aware**

In `rewriteLinksToHostedPages`, iterate `for (const v of sectionVersions(section, liveWindow(lock)))` with `docsDir = path.join(GENERATED, 'docs', v.id)`. `add(url, sub)` uses `v.route` as the base route. Register these prefixes for each version:
- Latest: `section.current_site`, every `aliases` entry, and `section.former_site` with `{version}` set to Latest's version. The existing `/en/latest/` derivation stays.
- Older versions: `v.current_site`, which is `former_site` with that version, from Task 1.

Apply the rewrite loop to every version's `docsDir`.

Merged sections: the Latest `v` is the merged section, so keep `refs = [v.cloud, v.self_hosted]` for Latest only.

- [ ] **Step 4: Run it**

Run: `cd docs-site && npm run content -- identity integration-mi --onboard`
Expected:
- 14 output lines, one per version, for example `identity--v7-2-0 ok …`.
- `generated/static/identity/versions.json` lists 9 converted versions and 10 Confluence versions.
- `generated/static-versions/identity--v5-9-0/identity/5.9.0/pages.json` exists.
- Exclude lists are written into each version entry of `content-sources.yaml`. Check with `git diff docs-site/content-sources.yaml`: only `exclude:` lines change.
- The research measured 0 to 4 failing pages per version. If a version fails far more often, stop and investigate before continuing.

Note: `--onboard` writes a list only where the current one is empty. Every older version starts with `exclude: []`, so this records them all at once.

- [ ] **Step 5: Commit**

```bash
git add docs-site/scripts/build-content.mjs docs-site/content-sources.yaml
git commit -m "docs-site: convert every listed version; versions.json and pages.json per section"
```

---

### Task 5: Docusaurus config: one plugin instance per version, snapshot mode, older-version labels

**Files:**
- Modify: `docs-site/site/docusaurus.config.js`

**Interfaces:**
- Consumes: the manifest `sections[].versions` (Task 4).
- Produces:
  - `customFields.catalogue.products[].sections[]` gains `versionsUrl` (`/<route>/versions.json`).
  - `customFields.versionInfo`, keyed by plugin id: `{ sectionId, version, label, status, latestPath, cloud }`.
  - `customFields.snapshot`: the version id or `null`.
  - Environment variable `DOCS_SNAPSHOT=<versionId>`: build only that version.

- [ ] **Step 1: Replace `docsPlugins`**

```js
const snapshot = process.env.DOCS_SNAPSHOT || null;
const entries = manifest.products.flatMap((product) => product.sections.flatMap((section) =>
  section.versions.filter((v) => v.status !== 'confluence').map((v) => ({ section, v }))));
if (snapshot && !entries.some((e) => e.v.id === snapshot)) throw new Error(`DOCS_SNAPSHOT: unknown version ${snapshot}`);
const included = entries.filter(({ section, v }) => (snapshot ? v.id === snapshot : v.status !== 'snapshot' && built(section)));

const docsPlugins = included.map(({ section, v }) => [
  '@docusaurus/plugin-content-docs',
  {
    id: v.id,
    path: path.join(generated, 'docs', v.id),
    routeBasePath: v.route,
    sidebarPath: path.join(generated, 'sidebars', v.sidebar),
    sidebarCollapsed: true,
    rehypePlugins: [rehypeValidElements],
    ...(section.kind === 'docusaurus' ? {} : { numberPrefixParser: false }),
    versions: { current: { label: v.label } },
  },
]);
const versionStatics = included.filter(({ v }) => v.status !== 'latest').map(({ v }) => path.join(generated, 'static-versions', v.id));
const versionInfo = Object.fromEntries(entries.map(({ section, v }) => [v.id, {
  sectionId: section.id, version: v.version, label: v.label, status: v.status, latestPath: `/${section.route}/`, cloud: section.cloud,
}]));
```

In `staticDirectories`, insert `...versionStatics` after `path.join(generated, 'static')`. In `catalogue`, give each section `versionsUrl: \`/${route}/versions.json\``. Remove `olderVersions` from the section mapping, because the selector now reads `versions.json`. Set `customFields: { catalogue, versionInfo, snapshot }`.

Snapshot builds still build the home page and the account docs. `assemble` (Task 10) copies only the snapshot's own subtree and `assets/`.

- [ ] **Step 2: Label older versions**

In `build-content.mjs` this is already handled: older versions get `deployment_options: ['Self-hosted']` from Task 1, and the converter writes it into each page's front matter. Check it after Task 4's content run with:

```bash
grep -L "Self-hosted" docs-site/generated/docs/identity--v7-2-0/**/*.md | head
```

Expected: no files listed, except redirect pages, which carry the same front matter.

- [ ] **Step 3: Quick-build two live versions and check the routes**

Run: `cd docs-site && npm run build:quick -- identity`
Expected:
- The build succeeds.
- `site/build-quick/identity/7.2.0/index.html` exists and contains `7.2.0`.
- `site/build-quick/identity/index.html` exists.
- `site/build-quick/identity/7.1.0/` does not exist, because 7.1.0 is a snapshot.
- Open `npm run serve -- --dir build-quick`, then navigate in the browser from `/identity/` to `/identity/7.2.0/`. The 7.2.0 page renders, not a 404, which confirms that `sortRoutes` places nested parent routes first.

`build-sections.mjs` selects by section id (`DOCS_SECTIONS`). `built(section)` still uses the section id, so both live versions of a selected section are included.

- [ ] **Step 4: Build one snapshot**

Run: `cd docs-site && DOCS_SNAPSHOT=identity--v5-9-0 node scripts/docusaurus.mjs build site --out-dir build-snapshots/identity--v5-9-0`
Expected: success, and `site/build-snapshots/identity--v5-9-0/identity/5.9.0/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add docs-site/site/docusaurus.config.js
git commit -m "docs-site: a docs plugin instance per live version; DOCS_SNAPSHOT builds one version"
```

---

### Task 6: Full page loads for links outside the bundle

**Files:**
- Create: `docs-site/site/src/lib/bundle-routes.mjs`
- Create: `docs-site/site/src/client/full-load-links.js`
- Modify: `docs-site/site/docusaurus.config.js` (`clientModules`)
- Test: `docs-site/site/test/bundle-routes.test.mjs`

**Interfaces:**
- Produces: `inBundle(routes, pathname, matchRoutes): boolean`. It returns true when the deepest match is a leaf route that isn't the catch-all `*`.

- [ ] **Step 1: Write the failing test**

```js
// docs-site/site/test/bundle-routes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { inBundle } from '../src/lib/bundle-routes.mjs';

// react-router-config is what @docusaurus/router's matchRoutes re-exports; resolvable from docs-site.
const { matchRoutes } = createRequire(import.meta.url)('react-router-config');
const routes = [
  { path: '/identity/7.2.0', routes: [{ path: '/identity/7.2.0/', exact: true }, { path: '/identity/7.2.0/guides/', exact: true }] },
  { path: '/identity', routes: [{ path: '/identity/', exact: true }, { path: '/identity/guides/', exact: true }] },
  { path: '/', exact: true },
  { path: '*' },
];

test('pages in the bundle are client-side routes', () => {
  assert.equal(inBundle(routes, '/identity/guides/', matchRoutes), true);
  assert.equal(inBundle(routes, '/identity/7.2.0/guides/', matchRoutes), true);
  assert.equal(inBundle(routes, '/', matchRoutes), true);
});

test('outside routes are not in the bundle', () => {
  assert.equal(inBundle(routes, '/identity/7.1.0/guides/', matchRoutes), false, 'snapshot under a live parent route');
  assert.equal(inBundle(routes, '/integration/micro-integrator/', matchRoutes), false, 'catch-all only');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd docs-site && node --test site/test/`
Expected: FAIL, because the module isn't found. If `react-router-config` doesn't resolve, run `npm ls react-router-config` and add `{ paths: [require.resolve('@docusaurus/core')] }` to the `createRequire` lookup.

- [ ] **Step 3: Implement**

```js
// docs-site/site/src/lib/bundle-routes.mjs
// Whether this page bundle can render a path itself. Older versions are separate builds (snapshots) served on the same
// domain; a client-side navigation to one would render this bundle's 404, so such links need a full page load.
export function inBundle(routes, pathname, matchRoutes) {
  const matches = matchRoutes(routes, pathname);
  const leaf = matches.at(-1)?.route;
  return Boolean(leaf) && leaf.path !== '*' && !leaf.routes;
}
```

```js
// docs-site/site/src/client/full-load-links.js
// Same-site links to pages this bundle does not contain (snapshot versions, or the live site from a snapshot)
// load the page from the server instead of rendering this bundle's 404.
import routes from '@generated/routes';
import { matchRoutes } from '@docusaurus/router';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import { inBundle } from '../lib/bundle-routes.mjs';

if (ExecutionEnvironment.canUseDOM) {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || inBundle(routes, url.pathname, matchRoutes)) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(url.href);
  }, true); // capture: runs before Docusaurus Link's React handler
}
```

If webpack can't resolve `matchRoutes` from `@docusaurus/router`, import it from `react-router-config`, which is the package `@docusaurus/router` re-exports.

In `docusaurus.config.js`, add `clientModules: [path.join(here, 'src/client/full-load-links.js')],` to the exported config.

- [ ] **Step 4: Run the tests, then check by hand**

Run: `cd docs-site && node --test site/test/`
Expected: PASS.

Then rebuild with `npm run build:quick -- identity` and serve it. On `/identity/`, use the browser console: `document.querySelector('a[href="/identity/7.2.0/"]')` should navigate client-side, with no network document request in DevTools. A link you add temporarily to `/identity/7.1.0/` should trigger a full document request, which ends in a 404 from the server until Task 10 assembles the snapshot. That 404 is the server's, not the bundle's.

- [ ] **Step 5: Commit**

```bash
git add docs-site/site/src/lib/bundle-routes.mjs docs-site/site/src/client docs-site/site/test docs-site/site/docusaurus.config.js
git commit -m "docs-site: full page load for links outside the page bundle"
```

---

### Task 7: Version selector from `versions.json`, and the older-version banner

**Files:**
- Create: `docs-site/site/src/lib/versions.mjs`
- Modify: `docs-site/site/src/components/VersionSelect.js` (rewrite)
- Modify: `docs-site/site/src/components/ProductBar.js`
- Create: `docs-site/site/src/components/OlderVersionBanner.js`
- Modify: `docs-site/site/src/theme/DocItem/Content/index.js`
- Modify: `docs-site/site/src/css/site.css` (banner style)
- Test: `docs-site/site/test/versions.test.mjs`

**Interfaces:**
- Consumes: `versions.json` and `pages.json` (Task 4), and `customFields.versionInfo` (Task 5).
- Produces:
  - `currentVersion(doc, pathname): entry | undefined`
  - `versionHref(doc, pathname, target, pages): string`, where `pages` is the target's `pages.json` array or `null`
  - `groups(doc): { current: entry[], previous: entry[], older: entry[] }`

- [ ] **Step 1: Write failing tests**

```js
// docs-site/site/test/versions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentVersion, versionHref, groups } from '../src/lib/versions.mjs';

const doc = {
  section: 'identity', latest: '7.3.0',
  versions: [
    { version: '7.3.0', label: '7.3.0 (Latest)', status: 'latest', path: '/identity/' },
    { version: '7.2.0', label: '7.2.0', status: 'live', path: '/identity/7.2.0/' },
    { version: '5.9.0', label: '5.9.0', status: 'snapshot', path: '/identity/5.9.0/' },
    { version: '5.8.0', label: '5.8.0', status: 'confluence', href: 'https://wso2docs.atlassian.net/wiki/spaces/IS580' },
  ],
};

test('currentVersion is the longest matching path', () => {
  assert.equal(currentVersion(doc, '/identity/7.2.0/guides/x/').version, '7.2.0');
  assert.equal(currentVersion(doc, '/identity/guides/x/').version, '7.3.0');
  assert.equal(currentVersion(doc, '/identity/5.9.0/').version, '5.9.0');
});

test('versionHref keeps the page when the target has it', () => {
  assert.equal(versionHref(doc, '/identity/guides/x/', doc.versions[1], ['', 'guides/x/']), '/identity/7.2.0/guides/x/');
  assert.equal(versionHref(doc, '/identity/7.2.0/guides/x/', doc.versions[0], ['guides/x/']), '/identity/guides/x/');
});

test('versionHref falls back to the version home', () => {
  assert.equal(versionHref(doc, '/identity/guides/new/', doc.versions[2], ['', 'guides/x/']), '/identity/5.9.0/');
  assert.equal(versionHref(doc, '/identity/guides/new/', doc.versions[2], null), '/identity/5.9.0/', 'pages.json unavailable');
  assert.equal(versionHref(doc, '/identity/guides/new', doc.versions[1], ['guides/new/']), '/identity/7.2.0/guides/new/', 'missing trailing slash');
});

test('Confluence versions open their own link', () => {
  assert.equal(versionHref(doc, '/identity/guides/x/', doc.versions[3], null), 'https://wso2docs.atlassian.net/wiki/spaces/IS580');
});

test('groups: Latest, previous (live and snapshots), older (Confluence)', () => {
  const g = groups(doc);
  assert.deepEqual([g.current, g.previous, g.older].map((l) => l.map((v) => v.version)), [['7.3.0'], ['7.2.0', '5.9.0'], ['5.8.0']]);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd docs-site && node --test site/test/versions.test.mjs`
Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement the pure logic**

```js
// docs-site/site/src/lib/versions.mjs
// Version selector logic over /<route>/versions.json (written by scripts/build-content.mjs). No React here.
const slash = (p) => (p.endsWith('/') ? p : `${p}/`);

export function currentVersion(doc, pathname) {
  const p = slash(pathname);
  return doc.versions.filter((v) => v.path && p.startsWith(v.path)).sort((a, b) => b.path.length - a.path.length)[0];
}

/** Where choosing `target` takes the reader: the same page when the target version has it, else its home. */
export function versionHref(doc, pathname, target, pages) {
  if (target.status === 'confluence') return target.href;
  const current = currentVersion(doc, pathname);
  const rest = current ? slash(pathname).slice(current.path.length) : '';
  return pages?.includes(rest) ? `${target.path}${rest}` : target.path;
}

export function groups(doc) {
  return {
    current: doc.versions.filter((v) => v.status === 'latest'),
    previous: doc.versions.filter((v) => v.status === 'live' || v.status === 'snapshot'),
    older: doc.versions.filter((v) => v.status === 'confluence'),
  };
}
```

- [ ] **Step 4: Rewrite `VersionSelect.js`**

```js
// Version selector for one product section. Reads /<route>/versions.json at runtime, so snapshot pages built earlier
// still list newer versions. Keeps the page when the target version has it (its pages.json), else opens its home.
import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import { useLocation } from '@docusaurus/router';
import MuiIsland from './MuiIsland.js';
import { currentVersion, versionHref, groups } from '../lib/versions.mjs';

const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export default function VersionSelect({ versionsUrl }) {
  const { pathname } = useLocation();
  const [doc, setDoc] = useState(null);
  const [anchor, setAnchor] = useState(null);
  useEffect(() => { let live = true; getJson(versionsUrl).then((d) => live && setDoc(d)); return () => { live = false; }; }, [versionsUrl]);
  if (!doc) return null;
  const active = currentVersion(doc, pathname);
  const go = async (target) => {
    setAnchor(null);
    const pages = target.status === 'confluence' ? null : await getJson(`${target.path}pages.json`);
    window.location.assign(versionHref(doc, pathname, target, pages)); // versions may be separate builds
  };
  const g = groups(doc);
  const item = (v) => <MenuItem key={v.version} selected={v === active} onClick={() => go(v)}>{v.label}{v.status === 'confluence' ? ' ↗' : ''}</MenuItem>;
  return (
    <MuiIsland>
      <Button size="small" variant="outlined" color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>Version: {active?.label ?? doc.latest} ▾</Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { style: { maxHeight: 420 } } }}>
        {g.current.map(item)}
        {g.previous.length > 0 && <ListSubheader>Previous versions</ListSubheader>}
        {g.previous.map(item)}
        {g.older.length > 0 && <ListSubheader>Older versions</ListSubheader>}
        {g.older.map(item)}
      </Menu>
    </MuiIsland>
  );
}
```

In `ProductBar.js`, replace the `VersionSelect` line with `<VersionSelect versionsUrl={section.versionsUrl} />`. `locate()` matches the section by path prefix, and `/identity/7.2.0/` is under `/identity/`, so no change is needed there.

- [ ] **Step 5: Add the banner on older versions**

```js
// docs-site/site/src/components/OlderVersionBanner.js
// Shown on every page of a version other than Latest.
import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useActivePlugin } from '@docusaurus/plugin-content-docs/client';

export default function OlderVersionBanner() {
  const { versionInfo } = useDocusaurusContext().siteConfig.customFields;
  const info = versionInfo?.[useActivePlugin()?.pluginId];
  if (!info || info.status === 'latest') return null;
  return (
    <div className="older-version-banner" role="note">
      {info.cloud
        ? <>You're viewing Self-hosted {info.version}. For WSO2 Cloud and the latest release, see <Link to={info.latestPath}>Latest</Link>.</>
        : <>You're viewing {info.version}. For the latest release, see <Link to={info.latestPath}>Latest</Link>.</>}
    </div>
  );
}
```

In `theme/DocItem/Content/index.js`, render `<OlderVersionBanner />` before `<DeploymentLabel …/>`. In `site.css`, add:

```css
.older-version-banner { margin: 0 0 1rem; padding: 0.6rem 0.9rem; border-left: 4px solid var(--ifm-color-warning); background: var(--ifm-color-warning-contrast-background); color: var(--ifm-color-warning-contrast-foreground); border-radius: 4px; }
```

- [ ] **Step 6: Test and check visually**

Run: `cd docs-site && node --test site/test/ && npm run build:quick -- identity && npm run serve -- --dir build-quick`
Check in the browser:
- On `/identity/guides/…`, the selector lists 7.3.0 (Latest); then 7.2.0 to 5.9.0 under "Previous versions"; then 5.8.0 to 5.0.0 under "Older versions ↗".
- Choosing 7.2.0 keeps the page.
- Choosing a Confluence version opens wso2docs.atlassian.net.
- Every page of `/identity/7.2.0/` shows the banner and "Deployment options: Self-hosted".
- Check light and dark themes, and a 390 px wide viewport.

- [ ] **Step 7: Commit**

```bash
git add docs-site/site/src docs-site/site/test
git commit -m "docs-site: version selector from versions.json; banner on older versions"
```

---

### Task 8: Copy only absolutely referenced assets to static; markdown images become page-relative

**Files:**
- Modify: `docs-site/packages/docs-converter/src/site.ts` (`convertMkdocsSite`; add `relativeImages` and `copyReferencedAssets`)
- Modify: `docs-site/packages/docs-converter/src/index.ts` (export them)
- Test: `docs-site/packages/docs-converter/test/site.test.ts`

**Interfaces:**
- Produces:
  - `relativeImages(mdx: string, pageRel: string, route: string, exists: (assetRel: string) => boolean): string`
  - `copyReferencedAssets(fromDir: string, pagesDir: string, toDir: string, route: string): number`, which returns the number of files copied.

Docusaurus already emits markdown images that use relative paths as `assets/images/<name>-<contenthash>.<ext>`. Identical images across versions and snapshots therefore share one file once outputs are merged without overwriting (Task 10). That gives the content-hash store the build architecture decision asks for, without custom code. Only the static copy, today a second full copy of every asset per version, has to shrink.

- [ ] **Step 1: Write failing tests**

```ts
import { relativeImages, copyReferencedAssets } from '../src/site.js';

test('markdown images under the section route become page-relative when the file exists', () => {
  const exists = (rel: string) => rel === 'assets/img/a.png';
  assert.equal(relativeImages('![A](/demo/assets/img/a.png)', 'guides/setup.md', 'demo', exists), '![A](../assets/img/a.png)');
  assert.equal(relativeImages('![A](/demo/assets/img/a.png "t")', 'index.md', 'demo', exists), '![A](assets/img/a.png "t")');
  assert.equal(relativeImages('![B](/demo/assets/img/b.png)', 'index.md', 'demo', exists), '![B](/demo/assets/img/b.png)', 'missing file left alone');
  assert.equal(relativeImages('<img src="/demo/assets/img/a.png" />', 'index.md', 'demo', exists), '<img src="/demo/assets/img/a.png" />', 'HTML stays absolute');
  assert.equal(relativeImages('```\n![A](/demo/assets/img/a.png)\n```', 'index.md', 'demo', exists), '```\n![A](/demo/assets/img/a.png)\n```', 'code untouched');
});

test('only assets still referenced by absolute path are copied to static', () => {
  const root = tempSource({ 'docs/assets/a.png': 'A', 'docs/assets/b.png': 'B', 'docs/files/c.zip': 'C', 'pages/index.md': '<img src="/demo/assets/a.png" /> [zip](/demo/files/c.zip)' });
  const to = path.join(root, 'static');
  assert.equal(copyReferencedAssets(path.join(root, 'docs'), path.join(root, 'pages'), to, 'demo'), 2);
  assert.ok(fs.existsSync(path.join(to, 'assets/a.png')));
  assert.ok(fs.existsSync(path.join(to, 'files/c.zip')));
  assert.ok(!fs.existsSync(path.join(to, 'assets/b.png')));
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd docs-site && npm test -w @wso2/docs-converter`
Expected: FAIL, because the exports are missing.

- [ ] **Step 3: Implement**

```ts
const IMAGE = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

/** Markdown images at /<route>/<file> become page-relative, so Docusaurus emits them content-hashed (shared across versions). */
export function relativeImages(mdx: string, pageRel: string, route: string, exists: (assetRel: string) => boolean): string {
  const prefix = `/${route}/`;
  return outsideCode(mdx, (t) => t.replace(/(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g, (m, pre: string, url: string, post: string) => {
    if (!url.startsWith(prefix) || !IMAGE.test(url)) return m;
    const asset = decodeURI(url.slice(prefix.length));
    if (!exists(asset)) return m;
    const rel = path.posix.relative(path.posix.dirname(pageRel.replace(/\\/g, '/')), asset);
    return `${pre}${rel}${post}`;
  }));
}

/** Copy to the static folder only the files pages still reference as /<route>/<file> (HTML, links, attachments). */
export function copyReferencedAssets(fromDir: string, pagesDir: string, toDir: string, route: string): number {
  const wanted = new Set<string>();
  const re = new RegExp(`/${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^\\s"'()<>{}#?]+\\.[A-Za-z0-9]+)`, 'g');
  for (const rel of walk(pagesDir, isPage)) for (const m of fs.readFileSync(path.join(pagesDir, rel), 'utf8').matchAll(re)) wanted.add(decodeURI(m[1]!));
  let copied = 0;
  for (const rel of wanted) {
    const from = path.join(fromDir, rel);
    if (!path.resolve(from).startsWith(path.resolve(fromDir) + path.sep) || !fs.existsSync(from) || isPage(rel)) continue;
    const to = path.join(toDir, rel);
    if (fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied++;
  }
  return copied;
}
```

`isPage` matches both `.md` and `.mdx`. If `walk(pagesDir, isPage)` misses generated `.md` pages, use `(r) => r.endsWith('.md')`.

In `convertMkdocsSite`:
- Inside the `emit` producer, after `convertRendered(...)`, wrap the result: `relativeImages(result.mdx, withPrefix(rel), out.route, (a) => fs.existsSync(path.join(site.docsDir, prefix ? a.slice(prefix.length + 1) : a)))`.
- Replace `if (out.staticDir) copyAssets(site.docsDir, …)` with `if (out.staticDir) copyReferencedAssets(site.docsDir, prefix ? path.join(out.outDir, prefix) : out.outDir, prefix ? path.join(out.staticDir, prefix) : out.staticDir, route)`.

Keep the page-relative `copyAssets(site.docsDir, outDir…)` as it is. Make the same staticDir change in `convertMergedSites`. Leave `prepareDocusaurusDocs` unchanged, since it isn't in the pilot.

- [ ] **Step 4: Run the tests and measure**

Run: `cd docs-site && npm test -w @wso2/docs-converter && du -sh generated/static && npm run content -- identity integration-mi && du -sh generated/static generated/static-versions`
Expected: the tests PASS. Record the before and after `du` figures in the pilot measurements (Task 13). Then run `npm run build:quick -- identity` and spot-check three pages with images on Latest and on 7.2.0.

- [ ] **Step 5: Commit**

```bash
git add docs-site/packages/docs-converter
git commit -m "docs-converter: content-hashed markdown images; static gets only absolutely referenced assets"
```

---

### Task 9: Internal link checker for built output

**Files:**
- Create: `docs-site/scripts/check-links.mjs`
- Test: `docs-site/scripts/test/check-links.test.mjs`

**Interfaces:**
- Produces:
  - `findBrokenLinks(dir, { under } = {}): { page: string, link: string }[]`. `under` limits the check to pages whose path starts with that prefix.
  - CLI: `node scripts/check-links.mjs <dir> [--under <path-prefix>]` exits 1 and prints up to 50 broken links.

- [ ] **Step 1: Write failing tests**

```js
// docs-site/scripts/test/check-links.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findBrokenLinks } from '../check-links.mjs';

const site = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'links-'));
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  return dir;
};

test('internal links resolve to index.html, files or .html', () => {
  const dir = site({
    'identity/index.html': '<a href="/identity/guides/">g</a><a href="/identity/x/#top">x</a><img src="/assets/images/a-1.png"><a href="https://ext">e</a><a href="//cdn/x">c</a>',
    'identity/guides/index.html': '<a href="/identity/missing/">m</a><a href="/identity/7.2.0/">old</a><a href="/identity/guides/?q=1">q</a>',
    'identity/x.html': '', 'assets/images/a-1.png': '',
  });
  assert.deepEqual(findBrokenLinks(dir), [
    { page: 'identity/guides/index.html', link: '/identity/7.2.0/' },
    { page: 'identity/guides/index.html', link: '/identity/missing/' },
  ]);
  assert.deepEqual(findBrokenLinks(dir, { under: 'identity/x' }), []);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd docs-site && node --test scripts/test/check-links.test.mjs`
Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement**

```js
// docs-site/scripts/check-links.mjs
// Broken internal links in built HTML: every same-site href/src must resolve to a file in the output.
// Usage: node scripts/check-links.mjs <build dir> [--under <path prefix>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const walkHtml = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/')).sort();

function resolves(dir, link) {
  const p = decodeURI(link.split(/[?#]/)[0]);
  const file = path.join(dir, p);
  if (!path.resolve(file).startsWith(path.resolve(dir))) return false;
  const candidates = p.endsWith('/') ? [path.join(file, 'index.html')] : [file, path.join(file, 'index.html'), `${file}.html`];
  return candidates.some((f) => fs.existsSync(f) && fs.statSync(f).isFile());
}

export function findBrokenLinks(dir, { under } = {}) {
  const broken = [];
  for (const page of walkHtml(dir)) {
    if (under && !page.startsWith(under)) continue;
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    const links = new Set([...html.matchAll(/\s(?:href|src)="(\/(?!\/)[^"]*)"/g)].map((m) => m[1]));
    for (const link of [...links].sort()) if (!resolves(dir, link)) broken.push({ page, link });
  }
  return broken;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, flag, under] = process.argv.slice(2);
  if (!dir || (flag && flag !== '--under')) { console.error('Usage: node scripts/check-links.mjs <dir> [--under <prefix>]'); process.exit(2); }
  const broken = findBrokenLinks(dir, { under });
  for (const b of broken.slice(0, 50)) console.error(`${b.page}: ${b.link}`);
  console.log(`${broken.length} broken internal link(s)`);
  process.exit(broken.length ? 1 : 0);
}
```

- [ ] **Step 4: Run it**

Run: `cd docs-site && node --test scripts/test/check-links.test.mjs && node scripts/check-links.mjs site/build-quick --under identity/7.2.0`
Expected: the test PASSES. The CLI prints a count. Links into snapshots fail until assembly, which is expected at this point.

- [ ] **Step 5: Commit**

```bash
git add docs-site/scripts/check-links.mjs docs-site/scripts/test/check-links.test.mjs
git commit -m "docs-site: internal link checker for built output"
```

---

### Task 10: Snapshot keys, store, build and assemble

**Files:**
- Create: `docs-site/scripts/snapshot-store.mjs`
- Create: `docs-site/scripts/snapshots.mjs`
- Modify: `docs-site/package.json` (scripts `snapshots`, `check-links`)
- Modify: `docs-site/.gitignore` (`site/build-snapshots/`, `site/build-merged/`)
- Test: `docs-site/scripts/test/snapshots.test.mjs`

**Interfaces:**
- Produces:
  - `snapshotKey(v, { converter, chrome }): string`. The result is 64 hex characters: sha256 over `{ id, repo, sha, mkdocs, docs, sidebar, exclude, converter, chrome }`.
  - `inputHashes(root): { converter, chrome }`. This uses git tree hashes of `packages/docs-converter/src` and of `site/src`, `site/plugins`, `site/docusaurus.config.js`, `scripts/build-content.mjs` and `package-lock.json`. While any of those paths has uncommitted changes, each hash gets a `-dirty-<ms timestamp>` suffix, so a local edit is never served from cache.
  - `checkTarEntries(names): void`, which throws on absolute paths, `..`, or entries outside `<route>/<version>/` and `assets/`.
  - `createStore(spec)`, which returns `{ has(key), get(key, file), put(key, file) }`. The spec is `local:<dir>` (the default is `local:.cache/snapshots`) or `github-release:<tag>` (uses `gh` with `GITHUB_REPOSITORY`).
  - CLI:
    - `node scripts/snapshots.mjs list [--json]` prints a `{ id, key }[]` of snapshot versions.
    - `node scripts/snapshots.mjs build <versionId>`: when the key isn't in the store, builds into `site/build-snapshots/<id>`, link-checks under `<route>/<version>/`, packs and puts.
    - `node scripts/snapshots.mjs assemble <liveDir> <outDir>`: copies the live build, then extracts every snapshot without overwriting, and fails when any snapshot is missing from the store.

- [ ] **Step 1: Write failing tests**

```js
// docs-site/scripts/test/snapshots.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { snapshotKey, checkTarEntries } from '../snapshots.mjs';
import { createStore } from '../snapshot-store.mjs';

const v = { id: 'integration-mi--v4-4-0', repo: 'wso2/docs-mi', sha: 'c'.repeat(40), mkdocs: 'en/mkdocs.yml', exclude: [], route: 'integration/micro-integrator/4.4.0' };
const h = { converter: 't1', chrome: 't2' };

test('snapshot key changes with source, exclude list, converter and chrome', () => {
  const k = snapshotKey(v, h);
  assert.match(k, /^[0-9a-f]{64}$/);
  assert.equal(snapshotKey({ ...v }, { ...h }), k, 'deterministic');
  for (const changed of [snapshotKey({ ...v, sha: 'd'.repeat(40) }, h), snapshotKey({ ...v, exclude: ['a.md'] }, h),
    snapshotKey(v, { ...h, converter: 'x' }), snapshotKey(v, { ...h, chrome: 'x' })]) assert.notEqual(changed, k);
});

test('unsafe tar entries are refused', () => {
  const route = 'integration/micro-integrator/4.4.0';
  assert.doesNotThrow(() => checkTarEntries(['integration/micro-integrator/4.4.0/index.html', 'assets/js/main.1.js'], route));
  for (const bad of ['/etc/passwd', '../x', 'integration/micro-integrator/4.5.0/index.html', 'index.html', 'assets/../../x'])
    assert.throws(() => checkTarEntries([bad], route), /unsafe snapshot entry/);
});

test('local store keeps files by key and refuses malformed keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));
  const store = createStore(`local:${dir}`);
  const key = 'a'.repeat(64);
  const src = path.join(dir, 'in.tgz'); fs.writeFileSync(src, 'TAR');
  assert.equal(store.has(key), false);
  store.put(key, src);
  assert.equal(store.has(key), true);
  const dest = path.join(dir, 'out.tgz'); store.get(key, dest);
  assert.equal(fs.readFileSync(dest, 'utf8'), 'TAR');
  assert.throws(() => store.has('../x'), /invalid snapshot key/);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd docs-site && node --test scripts/test/snapshots.test.mjs`
Expected: FAIL, because the modules aren't found.

- [ ] **Step 3: Implement the store**

```js
// docs-site/scripts/snapshot-store.mjs
// Where snapshot tarballs live, by key. local:<dir> (default) or github-release:<tag> (assets of one release in
// $GITHUB_REPOSITORY, through the gh CLI). Swap for the host's object storage once hosting is decided.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const KEY = /^[0-9a-f]{64}$/;
const checkKey = (key) => { if (!KEY.test(key)) throw new Error(`invalid snapshot key: ${key}`); return key; };

export function createStore(spec = process.env.SNAPSHOT_STORE ?? 'local:.cache/snapshots') {
  const [kind, arg] = [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)];
  if (kind === 'local') {
    const dir = path.resolve(ROOT, arg);
    const file = (key) => path.join(dir, `${checkKey(key)}.tgz`);
    return {
      has: (key) => fs.existsSync(file(key)),
      get: (key, dest) => fs.copyFileSync(file(key), dest),
      put: (key, src) => { fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(src, file(key)); },
    };
  }
  if (kind === 'github-release') {
    if (!/^[A-Za-z0-9._-]+$/.test(arg)) throw new Error(`invalid release tag: ${arg}`);
    const repo = process.env.GITHUB_REPOSITORY;
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo ?? '')) throw new Error('GITHUB_REPOSITORY must be owner/name');
    const gh = (...a) => execFileSync('gh', [...a, '--repo', repo], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    let names = null;
    const list = () => (names ??= new Set(JSON.parse(gh('release', 'view', arg, '--json', 'assets')).assets.map((a) => a.name)));
    return {
      has: (key) => list().has(`${checkKey(key)}.tgz`),
      get: (key, dest) => gh('release', 'download', arg, '--pattern', `${checkKey(key)}.tgz`, '--output', dest, '--clobber'),
      put: (key, src) => {
        const named = path.join(path.dirname(src), `${checkKey(key)}.tgz`);
        if (named !== src) fs.copyFileSync(src, named);
        gh('release', 'upload', arg, named, '--clobber');
        list().add(`${key}.tgz`);
      },
    };
  }
  throw new Error(`SNAPSHOT_STORE must be local:<dir> or github-release:<tag>, got ${spec}`);
}
```

- [ ] **Step 4: Implement `snapshots.mjs`**

```js
// docs-site/scripts/snapshots.mjs
// Frozen versions: each is its own Docusaurus build (DOCS_SNAPSHOT), packed as <key>.tgz and merged into the live
// output under the same URLs. The key covers source commit, exclude list, converter and site chrome; a change rebuilds.
// Usage: node scripts/snapshots.mjs list [--json] | build <versionId> | assemble <liveDir> <outDir>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readLock, liveWindow, ROOT } from './lib.mjs';
import { sectionVersions } from './versions.mjs';
import { createStore } from './snapshot-store.mjs';
import { findBrokenLinks } from './check-links.mjs';
import { withHeap } from './docusaurus.mjs';

const CHROME = ['site/src', 'site/plugins', 'site/docusaurus.config.js', 'scripts/build-content.mjs', 'package-lock.json'];
const CONVERTER = ['packages/docs-converter/src'];

export function snapshotKey(v, { converter, chrome }) {
  const input = { id: v.id, repo: v.repo, sha: v.sha, mkdocs: v.mkdocs ?? null, docs: v.docs ?? null, sidebar: v.sidebar ?? null, exclude: [...(v.exclude ?? [])].sort(), converter, chrome };
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export function inputHashes(root = ROOT) {
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  const hash = (paths) => {
    const trees = paths.map((p) => git('rev-parse', `HEAD:docs-site/${p}`)).join(',');
    const dirty = git('status', '--porcelain', '--', ...paths);
    return dirty ? `${trees}-dirty-${Date.now()}` : trees;
  };
  return { converter: hash(CONVERTER), chrome: hash(CHROME) };
}

export function checkTarEntries(names, route) {
  for (const raw of names) {
    const name = raw.replace(/^\.\//, '');
    const ok = !name.startsWith('/') && !name.split('/').includes('..') && (name.startsWith(`${route}/`) || name === `${route}/` || name.startsWith('assets/') || name === 'assets/');
    if (!ok) throw new Error(`unsafe snapshot entry: ${raw}`);
  }
}

const snapshotVersions = () => {
  const lock = readLock();
  return lock.products.flatMap((p) => p.sections.flatMap((s) => sectionVersions(s, liveWindow(lock)))).filter((v) => v.status === 'snapshot');
};
const tar = (...a) => execFileSync('tar', a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

/** Copy a tree without overwriting: hashed assets are identical when names match; the live build always wins. */
function copyNoOverwrite(from, to) {
  for (const e of fs.readdirSync(from, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue;
    const rel = path.relative(from, path.join(e.parentPath, e.name));
    const dest = path.join(to, rel);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(from, rel), dest);
  }
}

function build(id) {
  const v = snapshotVersions().find((x) => x.id === id);
  if (!v) throw new Error(`${id} is not a snapshot version`);
  const key = snapshotKey(v, inputHashes());
  const store = createStore();
  if (store.has(key)) { console.log(`cached   ${id} ${key.slice(0, 12)}`); return; }
  const run = (cmd, args, env = process.env) => { const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`); };
  run(process.execPath, ['scripts/build-content.mjs', id]);
  const out = path.join(ROOT, 'site', 'build-snapshots', id);
  fs.rmSync(out, { recursive: true, force: true });
  run(path.join(ROOT, 'node_modules/.bin/docusaurus'), ['build', 'site', '--out-dir', path.relative(path.join(ROOT, 'site'), out)], { ...withHeap(), DOCS_SNAPSHOT: id });
  const broken = findBrokenLinks(out, { under: `${v.route}/` }).filter((b) => b.link.startsWith(`/${v.route}/`) || b.link.startsWith('/assets/'));
  if (broken.length) { for (const b of broken.slice(0, 50)) console.error(`${b.page}: ${b.link}`); throw new Error(`${id}: ${broken.length} broken link(s) inside the snapshot`); }
  const file = path.join(os.tmpdir(), `${key}.tgz`);
  tar('-czf', file, '-C', out, v.route, 'assets');
  store.put(key, file);
  console.log(`built    ${id} ${key.slice(0, 12)} ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
}

function assemble(liveDir, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(liveDir, outDir, { recursive: true });
  const store = createStore();
  const hashes = inputHashes();
  for (const v of snapshotVersions()) {
    const key = snapshotKey(v, hashes);
    if (!store.has(key)) throw new Error(`snapshot ${v.id} (${key.slice(0, 12)}) is missing: run \`node scripts/snapshots.mjs build ${v.id}\``);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
    const file = path.join(tmp, `${key}.tgz`);
    store.get(key, file);
    checkTarEntries(tar('-tzf', file).split('\n').filter(Boolean), v.route);
    const dir = path.join(tmp, 'x'); fs.mkdirSync(dir);
    tar('-xzf', file, '-C', dir, '--no-same-owner');
    copyNoOverwrite(dir, outDir);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`merged   ${v.id}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'list') {
    const hashes = inputHashes();
    const rows = snapshotVersions().map((v) => ({ id: v.id, key: snapshotKey(v, hashes) }));
    console.log(process.argv.includes('--json') ? JSON.stringify(rows) : rows.map((r) => `${r.id}\t${r.key}`).join('\n'));
  } else if (cmd === 'build' && a) build(a);
  else if (cmd === 'assemble' && a && b) assemble(path.resolve(a), path.resolve(b));
  else { console.error('Usage: node scripts/snapshots.mjs list [--json] | build <versionId> | assemble <liveDir> <outDir>'); process.exit(2); }
}
```

In `package.json`, add the scripts `"snapshots": "node scripts/snapshots.mjs"` and `"check-links": "node scripts/check-links.mjs"`. In `.gitignore`, add `site/build-snapshots/` and `site/build-merged/`.

- [ ] **Step 5: Test, then build every pilot snapshot locally**

Run:

```bash
cd docs-site && node --test scripts/test/
node scripts/snapshots.mjs list
for id in $(node scripts/snapshots.mjs list --json | node -e "process.stdin.on('data',d=>JSON.parse(d).forEach(r=>console.log(r.id)))"); do
  /usr/bin/time -l node scripts/snapshots.mjs build "$id" 2>&1 | tail -20
done
```

Expected:
- `list` prints 10 ids: `identity--v7-1-0` to `identity--v5-9-0`, and `integration-mi--v4-4-0` to `integration-mi--v4-2-0`.
- Each build prints `built … MB`, with time and maximum resident set size from `/usr/bin/time -l`. Record every figure in Task 13.
- A second run of the loop prints `cached` for all 10, unless files are dirty.
- If a snapshot fails its link check, the broken links belong to that version's own content. Add them to that version's exclude list (`npm run content -- <id>`; then consider `--prune` and `--onboard` semantics), or fix the converter if the cause is systemic.

- [ ] **Step 6: Assemble and check links on the merged site**

Run:

```bash
cd docs-site && DOCS_SECTIONS= npm run build:quick -- identity integration-mi && node scripts/snapshots.mjs assemble site/build-quick site/build-merged && node scripts/check-links.mjs site/build-merged --under identity && node scripts/check-links.mjs site/build-merged --under integration/micro-integrator
```

Expected: the assembly merges 10 snapshots, and both link checks report 0. Links from the pilot sections to non-pilot products are reported because the quick build leaves those products out. Run the same check over a full `npm run build` once before signing off Task 13.

- [ ] **Step 7: Commit**

```bash
git add docs-site/scripts/snapshot-store.mjs docs-site/scripts/snapshots.mjs docs-site/scripts/test/snapshots.test.mjs docs-site/package.json docs-site/.gitignore
git commit -m "docs-site: snapshot builds by key, local or GitHub Release store, assemble into one output"
```

---

### Task 11: Bump bot: Latest-only tracking, docs releases, promotion

**Files:**
- Create: `docs-site/scripts/bump-lib.mjs`
- Modify: `docs-site/scripts/bump-sources.mjs` (becomes a thin CLI)
- Modify: `docs-site/scripts/lib.mjs` (owner allow-list for local dry runs)
- Test: `docs-site/scripts/test/bump.test.mjs`

**Interfaces:**
- Produces:
  - `planBumps(lock, headOf): Bump[]`. It considers only refs with a non-null `track`.
  - `planDocsReleases(lock, { releasesOf, productReleasesOf, tagSha }): Proposal[]`. Each proposal is `{ type: 'fix' | 'new' | 'missing-product-release', section, version, base, tag, sha? }`.
  - `applyBumps(text, bumps): string`
  - `applyDocsRelease(text, proposal): string`
  - The CLI flags `--bumps` (content bumps plus `fix` proposals; auto-merge) and `--promotions` (`new` and `missing-product-release`, plus the legacy product-repo promotion for sections without `versions:`) keep their meaning.

- [ ] **Step 1: Write failing tests**

```js
// docs-site/scripts/test/bump.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBumps, planDocsReleases, applyDocsRelease } from '../bump-lib.mjs';

const S = (c) => c.repeat(40);
const lock = () => ({ live_window: 2, products: [{ id: 'integration', sections: [{
  id: 'integration-mi', route: 'integration/micro-integrator', kind: 'mkdocs', repo: 'wso2/docs-mi', mkdocs: 'en/mkdocs.yml',
  release_tag: 'v', product_repo: 'wso2/micro-integrator', former_site: 'https://mi.docs.wso2.com/en/{version}/',
  versions: [
    { version: '4.6.0', ref: '4.6.0', sha: S('a'), track: true },
    { version: '4.5.0', ref: '4.5.0', sha: S('b') },
    { version: '4.4.0', ref: 'v4.4.0', sha: S('c') },
  ],
}] }] });
const text = [
  '      - id: integration-mi',
  '        versions:',
  '          - version: 4.6.0',
  '            ref: 4.6.0',
  `            sha: ${S('a')}`,
  '            track: true',
  '            exclude: []',
  '          - version: 4.5.0',
  '            ref: 4.5.0',
  `            sha: ${S('b')}`,
  '            exclude: []',
  '          - version: 4.4.0',
  '            ref: v4.4.0',
  `            sha: ${S('c')}`,
  '            exclude: []',
  '',
].join('\n');

test('only Latest is bumped to its branch head', () => {
  const heads = { 'wso2/docs-mi#4.6.0': S('d') };
  const bumps = planBumps(lock(), (repo, branch) => { const h = heads[`${repo}#${branch}`]; if (!h) throw new Error(`asked for ${repo}#${branch}`); return h; });
  assert.deepEqual(bumps.map((b) => [b.repo, b.track, b.from, b.to]), [['wso2/docs-mi', '4.6.0', S('a'), S('d')]]);
});

const deps = (docsTags, productTags) => ({
  releasesOf: async () => docsTags.map((t) => ({ tag_name: t, draft: false, prerelease: false })),
  productReleasesOf: async () => productTags.map((t) => ({ tag_name: t, draft: false, prerelease: false })),
  tagSha: async (_repo, tag) => ({ 'v4.4.0.1': S('e'), 'v4.7.0': S('f'), 'v4.8.0': S('9') })[tag],
});

test('a fourth-segment docs release is a fix for that version', async () => {
  const props = await planDocsReleases(lock(), deps(['v4.4.0.1', 'v4.4.0'], ['v4.6.0']));
  assert.deepEqual(props, [{ type: 'fix', section: 'integration-mi', version: '4.4.0', base: '4.4.0', tag: 'v4.4.0.1', sha: S('e') }]);
  const out = applyDocsRelease(text, props[0]);
  assert.match(out, /- version: 4\.4\.0\n {12}ref: v4\.4\.0\.1\n {12}sha: e{40}\n/);
});

test('a newer docs release becomes Latest only when the product released it; Latest stops tracking', async () => {
  const props = await planDocsReleases(lock(), deps(['v4.7.0', 'v4.8.0', 'v4.7.0-rc1'], ['v4.7.0']));
  assert.deepEqual(props.map((p) => [p.type, p.version]), [['new', '4.7.0'], ['missing-product-release', '4.8.0']]);
  const out = applyDocsRelease(text, props[0]);
  assert.match(out, /versions:\n {10}- version: 4\.7\.0\n {12}ref: v4\.7\.0\n {12}sha: f{40}\n {12}exclude: \[\]\n {10}- version: 4\.6\.0\n {12}ref: 4\.6\.0\n {12}sha: a{40}\n {12}exclude: \[\]/);
  assert.doesNotMatch(out, /track: true/);
});

test('prereleases and drafts are ignored; tags of other components are ignored', async () => {
  const d = deps([], ['v4.7.0']);
  d.releasesOf = async () => [{ tag_name: 'v4.7.0', draft: true, prerelease: false }, { tag_name: 'v4.9.0', draft: false, prerelease: true }, { tag_name: 'api-gateway/v9.0.0', draft: false, prerelease: false }];
  assert.deepEqual(await planDocsReleases(lock(), d), []);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd docs-site && node --test scripts/test/bump.test.mjs`
Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `bump-lib.mjs`**

```js
// docs-site/scripts/bump-lib.mjs
// Bump planning, kept free of network calls so it can be tested: callers pass headOf, releasesOf, productReleasesOf, tagSha.
import { compareValues } from '@wso2/docs-converter';
import { refsOf } from './lib.mjs';
import { sectionVersions } from './versions.mjs';

export function planBumps(lock, headOf) {
  const heads = new Map();
  const bumps = [];
  for (const product of lock.products) for (const section of product.sections) for (const v of sectionVersions(section, lock.live_window ?? 2)) {
    for (const ref of refsOf(v)) {
      if (!ref.track) continue; // pinned (older versions, release refs)
      const key = `${ref.repo}#${ref.track}`;
      if (!heads.has(key)) heads.set(key, headOf(ref.repo, ref.track));
      const head = heads.get(key);
      if (head !== ref.sha && !bumps.some((b) => b.repo === ref.repo && b.from === ref.sha)) {
        bumps.push({ repo: ref.repo, track: ref.track, from: ref.sha, to: head, compare: `https://github.com/${ref.repo}/compare/${ref.sha}...${head}` });
      }
    }
  }
  return bumps;
}

export const applyBumps = (text, bumps) => bumps.reduce((t, b) => t.replaceAll(`sha: ${b.from}`, `sha: ${b.to}`), text);

const ga = (releases) => releases.filter((r) => !r.draft && !r.prerelease).map((r) => r.tag_name);

/** Docs releases: a fourth segment fixes a listed version; a newer version needs the product's own GA release. */
export async function planDocsReleases(lock, { releasesOf, productReleasesOf, tagSha }) {
  const proposals = [];
  for (const product of lock.products) for (const section of product.sections) {
    const list = section.versions ?? section.self_hosted?.versions;
    if (!list) continue;
    const repo = section.repo ?? section.self_hosted.repo;
    const productRepo = section.product_repo ?? section.self_hosted?.product_repo;
    const prefix = section.release_tag ?? 'v';
    const tags = ga(await releasesOf(repo)).filter((t) => t.startsWith(prefix))
      .map((t) => ({ tag: t, m: t.slice(prefix.length).match(/^(\d+\.\d+\.\d+)(?:\.(\d+))?$/) })).filter((x) => x.m)
      .map(({ tag, m }) => ({ tag, base: m[1], fix: Number(m[2] ?? 0) }));
    const latest = list[0].version;
    for (const v of list) {
      const current = v.ref.startsWith(`${prefix}${v.version}`) ? Number(v.ref.slice(`${prefix}${v.version}`.length + 1) || 0) : -1;
      const best = tags.filter((t) => t.base === v.version && t.fix > current).sort((a, b) => b.fix - a.fix)[0];
      if (best && (current >= 0 || best.fix > 0)) proposals.push({ type: 'fix', section: section.id, version: v.version, base: v.version, tag: best.tag, sha: await tagSha(repo, best.tag) });
    }
    const productTags = productRepo ? new Set(ga(await productReleasesOf(productRepo)).map((t) => t.replace(/^v/, ''))) : new Set();
    const newer = [...new Set(tags.filter((t) => compareValues(t.base, latest) > 0).map((t) => t.base))].sort(compareValues);
    for (const base of newer) {
      const tag = tags.filter((t) => t.base === base).sort((a, b) => b.fix - a.fix)[0].tag;
      if (productTags.has(base)) proposals.push({ type: 'new', section: section.id, version: base, base, tag, sha: await tagSha(repo, tag) });
      else proposals.push({ type: 'missing-product-release', section: section.id, version: base, base, tag });
    }
  }
  return proposals;
}

/** Edit the lock-file text for one proposal, keeping the hand-written layout. */
export function applyDocsRelease(text, p) {
  const start = text.indexOf(`- id: ${p.section}\n`);
  if (start < 0) throw new Error(`Section ${p.section} not found in the lock file`);
  const head = text.slice(0, start);
  let body = text.slice(start);
  if (p.type === 'fix') {
    const re = new RegExp(`(\\n( *)- version: ${p.version.replace(/\./g, '\\.')}\\n\\2  ref: )\\S+(\\n\\2  sha: )[0-9a-f]{40}`);
    if (!re.test(body)) throw new Error(`${p.section}: version ${p.version} not found`);
    return head + body.replace(re, `$1${p.tag}$3${p.sha}`);
  }
  if (p.type === 'new') {
    const m = /\n( *)versions:\n( *)- version: /.exec(body);
    if (!m) throw new Error(`${p.section}: versions list not found`);
    const item = m[2];
    const key = `${item}  `;
    body = body.replace(new RegExp(`\\n${key}track: true`), ''); // only Latest tracks, and a release is not followed
    const entry = `${item}- version: ${p.version}\n${key}ref: ${p.tag}\n${key}sha: ${p.sha}\n${key}exclude: []\n`;
    return head + body.replace(`\n${m[1]}versions:\n`, `\n${m[1]}versions:\n${entry}`);
  }
  throw new Error(`${p.type} proposals do not change the lock file`);
}
```

- [ ] **Step 4: Thin CLI**

Rewrite `bump-sources.mjs` to:
- Keep `headOf` and `github()` as they are.
- Call `planBumps(lock, headOf)` and `applyBumps`.
- Call `planDocsReleases` with:
  - `releasesOf: (repo) => github(\`repos/${repo}/releases?per_page=50\`).then((r) => r ?? [])`
  - `productReleasesOf` defined the same way
  - `tagSha`, which runs `git ls-remote https://github.com/<repo>.git refs/tags/<tag> refs/tags/<tag>^{}`, prefers the peeled `^{}` line and validates the sha against `/^[0-9a-f]{40}$/`. Validate the tag first against `/^[A-Za-z0-9._\/-]+$/`.
- With `--bumps`, apply bumps and `fix` proposals.
- With `--promotions`, apply `new` proposals, report `missing-product-release` proposals as `docsReady: false`, and keep the legacy product-repo promotion loop unchanged for sections without `versions:`.
- Output JSON in the shape `{ bumps, fixes, promotions }`. The `promotions` items keep `{ section, from, to, docsReady }`, so `docs-site-version-promotion.yml` needs only its messages changed (Task 12).

- [ ] **Step 5: Allow a fork for local dry runs only**

In `lib.mjs`, replace the `REPO` check with:

```js
const OWNERS = ['wso2', ...(process.env.CI ? [] : (process.env.DOCS_SITE_TEST_OWNER ?? '').split(',').filter((o) => /^[A-Za-z0-9-]+$/.test(o)))];
const repoOk = (repo) => { const [owner, name] = String(repo).split('/'); return OWNERS.includes(owner) && /^[A-Za-z0-9._-]+$/.test(name ?? ''); };
```

Use `if (!repoOk(ref.repo)) throw new Error(\`${s.id}: repo must be wso2/<name>, got ${ref.repo}\`)`. Make the same change to the repo check in `fetch-sources.mjs`, if it has one. CI never honours `DOCS_SITE_TEST_OWNER`.

- [ ] **Step 6: Run the tests and a read-only report**

Run: `cd docs-site && node --test scripts/test/ && node scripts/bump-sources.mjs`
Expected:
- The tests PASS.
- The report lists no bump for older MI and IS versions.
- The `fixes` and `promotions` lists are empty, because no docs repo publishes releases yet.
- Any bump for Latest MI points at the `4.6.0` head, not at main.

- [ ] **Step 7: Commit**

```bash
git add docs-site/scripts/bump-lib.mjs docs-site/scripts/bump-sources.mjs docs-site/scripts/lib.mjs docs-site/scripts/test/bump.test.mjs
git commit -m "docs-site: bump bot tracks Latest only and understands docs releases"
```

---

### Task 12: CI workflows and docs

**Files:**
- Create: `.github/workflows/docs-site-snapshots.yml`
- Modify: `.github/workflows/docs-site-ci.yml`, `docs-site-content-bump.yml`, `docs-site-version-promotion.yml`
- Create: `docs-site/CONTENT-RELEASES.md`
- Modify: `docs-site/README.md`, `docs-site/packages/docs-converter/README.md`
- Modify: `docs-site/packages/docs-converter/src/cli.ts` (`check --release-tag`)
- Test: `docs-site/packages/docs-converter/test/cli.test.ts`

- [ ] **Step 1: Snapshot workflow**

```yaml
# Build frozen versions (snapshots) whose key is not yet stored, as one matrix job each. Keys cover source commit,
# exclude list, converter and site chrome, so a theme change rebuilds every snapshot.
name: docs-site snapshots
on:
  push:
    branches: [main, docs-site-versions]
    paths: ['docs-site/**', '.github/workflows/docs-site-*.yml']
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: docs-site-snapshots
  cancel-in-progress: false
jobs:
  plan:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      matrix: ${{ steps.list.outputs.matrix }}
    defaults: { run: { working-directory: docs-site } }
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { persist-credentials: false }
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { node-version: 22, cache: npm, cache-dependency-path: docs-site/package-lock.json }
      - run: npm ci --ignore-scripts && npm run build:converter
      - id: list
        run: echo "matrix=$(node scripts/snapshots.mjs list --json)" >> "$GITHUB_OUTPUT"
  build:
    needs: plan
    if: needs.plan.outputs.matrix != '[]'
    runs-on: ubuntu-latest
    timeout-minutes: 45
    permissions:
      contents: write # upload release assets; this job only
    strategy:
      fail-fast: false
      max-parallel: 6
      matrix:
        snapshot: ${{ fromJSON(needs.plan.outputs.matrix) }}
    defaults: { run: { working-directory: docs-site } }
    env:
      SNAPSHOT_STORE: github-release:docs-site-snapshots
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { persist-credentials: false }
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { node-version: 22, cache: npm, cache-dependency-path: docs-site/package-lock.json }
      - run: npm ci --ignore-scripts
      - run: gh release view docs-site-snapshots --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1 || gh release create docs-site-snapshots --repo "$GITHUB_REPOSITORY" --prerelease --title "docs-site snapshots" --notes "Build output of frozen docs versions, by key. Do not edit."
      - run: npm run build:converter && node scripts/fetch-sources.mjs "${{ matrix.snapshot.id }}"
      - run: node scripts/snapshots.mjs build "${{ matrix.snapshot.id }}"
```

The `id` comes from our own lock file, and `versionId` limits it to `[A-Za-z0-9_-]`, so passing it as a quoted argument is safe.

- [ ] **Step 2: Assemble and link-check in CI**

In `docs-site-ci.yml`, after `npx docusaurus build site`, add:

```yaml
      - run: node scripts/snapshots.mjs assemble site/build site/build-merged
        env:
          SNAPSHOT_STORE: github-release:docs-site-snapshots
          GH_TOKEN: ${{ github.token }}
      - run: node scripts/check-links.mjs site/build-merged
```

Raise `timeout-minutes` to 90 until Task 13's measurements set it.

- [ ] **Step 3: Bump and promotion workflows**

- `docs-site-content-bump.yml`: the PR body lists `fixes` (docs fix releases) next to `bumps`. Read the JSON keys and change only the text.
- `docs-site-version-promotion.yml`:
  - Issue title: "Docs release ${to} for ${section} has no matching product release".
  - Issue body: "The docs repo published ${to}, but ${product_repo} has no GA release ${to}. Publish docs on or after the product's GA (see docs-site/CONTENT-RELEASES.md)."
  - PR body: "New version ${to} becomes Latest; ${from} stays live as the previous release; older versions become snapshots. Needs one approval from the ${section} docs team."

- [ ] **Step 4: `wso2-docs check --release-tag`**

Add a failing test in `test/cli.test.ts`. It runs `check` with `--release-tag v7.4.0 --version-folder en/identity-server/{version}` on a temp source that lacks `en/identity-server/7.4.0`, and expects the warning `release v7.4.0 has no folder en/identity-server/7.4.0` and exit 0. (It's a warning, per the docs-release convention decision.) Then implement it in `cli.ts`, using the existing argument parsing: take the version from the tag with `/^(?:.*\/)?v(\d+\.\d+\.\d+)(?:\.\d+)?$/`, substitute it into the folder pattern, and warn on stderr when `fs.existsSync(path.join(root, folder))` is false. Run `npm test -w @wso2/docs-converter`.

- [ ] **Step 5: Write `CONTENT-RELEASES.md`**

Write the convention from `.scratch/wso2-docs-site-versions/issues/05-docs-release-convention.md` for product teams:
- what a docs release is
- tag names, including `<component>/v<version>`
- fourth-segment fixes
- which PRs auto-merge and which need approval
- publish on or after product GA
- the version-folder rule
- existing versions keep their branch pins
- the `wso2-docs check --release-tag` usage

In `docs-site/README.md`, add a "Versions" section:
- the `versions:` schema in brief
- `live_window`
- `npm run snapshots -- list|build|assemble`
- `npm run check-links`
- `SNAPSHOT_STORE`

Also update the "How it works" table rows for the lock file, the bump bot and the new scripts.

- [ ] **Step 6: Run all tests and commit**

Run: `cd docs-site && npm test`
Expected: PASS.

```bash
git add .github/workflows docs-site/CONTENT-RELEASES.md docs-site/README.md docs-site/packages/docs-converter
git commit -m "docs-site: snapshot CI, merged link check, docs-release convention and check"
```

---

### Task 13: Pilot measurements, promotion dry run, sign-off

**Files:**
- Create: `.scratch/wso2-docs-site-versions/research/10-pilot-measurements.md`
- Modify: `.scratch/wso2-docs-site-versions/issues/10-build-the-pilot.md` (answer and status), `map.md` (decision line)

- [ ] **Step 1: Measure the live build**

Run each of these on a clean `site/.docusaurus`, one at a time, recording wall time and peak RSS (`/usr/bin/time -l`):

```bash
cd docs-site
/usr/bin/time -l npm run build 2>&1 | tail -25                       # every product, IS and MI at Latest + previous
sed -i '' 's/future: { v4: false }/future: { v4: true }/' site/docusaurus.config.js
rm -rf site/.docusaurus && /usr/bin/time -l npm run build 2>&1 | tail -25
git checkout site/docusaurus.config.js
```

Also record the page count, either from `find site/build -name index.html | wc -l` or from the build log. Extrapolate to every product at Latest plus the previous release: today's page count plus the previous release's page count for each versioned section, using the inventory's per-version page counts (`research/02-version-inventory.md`), scaled linearly from the measured time and memory per page.

- [ ] **Step 2: Apply the threshold**

If the extrapolated full live build exceeds 60 minutes or 14 GB, both with and without Faster, set `live_window: 1` in `content-sources.yaml`, rerun `npm run content -- identity integration-mi` and Task 10's build and assembly, and record the change. If Faster is the only way under the threshold, record that the pilot needs `future.v4: true`, and test it for the near-identical-MDX failure noted in `docusaurus.config.js`.

- [ ] **Step 3: Record snapshot and image figures**

For each of the 10 snapshots, record the build time, peak RSS and tarball size from Task 10 Step 5. Record the `generated/static` sizes before and after Task 8, and the total `site/build-merged` size.

- [ ] **Step 4: Promotion dry run (needs the user: creating a fork and a release is an outward-facing action)**

Ask the user to:
1. Fork `wso2/docs-mi` to their account, keeping branch `4.4.0`.
2. Publish a GA GitHub Release `v4.4.0.1` on the fork's `4.4.0` branch.

Then, locally and without pushing anything:

```bash
cd docs-site
cp content-sources.yaml /tmp/claude-lock-dry-run.yaml   # use the session scratchpad directory instead of /tmp
# In the copy, set integration-mi's repo to <user>/docs-mi.
DOCS_SITE_TEST_OWNER=<user> DOCS_SITE_LOCK=<copy> node scripts/bump-sources.mjs --bumps --write --json <scratch>/fix.json
diff content-sources.yaml <copy>
```

Expected: `fix.json` lists `{ type: 'fix', version: '4.4.0', tag: 'v4.4.0.1' }`. The diff shows 4.4.0's `ref` changing to `v4.4.0.1` and its `sha` to the release commit. Its snapshot key changes (`DOCS_SITE_LOCK=<copy> node scripts/snapshots.mjs list`). The diff is the content of the auto-merge PR. This repo has no remote, so no PR is opened. Record that as a limit.

Simulate a new version offline: in the copy, add a 4.7.0 entry at the top of `integration-mi`, using `ref: 4.6.0` and 4.6.0's sha as a stand-in, then remove `track: true` from 4.6.0. Run `DOCS_SITE_LOCK=<copy> node scripts/snapshots.mjs list` and `DOCS_SITE_LOCK=<copy> node -e "…sectionVersions…"`. Expected: 4.6.0 becomes `live` at `/integration/micro-integrator/4.6.0/`, and 4.5.0 joins the snapshot list. The unit test in Task 11 already covers the lock-text edit for `new`.

- [ ] **Step 5: Check the six pass criteria and record them**

Write `research/10-pilot-measurements.md`. It contains a table per criterion from `issues/08-pilot-sections.md` showing pass or fail with evidence (command, output excerpt, screenshot path), followed by the measurements and the live-window outcome. Check criterion 2 in a browser on `site/build-merged` served with `npx docusaurus serve site --dir build-merged`:
- Selector from Latest to a snapshot, keeping the page.
- From a snapshot back to Latest.
- From a snapshot to a Confluence version.
- From Identity Platform to Micro Integrator via the Products menu, while on a snapshot page.

- [ ] **Step 6: Resolve the ticket**

In `issues/10-build-the-pilot.md`, set `Status: resolved` and add an `## Answer` section with a 4 to 6 bullet gist linking the measurements file and the branch. Add a one-line pointer to `map.md` under "Decisions so far". The ticket "Rollout order and cut line" then becomes unblocked.

```bash
git add .scratch/wso2-docs-site-versions
git commit -m "Wayfinding: pilot results for every version of Identity Platform and Micro Integrator"
```

---

## Self-review notes

- **Spec coverage:** the six pass criteria map to tasks as follows.
  - Criterion 1 (URLs): Tasks 4 and 5.
  - Criterion 2 (selector and Confluence): Tasks 6 and 7.
  - Criterion 3 (schema and validator): Tasks 1 and 3.
  - Criterion 4 (link checks): Tasks 9 and 10.
  - Criterion 5 (measurements): Tasks 8, 10 and 13.
  - Criterion 6 (dry run): Tasks 11 and 13.

  Other decisions:
  - Latest rule for MI (ticket 01): Task 3.
  - Jinja fix (research 03): Task 2.
  - `former_site` (ticket 06): Tasks 1 and 4.
  - Convention document and check (ticket 05): Task 12.
  - Storage interface (ticket 07): Task 10.
- **Not covered, on purpose:**
  - Multi-component tags in docs-api-platform are only unit-tested, through `release_tag`, which is out of pilot scope.
  - Search, which belongs to the parent map.
  - The selector design, which comes from the ticket "Version selector design for many versions". Task 7 builds a functional selector, and the prototype's result replaces its presentation.
- **Deviation to confirm with the user:** the build architecture decision named `/assets/img/<hash>.<ext>`. This plan gets the same result (content-hashed images, stored once) from Docusaurus's own `assets/images/<name>-<hash>.<ext>` output plus the no-overwrite merge. That avoids a custom image store.
