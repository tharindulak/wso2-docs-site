import type { Root } from 'hast';
/** A tag name React can create as an element; text like `<host.com-home>` or `<a@b.c>` parses as a tag but is not one. */
export declare const isValidTagName: (name: string) => boolean;
export default function rehypeValidElements(): (tree: Root) => void;
