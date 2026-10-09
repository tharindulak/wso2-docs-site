// Run Docusaurus with enough memory for the docs site. Node's default heap (about 4 GB) runs out building
// a few thousand pages ("JavaScript heap out of memory"). Default 8 GB; set DOCS_HEAP_MB to change it.
// An explicit --max-old-space-size in NODE_OPTIONS wins.
// Usage: node scripts/docusaurus.mjs <docusaurus arguments>   (for example: build site)
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function withHeap(env = process.env) {
  if (/--max-old-space-size=/.test(env.NODE_OPTIONS ?? '')) return env;
  const mb = Number(env.DOCS_HEAP_MB ?? 8192);
  if (!Number.isInteger(mb) || mb < 1024) throw new Error(`DOCS_HEAP_MB must be a whole number of megabytes (1024 or more), got ${env.DOCS_HEAP_MB}`);
  return { ...env, NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --max-old-space-size=${mb}`.trim() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bin = path.join(root, 'node_modules/.bin/docusaurus');
  const result = spawnSync(bin, process.argv.slice(2), { cwd: root, stdio: 'inherit', env: withHeap() });
  process.exit(result.status ?? 1);
}
