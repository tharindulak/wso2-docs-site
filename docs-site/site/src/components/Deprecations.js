// The Deprecations page of one docs version (variant A of the planning ticket "How deprecation notices and the
// Deprecations page look"): a table of the version's deprecated pages, sections and hand-kept entries, from the index
// the content build writes (generated/deprecations/<versionId>.json, imported by the page), and tabs to the other
// versions' Deprecations pages. The tabs read /<route>/versions.json and each version's pages.json at runtime, as the
// version selector does, so a frozen version's page still lists newer versions.
import React, { useEffect, useState } from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import useDocResolver from './useDocResolver.js';
import { deprecationRows, deprecationTabs, POLICY_DOC_ID } from '../lib/deprecation.mjs';

const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

/** Writer's text with `code` spans, as in titles of deprecated sections. */
const withCode = (text) => text.split(/(`[^`]+`)/).map((part, i) => (/^`[^`]+`$/.test(part) ? <code key={i}>{part.slice(1, -1)}</code> : part));

function useTabs(info, pathname) {
  const [tabs, setTabs] = useState(null);
  useEffect(() => {
    if (!info?.latestPath) return undefined;
    let live = true;
    (async () => {
      const doc = await getJson(`${info.latestPath}versions.json`);
      const listed = (doc?.versions ?? []).filter((v) => v.path);
      const pages = Object.fromEntries(await Promise.all(listed.map(async (v) => [v.path, await getJson(`${v.path}pages.json`)])));
      if (live) setTabs(deprecationTabs(doc, pages, pathname));
    })();
    return () => { live = false; };
  }, [info?.latestPath, pathname]);
  return tabs;
}

export default function Deprecations({ index }) {
  const { pathname } = useLocation();
  const resolver = useDocResolver();
  const info = resolver?.info;
  const rows = deprecationRows(index, resolver?.sectionId);
  const own = info ? [{ label: info.status === 'latest' ? 'Latest' : info.version, href: pathname, current: true }] : [];
  const tabs = useTabs(info, pathname) ?? own;
  const policy = resolver?.resolveDoc(POLICY_DOC_ID)?.url;
  return (
    <>
      <p>
        Features and APIs deprecated in {info?.status === 'latest' ? 'the latest documentation' : `version ${info?.version ?? index?.version}`}.
        They still work, but are not recommended and will be removed in a future release.
        {policy && <> <Link to={policy}>How deprecation works</Link>.</>}
      </p>
      {tabs.length > 0 && (
        <nav className="deprecation-versions" aria-label="Deprecations by version">
          {tabs.map((t) => <Link key={t.href} to={t.href} className={t.current ? 'deprecation-versions__active' : undefined} aria-current={t.current ? 'page' : undefined}>{t.label}</Link>)}
        </nav>
      )}
      <table className="deprecation-table">
        <thead><tr><th>Deprecated</th><th>Deployment option</th><th>Since</th><th>Use instead</th><th>Removal</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                {r.url ? <Link to={r.url}>{withCode(r.name)}</Link> : withCode(r.name)}
                {r.page && <div className="deprecation-table__page">Section of {r.page}</div>}
              </td>
              <td>{r.scope || '—'}</td>
              <td>{r.since || '—'}</td>
              <td>{r.replacements.length ? r.replacements.map((x, j) => <React.Fragment key={x.url}>{j > 0 && ', '}<Link to={x.url}>{x.title}</Link></React.Fragment>) : '—'}</td>
              <td className={r.removal === 'Not announced' ? 'deprecation-table__muted' : undefined}>{r.removal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
