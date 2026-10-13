// PROTOTYPE (throwaway): which docs-is includes could become one MDX partial in the unified Latest?
// Runs a hooked copy of the converter (./converter, patched merge.js/render.js/site.js) over Asgardeo + IS 7.3.0
// and records every include as it is rendered. Usage: node survey.mjs <docs-is checkout> <scratch out dir>
import fs from 'node:fs';
import path from 'node:path';
import { convertMergedSites, githubEditUrl } from './converter/index.js';

const [root, outDir] = process.argv.slice(2);
if (!root || !outDir) { console.error('usage: node survey.mjs <docs-is checkout> <scratch out dir>'); process.exit(2); }

const occ = new Map(); // include file -> occurrences
const inFence = (s) => (s.match(/^[ \t]*(```|~~~)/gm) ?? []).length % 2 === 1;
globalThis.__incHook = ({ mode, from, target, before, text }) => {
  const page = globalThis.__page ?? {};
  const lastLine = before.slice(before.lastIndexOf('\n') + 1);
  const o = {
    page: page.rel, pageOptions: (page.options ?? []).length === 2 ? 'both' : page.options?.[0],
    mode, // merged: rendered once for both options; single: one option only
    nested: !from.includes('/docs/'), // included from another include
    midLine: /\S/.test(lastLine), inCode: inFence(before),
    text: text.split('\n').map((l) => l.trim()).join('\n').trim(),
  };
  const key = path.relative(root, target);
  if (!occ.has(key)) occ.set(key, []);
  occ.get(key).push(o);
};

const side = (mkdocs) => ({ root, mkdocs, currentSite: '', editUrl: githubEditUrl('wso2/docs-is', 'HEAD', root) });
fs.rmSync(outDir, { recursive: true, force: true });
await convertMergedSites({ cloud: side('en/asgardeo/mkdocs.yml'), self: side('en/identity-server/7.3.0/mkdocs.yml'), sharedNames: { product_name: 'WSO2 Identity Platform' } },
  { outDir: path.join(outDir, 'docs'), route: 'identity', exclude: [] });

// Classify each include file by what a partial would need.
const rows = [];
for (const [file, list] of occ) {
  const pages = new Set(list.map((o) => o.page));
  const block = list.filter((o) => !o.midLine && !o.inCode);
  const variants = new Set(block.map((o) => o.text));
  const merged = block.filter((o) => o.mode === 'merged');
  const mergedVariants = new Set(merged.map((o) => o.text));
  let kind;
  if (list.some((o) => o.midLine || o.inCode)) kind = 'inline: used inside a line or code';
  else if (pages.size < 2) kind = 'inline: one page';
  else if (variants.size === 1) kind = 'partial: identical everywhere';
  else if (mergedVariants.size === 1 && merged.length === block.length) kind = 'partial: identical everywhere';
  else if (variants.size <= 2 && new Set(list.map((o) => o.pageOptions)).size > 1) kind = 'partial per option: differs only between merged and one-option pages';
  else kind = 'inline: differs by page (wrapper sets or nesting)';
  rows.push({ file, kind, pages: pages.size, uses: list.length, variants: variants.size, nested: list.every((o) => o.nested), bytes: (list[0]?.text.length ?? 0) });
}
const by = {};
for (const r of rows) { by[r.kind] ??= { files: 0, uses: 0, kb: 0 }; by[r.kind].files++; by[r.kind].uses += r.uses; by[r.kind].kb += (r.bytes * r.uses) / 1024; }
const report = { includes: rows.length, totalUses: rows.reduce((a, r) => a + r.uses, 0), byKind: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { ...v, kb: Math.round(v.kb) }])),
  topPartials: rows.filter((r) => r.kind.startsWith('partial: identical')).sort((a, b) => b.pages - a.pages).slice(0, 10),
  topVarying: rows.filter((r) => r.kind.startsWith('inline: differs')).sort((a, b) => b.pages - a.pages).slice(0, 10) };
fs.writeFileSync(path.join(outDir, 'survey.json'), JSON.stringify({ report, rows, occurrences: Object.fromEntries([...occ].map(([k, v]) => [k, v.map(({ text, ...rest }) => ({ ...rest, chars: text.length }))])) }, null, 2));
console.log(JSON.stringify(report, null, 2));
