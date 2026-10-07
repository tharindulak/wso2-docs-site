import React from 'react';
import Layout from '@theme-original/DocRoot/Layout';
import ProductBar from '@site/src/components/ProductBar.js';
export default function DocRootLayout(props) {
  return (<><ProductBar /><Layout {...props} /></>);
}
