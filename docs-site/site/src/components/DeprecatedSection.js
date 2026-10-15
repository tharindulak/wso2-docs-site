// The `deprecated` admonition type: a section deprecation notice (`!!! deprecated "Title"`, or a warning titled
// "Deprecated …"; remark-deprecated-sections). The warning's amber treatment, the Deprecated tag only when the
// writer's title does not already say deprecated, and a scope line: the options of an <Applies> block around it,
// else the page's.
import React, { useContext } from 'react';
import clsx from 'clsx';
import AdmonitionLayout from '@theme/Admonition/Layout';
import IconWarning from '@theme/Admonition/Icon/Warning';
import { AppliesContext } from './Applies.js';
import usePageOptions from './usePageOptions.js';
import useDocResolver from './useDocResolver.js';
import { needsDeprecatedTag, scopeText } from '../lib/deprecation.mjs';

/** The text of a title: a string, or the elements of a title with markup (code). */
const textOf = (node) => (typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(textOf).join('') : node?.props ? textOf(node.props.children) : '');

export default function DeprecatedSection({ title, className, children, ...props }) {
  const applies = useContext(AppliesContext);
  const page = usePageOptions();
  const sectionId = useDocResolver()?.sectionId;
  const shown = title ?? 'Deprecated';
  const scope = scopeText(applies ? [applies] : page, sectionId);
  return (
    <AdmonitionLayout {...props} icon={<IconWarning />} className={clsx('alert alert--warning admonition-deprecated', className)}
      title={<>{needsDeprecatedTag(textOf(shown)) && <span className="deprecation-tag deprecation-tag--small">Deprecated</span>}{shown}</>}>
      {children}
      {scope && <p className="deprecation-scope">{scope}</p>}
    </AdmonitionLayout>
  );
}
