// PROTOTYPE: switches the redesign variants on the same page via ?variant= (kept across navigation), sets
// html[data-variant] for redesign.css. Shown only in builds made with PROTOTYPE_VARIANTS=1.
import React, { useEffect, useState } from 'react';
import { useLocation } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

const VARIANTS = [['a', 'Mockup on Oxygen'], ['b', 'Oxygen-native']];
const KEY = 'redesign-variant';

function current() {
  const fromUrl = new URLSearchParams(window.location.search).get('variant');
  if (VARIANTS.some(([k]) => k === fromUrl)) return fromUrl;
  try { return sessionStorage.getItem(KEY) || 'a'; } catch { return 'a'; }
}

export default function VariantSwitcher() {
  const { prototypeVariants } = useDocusaurusContext().siteConfig.customFields;
  const location = useLocation();
  const [variant, setVariant] = useState('a');

  // Apply on every route change: Docusaurus links drop the search param, so it is put back on the URL.
  useEffect(() => {
    if (!prototypeVariants) return;
    const v = current();
    setVariant(v);
    document.documentElement.dataset.variant = v;
    try { sessionStorage.setItem(KEY, v); } catch {}
    const url = new URL(window.location.href);
    if (url.searchParams.get('variant') !== v) { url.searchParams.set('variant', v); window.history.replaceState(window.history.state, '', url); }
  }, [location.pathname, prototypeVariants]);

  const go = (d) => {
    const i = VARIANTS.findIndex(([k]) => k === variant);
    const next = VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length][0];
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState(window.history.state, '', url);
    try { sessionStorage.setItem(KEY, next); } catch {}
    document.documentElement.dataset.variant = next;
    setVariant(next);
  };

  useEffect(() => {
    if (!prototypeVariants) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!prototypeVariants) return null;
  const name = VARIANTS.find(([k]) => k === variant)?.[1];
  return (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
      background: '#111', color: '#fff', borderRadius: 999, padding: '6px 10px', display: 'flex', gap: 10,
      alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.35)', font: '13px system-ui' }}>
      <button type="button" onClick={() => go(-1)} style={btn} aria-label="Previous variant">←</button>
      <span>PROTOTYPE {variant.toUpperCase()} ({name})</span>
      <button type="button" onClick={() => go(1)} style={btn} aria-label="Next variant">→</button>
    </div>
  );
}
const btn = { background: 'transparent', color: '#fff', border: '1px solid #555', borderRadius: 999, cursor: 'pointer', padding: '2px 8px' };
