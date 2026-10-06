// PROTOTYPE: variant A replaces the Docusaurus navbar with an MUI AppBar.
import React from 'react';
import OriginalNavbar from '@theme-original/Navbar';
import Link from '@docusaurus/Link';
import { useColorMode } from '@docusaurus/theme-common';
import { AppBar, Toolbar, Typography, Box, Button } from '@wso2/oxygen-ui';
import ProductSwitcher from '@site/src/components/ProductSwitcher';
import useVariant from '@site/src/components/useVariant';

function MuiNavbar() {
  const { colorMode, setColorMode } = useColorMode();
  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 2 }}>
        <Typography component={Link} to="/" variant="h6" sx={{ color: 'inherit', textDecoration: 'none' }}>WSO2 Docs</Typography>
        <ProductSwitcher />
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}>
          {colorMode === 'dark' ? 'Light' : 'Dark'} mode
        </Button>
      </Toolbar>
    </AppBar>
  );
}
export default function Navbar(props) {
  return useVariant() === 'A' ? <MuiNavbar /> : <OriginalNavbar {...props} />;
}
