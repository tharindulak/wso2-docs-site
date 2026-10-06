// PROTOTYPE, throwaway. Usage: node scripts/convert-docs-is.mjs <docs-is checkout> <out dir>
// Converts Asgardeo (WSO2 Cloud) + Identity Server 7.3.0 (Self-hosted, latest) into ONE unified "Latest" doc set.
import fs from 'node:fs';
import path from 'node:path';
import { renderSingle, load } from './jinja.mjs';
import { mergePage } from './merge.mjs';
import { convert } from './mkdocs-syntax.mjs';

const [src, outDir] = process.argv.slice(2);
const C = path.join(src, 'en/asgardeo/docs'), S = path.join(src, 'en/identity-server/7.3.0/docs');
const walk = (d, b = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), b) : e.name.endsWith('.md') ? [path.relative(b, path.join(d, e.name))] : []));
const envCloud = () => ({ product_name: 'WSO2 Identity Platform', product: 'asgardeo', base_path: '/identity' });
const envSelf = () => ({ product_name: 'WSO2 Identity Server', product: 'is', base_path: '/identity', is_version: '7.3.0',
  content: { default_keystore_type: 'PKCS12', default_keystore_ext: 'p12', sdkconfig: { baseUrl: 'https://localhost:9443' } } });

const stats = { pages: 0, merged: 0, diverged: 0, cloudOnly: 0, selfOnly: 0, failed: [], conditionals: 0, conditionalsAgree: 0, blocksSplit: 0,
  splitInsideCode: 0, productNameShared: 0, varsDiffer: {}, admonitions: 0, details: 0, tabs: 0, attrList: 0, htmlTouched: 0, unknown: 0 };
const cs = new Set(walk(C)), ss = new Set(walk(S));
fs.rmSync(outDir, { recursive: true, force: true });
for (const rel of [...new Set([...cs, ...ss])].sort()) {
  stats.pages++;
  let body, deploy;
  try {
    if (cs.has(rel) && ss.has(rel)) { const r = mergePage(path.join(C, rel), path.join(S, rel), envCloud(), envSelf(), stats); stats[r.kind]++; body = r.body; deploy = ['WSO2 Cloud', 'Self-hosted']; }
    else if (cs.has(rel)) { stats.cloudOnly++; body = renderSingle(load(path.join(C, rel)), envCloud(), path.join(C, rel), stats); deploy = ['WSO2 Cloud']; }
    else { stats.selfOnly++; body = renderSingle(load(path.join(S, rel)), envSelf(), path.join(S, rel), stats); deploy = ['Self-hosted']; }
  } catch (e) { stats.failed.push(`${rel}: ${e.message.slice(0, 120)}`); continue; }
  const { body: mdx, usesTabs } = convert(body, stats);
  const imports = `import Applies from '@site/src/components/Applies';\nimport DeploymentValue from '@site/src/components/DeploymentValue';\n${usesTabs ? "import Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\n" : ''}`;
  const out = path.join(outDir, rel.replace(/\.md$/, '.mdx'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `---\ndeployment_options: ${JSON.stringify(deploy)}\nsidebar_custom_props: { deployment: ${JSON.stringify(deploy)} }\n---\n\n${imports}\n${mdx.trim()}\n`);
}
fs.writeFileSync(path.join(outDir, '..', 'convert-stats.json'), JSON.stringify(stats, null, 2));
const { failed, varsDiffer, ...rest } = stats;
console.log(JSON.stringify({ ...rest, failedCount: failed.length, failedSample: failed.slice(0, 5), varsDiffer }, null, 2));
