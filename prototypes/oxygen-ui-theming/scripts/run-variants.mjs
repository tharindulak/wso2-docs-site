// PROTOTYPE: build all three variants (production SSR builds) and serve them on 3001-3003.
import { spawnSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
const ports = { A: 3001, B: 3002, C: 3003 };
const only = process.argv[2]?.split(',') ?? Object.keys(ports);
for (const v of only) {
  // Webpack's persistent cache ignores VARIANT, so clear it between builds.
  rmSync('node_modules/.cache', { recursive: true, force: true }); rmSync('.docusaurus', { recursive: true, force: true });
  const r = spawnSync('npx', ['docusaurus', 'build', '--out-dir', `build-${v}`], { stdio: 'inherit', env: { ...process.env, VARIANT: v, SHOW_SWITCHER: '1' } });
  if (r.status !== 0) process.exit(r.status);
}
if (process.env.BUILD_ONLY) process.exit(0);
for (const v of only) {
  spawn('npx', ['docusaurus', 'serve', '--dir', `build-${v}`, '--port', String(ports[v]), '--no-open'], { stdio: 'inherit', env: { ...process.env, VARIANT: v } });
  console.log(`Variant ${v}: http://localhost:${ports[v]}/identity/`);
}
