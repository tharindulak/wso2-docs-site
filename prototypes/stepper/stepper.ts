// PROTOTYPE, throwaway. Mimics the proposed remark plugin in the browser, then styles the result per ?variant=.
// Detection: a run is consecutive `Step N` headings at the same depth among the article's direct children; a step's
// body runs to the next heading at the same or a higher level; a number <= the previous one starts a new run;
// a lone Step heading is left alone; `Step N.M` headings are sub-steps and stay inside their parent step.
// Served to the browser with types stripped (serve.ts), so only erasable TypeScript syntax is allowed here.

type Variant = '0' | 'A' | 'B' | 'C';
interface Step { n: number; els: Element[] }
interface Run { depth: number; nums: number[]; lone: boolean; skip: boolean; sub: number }

const VARIANTS: [Variant, string][] = [
  ['0', 'Today (no stepper)'],
  ['A', 'Rail: circles and a line'],
  ['B', 'Cards: one box per step'],
  ['C', 'Progress strip + plain headings'],
];
const SAMPLES: [string, string][] = [
  ['/identity/connectors/password-reset-enforcer/set-up/', 'IS, clean h2 run'],
  ['/identity/references/tutorials/connect-with-mattr/', 'IS, h2 steps with Step 1.1 sub-steps'],
  ['/api-platform/ai-gateway/setup-and-deployment/database-setup/', 'APIM, "Step N -"'],
  ['/api-platform/api-manager/api-design-manage/deploy-and-publish/deploy-on-gateway/deploy-api/deploy-through-multiple-api-gateways/', 'APIM, mixed separators and sub-steps'],
  ['/api-platform/api-manager/install-and-setup/setup/kubernetes-deployment/kubernetes/am-pattern-1-all-in-one-ha/', 'APIM, "Step N Title" (no separator), h3'],
  ['/api-platform/ai-workspace/production/deploy/', 'API Platform, 13 steps'],
  ['/integration/integrator/deploy/self-hosted/containerized-deployment/', 'Integrator (Docusaurus source), h3, 5 runs'],
  ['/integration/bi/developer-guides/ai-for-integration/build-an-http-service-with-wso2-copilot/', 'BI, clean h2 run'],
  ['/agent-manager/guides/configure-agent-llm-configuration/', 'Agent Manager, h3 restart'],
  ['/agent-manager/guides/on-k3d/', 'Agent Manager, Step 0, mixed depth'],
  ['/agent-manager/tutorials/govern-the-model/', 'Agent Manager, skipped number (1,2,3,5)'],
];
const STEP = /^Step\s+(\d+)(?!\.\d)\s*[:.\-–]?\s+/i;
const SUB_STEP = /^Step\s+\d+\.\d+/i;

const isVariant = (v: string | null): v is Variant => VARIANTS.some(([k]) => k === v);
const fromUrl = new URLSearchParams(location.search).get('variant');
let variant: Variant = isVariant(fromUrl) ? fromUrl : 'A';
const runs: Run[] = [];
let bar: HTMLDivElement;

const depth = (el: Element): number => (/^H[2-6]$/.test(el.tagName) ? Number(el.tagName[1]) : 0);
const headText = (h: Element): string =>
  [...h.childNodes].filter((n) => !(n instanceof Element && n.classList.contains('hash-link'))).map((n) => n.textContent ?? '').join('').trim();
const stepNo = (el: Element): number | null => {
  if (!depth(el)) return null;
  const m = STEP.exec(headText(el));
  return m ? Number(m[1]) : null;
};

/** Moves "Step N: " into a visually hidden span: anchors, search and screen readers still get it. */
function hidePrefix(h: Element): void {
  const first = h.firstChild;
  if (!first || first.nodeType !== Node.TEXT_NODE) return; // heading starts with code or a link: leave it
  const m = STEP.exec(first.textContent ?? '');
  if (!m) return;
  const span = document.createElement('span');
  span.className = 'stp-prefix';
  span.textContent = m[0];
  first.textContent = (first.textContent ?? '').slice(m[0].length);
  h.insertBefore(span, first);
}

function wrap(md: Element): void {
  const kids = [...md.children];
  let i = 0;
  while (i < kids.length) {
    if (stepNo(kids[i]) === null) { i++; continue; }
    const d = depth(kids[i]);
    const steps: Step[] = [];
    let prev = -Infinity;
    while (i < kids.length && depth(kids[i]) === d && (stepNo(kids[i]) ?? -Infinity) > prev) {
      const start = i++;
      while (i < kids.length && !(depth(kids[i]) && depth(kids[i]) <= d)) i++;
      prev = stepNo(kids[start])!;
      steps.push({ n: prev, els: kids.slice(start, i) });
    }
    const nums = steps.map((s) => s.n);
    const run: Run = {
      depth: d, nums, lone: steps.length < 2,
      skip: nums.some((n, j) => j > 0 && n !== nums[j - 1] + 1),
      sub: steps.reduce((c, s) => c + s.els.filter((e) => depth(e) > 0 && SUB_STEP.test(headText(e))).length, 0),
    };
    runs.push(run);
    if (!run.lone) build(steps);
  }
}

function build(steps: Step[]): void {
  const run = document.createElement('div');
  run.className = 'stp-run';
  steps[0].els[0].before(run);
  const strip = document.createElement('nav');
  strip.className = 'stp-strip';
  strip.setAttribute('aria-label', 'Steps');
  run.append(strip);
  steps.forEach((s, j) => {
    const head = s.els[0];
    const box = document.createElement('section');
    box.className = 'stp-step';
    box.dataset.step = String(s.n);
    box.dataset.of = `Step ${s.n} of ${steps.length}`;
    head.setAttribute('data-step', String(s.n)); // variant C badge reads it from the heading
    hidePrefix(head);
    box.append(...s.els);
    run.append(box);
    const dot = document.createElement('a');
    dot.href = `#${head.id}`;
    dot.className = j === 0 ? 'stp-dot is-current' : 'stp-dot';
    const num = document.createElement('b');
    num.textContent = String(s.n);
    const title = document.createElement('span');
    title.textContent = headText(head).replace(STEP, '');
    dot.append(num, title);
    strip.append(dot);
  });
}

/** Variant C: the dot of the step being read is current; earlier dots are done. */
function trackProgress(): void {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const step = e.target.closest('.stp-step');
      const run = step?.closest('.stp-run');
      if (!step || !run) continue;
      const idx = [...run.querySelectorAll(':scope > .stp-step')].indexOf(step);
      run.querySelectorAll('.stp-dot').forEach((dot, j) => {
        dot.classList.toggle('is-done', j < idx);
        dot.classList.toggle('is-current', j === idx);
      });
    }
  }, { rootMargin: '-20% 0px -70% 0px' });
  document.querySelectorAll('.stp-step > :first-child').forEach((h) => io.observe(h));
}

function setVariant(v: Variant): void {
  variant = v;
  document.documentElement.dataset.stp = v;
  const u = new URL(location.href);
  u.searchParams.set('variant', v);
  history.replaceState(history.state, '', u);
  renderBar();
}

const cycle = (dir: number): void => {
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  setVariant(VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length][0]);
};

const describe = (r: Run, j: number): string =>
  `Run ${j + 1}: h${r.depth} · ${r.nums.join(' ')}` +
  (r.lone ? ' · lone, not wrapped' : '') + (r.skip ? ' · skipped number' : '') + (r.sub ? ` · ${r.sub} sub-step heading(s) inside` : '');

function renderBar(): void {
  const [key, name] = VARIANTS.find(([k]) => k === variant)!;
  const here = SAMPLES.findIndex(([p]) => p === location.pathname);
  bar.innerHTML = `
    <div class="stp-bar__row">
      <button type="button" data-go="-1" aria-label="Previous variant">←</button>
      <strong></strong><span class="stp-bar__name"></span>
      <button type="button" data-go="1" aria-label="Next variant">→</button>
      <select aria-label="Sample page"><option value="">Sample pages…</option></select>
    </div>
    <pre class="stp-bar__state"></pre>`;
  bar.querySelector('strong')!.textContent = key;
  bar.querySelector('.stp-bar__name')!.textContent = name;
  const select = bar.querySelector('select')!;
  SAMPLES.forEach(([p, label], j) => select.add(new Option(`${j + 1}. ${label}`, p, false, j === here)));
  select.addEventListener('change', () => { if (select.value) location.href = `${select.value}?variant=${variant}`; });
  bar.querySelector('.stp-bar__state')!.textContent = runs.length
    ? runs.map(describe).join('\n')
    : "No Step runs among the article's top-level blocks (steps inside tabs or lists are not detected).";
  bar.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => cycle(Number(b.dataset.go))));
}

// Docusaurus moves between pages client-side, which would bypass the injected script; force full loads instead.
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(a instanceof HTMLAnchorElement) || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.closest('.stp-bar')) return;
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

// Wait for React hydration to finish before moving nodes, or React redraws the article and drops the wrappers.
window.addEventListener('load', () => setTimeout(() => {
  const md = document.querySelector('article .theme-doc-markdown');
  if (md) wrap(md);
  trackProgress();
  bar = document.createElement('div');
  bar.className = 'stp-bar';
  document.body.append(bar);
  setVariant(variant);
}, 400));
