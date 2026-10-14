// Content that applies to one deployment option only. On a page that covers only some options (a partial shared
// by a cloud-only and a self-hosted-only page), a block for an option the page does not cover is hidden, and a block
// for the page's only option needs no label. The option reaches what is inside (AppliesContext: a deprecated section's
// scope line).
import React, { createContext } from 'react';
import usePageOptions from './usePageOptions.js';
export const AppliesContext = createContext(null);
const CLASS = { 'WSO2 Cloud': 'cloud', Hybrid: 'hybrid', 'Self-hosted': 'self-hosted' };
export default function Applies({ to, children }) {
  const page = usePageOptions();
  if (page && !page.includes(to)) return null;
  if (page && page.length === 1) return <AppliesContext.Provider value={to}>{children}</AppliesContext.Provider>;
  return (
    <AppliesContext.Provider value={to}>
      <div className={`applies applies--${CLASS[to] ?? 'self-hosted'}`}>
        <div className="applies__label">{to} only</div>
        {children}
      </div>
    </AppliesContext.Provider>
  );
}
