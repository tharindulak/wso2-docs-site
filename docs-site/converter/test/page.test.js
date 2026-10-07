import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertRendered, PageError } from '../page.js';

test('produces compiled MDX with front matter, imports and deployment options', async () => {
  const { mdx } = await convertRendered('---\ntitle: TOTP\ntemplate: x.html\n---\n# TOTP\n\n!!! note\n    Hi {name}.\n\n<Applies to="WSO2 Cloud">\n\nCloud.\n\n</Applies>\n', { deploymentOptions: ['WSO2 Cloud', 'Self-hosted'], editUrl: 'https://github.com/wso2/docs-is/edit/main/x.md' });
  assert.match(mdx, /^---\ntitle: TOTP\nmkdocs_template: x\ndeployment_options:\n {2}- WSO2 Cloud\n {2}- Self-hosted\ncustom_edit_url: https:\/\/github\.com/);
  assert.doesNotMatch(mdx, /^template:/m);
  assert.match(mdx, /import Applies from '@site\/src\/components\/Applies';/);
  assert.match(mdx, /:::note\n\nHi \\\{name\\\}\./);
});

test('policy, include and compile failures surface as PageError with a kind', async () => {
  await assert.rejects(convertRendered('<script>x()</script>', { deploymentOptions: [] }), (e) => e instanceof PageError && e.kind === 'policy');
  await assert.rejects(convertRendered('{!x.md!}', { deploymentOptions: [] }), (e) => e.kind === 'include');
  await assert.rejects(convertRendered('<table><tr></td></table>', { deploymentOptions: [] }), (e) => e.kind === 'compile');
});

test('title falls back to the first heading; MkDocs template and quick-start data are kept as front matter', async () => {
  const { mdx } = await convertRendered('\n[//] STEPS_START\n\n# React Quickstart\n\nBody.\n', { deploymentOptions: [], pageData: { frontMatter: { template: 'templates/quick-start.html' }, meta: { what_you_will_learn: ['A'] } } });
  assert.match(mdx, /^title: React Quickstart$/m);
  assert.match(mdx, /^mkdocs_template: quick-start$/m);
  assert.match(mdx, /^quick_start:\n {2}what_you_will_learn:\n {4}- A$/m);
  assert.doesNotMatch(mdx, /STEPS_START/);
});
