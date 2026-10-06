// PROTOTYPE: draft product catalogue (assets/product-catalogue.md); sections = one docs set each.
export const PRODUCTS = [
  { id: 'identity', name: 'Identity Platform', blurb: 'Sign-in, SSO, users and access. Cloud and self-hosted (Identity Server).',
    sections: [{ label: 'Docs', pluginId: 'identity', path: '/identity/' }], older: 'https://is.docs.wso2.com/en/7.0.0/' },
  { id: 'integration', name: 'Integration Platform', blurb: 'Build and run integrations. Cloud (Devant) and self-hosted distributions.',
    sections: [
      { label: 'Cloud', pluginId: 'integration-cloud', path: '/integration/cloud/' },
      { label: 'Micro Integrator', pluginId: 'integration-mi', path: '/integration/micro-integrator/' },
      { label: 'WSO2 Integrator', pluginId: 'integration-integrator', path: '/integration/integrator/' },
    ], older: 'https://mi.docs.wso2.com/' },
  { id: 'api', name: 'API Platform', blurb: 'Design, secure and publish APIs.', soon: true },
  { id: 'agent', name: 'Agent Manager', blurb: 'Build and govern AI agents.', soon: true },
  { id: 'analytics', name: 'API Analytics Platform', blurb: 'Powered by Moesif. Docs at moesif.com.', href: 'https://www.moesif.com/docs/' },
];
export const HUB = [
  ['Overview', '/cloud/overview/what-is-wso2-cloud'], ['Get started', '/cloud/get-started/wso2-cloud-account-and-sign-up'],
  ['Account and administration', '/cloud/account-and-administration/billing-and-subscriptions'],
  ['Trust and support', '/cloud/trust-and-support/sla'], ['Reference', '/cloud/reference/product-names'],
];
export function locate(pathname) {
  for (const p of PRODUCTS) for (const s of p.sections ?? []) if (pathname.startsWith(s.path)) return { product: p, section: s };
  return {};
}
