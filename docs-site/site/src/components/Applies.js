// Content that applies to one deployment option only. On a page that covers only some options (a partial shared
// by a cloud-only and a self-hosted-only page), a block for an option the page does not cover is hidden, and a block
// for the page's only option needs no label.
import React from 'react';
import usePageOptions from './usePageOptions.js';
const CLASS = { 'WSO2 Cloud': 'cloud', Hybrid: 'hybrid', 'Self-hosted': 'self-hosted' };
export default function Applies({ to, children }) {
  const page = usePageOptions();
  if (page && !page.includes(to)) return null;
  if (page && page.length === 1) return <>{children}</>;
  return (
    <div className={`applies applies--${CLASS[to] ?? 'self-hosted'}`}>
      <div className="applies__label">{to} only</div>
      {children}
    </div>
  );
}
