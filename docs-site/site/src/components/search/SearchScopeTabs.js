// "<Product name>" | "All products" tabs, shown only inside a product.
import React from 'react';

export default function SearchScopeTabs({ ctx, scope, onChange }) {
  const tab = (value, label) => (
    <button key={value} type="button" role="tab" aria-selected={scope === value} className={`search-scope__tab${scope === value ? ' search-scope__tab--active' : ''}`} onClick={() => onChange(value)}>
      {label}
    </button>
  );
  return <div className="search-scope" role="tablist" aria-label="Search scope">{tab('product', ctx.productName)}{tab('all', 'All products')}</div>;
}
