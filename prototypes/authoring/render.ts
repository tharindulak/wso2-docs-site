// PROTOTYPE, throwaway. Renders an .mdx page with @mdx-js/mdx `evaluate` + react-dom/server into an HTML fragment,
// with the stand-in components from components.ts. Small remark steps imitate what Docusaurus does: front matter
// stripped, admonitions (:::note[Title], :::deprecated[Title]), heading ids (explicit {/* #id */} or slugged), images
// resolved against the page's place in the docs-is tree.
import fs from 'node:fs';
import path from 'node:path';
import * as runtime from 'react/jsx-runtime';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluate } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';
import GithubSlugger from 'github-slugger';
import YAML from 'yaml';
import { ALLOWED } from './check.ts';
import { Steps, Prerequisites, makeLinkCards, Tabs, TabItem, Applies, Unknown } from './components.ts';

const ALERT: Record<string, string> = { note: 'secondary', tip: 'success', info: 'info', important: 'info', warning: 'warning', caution: 'warning', danger: 'danger', deprecated: 'warning' };

/** Admonitions as Docusaurus-like alert boxes; other directives (stray `:word` in text) back to text. */
function admonitions() {
  return (tree: any) => {
    visit(tree, (node: any, index, parent: any) => {
      if (node.type === 'containerDirective' && ALERT[node.name]) {
        const first = node.children[0];
        const hasLabel = first?.data?.directiveLabel;
        const title = hasLabel ? first.children : [{ type: 'text', value: node.name.toUpperCase() }];
        if (hasLabel) node.children.shift();
        const tag = node.name === 'deprecated' && !/deprecat/i.test(toString({ type: 'root', children: title }))
          ? [{ type: 'emphasis', data: { hName: 'span', hProperties: { className: 'deprecation-tag deprecation-tag--small' } }, children: [{ type: 'text', value: 'Deprecated' }] }] : [];
        node.data = { hName: 'div', hProperties: { className: `admonition alert alert--${ALERT[node.name]}${node.name === 'deprecated' ? ' admonition-deprecated' : ''}` } };
        node.children = [
          { type: 'paragraph', data: { hName: 'div', hProperties: { className: 'admonition__heading' } }, children: [...tag, ...title] },
          { type: 'blockquote', data: { hName: 'div', hProperties: { className: 'admonition__content' } }, children: node.children },
        ];
      } else if ((node.type === 'textDirective' || node.type === 'leafDirective' || node.type === 'containerDirective') && parent) {
        parent.children.splice(index, 1, { type: 'text', value: `:${node.name}` });
      }
    });
  };
}

/** Heading ids: a trailing {/* #id *\/} comment is the explicit id; otherwise the GitHub slug, as Docusaurus does. */
function headingIds() {
  return (tree: any) => {
    const slugger = new GithubSlugger();
    visit(tree, 'heading', (node: any) => {
      let id: string | undefined;
      node.children = node.children.filter((c: any) => {
        const m = c.type === 'mdxTextExpression' && /^\s*\/\*\s*#(\S+)\s*\*\/\s*$/.exec(c.value);
        if (m) id = m[1];
        return !m;
      });
      const last = node.children[node.children.length - 1];
      if (last?.type === 'text') last.value = last.value.trimEnd();
      id ??= slugger.slug(toString(node));
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
    });
  };
}

/** Unknown capitalised components become <Unknown name="…">, so the page still renders. */
function unknownComponents() {
  return (tree: any) => visit(tree, (node: any) => {
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && /^[A-Z]/.test(node.name ?? '') && !ALLOWED.includes(node.name)) {
      node.attributes = [{ type: 'mdxJsxAttribute', name: 'name', value: node.name }];
      node.name = 'Unknown';
      node.children = [];
    }
  });
}

/** Description of a linked page: front matter `description`, else its first plain paragraph (Docusaurus' default). */
function describer(docDir: string) {
  return (href: string) => {
    if (/^[a-z]+:/i.test(href)) return undefined;
    const file = path.resolve(docDir, href.split('#')[0]);
    if (!fs.existsSync(file)) return undefined;
    const text = fs.readFileSync(file, 'utf8');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
    const desc = fm ? YAML.parse(fm[1])?.description : undefined;
    if (desc) return String(desc);
    const body = fm ? text.slice(fm[0].length) : text;
    const para = body.split(/\n\s*\n/).map((b) => b.trim()).find((b) => b && !/^(#|!|<|:::|\||-|\d+\.|```|import )/.test(b));
    return para?.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ');
  };
}

/**
 * Renders `source` to an HTML fragment. `docDir`: the page's directory in the docs-is tree (for links and images);
 * `assetUrl` maps a resolved file path to the URL the server serves it from.
 */
export async function render(source: string, docDir: string, assetUrl: (file: string) => string): Promise<string> {
  const img = (props: any) => {
    const src = /^[a-z]+:|^\//i.test(props.src ?? '') ? props.src : assetUrl(path.resolve(docDir, props.src));
    return React.createElement('img', { ...props, src, loading: 'lazy' });
  };
  const { default: Content } = await evaluate(source, {
    ...(runtime as any),
    remarkPlugins: [remarkFrontmatter, remarkGfm, remarkDirective, admonitions, headingIds, unknownComponents],
  });
  const components = { Steps, Prerequisites, LinkCards: makeLinkCards(describer(docDir)), Tabs, TabItem, Applies, Unknown, img,
    DeploymentValue: (p: any) => React.createElement('code', null, p.name ?? 'value') };
  return renderToStaticMarkup(React.createElement(Content as any, { components }));
}
