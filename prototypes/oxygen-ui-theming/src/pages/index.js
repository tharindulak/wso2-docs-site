// PROTOTYPE hub home.
import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
export default function Home() {
  return (
    <Layout title="Home">
      <main className="container margin-vert--xl">
        <h1>WSO2 documentation</h1>
        <p>Pick a product. Every page shows which deployment options it covers.</p>
        <div className="row">
          {[['Identity Platform', '/identity/'], ['Integration Platform', '/integration/']].map(([t, h]) => (
            <div className="col col--4 margin-bottom--md" key={h}>
              <Link className="card padding--lg proto-product-card" to={h}><h3>{t}</h3><span>WSO2 Cloud · Self-hosted</span></Link>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
