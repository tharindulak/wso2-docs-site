# WSO2 Documentation Repositories

An index of the GitHub repositories that hold the source for WSO2 product documentation, with a link to each repository's README.

The docs published at [wso2.com/documentation](https://wso2.com/documentation) are written and maintained in dedicated `docs-*` repositories under the [wso2](https://github.com/wso2) GitHub organization. They are not pulled from the product source repositories (for example, `product-apim` or `product-is`). Product repository READMEs describe how to build the product, not the docs.

> Last checked: 2026-10-06. Default branches differ between repositories (`main`, `master`, or `PE` for Choreo), so use the links below rather than assuming a branch.

## Active documentation

These repositories had commits in 2026.

| Product | Repository | README |
|---|---|---|
| API Manager | [wso2/docs-apim](https://github.com/wso2/docs-apim) | [README](https://github.com/wso2/docs-apim/blob/master/README.md) |
| API Platform | [wso2/docs-api-platform](https://github.com/wso2/docs-api-platform) | [README](https://github.com/wso2/docs-api-platform/blob/main/README.md) |
| APK (API platform for Kubernetes) | [wso2/docs-apk](https://github.com/wso2/docs-apk) | [README](https://github.com/wso2/docs-apk/blob/main/README.md) |
| API Microgateway | [wso2/docs-mg](https://github.com/wso2/docs-mg) | [README](https://github.com/wso2/docs-mg/blob/master/README.md) |
| Identity Server and Asgardeo | [wso2/docs-is](https://github.com/wso2/docs-is) | [README](https://github.com/wso2/docs-is/blob/master/README.md) |
| Micro Integrator | [wso2/docs-mi](https://github.com/wso2/docs-mi) | [README](https://github.com/wso2/docs-mi/blob/main/README.md) |
| WSO2 Integrator | [wso2/docs-integrator](https://github.com/wso2/docs-integrator) | [README](https://github.com/wso2/docs-integrator/blob/main/README.md) |
| Integrator: ICP | [wso2/docs-icp](https://github.com/wso2/docs-icp) | [README](https://github.com/wso2/docs-icp/blob/main/README.md) |
| Ballerina Integrator | [wso2/docs-bi](https://github.com/wso2/docs-bi) | [README](https://github.com/wso2/docs-bi/blob/main/README.md) |
| Streaming Integrator | [wso2/docs-si](https://github.com/wso2/docs-si) | [README](https://github.com/wso2/docs-si/blob/main/README.md) |
| Agent Manager Platform | [wso2/docs-agent-platform](https://github.com/wso2/docs-agent-platform) | [README](https://github.com/wso2/docs-agent-platform/blob/main/README.md) |
| Choreo | [wso2/docs-choreo-dev](https://github.com/wso2/docs-choreo-dev) | [README](https://github.com/wso2/docs-choreo-dev/blob/PE/README.md) |
| Devant | [wso2/docs-devant](https://github.com/wso2/docs-devant) | [README](https://github.com/wso2/docs-devant/blob/main/README.md) |
| WSO2 Cloud Console | [wso2/docs-wso2cloud](https://github.com/wso2/docs-wso2cloud) | [README](https://github.com/wso2/docs-wso2cloud/blob/main/README.md) |
| Open Banking | [wso2/docs-open-banking](https://github.com/wso2/docs-open-banking) | [README](https://github.com/wso2/docs-open-banking/blob/master/README.md) |
| Open Banking Toolkit: CDS | [wso2/docs-ob-toolkit-cds](https://github.com/wso2/docs-ob-toolkit-cds) | [README](https://github.com/wso2/docs-ob-toolkit-cds/blob/main/README.md) |
| Open Banking Toolkit: UK | [wso2/docs-ob-toolkit-uk](https://github.com/wso2/docs-ob-toolkit-uk) | [README](https://github.com/wso2/docs-ob-toolkit-uk/blob/main/README.md) |
| Open Healthcare | [wso2/open-healthcare-docs](https://github.com/wso2/open-healthcare-docs) | [README](https://github.com/wso2/open-healthcare-docs/blob/main/README.md) |
| Security | [wso2/docs-security](https://github.com/wso2/docs-security) | [README](https://github.com/wso2/docs-security/blob/main/README.md) |
| Updates 2.0 | [wso2/docs-updates](https://github.com/wso2/docs-updates) | [README](https://github.com/wso2/docs-updates/blob/master/README.md) |

Identity Server and Asgardeo share one repository: Identity Server content is under `en/identity-server` and Asgardeo content is under `en/asgardeo`.

## Older documentation

These repositories had no commits in 2026.

| Product | Repository | README |
|---|---|---|
| Integrator: WebSubHub | [wso2/docs-websubhub](https://github.com/wso2/docs-websubhub) | [README](https://github.com/wso2/docs-websubhub/blob/main/README.md) |
| Open Banking Toolkit: Berlin | [wso2/docs-ob-toolkit-berlin](https://github.com/wso2/docs-ob-toolkit-berlin) | [README](https://github.com/wso2/docs-ob-toolkit-berlin/blob/main/README.md) |
| Enterprise Integrator | [wso2/docs-ei](https://github.com/wso2/docs-ei) | [README](https://github.com/wso2/docs-ei/blob/master/README.md) |
| Cloud (older repository) | [wso2/docs-cloud](https://github.com/wso2/docs-cloud) | [README](https://github.com/wso2/docs-cloud/blob/master/README.md) |
| BFSI on Choreo | [wso2/docs-choreo-bfsi](https://github.com/wso2/docs-choreo-bfsi) | [README](https://github.com/wso2/docs-choreo-bfsi/blob/main/README.md) |

## Scope and limitations

- This list covers non-archived repositories in the `wso2` organization whose names contain "doc". A docs repository with a different naming pattern would not appear here.
- Some products may be documented outside the `wso2` organization (for example, Ballerina under `ballerina-platform`). Those are not included.
- The mapping to the product tiles on wso2.com/documentation has not been verified, because that page renders its links with JavaScript.

## Refreshing this list

With the [GitHub CLI](https://cli.github.com/) installed and authenticated:

```sh
# List non-archived docs repositories with their last push date
gh repo list wso2 --limit 1000 --json name,isArchived,pushedAt \
  --jq '.[] | select(.name|test("doc";"i")) | select(.isArchived|not) | "\(.name)\t\(.pushedAt[:10])"'

# Get the README URL for a repository
gh api repos/wso2/<repo>/readme --jq '.html_url'
```
