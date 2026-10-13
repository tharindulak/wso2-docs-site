// Search state for the dialog and the search page. The endpoint and search-only key come from /search-config.json,
// written at deploy by scripts/search-index.mjs, so snapshot builds never embed an environment.
import { useEffect, useMemo, useState } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useActivePlugin } from '@docusaurus/plugin-content-docs/client';
import { settingsFrom, searchContext, searchParams } from '../../lib/search.mjs';

// { config, reason } (see settingsFrom), fetched once per page load.
let settingsPromise = null;
const loadSettings = () => {
  settingsPromise ??= fetch('/search-config.json')
    .then(async (r) => settingsFrom(r.ok, r.ok ? await r.json().catch(() => undefined) : undefined))
    .catch(() => ({ config: null, reason: 'missing' }));
  return settingsPromise;
};

/** The reader's place for `versionId`, or for the page being viewed when omitted. */
export function useSearchContext(versionId) {
  const { catalogue, versionInfo } = useDocusaurusContext().siteConfig.customFields;
  const active = useActivePlugin()?.pluginId;
  const id = versionId === undefined ? active : versionId;
  // Stable per version: the context feeds effect and memo dependencies (filter, URL sync).
  return useMemo(() => searchContext(catalogue, versionInfo, id), [catalogue, versionInfo, id]);
}

/**
 * Runs `query` with `filter` (debounced, the previous request aborted). status: idle | loading | ready | unavailable.
 * When unavailable, reason says why: 'missing' or 'invalid' settings, or 'error' (the service failed or is unreachable).
 */
export function useSearch(query, filter, { perPage, facets } = {}) {
  const [state, setState] = useState({ status: 'idle', hits: [], found: 0, facets: [] });
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) { setState({ status: 'idle', hits: [], found: 0, facets: [] }); return undefined; }
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    const timer = setTimeout(async () => {
      const { config, reason } = await loadSettings();
      if (!config) { setState({ status: 'unavailable', reason, hits: [], found: 0, facets: [] }); return; }
      try {
        const res = await fetch(`${config.url}/collections/${config.collection}/documents/search?${searchParams(q, filter, { perPage, facets })}`, {
          headers: { 'X-TYPESENSE-API-KEY': config.key }, signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        setState({ status: 'ready', hits: body.hits ?? [], found: body.found ?? 0, facets: body.facet_counts ?? [] });
      } catch (e) {
        if (e.name !== 'AbortError') setState({ status: 'unavailable', reason: 'error', hits: [], found: 0, facets: [] });
      }
    }, 120);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, filter, perPage, facets]);
  return state;
}
