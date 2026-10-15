import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export function useCatalogue() {
  return useDocusaurusContext().siteConfig.customFields.catalogue;
}

/** The product and section a pathname belongs to. */
export function locate(catalogue, pathname) {
  for (const product of catalogue.products) {
    for (const section of product.sections ?? []) {
      if (pathname === section.path.slice(0, -1) || pathname.startsWith(section.path)) return { product, section };
    }
  }
  return {};
}

/** Products and groups the menus and home page list: products hidden from navigation are left out. */
export const listedProducts = (catalogue, group) => catalogue.products.filter((p) => p.group === group && !p.hidden);
export const listedGroups = (catalogue) => catalogue.groups.filter((g) => listedProducts(catalogue, g).length);

export const productHref = (p) => p.href ?? p.sections[0].landing ?? p.sections[0].path;
