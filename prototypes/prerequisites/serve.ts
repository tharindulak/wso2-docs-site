// PROTOTYPE, throwaway. Answers: "How should the prerequisites block look on real Identity Platform pages, for both
// source forms (## Prerequisites / ## Before you begin headings, and :::note[Before you begin] admonitions)?"
// Ticket: .scratch/wso2-docs-is-components/issues/02-prerequisites-look.md
//
// Serves a built Identity preview (default: the docs-is-migrate worktree's site/build-preview, which already has the
// stepper) and injects prereq.css + prereq.ts into every page. prereq.ts reshapes the block in the browser; the site
// is not changed. prereq.ts reaches the browser as JS through Node's built-in type stripping, so there is no build step.
//
// Run (Node 22.18+):  node prototypes/prerequisites/serve.ts [build dir]     then open http://127.0.0.1:3022/__prereq/
import fs from 'node:fs';
import http from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileFor } from '../../docs-site/scripts/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(HERE, '../../.claude/worktrees/docs-is-migrate/docs-site/site/build-preview'));
const PORT = 3022;
const START = '/identity/guides/authentication/mfa/add-push-auth-login/?variant=A';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const INJECT = '<link rel="stylesheet" href="/__prereq/prereq.css"><script type="module" src="/__prereq/prereq.js"></script>';

if (!fs.existsSync(ROOT)) { console.error(`${ROOT} does not exist: build the Identity preview first`); process.exit(2); }

http.createServer((req, res) => {
  const url = req.url ?? '/';
  const pathname = url.split(/[?#]/)[0];
  if (pathname === '/__prereq/') { res.writeHead(302, { Location: START }).end(); return; }
  if (pathname === '/__prereq/prereq.css') {
    res.writeHead(200, { 'Content-Type': TYPES['.css'], 'Cache-Control': 'no-store' }).end(fs.readFileSync(path.join(HERE, 'prereq.css'), 'utf8'));
    return;
  }
  if (pathname === '/__prereq/prereq.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }).end(stripTypeScriptTypes(fs.readFileSync(path.join(HERE, 'prereq.ts'), 'utf8')));
    return;
  }
  const file = fileFor(ROOT, url);
  if (!file) { res.writeHead(404).end('not found'); return; }
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  if (type === TYPES['.html']) res.end(fs.readFileSync(file, 'utf8').replace('</head>', `${INJECT}</head>`));
  else fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Prerequisites prototype (${ROOT}): http://127.0.0.1:${PORT}/__prereq/`));
