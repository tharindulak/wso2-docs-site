import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CHROME, CONVERTER, nodeMajor, inputHashes, navHash, treeHash, snapshotKey, checkTarEntries, checkTarTypes, tar, newBrokenLinks, withoutTokens } from '../snapshots.mjs';
import { createStore } from '../snapshot-store.mjs';
import { REDIRECT_MARK, writeSnapshotRootRedirect, checkVersionRoots, sectionRoutes } from '../redirect.mjs';

const v = { id: 'integration-mi--v4-4-0', repo: 'wso2/docs-mi', sha: 'c'.repeat(40), mkdocs: 'en/mkdocs.yml', exclude: [], route: 'integration/micro-integrator/4.4.0' };
const h = { converter: 't1', chrome: 't2' };

test('snapshot key changes with source, exclude list, converter and chrome', () => {
  const k = snapshotKey(v, h);
  assert.match(k, /^[0-9a-f]{64}$/);
  assert.equal(snapshotKey({ ...v }, { ...h }), k, 'deterministic');
  for (const changed of [snapshotKey({ ...v, sha: 'd'.repeat(40) }, h), snapshotKey({ ...v, exclude: ['a.md'] }, h),
    snapshotKey(v, { ...h, converter: 'x' }), snapshotKey(v, { ...h, chrome: 'x' }), snapshotKey(v, { ...h, nav: 'n1' })]) assert.notEqual(changed, k);
});

test('unsafe tar entries are refused', () => {
  const route = 'integration/micro-integrator/4.4.0';
  assert.doesNotThrow(() => checkTarEntries(['integration/micro-integrator/4.4.0/index.html', 'assets/js/main.1.js'], route));
  for (const bad of ['/etc/passwd', '../x', 'integration/micro-integrator/4.5.0/index.html', 'index.html', 'assets/../../x'])
    assert.throws(() => checkTarEntries([bad], route), /unsafe snapshot entry/);
});

test('local store keeps files by key and refuses malformed keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));
  const store = createStore(`local:${dir}`);
  const key = 'a'.repeat(64);
  const src = path.join(dir, 'in.tgz'); fs.writeFileSync(src, 'TAR');
  assert.equal(store.has(key), false);
  store.put(key, src);
  assert.equal(store.has(key), true);
  const dest = path.join(dir, 'out.tgz'); store.get(key, dest);
  assert.equal(fs.readFileSync(dest, 'utf8'), 'TAR');
  assert.throws(() => store.has('../x'), /invalid snapshot key/);
});

test('only broken links missing from the baseline fail the build', () => {
  const a = { page: 'identity/7.1.0/x/index.html', link: '/identity/7.1.0/gone/' };
  const b = { page: 'identity/7.1.0/y/index.html', link: '/identity/7.1.0/gone/' };
  const c = { page: 'identity/7.1.0/x/index.html', link: '/assets/files/z.png/' };
  assert.deepEqual(newBrokenLinks([a, b, c], [a, c]), [b], 'matched by page and link together');
  assert.deepEqual(newBrokenLinks([a], []), [a], 'no baseline: every broken link is new');
  assert.deepEqual(newBrokenLinks([], [a]), [], 'fixed links are not an error');
});

test('navigation hash ignores versions but follows names, groups, section labels and link-outs', () => {
  const base = { id: 'a', name: 'A', group: 'G', sections: [{ id: 's', label: 'S', route: 'a/s', versions: [{ version: '1' }] }] };
  const hash = (p, link_out = []) => navHash({ products: [p], link_out });
  const h0 = hash(base);
  assert.equal(hash({ ...base, sections: [{ ...base.sections[0], versions: [{ version: '2' }] }] }), h0);
  for (const h of [hash({ ...base, name: 'B' }), hash({ ...base, group: 'H' }), hash({ ...base, sections: [{ ...base.sections[0], label: 'T' }] }),
    hash(base, [{ id: 'x', name: 'X', group: 'G', href: 'https://x' }])]) assert.notEqual(h, h0);
});

test('snapshot key covers every inherited lock field but not the other versions', () => {
  const k = snapshotKey(v, h);
  for (const extra of [{ sparse: ['en'] }, { nav_root: 'Docs' }, { nav_drop: ['X'] }, { nav_pick: { a: 'b' } }, { only: 'a/' }, { skip: ['b/'] },
    { former_site: 'https://x/en/{version}/' }, { current_site: 'https://x/en/4.4.0/' }]) assert.notEqual(snapshotKey({ ...v, ...extra }, h), k, Object.keys(extra)[0]);
  assert.equal(snapshotKey({ ...v, versions: [{ version: '4.6.0', sha: 'f'.repeat(40) }], older_versions: 'https://x' }, h), k, 'other versions and Confluence links are not inputs');
  assert.equal(snapshotKey({ ...v, exclude: ['b.md', 'a.md'] }, h), snapshotKey({ ...v, exclude: ['a.md', 'b.md'] }, h), 'exclude order');
  const { id, ...rest } = v;
  assert.equal(snapshotKey({ ...rest, id }, h), k, 'field order');
});

test('navigation hash follows blurbs and the group list', () => {
  const base = { id: 'a', name: 'A', group: 'G', blurb: 'One', sections: [] };
  const h0 = navHash({ groups: ['G'], products: [base] });
  assert.notEqual(navHash({ groups: ['G'], products: [{ ...base, blurb: 'Two' }] }), h0);
  assert.notEqual(navHash({ groups: ['G', 'H'], products: [base] }), h0);
});

test('tar entries must be regular files or directories', () => {
  assert.doesNotThrow(() => checkTarTypes(['-rw-r--r--  0 u g 3 Oct 10 12:00 a/index.html', 'drwxr-xr-x  0 u g 0 Oct 10 12:00 a/']));
  for (const bad of ['lrwxr-xr-x  0 u g 0 Oct 10 12:00 a/x -> /etc/passwd', 'hrw-r--r--  0 u g 0 Oct 10 12:00 a/y link to a/x', 'crw-r--r-- 0 u g 0 a/dev'])
    assert.throws(() => checkTarTypes([bad]), /unsafe snapshot entry type/);
  assert.doesNotThrow(() => checkTarEntries(['.snapshot-key', './.snapshot-key'], 'identity/7.1.0'));
});

test('content steps run without repository tokens', () => {
  const env = withoutTokens({ PATH: '/bin', GH_TOKEN: 'x', GITHUB_TOKEN: 'y', ACTIONS_RUNTIME_TOKEN: 'z', DOCS_HEAP_MB: '1' });
  assert.deepEqual(env, { PATH: '/bin', DOCS_HEAP_MB: '1' });
});

test('the chrome hash covers site/account, account-sidebars.js and site/static (they feed snapshot builds)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: dir, stdio: 'pipe' });
  const write = (f, c) => { fs.mkdirSync(path.dirname(path.join(dir, 'docs-site', f)), { recursive: true }); fs.writeFileSync(path.join(dir, 'docs-site', f), c); };
  const paths = ['site/account', 'site/account-sidebars.js', 'site/static'];
  for (const p of paths) assert.ok(CHROME.includes(p), `${p} is part of the chrome key`);
  git('init', '-q');
  write('site/account/index.md', 'a'); write('site/account-sidebars.js', 'b'); write('site/static/logo.svg', 'c');
  git('add', '.'); git('commit', '-qm', 'one');
  const base = treeHash(paths, dir);
  assert.equal(treeHash(paths, dir), base, 'deterministic when clean');
  for (const f of ['site/account/index.md', 'site/account-sidebars.js', 'site/static/logo.svg']) {
    write(f, 'changed');
    assert.notEqual(treeHash(paths, dir), base, `${f} (uncommitted)`);
    git('commit', '-qam', f);
    assert.notEqual(treeHash(paths, dir), base, `${f} (committed)`);
    assert.doesNotMatch(treeHash(paths, dir), /dirty/);
    const next = treeHash(paths, dir);
    write(f, 'c' + f); git('commit', '-qam', 'again');
    assert.notEqual(treeHash(paths, dir), next);
  }
  fs.rmSync(path.join(dir, 'docs-site/site/static'), { recursive: true }); git('commit', '-qam', 'rm');
  assert.match(treeHash(paths, dir), /absent$/, 'a path absent at HEAD hashes without throwing');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('treeHash sees dirty and untracked edits when root is the docs-site directory (the real caller shape)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-sub-'));
  const root = path.join(repo, 'docs-site');
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: repo, stdio: 'pipe' });
  fs.mkdirSync(path.join(root, 'site/static'), { recursive: true });
  fs.writeFileSync(path.join(root, 'site/account-sidebars.js'), 'a');
  fs.writeFileSync(path.join(root, 'site/static/logo.svg'), 'a');
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'one');
  const paths = ['site/account-sidebars.js', 'site/static'];
  const clean = treeHash(paths, root);
  assert.equal(treeHash(paths, root), clean);
  fs.writeFileSync(path.join(root, 'site/account-sidebars.js'), 'edited');
  assert.match(treeHash(paths, root), /dirty/, 'modified tracked file');
  git('checkout', '--', '.');
  assert.equal(treeHash(paths, root), clean);
  fs.writeFileSync(path.join(root, 'site/static/new.svg'), 'x');
  assert.match(treeHash(paths, root), /dirty/, 'untracked file');
  fs.rmSync(repo, { recursive: true, force: true });
});

test('a component snapshot key covers the lock fields its cross-section links read; other keys do not change', async () => {
  const { readLock, liveWindow } = await import('../lib.mjs');
  const { sectionVersions, outsideLinkInputs } = await import('../versions.mjs');
  const keys = (lock) => Object.fromEntries(lock.products.flatMap((p) => p.sections.flatMap((s) => sectionVersions(s, liveWindow(lock))))
    .filter((x) => x.status === 'snapshot').map((x) => [x.id, snapshotKey(x, { ...h, links: outsideLinkInputs(lock, x) })]));
  const lock = readLock();
  const before = keys(lock);
  const section = (l, id) => l.products.flatMap((p) => p.sections).find((s) => s.id === id);
  const grown = structuredClone(lock);
  section(grown, 'api-platform-api-gateway').versions.unshift({ version: '1.3.0', ref: 'main', sha: 'f'.repeat(40), track: true });
  const after = keys(grown);
  assert.notEqual(after['api-platform-ai-gateway--v1-2-0'], before['api-platform-ai-gateway--v1-2-0'], 'another component released');
  assert.equal(after['integration-mi--v4-5-0'], before['integration-mi--v4-5-0'], 'unrelated section');
  assert.equal(after['identity--v7-2-0'], before['identity--v7-2-0'], 'unrelated section');
  const reskipped = structuredClone(lock);
  section(reskipped, 'api-platform-platform').skip.push('tools/');
  assert.notEqual(keys(reskipped)['api-platform-ai-gateway--v1-1-0'], before['api-platform-ai-gateway--v1-1-0'], 'the platform section skips more');
  const companion = structuredClone(lock);
  section(companion, 'api-platform-apim').cloud_companion.path_prefix = 'cloud-docs';
  assert.notEqual(keys(companion)['api-platform-api-gateway--v1-0-0'], before['api-platform-api-gateway--v1-0-0'], 'the companion moves');
  assert.equal(snapshotKey(v, { ...h, links: null }), snapshotKey(v, h), 'no links input: the key is as before');
});

test('tar returns listings larger than the default 1 MiB buffer', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tarbuf-'));
  try {
    const src = path.join(dir, 'src'); fs.mkdirSync(src);
    for (let i = 0; i < 6000; i++) fs.writeFileSync(path.join(src, `${'n'.repeat(180)}-${i}.html`), '');
    const file = path.join(dir, 'a.tgz');
    tar('-czf', file, '-C', src, '.');
    assert.ok(tar('-tvzf', file).length > 1024 * 1024);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

const tmpTree = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rootredir-'));
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  return dir;
};
const route = 'api-platform/api-gateway/1.1.0';

test('a snapshot without an index page gets a root redirect to its home page', () => {
  const dir = tmpTree({ [`${route}/pages.json`]: JSON.stringify({ pages: ['overview/'], home: 'overview/' }) });
  try {
    assert.equal(writeSnapshotRootRedirect(dir, route), true);
    const html = fs.readFileSync(path.join(dir, route, 'index.html'), 'utf8');
    assert.ok(html.includes(REDIRECT_MARK));
    assert.ok(html.includes(`url=/${route}/overview/"`));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a snapshot that has an index page keeps it', () => {
  const dir = tmpTree({ [`${route}/pages.json`]: JSON.stringify({ home: 'overview/' }), [`${route}/index.html`]: 'real' });
  try {
    assert.equal(writeSnapshotRootRedirect(dir, route), false);
    assert.equal(fs.readFileSync(path.join(dir, route, 'index.html'), 'utf8'), 'real');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an unsafe home is skipped with a warning', () => {
  for (const home of ['/etc/', '../x/', 'a/../b/', 'https://evil.example/', 'a\\b', 'javascript:alert(1)']) {
    const dir = tmpTree({ [`${route}/pages.json`]: JSON.stringify({ home }) });
    const warnings = [];
    try {
      assert.equal(writeSnapshotRootRedirect(dir, route, (m) => warnings.push(m)), false, home);
      assert.equal(fs.existsSync(path.join(dir, route, 'index.html')), false, home);
      assert.equal(warnings.length, 1, home);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('the redirect template is the one build-content.mjs writes for Latest', () => {
  const src = fs.readFileSync(new URL('../build-content.mjs', import.meta.url), 'utf8');
  const mine = fs.readFileSync(new URL('../redirect.mjs', import.meta.url), 'utf8');
  for (const prefix of ['const REDIRECT_MARK =', 'const escapeHtml =', 'const redirectHtml =']) {
    const line = (t) => t.split('\n').find((l) => l.replace('export ', '').startsWith(prefix));
    assert.equal(line(mine).replace('export ', ''), line(src), prefix);
  }
});

test('the final check throws on a version root with no page, and skips pending snapshots', () => {
  const versions = JSON.stringify({ versions: [{ version: '1.2.0', status: 'latest', path: '/api-platform/api-gateway/' }, { version: '1.1.0', status: 'snapshot', path: `/${route}/` }, { version: '1.0.0', status: 'confluence', href: 'https://example.com' }] });
  const dir = tmpTree({ 'api-platform/api-gateway/versions.json': versions, 'api-platform/api-gateway/index.html': 'x' });
  try {
    assert.throws(() => checkVersionRoots(dir), /api-platform\/api-gateway\/1\.1\.0\//);
    assert.doesNotThrow(() => checkVersionRoots(dir, new Set([`/${route}/`])));
    fs.mkdirSync(path.join(dir, route), { recursive: true }); fs.writeFileSync(path.join(dir, route, 'index.html'), 'x');
    assert.doesNotThrow(() => checkVersionRoots(dir));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the final check reads versions.json only at the section routes it is given (default: the lock)', () => {
  const broken = JSON.stringify({ versions: [{ version: '9.9.9', status: 'snapshot', path: '/nowhere/9.9.9/' }] });
  const dir = tmpTree({ 'not-a-route/deep/versions.json': broken, 'x/versions.json': broken });
  try {
    assert.doesNotThrow(() => checkVersionRoots(dir), 'a versions.json away from every lock route is not read');
    assert.throws(() => checkVersionRoots(dir, new Set(), ['x']), /\/nowhere\/9\.9\.9\/ \(x\/versions\.json\)/);
    assert.doesNotThrow(() => checkVersionRoots(dir, new Set(), ['../outside', 'missing']), 'routes outside the output or without a file are skipped');
    assert.ok(sectionRoutes().includes('api-platform/api-gateway'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the key covers fetch-sources.mjs, the converter tsconfig and the Node.js major version', () => {
  assert.ok(CHROME.includes('scripts/fetch-sources.mjs'));
  assert.ok(CONVERTER.includes('packages/docs-converter/tsconfig.json') && CONVERTER.includes('packages/docs-converter/src'));
  assert.ok(!CHROME.includes('scripts/snapshots.mjs') && !CONVERTER.includes('scripts/snapshots.mjs'), 'assemble-time logic stays outside the key');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'key-'));
  const root = path.join(repo, 'docs-site');
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: repo, stdio: 'pipe' });
  const write = (f, c) => { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), c); };
  write('scripts/fetch-sources.mjs', 'a'); write('packages/docs-converter/tsconfig.json', '{}'); write('packages/docs-converter/src/x.ts', 'x');
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'one');
  const hashes = () => ({ converter: treeHash(CONVERTER, root), chrome: treeHash(CHROME, root), nav: 'n', node: '22' });
  const k0 = snapshotKey(v, hashes());
  write('scripts/fetch-sources.mjs', 'b'); git('commit', '-qam', 'fetch');
  const k1 = snapshotKey(v, hashes());
  assert.notEqual(k1, k0, 'fetch-sources.mjs');
  write('packages/docs-converter/tsconfig.json', '{"compilerOptions":{}}'); git('commit', '-qam', 'tsconfig');
  const k2 = snapshotKey(v, hashes());
  assert.notEqual(k2, k1, 'converter tsconfig.json');
  assert.notEqual(snapshotKey(v, { ...hashes(), node: '24' }), k2, 'Node.js major version');
  assert.equal(snapshotKey(v, hashes()), k2, 'deterministic');
  fs.rmSync(repo, { recursive: true, force: true });
  assert.equal(nodeMajor('22.20.5'), '22');
  assert.equal(inputHashes().node, process.versions.node.split('.')[0]);
});
