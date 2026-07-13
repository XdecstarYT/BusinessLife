/**
 * Cult/Movement Founder: recruit followers, collect donations, extract funds as dirty money,
 * expand a compound, and manage law-enforcement suspicion — right up until a raid ends it.
 * Self-contained leaf module (like military.ts/drugs.ts), not routed through actions.ts. Static
 * catalog in data/cult.ts.
 */
import type { CultMovement, GameState } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { CULT_DONATION_RATE_PER_FOLLOWER, CULT_FOUNDING_COST, CULT_NAME_ADJECTIVES, CULT_NAME_NOUNS, CULT_RECRUIT_BASE_COST, compoundUpgradeCost } from '../data/cult';

export interface CultActionResult {
  ok: boolean;
  message: string;
}

function withRng(state: GameState): RNG {
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  return rng;
}
function commit(state: GameState, rng: RNG): void {
  state.rngState = rng.state;
}
function onCooldown(state: GameState, key: string): boolean {
  return state.player.actionCooldowns[key] === state.year;
}
function setCooldown(state: GameState, key: string): void {
  state.player.actionCooldowns[key] = state.year;
}
function requireAge(state: GameState, minAge: number, activity: string): CultActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
function isActive(c: CultMovement | null): c is CultMovement {
  return !!c && c.active;
}

export function suggestCultName(rng: RNG): string {
  return `The ${rng.pick(CULT_NAME_ADJECTIVES)} ${rng.pick(CULT_NAME_NOUNS)}`;
}

export function foundCult(state: GameState, name: string): CultActionResult {
  const ageGate = requireAge(state, 18, 'founding a movement');
  if (ageGate) return ageGate;
  const p = state.player;
  if (isActive(p.cult)) return { ok: false, message: 'You already lead a movement.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  if (CULT_FOUNDING_COST > p.money) return { ok: false, message: `Needs $${CULT_FOUNDING_COST.toLocaleString()}.` };
  p.money -= CULT_FOUNDING_COST;
  p.cult = {
    active: true, name: name.trim() || 'The Unnamed Path', founded: state.year, followers: 3,
    funds: 0, charisma: clamp100(20 + (p.charisma - 50) * 0.4), suspicion: 5, compoundLevel: 0,
    raidsSurvived: 0, disbanded: false, disbandedReason: null,
  };
  p.karma = clamp100(p.karma - 5);
  awardAchievement(state, 'cult_founder');
  log(state, `You founded "${p.cult.name}" — a small circle of true believers, for now.`, 'info');
  return { ok: true, message: `${p.cult.name} founded.` };
}

/** Preach/recruit — the primary follower-growth lever, scaling with existing charisma and size. */
export function recruitFollowers(state: GameState): CultActionResult {
  const c = state.player.cult;
  if (!isActive(c)) return { ok: false, message: 'You need to found a movement first.' };
  if (onCooldown(state, 'cult_recruit')) return { ok: false, message: 'Already recruited this year.' };
  const p = state.player;
  const cost = Math.round(CULT_RECRUIT_BASE_COST * (1 + c.followers * 0.02));
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  setCooldown(state, 'cult_recruit');
  p.money -= cost;
  const rng = withRng(state);
  const gain = Math.round(rng.range(3, 10) * (1 + c.charisma * 0.02) * (1 + Math.log2(Math.max(2, c.followers)) * 0.1));
  c.followers += gain;
  c.suspicion = clamp100(c.suspicion + rng.range(1, 4));
  if (c.followers >= 100) awardAchievement(state, 'cult_survivor');
  if (c.followers >= 1000) awardAchievement(state, 'thousand_followers');
  if (c.followers >= 10_000) awardAchievement(state, 'cult_empire');
  commit(state, rng);
  log(state, `Recruited ${gain} new followers — now ${c.followers.toLocaleString()} strong.`, 'info');
  return { ok: true, message: `+${gain} followers.` };
}

/** Sermons/rallies that build charisma and follower loyalty at the cost of visibility. */
export function indoctrinate(state: GameState): CultActionResult {
  const c = state.player.cult;
  if (!isActive(c)) return { ok: false, message: 'You need to found a movement first.' };
  if (onCooldown(state, 'cult_indoctrinate')) return { ok: false, message: 'Already held a gathering this year.' };
  setCooldown(state, 'cult_indoctrinate');
  const p = state.player;
  const rng = withRng(state);
  c.charisma = clamp100(c.charisma + rng.range(2, 6));
  c.suspicion = clamp100(c.suspicion + rng.range(0.5, 2));
  p.happiness = clamp100(p.happiness + 2);
  if (c.charisma >= 90) awardAchievement(state, 'messiah_complex');
  commit(state, rng);
  log(state, `Led a gathering — the faithful are more devoted than ever.`, 'info');
  return { ok: true, message: `Charisma up to ${Math.round(c.charisma)}.` };
}

/** Passive donation collection — an explicit pull so the player can time it, on top of the
 * smaller automatic trickle handled in the yearly tick. */
export function collectDonations(state: GameState): CultActionResult {
  const c = state.player.cult;
  if (!isActive(c)) return { ok: false, message: 'You need to found a movement first.' };
  if (onCooldown(state, 'cult_collect')) return { ok: false, message: 'Already passed the plate this year.' };
  setCooldown(state, 'cult_collect');
  const rng = withRng(state);
  const amount = Math.round(c.followers * CULT_DONATION_RATE_PER_FOLLOWER * (0.5 + c.charisma * 0.01) * rng.range(0.7, 1.3));
  c.funds += amount;
  commit(state, rng);
  log(state, `The collection plate brought in $${amount.toLocaleString()} in donations.`, 'money');
  return { ok: true, message: `Collected $${amount.toLocaleString()}.` };
}

/** Extract cult funds into personal money — this is embezzlement, so it comes out dirty and
 * raises suspicion, mirroring the drugOperation dirtyMoney pattern. */
export function extractFunds(state: GameState, amount: number): CultActionResult {
  const c = state.player.cult;
  if (!isActive(c)) return { ok: false, message: 'You need to found a movement first.' };
  if (amount <= 0 || amount > c.funds) return { ok: false, message: `You only have $${Math.round(c.funds).toLocaleString()} in cult funds.` };
  const p = state.player;
  c.funds -= amount;
  p.dirtyMoney += amount;
  c.suspicion = clamp100(c.suspicion + amount / 20_000);
  p.karma = clamp100(p.karma - 3);
  log(state, `Skimmed $${amount.toLocaleString()} from the collective funds for yourself.`, 'money');
  return { ok: true, message: `Extracted $${amount.toLocaleString()} (dirty money).` };
}

/** Expand the compound — more capacity and a real defense against raids, at real cost. */
export function expandCompound(state: GameState): CultActionResult {
  const c = state.player.cult;
  if (!isActive(c)) return { ok: false, message: 'You need to found a movement first.' };
  if (c.compoundLevel >= 5) return { ok: false, message: 'The compound is already maxed out.' };
  const cost = compoundUpgradeCost(c.compoundLevel);
  const p = state.player;
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  c.compoundLevel++;
  log(state, `Expanded the compound to level ${c.compoundLevel} for $${cost.toLocaleString()}.`, 'money');
  return { ok: true, message: `Compound now level ${c.compoundLevel}.` };
}

export function disbandCult(state: GameState): CultActionResult {
  const c = state.player.cult;
  if (!isActive(c)) return { ok: false, message: 'You do not lead a movement.' };
  c.active = false;
  c.disbanded = true;
  c.disbandedReason = 'voluntary';
  state.player.karma = clamp100(state.player.karma + 10);
  awardAchievement(state, 'gone_straight_cult');
  log(state, `You disbanded ${c.name} and walked away for good.`, 'good');
  return { ok: true, message: 'Movement disbanded.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — passive donations, suspicion drift, defections, raids
// ---------------------------------------------------------------------------

export function tickCult(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const c = state.player.cult;
  if (!isActive(c)) return headlines;
  const p = state.player;
  if (p.inJailYears > 0) return headlines;

  // Small automatic trickle of donations, independent of the player's explicit collect action.
  const passiveDonations = Math.round(c.followers * CULT_DONATION_RATE_PER_FOLLOWER * 0.15 * (0.5 + c.charisma * 0.01));
  c.funds += passiveDonations;

  // Suspicion cools on its own the compound shields it from scrutiny; otherwise it creeps up
  // naturally as the movement grows.
  const shield = c.compoundLevel * 3;
  c.suspicion = clamp100(c.suspicion + (c.followers > 50 ? 1.5 : 0.3) - shield * 0.3);

  // Defections: unhappy or under-charisma'd followers drift away every year.
  const defectionRate = clamp(0.02 + Math.max(0, 40 - c.charisma) * 0.001, 0.01, 0.15);
  const defections = Math.round(c.followers * defectionRate);
  c.followers = Math.max(0, c.followers - defections);

  // Raid risk climbs with suspicion, softened by compound level.
  const raidChance = clamp((c.suspicion - 40) * 0.006 * (1 - c.compoundLevel * 0.08), 0, 0.35);
  if (c.suspicion > 40 && rng.chance(raidChance)) {
    const severity = rng.range(0.3, 0.7);
    c.followers = Math.round(c.followers * (1 - severity));
    c.funds = Math.round(c.funds * (1 - severity));
    c.suspicion = clamp100(c.suspicion - 40);
    c.raidsSurvived++;
    const jailYears = rng.int(1, 3);
    p.criminalRecord++;
    p.inJailYears += jailYears;
    p.notoriety = clamp100(p.notoriety + 20);
    p.reputation = clamp100(p.reputation - 15);
    awardAchievement(state, 'cult_raided');
    if (c.followers < 5) {
      c.active = false;
      c.disbanded = true;
      c.disbandedReason = 'raided';
      headlines.push(`🚨 Authorities raided ${c.name} — the movement has collapsed`);
    } else {
      headlines.push(`🚨 Authorities raided ${c.name} — the leader was arrested`);
    }
  } else if (c.followers === 0 && !c.disbanded) {
    c.active = false;
    c.disbanded = true;
    c.disbandedReason = 'collapsed';
    headlines.push(`${c.name} quietly collapsed as its last followers drifted away`);
  }

  return headlines;
}
