import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writeDocusaurusTree, type TreeVersion } from '../src/tree.js';
import { tempSource } from './helpers.js';

const sidebar = (ids: string[]) => ({ docs: ids.map((id) => ({ type: 'doc', id })) });
const page = (title: string, body: string) => `---\ntitle: ${title}\ndeployment_options:\n  - Self-hosted\n---\n\n${body}`;

/** Converted output of two versions, as the docs-site build writes it (generated/docs/<id>, static per version). */
function twoVersions(latest: Record<string, string>, older: Record<string, string>) {
  const root = tempSource({ ...Object.fromEntries(Object.entries(latest).map(([k, v]) => [`latest/${k}`, v])), ...Object.fromEntries(Object.entries(older).map(([k, v]) => [`old/${k}`, v])) });
  const versions: TreeVersion[] = [
    { version: '7.3.0', route: 'p', docsDir: path.join(root, 'latest/docs'), staticDir: path.join(root, 'latest/static'), sidebar: sidebar(['index', 'guides/setup']) },
    { version: '7.2.0', route: 'p/7.2.0', docsDir: path.join(root, 'old/docs'), staticDir: path.join(root, 'old/static'), sidebar: sidebar(['index']) },
  ];
  const out = path.join(root, 'tree');
  return { versions, out, read: (rel: string) => fs.readFileSync(path.join(out, rel), 'utf8') };
}

test('Latest goes to docs/, older versions to versioned_docs/ with their sidebars, listed newest first in versions.json', () => {
  const { versions, out, read } = twoVersions(
    { 'docs/index.md': page('Home', '# Home\n'), 'docs/guides/setup.md': page('Setup', '# Setup\n') },
    { 'docs/index.md': page('Home', '# Old home\n') },
  );
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.match(read('docs/guides/setup.md'), /# Setup/);
  assert.match(read('versioned_docs/version-7.2.0/index.md'), /# Old home/);
  assert.deepEqual(JSON.parse(read('sidebars.json')), sidebar(['index', 'guides/setup']));
  assert.deepEqual(JSON.parse(read('versioned_sidebars/version-7.2.0-sidebars.json')), sidebar(['index']));
  assert.deepEqual(JSON.parse(read('versions.json')), ['7.2.0']);
});

test('images are stored once by file path; a version whose copy differs keeps its own under assets/_versions/; unreferenced files are left out', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': page('Home', '# Home\n\n![Same](assets/img/same.png)\n\n![Changed](assets/img/changed.png)\n'),
    'docs/guides/setup.md': page('Setup', '# Setup\n\n![Same](../assets/img/same.png)\n\n![Spaced]( /p/assets/img/same.png)\n'),
    'docs/assets/img/same.png': 'SAME', 'docs/assets/img/changed.png': 'NEW', 'docs/convert_links.sh': 'echo',
  }, {
    'docs/index.md': page('Home', '# Old\n\n![Same](assets/img/same.png)\n\n![Changed](assets/img/changed.png)\n'),
    'docs/assets/img/same.png': 'SAME', 'docs/assets/img/changed.png': 'OLD',
  });
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.equal(read('assets/img/same.png'), 'SAME');
  assert.equal(read('assets/img/changed.png'), 'NEW');
  assert.equal(read('assets/_versions/7.2.0/img/changed.png'), 'OLD');
  assert.match(read('docs/index.md'), /!\[Same\]\(\.\.\/assets\/img\/same\.png\)/);
  assert.match(read('docs/guides/setup.md'), /!\[Same\]\(\.\.\/\.\.\/assets\/img\/same\.png\)/);
  assert.match(read('docs/guides/setup.md'), /!\[Spaced\]\(\.\.\/\.\.\/assets\/img\/same\.png\)/);
  assert.match(read('versioned_docs/version-7.2.0/index.md'), /!\[Same\]\(\.\.\/\.\.\/assets\/img\/same\.png\)/);
  assert.match(read('versioned_docs/version-7.2.0/index.md'), /!\[Changed\]\(\.\.\/\.\.\/assets\/_versions\/7\.2\.0\/img\/changed\.png\)/);
  assert.ok(!fs.existsSync(path.join(out, 'docs/convert_links.sh')) && !fs.existsSync(path.join(out, 'docs/assets')));
});

test('files referenced by URL in attributes are shared by path in static/, served under the product route', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': page('Home', '# Home\n\n<img src="/p/assets/logo.svg" />\n'),
    'docs/guides/setup.md': page('Setup', '# Setup\n\n<ApiReference spec="/p/apis/users.yaml" />\n\n[Download the spec](/p/apis/users.yaml)\n'),
    'static/assets/logo.svg': 'LOGO', 'static/apis/users.yaml': 'NEW',
  }, {
    'docs/index.md': page('Home', '# Old\n\n<img src="/p/7.2.0/assets/logo.svg" />\n\n<div><img className={"x"} src={"/p/7.2.0/apis/users.yaml"} /></div>\n\n<ApiReference spec="/p/7.2.0/apis/users.yaml" />\n\n[Download the spec](/p/7.2.0/apis/users.yaml)\n'),
    'static/assets/logo.svg': 'LOGO', 'static/apis/users.yaml': 'OLD',
  });
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.equal(read('static/assets/logo.svg'), 'LOGO');
  assert.equal(read('static/_versions/7.2.0/apis/users.yaml'), 'OLD');
  assert.match(read('docs/guides/setup.md'), /spec="\/p\/apis\/users\.yaml"/);
  assert.match(read('docs/guides/setup.md'), /\[Download the spec\]\(\/p\/apis\/users\.yaml\)/);
  const old = read('versioned_docs/version-7.2.0/index.md');
  assert.match(old, /src="\/p\/assets\/logo\.svg"/);
  assert.match(old, /spec="\/p\/_versions\/7\.2\.0\/apis\/users\.yaml"/);
  assert.match(old, /\[Download the spec\]\(\/p\/_versions\/7\.2\.0\/apis\/users\.yaml\)/);
  assert.match(old, /src=\{"\/p\/_versions\/7\.2\.0\/apis\/users\.yaml"\}/);
});

test('links to pages of the same version become relative .md links; other versions and unknown pages keep their URL', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': page('Home', '# Home\n\nSee [setup](/p/guides/setup/#ports), [guides](/p/guides/), [old](/p/7.2.0/) and [gone](/p/nowhere/).\n\n```\ncurl /p/guides/setup/\n```\n'),
    'docs/guides/index.md': page('Guides', '# Guides\n\nBack [home](/p/). Odd [link](setup.md/).\n'),
    'docs/guides/setup.md': page('Setup', '# Setup\n'),
    'docs/guides/sso/sso.md': '---\ntitle: SSO\nslug: /guides/sso/sso/\n---\n\n# SSO\n\n[Setup](/p/guides/setup/)\n',
  }, {
    'docs/index.md': page('Home', '# Old\n\n[Latest home](/p/) and [self](/p/7.2.0/).\n'),
  });
  writeDocusaurusTree(versions, out, { route: 'p' });
  const home = read('docs/index.md');
  assert.match(home, /\[setup\]\(guides\/setup\.md#ports\)/);
  assert.match(home, /\[guides\]\(guides\/index\.md\)/);
  assert.match(home, /\[old\]\(\/p\/7\.2\.0\/\)/);
  assert.match(home, /\[gone\]\(\/p\/nowhere\/\)/);
  assert.match(home, /curl \/p\/guides\/setup\//);
  assert.match(read('docs/guides/index.md'), /\[home\]\(\.\.\/index\.md\)/);
  assert.match(read('docs/guides/index.md'), /\[link\]\(setup\.md\/\)/);
  assert.ok(!fs.existsSync(path.join(out, 'assets')), 'pages are never copied as assets');
  assert.match(read('docs/guides/sso/sso.md'), /\[Setup\]\(\.\.\/setup\.md\)/);
  assert.match(read('versioned_docs/version-7.2.0/index.md'), /\[Latest home\]\(\/p\/\) and \[self\]\(index\.md\)/);
});

test('component imports are removed (the docs site registers components globally); partial imports stay', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': "---\ntitle: Home\n---\n\nimport Applies from '@site/src/components/Applies';\nimport Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\n\nimport SignIn from './_partials/sign-in.mdx';\n\n# Home\n\n<SignIn />\n\n```js\nimport x from '@site/src/keep-in-code';\n```\n",
    'docs/_partials/sign-in.mdx': "import Applies from '@site/src/components/Applies';\n\n<Applies to=\"WSO2 Cloud\">\n\nConsole.\n\n</Applies>\n",
  }, { 'docs/index.md': page('Home', '# Old\n') });
  writeDocusaurusTree(versions, out, { route: 'p' });
  const home = read('docs/index.md');
  assert.equal(home, "---\ntitle: Home\n---\n\nimport SignIn from './_partials/sign-in.mdx';\n\n# Home\n\n<SignIn />\n\n```js\nimport x from '@site/src/keep-in-code';\n```\n");
  assert.equal(read('docs/_partials/sign-in.mdx'), '<Applies to="WSO2 Cloud">\n\nConsole.\n\n</Applies>\n');
});

test('MkDocs redirect maps go to redirects.json; edit links open the MkDocs source on the tracked branch', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': `---\ntitle: Home\ncustom_edit_url: >-\n  https://github.com/wso2/docs-is/blob/${'a'.repeat(40)}/en/asgardeo/docs/index.md\n---\n\n# Home\n`,
  }, { 'docs/index.md': page('Home', '# Old\n') });
  versions[0]!.redirects = { 'old/b.md': 'guides/b.md', 'old/a.md': 'guides/a.md' };
  versions[1]!.redirects = { 'x.md': 'y.md' };
  writeDocusaurusTree(versions, out, { route: 'p', editBranch: 'master' });
  assert.equal(read('redirects.json'), JSON.stringify({ current: { 'old/a.md': 'guides/a.md', 'old/b.md': 'guides/b.md' }, '7.2.0': { 'x.md': 'y.md' } }, null, 2) + '\n');
  assert.match(read('docs/index.md'), /https:\/\/github\.com\/wso2\/docs-is\/edit\/master\/en\/asgardeo\/docs\/index\.md/);
});

test('the same input gives the same tree; a rerun replaces only a tree this writer made', () => {
  const { versions, out } = twoVersions({
    'docs/index.md': page('Home', '# Home\n\n![a](assets/a.png) [b](/p/guides/setup/)\n'), 'docs/guides/setup.md': page('Setup', '# S\n'), 'docs/assets/a.png': 'A',
  }, { 'docs/index.md': page('Home', '# Old\n\n![a](assets/a.png)\n'), 'docs/assets/a.png': 'B' });
  const snapshot = (dir: string) => Object.fromEntries(fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name))).sort().map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
  writeDocusaurusTree(versions, out, { route: 'p' });
  const first = snapshot(out);
  fs.writeFileSync(path.join(out, 'docs/stale.md'), 'old');
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.deepEqual(snapshot(out), first);
  const other = fs.mkdtempSync(path.join(path.dirname(out), 'not-a-tree-'));
  fs.writeFileSync(path.join(other, 'keep.txt'), 'mine');
  assert.throws(() => writeDocusaurusTree(versions, other, { route: 'p' }), /not a tree written by wso2-docs/);
  assert.equal(fs.readFileSync(path.join(other, 'keep.txt'), 'utf8'), 'mine');
});

test('relative URLs in attributes resolve against the page URL, like a browser, and their files go to static/', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': page('Home', '# Home\n'),
    'docs/apis/users-rest-api.md': page('Users API', '<ApiReference spec="../../apis/restapis/users.yaml" />\n'),
    'docs/apis/restapis/users.yaml': 'SPEC',
  }, { 'docs/index.md': page('Home', '# Old\n') });
  versions[0]!.sidebar = sidebar(['index']);
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.match(read('docs/apis/users-rest-api.md'), /spec="\/p\/apis\/restapis\/users\.yaml"/);
  assert.equal(read('static/apis/restapis/users.yaml'), 'SPEC');
});
