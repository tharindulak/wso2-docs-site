// PROTOTYPE: HashiCorp-style products mega-menu (variant A) / simple list (variant C).
import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useHistory } from '@docusaurus/router';
import { PRODUCTS } from './catalogue';
export default function ProductsMenu({ mega = true, label = 'Products' }) {
  const [a, setA] = useState(null); const history = useHistory();
  const open = (p) => { setA(null); if (p.href) window.location.href = p.href; else if (!p.soon) history.push(p.sections[0].path); };
  return (<>
    <Button color="inherit" onClick={(e) => setA(e.currentTarget)} sx={{ textTransform: 'none' }}>{label} ▾</Button>
    <Menu anchorEl={a} open={!!a} onClose={() => setA(null)} slotProps={{ list: { sx: mega ? { display: 'grid', gridTemplateColumns: 'repeat(2, 260px)', gap: 0.5, p: 1 } : {} } }}>
      {PRODUCTS.map((p) => (
        <MenuItem key={p.id} onClick={() => open(p)} disabled={p.soon} sx={{ alignItems: 'flex-start', whiteSpace: 'normal', borderRadius: 1 }}>
          {mega ? <Box><Typography fontWeight={600}>{p.name}{p.soon ? ' (soon)' : p.href ? ' ↗' : ''}</Typography>
            <Typography variant="body2" color="text.secondary">{p.blurb}</Typography>
            {p.sections?.length > 1 && <Typography variant="caption" color="text.secondary">{p.sections.map((s) => s.label).join(' · ')}</Typography>}</Box>
            : <ListItemText primary={`${p.name}${p.soon ? ' (soon)' : p.href ? ' ↗' : ''}`} />}
        </MenuItem>))}
    </Menu>
  </>);
}
