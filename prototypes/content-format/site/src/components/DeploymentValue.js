// PROTOTYPE: a value that differs per deployment option (from a docs-is {{ variable }}).
import React from 'react';
export default function DeploymentValue({ cloud, selfHosted }) {
  return (<span className="proto-dv" title="Differs by deployment option">
    <code>{cloud}</code> <small>(WSO2 Cloud)</small> / <code>{selfHosted}</code> <small>(Self-hosted)</small></span>);
}
