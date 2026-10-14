// PROTOTYPE, throwaway. Lifecycle badge variants on real pages, from /__lc/data.json (stages read from the source).
// A page's badge: its stage; when the stage covers only some of the page's deployment options, the badge names them
// ("Preview · WSO2 Cloud"). "(deprecated)" is taken out of the title and sidebar label wherever a badge shows it.
// Served to the browser with types stripped (serve.ts), so only erasable TypeScript syntax is allowed here.

type Stage = 'beta' | 'preview' | 'deprecated';
type Variant = '0' | 'A' | 'B' | 'C';
interface Marking { stage: Stage; since?: string; replacement?: { url: string; title: string } }
interface Entry { kind: 'page' | 'section'; url: string; built: boolean; version: string; title: string; options: Record<string, Marking>; sample?: boolean }

const VARIANTS: [Variant, string][] = [
  ['0', 'Today (no badge)'],
  ['A', 'Pill beside the title; pill in the sidebar'],
  ['B', 'Strip above the title with the explanation; dot in the sidebar'],
  ['C', 'Row in the Deployment options box; small label in the sidebar'],
];
const STAGES: Record<Stage, { label: string; line: string; link?: { href: string; text: string } }> = {
  beta: { label: 'Beta', line: 'Available to everyone; may change before general availability.', link: { href: '/identity/references/operational-policies/#103-beta-features', text: 'Beta features' } },
  preview: { label: 'Preview', line: 'Turn it on in the Console under Feature Preview before use.' },
  deprecated: { label: 'Deprecated', line: 'Still works, but not recommended; it will be removed in a future release.', link: { href: '/identity/references/wso2-identity-server-feature-deprecation/', text: 'Feature deprecation' } },
};
const DEPRECATED_SUFFIX = /\s*\((deprecated|Deprecated)\)\s*$/;

const fromUrl = new URLSearchParams(location.search).get('variant');
const variant: Variant = VARIANTS.some(([k]) => k === fromUrl) ? (fromUrl as Variant) : 'A';
const norm = (p: string): string => (p.endsWith('/') ? p : `${p}/`);

/** The page's deployment options, from its Deployment options box (read once, before variant C adds a row to it). */
let optionsCache: string[] | undefined;
function pageOptions(): string[] {
  if (optionsCache) return optionsCache;
  const box = document.querySelector('.deployment-box');
  const text = (box?.textContent ?? '').replace(/^\s*Deployment options:\s*/, '');
  return (optionsCache = text.split(',').map((s) => s.trim()).filter(Boolean));
}

/** The stage and scope to show: one stage; the options it covers, or none when it covers all of the page's. */
function badgeOf(e: Entry, options: string[]): { stage: Stage; scope: string[] } {
  const marked = Object.entries(e.options);
  const stage = (marked.find(([, m]) => m.stage === 'preview') ?? marked[0])[1].stage; // Preview wins (ticket 11)
  const covered = marked.filter(([, m]) => m.stage === stage).map(([o]) => o);
  const all = options.length ? options : covered;
  return { stage, scope: all.every((o) => covered.includes(o)) ? [] : covered };
}

const el = (tag: string, cls: string, text = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };

function pill(stage: Stage, scope: string[], cls: string): HTMLElement {
  const p = el('span', `${cls} lc--${stage}`, STAGES[stage].label + (scope.length ? ` · ${scope.join(', ')}` : ''));
  p.title = STAGES[stage].line;
  return p;
}

function explanation(stage: Stage): HTMLElement {
  const span = el('span', 'lc-line', STAGES[stage].line);
  const link = STAGES[stage].link;
  if (link) { const a = document.createElement('a'); a.href = link.href; a.textContent = link.text; span.append(' ', a); }
  return span;
}

function title(e: Entry): void {
  const h1 = document.querySelector('article h1');
  if (!h1) return;
  const { stage, scope } = badgeOf(e, pageOptions());
  if (e.options && stage === 'deprecated') h1.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) n.textContent = (n.textContent ?? '').replace(DEPRECATED_SUFFIX, ''); });
  if (variant === 'A') {
    const row = el('div', 'lc-title-row');
    h1.before(row);
    row.append(h1, pill(stage, scope, 'lc-pill'));
  }
  if (variant === 'B') {
    const strip = el('div', `lc-strip lc--${stage}`);
    strip.append(el('strong', 'lc-strip__label', STAGES[stage].label + (scope.length ? ` on ${scope.join(', ')}` : '')), explanation(stage));
    h1.before(strip);
  }
  if (variant === 'C') {
    const box = document.querySelector('.deployment-box');
    const row = el('div', 'lc-box-row');
    row.append(el('strong', '', 'Lifecycle: '), pill(stage, scope, 'lc-pill'), ' ', explanation(stage));
    if (box) box.append(row); else h1.before(row);
  }
}

function sidebar(entries: Entry[]): void {
  // The breadcrumb repeats the nav label, "(deprecated)" included; the badge says it now.
  if (entries.some((e) => e.url === norm(location.pathname))) {
    document.querySelectorAll('.breadcrumbs__item--active .breadcrumbs__link').forEach((b) => { b.textContent = (b.textContent ?? '').replace(DEPRECATED_SUFFIX, ''); });
  }
  for (const e of entries) {
    for (const a of document.querySelectorAll<HTMLAnchorElement>(`nav a.menu__link[href="${e.url}"]`)) {
      const stage = (Object.values(e.options).find((m) => m.stage === 'preview') ?? Object.values(e.options)[0]).stage;
      const textNode = [...a.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim());
      if (textNode && stage === 'deprecated') textNode.textContent = (textNode.textContent ?? '').replace(DEPRECATED_SUFFIX, '');
      if (variant === 'A') a.append(' ', pill(stage, [], 'lc-pill lc-pill--small'));
      if (variant === 'B') a.prepend(el('span', `lc-dot lc--${stage}`));
      if (variant === 'C') a.append(' ', el('span', `lc-suffix lc--${stage}`, STAGES[stage].label));
    }
  }
}

function renderBar(entries: Entry[], here: Entry | undefined): void {
  const bar = el('div', 'lc-bar');
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  bar.innerHTML = `
    <div class="lc-bar__row">
      <button type="button" data-go="-1" aria-label="Previous variant">←</button>
      <strong></strong><span class="lc-bar__name"></span>
      <button type="button" data-go="1" aria-label="Next variant">→</button>
      <select aria-label="Marked pages"><option value="">Marked pages…</option></select>
    </div>
    <pre class="lc-bar__state"></pre>`;
  bar.querySelector('strong')!.textContent = VARIANTS[idx][0];
  bar.querySelector('.lc-bar__name')!.textContent = VARIANTS[idx][1];
  const select = bar.querySelector('select')!;
  entries.filter((e) => e.built && e.kind === 'page').forEach((e) => {
    const stages = Object.entries(e.options).map(([o, m]) => `${STAGES[m.stage].label} (${o})`).join(', ');
    select.add(new Option(`${e.sample ? '[sample] ' : ''}${e.title}: ${stages}`, e.url, false, norm(location.pathname) === e.url));
  });
  select.addEventListener('change', () => { if (select.value) go(select.value); });
  bar.querySelector('.lc-bar__state')!.textContent = here
    ? `${here.sample ? 'SAMPLE marking (no page carries Beta or Preview yet). ' : 'From the source front matter. '}${Object.entries(here.options).map(([o, m]) => `${o}: ${m.stage}${m.since ? ` since ${m.since}` : ''}`).join(' · ')} · page options: ${pageOptions().join(', ') || 'none'}`
    : 'This page has no lifecycle stage. Pick a marked page above.';
  bar.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => cycle(Number(b.dataset.go))));
  document.body.append(bar);
}

const go = (pathname: string, v: Variant = variant): void => { location.href = `${pathname}?variant=${v}`; };
const cycle = (dir: number): void => {
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  go(location.pathname, VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length][0]);
};

// Docusaurus moves between pages client-side, which would bypass the injected script; force full loads instead.
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(a instanceof HTMLAnchorElement) || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.closest('.lc-bar')) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || (u.pathname === location.pathname && u.hash)) return;
  e.preventDefault();
  e.stopPropagation();
  u.searchParams.set('variant', variant);
  location.href = u.href;
}, true);

document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'ArrowLeft') cycle(-1);
  if (e.key === 'ArrowRight') cycle(1);
});

// Wait for React hydration to finish before changing the page, or React redraws it.
window.addEventListener('load', () => setTimeout(async () => {
  const entries: Entry[] = (await (await fetch('/__lc/data.json')).json() as Entry[]).filter((e) => e.version === 'Latest');
  const here = entries.find((e) => e.kind === 'page' && e.url === norm(location.pathname));
  pageOptions();
  if (variant !== '0') {
    if (here) title(here);
    sidebar(entries.filter((e) => e.kind === 'page'));
  }
  renderBar(entries, here);
}, 400));
