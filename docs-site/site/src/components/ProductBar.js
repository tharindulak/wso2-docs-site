// Second bar inside a product: product name, one tab per section, version selector.
import React from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import VersionSelect from './VersionSelect.js';
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
      <span className="product-bar__spacer" />
      <VersionSelect versionsUrl={section.versionsUrl} />
    </div>
  );
}
