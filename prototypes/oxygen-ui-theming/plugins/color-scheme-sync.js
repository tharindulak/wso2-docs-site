// PROTOTYPE: mirror Docusaurus's html[data-theme] onto MUI's html[data-color-scheme] before first paint.
module.exports = () => ({
  name: 'color-scheme-sync',
  injectHtmlTags() {
    return { preBodyTags: [{ tagName: 'script', innerHTML:
      "(function(){var h=document.documentElement;function s(){h.setAttribute('data-color-scheme',h.getAttribute('data-theme')||'light')}s();new MutationObserver(s).observe(h,{attributes:true,attributeFilter:['data-theme']})})();" }] };
  },
});
