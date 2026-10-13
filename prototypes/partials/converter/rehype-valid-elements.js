/** A tag name React can create as an element; text like `<host.com-home>` or `<a@b.c>` parses as a tag but is not one. */
export const isValidTagName = (name) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
export default function rehypeValidElements() {
    return (tree) => {
        const fix = (node) => {
            if (!('children' in node))
                return;
            const parent = node;
            parent.children = parent.children.flatMap((child) => {
                fix(child);
                if (child.type === 'element' && !isValidTagName(child.tagName)) {
                    const text = { type: 'text', value: `<${child.tagName}>` };
                    return [text, ...child.children];
                }
                return [child];
            });
        };
        fix(tree);
    };
}
//# sourceMappingURL=rehype-valid-elements.js.map