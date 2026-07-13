/**
 * Prison Life: cellblock politics while incarcerated — deepens the existing jail mechanic
 * (Bribe Judge / Attempt Escape / Request Parole in Life.tsx) rather than adding a new career
 * screen, since incarceration is a modal player state, not a standalone path to navigate to.
 * Self-contained leaf module (like military.ts/drugs.ts). State on Player.prisonLife resets to
 * null on release (handled in tickPrisonLife, called every year regardless of jail status).
 */
import type { GameState, PrisonLifeState } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';

export interface PrisonActionResult {
  ok: boolean;
  message: string;
}

export const PRISON_GANGS = ['The Yard Kings', 'Cellblock Brotherhood', 'The Quiet Ones', 'Iron Row'];

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
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
function ensurePrisonLife(state: GameState): PrisonLifeState | null {
  const p = state.player;
  if (p.inJailYears <= 0) return null;
  if (!p.prisonLife) {
    p.prisonLife = { gangId: null, respect: 0, contraband: 0, cellblockHeat: 0, timesInSolitary: 0, riotsParticipated: 0, snitched: false };
  }
  return p.prisonLife;
}

export function joinPrisonGang(state: GameState, gangId: string): PrisonActionResult {
  const pl = ensurePrisonLife(state);
  if (!pl) return { ok: false, message: 'You are not incarcerated.' };
  if (pl.gangId) return { ok: false, message: 'You already run with a crew.' };
  if (!PRISON_GANGS.includes(gangId)) return { ok: false, message: 'Unknown crew.' };
  pl.gangId = gangId;
  pl.respect = clamp100(pl.respect + 5);
  awardAchievement(state, 'prison_gang_member');
  log(state, `You fell in with ${gangId} for protection on the inside.`, 'info');
  return { ok: true, message: `Joined ${gangId}.` };
}

/** Pick a fight to build respect in the yard — real injury risk. */
export function earnRespect(state: GameState): PrisonActionResult {
  const pl = ensurePrisonLife(state);
  if (!pl) return { ok: false, message: 'You are not incarcerated.' };
  if (onCooldown(state, 'prison_earn_respect')) return { ok: false, message: 'Already made your move this year.' };
  setCooldown(state, 'prison_earn_respect');
  const p = state.player;
  const rng = withRng(state);
  const gangBonus = pl.gangId ? 0.15 : 0;
  if (rng.chance(0.55 + gangBonus)) {
    const gain = rng.range(5, 15);
    pl.respect = clamp100(pl.respect + gain);
    p.notoriety = clamp100(p.notoriety + 3);
    if (pl.respect >= 80) awardAchievement(state, 'yard_boss');
    commit(state, rng);
    log(state, `Won a yard confrontation — respect up to ${Math.round(pl.respect)}.`, 'info');
    return { ok: true, message: `Respect up to ${Math.round(pl.respect)}.` };
  }
  p.health = clamp100(p.health - rng.range(8, 20));
  pl.cellblockHeat = clamp100(pl.cellblockHeat + 15);
  commit(state, rng);
  log(state, `Took a beating in the yard — health took a hit.`, 'bad');
  return { ok: false, message: 'Lost the confrontation.' };
}

/** Smuggle goods in via visitors/guards — the base unit for the sell/trade loop. */
export function smuggleContraband(state: GameState): PrisonActionResult {
  const pl = ensurePrisonLife(state);
  if (!pl) return { ok: false, message: 'You are not incarcerated.' };
  if (onCooldown(state, 'prison_smuggle')) return { ok: false, message: 'Already smuggled something in this year.' };
  const p = state.player;
  const cost = 500;
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  setCooldown(state, 'prison_smuggle');
  p.money -= cost;
  const rng = withRng(state);
  if (rng.chance(clamp(0.15 + pl.cellblockHeat * 0.004, 0.1, 0.5))) {
    pl.cellblockHeat = clamp100(pl.cellblockHeat + 25);
    pl.timesInSolitary++;
    p.happiness = clamp100(p.happiness - 10);
    if (pl.timesInSolitary >= 3) awardAchievement(state, 'solitary_survivor');
    commit(state, rng);
    log(state, `🚨 Caught smuggling — thrown in solitary.`, 'bad');
    return { ok: false, message: 'Caught — solitary confinement.' };
  }
  const units = rng.int(2, 6);
  pl.contraband += units;
  commit(state, rng);
  log(state, `Smuggled in ${units} units of contraband.`, 'info');
  return { ok: true, message: `+${units} contraband.` };
}

/** Trade contraband to other inmates for real (dirty) money. */
export function sellContraband(state: GameState): PrisonActionResult {
  const pl = ensurePrisonLife(state);
  if (!pl) return { ok: false, message: 'You are not incarcerated.' };
  if (pl.contraband <= 0) return { ok: false, message: 'You have nothing to trade.' };
  if (onCooldown(state, 'prison_sell')) return { ok: false, message: 'Already traded this year.' };
  setCooldown(state, 'prison_sell');
  const p = state.player;
  const rng = withRng(state);
  const units = pl.contraband;
  const revenue = Math.round(units * rng.range(300, 700));
  pl.contraband = 0;
  p.dirtyMoney += revenue;
  pl.cellblockHeat = clamp100(pl.cellblockHeat + units * 2);
  if (pl.respect >= 60 && !state.achievements.includes('prison_kingpin') && revenue > 5_000) awardAchievement(state, 'prison_kingpin');
  commit(state, rng);
  log(state, `Traded contraband among inmates for $${revenue.toLocaleString()} (dirty).`, 'money');
  return { ok: true, message: `Earned $${revenue.toLocaleString()}.` };
}

/** Start a riot — big respect swing, big risk: extra sentence or injury. */
export function startRiot(state: GameState): PrisonActionResult {
  const pl = ensurePrisonLife(state);
  if (!pl) return { ok: false, message: 'You are not incarcerated.' };
  if (onCooldown(state, 'prison_riot')) return { ok: false, message: 'The block is still recovering from the last one.' };
  setCooldown(state, 'prison_riot');
  const p = state.player;
  const rng = withRng(state);
  pl.riotsParticipated++;
  awardAchievement(state, 'riot_starter');
  if (rng.chance(0.45)) {
    pl.respect = clamp100(pl.respect + rng.range(15, 30));
    p.notoriety = clamp100(p.notoriety + 15);
    commit(state, rng);
    log(state, `You started a riot that shook the whole block — your name carries weight now.`, 'bad');
    return { ok: true, message: 'Riot won you serious respect.' };
  }
  const extraYears = rng.int(1, 2);
  p.inJailYears += extraYears;
  p.health = clamp100(p.health - rng.range(10, 25));
  commit(state, rng);
  log(state, `🚨 The riot was put down hard — ${extraYears} year(s) added to your sentence.`, 'bad');
  return { ok: false, message: `Sentence extended by ${extraYears} year(s).` };
}

/** Snitch to guards for a reduced sentence — permanently marks you as a snitch. */
export function attemptSnitch(state: GameState): PrisonActionResult {
  const pl = ensurePrisonLife(state);
  if (!pl) return { ok: false, message: 'You are not incarcerated.' };
  if (pl.snitched) return { ok: false, message: 'You already used this card.' };
  const p = state.player;
  pl.snitched = true;
  pl.respect = clamp(pl.respect - 40, 0, 100);
  const reduction = Math.min(p.inJailYears, Math.max(1, Math.round(p.inJailYears * 0.4)));
  p.inJailYears -= reduction;
  awardAchievement(state, 'snitch');
  log(state, `You cut a deal with the guards — sentence reduced by ${reduction} year(s), but word gets around.`, 'bad');
  return { ok: true, message: `Sentence reduced by ${reduction} year(s).` };
}

/** Pay off a guard to cool cellblock heat — the prison-specific analogue of drugs.ts's bribeCop. */
export function bribeGuard(state: GameState): PrisonActionResult {
  const pl = ensurePrisonLife(state);
  if (!pl) return { ok: false, message: 'You are not incarcerated.' };
  if (onCooldown(state, 'prison_bribe_guard')) return { ok: false, message: 'Already paid someone off this year.' };
  const p = state.player;
  const cost = 3_000 + pl.cellblockHeat * 150;
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  setCooldown(state, 'prison_bribe_guard');
  p.money -= cost;
  pl.cellblockHeat = clamp100(pl.cellblockHeat - 30);
  log(state, `Paid off a guard to ease up on the cellblock heat.`, 'money');
  return { ok: true, message: 'Cellblock heat reduced.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — heat drift, ambient tension, and reset on release
// ---------------------------------------------------------------------------

export function tickPrisonLife(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const p = state.player;
  if (p.inJailYears <= 0) {
    if (p.prisonLife) p.prisonLife = null;
    return headlines;
  }
  const pl = ensurePrisonLife(state)!;
  pl.cellblockHeat = clamp100(pl.cellblockHeat - 5);
  if (pl.contraband > 0 && rng.chance(clamp(pl.cellblockHeat * 0.004, 0, 0.25))) {
    const lost = pl.contraband;
    pl.contraband = 0;
    pl.timesInSolitary++;
    if (pl.timesInSolitary >= 3) awardAchievement(state, 'solitary_survivor');
    headlines.push(`${p.name} had a stash of contraband seized in a surprise cell search`);
    void lost;
  }
  if (pl.respect >= 80 && pl.timesInSolitary === 0 && !state.achievements.includes('untouchable_inmate')) {
    awardAchievement(state, 'untouchable_inmate');
  }
  return headlines;
}
