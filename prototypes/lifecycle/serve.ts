// PROTOTYPE, throwaway. Answers two map tickets on real Identity Platform pages:
//   badge        "How the lifecycle badge looks" (.scratch/wso2-docs-is-components/issues/14-lifecycle-badge-look.md)
//   deprecation  "How deprecation notices and the Deprecations page look" (issues/15-deprecation-look.md)
// Serves a built Identity preview and injects <proto>.css + <proto>.ts into every page, plus /__lc/data.json: the
// lifecycle stages read from the fork's MkDocs source (data.ts), because the site does not carry them yet.
// /identity/deprecations/ redirects to an existing page with ?view=deprecations, whose article the script replaces
// (a path Docusaurus does not know would hydrate as its 404 page).
//
// Run (Node 22.18+):  node prototypes/lifecycle/serve.ts badge|deprecation [build dir]
//   badge        http://127.0.0.1:3024/__lc/
//   deprecation  http://127.0.0.1:3025/__lc/
import fs from 'node:fs';
import http from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileFor } from '../../docs-site/scripts/serve.mjs';
import { lifecycleData, SAMPLES } from './data.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const proto = process.argv[2];
if (proto !== 'badge' && proto !== 'deprecation') { console.error('usage: node serve.ts badge|deprecation [build dir]'); process.exit(2); }
const ROOT = path.resolve(process.argv[3] ?? path.join(HERE, '../../.claude/worktrees/docs-is-migrate/docs-site/site/build-preview'));
const EN = '/Users/admin/Documents/wso2/git/docs/en';
const PORT = proto === 'badge' ? 3024 : 3025;
const START = proto === 'badge' ? '/identity/guides/account-configurations/user-onboarding/self-registration-flow/?variant=A' : '/identity/apis/role-management/roles-v1-rest-api/?variant=A';
const SHELL = '/identity/references/wso2-identity-server-feature-deprecation/';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const INJECT = `<link rel="stylesheet" href="/__lc/${proto}.css"><script type="module" src="/__lc/${proto}.js"></script>`;

if (!fs.existsSync(ROOT)) { console.error(`${ROOT} does not exist: build the Identity preview first`); process.exit(2); }
const data = [...lifecycleData(EN, ROOT), ...(proto === 'badge' ? SAMPLES : [])];

http.createServer((req, res) => {
  const url = req.url ?? '/';
  const pathname = url.split(/[?#]/)[0];
  const send = (body: string | Buffer, type: string): void => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body); };
  if (pathname === '/__lc/') { res.writeHead(302, { Location: START }).end(); return; }
  if (pathname === '/__lc/data.json') { send(JSON.stringify(data), TYPES['.json']); return; }
  if (pathname === `/__lc/${proto}.css`) { send(fs.readFileSync(path.join(HERE, `${proto}.css`), 'utf8'), TYPES['.css']); return; }
  if (pathname === `/__lc/${proto}.js`) { send(stripTypeScriptTypes(fs.readFileSync(path.join(HERE, `${proto}.ts`), 'utf8')), TYPES['.js']); return; }
  if (proto === 'deprecation' && pathname === '/identity/deprecations/') {
    const q = new URLSearchParams(url.split('?')[1] ?? '');
    q.set('view', 'deprecations');
    res.writeHead(302, { Location: `${SHELL}?${q}` }).end();
    return;
  }
  const file = fileFor(ROOT, url);
  if (!file) { res.writeHead(404).end('not found'); return; }
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  if (type === TYPES['.html']) {
    send(fs.readFileSync(file, 'utf8').replace('</head>', `${INJECT}</head>`), type);
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Lifecycle ${proto} prototype (${ROOT}): http://127.0.0.1:${PORT}/__lc/`));
