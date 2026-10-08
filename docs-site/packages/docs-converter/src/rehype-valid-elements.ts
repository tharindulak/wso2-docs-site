// CommonMark pages (`mdx.format: md`) pass raw HTML through rehype-raw, which turns text such as
// `<mail@address.tld>` into an element React cannot create. Such an element becomes its text again.
import type { Root, RootContent, Element, Text } from 'hast';

const VALID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export default function rehypeValidElements() {
  return (tree: Root): void => {
    const fix = (node: Root | RootContent): void => {
      if (!('children' in node)) return;
      const parent = node as { children: RootContent[] };
      parent.children = parent.children.flatMap((child): RootContent[] => {
        fix(child);
        if (child.type === 'element' && !VALID.test((child as Element).tagName)) {
          const text: Text = { type: 'text', value: `<${(child as Element).tagName}>` };
          return [text, ...((child as Element).children as RootContent[])];
        }
        return [child];
      });
    };
    fix(tree);
  };
}
