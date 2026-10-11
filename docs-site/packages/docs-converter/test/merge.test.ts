import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mergePage } from '../src/merge.js';
import { tempSource } from './helpers.js';

test('shared text kept once; differing branches and values labelled', () => {
  const root = tempSource({
    'cloud/p.md': '{% set host = "api.example.io" %}{% include "../inc/p.md" %}',
    'self/p.md': '{% set host = "localhost:9443" %}{% include "../inc/p.md" %}',
    'inc/p.md': '{{ product_name }} intro.\n{% if product_name == "Cloud P" %}Console steps.{% else %}Edit deployment.toml.{% endif %}\nHost {{ host }}.\n```\ncurl https://{{ host }}/x\n```\n',
  });
  const source = { root, includeBases: [] };
  const sides = { cloud: { env: { product_name: 'Cloud P' }, source }, self: { env: { product_name: 'Server P' }, source } };
  const { text, stats } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), sides, { product_name: 'Platform P' });
  assert.match(text, /^Platform P intro\./);
  assert.match(text, /<Applies to="WSO2 Cloud">\n\nConsole steps\.\n\n<\/Applies>/);
  assert.match(text, /<Applies to="Self-hosted">\n\nEdit deployment\.toml\.\n\n<\/Applies>/);
  assert.match(text, /<DeploymentValue cloud="api\.example\.io" selfHosted="localhost:9443" \/>/);
  assert.match(text, /curl https:\/\/<HOST>\/x/);
  assert.equal(stats.diverged, false);
});

test('wrappers that include different files are kept whole and labelled', () => {
  const root = tempSource({ 'cloud/p.md': 'Cloud only page.', 'self/p.md': 'Self page.' });
  const source = { root, includeBases: [] };
  const { text, stats } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.equal(stats.diverged, true);
  assert.match(text, /<Applies to="WSO2 Cloud">\n\nCloud only page\./);
});

test('wrappers differing only in front matter or quick-start meta still merge page by page', () => {
  const root = tempSource({
    'cloud/p.md': '---\ntemplate: t.html\n---\n<script>const meta = { pkg: "a" };</script>\n{% include "../inc/p.md" %}',
    'self/p.md': '---\ntemplate: t.html\n---\n<script>const meta = { pkg: "b" };</script>\n{% include "../inc/p.md" %}',
    'inc/p.md': '# Quickstart\nShared.',
  });
  const source = { root, includeBases: [] };
  const { text, stats } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.equal(stats.diverged, false);
  assert.equal(text.trim(), '# Quickstart\nShared.');
});

test('differences inside code split the whole sample; indented content keeps its container', () => {
  const root = tempSource({
    'cloud/p.md': '{% include "../inc/p.md" %}', 'self/p.md': '{% include "../inc/p.md" %}',
    'inc/p.md': '=== "Python"\n    ```python\n    run({% if product_name == "C" %}CLOUD_CFG{% else %}IS_CFG{% endif %})\n    ```\n\n!!! note\n    Shared.\n    {% if product_name == "C" %}\n    Cloud tip.\n    {% endif %}\n',
  });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: { product_name: 'C' }, source }, self: { env: { product_name: 'S' }, source } });
  assert.match(text, / {4}<Applies to="WSO2 Cloud">\n\n {4}```python\n {4}run\(CLOUD_CFG\)\n {4}```\n\n {4}<\/Applies>/);
  assert.match(text, / {4}<Applies to="Self-hosted">\n\n {4}```python\n {4}run\(IS_CFG\)\n {4}```/);
  assert.match(text, / {4}<Applies to="WSO2 Cloud">\n\n {4}Cloud tip\.\n\n {4}<\/Applies>/);
  assert.doesNotMatch(text, /\u2063/);
});

test('an indented include whose later lines are not indented stays inside its list item', () => {
  const root = tempSource({
    'cloud/p.md': '{% include "../inc/p.md" %}', 'self/p.md': '{% include "../inc/p.md" %}',
    'inc/p.md': '1. Step\n\n    {% include "frag.md" %}\n',
    'inc/frag.md': '{% if product_name == "C" %}=== "Classic"\n    A\n\n=== "Visual"\n    B\n{% endif %}',
  });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: { product_name: 'C' }, source }, self: { env: { product_name: 'S' }, source } });
  assert.match(text, / {4}<Applies to="WSO2 Cloud">\n\n {4}=== "Classic"\n {8}A\n\n {4}=== "Visual"\n {8}B\n\n {4}<\/Applies>/);
});

test('a differing value inside inline code becomes a placeholder, not a component', () => {
  const root = tempSource({ 'cloud/p.md': '{% set product = "asgardeo" %}{% include "../inc/p.md" %}', 'self/p.md': '{% set product = "is" %}{% include "../inc/p.md" %}', 'inc/p.md': 'Name: `{{ product }}-react`, then {{ product }}.' });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.match(text, /^Name: `<PRODUCT>-react`, then <DeploymentValue cloud="asgardeo" selfHosted="is" \/>\.$/);
});

test('a variable on its own line that is a list item for one option only becomes a labelled block (Magic Link prerequisites)', () => {
  const root = tempSource({
    'cloud/p.md': '{% set note = "" %}{% include "../inc/p.md" %}',
    'self/p.md': '{% set note = "- You need to [configure the email sending module](../email.md) first." %}{% include "../inc/p.md" %}',
    'inc/p.md': '## Prerequisites\n\n- Register an application.\n\n{{ note }}\n\n## Next\n',
  });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.match(text, /<Applies to="Self-hosted">\n\n- You need to \[configure the email sending module\]\(\.\.\/email\.md\) first\.\n\n<\/Applies>/);
  assert.doesNotMatch(text, /DeploymentValue|Applies to="WSO2 Cloud"/, 'no code pair, no empty cloud block');
});

test('Markdown structure on its own line splits even when both options have a value; words and inline values stay a pair', () => {
  const root = tempSource({
    'cloud/p.md': '{% set step = "- Open the Console." %}{% set host = "api.example.io" %}{% set extra = "" %}{% include "../inc/p.md" %}',
    'self/p.md': '{% set step = "- Edit deployment.toml." %}{% set host = "localhost:9443" %}{% set extra = " (restart required)" %}{% include "../inc/p.md" %}',
    'inc/p.md': '{{ step }}\n\n{{ host }}\n\nSave the file{{ extra }}.\n',
  });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.match(text, /<Applies to="WSO2 Cloud">\n\n- Open the Console\.\n\n<\/Applies>/);
  assert.match(text, /<Applies to="Self-hosted">\n\n- Edit deployment\.toml\.\n\n<\/Applies>/);
  assert.match(text, /<DeploymentValue cloud="api\.example\.io" selfHosted="localhost:9443" \/>/, 'a plain value on its own line stays a pair');
  assert.match(text, /Save the file<DeploymentValue cloud="" selfHosted=" \(restart required\)" \/>\./, 'inline, one-sided: a value the component labels "only"');
});

test('a one-sided value at the start of a sentence stays inline (user roles: "{{ admin_role }} role. An ...")', () => {
  const root = tempSource({
    'cloud/p.md': '{% set admin_role = "" %}{% include "../inc/p.md" %}',
    'self/p.md': '{% set admin_role = "admin" %}{% include "../inc/p.md" %}',
    'inc/p.md': 'Roles:\n\n{{ admin_role }} role. An admin is privileged.\n',
  });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'), { cloud: { env: {}, source }, self: { env: {}, source } });
  assert.match(text, /^<DeploymentValue cloud="" selfHosted="admin" \/> role\. An admin is privileged\.$/m);
  assert.doesNotMatch(text, /<Applies/);
});

// docs-is@c2176fcd1b50 en/includes/guides/verifiable-credentials/index.md:42: the path differs by deployment, inside a
// link target. A component there broke the link (the built page showed "/identity/<span>...</span>/"); the link is
// written once per option instead, labelled as <DeploymentValue> labels a value.
test('a differing value inside a link target writes the link once per deployment option', () => {
  const root = tempSource({
    'cloud/p.md': '{% include "../inc/p.md" %}',
    'self/p.md': '{% include "../inc/p.md" %}',
    'inc/p.md': '- [OpenID for verifiable credential issuance (OID4VCI)]({{base_path}}/{{content.oid4vci_reference_path}}/) — Understand how OID4VCI works.\n- [One side]({{base_path}}/{{content.only}}x/) and {{content.only}}.\n',
  });
  const source = { root, includeBases: [] };
  const env = (p: string, only: string) => ({ base_path: '/identity', content: { oid4vci_reference_path: p, only } });
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'),
    { cloud: { env: env('references/oid4vci', ''), source }, self: { env: env('references/concepts/oid4vci', 'y/'), source } });
  assert.equal(text.split('\n')[0], '- [OpenID for verifiable credential issuance (OID4VCI)](/identity/references/oid4vci/) <small>(WSO2 Cloud)</small> / [OpenID for verifiable credential issuance (OID4VCI)](/identity/references/concepts/oid4vci/) <small>(Self-hosted)</small> — Understand how OID4VCI works.');
  assert.equal(text.split('\n')[1], '- [One side](/identity/y/x/) <small>(Self-hosted only)</small> and <DeploymentValue cloud="" selfHosted="y/" />.');
  assert.doesNotMatch(text, /⁣/, 'no mark left');
});

// docs-is@c2176fcd1b50 en/includes/guides/authentication/oidc/add-logout.md:7: the target chosen by an {% if %} branch.
test('a differing branch inside a link target writes the link once per deployment option, not labelled blocks', () => {
  const root = tempSource({
    'cloud/p.md': '{% include "../inc/p.md" %}', 'self/p.md': '{% include "../inc/p.md" %}',
    'inc/p.md': 'use the [Session Management API]({% if product_name == "WSO2 Identity Server" %}/identity/apis/session-mgt-rest-api/{% else %}/identity/apis/session/{% endif %}). The application',
  });
  const source = { root, includeBases: [] };
  const { text } = mergePage(path.join(root, 'cloud/p.md'), path.join(root, 'self/p.md'),
    { cloud: { env: { product_name: 'Asgardeo' }, source }, self: { env: { product_name: 'WSO2 Identity Server' }, source } });
  assert.equal(text, 'use the [Session Management API](/identity/apis/session/) <small>(WSO2 Cloud)</small> / [Session Management API](/identity/apis/session-mgt-rest-api/) <small>(Self-hosted)</small>. The application');
});
