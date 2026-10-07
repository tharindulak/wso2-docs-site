// Stand-ins for docs-integrator's EIP pattern helpers (src/utils/eipPatternComponents), same exports and props.
import React from 'react';
import Tabs from '@theme/Tabs';
import useBaseUrl from '@docusaurus/useBaseUrl';

export function EipReferenceLink({ href, label }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title="EIP reference">
      <span aria-hidden="true">↗</span>
    </a>
  );
}

export function PatternImplementationTabs({ children }) {
  return <Tabs>{children}</Tabs>;
}

export function PatternImage({ src, alt, width }) {
  return <img src={useBaseUrl(src)} alt={alt} width={width} style={{ display: 'block', margin: '0 auto' }} />;
}
