// "Products" mega-menu: every product, grouped like wso2.com/documentation, one entry per product.
// Products not migrated yet link to their current site in the same tab (↗ marks them).
import React, { useState } from 'react';
import Link from '@docusaurus/Link';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MuiIsland from './MuiIsland.js';
import { useCatalogue, productHref } from './catalogue.js';

export default function ProductsMenu() {
  const catalogue = useCatalogue();
  const [anchor, setAnchor] = useState(null);
  return (
    <MuiIsland>
      <Button color="inherit" onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="true" aria-expanded={Boolean(anchor)}>Products ▾</Button>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <Box component="nav" aria-label="Products" sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 260px)' }, gap: 2, maxWidth: '95vw' }}>
          {catalogue.groups.map((group) => (
            <Box key={group}>
              <Typography variant="overline" color="text.secondary">{group}</Typography>
              {catalogue.products.filter((p) => p.group === group).map((p) => (
                <Box key={p.id} component={Link} to={productHref(p)} target={p.href ? '_self' : undefined} onClick={() => setAnchor(null)}
                  sx={{ display: 'block', p: 1, borderRadius: 1, color: 'inherit', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover', textDecoration: 'none' } }}>
                  <Typography fontWeight={600} fontSize={14}>{p.name}{p.href ? ' ↗' : ''}</Typography>
                  <Typography variant="body2" color="text.secondary" fontSize={12.5}>{p.blurb}</Typography>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Popover>
    </MuiIsland>
  );
}
