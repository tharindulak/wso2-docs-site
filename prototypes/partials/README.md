# PROTOTYPE (throwaway): includes as MDX partials

Question: [Includes as MDX partials in Latest](../../.scratch/wso2-docs-is-migration/issues/05-includes-as-partials.md).

`converter/` is a copy of `docs-site/packages/docs-converter/dist/src` with hooks added to `merge.js`, `render.js` and `site.js` that record every include as it renders. `survey.mjs` runs it over Asgardeo + IS 7.3.0 and classifies each include.

```sh
ln -sfn ../../docs-site/node_modules node_modules
node survey.mjs /Users/admin/Documents/wso2/git/docs <scratch out dir>   # writes survey.json there
```
