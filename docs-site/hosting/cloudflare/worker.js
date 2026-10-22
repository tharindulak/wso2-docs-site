// Serves the docs site from the R2 bucket bound as SITE, with the URL mapping of scripts/serve.mjs:
// /x/ -> x/index.html (dotted segments such as /identity/7.1.0/ included); /x -> x or x.html, or a redirect to /x/
// when x/index.html exists (the site is built with trailingSlash: true). Anything else gets 404.html.
// Like the VM's web server it never publishes dot files or _search/ (README.md in the parent folder).
//
// Settings (wrangler.toml vars, or `wrangler secret put` for the key):
//   NOINDEX      "1": every response carries X-Robots-Tag noindex (the test site, as DOCS_NO_INDEX=1 builds)
//   SEARCH_URL   the public Typesense origin; with SEARCH_KEY, /search-config.json is answered from these
//   SEARCH_KEY   the search-only key (it is public: browsers send it), never the admin key
const HASHED = /^assets\//; // Docusaurus puts content-hashed files under /assets/, safe to cache for a year.
const HIDDEN = (key) => key.split('/').some((s) => s.startsWith('.')) || key === '_search' || key.startsWith('_search/');

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    let key;
    try { key = decodeURIComponent(url.pathname).replace(/^\/+/, ''); } catch { return notFound(env, request); }
    if (key.includes('\0') || key.split('/').includes('..') || HIDDEN(key)) return notFound(env, request);
    if (key === 'search-config.json' && env.SEARCH_URL && env.SEARCH_KEY) return searchConfig(env, request);

    if (key === '' || key.endsWith('/')) return (await serve(env, request, `${key}index.html`)) ?? notFound(env, request);
    const direct = (await serve(env, request, key)) ?? (await serve(env, request, `${key}.html`));
    if (direct) return direct;
    if (await env.SITE.head(`${key}/index.html`)) {
      url.pathname += '/';
      return Response.redirect(url.toString(), 301);
    }
    return notFound(env, request);
  },
};

function baseHeaders(env) {
  const headers = new Headers({ 'X-Content-Type-Options': 'nosniff' });
  if (env.NOINDEX === '1') headers.set('X-Robots-Tag', 'noindex, nofollow');
  return headers;
}

/** Response for one bucket key, or null when the key does not exist. Honours If-None-Match and friends. */
async function serve(env, request, key, status = 200) {
  const object = await env.SITE.get(key, { onlyIf: request.headers });
  if (!object) return null;
  const headers = baseHeaders(env);
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', status !== 200 || key.endsWith('.html') ? 'public, max-age=0, must-revalidate'
    : HASHED.test(key) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  if (!('body' in object)) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
}

async function notFound(env, request) {
  return (await serve(env, request, '404.html', 404)) ?? new Response('Not found', { status: 404, headers: baseHeaders(env) });
}

// The shape scripts/search-index.mjs writes and site/src/lib/search.mjs reads; the alias is always "docs".
function searchConfig(env, request) {
  const headers = baseHeaders(env);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'public, max-age=300');
  const body = JSON.stringify({ url: env.SEARCH_URL, key: env.SEARCH_KEY, collection: 'docs' });
  return new Response(request.method === 'HEAD' ? null : `${body}\n`, { headers });
}
