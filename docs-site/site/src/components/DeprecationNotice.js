// Deprecation notice under a deprecated page's title (variant A of the planning ticket "How deprecation notices and
// the Deprecations page look"): the Deprecated tag and since, the one-line explanation, a button per replacement and
// the version's "How deprecation works" page. Shown where the page's title is: after the title Docusaurus adds
// (DocItem/Content), or after the page's own h1 (MDXComponents); `at` says which, so it shows once.
import React from 'react';
import Link from '@docusaurus/Link';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import useDocResolver from './useDocResolver.js';
import { deprecationNotice } from '../lib/deprecation.mjs';

function useNotice(at) {
  const resolver = useDocResolver();
  try {
    const { frontMatter, metadata, contentTitle } = useDoc();
    const ownTitle = typeof contentTitle !== 'undefined';
    if (!resolver || (at === 'h1') !== ownTitle) return null;
    return deprecationNotice(frontMatter, { docId: metadata.id, title: metadata.title, resolveDoc: resolver.resolveDoc, sectionId: resolver.sectionId });
  } catch {
    return null; // not inside a doc
  }
}

export default function DeprecationNotice({ at }) {
  const notice = useNotice(at);
  if (!notice) return null;
  return (
    <div className="deprecation-notice" role="note">
      <div className="deprecation-notice__head"><span className="deprecation-tag">Deprecated</span>{notice.since && <span>{notice.since}</span>}</div>
      <p className="deprecation-notice__line">{notice.line}</p>
      {notice.removal && <p className="deprecation-notice__line">{notice.removal}</p>}
      {notice.replacements.length > 0 && (
        <div className="deprecation-notice__actions">
          {notice.replacements.map((r) => <Link key={r.url} className="deprecation-button" to={r.url}>Use {r.title} instead →</Link>)}
        </div>
      )}
      {notice.policy && <Link className="deprecation-notice__policy" to={notice.policy}>How deprecation works</Link>}
    </div>
  );
}
