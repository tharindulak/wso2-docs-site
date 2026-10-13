// Results grouped by product (the reader's product, then Account and billing, then the others), shared by the dialog
// and the search page. Highlights render as text nodes: nothing from the index is inserted as HTML.
import React from 'react';
import Link from '@docusaurus/Link';
import { groupHits, splitMarked, hitSnippet, hitMeta, hitHref } from '../../lib/search.mjs';

const Marked = ({ text }) => splitMarked(text).map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <React.Fragment key={i}>{p.text}</React.Fragment>));

export default function SearchResults({ hits, currentProduct, activeIndex = -1, onHover, onSelect, idPrefix = 'search-hit' }) {
  let n = -1;
  return groupHits(hits, currentProduct).map((group) => (
    <section key={group.product} className="search-group" aria-label={group.name}>
      <h3 className="search-group__name">{group.name}</h3>
      <ul className="search-group__hits" role="presentation">
        {group.hits.map((hit) => {
          const doc = hit.document;
          const href = hitHref(doc);
          if (!href) return null;
          n += 1;
          const index = n;
          const external = doc.kind === 'link-out';
          const title = hit.highlight?.title?.snippet ?? doc.title;
          const heading = doc.heading ? (hit.highlight?.heading?.snippet ?? doc.heading) : null;
          const snippet = hitSnippet(hit);
          const meta = hitMeta(doc);
          return (
            <li key={doc.id} role="option" id={`${idPrefix}-${index}`} aria-selected={index === activeIndex} onMouseMove={() => onHover?.(index)}>
              <Link className={`search-hit${index === activeIndex ? ' search-hit--active' : ''}`} {...(external ? { href, target: '_blank', rel: 'noopener noreferrer' } : { to: href })} onClick={onSelect}>
                <span className="search-hit__title">
                  <Marked text={title} />
                  {heading && <> › <Marked text={heading} /></>}
                  {external && ' ↗'}
                </span>
                {snippet && <span className="search-hit__snippet"><Marked text={snippet} /></span>}
                {(meta || doc.badges?.length > 0) && (
                  <span className="search-hit__meta">
                    {meta}
                    {doc.badges?.map((b) => <span key={b} className="search-hit__badge">{b}</span>)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  ));
}

/** Hits in display order, for keyboard navigation. */
export const orderedHits = (hits, currentProduct) => groupHits(hits, currentProduct).flatMap((g) => g.hits).filter((h) => hitHref(h.document));
