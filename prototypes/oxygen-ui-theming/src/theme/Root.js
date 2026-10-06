// PROTOTYPE: variant A wraps the whole site in OxygenUIThemeProvider (which always adds CssBaseline).
import React from 'react';
import useVariant from '@site/src/components/useVariant';
import VariantSwitcher from '@site/src/components/VariantSwitcher';
import { OxygenUIThemeProvider, WSO2Theme } from '@wso2/oxygen-ui';
import SyncMuiMode from '@site/src/components/SyncMuiMode';
export default function Root({ children }) {
  const v = useVariant();
  const page = v === 'A'
    ? <OxygenUIThemeProvider theme={WSO2Theme}><SyncMuiMode />{children}</OxygenUIThemeProvider>
    : children;
  return <>{page}<VariantSwitcher /></>;
}
