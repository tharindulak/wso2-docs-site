// Write the Docusaurus tree a content source keeps once it migrates (docs-is: docusaurus/), from its pinned commit.
// Usage: node scripts/migrate-docusaurus.mjs <sectionId> <outDir> [--edit-branch <branch>] [--every-include]
//   Converts every version of the section with build-content.mjs (Latest with --partials; no site-made pages such as
//   Deprecations, which the site builds from the tree), then writes the tree with
//   @wso2/docs-converter's writeDocusaurusTree. Until cutover the tree is generated only: rerun this, never hand-edit.
//   outDir must be empty, missing, or a tree this script wrote earlier (it is replaced). Honours DOCS_SITE_LOCK.
//   Writes generated/tree-review.txt beside the content report: nested Steps a writer should review (file:line).
//   --every-include: Latest of a MkDocs section writes every stand-alone include as a partial, not only shared ones.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { mkdocsSite, redirectMaps, writeDocusaurusTree } from '@wso2/docs-converter';
import { readLock, liveWindow, checkoutDir, GENERATED, ROOT } from './lib.mjs';
import { sectionVersions } from './versions.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const editBranch = flag('--edit-branch');
const everyInclude = args.includes('--every-include');
if (everyInclude) args.splice(args.indexOf('--every-include'), 1);
const [sectionId, outDir] = args;
if (!sectionId || !outDir) {
  console.error('usage: node scripts/migrate-docusaurus.mjs <sectionId> <outDir> [--edit-branch <branch>] [--every-include]');
  process.exit(2);
}

const lock = readLock();
const section = lock.products.flatMap((p) => p.sections).find((s) => s.id === sectionId);
if (!section) throw new Error(`No section ${sectionId} in the lock file`);
const versions = sectionVersions(section, liveWindow(lock));

// Convert: Latest by section id, older versions by version id (build-content skips snapshots it is not named).
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-content.mjs'), '--partials', ...(everyInclude ? ['--every-include'] : []), '--source-tree', ...versions.map((v) => v.id)], { stdio: 'inherit' });

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

/** The branch "Edit this page" opens: the section's tracked branch, else Latest's when it tracks one (versions on branches). */
const editBranchOf = (section, versions) => section.cloud?.track ?? section.track ?? versions[0]?.track ?? undefined;

const staticDirOf = (v) => (v.status === 'latest' ? path.join(GENERATED, 'static', v.route) : path.join(GENERATED, 'static-versions', v.id, v.route));
const tree = versions.map((v) => ({
  version: v.version,
  route: v.route,
  docsDir: path.join(GENERATED, 'docs', v.id),
  staticDir: staticDirOf(v),
  sidebar: JSON.parse(fs.readFileSync(path.join(GENERATED, 'sidebars', `${v.id}.json`), 'utf8')),
  redirects: redirectsOf(v),
}));
const { review } = writeDocusaurusTree(tree, path.resolve(outDir), { route: section.route, editBranch: editBranch ?? editBranchOf(section, versions) });
console.log(`Wrote ${path.resolve(outDir)}: Latest ${versions[0].version} and ${versions.length - 1} older version(s).`);
// Not in the tree: the tree holds pages only.
const reviewFile = path.join(GENERATED, 'tree-review.txt');
fs.writeFileSync(reviewFile, [
  `# ${sectionId}: nested <Steps> whose last sub-step is followed by text (the rewrite closed the nested </Steps> at the`,
  '# next heading). Check whether the text before </Steps> at each line belongs to the parent step; if so, move </Steps> up.',
  ...review.map((r) => `${r.file}:${r.line}`), '',
].join('\n'));
console.log(`Sub-step review: ${review.length} nested <Steps> listed in ${path.relative(process.cwd(), reviewFile)}.`);
