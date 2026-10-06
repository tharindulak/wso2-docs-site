import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import MuiIsland from '@site/src/components/MuiIsland';
import ProductSwitcher from '@site/src/components/ProductSwitcher';
import React from 'react';
export default {
  ...ComponentTypes,
  'custom-productSwitcher': () => <MuiIsland><ProductSwitcher /></MuiIsland>,
};
