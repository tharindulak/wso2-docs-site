// PROTOTYPE switcher (bottom bar, ←/→ keys). Hidden in production unless SHOW_SWITCHER=1 at build.
import React, { useEffect } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useLabelVariant, setLabelVariant } from './deployment';
const NAMES = { A: 'GitLab-style box + callouts', B: 'Chips + sidebar badges', C: 'Margin markers' }; const K = ['A', 'B', 'C'];
export default function VariantBar() {
  const v = useLabelVariant(); const { showSwitcher } = useDocusaurusContext().siteConfig.customFields;
  const go = (d) => setLabelVariant(K[(K.indexOf(v) + d + 3) % 3]);
  useEffect(() => { const h = (e) => { if (e.target.closest?.('input,textarea,[contenteditable]')) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); });
  if (!showSwitcher) return null;
  const b = { background: 'transparent', color: '#fff', border: '1px solid #555', borderRadius: 999, cursor: 'pointer', padding: '2px 8px' };
  return (<div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#111', color: '#fff', borderRadius: 999, padding: '6px 10px', display: 'flex', gap: 10, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.35)', font: '13px system-ui' }}>
    <button style={b} onClick={() => go(-1)} aria-label="Previous variant">←</button><span>PROTOTYPE {v} ({NAMES[v]})</span><button style={b} onClick={() => go(1)} aria-label="Next variant">→</button></div>);
}
