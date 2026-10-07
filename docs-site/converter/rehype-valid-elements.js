// CommonMark pages (`mdx.format: md`) pass raw HTML through rehype-raw, which turns text such as
// `<mail@address.tld>` into an element React cannot create. Such an element becomes its text again.
const VALID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export default function rehypeValidElements() {
  return (tree) => {
    const fix = (node) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        fix(child);
        return child.type === 'element' && !VALID.test(child.tagName)
          ? [{ type: 'text', value: `<${child.tagName}>` }, ...child.children]
          : [child];
      });
    };
    fix(tree);
  };
}
