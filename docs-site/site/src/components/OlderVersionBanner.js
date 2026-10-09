// Shown on every page of a version other than Latest.
import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useActivePlugin } from '@docusaurus/plugin-content-docs/client';

export default function OlderVersionBanner() {
  const { versionInfo } = useDocusaurusContext().siteConfig.customFields;
  const info = versionInfo?.[useActivePlugin()?.pluginId];
  if (!info || info.status === 'latest') return null;
  return (
    <div className="older-version-banner" role="note">
      {info.cloud
        ? <>You're viewing Self-hosted {info.version}. For WSO2 Cloud and the latest release, see <Link to={info.latestPath}>Latest</Link>.</>
        : <>You're viewing {info.version}. For the latest release, see <Link to={info.latestPath}>Latest</Link>.</>}
    </div>
  );
}
