// PROTOTYPE, throwaway. Answers: "Does an automatic stepper over runs of `Step N` headings feel right on real
// pages across products (IS, APIM `Step N -`, Integrator, restarts, sub-steps, skipped numbers)?"
// Ticket: .scratch/wso2-docs-elements/issues/09-automatic-stepper.md
//
// Serves the real built site (docs-site/site/build-merged) and injects stepper.css + stepper.ts into every page.
// stepper.ts does in the browser what the proposed remark plugin would do at build time; the site is not changed.
// stepper.ts reaches the browser as JS through Node's built-in type stripping, so there is no build step.
//
// Run (Node 22.18+):  node prototypes/stepper/serve.ts     then open http://127.0.0.1:3021/__stepper/
import fs from 'node:fs';
import http from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileFor } from '../../docs-site/scripts/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../docs-site/site/build-merged');
const PORT = 3021;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const INJECT = '<link rel="stylesheet" href="/__stepper/stepper.css"><script type="module" src="/__stepper/stepper.js"></script>';

if (!fs.existsSync(ROOT)) { console.error(`${ROOT} does not exist: build the merged site first`); process.exit(2); }

/** The prototype's own files: /__stepper/ (index), stepper.css, and stepper.js (stripped from stepper.ts). */
function own(urlPath: string): { body: string; type: string } | null {
  const name = urlPath.match(/^\/__stepper\/(.*)$/)?.[1];
  if (name === undefined) return null;
  if (name === 'stepper.css') return { body: fs.readFileSync(path.join(HERE, name), 'utf8'), type: TYPES['.css'] };
  if (name === 'stepper.js') return { body: stripTypeScriptTypes(fs.readFileSync(path.join(HERE, 'stepper.ts'), 'utf8')), type: TYPES['.js'] };
  if (name === '') return { body: '', type: 'redirect' };
  return null;
}

http.createServer((req, res) => {
  const url = req.url ?? '/';
  const pathname = url.split(/[?#]/)[0];
  if (pathname.startsWith('/__stepper/')) {
    const hit = own(pathname);
    if (!hit) { res.writeHead(404).end('not found'); return; }
    // The first sample page is the start page; the bar on every page lists the rest.
    if (hit.type === 'redirect') { res.writeHead(302, { Location: '/identity/connectors/password-reset-enforcer/set-up/?variant=A' }).end(); return; }
    res.writeHead(200, { 'Content-Type': hit.type, 'Cache-Control': 'no-store' }).end(hit.body);
    return;
  }
  const file = fileFor(ROOT, url);
  if (!file) { res.writeHead(404).end('not found'); return; }
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  if (type === TYPES['.html']) res.end(fs.readFileSync(file, 'utf8').replace('</head>', `${INJECT}</head>`));
  else fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Stepper prototype: http://127.0.0.1:${PORT}/__stepper/`));
