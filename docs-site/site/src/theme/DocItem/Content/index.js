import React from 'react';
import Content from '@theme-original/DocItem/Content';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import DeploymentLabel from '@site/src/components/DeploymentLabel.js';
export default function DocItemContent(props) {
  return (<><DeploymentLabel options={useDoc().frontMatter.deployment_options} /><Content {...props} /></>);
}
