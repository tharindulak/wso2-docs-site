// Version selector for one product section. Reads /<route>/versions.json at runtime, so snapshot pages built earlier
// still list newer versions. Keeps the page when the target version has it (its pages.json), else opens its home.
import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import { useLocation } from '@docusaurus/router';
import MuiIsland from './MuiIsland.js';
import { currentVersion, versionHref, groups } from '../lib/versions.mjs';

const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export default function VersionSelect({ versionsUrl, pill = false }) {
  const { pathname } = useLocation();
  const [doc, setDoc] = useState(null);
  const [anchor, setAnchor] = useState(null);
  useEffect(() => { let live = true; getJson(versionsUrl).then((d) => live && setDoc(d)); return () => { live = false; }; }, [versionsUrl]);
  if (!doc) return null;
  const active = currentVersion(doc, pathname);
  const go = async (target) => {
    setAnchor(null);
    const info = target.status === 'confluence' ? null : await getJson(`${target.path}pages.json`);
    window.location.assign(versionHref(doc, pathname, target, info)); // versions may be separate builds
  };
  const g = groups(doc);
  const item = (v) => <MenuItem key={v.version} selected={v === active} onClick={() => go(v)}>{v.label}{v.status === 'confluence' ? ' ↗' : ''}</MenuItem>;
  return (
    <MuiIsland>
      {pill ? (
        // Header pill (redesign, mockup 3): the version alone, next to the product.
        <Button size="small" variant="outlined" color="inherit" aria-label={`Version: ${active?.label ?? doc.latest}`} onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ borderRadius: 999, px: 1.75, py: 0.4, minWidth: 0, textTransform: 'none', fontWeight: 500, fontSize: 14, borderColor: 'divider' }}>
          {active?.label ?? doc.latest}<span aria-hidden="true" style={{ marginLeft: 8, fontSize: 11 }}>▾</span>
        </Button>
      ) : (
        <Button size="small" variant="outlined" color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>Version: {active?.label ?? doc.latest} ▾</Button>
      )}
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { style: { maxHeight: 420 } } }}>
        {g.current.map(item)}
        {g.previous.length > 0 && <ListSubheader>Previous versions</ListSubheader>}
        {g.previous.map(item)}
        {/* Pre-site releases (status "confluence", links to the former docs) are not listed (user decision 2026-10-19). */}
      </Menu>
    </MuiIsland>
  );
}
