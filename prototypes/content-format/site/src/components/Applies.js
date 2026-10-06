// PROTOTYPE: content that applies to one deployment option only, three variants.
import React from 'react';
import Tooltip from '@mui/material/Tooltip';
import MuiIsland from './MuiIsland';
import { Icon, OPTIONS, useLabelVariant } from './deployment';
export default function Applies({ to, children }) {
  const v = useLabelVariant(); const o = OPTIONS[to] ?? OPTIONS['Self-hosted'];
  if (v === 'B') return (
    <div className="lbl-b" style={{ '--c': o.color }}>
      <span className="lbl-b__chip"><Icon option={to} size={12} /> {to}</span>{children}
    </div>
  );
  if (v === 'C') return (
    <div className="lbl-c" style={{ '--c': o.color }}>
      <MuiIsland><Tooltip title={`${to} only`} placement="left" arrow><span className="lbl-c__mark"><Icon option={to} size={14} /></span></Tooltip></MuiIsland>
      {children}
    </div>
  );
  return (
    <div className="lbl-a" style={{ '--c': o.color }}>
      <div className="lbl-a__label">{to} only</div>{children}
    </div>
  );
}
