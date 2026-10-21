import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writeDocusaurusTree, readTreeStamp, TREE_MARKER, type TreeVersion } from '../src/tree.js';
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
  assert.match(read('docs/guides/setup.mdx'), /# Setup/);
  assert.match(read('versioned_docs/version-7.2.0/index.mdx'), /# Old home/);
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
  assert.match(read('docs/index.mdx'), /!\[Same\]\(\.\.\/assets\/img\/same\.png\)/);
  assert.match(read('docs/guides/setup.mdx'), /!\[Same\]\(\.\.\/\.\.\/assets\/img\/same\.png\)/);
  assert.match(read('docs/guides/setup.mdx'), /!\[Spaced\]\(\.\.\/\.\.\/assets\/img\/same\.png\)/);
  assert.match(read('versioned_docs/version-7.2.0/index.mdx'), /!\[Same\]\(\.\.\/\.\.\/assets\/img\/same\.png\)/);
  assert.match(read('versioned_docs/version-7.2.0/index.mdx'), /!\[Changed\]\(\.\.\/\.\.\/assets\/_versions\/7\.2\.0\/img\/changed\.png\)/);
  assert.ok(!fs.existsSync(path.join(out, 'docs/convert_links.sh')) && !fs.existsSync(path.join(out, 'docs/assets')));
  assert.ok(!fs.existsSync(path.join(out, 'docs/index.md')), 'pages are .mdx only');
});

test('files referenced by URL in attributes are shared by path in static/, served under the product route', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': page('Home', '# Home\n\n<img src="/p/assets/logo.svg" />\n'),
    'docs/guides/setup.md': page('Setup', '# Setup\n\n<ApiReference spec="/p/apis/users.yaml" />\n\n[Download the spec](/p/apis/users.yaml)\n'),
    'static/assets/logo.svg': 'LOGO', 'static/apis/users.yaml': 'NEW',
  }, {
    'docs/index.md': page('Home', '# Old\n\n<img src="/p/7.2.0/assets/logo.svg" />\n\n<div><img className={"x"} src={"/p/7.2.0/apis/users.yaml"} /></div>\n\n<img src=\'/p/7.2.0/assets/logo.svg\' className=\'z\' />\n\n<ApiReference spec="/p/7.2.0/apis/users.yaml" />\n\n[Download the spec](/p/7.2.0/apis/users.yaml)\n'),
    'static/assets/logo.svg': 'LOGO', 'static/apis/users.yaml': 'OLD',
  });
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.equal(read('static/assets/logo.svg'), 'LOGO');
  assert.equal(read('static/_versions/7.2.0/apis/users.yaml'), 'OLD');
  assert.match(read('docs/guides/setup.mdx'), /spec="\/p\/apis\/users\.yaml"/);
  assert.match(read('docs/guides/setup.mdx'), /\[Download the spec\]\(\/p\/apis\/users\.yaml\)/);
  const old = read('versioned_docs/version-7.2.0/index.mdx');
  assert.match(old, /src="\/p\/assets\/logo\.svg"/);
  assert.doesNotMatch(old, /\/p\/7\.2\.0\/assets\/logo\.svg/);
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
  const home = read('docs/index.mdx');
  assert.match(home, /\[setup\]\(guides\/setup\.mdx#ports\)/);
  assert.match(home, /\[guides\]\(guides\/index\.mdx\)/);
  assert.match(home, /\[old\]\(\/p\/7\.2\.0\/\)/);
  assert.match(home, /\[gone\]\(\/p\/nowhere\/\)/);
  assert.match(home, /curl \/p\/guides\/setup\//);
  assert.match(read('docs/guides/index.mdx'), /\[home\]\(\.\.\/index\.mdx\)/);
  assert.match(read('docs/guides/index.mdx'), /\[link\]\(setup\.md\/\)/);
  assert.ok(!fs.existsSync(path.join(out, 'assets')), 'pages are never copied as assets');
  assert.match(read('docs/guides/sso/sso.mdx'), /\[Setup\]\(\.\.\/setup\.mdx\)/);
  assert.match(read('versioned_docs/version-7.2.0/index.mdx'), /\[Latest home\]\(\/p\/\) and \[self\]\(index\.mdx\)/);
});

test('component imports are removed (the docs site registers components globally); partial imports stay', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': "---\ntitle: Home\n---\n\nimport Applies from '@site/src/components/Applies';\nimport Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\n\nimport SignIn from './_partials/sign-in.mdx';\n\n# Home\n\n<SignIn />\n\n```js\nimport x from '@site/src/keep-in-code';\n```\n",
    'docs/_partials/sign-in.mdx': "import Applies from '@site/src/components/Applies';\n\n<Applies to=\"WSO2 Cloud\">\n\nConsole.\n\n</Applies>\n",
  }, { 'docs/index.md': page('Home', '# Old\n') });
  writeDocusaurusTree(versions, out, { route: 'p' });
  const home = read('docs/index.mdx');
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
  assert.match(read('docs/index.mdx'), /https:\/\/github\.com\/wso2\/docs-is\/edit\/master\/en\/asgardeo\/docs\/index\.md/);
});

test('a version kept on its own branch opens that branch to edit', () => {
  const pinned = (v: string) => `---\ntitle: Home\ncustom_edit_url: https://github.com/wso2/docs-apim/blob/${'b'.repeat(40)}/en/docs/index.md\n---\n\n# ${v}\n`;
  const { versions, out, read } = twoVersions({ 'docs/index.md': pinned('New') }, { 'docs/index.md': pinned('Old') });
  versions[1]!.editBranch = '7.2.0';
  writeDocusaurusTree(versions, out, { route: 'p', editBranch: 'master' });
  assert.match(read('docs/index.mdx'), /docs-apim\/edit\/master\/en\/docs\/index\.md/);
  assert.match(read('versioned_docs/version-7.2.0/index.mdx'), /docs-apim\/edit\/7\.2\.0\/en\/docs\/index\.md/);
});

test('the same input gives the same tree; a rerun replaces only a tree this writer made', () => {
  const { versions, out } = twoVersions({
    'docs/index.md': page('Home', '# Home\n\n![a](assets/a.png) [b](/p/guides/setup/)\n'), 'docs/guides/setup.md': page('Setup', '# S\n'), 'docs/assets/a.png': 'A',
  }, { 'docs/index.md': page('Home', '# Old\n\n![a](assets/a.png)\n'), 'docs/assets/a.png': 'B' });
  const snapshot = (dir: string) => Object.fromEntries(fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name))).sort().map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
  writeDocusaurusTree(versions, out, { route: 'p' });
  const first = snapshot(out);
  fs.writeFileSync(path.join(out, 'docs/stale.mdx'), 'old');
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
  assert.match(read('docs/apis/users-rest-api.mdx'), /spec="\/p\/apis\/restapis\/users\.yaml"/);
  assert.equal(read('static/apis/restapis/users.yaml'), 'SPEC');
});

test('a Markdown link written relative to the page URL (as MkDocs pages often are) still finds its file', () => {
  const { versions, out, read } = twoVersions({ 'docs/index.md': page('Home', '# Home\n') }, {
    'docs/index.md': page('Home', '# Old\n'),
    'docs/develop/admin-services.md': page('Admin services', '- [WSDL](../../assets/attachments/admin.wsdl)\n- [Shot](../assets/img/a.png)\n'),
    'docs/assets/attachments/admin.wsdl': 'WSDL', 'docs/assets/img/a.png': 'A',
  });
  writeDocusaurusTree(versions, out, { route: 'p' });
  const text = read('versioned_docs/version-7.2.0/develop/admin-services.mdx');
  assert.match(text, /\[WSDL\]\(\.\.\/\.\.\/\.\.\/assets\/attachments\/admin\.wsdl\)/);
  assert.match(text, /\[Shot\]\(\.\.\/\.\.\/\.\.\/assets\/img\/a\.png\)/);
  assert.equal(read('assets/attachments/admin.wsdl'), 'WSDL');
});

test('a link target on the line after `](` still finds its file', () => {
  const { versions, out, read } = twoVersions({ 'docs/index.md': page('Home', '# Home\n') }, {
    'docs/index.md': page('Home', '# Old\n'),
    'docs/learn/self-registration.md': page('Self registration', '![config](\n../assets/img/config.png)\n'),
    'docs/assets/img/config.png': 'PNG',
  });
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.match(read('versioned_docs/version-7.2.0/learn/self-registration.mdx'), /!\[config\]\(\.\.\/\.\.\/\.\.\/assets\/img\/config\.png\)/);
});

test('a linked .html file, which Docusaurus never bundles, goes to static/ and is linked by URL under the route', () => {
  const { versions, out, read } = twoVersions({ 'docs/index.md': page('Home', '# Home\n') }, {
    'docs/index.md': page('Home', '# Old\n'),
    'docs/develop/sso-page.md': page('SSO page', 'See [here](../../assets/attachments/template.html).\n'),
    'docs/assets/attachments/template.html': '<html></html>',
  });
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.match(read('versioned_docs/version-7.2.0/develop/sso-page.mdx'), /\[here\]\(\/p\/assets\/attachments\/template\.html\)/);
  assert.equal(read('static/assets/attachments/template.html'), '<html></html>');
});

test('every page is written as .mdx; links between pages, lifecycle replacements and partial imports follow; sidebars keep their ids', () => {
  const { versions, out, read } = twoVersions({
    'docs/index.md': page('Home', '# Home\n\nSee [setup](guides/setup.md#run) and [spec](guides/setup.md/).\n\nimport Note from \'./_partials/note.mdx\';\n\n<Note />\n'),
    'docs/guides/setup.md': '---\ntitle: Setup\nstatus: deprecated\nreplacement: ../index.md#start\nby_option:\n  Self-hosted:\n    replacement: ../index.md\n---\n\n# Setup\n',
    'docs/_partials/note.mdx': 'Note [home](../index.md).\n',
  }, { 'docs/index.md': page('Home', '# Old\n\n[Self](index.md)\n') });
  writeDocusaurusTree(versions, out, { route: 'p' });
  assert.match(read('docs/index.mdx'), /\[setup\]\(guides\/setup\.mdx#run\) and \[spec\]\(guides\/setup\.md\/\)/);
  assert.match(read('docs/index.mdx'), /import Note from '\.\/_partials\/note\.mdx';/);
  assert.match(read('docs/guides/setup.mdx'), /^replacement: \.\.\/index\.mdx#start$/m);
  assert.match(read('docs/guides/setup.mdx'), /^ {4}replacement: \.\.\/index\.mdx$/m);
  assert.equal(read('docs/_partials/note.mdx'), 'Note [home](../index.mdx).\n');
  assert.match(read('versioned_docs/version-7.2.0/index.mdx'), /\[Self\]\(index\.mdx\)/);
  assert.deepEqual(JSON.parse(read('sidebars.json')), sidebar(['index', 'guides/setup']));
  for (const old of ['docs/index.md', 'docs/guides/setup.md', 'versioned_docs/version-7.2.0/index.md']) assert.ok(!fs.existsSync(path.join(out, old)), old);
});

test('pages and partials that follow the conventions get the explicit components in every version', () => {
  const steps = '## Step 1: Install\n\nDo a.\n\n## Step 2: Run\n\nDo b.\n';
  const { versions, out, read } = twoVersions({
    'docs/index.md': page('Home', `# Home\n\n${steps}`),
    'docs/_partials/run.mdx': steps,
    'docs/guides/setup.md': '---\ntitle: Setup\nstepper: false\n---\n\n' + steps,
  }, { 'docs/index.md': page('Home', `# Old\n\n${steps}`) });
  writeDocusaurusTree(versions, out, { route: 'p' });
  for (const f of ['docs/index.mdx', 'docs/_partials/run.mdx', 'versioned_docs/version-7.2.0/index.mdx']) {
    assert.match(read(f), /<Steps>\n\n## Install \{\/\* #step-1-install \*\/\}/, f);
  }
  assert.match(read('docs/index.mdx'), /^---\ntitle: Home\n/, 'front matter kept');
  assert.match(read('docs/guides/setup.mdx'), /## Step 1: Install/, 'the opt-out holds');
});

test('the tree run lists nested Steps whose last sub-step is followed by text, with file and line, for review', () => {
  const nested = '## Step 1: Configure\n\nIntro.\n\n### Step 1.1: A\n\na\n\n### Step 1.2: B\n\nb\n\nThen save.\n\n## Step 2: Run\n\nr\n';
  const clean = '## Step 1: Configure\n\n### Step 1.1: A\n\n### Step 1.2: B\n\n## Step 2: Run\n\nr\n';
  const { versions, out, read } = twoVersions({ 'docs/index.md': page('Home', `# Home\n\n${nested}`), 'docs/clean.md': page('Clean', clean) },
    { 'docs/index.md': page('Home', '# Old\n') });
  const { review } = writeDocusaurusTree(versions, out, { route: 'p' });
  assert.equal(review.length, 1);
  assert.equal(review[0]!.file, 'docs/index.mdx');
  const lines = read('docs/index.mdx').split('\n');
  assert.equal(lines[review[0]!.line - 1], '</Steps>', 'the line of the nested </Steps>, after the text');
  assert.equal(lines[review[0]!.line - 3], 'Then save.');
});

test('the tree marker records the stamp lines; a marker written before stamps reads as none', () => {
  const { versions, out, read } = twoVersions({ 'docs/index.md': page('Home', '# Home\n') }, { 'docs/index.md': page('Home', '# Old\n') });
  writeDocusaurusTree(versions, out, { route: 'p', stamp: { converter: 'abc123', generated: '2026-10-21' } });
  assert.deepEqual(readTreeStamp(read(TREE_MARKER)), { converter: 'abc123', generated: '2026-10-21' });
  assert.deepEqual(readTreeStamp('Generated by wso2-docs (writeDocusaurusTree). Regenerate instead of editing until cutover.\n'), {});
  assert.throws(() => writeDocusaurusTree(versions, out, { route: 'p', stamp: { converter: 'a\nb' } }), /not a key: value line/);
});
