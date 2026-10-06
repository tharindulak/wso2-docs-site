// PROTOTYPE: GitLab-style deployment-options line under the title, from front matter.
import React from 'react';
import Content from '@theme-original/DocItem/Content';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
export default function ContentWrapper(props) {
  const opts = useDoc().frontMatter.deployment_options || [];
  return (<>
    <div className="proto-deploy"><strong>Deployment options:</strong> {opts.join(', ')}</div>
    <Content {...props} />
  </>);
}
