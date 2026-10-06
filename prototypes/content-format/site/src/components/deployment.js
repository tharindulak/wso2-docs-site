// PROTOTYPE: shared bits for the deployment-option label variants (A, B, C via ?variant=).
import React, { useEffect, useState } from 'react';
export const OPTIONS = {
  'WSO2 Cloud': { key: 'cloud', short: 'Cloud', color: '#2e7dd7' },
  Hybrid: { key: 'hybrid', short: 'Hybrid', color: '#7b4fd6' },
  'Self-hosted': { key: 'self', short: 'Self-hosted', color: '#b25000' },
};
export function Icon({ option, size = 14 }) {
  const c = OPTIONS[option]?.color ?? 'currentColor'; const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: 2, 'aria-hidden': true };
  if (option === 'WSO2 Cloud') return <svg {...p}><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z" /></svg>;
  if (option === 'Hybrid') return <svg {...p}><path d="M4 8h12l-3-3M20 16H8l3 3" /></svg>;
  return <svg {...p}><rect x="4" y="4" width="16" height="7" rx="1" /><rect x="4" y="13" width="16" height="7" rx="1" /></svg>;
}
const KEY = 'proto-label-variant';
export function useLabelVariant() {
  const [v, setV] = useState('A'); // SSR renders A; the client switches after hydration (fine for a look-and-feel prototype)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('variant');
    let s = null; try { s = sessionStorage.getItem(KEY); } catch {}
    const next = q || s || 'A'; setV(next); try { sessionStorage.setItem(KEY, next); } catch {}
    const on = () => { try { setV(sessionStorage.getItem(KEY) || 'A'); } catch {} };
    window.addEventListener('proto-variant', on); return () => window.removeEventListener('proto-variant', on);
  }, []);
  return v;
}
export function setLabelVariant(v) {
  try { sessionStorage.setItem(KEY, v); } catch {}
  const u = new URL(window.location.href); u.searchParams.set('variant', v); window.history.replaceState(null, '', u);
  window.dispatchEvent(new Event('proto-variant'));
}
