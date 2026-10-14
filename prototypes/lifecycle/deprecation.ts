// PROTOTYPE, throwaway. Deprecation notice and Deprecations page variants, from /__lc/data.json (read from the source).
// Pages marked deprecated get a notice; the three deprecated sections (admonitions titled "Deprecated …") get the
// section version; ?view=deprecations turns the page into the Deprecations page for one version (?ver=, default Latest).
// No removal dates exist (none approved), so the notice never shows one.
// Served to the browser with types stripped (serve.ts), so only erasable TypeScript syntax is allowed here.

type Variant = '0' | 'A' | 'B' | 'C';
interface Marking { stage: string; since?: string; replacement?: { url: string; title: string } }
interface Entry { kind: 'page' | 'section'; url: string; built: boolean; version: string; title: string; options: Record<string, Marking>; section?: string }

const VARIANTS: [Variant, string][] = [
  ['0', 'Today (as written)'],
  ['A', 'Notice box under the title · Deprecations page as a table'],
  ['B', 'One line under the title · Deprecations page grouped (APIs, behaviour)'],
  ['C', 'Banner above the page · Deprecations page as a timeline (newest first)'],
];
const VERSIONS = ['Latest', '7.2.0', '7.1.0', '7.0.0'];
const LINE = 'Still works, but not recommended; it will be removed in a future release.';
const POLICY = '/identity/references/wso2-identity-server-feature-deprecation/';
const DEPRECATED_SUFFIX = /\s*\((deprecated|Deprecated)\)\s*$/;

const params = new URLSearchParams(location.search);
const fromUrl = params.get('variant');
const variant: Variant = VARIANTS.some(([k]) => k === fromUrl) ? (fromUrl as Variant) : 'A';
const view = params.get('view');
const version = VERSIONS.includes(params.get('ver') ?? '') ? params.get('ver')! : 'Latest';
const norm = (p: string): string => (p.endsWith('/') ? p : `${p}/`);
const el = (tag: string, cls: string, text = ''): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e; };
const link = (href: string, text: string, cls = ''): HTMLAnchorElement => { const a = document.createElement('a'); a.href = href; a.textContent = text; if (cls) a.className = cls; return a; };
const label = (o: string): string => (o === 'Self-hosted' ? 'Identity Server' : o);

/** "since 7.0.0", or per option when they differ: "on WSO2 Cloud since 2026-03; in Identity Server since 7.3.0". */
function sinceText(e: Entry): string {
  const m = Object.entries(e.options).filter(([, x]) => x.since);
  if (!m.length) return '';
  const all = new Set(m.map(([, x]) => x.since));
  return all.size === 1 ? `since ${m[0][1].since}` : m.map(([o, x]) => `${o === 'WSO2 Cloud' ? 'on' : 'in'} ${label(o)} since ${x.since}`).join('; ');
}
const replacements = (e: Entry): { url: string; title: string }[] =>
  [...new Map(Object.values(e.options).filter((x) => x.replacement).map((x) => [x.replacement!.url, x.replacement!])).values()];
const nameOf = (e: Entry): string => (e.url.includes('/organization-apis/') && !/organization/i.test(e.title) ? `${e.title} (organization)` : e.title);

function pageNotice(e: Entry): void {
  const h1 = document.querySelector('article h1');
  if (!h1) return;
  h1.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) n.textContent = (n.textContent ?? '').replace(DEPRECATED_SUFFIX, ''); });
  document.querySelectorAll('.breadcrumbs__item--active .breadcrumbs__link').forEach((b) => { b.textContent = (b.textContent ?? '').replace(DEPRECATED_SUFFIX, ''); });
  const since = sinceText(e);
  const reps = replacements(e);
  if (variant === 'A' || variant === 'C') {
    const box = el('div', variant === 'A' ? 'dp-notice' : 'dp-banner');
    const head = el('div', 'dp-notice__head');
    head.append(el('span', 'dp-tag', 'Deprecated'), el('span', 'dp-since', since));
    box.append(head, el('p', 'dp-line', LINE));
    if (reps.length) { const row = el('div', 'dp-actions'); reps.forEach((r) => row.append(link(r.url, `Use ${r.title} instead →`, 'dp-button'))); box.append(row); }
    box.append(link(POLICY, 'How deprecation works', 'dp-policy'));
    if (variant === 'A') h1.after(box);
    else document.querySelector('article')?.prepend(box);
  }
  if (variant === 'B') {
    const line = el('p', 'dp-inline');
    line.append(el('span', 'dp-tag', 'Deprecated'), ` ${since}`);
    reps.forEach((r) => line.append(' · ', link(r.url, `Use ${r.title} →`)));
    h1.after(line);
  }
}

function sectionNotices(entries: Entry[]): void {
  for (const e of entries.filter((x) => x.kind === 'section' && x.url === norm(location.pathname))) {
    const adm = [...document.querySelectorAll('.theme-admonition')].find((a) =>
      (a.querySelector('[class^="admonitionHeading"]')?.textContent ?? '').trim().replace(/`/g, '') === (e.section ?? '').replace(/`/g, ''));
    if (!adm) continue;
    adm.classList.add('dp-section', `dp-section--${variant}`);
    const heading = adm.querySelector('[class^="admonitionHeading"]');
    if (heading && (variant === 'A' || variant === 'C')) heading.prepend(el('span', 'dp-tag dp-tag--small', 'Deprecated'));
    if (heading && variant === 'B') heading.append(el('span', 'dp-tag dp-tag--small', 'Deprecated'));
    const scope = Object.keys(e.options);
    if (variant !== 'B') adm.append(el('p', 'dp-section__scope', `Applies to ${scope.map(label).join(' and ')}. No date recorded yet.`));
  }
}

/** The Deprecations page for one version, built from that version's marked pages and sections. */
function deprecationsPage(entries: Entry[]): void {
  const article = document.querySelector('article');
  const md = article?.querySelector('.theme-doc-markdown');
  if (!article || !md) return;
  document.title = `Deprecations | WSO2 Identity Platform`;
  const list = entries.filter((e) => e.version === version);
  md.innerHTML = '';
  md.append(el('h1', '', 'Deprecations'));
  const intro = el('p', '', `Features and APIs deprecated in ${version === 'Latest' ? 'the latest documentation (WSO2 Cloud and Identity Server 7.3.0)' : `Identity Server ${version}`}. They still work, but are not recommended and will be removed in a future release. `);
  intro.append(link(POLICY, 'How deprecation works'), '.');
  md.append(intro);
  const tabs = el('div', 'dp-versions');
  VERSIONS.forEach((v) => { const a = link(`?view=deprecations&ver=${v}&variant=${variant}`, v, v === version ? 'dp-versions__active' : ''); tabs.append(a); });
  md.append(tabs);
  const rows = list.map((e) => ({ e, name: nameOf(e), since: sinceText(e).replace(/^since /, ''), reps: replacements(e), scope: Object.keys(e.options).map(label).join(', '),
    sortKey: Object.values(e.options).map((x) => x.since ?? '').sort().pop() ?? '' }));
  const nameCell = (r: typeof rows[number]): HTMLElement => {
    const c = el('span', '');
    c.append(r.e.built || r.e.kind === 'section' ? link(r.e.url, r.name) : el('span', '', r.name));
    if (r.e.kind === 'section') c.append(el('span', 'dp-kind', 'behaviour'));
    return c;
  };
  const repCell = (r: typeof rows[number]): HTMLElement => { const c = el('span', ''); r.reps.forEach((x, i) => { if (i) c.append(', '); c.append(link(x.url, x.title)); }); if (!r.reps.length) c.textContent = '—'; return c; };
  if (variant === 'A' || variant === '0') {
    const table = document.createElement('table');
    table.className = 'dp-table';
    table.innerHTML = '<thead><tr><th>Deprecated</th><th>Deployment option</th><th>Since</th><th>Use instead</th><th>Removal</th></tr></thead>';
    const body = document.createElement('tbody');
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      [nameCell(r), el('span', '', r.scope), el('span', '', r.since || '—'), repCell(r), el('span', 'dp-muted', 'Not announced')].forEach((c) => { const td = document.createElement('td'); td.append(c); tr.append(td); });
      body.append(tr);
    });
    table.append(body);
    md.append(table);
  }
  if (variant === 'B') {
    for (const [heading, group] of [['APIs', rows.filter((r) => r.e.kind === 'page')], ['Behaviour and settings', rows.filter((r) => r.e.kind === 'section')]] as const) {
      if (!group.length) continue;
      md.append(el('h2', '', heading));
      const ul = el('ul', 'dp-list');
      group.forEach((r) => { const li = document.createElement('li'); li.append(nameCell(r), el('span', 'dp-muted', ` · ${r.scope}${r.since ? ` · since ${r.since}` : ''}`)); if (r.reps.length) li.append(el('span', 'dp-muted', ' · use '), repCell(r)); ul.append(li); });
      md.append(ul);
    }
  }
  if (variant === 'C') {
    const byKey = new Map<string, typeof rows>();
    rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey)).forEach((r) => { const k = r.sortKey || 'No date recorded'; byKey.set(k, [...(byKey.get(k) ?? []), r]); });
    const tl = el('div', 'dp-timeline');
    for (const [k, group] of byKey) {
      const item = el('div', 'dp-timeline__item');
      item.append(el('div', 'dp-timeline__when', k));
      const ul = el('ul', 'dp-list');
      group.forEach((r) => { const li = document.createElement('li'); li.append(nameCell(r), el('span', 'dp-muted', ` · ${r.scope}`)); if (r.reps.length) li.append(el('span', 'dp-muted', ' · use '), repCell(r)); ul.append(li); });
      item.append(ul);
      tl.append(item);
    }
    md.append(tl);
  }
  md.append(el('p', 'dp-muted', `${rows.length} entries, from the source's deprecation fields. Deprecations without a page (deprecations.yml) would be listed here too; none are recorded yet.`));
  // The shell page's own metadata does not apply: the list covers every deployment option.
  article.querySelectorAll('.theme-doc-toc-mobile, .theme-doc-footer, .deployment-box').forEach((n) => n.remove());
  document.querySelectorAll('.breadcrumbs__item--active .breadcrumbs__link').forEach((b) => { b.textContent = 'Deprecations'; });
  document.querySelector('.theme-doc-toc-desktop')?.remove();
}

function renderBar(entries: Entry[], here: Entry | undefined): void {
  const bar = el('div', 'dp-bar');
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  bar.innerHTML = `
    <div class="dp-bar__row">
      <button type="button" data-go="-1" aria-label="Previous variant">←</button>
      <strong></strong><span class="dp-bar__name"></span>
      <button type="button" data-go="1" aria-label="Next variant">→</button>
      <select aria-label="Pages"><option value="">Pages…</option></select>
    </div>
    <pre class="dp-bar__state"></pre>`;
  bar.querySelector('strong')!.textContent = VARIANTS[idx][0];
  bar.querySelector('.dp-bar__name')!.textContent = VARIANTS[idx][1];
  const select = bar.querySelector('select')!;
  select.add(new Option('Deprecations page (Latest)', '/identity/deprecations/', false, view === 'deprecations'));
  entries.filter((e) => e.version === 'Latest').forEach((e) => select.add(new Option(`${e.kind === 'section' ? 'Section: ' : ''}${nameOf(e)}`, e.url, false, !view && norm(location.pathname) === e.url)));
  select.addEventListener('change', () => { if (select.value) location.href = `${select.value}?variant=${variant}`; });
  bar.querySelector('.dp-bar__state')!.textContent = view === 'deprecations'
    ? `Deprecations page for ${version}: ${entries.filter((e) => e.version === version).length} entries from the source.`
    : here ? `${here.kind}: ${Object.entries(here.options).map(([o, m]) => `${o}${m.since ? ` since ${m.since}` : ''}${m.replacement ? ` → ${m.replacement.title}` : ''}`).join(' · ')}` : 'Not deprecated. Pick a page above.';
  bar.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => cycle(Number(b.dataset.go))));
  document.body.append(bar);
}

const cycle = (dir: number): void => {
  const idx = VARIANTS.findIndex(([k]) => k === variant);
  const u = new URL(location.href);
  u.searchParams.set('variant', VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length][0]);
  location.href = u.href;
};

// Docusaurus moves between pages client-side, which would bypass the injected script; force full loads instead.
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!(a instanceof HTMLAnchorElement) || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.closest('.dp-bar')) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || (u.pathname === location.pathname && u.hash && !u.search)) return;
  e.preventDefault();
  e.stopPropagation();
  if (!u.searchParams.has('variant')) u.searchParams.set('variant', variant);
  location.href = u.href;
}, true);

document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'ArrowLeft') cycle(-1);
  if (e.key === 'ArrowRight') cycle(1);
});

// Wait for React hydration to finish before changing the page, or React redraws it.
window.addEventListener('load', () => setTimeout(async () => {
  const entries: Entry[] = await (await fetch('/__lc/data.json')).json();
  const here = entries.find((e) => e.kind === 'page' && e.version === 'Latest' && e.url === norm(location.pathname));
  if (view === 'deprecations') deprecationsPage(entries);
  else if (variant !== '0') {
    if (here) pageNotice(here);
    sectionNotices(entries);
  }
  renderBar(entries, here);
}, 400));
