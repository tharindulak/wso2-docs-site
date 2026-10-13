import React from 'react';
import Content from '@theme-original/DocItem/Content';
import Head from '@docusaurus/Head';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import DeploymentLabel from '@site/src/components/DeploymentLabel.js';
import OlderVersionBanner from '@site/src/components/OlderVersionBanner.js';
// wso2:deployment carries the page's deployment options for the search index (scripts/search-index.mjs).
export default function DocItemContent(props) {
  const options = useDoc().frontMatter.deployment_options;
  return (
    <>
      {options?.length > 0 && <Head><meta name="wso2:deployment" content={options.join(',')} /></Head>}
      <OlderVersionBanner /><DeploymentLabel options={options} /><Content {...props} />
    </>
  );
}
