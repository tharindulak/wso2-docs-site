// Section deprecation notices: an admonition of the `deprecated` type (`!!! deprecated "Title"` in MkDocs; the site
// registers the keyword in each docs plugin's `admonitions.keywords`) and a warning titled "Deprecated …" (sources
// written before the type) both render as the `deprecated` admonition type, which the site draws as a deprecation
// (theme/Admonition/Types). Runs in the site build after Docusaurus's admonitions plugin, which leaves each admonition
// as a `containerDirective` with `data.hName` "admonition", its type in `hProperties.type`, and its title in
// `hProperties.title` when plain text, else in a leading `mdxAdmonitionTitle` child (mdx-loader lib/remark/admonitions).
import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';
import { isDeprecatedAdmonition } from './lifecycle.js';

const text = (node: RootContent | PhrasingContent): string =>
  'value' in node ? String(node.value) : 'children' in node ? (node.children as PhrasingContent[]).map(text).join('') : '';

function titleOf(node: Parent): string | undefined {
  const plain = (node.data as { hProperties?: { title?: unknown } } | undefined)?.hProperties?.title;
  if (typeof plain === 'string') return plain;
  const first = node.children[0] as RootContent | undefined;
  return first?.type === ('mdxAdmonitionTitle' as string) ? text(first) : undefined;
}

function visit(node: Root | RootContent): void {
  if (!('children' in node)) return;
  const props = (node.data as { hName?: string; hProperties?: { type?: unknown } } | undefined);
  if (node.type === 'containerDirective' && props?.hName === 'admonition' && props.hProperties) {
    const type = String(props.hProperties.type ?? '');
    if (isDeprecatedAdmonition(type, titleOf(node as Parent))) props.hProperties.type = 'deprecated';
  }
  for (const child of (node as Parent).children) visit(child as RootContent);
}

export default function remarkDeprecatedSections() {
  return (tree: Root): void => visit(tree);
}
