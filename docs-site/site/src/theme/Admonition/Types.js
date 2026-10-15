// Admonition types: the theme's, plus `deprecated` (section deprecation notices; registered as a keyword in each docs
// plugin's admonitions option, docusaurus.config.js).
import DefaultAdmonitionTypes from '@theme-original/Admonition/Types';
import DeprecatedSection from '@site/src/components/DeprecatedSection';

export default { ...DefaultAdmonitionTypes, deprecated: DeprecatedSection };
