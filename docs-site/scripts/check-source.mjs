// Conformance check for a content repo (run in its CI or locally): converts every page of one or more
// MkDocs sites with the docs-site converter and fails on pages that would not make it into the site.
// Usage: node scripts/check-source.mjs --root <repo checkout> --mkdocs <path/to/mkdocs.yml> [--mkdocs ...]
//                                       [--exclude <file listing known failures, one docs-relative path per line>]
import fs from 'node:fs';
import path from 'node:path';
import { mkdocsSite } from '../converter/mkdocs-config.js';
import { loadPage, renderSingle } from '../converter/render.js';
import { convertRendered } from '../converter/page.js';

const args = process.argv.slice(2);
const values = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
const root = path.resolve(values('--root')[0] ?? '.');
const configs = values('--mkdocs');
const excludeFile = values('--exclude')[0];
if (!configs.length) { console.error('Give at least one --mkdocs <path to mkdocs.yml>'); process.exit(2); }
const known = new Set(excludeFile ? fs.readFileSync(excludeFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean) : []);

let failed = 0;
let fixed = 0;
for (const config of configs) {
  const site = mkdocsSite(path.join(root, config));
  const source = { root, includeBases: site.includeBases };
  const pages = fs.readdirSync(site.docsDir, { recursive: true }).filter((f) => f.endsWith('.md')).sort();
  let ok = 0;
  for (const rel of pages) {
    const file = path.join(site.docsDir, rel);
    try {
      const rendered = renderSingle(loadPage(file, source), { ...site.extra, config: site.config, base_path: '/x' }, file, source);
      await convertRendered(rendered, { deploymentOptions: [] });
      ok++;
      if (known.has(rel)) { fixed++; console.log(`fixed     ${rel} (remove it from the exclude list)`); }
    } catch (e) {
      if (known.has(rel)) continue;
      failed++;
      console.log(`FAIL      ${rel}\n          ${e.kind ?? 'template'}: ${e.message}`);
    }
  }
  console.log(`${config}: ${ok}/${pages.length} pages convert`);
}
if (fixed) console.log(`${fixed} page(s) on the exclude list now convert.`);
if (failed) { console.error(`${failed} page(s) fail and are not on the exclude list.`); process.exit(1); }
