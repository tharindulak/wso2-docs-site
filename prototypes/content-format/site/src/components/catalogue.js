// PROTOTYPE: product catalogue (assets/product-catalogue.md, revised 2026-10-07). One entry per product,
// covering every deployment option; grouped like wso2.com/documentation. Not-yet-migrated products link out.
export const GROUPS = ['Agent Management', 'API Management', 'Integration', 'Identity and Access Management', 'Internal Developer Platform', 'Solutions', 'Other'];
export const PRODUCTS = [
  { id: 'agent', group: 'Agent Management', name: 'Agent Manager', blurb: 'Secure, operate and manage AI agents.', href: 'https://wso2.com/agent-platform/docs/v1.0.0/' },
  { id: 'api', group: 'API Management', name: 'API Platform', blurb: 'API lifecycle management with governance. Cloud (formerly Bijira) and self-hosted (API Manager).', href: 'https://apim.docs.wso2.com/en/latest/' },
  { id: 'apk', group: 'API Management', name: 'Kubernetes Gateway', blurb: 'Kubernetes-native API gateway.', href: 'https://apk.docs.wso2.com/en/latest/' },
  { id: 'analytics', group: 'API Management', name: 'API Analytics Platform', blurb: 'Powered by Moesif.', href: 'https://www.moesif.com/docs/' },
  { id: 'integration', group: 'Integration', name: 'Integration Platform', blurb: 'Build, deploy and run integrations. Cloud, hybrid and self-hosted.',
    sections: [
      { label: 'WSO2 Integrator', pluginId: 'integration-integrator', path: '/integration/integrator/' },
      { label: 'Micro Integrator', pluginId: 'integration-mi', path: '/integration/micro-integrator/' },
      { label: 'BI', href: 'https://bi.docs.wso2.com/' },
      { label: 'Streaming Integrator', href: 'https://si.docs.wso2.com/' },
    ], older: 'https://mi.docs.wso2.com/' },
  { id: 'identity', group: 'Identity and Access Management', name: 'Identity Platform', blurb: 'Sign-in, SSO, users and access. Cloud and self-hosted (Identity Server).',
    sections: [{ label: 'Docs', pluginId: 'identity', path: '/identity/' }], older: 'https://is.docs.wso2.com/en/7.0.0/' },
  { id: 'devplatform', group: 'Internal Developer Platform', name: 'Developer Platform', blurb: 'Design, develop, deploy and govern apps. For developers and platform engineers.', href: 'https://wso2.com/engineering-platform/developer-platform/docs/developer/' },
  { id: 'healthcare', group: 'Solutions', name: 'Accelerator for Healthcare', blurb: 'Accelerate healthcare app development.', href: 'https://healthcare.docs.wso2.com/' },
  { id: 'finserv', group: 'Solutions', name: 'Accelerator for Financial Services', blurb: 'Open banking and financial services.', href: 'https://ob.docs.wso2.com/en/latest/' },
  { id: 'updates', group: 'Other', name: 'Updates', blurb: 'Apply fixes, enhancements and security updates.', href: 'https://updates.docs.wso2.com/en/latest/' },
  { id: 'security', group: 'Other', name: 'Platform Security', blurb: 'How WSO2 tracks and handles vulnerabilities.', href: 'https://security.docs.wso2.com/en/latest/' },
];
export const HUB = [
  ['Overview', '/account/overview/what-is-wso2-cloud'], ['Get started', '/account/get-started/wso2-cloud-account-and-sign-up'],
  ['Account and administration', '/account/account-and-administration/billing-and-subscriptions'],
  ['Trust and support', '/account/trust-and-support/sla'], ['Reference', '/account/reference/product-names'],
];
export function locate(pathname) {
  for (const p of PRODUCTS) for (const s of p.sections ?? []) if (s.path && pathname.startsWith(s.path)) return { product: p, section: s };
  return {};
}
