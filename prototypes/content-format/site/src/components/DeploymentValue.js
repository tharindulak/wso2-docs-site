// PROTOTYPE: a value that differs per deployment option, three variants.
import React from 'react';
import Tooltip from '@mui/material/Tooltip';
import MuiIsland from './MuiIsland';
import { Icon, useLabelVariant } from './deployment';
export default function DeploymentValue({ cloud, selfHosted }) {
  const v = useLabelVariant();
  if (v === 'B') return (<span className="dv-b"><code><Icon option="WSO2 Cloud" size={11} /> {cloud}</code> <code><Icon option="Self-hosted" size={11} /> {selfHosted}</code></span>);
  if (v === 'C') return (
    <MuiIsland><Tooltip arrow title={<span>WSO2 Cloud: <code>{cloud}</code><br />Self-hosted: <code>{selfHosted}</code></span>}>
      <code className="dv-c">{cloud}</code></Tooltip></MuiIsland>
  );
  return (<span><code>{cloud}</code> <small>(WSO2 Cloud)</small> / <code>{selfHosted}</code> <small>(Self-hosted)</small></span>);
}
