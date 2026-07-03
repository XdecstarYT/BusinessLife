/* ============================================================
   BusinessLife — UTILITIES
   ============================================================ */
window.U = (function () {
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  /* Gaussian-ish random via central limit */
  const gauss = (mean = 0, sd = 1) => {
    let s = 0;
    for (let i = 0; i < 6; i++) s += Math.random();
    return mean + ((s - 3) / 3) * sd * 1.6;
  };

  /* Money formatting: $1.2M / $840K / $412 */
  function money(v, currency = '$') {
    const neg = v < 0;
    const a = Math.abs(v);
    let out;
    if (a >= 1e12) out = (a / 1e12).toFixed(2) + 'T';
    else if (a >= 1e9) out = (a / 1e9).toFixed(2) + 'B';
    else if (a >= 1e6) out = (a / 1e6).toFixed(2) + 'M';
    else if (a >= 1e4) out = (a / 1e3).toFixed(0) + 'K';
    else out = a.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return (neg ? '-' : '') + currency + out;
  }
  function moneyFull(v, currency = '$') {
    const neg = v < 0;
    return (neg ? '-' : '') + currency + Math.abs(Math.round(v)).toLocaleString();
  }
  const pct = (v, dp = 0) => (v >= 0 ? '+' : '') + (v * 100).toFixed(dp) + '%';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  const uid = () => Math.random().toString(36).slice(2, 10);

  return { rand, randInt, pick, chance, clamp, gauss, money, moneyFull, pct, esc, el, uid };
})();
