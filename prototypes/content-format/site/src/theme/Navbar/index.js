// PROTOTYPE: three navigation variants replace the Docusaurus navbar.
import React from 'react';
import Link from '@docusaurus/Link';
import { useLocation } from '@docusaurus/router';
import { useColorMode } from '@docusaurus/theme-common';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import MuiIsland from '@site/src/components/MuiIsland';
import ProductsMenu from '@site/src/components/ProductsMenu';
import VersionSelect from '@site/src/components/VersionSelect';
import { HUB, locate } from '@site/src/components/catalogue';
import { useNavVariant } from '@site/src/components/nav';

function Search({ scope }) {
  return <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 0.5, minWidth: 260, color: 'text.secondary', fontSize: 14 }}>
    🔍 Search {scope ?? 'all docs'} <span style={{ float: 'right', opacity: .6 }}>⌘K</span></Box>;
}
function Mode() {
  const { colorMode, setColorMode } = useColorMode();
  return <Button color="inherit" size="small" onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}>{colorMode === 'dark' ? '☀' : '☾'}</Button>;
}
const Logo = () => <Typography component={Link} to="/" fontWeight={700} sx={{ color: 'inherit', textDecoration: 'none', mr: 1 }}>WSO2 Docs</Typography>;
const bar = { position: 'sticky', color: 'default', elevation: 0, sx: { borderBottom: 1, borderColor: 'divider', top: 0, zIndex: 'appBar', bgcolor: 'background.default' } };

export default function Navbar() {
  const v = useNavVariant(); const { pathname } = useLocation(); const { product, section } = locate(pathname);
  if (v === 'B') return (<MuiIsland><AppBar {...bar}><Toolbar variant="dense" sx={{ gap: 2 }}>
    <Logo /><Button color="inherit" component={Link} to="/cloud/" sx={{ textTransform: 'none' }}>WSO2 Cloud</Button>
    <Box sx={{ flex: 1 }} /><Search scope={product?.name} /><Mode /></Toolbar></AppBar></MuiIsland>);
  if (v === 'C') return (<MuiIsland><AppBar {...bar}><Toolbar variant="dense" sx={{ gap: 0.5 }}>
    <Logo />
    <Button color="inherit" component={Link} to={HUB[0][1]} sx={{ textTransform: 'none' }}>{HUB[0][0]}</Button>
    <Button color="inherit" component={Link} to={HUB[1][1]} sx={{ textTransform: 'none' }}>{HUB[1][0]}</Button>
    <ProductsMenu mega={false} />
    {HUB.slice(2).map(([l, h]) => <Button key={l} color="inherit" component={Link} to={h} sx={{ textTransform: 'none' }}>{l}</Button>)}
    <Box sx={{ flex: 1 }} /><Search /><Mode /></Toolbar></AppBar></MuiIsland>);
  return (<MuiIsland><AppBar {...bar}>
    <Toolbar variant="dense" sx={{ gap: 2 }}>
      <Logo /><ProductsMenu /><Button color="inherit" component={Link} to="/cloud/" sx={{ textTransform: 'none' }}>WSO2 Cloud</Button>
      <Box sx={{ flex: 1 }} /><Search scope={product?.name} /><Mode />
    </Toolbar>
    {product && <Toolbar variant="dense" sx={{ gap: 2, minHeight: 44, borderTop: 1, borderColor: 'divider' }}>
      <Typography fontWeight={700}>{product.name}</Typography>
      {product.sections.length > 1 && <Tabs value={section.path} sx={{ minHeight: 40 }}>
        {product.sections.map((s) => <Tab key={s.path} value={s.path} label={s.label} component={Link} to={s.path} sx={{ textTransform: 'none', minHeight: 40 }} />)}</Tabs>}
      <Box sx={{ flex: 1 }} /><VersionSelect pluginId={section.pluginId} older={product.older} />
    </Toolbar>}
  </AppBar></MuiIsland>);
}
