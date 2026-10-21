// Pages on a content source's exclude list (the converter cannot publish them yet): a notice and the source file.
// The name stays: generated pages import it, and the build tells these pages from published ones by that import.
import React from 'react';
import Head from '@docusaurus/Head';
import Admonition from '@theme/Admonition';
export default function Redirect({ source }) {
  const safe = typeof source === 'string' && /^https:\/\/github\.com\//.test(source) ? source : null;
  return (
    <>
      <Head><meta name="robots" content="noindex" /></Head>
      <Admonition type="info" title="Not available on this site yet">
        <p>This page could not be published on the new documentation site yet.{safe ? <> You can read its source <a href={safe}>on GitHub</a>.</> : null}</p>
      </Admonition>
    </>
  );
}
