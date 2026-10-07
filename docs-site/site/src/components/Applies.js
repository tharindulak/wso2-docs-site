// Content that applies to one deployment option only.
import React from 'react';
const CLASS = { 'WSO2 Cloud': 'cloud', Hybrid: 'hybrid', 'Self-hosted': 'self-hosted' };
export default function Applies({ to, children }) {
  return (
    <div className={`applies applies--${CLASS[to] ?? 'self-hosted'}`}>
      <div className="applies__label">{to} only</div>
      {children}
    </div>
  );
}
