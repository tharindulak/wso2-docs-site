// PROTOTYPE: HashiCorp-style product switcher built from MUI (variants A and C).
import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import { useHistory } from '@docusaurus/router';
const PRODUCTS = [
  ['Identity Platform', '/identity/', 'Asgardeo and Identity Server'],
  ['Integration Platform', '/integration/', 'Devant, Micro Integrator, Integrator'],
];
export default function ProductSwitcher() {
  const [anchor, setAnchor] = useState(null);
  const history = useHistory();
  return (
    <>
      <Button color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>Products ▾</Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {PRODUCTS.map(([t, h, d]) => (
          <MenuItem key={h} onClick={() => { setAnchor(null); history.push(h); }}>
            <ListItemText primary={t} secondary={d} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
