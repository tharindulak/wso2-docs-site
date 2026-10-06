// PROTOTYPE: GitLab-style "Deployment options" block under the page title.
import React from 'react';
import useVariant from './useVariant';
import MuiIsland from './MuiIsland';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

function MuiBlock({ options }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle2" component="span">Deployment options:</Typography>
        {options.map((o) => <Chip key={o} label={o} size="small" color="primary" variant="outlined" />)}
      </Stack>
    </Paper>
  );
}

export default function DeploymentOptions({ options }) {
  const v = useVariant();
  if (v === 'A') return <MuiBlock options={options} />;
  if (v === 'C') return <MuiIsland><MuiBlock options={options} /></MuiIsland>;
  return (
    <div className="proto-deploy-block">
      <strong>Deployment options:</strong>{' '}
      {options.map((o) => <span key={o} className="proto-deploy-pill">{o}</span>)}
    </div>
  );
}
