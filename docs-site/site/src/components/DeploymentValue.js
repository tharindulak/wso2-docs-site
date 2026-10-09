// A value that differs by deployment option: both shown, labelled. When one option has no value (the
// text exists for the other option only), only that value is shown, labelled "only".
import React from 'react';
export default function DeploymentValue({ cloud, selfHosted }) {
  if (!cloud && !selfHosted) return null;
  if (!cloud) return <span><code>{selfHosted}</code> <small>(Self-hosted only)</small></span>;
  if (!selfHosted) return <span><code>{cloud}</code> <small>(WSO2 Cloud only)</small></span>;
  return <span><code>{cloud}</code> <small>(WSO2 Cloud)</small> / <code>{selfHosted}</code> <small>(Self-hosted)</small></span>;
}
