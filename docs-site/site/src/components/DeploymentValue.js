// A value that differs by deployment option: both shown, labelled.
import React from 'react';
export default function DeploymentValue({ cloud, selfHosted }) {
  return <span><code>{cloud}</code> <small>(WSO2 Cloud)</small> / <code>{selfHosted}</code> <small>(Self-hosted)</small></span>;
}
