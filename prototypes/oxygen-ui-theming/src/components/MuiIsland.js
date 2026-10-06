// PROTOTYPE variant C: MUI only inside this island; no CssBaseline, so Infima keeps the page.
// Imports @mui/material directly (tree-shakeable) with a theme rebuilt from Oxygen's WSO2Theme values,
// because importing anything from @wso2/oxygen-ui pulls its whole bundle (~480 KB gz).
import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SyncMuiMode from './SyncMuiMode';
const oxygenTokens = (mode) => ({
  primary: { main: '#FF7300', dark: 'rgb(178, 80, 0)', light: 'rgb(255, 143, 51)' },
  secondary: { main: '#5CD1FF' },
  ...(mode === 'dark'
    ? { background: { default: '#0f172a', paper: '#0f172a' }, text: { primary: '#FFFFFF' } }
    : { background: { default: '#ffffff', paper: '#ffffff' }, text: { primary: '#181818' } }),
});
export const islandTheme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-color-scheme', cssVarPrefix: 'oxygen' },
  colorSchemes: { light: { palette: oxygenTokens('light') }, dark: { palette: oxygenTokens('dark') } },
  typography: { fontFamily: "'Inter Variable', sans-serif" },
  shape: { borderRadius: 12 },
});
export default function MuiIsland({ children }) {
  return <ThemeProvider theme={islandTheme}><SyncMuiMode />{children}</ThemeProvider>;
}
