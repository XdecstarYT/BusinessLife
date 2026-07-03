/**
 * Global world events layered on top of the per-country economy sim. Only one
 * can be active at a time; business.ts reads `state.worldEvent` directly to
 * apply industry-tag effects (e.g. health up / tourism down in a pandemic,
 * exporters down in a trade war, tech up in a boom), alongside the
 * confidence/inflation/unemployment shocks applied here every active year.
 * Confidence and inflation fields blend from their previous value inside
 * tickEconomy, so a pre-tick nudge here fades naturally over a few years;
 * stockIndex is multiplicative on the current value, so a direct bump here
 * is also valid (see economy.ts for both mechanisms).
 */
import type { GameState, WorldEvent } from './types';
import { clamp, clamp100 } from './types';
import type { RNG } from './rng';

const TRIGGER_CHANCE: Record<WorldEvent['type'], number> = {
  pandemic: 0.018,
  trade_war: 0.016,
  tech_boom: 0.02,
};

function tryTrigger(state: GameState, rng: RNG): string | null {
  if (rng.chance(TRIGGER_CHANCE.pandemic)) {
    const severity = rng.range(0.35, 1);
    state.worldEvent = { type: 'pandemic', yearsLeft: rng.int(2, 4), severity };
    return severity > 0.7
      ? '🦠 A severe global pandemic has emerged, disrupting travel and commerce worldwide'
      : '🦠 A new virus is spreading internationally; health authorities urge caution';
  }
  if (rng.chance(TRIGGER_CHANCE.trade_war)) {
    const severity = rng.range(0.3, 1);
    state.worldEvent = { type: 'trade_war', yearsLeft: rng.int(2, 4), severity };
    return severity > 0.7
      ? '⚔️ A full-blown global trade war erupts as major economies impose sweeping tariffs'
      : '📉 Rising tariffs signal an emerging trade war between major economies';
  }
  if (rng.chance(TRIGGER_CHANCE.tech_boom)) {
    const severity = rng.range(0.3, 1);
    state.worldEvent = { type: 'tech_boom', yearsLeft: rng.int(1, 3), severity };
    return severity > 0.7
      ? '🚀 A historic tech boom is sending valuations to record highs worldwide'
      : '📈 A wave of tech optimism is lifting markets worldwide';
  }
  return null;
}

export function tickWorldEvents(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];

  if (!state.worldEvent) {
    const headline = tryTrigger(state, rng);
    if (headline) headlines.push(headline);
    return headlines;
  }

  const ev = state.worldEvent;
  for (const country of state.countries) {
    const e = country.economy;
    if (ev.type === 'pandemic') {
      e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 16);
      e.businessConfidence = clamp100(e.businessConfidence - ev.severity * 8);
      e.unemployment = clamp(e.unemployment + ev.severity * 0.012, 0, 0.5);
      country.population = Math.round(country.population * (1 - ev.severity * 0.0012));
      country.healthcare = clamp100(country.healthcare - ev.severity * 1.5);
    } else if (ev.type === 'trade_war') {
      e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 6);
      e.businessConfidence = clamp100(e.businessConfidence - ev.severity * 10);
      e.inflation = clamp(e.inflation + ev.severity * 0.01, -0.02, 0.4);
      e.unemployment = clamp(e.unemployment + ev.severity * 0.008, 0, 0.5);
    } else if (ev.type === 'tech_boom') {
      e.businessConfidence = clamp100(e.businessConfidence + ev.severity * 8);
      e.consumerConfidence = clamp100(e.consumerConfidence + ev.severity * 4);
      e.stockIndex = e.stockIndex * (1 + ev.severity * 0.05);
    }
  }

  ev.yearsLeft--;
  if (ev.yearsLeft <= 0) {
    if (ev.type === 'pandemic') headlines.push('✅ The pandemic has subsided; economies begin to reopen in earnest');
    else if (ev.type === 'trade_war') headlines.push('🤝 A trade deal has ended the standoff; tariffs are being rolled back');
    else headlines.push('📉 The tech boom cools as valuations reset closer to earth');
    state.worldEvent = null;
  }
  return headlines;
}
