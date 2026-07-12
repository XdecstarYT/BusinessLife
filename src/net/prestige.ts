/**
 * Prestige Vault: a permanent, cross-playthrough currency and perk shop — genuinely distinct
 * from two existing one-life mechanics: the "Legacy Score bonus" (Menu.tsx, a flat starting-money
 * bonus derived from your single best completed save) and "royalty" (leaderboard.ts, a one-life
 * perk spent and gone). Prestige Points accumulate forever in localStorage across every life and
 * every save, earned once per completed life from that life's real accomplishments, and buy
 * PERMANENT perks that apply automatically to every future new game once owned — the perks stack
 * up over many playthroughs rather than being spent down to zero.
 */
import type { GameState } from '../sim/types';

const PRESTIGE_POINTS_KEY = 'bl_prestige_points';
const PRESTIGE_PERKS_KEY = 'bl_prestige_perks_owned';

export function getPrestigePoints(): number {
  const raw = localStorage.getItem(PRESTIGE_POINTS_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Banks points earned from a completed life. Called once, from the game-over screen. */
export function addPrestigePoints(amount: number): void {
  if (amount <= 0) return;
  localStorage.setItem(PRESTIGE_POINTS_KEY, String(getPrestigePoints() + Math.round(amount)));
}

/** Pure computation of how much Prestige a just-ended life earned: a baseline share of its
 * Legacy Score, plus flat bonuses for specific major one-time accomplishments actually present
 * in that life's achievement list. No side effects — the caller banks the result. */
export function computePrestigeEarned(state: GameState, legacyScore: number): number {
  let pts = Math.round(legacyScore / 4); // 0..25 baseline
  const bonusAchievements: Record<string, number> = {
    billionaire: 8,
    multi_billionaire: 15,
    centa_millionaire: 5,
    deca_millionaire: 3,
    mega_corp: 5,
    global_conglomerate: 8,
    industry_legend_legacy: 6,
    arch_nemesis: 3,
    supply_chain_master: 3,
    dynasty_founder: 6,
  };
  for (const [id, bonus] of Object.entries(bonusAchievements)) {
    if (state.achievements.includes(id)) pts += bonus;
  }
  if (state.achievements.some((a) => a.startsWith('office:'))) pts += 6;
  return Math.max(1, pts);
}

export interface PrestigePerk {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  cost: number;
  requires?: string; // another perk id that must already be owned
}

export const PRESTIGE_PERKS: PrestigePerk[] = [
  { id: 'sharp_mind', label: 'Sharp Mind', icon: '🧠', blurb: '+8 starting Smarts, every future life.', cost: 15 },
  { id: 'natural_charm', label: 'Natural Charm', icon: '😎', blurb: '+8 starting Charisma, every future life.', cost: 15 },
  { id: 'strong_constitution', label: 'Strong Constitution', icon: '💪', blurb: '+12 starting Health, every future life.', cost: 12 },
  { id: 'iron_will', label: 'Iron Will', icon: '🧘', blurb: '+10 starting Karma, every future life.', cost: 10 },
  { id: 'family_savings', label: 'Family Savings', icon: '💵', blurb: '+$25,000 starting money, every future life.', cost: 20 },
  { id: 'family_fortune', label: 'Family Fortune', icon: '💰', blurb: '+$150,000 more starting money (needs Family Savings).', cost: 70, requires: 'family_savings' },
  { id: 'old_money', label: 'Old Money', icon: '🎩', blurb: 'Your family name opens doors: +15 starting Reputation, +5 Popularity.', cost: 35 },
  { id: 'prodigy', label: 'Prodigy', icon: '✨', blurb: 'Three extra strong skill aptitudes at birth.', cost: 40 },
  { id: 'guardian_angel', label: 'Guardian Angel', icon: '👼', blurb: 'Survive one otherwise-fatal health scare per life.', cost: 120 },
];

export const PRESTIGE_PERK_BY_ID: Record<string, PrestigePerk> = Object.fromEntries(PRESTIGE_PERKS.map((p) => [p.id, p]));

export function getOwnedPrestigePerks(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PRESTIGE_PERKS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function buyPrestigePerk(perkId: string): { ok: boolean; message: string } {
  const perk = PRESTIGE_PERK_BY_ID[perkId];
  if (!perk) return { ok: false, message: 'No such perk.' };
  const owned = getOwnedPrestigePerks();
  if (owned.includes(perkId)) return { ok: false, message: 'Already owned.' };
  if (perk.requires && !owned.includes(perk.requires)) {
    return { ok: false, message: `Requires ${PRESTIGE_PERK_BY_ID[perk.requires]?.label ?? perk.requires} first.` };
  }
  const points = getPrestigePoints();
  if (points < perk.cost) return { ok: false, message: `Needs ${perk.cost} Prestige (you have ${points}).` };
  localStorage.setItem(PRESTIGE_POINTS_KEY, String(points - perk.cost));
  localStorage.setItem(PRESTIGE_PERKS_KEY, JSON.stringify([...owned, perkId]));
  return { ok: true, message: `${perk.label} purchased — active from your next new life.` };
}
