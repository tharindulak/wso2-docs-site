// PROTOTYPE: page-level deployment label under the title, from front matter.
import React from 'react';
import Content from '@theme-original/DocItem/Content';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import DeploymentLabel from '@site/src/components/DeploymentLabel';
export default function ContentWrapper(props) {
  return (<><DeploymentLabel options={useDoc().frontMatter.deployment_options} /><Content {...props} /></>);
}
