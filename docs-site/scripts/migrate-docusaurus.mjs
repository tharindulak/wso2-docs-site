// Write the Docusaurus tree a content source keeps once it migrates (docs-is: docusaurus/), from its pinned commit.
// Usage: node scripts/migrate-docusaurus.mjs <sectionId> <outDir> [--edit-branch <branch>]
//   Converts every version of the section with build-content.mjs (Latest with --partials), then writes the tree with
//   @wso2/docs-converter's writeDocusaurusTree. Until cutover the tree is generated only: rerun this, never hand-edit.
//   outDir must be empty, missing, or a tree this script wrote earlier (it is replaced). Honours DOCS_SITE_LOCK.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mkdocsSite, redirectMaps, writeDocusaurusTree } from '@wso2/docs-converter';
import { readLock, liveWindow, checkoutDir, GENERATED, ROOT } from './lib.mjs';
import { sectionVersions } from './versions.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const editBranch = flag('--edit-branch');
const [sectionId, outDir] = args;
if (!sectionId || !outDir) {
  console.error('usage: node scripts/migrate-docusaurus.mjs <sectionId> <outDir> [--edit-branch <branch>]');
  process.exit(2);
}

const lock = readLock();
const section = lock.products.flatMap((p) => p.sections).find((s) => s.id === sectionId);
if (!section) throw new Error(`No section ${sectionId} in the lock file`);
const versions = sectionVersions(section, liveWindow(lock));

// Convert: Latest by section id, older versions by version id (build-content skips snapshots it is not named).
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-content.mjs'), '--partials', ...versions.map((v) => v.id)], { stdio: 'inherit' });

/** MkDocs redirect_maps of the version's site(s); for a merged version the cloud site's entry wins. */
function redirectsOf(v) {
  const sites = v.kind === 'mkdocs-merge' ? [v.self_hosted, v.cloud] : [v];
  const maps = {};
  for (const src of sites) {
    const site = mkdocsSite(path.join(checkoutDir(src.repo, src.sha), src.mkdocs));
    for (const [from, to] of redirectMaps(site.config)) maps[from] = to;
  }
  return maps;
}

const staticDirOf = (v) => (v.status === 'latest' ? path.join(GENERATED, 'static', v.route) : path.join(GENERATED, 'static-versions', v.id, v.route));
const tree = versions.map((v) => ({
  version: v.version,
  route: v.route,
  docsDir: path.join(GENERATED, 'docs', v.id),
  staticDir: staticDirOf(v),
  sidebar: JSON.parse(fs.readFileSync(path.join(GENERATED, 'sidebars', `${v.id}.json`), 'utf8')),
  redirects: redirectsOf(v),
}));
writeDocusaurusTree(tree, path.resolve(outDir), { route: section.route, editBranch: editBranch ?? (section.cloud?.track ?? section.track) });
console.log(`Wrote ${path.resolve(outDir)}: Latest ${versions[0].version} and ${versions.length - 1} older version(s).`);
