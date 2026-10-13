// PROTOTYPE, throwaway. Finds the prerequisites block in both source forms and reshapes it per ?variant=.
// Heading form: an h2/h3 titled "Prerequisites" or "Before you begin", plus everything up to the next heading at its
// level or above. Admonition form: a Docusaurus admonition (any type) titled the same way. Switching variant reloads
// the page, because variants move the block to different places.
// Served to the browser with types stripped (serve.ts), so only erasable TypeScript syntax is allowed here.

type Variant = '0' | 'A' | 'B' | 'C' | 'D';
interface Block { form: string; title: string; items: number; flags: string[]; first: boolean; stepperNext: boolean }

const VARIANTS: [Variant, string][] = [
  ['0', 'Today (as written)'],
  ['A', 'Panel: boxed, bullets, in place'],
  ['B', 'Collapsible: one line in place, opens on click'],
  ['C', 'Rail: a ✓ step before Step 1'],
  ['D', 'Header box: moved up beside Deployment options'],
];
const SAMPLES: [string, string][] = [
  ['/identity/guides/authentication/mfa/add-push-auth-login/', 'Heading, 5 items'],
  ['/identity/guides/authentication/mfa/add-duo-login/', 'Heading, 2 items'],
  ['/identity/connectors/onfido/set-up/', 'Heading, then a stepper'],
  ['/identity/connectors/onfido/try-it/', 'h3 heading, not first, stepper'],
  ['/identity/guides/authentication/configure-jwt-bearer-grant/', 'Admonition (note)'],
  ['/identity/apis/organization-apis/authentication/', 'Admonition, then a stepper'],
  ['/identity/apis/', 'Admonition (info), stepper'],
  ['/identity/deploy/get-started/install/', 'Long: 17 items, sub-headings, admonitions inside'],
  ['/identity/get-started/try-samples/ws-federation-webapp/', 'Sub-headings, numbered list, code'],
  ['/identity/get-started/try-your-own-app/react-native-cli-app-auth/', 'Tabs inside, stepper'],
  ['/identity/guides/account-configurations/login-security/sift-fraud-detection/', 'Heading with an admonition only'],
];
const TITLE = /^(prerequisites|before you begin)$/i;

const params = new URLSearchParams(location.search);
const fromUrl = params.get('variant');
const variant: Variant = VARIANTS.some(([k]) => k === fromUrl) ? (fromUrl as Variant) : 'A';
const blocks: Block[] = [];

const depth = (el: Element): number => (/^H[2-6]$/.test(el.tagName) ? Number(el.tagName[1]) : 0);
const headText = (h: Element): string =>
  [...h.childNodes].filter((n) => !(n instanceof Element && n.classList.contains('hash-link'))).map((n) => n.textContent ?? '').join('').trim();

function describe(body: Element[], form: string, title: string, anchor: Element): Block {
  const all = body.flatMap((e) => [e, ...e.querySelectorAll('*')]);
  const list = body.find((e) => e.tagName === 'UL' || e.tagName === 'OL');
  const flags = [
    all.some((e) => depth(e) > 0) && 'sub-headings',
    all.some((e) => e.getAttribute('role') === 'tablist') && 'tabs',
    all.some((e) => e.tagName === 'PRE') && 'code',
    all.some((e) => e.classList.contains('theme-admonition')) && 'admonition inside',
    body.some((e) => e.tagName === 'OL') && 'numbered list',
  ].filter((f): f is string => Boolean(f));
  const md = anchor.closest('.theme-doc-markdown');
  const firstHeading = md?.querySelector('h2, h3');
  return { form, title, items: list ? list.querySelectorAll(':scope > li').length : 0, flags,
    first: !firstHeading || firstHeading === anchor || anchor.compareDocumentPosition(firstHeading) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false,
    stepperNext: false };
}

/** Wraps a found block: the title element stays (its anchor and TOC entry still work), the body moves into .pq__body. */
function wrap(titleEl: Element, body: Element[], replace: Element, info: Block): HTMLElement {
  const box = document.createElement('section');
  box.className = 'pq';
  box.setAttribute('aria-label', info.title);
  box.dataset.items = String(info.items);
  replace.before(box);
  const head = document.createElement('div');
  head.className = 'pq__head';
  head.append(titleEl);
  const content = document.createElement('div');
  content.className = 'pq__body';
  content.append(...body);
  box.append(head, content);
  if (replace !== titleEl) replace.remove();
  info.stepperNext = box.nextElementSibling?.classList.contains('steps') ?? false;
  if (info.stepperNext) box.classList.add('pq--before-steps');
  return box;
}

/** Finds every block; reshapes them only when asked (variant 0 shows the page as written). */
function find(reshape: boolean): HTMLElement[] {
  const md = document.querySelector('article .theme-doc-markdown');
  if (!md) return [];
  const found: HTMLElement[] = [];
  for (const h of [...md.querySelectorAll('h2, h3')]) {
    if (!TITLE.test(headText(h)) || h.closest('.pq')) continue;
    const body: Element[] = [];
    for (let n = h.nextElementSibling; n && !(depth(n) && depth(n) <= depth(h)) && !n.classList.contains('steps'); n = n.nextElementSibling) body.push(n);
    const info = describe(body, `heading h${depth(h)}`, headText(h), h);
    blocks.push(info);
    info.stepperNext = body.length ? body[body.length - 1].nextElementSibling?.classList.contains('steps') ?? false : false;
    if (reshape) found.push(wrap(h, body, h, info));
  }
  for (const adm of [...md.querySelectorAll('.theme-admonition')]) {
    const heading = adm.querySelector(':scope > [class^="admonitionHeading"]');
    const content = adm.querySelector(':scope > [class^="admonitionContent"]');
    if (!heading || !content || !TITLE.test((heading.textContent ?? '').trim()) || adm.closest('.pq')) continue;
    const type = [...adm.classList].find((c) => c.startsWith('theme-admonition-') && c !== 'theme-admonition')?.replace('theme-admonition-', '') ?? '?';
    const title = document.createElement('p');
    title.className = 'pq__title';
    title.textContent = (heading.textContent ?? '').trim();
    const body = [...content.children];
    const info = describe(body, `admonition (${type})`, title.textContent, adm);
    blocks.push(info);
    info.stepperNext = adm.nextElementSibling?.classList.contains('steps') ?? false;
    if (reshape) found.push(wrap(title, body, adm, info));
  }
  return found;
}

/** B: the body folds away behind a one-line summary. */
function collapse(box: HTMLElement): void {
  const details = document.createElement('details');
  details.className = 'pq__details';
  const summary = document.createElement('summary');
  const items = Number(box.dataset.items);
  summary.append(box.querySelector('.pq__head')!);
  const count = document.createElement('span');
  count.className = 'pq__count';
  count.textContent = items ? `${items} thing${items === 1 ? '' : 's'} you need` : 'show';
  summary.append(count);
  details.append(summary, box.querySelector('.pq__body')!);
  box.append(details);
}

/** D: the block moves up under the Deployment options box. */
function hoist(box: HTMLElement): void {
  const deployment = document.querySelector('.deployment-box');
  const md = document.querySelector('article .theme-doc-markdown');
  if (deployment) deployment.after(box);
  else md?.prepend(box);
  box.classList.remove('pq--before-steps');
}

function renderBar(): void {
  const bar = document.createElement('div');
  bar.className = 'pq-bar';
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  const here = SAMPLES.findIndex(([p]) => p === location.pathname);
  bar.innerHTML = `
    <div class="pq-bar__row">
      <button type="button" data-go="-1" aria-label="Previous variant">←</button>
      <strong></strong><span class="pq-bar__name"></span>
      <button type="button" data-go="1" aria-label="Next variant">→</button>
      <select aria-label="Sample page"><option value="">Sample pages…</option></select>
    </div>
    <pre class="pq-bar__state"></pre>`;
  bar.querySelector('strong')!.textContent = VARIANTS[idx][0];
  bar.querySelector('.pq-bar__name')!.textContent = VARIANTS[idx][1];
  const select = bar.querySelector('select')!;
  SAMPLES.forEach(([p, label], j) => select.add(new Option(`${j + 1}. ${label}`, p, false, j === here)));
  select.addEventListener('change', () => { if (select.value) go(select.value, variant); });
  bar.querySelector('.pq-bar__state')!.textContent = blocks.length
    ? blocks.map((b, j) => `Block ${j + 1}: ${b.form} "${b.title}" · ${b.items} item(s)${b.flags.length ? ` · ${b.flags.join(', ')}` : ''} · ${b.first ? 'first section' : 'after other sections'}${b.stepperNext ? ' · stepper follows' : ''}`).join('\n')
    : 'No prerequisites block on this page.';
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
  if (!(a instanceof HTMLAnchorElement) || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.closest('.pq-bar')) return;
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
window.addEventListener('load', () => setTimeout(() => {
  document.documentElement.dataset.pq = variant;
  const boxes = find(variant !== '0');
  if (variant === 'B') boxes.forEach(collapse);
  if (variant === 'D') boxes.slice(0, 1).forEach(hoist);
  renderBar();
}, 400));
