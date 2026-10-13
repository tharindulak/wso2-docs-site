// Search dialog (Ctrl/Cmd+K). A native <dialog>: the browser traps focus, closes on Escape and makes the page inert.
// Inside a product it starts scoped to that product; the choice lasts for this search only and is never stored.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useSearch } from './useSearch.js';
import SearchResults, { orderedHits } from './SearchResults.js';
import SearchScopeTabs from './SearchScopeTabs.js';
import SearchUnavailable from './SearchUnavailable.js';
import { searchFilter, searchPageHref, hasProductScope } from '../../lib/search.mjs';

export default function SearchDialog({ open, onClose, ctx }) {
  const ref = useRef(null);
  const input = useRef(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('product');
  const [active, setActive] = useState(0);
  const filter = useMemo(() => searchFilter(ctx, scope), [ctx, scope]);
  const { status, reason, hits, found } = useSearch(query, filter);
  const ordered = useMemo(() => orderedHits(hits, ctx?.product), [hits, ctx]);
  const { siteConfig } = useDocusaurusContext();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) { setScope('product'); setActive(0); dialog.showModal(); input.current?.select(); }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => setActive(0), [hits]);
  useEffect(() => { document.getElementById(`search-hit-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, ordered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && ordered.length) {
      e.preventDefault();
      // A click, so the bundle-route handler decides between client navigation and a full page load.
      ref.current?.querySelector(`#search-hit-${active} a`)?.click();
    }
  };

  return (
    // The dialog closes on Escape (cancel) and on a click on its backdrop.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog ref={ref} className="search-dialog" aria-label="Search the documentation" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="search-dialog__panel">
        <div className="search-dialog__bar">
          <input
            ref={input} className="search-dialog__input" type="search" value={query} placeholder="Search the documentation"
            onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded={ordered.length > 0} aria-controls="search-dialog-results" aria-activedescendant={ordered.length ? `search-hit-${active}` : undefined}
          />
          <button type="button" className="search-dialog__close" onClick={onClose} aria-label="Close search">Esc</button>
        </div>
        {hasProductScope(ctx) && <SearchScopeTabs ctx={ctx} scope={scope} onChange={setScope} />}
        <div id="search-dialog-results" className="search-dialog__results" role="listbox" aria-label="Results">
          {status === 'unavailable' && <SearchUnavailable query={query} siteUrl={siteConfig.url} reason={reason} />}
          {status === 'ready' && !hits.length && <p className="search-dialog__empty">No results for “{query.trim()}”.</p>}
          {hits.length > 0 && <SearchResults hits={hits} currentProduct={ctx?.product} activeIndex={active} onHover={setActive} onSelect={onClose} />}
        </div>
        {status === 'ready' && found > hits.length && (
          <a className="search-dialog__all" href={searchPageHref(query.trim(), scope, ctx)}>See all {found} results</a>
        )}
      </div>
    </dialog>
  );
}
