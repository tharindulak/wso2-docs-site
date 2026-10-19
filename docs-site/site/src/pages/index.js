// Home: every product, grouped like wso2.com/documentation; one card per product.
import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { useCatalogue, productHref, listedGroups, listedProducts } from '@site/src/components/catalogue.js';

export default function Home() {
  const catalogue = useCatalogue();
  return (
    <Layout title="Home" description="Documentation for every WSO2 product, cloud and self-hosted.">
      <main className="container margin-vert--lg">
        <h1>WSO2 documentation</h1>
        <p>Every product in one place. Each page shows which deployment options it covers: WSO2 Cloud, Hybrid or Self-hosted.</p>
        {listedGroups(catalogue).map((group) => (
          <section key={group} className="home-group">
            <h2>{group}</h2>
            <div className="row">
              {listedProducts(catalogue, group).map((p) => (
                <div key={p.id} className="col col--4 margin-bottom--md">
                  <Link className="card padding--md home-card" to={productHref(p)} target={p.href ? '_self' : undefined}>
                    <h3>{p.name}{p.href ? ' ↗' : ''}</h3>
                    <span>{p.blurb}</span>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ))}
        {!catalogue.accountHidden && (<>
          <h2>Account and billing</h2>
          <p><Link to="/account/">WSO2 Cloud account, organizations, billing, regions, SLA and support</Link></p>
        </>)}
      </main>
    </Layout>
  );
}
