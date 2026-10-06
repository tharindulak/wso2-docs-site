// PROTOTYPE: the page-level deployment-option label, three structurally different variants.
import React from 'react';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MuiIsland from './MuiIsland';
import { Icon, OPTIONS, useLabelVariant } from './deployment';

export default function DeploymentLabel({ options }) {
  const v = useLabelVariant();
  if (!options?.length) return null;
  if (v === 'B') return (
    <MuiIsland><Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
      {options.map((o) => <Chip key={o} icon={<Icon option={o} />} label={o} size="small" variant="outlined"
        sx={{ borderColor: OPTIONS[o].color, color: OPTIONS[o].color, fontWeight: 600, '& .MuiChip-icon': { ml: '6px' } }} />)}
    </Stack></MuiIsland>
  );
  if (v === 'C') return (
    <MuiIsland><Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, color: 'text.secondary', fontSize: 13 }}>
      <span>Applies to</span>
      {options.map((o) => <Tooltip key={o} title={o} arrow><span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Icon option={o} size={16} />{OPTIONS[o].short}</span></Tooltip>)}
      <span style={{ opacity: .7 }}>· marked sections apply to one option only</span>
    </Stack></MuiIsland>
  );
  return (
    <MuiIsland><Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2.5, borderRadius: 2 }}>
      <Typography variant="body2"><strong>Deployment options:</strong> {options.join(', ')}</Typography>
    </Paper></MuiIsland>
  );
}
