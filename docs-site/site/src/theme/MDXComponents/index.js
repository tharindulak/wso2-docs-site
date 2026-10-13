// Components content sources use without importing them: a migrated tree (docs-is) keeps no @site/@theme imports,
// so it does not depend on this site's file layout. A page's own import of the same name still wins.
import MDXComponents from '@theme-original/MDXComponents';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Applies from '@site/src/components/Applies';
import DeploymentValue from '@site/src/components/DeploymentValue';
import ApiReference from '@site/src/components/ApiReference';
import Redirect from '@site/src/components/Redirect';

export default { ...MDXComponents, Tabs, TabItem, Applies, DeploymentValue, ApiReference, Redirect };
