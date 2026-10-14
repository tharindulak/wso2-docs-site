// Doc lookups within the version being rendered, for deprecation notices and the Deprecations page: a doc id to its
// URL and title (the version's docs metadata and the docs plugin's global data, both already loaded on doc pages),
// and the docs section the version belongs to. Null outside a docs version.
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useDocsVersion, useDocsData } from '@docusaurus/plugin-content-docs/client';

export default function useDocResolver() {
  const { siteConfig } = useDocusaurusContext();
  try {
    const version = useDocsVersion();
    const global = useDocsData(version.pluginId).versions.find((v) => v.name === version.version);
    const resolveDoc = (id) => {
      const doc = version.docs[id];
      const path = global?.docs.find((d) => d.id === id)?.path;
      return doc && path ? { url: path, title: doc.title } : null;
    };
    const info = siteConfig.customFields.versionInfo?.[version.pluginId];
    return { resolveDoc, sectionId: info?.sectionId, info };
  } catch {
    return null; // not inside a docs version
  }
}
