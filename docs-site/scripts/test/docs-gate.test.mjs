// hosting/docs-gate against a temporary /srv/docs and a stand-in Typesense. Linux only (flock, GNU mv -T); CI runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GATE = fileURLToPath(new URL('../../hosting/docs-gate', import.meta.url));
const has = (cmd) => { try { execFileSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }); return true; } catch { return false; } };
const skip = process.platform !== 'linux' || !['flock', 'jq', 'curl'].every(has) ? 'needs Linux with flock, jq and curl' : false;

const ID = (n, sha = 'abc1234') => `2026102${n}T090000Z-${sha}`;

/** A Typesense stand-in: collections, one alias, keys and analytics rules, enough for the gate's calls. */
function fakeTypesense() {
  const state = { collections: new Map(), alias: null, keys: [], rules: new Map(), calls: [], adminKey: 'admin-key-123' };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
      if (req.headers['x-typesense-api-key'] !== state.adminKey) return send(401, { message: 'Forbidden' });
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      state.calls.push(`${req.method} ${p}`);
      let m;
      if (req.method === 'POST' && p === '/collections') {
        const s = JSON.parse(body);
        if (state.collections.has(s.name)) return send(409, { message: 'exists' });
        state.collections.set(s.name, { schema: s, docs: [] });
        return send(201, s);
      }
      if (req.method === 'GET' && p === '/collections') return send(200, [...state.collections.keys()].map((name) => ({ name })));
      if ((m = p.match(/^\/collections\/([^/]+)$/))) {
        if (!state.collections.has(m[1])) return send(404, { message: 'Not Found' });
        if (req.method === 'DELETE') state.collections.delete(m[1]);
        return send(200, { name: m[1] });
      }
      if ((m = p.match(/^\/collections\/([^/]+)\/documents\/import$/))) {
        const c = state.collections.get(m[1]);
        if (!c) return send(404, { message: 'Not Found' });
        const lines = body.split('\n').filter(Boolean).map((l) => JSON.parse(l));
        c.docs.push(...lines);
        return send(200, lines.map((d) => JSON.stringify(d.fail ? { success: false, error: 'bad' } : { success: true })).join('\n'));
      }
      if (p === '/aliases/docs') {
        if (req.method === 'PUT') { state.alias = JSON.parse(body).collection_name; return send(200, { name: 'docs', collection_name: state.alias }); }
        return state.alias ? send(200, { name: 'docs', collection_name: state.alias }) : send(404, { message: 'Not Found' });
      }
      if (p === '/keys' && req.method === 'GET') return send(200, { keys: state.keys });
      if (p === '/keys' && req.method === 'POST') {
        const k = JSON.parse(body);
        const key = { id: state.keys.length + 1, description: k.description, actions: k.actions, collections: k.collections, value_prefix: k.value.slice(0, 4) };
        state.keys.push(key);
        return send(201, key);
      }
      if ((m = p.match(/^\/analytics\/rules(?:\/([^/]+))?$/))) {
        if (req.method === 'POST') { const r = JSON.parse(body); state.rules.set(r.name, r); return send(201, r); }
        if (req.method === 'GET') return state.rules.has(m[1]) ? send(200, state.rules.get(m[1])) : send(404, { message: 'Rule not found' });
        state.rules.delete(m[1]);
        return send(200, {});
      }
      return send(404, { message: 'Not Found' });
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ state, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

function setup({ search } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-gate-'));
  const base = path.join(root, 'srv');
  for (const d of ['releases', 'previews/builds', 'previews/live']) fs.mkdirSync(path.join(base, d), { recursive: true });
  const env = path.join(root, 'typesense.env');
  fs.writeFileSync(env, `TYPESENSE_ADMIN_KEY=admin-key-123\nTYPESENSE_SEARCH_KEY=search-key-456\n`);
  const conf = path.join(root, 'gate.conf');
  fs.writeFileSync(conf, [`BASE=${base}`, `TYPESENSE_ENV=${env}`, 'PREVIEW_MIN_FREE_GB=0', 'PREVIEW_MAX=2',
    ...(search ? [`TYPESENSE_URL=${search}`, 'SEARCH_PUBLIC_URL=https://search.example.test'] : [])].join('\n'));
  return { root, base, conf };
}

function release(base, id, { complete = true, records = [{ id: 'p1', title: 'Page' }] } = {}) {
  const dir = path.join(base, 'releases', id);
  fs.mkdirSync(path.join(dir, '_search'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), id);
  fs.writeFileSync(path.join(dir, '.release.json'), JSON.stringify({ id, commit: id.slice(-7).padEnd(40, '0') }));
  fs.writeFileSync(path.join(dir, '_search/schema.json'), JSON.stringify({ fields: [{ name: 'title', type: 'string' }] }));
  fs.writeFileSync(path.join(dir, '_search/records.jsonl'), records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  if (complete) fs.writeFileSync(path.join(dir, '.release-complete'), '');
  return dir;
}

function preview(base, name, id, { complete = true } = {}) {
  const dir = path.join(base, 'previews/builds', `${name}_${id}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.release.json'), JSON.stringify({ id }));
  if (complete) fs.writeFileSync(path.join(dir, '.release-complete'), '');
  return dir;
}

/** Runs the gate as sshd would: the verb in SSH_ORIGINAL_COMMAND. Resolves { code, out, err, kv }. */
const gate = (mode, conf, cmd) => new Promise((resolve) => {
  execFile(GATE, [mode, conf], { env: { PATH: process.env.PATH, SSH_ORIGINAL_COMMAND: cmd } }, (error, out, err) => {
    const kv = Object.fromEntries(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    resolve({ code: error ? error.code : 0, out, err, kv });
  });
});

const live = (base) => fs.readlinkSync(path.join(base, 'current'));

test('anything but an allowed verb is refused before it is split', { skip }, async () => {
  const { conf } = setup();
  for (const [mode, cmd] of [['site', 'ls /'], ['site', 'current; id'], ['site', 'switch ../x'], ['site', `switch ${ID(1)} x`],
    ['site', 'switch 20261021T090000Z-ABC1234'], ['site', `preview-plan a`], ['preview', 'current'], ['preview', 'preview-plan -a'],
    ['preview', 'preview-plan a_b'], ['preview', `preview-switch a ${ID(1)}/..`], ['site', `switch ${ID(1)}${'0'.repeat(200)}`],
    ['site', ''], ['other', 'current']]) {
    const r = await gate(mode, conf, cmd);
    assert.notEqual(r.code, 0, `${mode}: ${cmd}`);
  }
});

test('switch needs a complete release with matching metadata', { skip }, async () => {
  const { base, conf } = setup();
  release(base, ID(1), { complete: false });
  assert.equal((await gate('site', conf, `switch ${ID(1)}`)).code, 66);
  assert.equal((await gate('site', conf, `switch ${ID(2)}`)).code, 66, 'missing folder');
  release(base, ID(3));
  fs.writeFileSync(path.join(base, 'releases', ID(3), '.release.json'), JSON.stringify({ id: ID(4) }));
  assert.equal((await gate('site', conf, `switch ${ID(3)}`)).code, 66, 'metadata names another release');
  assert.ok(!fs.existsSync(path.join(base, 'current')));
});

test('switch indexes, moves the alias, then goes live; current reports it', { skip }, async (t) => {
  const ts = await fakeTypesense(); t.after(ts.close);
  const { base, conf } = setup({ search: ts.url });
  release(base, ID(1));
  const r = await gate('site', conf, `switch ${ID(1)}`);
  assert.equal(r.code, 0, r.err);
  assert.equal(live(base), `releases/${ID(1)}`);
  assert.equal(ts.state.alias, `docs_${ID(1)}`);
  assert.equal(ts.state.collections.get(`docs_${ID(1)}`).docs.length, 1);
  assert.deepEqual(ts.state.keys.map((k) => [k.actions, k.collections]), [[['documents:search'], ['docs']]]);
  assert.ok(ts.state.rules.has('docs_popular_queries') && ts.state.rules.has('docs_nohits_queries'));
  const dir = path.join(base, 'releases', ID(1));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'search-config.json'), 'utf8')),
    { url: 'https://search.example.test', key: 'search-key-456', collection: 'docs' });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.release.json'), 'utf8')).collection, `docs_${ID(1)}`);
  const c = await gate('site', conf, 'current');
  assert.equal(c.kv.id, ID(1));
  assert.equal(c.kv.commit, 'abc1234'.padEnd(40, '0'));
  assert.match(c.kv.free_gb, /^\d+$/);
  // A second switch reuses the search key instead of adding another.
  release(base, ID(2));
  assert.equal((await gate('site', conf, `switch ${ID(2)}`)).code, 0);
  assert.equal(ts.state.keys.length, 1);
});

test('a failed import leaves the live site and alias untouched', { skip }, async (t) => {
  const ts = await fakeTypesense(); t.after(ts.close);
  const { base, conf } = setup({ search: ts.url });
  release(base, ID(1));
  await gate('site', conf, `switch ${ID(1)}`);
  release(base, ID(2), { records: [{ id: 'a' }, { id: 'b', fail: true }] });
  const r = await gate('site', conf, `switch ${ID(2)}`);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /1 records failed to import/);
  assert.equal(live(base), `releases/${ID(1)}`);
  assert.equal(ts.state.alias, `docs_${ID(1)}`);
  assert.ok(!ts.state.collections.has(`docs_${ID(2)}`), 'the half-built collection is dropped');
});

test('rollback goes to the previous release and its collection', { skip }, async (t) => {
  const ts = await fakeTypesense(); t.after(ts.close);
  const { base, conf } = setup({ search: ts.url });
  release(base, ID(1)); release(base, ID(2));
  await gate('site', conf, `switch ${ID(1)}`);
  await gate('site', conf, `switch ${ID(2)}`);
  const r = await gate('site', conf, 'rollback');
  assert.equal(r.code, 0, r.err);
  assert.equal(r.kv.switched, ID(1));
  assert.equal(live(base), `releases/${ID(1)}`);
  assert.equal(ts.state.alias, `docs_${ID(1)}`);
  assert.equal((await gate('site', conf, 'rollback')).code, 66, 'nothing older');
});

test('prune keeps three complete releases and the live one, and their collections', { skip }, async (t) => {
  const ts = await fakeTypesense(); t.after(ts.close);
  const { base, conf } = setup({ search: ts.url });
  for (const n of [1, 2, 3, 4, 5]) { release(base, ID(n)); assert.equal((await gate('site', conf, `switch ${ID(n)}`)).code, 0); }
  await gate('site', conf, 'rollback'); // live is now 4: newest three (5, 4, 3) are kept
  const fresh = release(base, ID(6), { complete: false }); // an upload in progress
  const stale = release(base, '20261001T090000Z-def5678', { complete: false });
  execFileSync('touch', ['-d', '3 days ago', stale]);
  const r = await gate('site', conf, 'prune');
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(fs.readdirSync(path.join(base, 'releases')).sort(), [ID(3), ID(4), ID(5), ID(6)]);
  assert.ok(fs.existsSync(fresh));
  assert.deepEqual([...ts.state.collections.keys()].filter((c) => c.startsWith('docs_2')).sort(), [ID(3), ID(4), ID(5)].map((i) => `docs_${i}`));
});

test('without search configured, switch only moves the symlink', { skip }, async () => {
  const { base, conf } = setup();
  release(base, ID(1));
  const r = await gate('site', conf, `switch ${ID(1)}`);
  assert.equal(r.code, 0, r.err);
  assert.equal(live(base), `releases/${ID(1)}`);
  assert.ok(!fs.existsSync(path.join(base, 'releases', ID(1), 'search-config.json')));
});

test('previews: plan, switch, keep two copies, limits, delete and clean', { skip }, async () => {
  const { base, conf } = setup();
  const linkOf = (name) => fs.readlinkSync(path.join(base, 'previews/live', name));
  let p = await gate('preview', conf, 'preview-plan healthcare-main');
  assert.deepEqual([p.kv.id, p.kv.allowed], ['', 'yes']);
  preview(base, 'healthcare-main', ID(1));
  assert.equal((await gate('preview', conf, `preview-switch healthcare-main ${ID(1)}`)).code, 0);
  assert.equal(linkOf('healthcare-main'), `../builds/healthcare-main_${ID(1)}`);
  preview(base, 'healthcare-main', ID(2)); preview(base, 'healthcare-main', ID(3));
  await gate('preview', conf, `preview-switch healthcare-main ${ID(2)}`);
  await gate('preview', conf, `preview-switch healthcare-main ${ID(3)}`);
  assert.deepEqual(fs.readdirSync(path.join(base, 'previews/builds')).sort(), [`healthcare-main_${ID(2)}`, `healthcare-main_${ID(3)}`]);
  assert.equal((await gate('preview', conf, 'preview-plan healthcare-main')).kv.id, ID(3));
  // PREVIEW_MAX=2: a third name is refused, an update to an existing one is not.
  preview(base, 'apim-x', ID(1)); await gate('preview', conf, `preview-switch apim-x ${ID(1)}`);
  p = await gate('preview', conf, 'preview-plan third');
  assert.deepEqual([p.kv.allowed, p.kv.reason], ['no', '2 previews already exist']);
  preview(base, 'third', ID(1));
  assert.equal((await gate('preview', conf, `preview-switch third ${ID(1)}`)).code, 69);
  assert.equal((await gate('preview', conf, 'preview-plan apim-x')).kv.allowed, 'yes');
  // delete removes the link and every build of that name
  assert.equal((await gate('preview', conf, 'preview-delete apim-x')).code, 0);
  assert.ok(!fs.existsSync(path.join(base, 'previews/live/apim-x')));
  assert.ok(!fs.readdirSync(path.join(base, 'previews/builds')).some((d) => d.startsWith('apim-x_')));
  // clean: expire after 14 days, drop builds with no preview, keep a fresh upload in progress
  execFileSync('touch', ['-d', '15 days ago', path.join(base, 'previews/builds', `healthcare-main_${ID(3)}`, '.release-complete')]);
  const inProgress = preview(base, 'newone', ID(1), { complete: false });
  const c = await gate('preview', conf, 'preview-clean');
  assert.equal(c.code, 0, c.err);
  assert.equal(c.kv.expired, 'healthcare-main');
  assert.deepEqual(fs.readdirSync(path.join(base, 'previews/live')), []);
  assert.deepEqual(fs.readdirSync(path.join(base, 'previews/builds')), [path.basename(inProgress)]);
});
