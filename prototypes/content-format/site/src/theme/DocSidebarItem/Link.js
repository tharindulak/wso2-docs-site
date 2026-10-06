// PROTOTYPE variant B: sidebar badge for pages that apply to one deployment option only.
import React from 'react';
import Link from '@theme-original/DocSidebarItem/Link';
import { Icon, useLabelVariant } from '@site/src/components/deployment';
export default function LinkWrapper(props) {
  const v = useLabelVariant(); const d = props.item.customProps?.deployment;
  const item = v === 'B' && d?.length === 1 ? { ...props.item, label: <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{props.item.label}<span title={`${d[0]} only`}><Icon option={d[0]} size={12} /></span></span> } : props.item;
  return <Link {...props} item={item} />;
}
