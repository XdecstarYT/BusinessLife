/**
 * Global world events layered on top of the per-country economy sim. Only one
 * can be active at a time for now (a pandemic); business.ts reads
 * `state.worldEvent` directly to apply industry-tag effects (health up,
 * tourism/airlines down) alongside the confidence/unemployment shocks applied
 * here every year the event is active.
 */
import type { GameState } from './types';
import { clamp, clamp100 } from './types';
import type { RNG } from './rng';

const PANDEMIC_CHANCE_PER_YEAR = 0.018;

export function tickWorldEvents(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];

  if (!state.worldEvent) {
    if (rng.chance(PANDEMIC_CHANCE_PER_YEAR)) {
      const severity = rng.range(0.35, 1);
      state.worldEvent = { type: 'pandemic', yearsLeft: rng.int(2, 4), severity };
      headlines.push(
        severity > 0.7
          ? '🦠 A severe global pandemic has emerged, disrupting travel and commerce worldwide'
          : '🦠 A new virus is spreading internationally; health authorities urge caution',
      );
    }
    return headlines;
  }

  const ev = state.worldEvent;
  for (const country of state.countries) {
    const e = country.economy;
    e.consumerConfidence = clamp100(e.consumerConfidence - ev.severity * 16);
    e.businessConfidence = clamp100(e.businessConfidence - ev.severity * 8);
    e.unemployment = clamp(e.unemployment + ev.severity * 0.012, 0, 0.5);
    country.population = Math.round(country.population * (1 - ev.severity * 0.0012));
    country.healthcare = clamp100(country.healthcare - ev.severity * 1.5);
  }

  ev.yearsLeft--;
  if (ev.yearsLeft <= 0) {
    headlines.push('✅ The pandemic has subsided; economies begin to reopen in earnest');
    state.worldEvent = null;
  }
  return headlines;
}
