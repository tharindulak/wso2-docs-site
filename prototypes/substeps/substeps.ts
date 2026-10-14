// PROTOTYPE, throwaway. Sub-step looks inside the built stepper, per ?variant=. A sub-step is a heading inside a
// .steps__step whose text starts "Step N.M" (":", "-", "–", "." or no separator). Its prefix moves into the same
// visually hidden span the steps use; the number is shown by CSS from data-substep, so the heading id is unchanged.
// Served to the browser with types stripped (serve.ts), so only erasable TypeScript syntax is allowed here.

type Variant = '0' | 'A' | 'B' | 'C' | 'D' | 'E';
const VARIANTS: [Variant, string][] = [
  ['0', 'Today ("Step 1.1:" as written)'],
  ['A', 'Filled badge before the title'],
  ['B', 'Outlined badge before the title'],
  ['C', 'Mini-stepper: small circles on a thin inner line'],
  ['D', 'Number in the primary colour, no box'],
  ['E', 'Mini-stepper, filled: smaller copies of the step circles on a thin inner line'],
];
const SAMPLES: [string, string][] = [
  ['/identity/references/tutorials/connect-with-ms-entra/', 'MS Entra: Step 1.1 to 1.6, then 5.1 to 5.3'],
  ['/identity/references/tutorials/connect-with-mattr/', 'MATTR: 13 sub-steps'],
  ['/identity/connectors/onfido/usage/', 'Onfido usage: 8 sub-steps'],
  ['/identity/connectors/onfido/set-up/', 'Onfido set-up: 6 sub-steps'],
  ['/identity/tutorials/secure-spring-boot-api/', 'Spring Boot API: 5 sub-steps'],
  ['/identity/get-started/try-your-own-app/react-native-cli-app-auth/', 'React Native: sub-steps and tabs'],
  ['/identity/guides/authorization/user-impersonation/via-business-application/', 'User impersonation: 4 sub-steps'],
  ['/identity/guides/authentication/enterprise-login/add-ad-fs-login/', 'AD FS: 2 sub-steps'],
];
const SUB = /^Step\s+(\d+\.\d+)\s*[:.\-–]?\s+/i;

const fromUrl = new URLSearchParams(location.search).get('variant');
const variant: Variant = VARIANTS.some(([k]) => k === fromUrl) ? (fromUrl as Variant) : 'A';
const found: string[] = [];

function mark(): void {
  for (const h of document.querySelectorAll('.steps__step h3, .steps__step h4, .steps__step h5')) {
    const first = h.firstChild;
    if (!first || first.nodeType !== Node.TEXT_NODE) continue;
    const m = SUB.exec(first.textContent ?? '');
    if (!m) continue;
    found.push(m[1]);
    if (variant === '0') continue;
    const span = document.createElement('span');
    span.className = 'steps__prefix';
    span.textContent = m[0];
    first.textContent = (first.textContent ?? '').slice(m[0].length);
    h.insertBefore(span, first);
    h.setAttribute('data-substep', m[1]);
    h.classList.add('ss', `ss--${variant}`);
  }
  // C: each sub-step and its content move into one indented block, so the thin line runs in a gutter beside the text.
  if (variant === 'C' || variant === 'E') document.querySelectorAll(`.ss--${variant}`).forEach((h) => {
    const box = document.createElement('div');
    box.className = 'ss-block';
    h.before(box);
    let n = h.nextElementSibling;
    box.append(h);
    while (n && !/^H[1-6]$/.test(n.tagName)) { const next = n.nextElementSibling; box.append(n); n = next; }
  });
}

function renderBar(): void {
  const bar = document.createElement('div');
  bar.className = 'ss-bar';
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  const here = SAMPLES.findIndex(([p]) => p === location.pathname);
  bar.innerHTML = `
    <div class="ss-bar__row">
      <button type="button" data-go="-1" aria-label="Previous variant">←</button>
      <strong></strong><span class="ss-bar__name"></span>
      <button type="button" data-go="1" aria-label="Next variant">→</button>
      <select aria-label="Sample page"><option value="">Sample pages…</option></select>
    </div>
    <pre class="ss-bar__state"></pre>`;
  bar.querySelector('strong')!.textContent = VARIANTS[idx][0];
  bar.querySelector('.ss-bar__name')!.textContent = VARIANTS[idx][1];
  const select = bar.querySelector('select')!;
  SAMPLES.forEach(([p, label], j) => select.add(new Option(`${j + 1}. ${label}`, p, false, j === here)));
  select.addEventListener('change', () => { if (select.value) location.href = `${select.value}?variant=${variant}`; });
  bar.querySelector('.ss-bar__state')!.textContent = found.length
    ? `${found.length} sub-step heading(s) inside the stepper: ${found.join(' ')}`
    : 'No sub-steps inside a stepper on this page.';
  bar.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => cycle(Number(b.dataset.go))));
  document.body.append(bar);
}

const cycle = (dir: number): void => {
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  location.href = `${location.pathname}?variant=${VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length][0]}`;
};

// Docusaurus moves between pages client-side, which would bypass the injected script; force full loads instead.
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(a instanceof HTMLAnchorElement) || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.closest('.ss-bar')) return;
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

// Wait for React hydration to finish before changing headings, or React redraws them.
window.addEventListener('load', () => setTimeout(() => {
  mark();
  renderBar();
  // ?focus scrolls to the first sub-step (handy for judging).
  if (new URLSearchParams(location.search).has('focus')) document.querySelector('.ss, .steps__step h3')?.scrollIntoView({ block: 'center' });
}, 400));
