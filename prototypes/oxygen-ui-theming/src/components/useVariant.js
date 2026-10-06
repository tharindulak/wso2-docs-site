import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
export default function useVariant() {
  return useDocusaurusContext().siteConfig.customFields.variant;
}
