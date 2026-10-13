// PROTOTYPE, throwaway. Finds closing sections and reshapes them per ?variant=.
// A closing section is an h2/h3 titled "What's next", "Next steps", "See also", "Learn more" (and close variants),
// plus everything up to the next heading at its level or above. Only a section that is a single list whose items each
// start with a link becomes cards or rows; a section with prose stays as written (the state panel says why).
// A card's text: the author's own words after the link ("Link — does X") if any, else the linked page's
// <meta name="description"> (what Docusaurus's doc metadata holds: front matter, or the first line of the page).
// Served to the browser with types stripped (serve.ts), so only erasable TypeScript syntax is allowed here.

type Variant = '0' | 'A' | 'B' | 'C' | 'D';
interface Item { href: string; title: string; text: string; source: 'author' | 'page' | 'none' | 'external'; external: boolean }
interface Found { title: string; level: number; items: Item[] | null; reason: string; box: HTMLElement | null; heading: Element; body: Element[] }

const VARIANTS: [Variant, string][] = [
  ['0', 'Today (as written)'],
  ['A', 'Cards: title and description, in a grid'],
  ['B', 'Rows: one line each, title and description'],
  ['C', 'Up next: the first link as a lead card, the rest as links'],
  ['D', 'Box: the section in a box, links only, no descriptions'],
];
const SAMPLES: [string, string][] = [
  ['/identity/guides/verifiable-credentials/oid4vci/', 'See also, 4 links with author descriptions'],
  ['/identity/guides/authentication/login-flow-builder/', "What's next?, 4 links"],
  ['/identity/guides/users/user-stores/configure-a-user-store/', "What's Next, 4 links"],
  ['/identity/guides/customer-data/enable-customer-data-service/', 'Next steps, 3 links'],
  ['/identity/guides/consent-management/policy-consent/', "What's next, 2 links"],
  ['/identity/guides/applications/register-mobile-app/', "What's next?, 1 link"],
  ['/identity/guides/authentication/app-native-authentication/add-app-native-authentication/', 'Two sections (h2 and h3)'],
  ['/identity/deploy/security/keystores/', 'Next steps with prose'],
  ['/identity/guides/authentication/mfa/', "What's next? with prose, 7 links"],
  ['/identity/tutorials/ciba-for-ai-agents/', 'Learn More, external links'],
  ['/identity/deploy/elk-analytics-for-adaptive-authentication/', 'Prose only'],
];
const TITLE = /^(what.?s next\??|next steps|learn more|see also|related topics|related links|further reading)$/i;
const DASH = /^\s*[—–:-]\s*/;

const fromUrl = new URLSearchParams(location.search).get('variant');
const variant: Variant = VARIANTS.some(([k]) => k === fromUrl) ? (fromUrl as Variant) : 'A';
const found: Found[] = [];

const depth = (el: Element): number => (/^H[2-6]$/.test(el.tagName) ? Number(el.tagName[1]) : 0);
const headText = (h: Element): string =>
  [...h.childNodes].filter((n) => !(n instanceof Element && n.classList.contains('hash-link'))).map((n) => n.textContent ?? '').join('').trim();

/** The section's items, or null with the reason it stays as written. */
function items(body: Element[]): { items: Item[] | null; reason: string } {
  const blocks = body.filter((e) => (e.textContent ?? '').trim() !== '');
  if (blocks.length !== 1 || !/^(UL|OL)$/.test(blocks[0].tagName)) return { items: null, reason: blocks.length ? 'prose or more than one block' : 'empty' };
  const lis = [...blocks[0].querySelectorAll(':scope > li')];
  const out: Item[] = [];
  for (const li of lis) {
    const holder = li.firstElementChild?.tagName === 'P' ? li.firstElementChild : li;
    const first = [...holder.childNodes].find((n) => (n.textContent ?? '').trim() !== '');
    if (!(first instanceof HTMLAnchorElement)) return { items: null, reason: 'an item does not start with a link' };
    if (li.querySelector(':scope ul, :scope ol')) return { items: null, reason: 'nested list' };
    const after = (li.textContent ?? '').slice((li.textContent ?? '').indexOf(first.textContent ?? '') + (first.textContent ?? '').length).replace(DASH, '').trim();
    const external = first.host !== location.host;
    out.push({ href: first.href, title: (first.textContent ?? '').trim(), text: after, source: after ? 'author' : external ? 'external' : 'none', external });
  }
  return { items: out, reason: '' };
}

/** Fills in each internal item without author text from the target page's meta description. */
async function describe(list: Item[]): Promise<void> {
  await Promise.all(list.filter((i) => i.source === 'none').map(async (i) => {
    try {
      const html = await (await fetch(i.href)).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const d = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
      if (d) { i.text = d; i.source = 'page'; }
    } catch { /* leave it without text */ }
  }));
  list.filter((i) => i.external && !i.text).forEach((i) => { i.text = new URL(i.href).host; });
}

function find(): void {
  const md = document.querySelector('article .theme-doc-markdown');
  if (!md) return;
  for (const h of [...md.querySelectorAll('h2, h3')]) {
    if (!TITLE.test(headText(h))) continue;
    const body: Element[] = [];
    for (let n = h.nextElementSibling; n && !(depth(n) && depth(n) <= depth(h)); n = n.nextElementSibling) body.push(n);
    const r = items(body);
    found.push({ title: headText(h), level: depth(h), items: r.items, reason: r.reason, box: null, heading: h, body });
  }
}

const el = (tag: string, cls: string, text = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };

function card(i: Item, cls: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = cls + (i.external ? ` ${cls}--external` : '');
  a.href = i.href;
  if (i.external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  a.append(el('strong', `${cls}__title`, i.title));
  if (i.text) a.append(el('span', `${cls}__text`, i.text));
  return a;
}

/** Replaces the section's body with the variant's layout; the heading (anchor, TOC entry) stays. */
function render(f: Found): void {
  const box = el('section', `cs cs--${variant}`);
  f.heading.before(box);
  box.append(f.heading);
  if (variant === 'D') { box.append(...f.body); return; }
  if (!f.items) { box.classList.add('cs--as-written'); box.append(...f.body); return; }
  const list = f.items;
  f.body.forEach((e) => e.remove());
  if (variant === 'A') { const grid = el('div', 'cs-cards'); list.forEach((i) => grid.append(card(i, 'cs-card'))); box.append(grid); }
  if (variant === 'B') { const rows = el('div', 'cs-rows'); list.forEach((i) => rows.append(card(i, 'cs-row'))); box.append(rows); }
  if (variant === 'C') {
    box.append(card(list[0], 'cs-lead'));
    if (list.length > 1) {
      const more = el('ul', 'cs-more');
      list.slice(1).forEach((i) => { const li = document.createElement('li'); const a = card({ ...i, text: '' }, 'cs-more__link'); li.append(a); more.append(li); });
      box.append(more);
    }
  }
}

function renderBar(): void {
  const bar = el('div', 'cs-bar');
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  const here = SAMPLES.findIndex(([p]) => p === location.pathname);
  bar.innerHTML = `
    <div class="cs-bar__row">
      <button type="button" data-go="-1" aria-label="Previous variant">←</button>
      <strong></strong><span class="cs-bar__name"></span>
      <button type="button" data-go="1" aria-label="Next variant">→</button>
      <select aria-label="Sample page"><option value="">Sample pages…</option></select>
    </div>
    <pre class="cs-bar__state"></pre>`;
  bar.querySelector('strong')!.textContent = VARIANTS[idx][0];
  bar.querySelector('.cs-bar__name')!.textContent = VARIANTS[idx][1];
  const select = bar.querySelector('select')!;
  SAMPLES.forEach(([p, label], j) => select.add(new Option(`${j + 1}. ${label}`, p, false, j === here)));
  select.addEventListener('change', () => { if (select.value) go(select.value, variant); });
  bar.querySelector('.cs-bar__state')!.textContent = found.length
    ? found.map((f, j) => `Section ${j + 1}: h${f.level} "${f.title}" · ${f.items ? `${f.items.length} link(s); text from ${['author', 'page', 'external', 'none'].map((s) => [s, f.items!.filter((i) => i.source === s).length] as const).filter(([, n]) => n).map(([s, n]) => `${s} ${n}`).join(', ')}${f.items.some((i) => i.text.length > 160) ? '; some text over 160 chars' : ''}` : `kept as written: ${f.reason}`}`).join('\n')
    : 'No closing section on this page.';
  bar.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => cycle(Number(b.dataset.go))));
  document.body.append(bar);
}

const go = (pathname: string, v: Variant): void => { location.href = `${pathname}?variant=${v}`; };
const cycle = (dir: number): void => {
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  go(location.pathname, VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length][0]);
};

// Docusaurus moves between pages client-side, which would bypass the injected script; force full loads instead.
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(a instanceof HTMLAnchorElement) || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.closest('.cs-bar')) return;
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

// Wait for React hydration to finish before moving nodes, or React redraws the article and drops the changes.
window.addEventListener('load', () => setTimeout(async () => {
  document.documentElement.dataset.cs = variant;
  find();
  await Promise.all(found.map((f) => (f.items ? describe(f.items) : Promise.resolve())));
  if (variant !== '0') found.forEach(render);
  renderBar();
  // ?focus scrolls to the first closing section (handy for judging and for screenshots).
  if (new URLSearchParams(location.search).has('focus')) found[0]?.heading.scrollIntoView({ block: 'start' });
}, 400));
