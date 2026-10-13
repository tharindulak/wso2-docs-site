// When search cannot run: say so, offer the product list and the same query on a web search engine. On a local build
// whose search settings are missing or invalid, also say how to set search up (readers never see that part).
import React, { useEffect, useState } from 'react';
import { webSearchHref, isLocalHost } from '../../lib/search.mjs';

export default function SearchUnavailable({ query, siteUrl, reason }) {
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(isLocalHost(window.location.hostname)), []);
  const setup = local && (reason === 'missing' || reason === 'invalid');
  return (
    <div className="search-unavailable" role="status">
      <p><strong>{setup ? 'Search is not set up for this build.' : 'Search is unavailable right now.'}</strong></p>
      {setup && (
        <p className="search-unavailable__setup">
          {reason === 'invalid' ? '/search-config.json is not valid. ' : 'This build has no /search-config.json. '}
          Start Typesense and run <code>npm run search-index -- &lt;build dir&gt;</code>; later builds and <code>npm start</code> then
          pick the settings up from <code>.cache/search-public/</code>. See Search in docs-site/README.md.
        </p>
      )}
      {local && reason === 'error' && <p className="search-unavailable__setup">Typesense did not answer. Is it running on the address in /search-config.json?</p>}
      <p>
        <a href="/">Browse all products</a>
        {query.trim() && <> or <a href={webSearchHref(query.trim(), siteUrl)} target="_blank" rel="noopener noreferrer">search this site on the web ↗</a></>}
      </p>
    </div>
  );
}
