// Page-level "Deployment options" box under the title (GitLab style).
import React from 'react';
export default function DeploymentLabel({ options }) {
  if (!options?.length) return null;
  return <div className="deployment-box"><strong>Deployment options:</strong> {options.join(', ')}</div>;
}
