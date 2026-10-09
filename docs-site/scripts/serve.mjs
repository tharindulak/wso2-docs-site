// Local preview of a built site, for example the merged output with snapshots. `docusaurus serve` (serve-handler)
// treats /identity/7.1.0/ as a file because of the dotted segment and returns 404; this server maps /x/ to
// x/index.html. Production hosting must do the same for dotted segments (nginx: try_files $uri $uri/index.html).
// Usage: node scripts/serve.mjs [dir=site/build-merged] [--port 3000]   Listens on 127.0.0.1 only.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.yaml': 'text/yaml; charset=utf-8', '.yml': 'text/yaml; charset=utf-8',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.zip': 'application/zip',
};

/** File to serve for a URL path, or null: /x/ -> x/index.html, /x -> x, x.html or x/index.html; never outside root. */
export function fileFor(root, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split(/[?#]/)[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  const base = path.resolve(root);
  const file = path.resolve(base, `.${p}`);
  if (file !== base && !file.startsWith(base + path.sep)) return null;
  const candidates = p.endsWith('/') ? [path.join(file, 'index.html')] : [file, `${file}.html`, path.join(file, 'index.html')];
  return candidates.find((f) => fs.statSync(f, { throwIfNoEntry: false })?.isFile()) ?? null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const port = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 3000;
  const root = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port') ?? 'site/build-merged');
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('--port must be 1-65535'); process.exit(2); }
  if (!fs.existsSync(root)) { console.error(`${root} does not exist`); process.exit(2); }
  http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const file = fileFor(root, req.url ?? '/');
    const notFound = path.join(root, '404.html');
    const send = (f, status) => {
      res.writeHead(status, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(f).pipe(res);
    };
    if (file) send(file, 200);
    else if (fs.existsSync(notFound)) send(notFound, 404);
    else res.writeHead(404).end();
  }).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`));
}
