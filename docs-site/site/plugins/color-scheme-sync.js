// Mirror Docusaurus's html[data-theme] onto MUI's html[data-color-scheme] before first paint,
// so MUI islands render in the right colour scheme without a flash.
export default function colorSchemeSync() {
  return {
    name: 'color-scheme-sync',
    injectHtmlTags() {
      return {
        preBodyTags: [{
          tagName: 'script',
          innerHTML: "(function(){var h=document.documentElement;function s(){h.setAttribute('data-color-scheme',h.getAttribute('data-theme')==='dark'?'dark':'light')}s();new MutationObserver(s).observe(h,{attributes:true,attributeFilter:['data-theme']})})();",
        }],
      };
    },
  };
}
