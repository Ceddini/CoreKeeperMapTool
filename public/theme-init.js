// Applies the saved theme before first paint (kept external so the CSP can stay 'self'-only).
try {
  var s = JSON.parse(localStorage.getItem('ckmt:settings') || '{}').data || {};
  document.documentElement.dataset.theme =
    s.theme && s.theme !== 'system' ? s.theme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
} catch (e) {
  document.documentElement.dataset.theme = 'dark';
}
