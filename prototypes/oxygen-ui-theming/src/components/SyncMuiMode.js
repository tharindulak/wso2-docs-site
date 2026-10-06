// PROTOTYPE: keep MUI's colour mode in step with Docusaurus's html[data-theme].
import { useEffect } from 'react';
import { useColorScheme } from '@mui/material/styles';
export default function SyncMuiMode() {
  const { setMode } = useColorScheme();
  useEffect(() => {
    const h = document.documentElement;
    const sync = () => setMode(h.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    sync();
    const o = new MutationObserver(sync);
    o.observe(h, { attributes: true, attributeFilter: ['data-theme'] });
    return () => o.disconnect();
  }, [setMode]);
  return null;
}
