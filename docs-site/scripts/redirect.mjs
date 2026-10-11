// Section-root redirect page. These two definitions are copied verbatim from build-content.mjs, which cannot import
// them: that file is in the snapshot key (CHROME), so editing it would rebuild every snapshot. A test keeps them equal.
import fs from 'node:fs';
import path from 'node:path';

export const REDIRECT_MARK = '<!-- wso2-docs: section root redirect -->';
const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const redirectHtml = (target) => { const to = escapeHtml(target); return `<!doctype html>\n${REDIRECT_MARK}\n<html lang="en"><head><meta charset="utf-8"><title>Redirecting</title><meta http-equiv="refresh" content="0; url=${to}"><link rel="canonical" href="${to}"><meta name="robots" content="noindex"></head>\n<body><p><a href="${to}">Continue to the documentation</a></p></body></html>\n`; };

/** A landing page path that stays inside the section: relative, no "..", no ":" (scheme), no backslash. */
export const safeHome = (home) => typeof home === 'string' && home !== '' && !home.startsWith('/') && !home.includes(':') && !home.includes('\\') && !home.split('/').includes('..');

/**
 * A snapshot with no index page gets /<route>/index.html redirecting to the home page in its pages.json, so the
 * version selector's link to the version root lands. Returns true when written.
 */
export function writeSnapshotRootRedirect(outDir, route, warn = console.warn) {
  const index = path.join(outDir, route, 'index.html');
  if (fs.existsSync(index)) return false;
  const pagesFile = path.join(outDir, route, 'pages.json');
  if (!fs.existsSync(pagesFile)) return false;
  const { home } = JSON.parse(fs.readFileSync(pagesFile, 'utf8'));
  if (home === undefined || home === null || home === '') return false;
  if (!safeHome(home)) { warn(`skipped root redirect for /${route}/: unsafe home ${JSON.stringify(home)}`); return false; }
  fs.writeFileSync(index, redirectHtml(`/${route}/${home}`));
  return true;
}

/** Every versions.json entry with a path (except those of pending snapshots) must have a page at its root; throws listing the rest. */
export function checkVersionRoots(outDir, pendingPaths = new Set()) {
  const missing = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'versions.json') {
        for (const v of JSON.parse(fs.readFileSync(p, 'utf8')).versions ?? []) {
          if (!v.path || pendingPaths.has(v.path)) continue;
          if (!fs.existsSync(path.join(outDir, v.path, 'index.html'))) missing.push(`${v.path} (${path.relative(outDir, p)})`);
        }
      }
    }
  };
  walk(outDir);
  if (missing.length) throw new Error(`version roots without an index page:\n  ${missing.join('\n  ')}`);
}
