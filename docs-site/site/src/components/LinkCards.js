// <LinkCards> around a list of links, as cards (remark-components in the site build passes the list's items; the
// converter writes <LinkCards> around closing sections that are such a list). Descriptions come from
// lib/link-cards.mjs, using the doc metadata Docusaurus already ships to every doc page, so the cards are in the
// server-rendered HTML. useDocById is not used: it throws on a link to a page outside this version. The writer's list
// (children) renders instead when anything is missing, and when the page opts out with `link_cards: false` (which also
// covers sections in partials it imports).
import React from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import { usePluginData } from '@docusaurus/useGlobalData';
import { useDoc, useDocsVersion } from '@docusaurus/plugin-content-docs/client';
import { assetHref } from '../lib/asset-links.mjs';
import { linkCards } from '../lib/link-cards.mjs';

/** A context hook that throws outside its provider (a closing section rendered outside a doc page), as null. */
function useOptional(hook) {
  try {
    return hook();
  } catch {
    return null;
  }
}

export default function LinkCards({ items, children }) {
  const { pathname } = useLocation();
  const version = useOptional(useDocsVersion);
  const doc = useOptional(useDoc);
  const data = usePluginData('docusaurus-plugin-content-docs', version?.pluginId);
  const globalDocs = data?.versions?.find((v) => v.name === version?.version)?.docs;
  const cards = doc?.frontMatter?.link_cards === false ? null : linkCards(items, { pathname, docs: version?.docs, globalDocs });
  if (!cards) return <>{children}</>;
  return (
    <div className="link-cards">
      {cards.map(({ href, title, description, external }, k) => (
        <Link key={k} to={assetHref({ href })} className={external ? 'link-card link-card--external' : 'link-card'}>
          <strong className="link-card__title">{title}</strong>
          {description && <span className="link-card__text">{description}</span>}
        </Link>
      ))}
    </div>
  );
}
