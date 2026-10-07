// Quick build or dev server for some sections only: much faster than the full site while checking a change.
// Usage: node scripts/build-sections.mjs build|start <section or product id> ...
//   npm run build:quick -- integration            all Integration Platform sections, into site/build-quick
//   npm run start:quick -- identity api-platform-apim
// Run `npm run content -- <section ids>` first if the content changed. The full build stays `npm run build`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...ids] = process.argv.slice(2);
const manifestFile = path.join(root, 'generated/manifest.json');
if (!['build', 'start'].includes(command) || !ids.length) {
  console.error('Usage: node scripts/build-sections.mjs build|start <section or product id> ...');
  process.exit(2);
}
if (!fs.existsSync(manifestFile)) { console.error('Run `npm run content` first.'); process.exit(1); }

const { products } = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const sections = [];
for (const id of ids) {
  const product = products.find((p) => p.id === id);
  const matches = product ? product.sections.map((s) => s.id) : products.flatMap((p) => p.sections).filter((s) => s.id === id).map((s) => s.id);
  if (!matches.length) {
    console.error(`Unknown section or product: ${id}\nProducts: ${products.map((p) => p.id).join(', ')}\nSections: ${products.flatMap((p) => p.sections.map((s) => s.id)).join(', ')}`);
    process.exit(2);
  }
  sections.push(...matches);
}
console.log(`${command === 'build' ? 'Building' : 'Serving'} ${[...new Set(sections)].join(', ')}`);

const bin = path.join(root, 'node_modules/.bin/docusaurus');
const args = command === 'build' ? ['build', 'site', '--out-dir', 'build-quick'] : ['start', 'site'];
const result = spawnSync(bin, args, { cwd: root, stdio: 'inherit', env: { ...process.env, DOCS_SECTIONS: [...new Set(sections)].join(',') } });
process.exit(result.status ?? 1);
