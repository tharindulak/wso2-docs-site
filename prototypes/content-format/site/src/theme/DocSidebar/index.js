// PROTOTYPE variant B: product, section and version selectors at the top of the docs sidebar.
import React from 'react';
import DocSidebar from '@theme-original/DocSidebar';
import { useLocation, useHistory } from '@docusaurus/router';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import MuiIsland from '@site/src/components/MuiIsland';
import VersionSelect from '@site/src/components/VersionSelect';
import { PRODUCTS, locate } from '@site/src/components/catalogue';
import { useNavVariant } from '@site/src/components/nav';
export default function DocSidebarWrapper(props) {
  const v = useNavVariant(); const { pathname } = useLocation(); const history = useHistory(); const { product, section } = locate(pathname);
  if (v !== 'B' || !product) return <DocSidebar {...props} />;
  const live = PRODUCTS.filter((p) => p.sections);
  return (<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <MuiIsland><Stack spacing={1.25} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <TextField select size="small" label="Product" value={product.id} onChange={(e) => history.push(live.find((p) => p.id === e.target.value).sections[0].path)}>
        {live.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField>
      {product.sections.length > 1 && <TextField select size="small" label="Section" value={section.path} onChange={(e) => history.push(e.target.value)}>
        {product.sections.map((s) => <MenuItem key={s.path} value={s.path}>{s.label}</MenuItem>)}</TextField>}
      <VersionSelect pluginId={section.pluginId} older={product.older} />
    </Stack></MuiIsland>
    <div style={{ flex: 1, minHeight: 0 }}><DocSidebar {...props} /></div>
  </div>);
}
