// PROTOTYPE (Docs site redesign, "Doc page in the new look"): mounts the variant switcher. Drop when a variant wins.
import React from 'react';
import VariantSwitcher from '@site/src/components/prototype/VariantSwitcher';

export default function Root({ children }) {
  return <>{children}<VariantSwitcher /></>;
}
