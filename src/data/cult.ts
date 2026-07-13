/**
 * Static catalog for the Cult/Movement Founder path. Dynamic per-life state lives on
 * Player.cult — mirrors the static-data-vs-dynamic-state split used by data/military.ts /
 * sim/military.ts.
 */
export const CULT_NAME_ADJECTIVES = ['Radiant', 'Eternal', 'Hidden', 'Ascendant', 'Sacred', 'Silent', 'Awakened', 'Boundless', 'True', 'Inner'];
export const CULT_NAME_NOUNS = ['Path', 'Circle', 'Order', 'Light', 'Truth', 'Dawn', 'Flame', 'Covenant', 'Sanctuary', 'Ascension'];

export const CULT_FOUNDING_COST = 5_000;
export const CULT_DONATION_RATE_PER_FOLLOWER = 180; // annual $ per follower at charisma 50
export const CULT_RECRUIT_BASE_COST = 2_000;

/** Cost to raise the compound from `level` to `level + 1` (levels run 0..5). */
export function compoundUpgradeCost(level: number): number {
  return Math.round(25_000 * Math.pow(2.1, level));
}
