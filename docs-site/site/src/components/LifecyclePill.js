// Lifecycle stage pill (Beta, Preview, Deprecated) beside a doc page's title; the one-line explanation shows on hover.
import React from 'react';
import { lifecycleBadge } from '../lib/lifecycle.mjs';
export default function LifecyclePill({ frontMatter }) {
  const badge = lifecycleBadge(frontMatter);
  if (!badge) return null;
  return <span className={`lifecycle-pill lifecycle-pill--title lifecycle--${badge.stage}`} title={badge.title}>{badge.text}</span>;
}
