// PROTOTYPE, throwaway. Answers: "How should closing sections ("What's next?", "Next steps", "See also", "Learn more") look on real
// Identity Platform pages: link cards, rows, an "up next" lead, or a plain box?"
// Ticket: .scratch/wso2-docs-is-components/issues/03-closing-sections-look.md
//
// Serves a built Identity preview (default: the docs-is-migrate worktree's site/build-preview, which already has the
// stepper) and injects closing.css + closing.ts into every page. closing.ts reshapes the section in the browser; the site
// is not changed. closing.ts reaches the browser as JS through Node's built-in type stripping, so there is no build step.
//
// Run (Node 22.18+):  node prototypes/closing-sections/serve.ts [build dir]     then open http://127.0.0.1:3023/__closing/
import fs from 'node:fs';
import http from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileFor } from '../../docs-site/scripts/serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(HERE, '../../.claude/worktrees/docs-is-migrate/docs-site/site/build-preview'));
const PORT = 3023;
const START = '/identity/guides/verifiable-credentials/oid4vci/?variant=A';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const INJECT = '<link rel="stylesheet" href="/__closing/closing.css"><script type="module" src="/__closing/closing.js"></script>';

if (!fs.existsSync(ROOT)) { console.error(`${ROOT} does not exist: build the Identity preview first`); process.exit(2); }

http.createServer((req, res) => {
  const url = req.url ?? '/';
  const pathname = url.split(/[?#]/)[0];
  if (pathname === '/__closing/') { res.writeHead(302, { Location: START }).end(); return; }
  if (pathname === '/__closing/closing.css') {
    res.writeHead(200, { 'Content-Type': TYPES['.css'], 'Cache-Control': 'no-store' }).end(fs.readFileSync(path.join(HERE, 'closing.css'), 'utf8'));
    return;
  }
  if (pathname === '/__closing/closing.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }).end(stripTypeScriptTypes(fs.readFileSync(path.join(HERE, 'closing.ts'), 'utf8')));
    return;
  }
  const file = fileFor(ROOT, url);
  if (!file) { res.writeHead(404).end('not found'); return; }
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  if (type === TYPES['.html']) res.end(fs.readFileSync(file, 'utf8').replace('</head>', `${INJECT}</head>`));
  else fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Closing sections prototype (${ROOT}): http://127.0.0.1:${PORT}/__closing/`));
