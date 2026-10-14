// CommonMark pages (`mdx.format: md`) pass raw HTML through rehype-raw, which turns text such as
// `<mail@address.tld>` into an element React cannot create. Such an element becomes its text again. Docusaurus's own
// `mdxAdmonitionTitle` (an admonition title with markup, which its Admonition component takes out) stays.
import type { Root, RootContent, Element, Text } from 'hast';

/** A tag name React can create as an element; text like `<host.com-home>` or `<a@b.c>` parses as a tag but is not one. */
export const isValidTagName = (name: string): boolean => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);

export default function rehypeValidElements() {
  return (tree: Root): void => {
    const fix = (node: Root | RootContent): void => {
      if (!('children' in node)) return;
      const parent = node as { children: RootContent[] };
      parent.children = parent.children.flatMap((child): RootContent[] => {
        fix(child);
        if (child.type === 'element' && !isValidTagName((child as Element).tagName) && (child as Element).tagName !== 'mdxAdmonitionTitle') {
          const text: Text = { type: 'text', value: `<${(child as Element).tagName}>` };
          return [text, ...((child as Element).children as RootContent[])];
        }
        return [child];
      });
    };
    fix(tree);
  };
}
