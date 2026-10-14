// PROTOTYPE, throwaway. Answers: "How should Step N.M sub-steps inside a stepper look on real Identity Platform pages?"
// Follow-up to the stepper on the map .scratch/wso2-docs-is-components (sub-steps, raised by the user 2026-10-14).
//
// Serves a built Identity preview (default: the docs-is-migrate worktree's site/build-preview, which already has the
// stepper) and injects substeps.css + substeps.ts into every page. substeps.ts reshapes sub-step headings in the browser; the site
// is not changed. substeps.ts reaches the browser as JS through Node's built-in type stripping, so there is no build step.
//
// Run (Node 22.18+):  node prototypes/substeps/serve.ts [build dir]     then open http://127.0.0.1:3026/__substeps/
import fs from 'node:fs';
import http from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileFor } from '../../docs-site/scripts/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(HERE, '../../.claude/worktrees/docs-is-migrate/docs-site/site/build-preview'));
const PORT = 3026;
const START = '/identity/references/tutorials/connect-with-ms-entra/?variant=A';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const INJECT = '<link rel="stylesheet" href="/__substeps/substeps.css"><script type="module" src="/__substeps/substeps.js"></script>';

if (!fs.existsSync(ROOT)) { console.error(`${ROOT} does not exist: build the Identity preview first`); process.exit(2); }

http.createServer((req, res) => {
  const url = req.url ?? '/';
  const pathname = url.split(/[?#]/)[0];
  if (pathname === '/__substeps/') { res.writeHead(302, { Location: START }).end(); return; }
  if (pathname === '/__substeps/substeps.css') {
    res.writeHead(200, { 'Content-Type': TYPES['.css'], 'Cache-Control': 'no-store' }).end(fs.readFileSync(path.join(HERE, 'substeps.css'), 'utf8'));
    return;
  }
  if (pathname === '/__substeps/substeps.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }).end(stripTypeScriptTypes(fs.readFileSync(path.join(HERE, 'substeps.ts'), 'utf8')));
    return;
  }
  const file = fileFor(ROOT, url);
  if (!file) { res.writeHead(404).end('not found'); return; }
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  if (type === TYPES['.html']) res.end(fs.readFileSync(file, 'utf8').replace('</head>', `${INJECT}</head>`));
  else fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Sub-steps prototype (${ROOT}): http://127.0.0.1:${PORT}/__substeps/`));
