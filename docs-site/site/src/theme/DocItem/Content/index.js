import React from 'react';
import Content from '@theme-original/DocItem/Content';
import Head from '@docusaurus/Head';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import DeploymentLabel from '@site/src/components/DeploymentLabel.js';
import OlderVersionBanner from '@site/src/components/OlderVersionBanner.js';
import LifecyclePill from '@site/src/components/LifecyclePill.js';
import DeprecationNotice from '@site/src/components/DeprecationNotice.js';
// wso2:deployment carries the page's deployment options for the search index (scripts/search-index.mjs).
// The lifecycle pill sits beside the title, outside the heading, so the heading's anchor and TOC entry stay as they are.
// A deprecated page's notice goes under the title: here, first in the content, after the title Docusaurus adds when the
// page has no h1 of its own (API pages); else after that h1 (MDXComponents).
export default function DocItemContent(props) {
  const { frontMatter } = useDoc();
  const options = frontMatter.deployment_options;
  return (
    <>
      {options?.length > 0 && <Head><meta name="wso2:deployment" content={options.join(',')} /></Head>}
      <OlderVersionBanner /><DeploymentLabel options={options} /><LifecyclePill frontMatter={frontMatter} />
      <Content {...props}><DeprecationNotice at="title" />{props.children}</Content>
    </>
  );
}
