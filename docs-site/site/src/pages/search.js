// Full search results: the dialog's "See all results". Scope tabs and the optional deployment-option filter live here.
// The URL carries the query, scope and the version id searched from (?q=&scope=&from=), so results can be shared.
import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLocation, useHistory } from '@docusaurus/router';
import { useSearch, useSearchContext } from '@site/src/components/search/useSearch.js';
import SearchResults from '@site/src/components/search/SearchResults.js';
import SearchScopeTabs from '@site/src/components/search/SearchScopeTabs.js';
import SearchUnavailable from '@site/src/components/search/SearchUnavailable.js';
import { searchFilter, hasProductScope, DEPLOYMENT_OPTIONS } from '@site/src/lib/search.mjs';

// The query string exists only in the browser, so the page body renders there (no server/client mismatch).
export default function SearchPage() {
  return (
    <Layout title="Search" description="Search the WSO2 documentation.">
      <main className="container margin-vert--lg search-page">
        <h1>Search</h1>
        <BrowserOnly>{() => <SearchPageBody />}</BrowserOnly>
      </main>
    </Layout>
  );
}

function SearchPageBody() {
  const { siteConfig } = useDocusaurusContext();
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);
  const ctx = useSearchContext(params.get('from') ?? null);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [scope, setScope] = useState(params.get('scope') === 'all' ? 'all' : 'product');
  const [deployment, setDeployment] = useState([]);
  const filter = useMemo(() => searchFilter(ctx, scope, deployment), [ctx, scope, deployment]);
  const { status, reason, hits, found, facets } = useSearch(query, filter, { perPage: 50, facets: true });

  // Keep the URL in step (replace, not push: typing is not navigation).
  useEffect(() => {
    const p = new URLSearchParams({ q: query.trim() });
    if (hasProductScope(ctx)) { p.set('scope', scope); p.set('from', ctx.versionId); }
    history.replace({ search: `?${p}` });
  }, [query, scope, ctx, history]);

  const counts = Object.fromEntries((facets.find((f) => f.field_name === 'deployment')?.counts ?? []).map((c) => [c.value, c.count]));
  const toggle = (option) => setDeployment((d) => (d.includes(option) ? d.filter((x) => x !== option) : [...d, option]));

  return (
    <>
      <input className="search-page__input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the documentation" aria-label="Search the documentation" autoFocus />
      {hasProductScope(ctx) && <SearchScopeTabs ctx={ctx} scope={scope} onChange={setScope} />}
      <div className="search-page__body">
        <fieldset className="search-page__filters">
          <legend>Deployment options</legend>
          {DEPLOYMENT_OPTIONS.map((option) => (
            <label key={option} className="search-page__filter">
              <input type="checkbox" checked={deployment.includes(option)} onChange={() => toggle(option)} />
              {' '}{option}{counts[option] !== undefined && <span className="search-page__count"> {counts[option]}</span>}
            </label>
          ))}
        </fieldset>
        <div className="search-page__results" aria-live="polite">
          {status === 'unavailable' && <SearchUnavailable query={query} siteUrl={siteConfig.url} reason={reason} />}
          {status === 'ready' && <p className="search-page__found">{found === 0 ? `No results for “${query.trim()}”.` : `${found} results${found > hits.length ? `, showing the first ${hits.length}` : ''}.`}</p>}
          {hits.length > 0 && <SearchResults hits={hits} currentProduct={ctx?.product} idPrefix="search-page-hit" />}
        </div>
      </div>
    </>
  );
}
