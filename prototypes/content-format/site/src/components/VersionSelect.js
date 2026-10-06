// PROTOTYPE: version selector for one docs set. Keeps the page if it exists in the target version,
// else goes to that version's home (decided in Versioning details). "Older versions" links out.
import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import { useVersions, useActiveDocContext } from '@docusaurus/plugin-content-docs/client';
import { useHistory } from '@docusaurus/router';
export default function VersionSelect({ pluginId, older, size = 'small', variant = 'outlined' }) {
  const versions = useVersions(pluginId); const ctx = useActiveDocContext(pluginId); const history = useHistory();
  const [a, setA] = useState(null);
  if (versions.length < 2) return null;
  const active = ctx.activeVersion ?? versions[0];
  const go = (v) => { setA(null); const d = ctx.alternateDocVersions?.[v.name]; history.push(d ? d.path : v.path); };
  return (<>
    <Button size={size} variant={variant} color="inherit" onClick={(e) => setA(e.currentTarget)} sx={{ textTransform: 'none' }}>Version: {active.label} ▾</Button>
    <Menu anchorEl={a} open={!!a} onClose={() => setA(null)}>
      {versions.map((v) => <MenuItem key={v.name} selected={v.name === active.name} onClick={() => go(v)}>{v.label}</MenuItem>)}
      {older && <Divider />}{older && <MenuItem component="a" href={older}>Older versions ↗</MenuItem>}
    </Menu>
  </>);
}
