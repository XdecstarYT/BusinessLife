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
import type { GameState, WorldEventType } from './types';
import { clamp, clamp100 } from './types';
import type { RNG } from './rng';

const TRIGGER_CHANCE: Record<WorldEventType, number> = {
  pandemic: 0.018,
  trade_war: 0.016,
  tech_boom: 0.02,
  oil_crisis: 0.014,
  banking_collapse: 0.012,
  ai_disruption: 0.016,
  semiconductor_shortage: 0.015,
  food_crisis: 0.013,
  shipping_disruption: 0.016,
  currency_crash: 0.011,
};

/** Recent history dampens re-triggering the same shock too soon (a real
 * "we just went through this" fatigue) and, for banking collapses specifically,
 * models post-crisis regulation making a repeat somewhat less likely for years. */
function historyMultiplier(state: GameState, type: WorldEventType): number {
  const yearsSince = state.shockHistory[type];
  if (yearsSince === undefined) return 1;
  if (yearsSince < 3) return 0.15;
  if (yearsSince < 8) return 0.5 + (yearsSince - 3) * 0.1;
  return 1;
}

function tryTrigger(state: GameState, rng: RNG): string | null {
  if (rng.chance(TRIGGER_CHANCE.pandemic * historyMultiplier(state, 'pandemic'))) {
    const severity = rng.range(0.35, 1);
    state.worldEvent = { type: 'pandemic', yearsLeft: rng.int(2, 4), severity };
    return severity > 0.7
      ? '🦠 A severe global pandemic has emerged, disrupting travel and commerce worldwide'
      : '🦠 A new virus is spreading internationally; health authorities urge caution';
  }
  if (rng.chance(TRIGGER_CHANCE.trade_war * historyMultiplier(state, 'trade_war'))) {
    const severity = rng.range(0.3, 1);
    state.worldEvent = { type: 'trade_war', yearsLeft: rng.int(2, 4), severity };
    return severity > 0.7
      ? '⚔️ A full-blown global trade war erupts as major economies impose sweeping tariffs'
      : '📉 Rising tariffs signal an emerging trade war between major economies';
  }
  if (rng.chance(TRIGGER_CHANCE.tech_boom * historyMultiplier(state, 'tech_boom'))) {
    const severity = rng.range(0.3, 1);
    state.worldEvent = { type: 'tech_boom', yearsLeft: rng.int(1, 3), severity };
    return severity > 0.7
      ? '🚀 A historic tech boom is sending valuations to record highs worldwide'
      : '📈 A wave of tech optimism is lifting markets worldwide';
  }
  if (rng.chance(TRIGGER_CHANCE.oil_crisis * historyMultiplier(state, 'oil_crisis'))) {
    const severity = rng.range(0.3, 1);
    state.worldEvent = { type: 'oil_crisis', yearsLeft: rng.int(1, 3), severity };
    return severity > 0.7
      ? '🛢️ A global oil crisis sends energy prices soaring worldwide'
      : '⛽ Rising oil prices are squeezing consumers and industry worldwide';
  }
  if (rng.chance(TRIGGER_CHANCE.banking_collapse * historyMultiplier(state, 'banking_collapse'))) {
    const severity = rng.range(0.35, 1);
    state.worldEvent = { type: 'banking_collapse', yearsLeft: rng.int(1, 3), severity };
    return severity > 0.7
      ? '🏦 A major bank has collapsed, triggering a global credit crunch'
      : '🏦 A regional banking scare is rattling credit markets worldwide';
  }
  if (rng.chance(TRIGGER_CHANCE.ai_disruption * historyMultiplier(state, 'ai_disruption'))) {
    const severity = rng.range(0.3, 1);
    state.worldEvent = { type: 'ai_disruption', yearsLeft: rng.int(2, 4), severity };
    return severity > 0.7
      ? '🤖 A wave of AI automation is disrupting labor markets worldwide'
      : '🤖 New AI tools are reshaping white-collar work worldwide';
  }
  if (rng.chance(TRIGGER_CHANCE.semiconductor_shortage * historyMultiplier(state, 'semiconductor_shortage'))) {
    const severity = rng.range(0.3, 1);
    state.worldEvent = { type: 'semiconductor_shortage', yearsLeft: rng.int(1, 3), severity };
    return severity > 0.7
      ? '💾 A severe global chip shortage is stalling tech and auto production lines worldwide'
      : '💾 Semiconductor supplies are tightening, with waiting lists growing worldwide';
  }
  if (rng.chance(TRIGGER_CHANCE.food_crisis * historyMultiplier(state, 'food_crisis'))) {
    const severity = rng.range(0.35, 1);
    state.worldEvent = { type: 'food_crisis', yearsLeft: rng.int(1, 3), severity };
    return severity > 0.7
      ? '🌾 A severe global food crisis is driving up grain prices and unrest worldwide'
      : '🌾 Poor harvests and export bans are pushing food prices up worldwide';
  }
  if (rng.chance(TRIGGER_CHANCE.shipping_disruption * historyMultiplier(state, 'shipping_disruption'))) {
    const severity = rng.range(0.3, 1);
    state.worldEvent = { type: 'shipping_disruption', yearsLeft: rng.int(1, 2), severity };
    return severity > 0.7
      ? '🚢 Major shipping lanes are blocked, stranding cargo and stalling global trade'
      : '🚢 Port congestion and container shortages are slowing global shipping';
  }
  if (rng.chance(TRIGGER_CHANCE.currency_crash * historyMultiplier(state, 'currency_crash'))) {
    const severity = rng.range(0.35, 1);
    state.worldEvent = { type: 'currency_crash', yearsLeft: rng.int(1, 3), severity };
    return severity > 0.7
      ? '💱 A major currency has crashed, sending shockwaves through global markets'
      : '💱 Currency markets are volatile as investors flee riskier economies';
  }
  return null;
}

export function tickWorldEvents(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  for (const type of Object.keys(state.shockHistory) as WorldEventType[]) {
    if (state.worldEvent?.type !== type) state.shockHistory[type] = (state.shockHistory[type] ?? 0) + 1;
  }

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
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment - ev.severity * 4);
      country.migrationRate = clamp(country.migrationRate - ev.severity * 2, -50, 50);
    } else if (ev.type === 'trade_war') {
      e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 6);
      e.businessConfidence = clamp100(e.businessConfidence - ev.severity * 10);
      e.inflation = clamp(e.inflation + ev.severity * 0.01, -0.02, 0.4);
      e.unemployment = clamp(e.unemployment + ev.severity * 0.008, 0, 0.5);
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment - ev.severity * 3);
      country.unrest = clamp100(country.unrest + ev.severity * 3);
    } else if (ev.type === 'tech_boom') {
      e.businessConfidence = clamp100(e.businessConfidence + ev.severity * 8);
      e.consumerConfidence = clamp100(e.consumerConfidence + ev.severity * 4);
      e.stockIndex = e.stockIndex * (1 + ev.severity * 0.05);
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment + ev.severity * 2);
      country.migrationRate = clamp(country.migrationRate + ev.severity * 1.5, -50, 50);
    } else if (ev.type === 'oil_crisis') {
      e.commodities.oil = Math.min(400, e.commodities.oil * (1 + ev.severity * 0.4));
      e.inflation = clamp(e.inflation + ev.severity * 0.015, -0.02, 0.4);
      e.businessConfidence = clamp100(e.businessConfidence - ev.severity * 6);
      e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 8);
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment - ev.severity * 4);
      country.unrest = clamp100(country.unrest + ev.severity * 4);
    } else if (ev.type === 'banking_collapse') {
      e.businessConfidence = clamp100(e.businessConfidence - ev.severity * 14);
      e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 10);
      e.stockIndex = e.stockIndex * (1 - ev.severity * 0.12);
      e.interestRate = clamp(e.interestRate + ev.severity * 0.01, 0, 0.4);
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment - ev.severity * 6);
      country.unrest = clamp100(country.unrest + ev.severity * 5);
      for (const city of country.cities) city.crime = clamp100(city.crime + ev.severity * 2);
    } else if (ev.type === 'ai_disruption') {
      e.unemployment = clamp(e.unemployment + ev.severity * 0.01, 0, 0.5);
      e.businessConfidence = clamp100(e.businessConfidence + ev.severity * 5);
      e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 5);
      country.unrest = clamp100(country.unrest + ev.severity * 3);
    } else if (ev.type === 'semiconductor_shortage') {
      e.businessConfidence = clamp100(e.businessConfidence - ev.severity * 7);
      e.inflation = clamp(e.inflation + ev.severity * 0.006, -0.02, 0.4);
      e.unemployment = clamp(e.unemployment + ev.severity * 0.005, 0, 0.5);
      country.unrest = clamp100(country.unrest + ev.severity * 2);
    } else if (ev.type === 'food_crisis') {
      e.commodities.grain = Math.min(400, (e.commodities.grain ?? 100) * (1 + ev.severity * 0.5));
      e.inflation = clamp(e.inflation + ev.severity * 0.018, -0.02, 0.4);
      e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 10);
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment - ev.severity * 5);
      country.unrest = clamp100(country.unrest + ev.severity * 6);
      for (const city of country.cities) city.crime = clamp100(city.crime + ev.severity * 2.5);
    } else if (ev.type === 'shipping_disruption') {
      e.inflation = clamp(e.inflation + ev.severity * 0.012, -0.02, 0.4);
      e.businessConfidence = clamp100(e.businessConfidence - ev.severity * 8);
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment - ev.severity * 2);
      country.unrest = clamp100(country.unrest + ev.severity * 2);
    } else if (ev.type === 'currency_crash') {
      e.exchangeRate = Math.max(0.15, e.exchangeRate * (1 - ev.severity * 0.35));
      e.inflation = clamp(e.inflation + ev.severity * 0.02, -0.02, 0.4);
      e.interestRate = clamp(e.interestRate + ev.severity * 0.015, 0, 0.4);
      e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 12);
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment - ev.severity * 6);
      country.unrest = clamp100(country.unrest + ev.severity * 4);
    }
  }

  ev.yearsLeft--;
  if (ev.yearsLeft <= 0) {
    if (ev.type === 'pandemic') headlines.push('✅ The pandemic has subsided; economies begin to reopen in earnest');
    else if (ev.type === 'trade_war') headlines.push('🤝 A trade deal has ended the standoff; tariffs are being rolled back');
    else if (ev.type === 'tech_boom') headlines.push('📉 The tech boom cools as valuations reset closer to earth');
    else if (ev.type === 'oil_crisis') headlines.push('🛢️ The oil crisis eases as production ramps back up');
    else if (ev.type === 'banking_collapse') headlines.push('🏦 Emergency measures have stabilized the banking system');
    else if (ev.type === 'ai_disruption') headlines.push('🤖 Labor markets adjust as the AI disruption wave settles');
    else if (ev.type === 'semiconductor_shortage') headlines.push('💾 Chip supply chains have caught up; production lines are running again');
    else if (ev.type === 'food_crisis') headlines.push('🌾 Harvests have recovered and food prices are easing worldwide');
    else if (ev.type === 'shipping_disruption') headlines.push('🚢 Shipping lanes have cleared and global trade is flowing again');
    else headlines.push('💱 Currency markets have stabilized after the crash');
    state.shockHistory[ev.type] = 0;
    state.worldEvent = null;
  }
  return headlines;
}
