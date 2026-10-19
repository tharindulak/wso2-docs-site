// Second bar inside a product: product name and one tab per section (the version selector is in the header).
import React from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import { useCatalogue, locate } from './catalogue.js';

export default function ProductBar() {
  const { product, section } = locate(useCatalogue(), useLocation().pathname);
  if (!product) return null;
  return (
    <div className="product-bar" role="navigation" aria-label={`${product.name} sections`}>
      <Link className="product-bar__name" to={product.sections[0].landing}>{product.name}</Link>
      {product.sections.length > 1 && (
        <div className="product-bar__tabs">
          {product.sections.map((s) => (
            <Link key={s.pluginId} to={s.landing} className={`product-bar__tab${s === section ? ' product-bar__tab--active' : ''}`}>{s.label}</Link>
          ))}
        </div>
      )}
      {/* The version selector moved to the header (redesign prototype, mockup 3). */}
    </div>
  );
}
