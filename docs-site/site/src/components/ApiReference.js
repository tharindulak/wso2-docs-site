// OpenAPI reference for API pages (MkDocs sources embedded a Redoc viewer via a theme template).
// Redoc's standalone bundle is served from this site and loaded only on API pages, in the browser.
// sanitize: specs come from content repositories, so HTML in their descriptions is sanitised.
// specLink: a spec on another host is linked, never fetched into the reader's browser.
import React, { useEffect, useRef, useState } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { useColorMode } from '@docusaurus/theme-common';

let loading;
function loadRedoc(src) {
  if (window.Redoc) return Promise.resolve(window.Redoc);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(window.Redoc);
    script.onerror = () => { loading = undefined; reject(new Error('The API viewer could not be loaded.')); };
    document.head.appendChild(script);
  });
  return loading;
}

// Oxygen look; Redoc has no dark mode of its own, so dark colours are given explicitly.
const theme = (dark) => ({
  colors: {
    primary: { main: dark ? '#FF7300' : '#B25000' },
    text: { primary: dark ? '#E8E9EC' : '#181818', secondary: dark ? '#A0A6B1' : '#4B5563' },
    border: { dark: dark ? '#3D424C' : '#C9CCD2', light: dark ? '#2A2E36' : '#E5E7EB' },
    http: { get: '#1F7A3D', post: '#1F6FC5', put: '#B25000', delete: '#B3261E', patch: '#6B3FD0' },
  },
  typography: {
    fontFamily: "'Inter Variable', system-ui, sans-serif",
    headings: { fontFamily: "'Inter Variable', system-ui, sans-serif", fontWeight: '600' },
    code: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: dark ? '#FFA04D' : '#B25000', backgroundColor: dark ? '#1F2228' : '#F3F4F6' },
    links: { color: dark ? '#FF9A4D' : '#B25000' },
  },
  sidebar: { backgroundColor: dark ? '#141821' : '#F7F7F8', textColor: dark ? '#E8E9EC' : '#181818' },
  rightPanel: { backgroundColor: dark ? '#0B0F19' : '#1F2937' },
  schema: { nestedBackground: dark ? '#1A1D22' : '#FAFAFA' },
});

// The sticky navbar and product bar sit over the viewer; Redoc offsets its scrolling by their height.
const headerHeight = () => ['.navbar', '.product-bar'].reduce((h, s) => h + (document.querySelector(s)?.getBoundingClientRect().height ?? 0), 0);

function Viewer({ spec, schemaExpansionLevel, expandSingleSchemaField }) {
  const element = useRef(null);
  const bundle = useBaseUrl('/redoc.standalone.js');
  const { colorMode } = useColorMode();
  const [state, setState] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    loadRedoc(bundle).then((Redoc) => {
      if (cancelled || !element.current) return;
      const options = {
        sanitize: true,
        nativeScrollbars: true,
        scrollYOffset: headerHeight,
        theme: theme(colorMode === 'dark'),
        ...(schemaExpansionLevel ? { schemaExpansionLevel } : {}),
        ...(expandSingleSchemaField ? { expandSingleSchemaField: true } : {}),
      };
      Redoc.init(new URL(spec, window.location.href).href, options, element.current, (error) => {
        if (!cancelled) setState(error ? 'error' : 'ready');
      });
    }).catch(() => { if (!cancelled) setState('error'); });
    return () => {
      cancelled = true;
      if (element.current) element.current.innerHTML = '';
    };
  }, [spec, colorMode, bundle, schemaExpansionLevel, expandSingleSchemaField]);
  return (
    <div className="api-reference">
      {state === 'loading' && <p className="api-reference__status">Loading the API reference…</p>}
      {state === 'error' && <p className="api-reference__status">The API reference could not be shown. <a href={spec}>Download the OpenAPI specification</a>.</p>}
      <div ref={element} />
    </div>
  );
}

export default function ApiReference({ spec, specLink, schemaExpansionLevel, expandSingleSchemaField }) {
  if (specLink) {
    return /^https:\/\//.test(specLink)
      ? <p>This API's specification is published on another site: <a href={specLink} rel="noopener noreferrer">OpenAPI specification</a>.</p>
      : null;
  }
  return (
    <BrowserOnly fallback={<p className="api-reference__status">Loading the API reference…</p>}>
      {() => <Viewer spec={spec} schemaExpansionLevel={schemaExpansionLevel} expandSingleSchemaField={expandSingleSchemaField} />}
    </BrowserOnly>
  );
}
