// A value that differs by deployment option: both shown, labelled. When one option has no value (the
// text exists for the other option only), only that value is shown, labelled "only". On a page that covers one
// option, only that option's value is shown, unlabelled.
import React from 'react';
import usePageOptions from './usePageOptions.js';
export default function DeploymentValue({ cloud, selfHosted }) {
  const page = usePageOptions();
  if (page?.length === 1) {
    const only = page[0] === 'WSO2 Cloud' ? cloud : page[0] === 'Self-hosted' ? selfHosted : null;
    if (only) return <code>{only}</code>;
  }
  if (!cloud && !selfHosted) return null;
  if (!cloud) return <span><code>{selfHosted}</code> <small>(Self-hosted only)</small></span>;
  if (!selfHosted) return <span><code>{cloud}</code> <small>(WSO2 Cloud only)</small></span>;
  return <span><code>{cloud}</code> <small>(WSO2 Cloud)</small> / <code>{selfHosted}</code> <small>(Self-hosted)</small></span>;
}
