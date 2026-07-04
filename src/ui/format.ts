/** Formatting helpers shared across the UI. */

export function money(v: number, symbol = '$'): string {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e12) return `${sign}${symbol}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}${symbol}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${symbol}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}${symbol}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${symbol}${Math.round(a).toLocaleString()}`;
}

export function moneyFull(v: number, symbol = '$'): string {
  return `${v < 0 ? '-' : ''}${symbol}${Math.round(Math.abs(v)).toLocaleString()}`;
}

export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function signedPct(v: number, digits = 1): string {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;
}

export function num(v: number): string {
  return Math.round(v).toLocaleString();
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Map a 0..100 stat to a tailwind color class. */
export function statColor(v: number): string {
  if (v >= 75) return 'text-emerald-400';
  if (v >= 50) return 'text-brand-300';
  if (v >= 30) return 'text-amber-400';
  return 'text-rose-400';
}

export function statBarColor(v: number): string {
  if (v >= 75) return 'bg-emerald-500';
  if (v >= 50) return 'bg-brand-500';
  if (v >= 30) return 'bg-amber-500';
  return 'bg-rose-500';
}
