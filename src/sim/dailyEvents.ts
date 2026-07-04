/**
 * Matching and resolution for daily flavor events (see data/dailyEvents.ts).
 * Deliberately much simpler than the yearly event engine: no placeholders,
 * no player choice, no skill checks — just a small chance of a small,
 * auto-applied effect so day/week advancement feels alive.
 */
import type { DailyEventTemplate, GameState } from './types';
import { DAILY_EVENTS } from '../data/dailyEvents';
import { applyEffects } from './events';
import type { RNG } from './rng';

function matches(t: DailyEventTemplate, state: GameState): boolean {
  const c = t.conditions;
  if (!c) return true;
  const p = state.player;
  if (c.minAge !== undefined && p.age < c.minAge) return false;
  if (c.maxAge !== undefined && p.age > c.maxAge) return false;
  if (c.minMoney !== undefined && p.money < c.minMoney) return false;
  if (c.employed !== undefined && (p.job !== null) !== c.employed) return false;
  if (c.hasBusiness !== undefined) {
    const active = p.companies.some((id) => state.companies[id]?.status === 'active');
    if (active !== c.hasBusiness) return false;
  }
  if (c.hasSpouse !== undefined && (p.spouseId !== null) !== c.hasSpouse) return false;
  if (c.hasChildren !== undefined && (p.children.length > 0) !== c.hasChildren) return false;
  if (c.hasStocks !== undefined && (p.portfolio.length > 0) !== c.hasStocks) return false;
  return true;
}

/** Roll for a daily flavor event; returns its text if one fired (already applied), else null. */
export function tryFireDailyEvent(state: GameState, rng: RNG): string | null {
  if (state.player.inJailYears > 0 || !state.player.alive) return null;
  if (!rng.chance(0.08)) return null;
  const eligible = DAILY_EVENTS.filter((t) => matches(t, state));
  if (!eligible.length) return null;
  const t = rng.weighted(eligible, (x) => x.weight);
  applyEffects(state, t.effects, null);
  return t.text;
}
