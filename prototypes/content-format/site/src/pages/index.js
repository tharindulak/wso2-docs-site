// PROTOTYPE hub home: products first, then WSO2 Cloud cross-cutting sections.
import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { PRODUCTS, HUB } from '@site/src/components/catalogue';
export default function Home() {
  return (<Layout title="Home"><main className="container margin-vert--lg">
    <h1>WSO2 documentation</h1><p>Every page shows which deployment options it covers: WSO2 Cloud, Hybrid or Self-hosted.</p>
    <h2>Products</h2><div className="row">{PRODUCTS.map((p) => (
      <div className="col col--4 margin-bottom--md" key={p.id}>
        <Link className="card padding--md" style={{ height: '100%', color: 'inherit', opacity: p.soon ? .55 : 1 }} to={p.href ?? (p.soon ? '#' : p.sections[0].path)}>
          <h3>{p.name}{p.soon ? ' (soon)' : ''}</h3><span>{p.blurb}</span>
          {p.sections?.length > 1 && <small style={{ display: 'block', marginTop: 8 }}>{p.sections.map((s) => s.label).join(' · ')}</small>}</Link></div>))}</div>
    <h2>WSO2 Cloud</h2><ul>{HUB.map(([l, h]) => <li key={l}><Link to={h}>{l}</Link></li>)}</ul>
  </main></Layout>);
}
