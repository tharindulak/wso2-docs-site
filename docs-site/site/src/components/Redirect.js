// Pages on a content source's exclude list: send readers to the same page on the product's current site.
import React, { useEffect } from 'react';
import Head from '@docusaurus/Head';
export default function Redirect({ to }) {
  const safe = /^https:\/\//.test(to) ? to : null;
  useEffect(() => { if (safe) window.location.replace(safe); }, [safe]);
  if (!safe) return null;
  return (
    <>
      <Head><meta httpEquiv="refresh" content={`0; url=${safe}`} /><link rel="canonical" href={safe} /><meta name="robots" content="noindex" /></Head>
      <p>This page is still on the product's current documentation site: <a href={safe}>{safe}</a></p>
    </>
  );
}
