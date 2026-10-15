// Global bar: brand, Products menu, Account and billing, search, colour mode.
// Only the contents are customised, so Docusaurus keeps its .navbar element and mobile sidebar.
import React from 'react';
import Link from '@docusaurus/Link';
import NavbarLogo from '@theme/Navbar/Logo';
import NavbarColorModeToggle from '@theme/Navbar/ColorModeToggle';
import NavbarMobileSidebarToggle from '@theme/Navbar/MobileSidebar/Toggle';
import ProductsMenu from '@site/src/components/ProductsMenu.js';
import SearchButton from '@site/src/components/search/SearchButton.js';
import { useCatalogue } from '@site/src/components/catalogue.js';

export default function NavbarContent() {
  const { accountHidden } = useCatalogue();
  return (
    <div className="navbar__inner">
      <div className="navbar__items">
        <NavbarMobileSidebarToggle />
        <NavbarLogo />
        <span className="navbar-products"><ProductsMenu /></span>
        {!accountHidden && <Link className="navbar__item navbar__link navbar-account" to="/account/">Account and billing</Link>}
      </div>
      <div className="navbar__items navbar__items--right">
        <SearchButton />
        <NavbarColorModeToggle />
      </div>
    </div>
  );
}
