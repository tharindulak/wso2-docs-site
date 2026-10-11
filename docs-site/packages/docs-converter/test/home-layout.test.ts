import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHomeLayout, nameIconLinks } from '../src/home-layout.js';
import { convertRendered } from '../src/page.js';

// As wso2/docs-apk en/docs/index.md (Kubernetes Gateway 1.0.0).
const APK_HOME = `<div class="homePage">
    <div class="section01">
        <div class="leftContent">
            <div class="about-home">
                    <div>
                        APK is WSO2's cloud native API management platform.
                    </div>
                <div>
                    <a href="https://wso2.com/blogs/thesource/announcing-wso2-api-platform-for-kubernetes/" class="banner-link"></a>
                </div>
            </div>
            <div class="download-btn-wrapper">
                 <h2>Download</h2>
                <a href="https://github.com/wso2/apk/releases">
                    <i class="fa-solid fa-file-arrow-down"></i>
                </a>
            </div>
        </div>
    </div>
    <div class="section02">
        <div class="linkWrapper">
            <div class="linkSet2">
                <a href="get-started/quick-start-guide"><h3>Quick Start Guide</h3></a>
                <p>Start here.</p>
            </div>
        </div>
    </div>
</div>
`;

test('an icon-only anchor gets visible text: title or aria-label, else the preceding heading in its wrapper, else the host', () => {
  const home = nameIconLinks(APK_HOME);
  assert.match(home, /<a href="https:\/\/github\.com\/wso2\/apk\/releases">Download<\/a>/, 'the heading in the same wrapper names it');
  assert.doesNotMatch(home, /fa-file-arrow-down/, 'the icon cannot render without Font Awesome');
  assert.equal(nameIconLinks('<h2>Elsewhere</h2>\n<p><a href="https://x.io/a" title="Get it"><i class="fa fa-download"></i></a></p>'), '<h2>Elsewhere</h2>\n<p><a href="https://x.io/a" title="Get it">Get it</a></p>');
  assert.equal(nameIconLinks('<a aria-label="Releases" href="/r"><span class="fa fa-x"></span></a>'), '<a aria-label="Releases" href="/r">Releases</a>');
  assert.equal(nameIconLinks('<h2>Before</h2><div><a href="https://github.com/wso2/apk"><i class="fab fa-github"></i></a></div>'),
    '<h2>Before</h2><div><a href="https://github.com/wso2/apk">github.com</a></div>', 'a heading outside the wrapper does not name it');
  assert.equal(nameIconLinks('<a href="&lt;x&gt;"><i class="fa fa-x"></i></a>'), '<a href="&lt;x&gt;">&lt;x&gt;</a>', 'names are escaped');
});

test('an empty decorative anchor is dropped, or named from its title; jump targets and real links stay', () => {
  assert.doesNotMatch(nameIconLinks(APK_HOME), /banner-link/);
  assert.equal(nameIconLinks('<p>a<a href="https://x.io"> &nbsp;<!-- banner --><br/> </a>b</p>'), '<p>ab</p>', 'whitespace, comments and <br> are empty');
  assert.equal(nameIconLinks('<a href="https://x.io" title="Announcement"></a>'), '<a href="https://x.io" title="Announcement">Announcement</a>');
  assert.equal(nameIconLinks('<a href="https://x.io" id="top" class="banner"></a>'), '<a id="top"></a>', 'an id stays as a target');
  for (const kept of ['<a name="anchor"></a>', '<a href="#cb1-1"></a>', '<a href="x"><img src="a.png" alt="A"></a>', '<a href="x">Text</a>',
    '<a href="get-started/quick-start-guide"><h3>Quick Start Guide</h3></a>', '`<a href="x"></a>`', '```html\n<a href="x"><i class="fa fa-x"></i></a>\n```\n',
    // Any element or component child may render (a logo, a CSS background, a React icon): the link stays.
    '<a href="x"><Icon /></a>', '<a href="x"><ThemedImage sources={{}} /></a>', '<a href="x"><span class="logo"></span></a>',
    '<a href="x"><div class="bg"></div></a>', '<a href="x"><canvas></canvas></a>',
    // Indented code (after a blank line, outside a raw HTML block) is code, as on MkDocs.
    'Text.\n\n    <a href="x"></a>\n    <a href="y"><i class="fa fa-x"></i></a>\n']) {
    assert.equal(nameIconLinks(kept), kept);
  }
});

test('unquoted attribute values and quoted values holding > are read', () => {
  assert.equal(nameIconLinks('<h2>Get</h2><a href=https://x.io/r><i class=fa-solid></i></a>'), '<h2>Get</h2><a href=https://x.io/r>Get</a>');
  assert.equal(nameIconLinks('<a href=https://x.io></a>'), '');
  assert.equal(nameIconLinks('<a href=https://x.io id=top></a>'), '<a id=top></a>');
  assert.equal(nameIconLinks('<a title="a > b" href="x"><i class="fa"></i></a>'), '<a title="a > b" href="x">a &gt; b</a>');
});

test('a raw HTML block that starts at column 0 is prose even where indented; code around it is not', () => {
  const page = `Intro.\n\n${APK_HOME}\n    <a href="z"></a>\n`;
  const out = nameIconLinks(page);
  assert.match(out, /releases">Download<\/a>/, 'the indented home layout is converted');
  assert.match(out, /<a href="z"><\/a>/, 'indented code after the block is not');
});

test('isHomeLayout recognises the homePage wrapper in HTML and JSX', () => {
  assert.ok(isHomeLayout(APK_HOME));
  assert.ok(isHomeLayout('<div className="homePage">'));
  assert.ok(isHomeLayout('<div className={"x homePage"}>'));
  assert.ok(isHomeLayout('<div class=homePage>'));
  assert.ok(!isHomeLayout('# Home\n\nThe homePage class is described here.\n'));
  assert.ok(!isHomeLayout('Layout:\n\n```html\n<div class="homePage">\n```\n'), 'fenced code');
  assert.ok(!isHomeLayout('Layout:\n\n    <div class="homePage">\n'), 'indented code');
  assert.ok(!isHomeLayout('Use `<div class="homePage">`.'), 'inline code');
});

test('hide_title is set only for a synthesized title on a custom home layout', async () => {
  const opts = { deploymentOptions: ['Self-hosted' as const], fallbackTitle: 'Home' };
  const home = (await convertRendered(APK_HOME, opts)).mdx;
  assert.match(home, /^title: Home$/m, 'the title stays for the tab, breadcrumb and search');
  assert.match(home, /^hide_title: true$/m);
  assert.match(home, /<a href="https:\/\/github\.com\/wso2\/apk\/releases">Download<\/a>/);
  const plain = (await convertRendered('Some text without a heading.\n', opts)).mdx;
  assert.match(plain, /^title: Home$/m);
  assert.doesNotMatch(plain, /hide_title/, 'an ordinary page shows its synthesized title as MkDocs does');
  const ownH1 = (await convertRendered(`# Welcome\n\n${APK_HOME}`, opts)).mdx;
  assert.match(ownH1, /^title: Welcome$/m);
  assert.doesNotMatch(ownH1, /hide_title/);
  const fenced = (await convertRendered('Shows the layout:\n\n```html\n<div class="homePage">\n</div>\n```\n', opts)).mdx;
  assert.doesNotMatch(fenced, /hide_title/, 'a layout shown in code is not the page layout');
  const ownTitle = (await convertRendered(`---\ntitle: Docs\n---\n${APK_HOME}`, opts)).mdx;
  assert.doesNotMatch(ownTitle, /hide_title/, 'a page that names itself keeps its title as written');
});
