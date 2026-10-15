import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lifecycleBadge, withLifecycleSidebar } from '../src/lib/lifecycle.mjs';

const both = ['WSO2 Cloud', 'Self-hosted'];
const DEPRECATED_LINE = 'Still works, but not recommended; it will be removed in a future release.';

test('a stage that covers all of the page\'s deployment options shows without a scope, with its one-line explanation', () => {
  assert.deepEqual(lifecycleBadge({ deployment_options: ['Self-hosted'], status: 'deprecated', deprecated_since: '7.0.0' }),
    { stage: 'deprecated', text: 'Deprecated', title: DEPRECATED_LINE });
  assert.deepEqual(lifecycleBadge({ deployment_options: both, lifecycle: {
    'WSO2 Cloud': { status: 'deprecated', deprecated_since: '2026-03' }, 'Self-hosted': { status: 'deprecated', deprecated_since: '7.3.0' },
  } }), { stage: 'deprecated', text: 'Deprecated', title: DEPRECATED_LINE });
  assert.equal(lifecycleBadge({ deployment_options: both, status: 'beta' }).title, 'Available to everyone; may change before general availability.');
  assert.equal(lifecycleBadge({ deployment_options: both, status: 'preview' }).title, 'Turn it on in the Console under Feature Preview before use.');
});

test('a stage on only some of the page\'s options names them', () => {
  assert.equal(lifecycleBadge({ deployment_options: both, lifecycle: { 'WSO2 Cloud': { status: 'deprecated', deprecated_since: '2026-06' } } }).text, 'Deprecated · WSO2 Cloud');
});

test('Preview wins over another stage', () => {
  const badge = lifecycleBadge({ deployment_options: both, lifecycle: { 'WSO2 Cloud': { status: 'preview' }, 'Self-hosted': { status: 'beta' } } });
  assert.deepEqual(badge, { stage: 'preview', text: 'Preview · WSO2 Cloud', title: 'Turn it on in the Console under Feature Preview before use.' });
});

test('no stage, or a value the site does not know, shows no badge', () => {
  assert.equal(lifecycleBadge({ deployment_options: both }), null);
  assert.equal(lifecycleBadge({ deployment_options: both, status: 'retired' }), null);
  assert.equal(lifecycleBadge({}), null);
});

test('the sidebar entry gets a class and custom props from the stage; the author\'s own class stays', () => {
  const fm = withLifecycleSidebar({ deployment_options: both, lifecycle: { 'WSO2 Cloud': { status: 'deprecated', deprecated_since: '2026-06' } } });
  assert.equal(fm.sidebar_class_name, 'lifecycle-entry lifecycle-entry--deprecated');
  assert.deepEqual(fm.sidebar_custom_props, { lifecycle: 'deprecated' });
  const own = withLifecycleSidebar({ status: 'beta', sidebar_class_name: 'mine', sidebar_custom_props: { icon: 'x' } });
  assert.equal(own.sidebar_class_name, 'mine lifecycle-entry lifecycle-entry--beta');
  assert.deepEqual(own.sidebar_custom_props, { icon: 'x', lifecycle: 'beta' });
  const plain = { title: 'GA' };
  assert.equal(withLifecycleSidebar(plain), plain, 'a generally available page is left as it is');
});
