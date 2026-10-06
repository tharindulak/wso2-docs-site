// PROTOTYPE: ?nav= variant state (separate from the label prototype's ?variant=).
import { useEffect, useState } from 'react';
const KEY = 'proto-nav-variant';
export function useNavVariant() {
  const [v, setV] = useState('A');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('nav'); let s = null; try { s = sessionStorage.getItem(KEY); } catch {}
    const n = q || s || 'A'; setV(n); try { sessionStorage.setItem(KEY, n); } catch {}
    const on = () => { try { setV(sessionStorage.getItem(KEY) || 'A'); } catch {} };
    window.addEventListener('proto-nav', on); return () => window.removeEventListener('proto-nav', on);
  }, []);
  return v;
}
export function setNavVariant(v) {
  try { sessionStorage.setItem(KEY, v); } catch {}
  const u = new URL(window.location.href); u.searchParams.set('nav', v); window.history.replaceState(null, '', u);
  window.dispatchEvent(new Event('proto-nav'));
}
