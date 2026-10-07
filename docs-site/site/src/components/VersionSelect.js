// Version selector for one product section. Keeps the page when it exists in the target version, otherwise
// opens that version's home. Older releases link to their current sites.
import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import { useVersions, useActiveDocContext } from '@docusaurus/plugin-content-docs/client';
import { useHistory } from '@docusaurus/router';
import MuiIsland from './MuiIsland.js';

export default function VersionSelect({ pluginId, olderVersions }) {
  const versions = useVersions(pluginId);
  const context = useActiveDocContext(pluginId);
  const history = useHistory();
  const [anchor, setAnchor] = useState(null);
  const active = context.activeVersion ?? versions[0];
  if (!active) return null;
  const go = (version) => {
    setAnchor(null);
    const doc = context.alternateDocVersions?.[version.name];
    history.push(doc ? doc.path : version.path);
  };
  return (
    <MuiIsland>
      <Button size="small" variant="outlined" color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>Version: {active.label} ▾</Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {versions.map((v) => <MenuItem key={v.name} selected={v.name === active.name} onClick={() => go(v)}>{v.label}</MenuItem>)}
        {olderVersions && <Divider />}
        {olderVersions && <MenuItem component="a" href={olderVersions}>Older versions ↗</MenuItem>}
      </Menu>
    </MuiIsland>
  );
}
