// PROTOTYPE: content that applies to one deployment option only (from a docs-is {% if product_name %} branch).
import React from 'react';
export default function Applies({ to, children }) {
  return (<div className={`proto-applies proto-applies--${to === 'WSO2 Cloud' ? 'cloud' : 'self'}`}>
    <div className="proto-applies__label">{to} only</div>{children}</div>);
}
