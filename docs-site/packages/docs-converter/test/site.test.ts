import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { convertMkdocsSite, convertMergedSites, containedFile, keepMkdocsUrl, relativeImages, copyReferencedAssets, referencedFiles, mkdocsUrl, mkdocsTitle, rewriteOutsideRefs, encodePath } from '../src/site.js';
import { compile } from '@mdx-js/mdx';
import { loadConfig, ConfigError } from '../src/config.js';
import { tempSource } from './helpers.js';

const mkdocsRepo = () => tempSource({
  'en/mkdocs.yml': 'site_name: Demo\nplugins:\n  - markdownextradata\nnav:\n  - Home: index.md\n  - Guides:\n      - guides/index.md\n      - Setup: guides/setup.md\n      - Broken: guides/broken.md\nextra:\n  product_name: Demo Server\n',
  'en/docs/index.md': '# Demo\n\nWelcome to {{ product_name }}.\n',
  'en/docs/guides/index.md': '# Guides\n',
  'en/docs/guides/setup.md': '# Setup\n\n!!! note\n    See [home]({{ base_path }}/index.md).\n\n![Shot]({{ base_path }}/assets/shot.png)\n',
  'en/docs/guides/broken.md': '# Broken\n\n<a href="javascript:x()">x</a>\n',
  'en/docs/assets/shot.png': 'PNG',
});

test('an MkDocs site converts page by page, with a sidebar from nav:, assets and failures reported', async () => {
  const root = mkdocsRepo();
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { sidebar, report } = await convertMkdocsSite(
    { root, mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'], currentSite: 'https://demo.example/en/1.0/' },
    { outDir: out, route: 'demo' },
  );
  assert.equal(report.ok, 3);
  assert.deepEqual(report.failures.map((f) => [f.page, f.kind]), [['guides/broken.md', 'policy']]);
  assert.ok(!fs.existsSync(path.join(out, 'guides/broken.md')), 'no fallback configured: failing page not written');
  const setup = fs.readFileSync(path.join(out, 'guides/setup.md'), 'utf8');
  assert.match(setup, /^deployment_options:\n {2}- Self-hosted$/m);
  assert.match(setup, /:::note\n\nSee \[home\]\(\/demo\/index\.md\)\./);
  assert.ok(fs.existsSync(path.join(out, 'assets/shot.png')), 'assets copied next to pages');
  assert.match(fs.readFileSync(path.join(out, 'index.md'), 'utf8'), /Welcome to Demo Server\./);
  assert.deepEqual(sidebar, [
    { type: 'doc', id: 'index', label: 'Home' },
    { type: 'category', label: 'Guides', link: { type: 'doc', id: 'guides/index' }, items: [{ type: 'doc', id: 'guides/setup', label: 'Setup' }] },
  ]);
  assert.deepEqual(report.droppedNav, ['guides/broken.md']);
});

test('excluded and failing pages get the caller\'s fallback page; excluded pages that pass are reported', async () => {
  const root = mkdocsRepo();
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { report } = await convertMkdocsSite(
    { root, mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'], currentSite: 'https://demo.example/en/1.0/' },
    { outDir: out, route: 'demo', exclude: ['guides/setup.md'], fallback: (p) => `---\ntitle: ${p.title}\n---\n\nMoved: ${p.to}\n` },
  );
  assert.deepEqual(report.nowPassing, ['guides/setup.md']);
  assert.equal(report.redirected, 2);
  assert.match(fs.readFileSync(path.join(out, 'guides/broken.md'), 'utf8'), /Moved: https:\/\/demo\.example\/en\/1\.0\/guides\/broken\//);
});

test('a cloud + self-hosted pair merges into one page per topic', async () => {
  const root = tempSource({
    'cloud/mkdocs.yml': 'site_name: Cloud\nextra:\n  product_name: Cloud P\nnav:\n  - p.md\n',
    'cloud/docs/p.md': '{% include "../../inc/p.md" %}',
    'self/mkdocs.yml': 'site_name: Self\nextra:\n  product_name: Server P\nnav:\n  - p.md\n  - only-self.md\n',
    'self/docs/p.md': '{% include "../../inc/p.md" %}',
    'self/docs/only-self.md': '# Install\n',
    'inc/p.md': '# {{ product_name }}\n\n{% if product_name == "Cloud P" %}Console.{% else %}Edit deployment.toml.{% endif %}\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { sidebar, report } = await convertMergedSites(
    { cloud: { root, mkdocs: 'cloud/mkdocs.yml' }, self: { root, mkdocs: 'self/mkdocs.yml' }, sharedNames: { product_name: 'Platform P' } },
    { outDir: out, route: 'p' },
  );
  assert.equal(report.ok, 2);
  const page = fs.readFileSync(path.join(out, 'p.md'), 'utf8');
  assert.match(page, /deployment_options:\n {2}- WSO2 Cloud\n {2}- Self-hosted/);
  assert.match(page, /# Platform P/);
  assert.match(page, /<Applies to="WSO2 Cloud">\n\nConsole\.\n\n<\/Applies>/);
  assert.match(fs.readFileSync(path.join(out, 'only-self.md'), 'utf8'), /deployment_options:\n {2}- Self-hosted\n/);
  assert.deepEqual(sidebar.map((i) => i.id), ['p', 'only-self']);
});

test('keepMkdocsUrl pins pages Docusaurus would turn into folder index pages', () => {
  assert.equal(keepMkdocsUrl('---\ntitle: a\n---\nx', 'apis/apis.md'), '---\nslug: /apis/apis/\ntitle: a\n---\nx');
  assert.equal(keepMkdocsUrl('---\ntitle: a\n---\nx', 'apis/other.md'), '---\ntitle: a\n---\nx');
});

test('config: paths must stay inside the repository; kinds and routes are validated', () => {
  const root = tempSource({
    'ok.yaml': 'kind: mkdocs\nmkdocs: en/mkdocs.yml\ndeployment_options: [Self-hosted]\nexclude: exclude.txt\n',
    'exclude.txt': '# known\nguides/broken.md\n',
    'escape.yaml': 'kind: mkdocs\nmkdocs: ../../etc/mkdocs.yml\ndeployment_options: [Self-hosted]\n',
    'kind.yaml': 'kind: sphinx\n',
    'route.yaml': 'kind: mkdocs\nmkdocs: en/mkdocs.yml\nroute: "../x"\ndeployment_options: []\n',
  });
  const ok = loadConfig(path.join(root, 'ok.yaml'), root);
  assert.equal(ok.route, 'docs');
  assert.deepEqual(ok.excludeList, ['guides/broken.md']);
  assert.throws(() => loadConfig(path.join(root, 'escape.yaml'), root), ConfigError);
  assert.throws(() => loadConfig(path.join(root, 'kind.yaml'), root), /kind must be/);
  assert.throws(() => loadConfig(path.join(root, 'route.yaml'), root), /route must be/);
});

test('API reference pages resolve their spec like a browser would and read its title, never outside the docs folder', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: Demo\nplugins:\n  - markdownextradata\nnav:\n  - apis/publisher.md\n  - apis/abs.md\n  - apis/escape.md\n',
    'en/docs/apis/publisher.md': `<redoc spec-url='../publisher-v4.yaml'></redoc>`,
    'en/docs/apis/abs.md': '<redoc spec-url="{{ base_path }}/apis/restapis/admin.yaml"></redoc>',
    'en/docs/apis/escape.md': `<redoc spec-url='../../../../secret.yaml'></redoc>`,
    'en/docs/apis/publisher-v4.yaml': 'openapi: 3.0.1\ninfo:\n  title: Publisher API v4\n  description: |\n    Manage APIs in the **Publisher**.\n\n    Second paragraph.\n',
    'en/docs/apis/restapis/admin.yaml': '{"openapi":"3.0.1","info":{"title":"Admin API"}}',
    'secret.yaml': 'info:\n  title: Should not be read\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { report } = await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'] }, { outDir: out, route: 'demo' });
  assert.equal(report.ok, 3);
  const read = (p: string) => fs.readFileSync(path.join(out, p), 'utf8');
  assert.match(read('apis/publisher.md'), /^title: Publisher API v4$/m);
  assert.match(read('apis/publisher.md'), /^description: Manage APIs in the Publisher\.$/m, 'first paragraph, Markdown removed');
  assert.match(read('apis/abs.md'), /^title: Admin API$/m);
  assert.match(read('apis/abs.md'), /<ApiReference spec="\/demo\/apis\/restapis\/admin\.yaml" \/>/);
  assert.doesNotMatch(read('apis/escape.md'), /Should not be read/);
});

test('without markdownextradata or macros, {{ }} and {% %} are text, and include markers still expand', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: Old\nplugins:\n  - search\nnav:\n  - Home: index.md\n',
    'en/docs/index.md': '# Old\n\nSend {{token}} and keep {% raw %} as written.\n\n{!includes/note.md!}\n',
    'en/docs/includes/note.md': 'Included.',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const { report } = await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [] }, { outDir: out, route: 'old' });
  assert.equal(report.failures.length, 0);
  const page = fs.readFileSync(path.join(out, 'index.md'), 'utf8');
  assert.match(page, /token/);
  assert.match(page, /raw/);
  assert.match(page, /Included\./);
});

test('with markdownextradata (string or mapping form, also through INHERIT), Jinja renders as before', async () => {
  for (const plugins of ['  - markdownextradata\n', '  - markdownextradata: {}\n', '  - macros\n']) {
    const root = tempSource({
      'en/base.yml': `plugins:\n${plugins}`,
      'en/mkdocs.yml': 'INHERIT: base.yml\nsite_name: New\nnav:\n  - Home: index.md\nextra:\n  product_name: Demo\n',
      'en/docs/index.md': '# New\n\nWelcome to {{ product_name }}.\n',
    });
    const out = fs.mkdtempSync(path.join(root, 'out-'));
    await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [] }, { outDir: out, route: 'new' });
    assert.match(fs.readFileSync(path.join(out, 'index.md'), 'utf8'), /Welcome to Demo\./, plugins);
  }
});

test('markdown images under the section route become page-relative when the file exists', () => {
  const exists = (rel: string) => rel === 'assets/img/a.png';
  assert.equal(relativeImages('![A](/demo/assets/img/a.png)', 'guides/setup.md', 'demo', exists), '![A](../assets/img/a.png)');
  assert.equal(relativeImages('![A](/demo/assets/img/a.png "t")', 'index.md', 'demo', exists), '![A](assets/img/a.png "t")');
  assert.equal(relativeImages('![B](/demo/assets/img/b.png)', 'index.md', 'demo', exists), '![B](/demo/assets/img/b.png)', 'missing file left alone');
  assert.equal(relativeImages('<img src="/demo/assets/img/a.png" />', 'index.md', 'demo', exists), '<img src="/demo/assets/img/a.png" />', 'HTML stays absolute');
  assert.equal(relativeImages('```\n![A](/demo/assets/img/a.png)\n```', 'index.md', 'demo', exists), '```\n![A](/demo/assets/img/a.png)\n```', 'code untouched');
});

test('only assets still referenced by absolute path are copied to static', () => {
  const root = tempSource({ 'docs/assets/a.png': 'A', 'docs/assets/b.png': 'B', 'docs/files/c.zip': 'C', 'pages/index.md': '<img src="/demo/assets/a.png" /> [zip](/demo/files/c.zip)' });
  const to = path.join(root, 'static');
  assert.equal(copyReferencedAssets(path.join(root, 'docs'), path.join(root, 'pages'), to, 'demo'), 2);
  assert.ok(fs.existsSync(path.join(to, 'assets/a.png')));
  assert.ok(fs.existsSync(path.join(to, 'files/c.zip')));
  assert.ok(!fs.existsSync(path.join(to, 'assets/b.png')));
});

test('relative HTML images, file links and API specs are copied to static, resolved against the page URL', () => {
  const root = tempSource({
    'docs/assets/img/learn/a.png': 'A', 'docs/apis/restapis/actions.yaml': 'openapi: 3.0.0', 'docs/files/guide.pdf': 'P', 'docs/assets/unused.png': 'U',
    'docs/learn/b.png': 'B', 'secret.txt': 'S',
    'pages/learn/configuring-reset.md': '<img src="../../assets/img/learn/a.png" />\n<a href={"../../files/guide.pdf"}>pdf</a>\n<img src="b.png" />',
    'pages/apis/actions-rest-api.md': '<ApiReference spec="../../apis/restapis/actions.yaml" />',
    'pages/learn/escape.md': '<img src="../../../../secret.txt" /> <img src="https://x.example/a.png" /> <a href="#x.png">x</a> <img src="%E0%A4%A.png" />',
  });
  const to = path.join(root, 'static');
  assert.equal(copyReferencedAssets(path.join(root, 'docs'), path.join(root, 'pages'), to, 'demo'), 3);
  for (const f of ['assets/img/learn/a.png', 'apis/restapis/actions.yaml', 'files/guide.pdf']) assert.ok(fs.existsSync(path.join(to, f)), f);
  assert.ok(!fs.existsSync(path.join(to, 'learn/b.png')), 'b.png resolves to learn/configuring-reset/b.png, as in a browser');
  assert.ok(!fs.existsSync(path.join(to, 'assets/unused.png')));
  assert.ok(!fs.existsSync(path.join(to, 'secret.txt')));
});

test('referencedFiles resolves like a browser and never leaves the section route', () => {
  assert.deepEqual(referencedFiles('<img src="img/a.png" />', 'guides/setup.md', 'demo'), ['guides/setup/img/a.png'], 'directory URLs');
  assert.deepEqual(referencedFiles('<img src="img/a.png" />', 'guides/index.md', 'demo'), ['guides/img/a.png']);
  assert.deepEqual(referencedFiles('<ApiReference spec="../../apis/x.yaml" />', 'apis/x-api.md', 'identity/7.1.0'), ['apis/x.yaml'], 'route with segments');
  assert.deepEqual(referencedFiles('<img src="../../../x.png" />', 'a.md', 'demo'), [], 'outside the route');
  assert.deepEqual(referencedFiles('<a href="../other/">x</a> <img src="data:image/png;base64,x" /> <a href="mailto:a@b.c">m</a>', 'a.md', 'demo'), [], 'pages, schemes');
  assert.deepEqual(referencedFiles('<img src="bad%E0.png" /> /demo/bad%E0.png', 'a.md', 'demo'), [], 'malformed escapes are skipped, not thrown');
  assert.deepEqual(referencedFiles('<img src="my%20shot.png?v=1" />', 'index.md', 'demo'), ['my shot.png']);
  assert.deepEqual(referencedFiles('<img src="../../assets/img/client secret 2.png" />', 'learn/jwt-grant.md', 'demo'), ['assets/img/client secret 2.png'], 'spaces in a quoted attribute');
  assert.deepEqual(referencedFiles('[WSDL](../../assets/attachments/a.wsdl) ![shot](img/b.png "t") [page](../other/) [ext](https://x/a.png)', 'develop/x.md', 'demo/5.9.0'),
    ['assets/attachments/a.wsdl', 'develop/x/img/b.png'], 'Markdown links and images, resolved against the page URL');
});

const componentRepo = () => tempSource({
  'en/mkdocs.yml': [
    'site_name: Platform', 'nav:', '  - Overview: index.md', '  - API Gateway:', '    - "next":', '        - Overview: api-gateway/next/overview.md',
    '    - "1.2.0":', '        - Overview: api-gateway/1.2.0/overview.md', '        - Setup:', '          - Config: api-gateway/1.2.0/setup/config.md',
    '          - Hub: policy-hub/overview.md', '',
  ].join('\n'),
  'en/docs/index.md': '# Platform\n',
  'en/docs/policy-hub/overview.md': '# Hub\n',
  'en/docs/assets/img/g.png': 'PNG',
  'en/docs/assets/img/h.png': 'PNG2',
  'en/docs/api-gateway/next/overview.md': '# Next\n',
  'en/docs/api-gateway/1.2.0/overview.md': '# Gateway\n\nSee [config](setup/config.md).\n',
  'en/docs/api-gateway/1.2.0/setup/config.md': [
    '# Config', '', 'Policies: [hub](../../../policy-hub/overview.md#list).', '', 'Upcoming: [next](../../next/overview.md).', '',
    'Back: [overview](../overview.md).', '', '![Diagram](../../../assets/img/g.png)', '',
    '<img src="../../../../assets/img/h.png" alt="h" />', '', '![Escape](../../../../../../secret.png)', '',
  ].join('\n'),
  'secret.png': 'NOT DOCS',
});

test('a version folder as section root: paths and nav ids lose the prefix; references leaving it are rewritten', async () => {
  const root = componentRepo();
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const staticDir = fs.mkdtempSync(path.join(root, 'static-'));
  const asked: string[] = [];
  const { sidebar, report } = await convertMkdocsSite({
    root, mkdocs: 'en/mkdocs.yml', deployment_options: ['Self-hosted'], currentSite: 'https://p.example/docs/api-gateway/1.2.0/',
    docsRoot: 'api-gateway/1.2.0/', nav: { root: 'API Gateway', release: '1.2.0' },
    linkOutside: (p) => { asked.push(p); return p.startsWith('api-gateway/next/') ? null : `/platform/${mkdocsUrl(p)}`; },
  }, { outDir: out, staticDir, route: 'api-gateway' });
  assert.equal(report.ok, 2);
  assert.deepEqual(fs.readdirSync(out).filter((f) => f.endsWith('.md')).sort(), ['overview.md']);
  assert.ok(fs.existsSync(path.join(out, 'setup/config.md')));
  assert.ok(!fs.existsSync(path.join(out, 'index.md')), 'pages outside the folder are not taken');
  assert.deepEqual(sidebar, [
    { type: 'doc', id: 'overview', label: 'Overview' },
    { type: 'category', label: 'Setup', items: [{ type: 'doc', id: 'setup/config', label: 'Config' }, { type: 'link', label: 'Hub', href: '/platform/policy-hub/overview/' }] },
  ]);
  assert.deepEqual(report.droppedNav, []);
  const page = fs.readFileSync(path.join(out, 'setup/config.md'), 'utf8');
  assert.match(page, /\[hub\]\(\/platform\/policy-hub\/overview\/#list\)/, 'escaping page link -> site route');
  assert.match(page, /\[next\]\(\.\.\/\.\.\/next\/overview\.md\)/, 'unmapped page link stays as written');
  assert.match(page, /\[overview\]\(\.\.\/overview\.md\)/, 'links inside the folder stay');
  assert.match(page, /!\[Diagram\]\(\.\.\/_shared\/assets\/img\/g\.png\)/, 'escaping image -> copy in the section');
  assert.equal(fs.readFileSync(path.join(out, '_shared/assets/img/g.png'), 'utf8'), 'PNG');
  assert.match(page, /src="\/api-gateway\/_shared\/assets\/img\/h\.png"/, 'HTML reference resolves against the page URL');
  assert.equal(fs.readFileSync(path.join(staticDir, '_shared/assets/img/h.png'), 'utf8'), 'PNG2');
  assert.match(page, /\(\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/secret\.png\)/, 'a reference outside docs_dir stays as written');
  assert.ok(!fs.readdirSync(out, { recursive: true }).some((f) => String(f).endsWith('secret.png')), 'nothing outside docs_dir is copied');
  assert.deepEqual([...new Set(asked)].sort(), ['api-gateway/next/overview.md', 'policy-hub/overview.md']);
});

test('docs_root must be a folder inside docs_dir', async () => {
  const root = componentRepo();
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  for (const docsRoot of ['../', '../../', '/etc/', 'missing/', '.']) {
    await assert.rejects(convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [], docsRoot }, { outDir: out, route: 'x' }), /docs_root must be a folder inside docs_dir/, docsRoot);
  }
  fs.symlinkSync(path.dirname(root), path.join(root, 'en/docs/link'));
  await assert.rejects(convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [], docsRoot: 'link/' }, { outDir: out, route: 'x' }), /docs_root must be a folder inside docs_dir/);
});

test('a section sharing the source: links into folders it skips map through linkOutside', async () => {
  const root = componentRepo();
  fs.writeFileSync(path.join(root, 'en/docs/index.md'), '# Platform\n\n[Gateway](api-gateway/1.2.0/overview.md) and [hub](policy-hub/overview.md).\n');
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  await convertMkdocsSite({
    root, mkdocs: 'en/mkdocs.yml', deployment_options: [], skip: ['api-gateway/'], nav: { drop: ['API Gateway'] },
    linkOutside: (p) => (p.startsWith('api-gateway/1.2.0/') ? `/gw/${mkdocsUrl(p.slice(18))}` : null),
  }, { outDir: out, route: 'platform' });
  assert.match(fs.readFileSync(path.join(out, 'index.md'), 'utf8'), /\[Gateway\]\(\/gw\/overview\/\) and \[hub\]\(policy-hub\/overview\.md\)/);
});

/** Image sources and JSX src/href attributes in an MDX page, as the MDX parser reads them. */
async function parsedRefs(mdx: string): Promise<{ images: string[]; attrs: string[] }> {
  const images: string[] = [];
  const attrs: string[] = [];
  type Node = { type: string; url?: string; name?: string; value?: unknown; attributes?: Node[]; children?: Node[] };
  const visit = (n: Node): void => {
    if (n.type === 'image') images.push(n.url!);
    for (const a of n.attributes ?? []) if (a.name === 'src' || a.name === 'href') attrs.push(String(a.value));
    for (const c of n.children ?? []) visit(c);
  };
  await compile(mdx, { remarkPlugins: [() => (tree: Node) => { visit(tree); }] });
  return { images, attrs };
}

test('rewriteOutsideRefs re-encodes the path it writes: %20 stays an image, %22 cannot break the attribute', async () => {
  const root = componentRepo();
  const docsDir = path.join(root, 'en/docs');
  fs.writeFileSync(path.join(docsDir, 'assets/img/four core.svg'), 'SVG');
  fs.writeFileSync(path.join(docsDir, 'assets/img/q"u<o{e.png'), 'PNG');
  fs.writeFileSync(path.join(docsDir, 'assets/img/q&a.png'), 'PNG');
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const staticDir = fs.mkdtempSync(path.join(root, 'static-'));
  const mdx = [
    '![Four cores](../../../assets/img/four%20core.svg)', '',
    '![Quote](../../../assets/img/q%22u%3Co%7Be.png)', '',
    '<img src="../../../../assets/img/q%22u%3Co%7Be.png" alt="q" />', '',
    '<img src="../../../../assets/img/q&a.png" alt="amp" />', '',
    '<a href="../../../../assets/img/four%20core.svg">chart</a>', '',
  ].join('\n');
  const rewritten = rewriteOutsideRefs(mdx, {
    rel: 'setup/config.md', pageSrc: 'api-gateway/1.2.0/setup/config.md', docsDir, route: 'gw', outDir: out, staticDir,
    inside: (p) => p.startsWith('api-gateway/1.2.0/'),
  });
  assert.ok(!rewritten.includes('four core'), 'no decoded space is written back');
  assert.ok(fs.existsSync(path.join(out, '_shared/assets/img/four core.svg')), 'the file is found and copied by its decoded name');
  assert.ok(fs.existsSync(path.join(staticDir, '_shared/assets/img/q"u<o{e.png')));
  const { images, attrs } = await parsedRefs(rewritten);
  assert.deepEqual(images, ['../_shared/assets/img/four%20core.svg', '../_shared/assets/img/q%22u%3Co%7Be.png'], 'both stay parsed images');
  assert.deepEqual(attrs, ['/gw/_shared/assets/img/q%22u%3Co%7Be.png', '/gw/_shared/assets/img/q%26a.png', '/gw/_shared/assets/img/four%20core.svg']);
  assert.ok(!/!\[|\]\(/.test(rewritten.replace(/!\[[^\]]*\]\([^)\s]+\)/g, '')), 'no literal Markdown left over');
});

test('encodePath escapes what would end a Markdown destination or an attribute, and keeps path separators', () => {
  assert.equal(encodePath('_shared/a b/c"d<e>f&g{h}(i)#j?k%l\'m.png'), '_shared/a%20b/c%22d%3Ce%3Ef%26g%7Bh%7D%28i%29%23j%3Fk%25l%27m.png');
  assert.equal(encodePath('/route/ünï/x-y_z.~.png'), '/route/%C3%BCn%C3%AF/x-y_z.~.png');
});

test('rewriteOutsideRefs leaves a reference that decodes to a NUL byte as written', () => {
  const root = componentRepo();
  const docsDir = path.join(root, 'en/docs');
  const mdx = '![x](../../../assets/%00.png) <img src="../../../../assets/%00.png" />';
  assert.equal(rewriteOutsideRefs(mdx, {
    rel: 'setup/config.md', pageSrc: 'api-gateway/1.2.0/setup/config.md', docsDir, route: 'gw', outDir: fs.mkdtempSync(path.join(root, 'out-')),
    inside: (p) => p.startsWith('api-gateway/1.2.0/'),
  }), mdx);
});

test('rewriteOutsideRefs writes a `$` in a file name or suffix as written, not as a replacement pattern', () => {
  const root = componentRepo();
  const docsDir = path.join(root, 'en/docs');
  fs.writeFileSync(path.join(docsDir, 'assets/img/d$$x.png'), 'PNG');
  fs.writeFileSync(path.join(docsDir, "assets/img/e$'y.png"), 'PNG');
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  const staticDir = fs.mkdtempSync(path.join(root, 'static-'));
  const rewritten = rewriteOutsideRefs("![d](../../../assets/img/d$$x.png#a$&b) <img src=\"../../../../assets/img/e$'y.png\" />", {
    rel: 'setup/config.md', pageSrc: 'api-gateway/1.2.0/setup/config.md', docsDir, route: 'gw', outDir: out, staticDir,
    inside: (p) => p.startsWith('api-gateway/1.2.0/'),
  });
  assert.equal(rewritten, '![d](../_shared/assets/img/d$$x.png#a$&b) <img src="/gw/_shared/assets/img/e$%27y.png" />');
});

test('a page with no title and no H1 is titled like MkDocs: nav label, else the file name', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: T\nnav:\n  - Home: index.md\n  - "Guides: all":\n      - guides/index.md\n      - guides/set_up-steps.md\n  - Named: guides/named.md\n',
    'en/docs/index.md': '<div class="homePage">Hi</div>\n',
    'en/docs/guides/index.md': 'Guide list.\n',
    'en/docs/guides/set_up-steps.md': 'Steps.\n',
    'en/docs/guides/named.md': 'Named.\n',
    'en/docs/guides/headed.md': '# Has heading\n',
    'en/docs/guides/titled.md': '---\ntitle: From front matter\n---\nText.\n',
    'en/docs/admin-guide/index.md': 'Admin.\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [] }, { outDir: out, route: 't' });
  const title = (rel: string) => fs.readFileSync(path.join(out, rel), 'utf8').match(/^title: (.*)$/m)?.[1];
  assert.equal(title('index.md'), 'Home', 'nav label');
  assert.equal(title('guides/named.md'), 'Named');
  assert.equal(title('guides/set_up-steps.md'), 'Set up steps', 'file name: - and _ become spaces, first letter capitalised');
  assert.equal(title('guides/index.md'), 'Guides', 'an index page takes its folder name');
  assert.equal(title('admin-guide/index.md'), 'Admin guide');
  assert.equal(title('guides/headed.md'), 'Has heading');
  assert.equal(title('guides/titled.md'), 'From front matter');
});

test('mkdocsTitle: nav label first, then the file or folder name', () => {
  assert.equal(mkdocsTitle('a/introduction-to-user-management.md'), 'Introduction to user management');
  assert.equal(mkdocsTitle('a/FAQs.md'), 'FAQs');
  assert.equal(mkdocsTitle('a/configure-myAPI_keys.md'), 'configure myAPI keys', 'mixed case is kept as written, as MkDocs does');
  assert.equal(mkdocsTitle('a/OAuth2-grant.md'), 'OAuth2 grant');
  assert.equal(mkdocsTitle('index.md'), 'Home');
  assert.equal(mkdocsTitle('my_section/index.md'), 'My section');
  assert.equal(mkdocsTitle('my_section/README.md'), 'My section');
  assert.equal(mkdocsTitle('x.md', 'Label'), 'Label');
});

test('the merged pair also titles pages from the nav', async () => {
  const root = tempSource({
    'cloud/mkdocs.yml': 'site_name: C\nnav:\n  - Start here: p.md\n',
    'cloud/docs/p.md': 'Cloud text.\n',
    'self/mkdocs.yml': 'site_name: S\nnav:\n  - p.md\n',
    'self/docs/p.md': 'Self text.\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  await convertMergedSites({ cloud: { root, mkdocs: 'cloud/mkdocs.yml' }, self: { root, mkdocs: 'self/mkdocs.yml' } }, { outDir: out, route: 'p' });
  assert.match(fs.readFileSync(path.join(out, 'p.md'), 'utf8'), /^title: Start here$/m);
});

test('a host-only base_path followed by /en/<version>/ becomes the full former-site URL; other uses stay on the route', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: K\nplugins:\n  - markdownextradata\nextra:\n  base_path: https://k.example\n  site_version: 1.3.0\n',
    'en/docs/index.md': '# K\n\n<a href="{{base_path}}/en/{{site_version}}/about/what-is/">What</a> [latest]({{base_path}}/en/latest/setup/) ![i]({{base_path}}/assets/i.png)\n',
    'en/docs/assets/i.png': 'PNG',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [] }, { outDir: out, route: 'k' });
  const page = fs.readFileSync(path.join(out, 'index.md'), 'utf8');
  assert.match(page, /href="https:\/\/k\.example\/en\/1\.3\.0\/about\/what-is\/"/);
  assert.match(page, /\[latest\]\(https:\/\/k\.example\/en\/latest\/setup\/\)/);
  assert.match(page, /!\[i\]\(assets\/i\.png\)/, 'not /en/: the route, as before');

  const withPath = tempSource({
    'en/mkdocs.yml': 'site_name: M\nplugins:\n  - markdownextradata\nextra:\n  base_path: https://m.example/en/4.4.0\n',
    'en/docs/index.md': '# M\n\n[x]({{base_path}}/en/4.4.0/x/)\n',
  });
  const out2 = fs.mkdtempSync(path.join(withPath, 'out-'));
  await convertMkdocsSite({ root: withPath, mkdocs: 'en/mkdocs.yml', deployment_options: [] }, { outDir: out2, route: 'm' });
  assert.match(fs.readFileSync(path.join(out2, 'index.md'), 'utf8'), /\[x\]\(\/m\/en\/4\.4\.0\/x\/\)/, 'a base_path with a path keeps mapping to the route');
});

test('a README.md is its folder index (no index.md beside it); otherwise it stays pinned', async () => {
  const root = tempSource({
    'en/mkdocs.yml': 'site_name: R\n',
    'en/docs/gw/README.md': '# Gateway\n\n[analytics](analytics/)\n',
    'en/docs/gw/analytics/index.md': '# Analytics\n',
    'en/docs/both/README.md': '# Readme\n',
    'en/docs/both/index.md': '# Index\n',
    'en/docs/low/readme.md': '# lower\n',
  });
  const out = fs.mkdtempSync(path.join(root, 'out-'));
  await convertMkdocsSite({ root, mkdocs: 'en/mkdocs.yml', deployment_options: [] }, { outDir: out, route: 'r' });
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'gw/README.md'), 'utf8'), /^slug:/m, 'Docusaurus serves it at gw/');
  assert.match(fs.readFileSync(path.join(out, 'both/README.md'), 'utf8'), /^slug: \/both\/README\/$/m);
  assert.match(fs.readFileSync(path.join(out, 'low/readme.md'), 'utf8'), /^slug: \/low\/readme\/$/m, 'MkDocs matches README exactly');
  assert.equal(mkdocsUrl('gw/README.md'), 'gw/');
  assert.equal(mkdocsUrl('README.md'), '');
  assert.equal(mkdocsUrl('low/readme.md'), 'low/readme/');
  assert.equal(keepMkdocsUrl('---\ntitle: a\n---\nx', 'gw/README.md', { readmeIndex: true }), '---\ntitle: a\n---\nx');
  assert.equal(keepMkdocsUrl('---\ntitle: a\n---\nx', 'gw/README.md'), '---\nslug: /gw/README/\ntitle: a\n---\nx');
});

test('containedFile resolves symbolic links and refuses files outside the root', () => {
  const root = tempSource({ 'docs/assets/a.png': 'A', 'outside/secret.png': 'S', 'docs/sub/b.png': 'B' });
  const docs = path.join(root, 'docs');
  fs.symlinkSync(path.join(root, 'outside/secret.png'), path.join(docs, 'assets/link.png'));
  fs.symlinkSync(path.join(root, 'outside'), path.join(docs, 'assets/dir'));
  fs.symlinkSync(path.join(docs, 'sub/b.png'), path.join(docs, 'assets/inside.png'));
  assert.equal(containedFile(docs, 'assets/a.png'), fs.realpathSync(path.join(docs, 'assets/a.png')));
  assert.equal(containedFile(docs, 'assets/inside.png'), fs.realpathSync(path.join(docs, 'sub/b.png')), 'a link inside the root is fine');
  assert.equal(containedFile(docs, 'assets/link.png'), null, 'file link pointing outside');
  assert.equal(containedFile(docs, 'assets/dir/secret.png'), null, 'folder link pointing outside');
  assert.equal(containedFile(docs, '../outside/secret.png'), null);
  assert.equal(containedFile(docs, 'assets'), null, 'not a file');
  assert.equal(containedFile(docs, 'assets/none.png'), null);
});

test('copyReferencedAssets never copies a symbolic link that points outside the source', () => {
  const root = tempSource({ 'docs/assets/a.png': 'A', 'outside/secret.png': 'S', 'pages/index.md': '<img src="/demo/assets/a.png" /> <img src="/demo/assets/link.png" />' });
  fs.symlinkSync(path.join(root, 'outside/secret.png'), path.join(root, 'docs/assets/link.png'));
  const to = path.join(root, 'static');
  assert.equal(copyReferencedAssets(path.join(root, 'docs'), path.join(root, 'pages'), to, 'demo'), 1);
  assert.ok(fs.existsSync(path.join(to, 'assets/a.png')));
  assert.ok(!fs.existsSync(path.join(to, 'assets/link.png')));
});
