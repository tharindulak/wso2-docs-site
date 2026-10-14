// Components content sources use without importing them: a migrated tree (docs-is) keeps no @site/@theme imports,
// so it does not depend on this site's file layout. A page's own import of the same name still wins.
import React from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Applies from '@site/src/components/Applies';
import DeploymentValue from '@site/src/components/DeploymentValue';
import ApiReference from '@site/src/components/ApiReference';
import Redirect from '@site/src/components/Redirect';
// <Steps> and <Prerequisites> need no component: the site's remark-components renders them (and passes <LinkCards> its items).
import LinkCards from '@site/src/components/LinkCards';
import DeprecationNotice from '@site/src/components/DeprecationNotice';

// A deprecated page whose title is its own h1: the deprecation notice goes under it (DocItem/Content otherwise).
const H1 = (props) => <><MDXComponents.h1 {...props} /><DeprecationNotice at="h1" /></>;

export default { ...MDXComponents, h1: H1, Tabs, TabItem, Applies, DeploymentValue, ApiReference, Redirect, LinkCards };
