// PROTOTYPE: dump WSO2Theme palette/typography so variant B can copy it into Infima CSS variables.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND' && !spec.endsWith('.js')) return next(spec + '.js', ctx); throw e; }
}
export async function load(url, ctx, next) {
  if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true };
  return next(url, ctx);
}`));
const o = await import('@wso2/oxygen-ui');
const t = o.WSO2Theme ?? o.Themes?.WSO2Theme;
if (!t) { console.log(Object.keys(o).filter(k => /theme/i.test(k))); process.exit(1); }
const pick = (s) => { const p = t.colorSchemes?.[s]?.palette ?? {}; return {
  primary: p.primary?.main, primaryDark: p.primary?.dark, primaryLight: p.primary?.light,
  secondary: p.secondary?.main, bg: p.background?.default, paper: p.background?.paper,
  text: p.text?.primary, textSecondary: p.text?.secondary, divider: p.divider,
  info: p.info?.main, success: p.success?.main, warning: p.warning?.main, error: p.error?.main }; };
console.log(JSON.stringify({ light: pick('light'), dark: pick('dark'),
  fontFamily: t.typography?.fontFamily, monoFamily: t.typography?.code?.fontFamily ?? null,
  radius: t.shape?.borderRadius }, null, 2));
