// PROTOTYPE, throwaway. Stand-ins for the WSO2 content components (Steps, Prerequisites, LinkCards) plus pass-through
// Tabs/TabItem/Applies, written with React.createElement (no JSX build). They produce the docs site's class names
// (.steps, .steps__step, .steps__substep, .prerequisites*, .link-cards/.link-card*) so the site's CSS applies.
// Not the site's implementation: just enough to see the decided authoring forms render.
import React from 'react';

const h = React.createElement;
const HEADING = /^h[1-6]$/;
type El = React.ReactElement<any>;
const isEl = (c: unknown): c is El => React.isValidElement(c);
const isHeading = (c: unknown): c is El => isEl(c) && typeof c.type === 'string' && HEADING.test(c.type);
const kids = (children: React.ReactNode) => React.Children.toArray(children).filter((c) => !(typeof c === 'string' && !c.trim()));

/** Depth and number of the enclosing step, so a nested <Steps> numbers its headings 1.1, 1.2. */
const StepCtx = React.createContext<{ depth: number; parent: number }>({ depth: 0, parent: 0 });

/** Children split at headings of the first heading's level: each heading starts a step. */
function split(children: React.ReactNode) {
  const all = kids(children);
  const level = all.find(isHeading)?.type;
  const before: React.ReactNode[] = [];
  const steps: { heading: El; body: React.ReactNode[] }[] = [];
  for (const c of all) {
    if (isHeading(c) && c.type === level) steps.push({ heading: c, body: [] });
    else if (steps.length) steps[steps.length - 1].body.push(c);
    else before.push(c);
  }
  return { before, steps };
}

export function Steps({ start = 1, children }: { start?: number; children?: React.ReactNode }) {
  const ctx = React.useContext(StepCtx);
  const { before, steps } = split(children);
  if (ctx.depth === 0) {
    return h('div', { className: 'steps' }, ...before, ...steps.map(({ heading, body }, i) => {
      const n = Number(start) + i;
      const title = React.cloneElement(heading, {}, h('span', { className: 'steps__prefix' }, `Step ${n}: `), heading.props.children);
      return h(StepCtx.Provider, { key: i, value: { depth: 1, parent: n } },
        h('div', { className: 'steps__step', 'data-step': String(n) }, title, ...body));
    }));
  }
  return h('div', { className: 'steps steps--sub' }, ...before, ...steps.map(({ heading, body }, i) => {
    const n = `${ctx.parent}.${Number(start) + i}`;
    const title = React.cloneElement(heading, { className: 'steps__substep', 'data-substep': n },
      h('span', { className: 'steps__prefix' }, `Step ${n}: `), heading.props.children);
    return h(React.Fragment, { key: i }, title, ...body);
  }));
}

export function Prerequisites({ title, children }: { title?: string; children?: React.ReactNode }) {
  const all = kids(children);
  let head: React.ReactNode;
  let body = all;
  if (title) head = h('p', null, title);
  else if (isHeading(all[0])) { head = all[0]; body = all.slice(1); }
  return h('section', { className: 'prerequisites' },
    head && h('div', { className: 'prerequisites__head' }, head),
    h('div', { className: 'prerequisites__body' }, ...body));
}

/** Plain text of React children. */
const textOf = (n: any): string => (typeof n === 'string' || typeof n === 'number' ? String(n)
  : Array.isArray(n) ? n.map(textOf).join('') : n?.props ? textOf(n.props.children) : '');

/** LinkCards for one page: `describe(href)` gives a linked page's description when the writer wrote none. */
export function makeLinkCards(describe: (href: string) => string | undefined) {
  return function LinkCards({ children }: { children?: React.ReactNode }) {
    const list = kids(children).find((c) => isEl(c) && (c.type === 'ul' || c.type === 'ol')) as El | undefined;
    if (!list) return h('div', { className: 'link-cards--broken' }, children);
    const cards = kids(list.props.children).filter(isEl).map((li, k) => {
      let parts = kids(li.props.children);
      if (parts.length === 1 && isEl(parts[0]) && parts[0].type === 'p') parts = kids(parts[0].props.children);
      const i = parts.findIndex((p) => isEl(p) && p.props.href);
      if (i < 0) return null;
      const link = parts[i] as El;
      const href: string = link.props.href;
      let description = textOf(parts.slice(i + 1)).replace(/^\s*[-–—:]\s*/, '').trim();
      let derived = false;
      if (!description) { description = describe(href) ?? ''; derived = Boolean(description); }
      const external = /^https?:/.test(href);
      return h('a', { key: k, href, className: external ? 'link-card link-card--external' : 'link-card' },
        h('strong', { className: 'link-card__title' }, link.props.children),
        description && h('span', { className: 'link-card__text', title: derived ? 'From the linked page' : 'Written after the link' }, description));
    });
    return h('div', { className: 'link-cards' }, ...cards);
  };
}

export function Tabs({ children }: { children?: React.ReactNode }) {
  const items = kids(children).filter(isEl);
  return h('div', { className: 'tabs-container', 'data-tabs': '' },
    h('ul', { className: 'tabs', role: 'tablist' }, ...items.map((it, i) =>
      h('li', { key: i, role: 'tab', className: `tabs__item${i === 0 ? ' tabs__item--active' : ''}`, 'data-tab': i }, it.props.label ?? it.props.value))),
    ...items.map((it, i) => h('div', { key: i, className: 'tab-panel', 'data-panel': i, hidden: i !== 0 }, it)));
}

export function TabItem({ children }: { children?: React.ReactNode }) {
  return h(React.Fragment, null, children);
}

export function Applies({ to = '', children }: { to?: string; children?: React.ReactNode }) {
  const kind = /cloud/i.test(to) ? 'cloud' : /hybrid/i.test(to) ? 'hybrid' : 'self-hosted';
  return h('div', { className: `applies applies--${kind}` }, h('div', { className: 'applies__label' }, to), children);
}

/** What an unknown component renders as in the prototype, so the page still renders. */
export function Unknown({ name }: { name: string }) {
  return h('div', { className: 'unknown-component' }, `<${name}> is not a component (the site build would fail on this page)`);
}
