// PROTOTYPE: decided deployment label (variant A) + variant C's product strip above the content.
import React from 'react';
import Content from '@theme-original/DocItem/Content';
import { useDoc } from '@docusaurus/plugin-content-docs/client';
import { useLocation } from '@docusaurus/router';
import Link from '@docusaurus/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DeploymentLabel from '@site/src/components/DeploymentLabel';
import MuiIsland from '@site/src/components/MuiIsland';
import VersionSelect from '@site/src/components/VersionSelect';
import ProductsMenu from '@site/src/components/ProductsMenu';
import { locate } from '@site/src/components/catalogue';
import { useNavVariant } from '@site/src/components/nav';
function Strip() {
  const { product, section } = locate(useLocation().pathname);
  if (!product) return null;
  return (<MuiIsland><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
    <ProductsMenu mega={false} label="Products" /><Typography color="text.secondary">›</Typography>
    <Typography fontWeight={700} component={Link} to={product.sections[0].path} sx={{ color: 'inherit' }}>{product.name}</Typography>
    {product.sections.length > 1 && <><Typography color="text.secondary">›</Typography>
      {product.sections.map((s) => <Typography key={s.path} component={Link} to={s.path} sx={{ color: s === section ? 'text.primary' : 'text.secondary', fontWeight: s === section ? 700 : 400 }}>{s.label}</Typography>)}</>}
    <span style={{ flex: 1 }} /><VersionSelect pluginId={section.pluginId} older={product.older} variant="text" />
  </Stack></MuiIsland>);
}
export default function ContentWrapper(props) {
  const v = useNavVariant();
  return (<>{v === 'C' && <Strip />}<DeploymentLabel options={useDoc().frontMatter.deployment_options} /><Content {...props} /></>);
}
