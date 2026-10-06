// PROTOTYPE switcher for navigation variants (?nav=, ←/→). Label stays on decided variant A.
import React, { useEffect } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useNavVariant, setNavVariant } from './nav';
const NAMES = { A: 'HashiCorp: mega-menu + product tabs', B: 'Sidebar-first selectors', C: 'Hub-first top bar + product strip' }; const K = ['A', 'B', 'C'];
export default function VariantBar() {
  const v = useNavVariant(); const { showSwitcher } = useDocusaurusContext().siteConfig.customFields;
  const go = (d) => setNavVariant(K[(K.indexOf(v) + d + 3) % 3]);
  useEffect(() => { const h = (e) => { if (e.target.closest?.('input,textarea,[contenteditable],[role=combobox]')) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); });
  if (!showSwitcher) return null;
  const b = { background: 'transparent', color: '#fff', border: '1px solid #555', borderRadius: 999, cursor: 'pointer', padding: '2px 8px' };
  return (<div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111', color: '#fff', borderRadius: 999, padding: '6px 10px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.35)', font: '13px system-ui' }}>
    <button style={b} onClick={() => go(-1)} aria-label="Previous variant">←</button><span>PROTOTYPE nav {v} ({NAMES[v]})</span><button style={b} onClick={() => go(1)} aria-label="Next variant">→</button></div>);
}
