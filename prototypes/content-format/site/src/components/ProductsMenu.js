// PROTOTYPE: HashiCorp-style products mega-menu, grouped like wso2.com/documentation; one entry per product.
import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@docusaurus/Link';
import { GROUPS, PRODUCTS } from './catalogue';
const target = (p) => p.href ?? p.sections[0].path;
export default function ProductsMenu({ label = 'Products' }) {
  const [a, setA] = useState(null);
  return (<>
    <Button color="inherit" onClick={(e) => setA(e.currentTarget)} sx={{ textTransform: 'none' }}>{label} ▾</Button>
    <Popover open={!!a} anchorEl={a} onClose={() => setA(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
      <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 260px)', gap: 2, maxWidth: '95vw' }}>
        {GROUPS.map((g) => (<Box key={g}>
          <Typography variant="overline" color="text.secondary">{g}</Typography>
          {PRODUCTS.filter((p) => p.group === g).map((p) => (
            <Box key={p.id} component={Link} to={target(p)} onClick={() => setA(null)} sx={{ display: 'block', p: 1, borderRadius: 1, color: 'inherit', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover', textDecoration: 'none' } }}>
              <Typography fontWeight={600} fontSize={14}>{p.name}{p.href ? ' ↗' : ''}</Typography>
              <Typography variant="body2" color="text.secondary" fontSize={12.5}>{p.blurb}</Typography>
            </Box>))}
        </Box>))}
      </Box>
    </Popover>
  </>);
}
