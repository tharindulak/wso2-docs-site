# Hub site tree (decided 2026-10-05)

From [Hub information architecture](../issues/04-hub-information-architecture.md). [hub] = hub owns the page; → = links out.

```
WSO2 Cloud docs (hub)
├── 1. Overview                              [hub]
│   ├── What is WSO2 Cloud
│   ├── How the products fit together        (architecture diagram + one paragraph per relationship)
│   └── Deployment options (SaaS / hybrid / self-hosted)
├── 2. Get started                           [hub]
│   ├── WSO2 Cloud account and sign-up       (+ fallback version: per-product sign-up)
│   ├── Organizations and users              (hub owns concept; products link here)
│   └── Choose your first product            → each product's getting started
├── 3. Products                              [hub page each, links out]
│   ├── Agent Manager
│   ├── Identity Platform
│   ├── API Platform
│   ├── Integration Platform
│   └── API Analytics Platform               → moesif.com/docs, + Moesif Basic in API Platform
├── 4. Account and administration            [hub]
│   ├── Billing and subscriptions
│   ├── Regions and data residency
│   └── Enterprise login (SSO)               (hub owns concept; products link here)
├── 5. Trust and support                     [hub]
│   ├── SLA
│   ├── Security and compliance
│   ├── Support                              (per-product table, links out)
│   └── Status                               (per-product table, links out)
└── 6. Reference                             [hub]
    └── Product names (former names, incl. Bijira)
```

## Product page template

1. What it is and when to use it (2 or 3 lines)
2. Deployment options (SaaS, hybrid, self-hosted; links to on-prem docs)
3. Links: docs, console, getting started, status, support
4. Related products

No feature lists. API Analytics Platform adds: "API Analytics Platform is powered by Moesif, a WSO2 company. Its docs are hosted at moesif.com." plus a "Moesif Basic in API Platform" section.
