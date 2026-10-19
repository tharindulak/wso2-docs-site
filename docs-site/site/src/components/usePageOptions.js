// The deployment options of the page being rendered (front matter deployment_options), or null outside a doc page.
import { useDoc } from '@docusaurus/plugin-content-docs/client';
export default function usePageOptions() {
  try {
    const options = useDoc().frontMatter.deployment_options;
    return Array.isArray(options) && options.length ? options : null;
  } catch {
    return null; // not inside a doc (for example a partial rendered elsewhere)
  }
}
