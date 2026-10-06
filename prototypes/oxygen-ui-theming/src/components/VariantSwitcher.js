// PROTOTYPE switcher: each variant is its own production build on its own port; keeps the path.
import React, { useEffect } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
const NAMES = { A: 'MUI everywhere', B: 'Tokens in Infima, no MUI', C: 'Tokens + MUI islands' };
const KEYS = ['A', 'B', 'C'];
export default function VariantSwitcher() {
  const { variant, ports, showSwitcher } = useDocusaurusContext().siteConfig.customFields;
  const go = (d) => {
    const next = KEYS[(KEYS.indexOf(variant) + d + KEYS.length) % KEYS.length];
    const { pathname, search, hash } = window.location;
    window.location.href = `http://localhost:${ports[next]}${pathname}${search}${hash}`;
  };
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t.closest?.('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!showSwitcher) return null;
  return (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
      background: '#111', color: '#fff', borderRadius: 999, padding: '6px 10px', display: 'flex', gap: 10,
      alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.35)', font: '13px system-ui' }}>
      <button onClick={() => go(-1)} style={btn} aria-label="Previous variant">←</button>
      <span>PROTOTYPE {variant} ({NAMES[variant]})</span>
      <button onClick={() => go(1)} style={btn} aria-label="Next variant">→</button>
    </div>
  );
}
const btn = { background: 'transparent', color: '#fff', border: '1px solid #555', borderRadius: 999, cursor: 'pointer', padding: '2px 8px' };
