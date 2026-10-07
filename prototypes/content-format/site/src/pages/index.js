// PROTOTYPE home: every product, grouped like wso2.com/documentation; one card per product.
import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { GROUPS, PRODUCTS, HUB } from '@site/src/components/catalogue';
export default function Home() {
  return (<Layout title="Home"><main className="container margin-vert--lg">
    <h1>WSO2 documentation</h1>
    <p>One place for every product. Each page shows which deployment options it covers: WSO2 Cloud, Hybrid or Self-hosted.</p>
    {GROUPS.map((g) => (<section key={g} className="margin-bottom--lg"><h2>{g}</h2><div className="row">
      {PRODUCTS.filter((p) => p.group === g).map((p) => (
        <div className="col col--4 margin-bottom--md" key={p.id}>
          <Link className="card padding--md" style={{ height: '100%', color: 'inherit' }} to={p.href ?? p.sections[0].path}>
            <h3>{p.name}{p.href ? ' ↗' : ''}</h3><span>{p.blurb}</span></Link></div>))}</div></section>))}
    <h2>WSO2 Cloud account</h2><ul>{HUB.map(([l, h]) => <li key={l}><Link to={h}>{l}</Link></li>)}</ul>
  </main></Layout>);
}
