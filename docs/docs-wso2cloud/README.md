# WSO2 Cloud Docs

Documentation site for WSO2 Cloud, built with [Docusaurus](https://docusaurus.io/).

## Prerequisites

Node.js 20 or above.

## Install

```bash
npm install
```

## Local development

```bash
npm start
```

Starts a dev server on <http://localhost:3000> with live reload.

> Static assets in `static/` are copied at startup. Restart the server after
> changing them.

## Build

```bash
npm run build
npm run serve
```

`npm run build` writes a static site to `build/`. Use `npm run serve` to preview
it.

## Type checking

```bash
npm run typecheck
```

## Layout

The site uses the standard Docusaurus classic theme: navbar, docs sidebar and
footer. The home page redirects to `docs/intro`. Pages live in `docs/`, and the
sidebar is generated from that folder.

Search uses
[`@easyops-cn/docusaurus-search-local`](https://github.com/easyops-cn/docusaurus-search-local).
The index is built at `npm run build` time, so search returns no results under
`npm start`. Use `npm run build && npm run serve` to test it.

## Build and run the container

WSO2 Cloud CI builds the image from the `Dockerfile` (see
`.cicd/wso2cloud-docs.yaml`) and deploys it as the `wso2cloud-docs` component.
To build and run it locally:

```bash
docker build -t wso2cloud-docs .
docker run --rm -p 8080:8080 wso2cloud-docs
```

The site is served at <http://localhost:8080/>. The image runs nginx as the
non-root user `choreouser` (UID 10001) on port 8080, using `nginx.conf` from this
repo. The same image is promoted from dev to stage to prod, so keep
environment-specific settings out of the build. The only exception is `url` in
`docusaurus.config.ts`, which must be the production docs host.

## License

Apache License 2.0. See [LICENSE](LICENSE).
