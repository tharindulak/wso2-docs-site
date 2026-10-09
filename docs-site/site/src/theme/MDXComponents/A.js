// Wraps the theme's MDX link so links to files keep their exact URL (see lib/asset-links.mjs).
import React from 'react';
import A from '@theme-original/MDXComponents/A';
import { assetHref } from '../../lib/asset-links.mjs';

export default function MDXA(props) {
  return <A {...props} href={assetHref(props)} />;
}
