// MUI only inside islands, themed with Oxygen values; no CssBaseline, so Infima keeps the page.
import React, { useEffect } from 'react';
import { ThemeProvider, createTheme, useColorScheme } from '@mui/material/styles';

const palette = (mode) => ({
  primary: { main: '#FF7300', dark: '#B25000', light: '#FF8F33', contrastText: '#000000' },
  secondary: { main: '#5CD1FF' },
  ...(mode === 'dark'
    ? { background: { default: '#0f172a', paper: '#0f172a' }, text: { primary: '#FFFFFF' } }
    : { background: { default: '#ffffff', paper: '#ffffff' }, text: { primary: '#181818' } }),
});

export const oxygenTheme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-color-scheme', cssVarPrefix: 'oxygen' },
  colorSchemes: { light: { palette: palette('light') }, dark: { palette: palette('dark') } },
  typography: { fontFamily: "'Inter Variable', system-ui, sans-serif", button: { textTransform: 'none' } },
  shape: { borderRadius: 10 },
});

function FollowDocusaurusMode() {
  const { setMode } = useColorScheme();
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => setMode(html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [setMode]);
  return null;
}

export default function MuiIsland({ children }) {
  return (
    <ThemeProvider theme={oxygenTheme} disableTransitionOnChange>
      <FollowDocusaurusMode />
      {children}
    </ThemeProvider>
  );
}
