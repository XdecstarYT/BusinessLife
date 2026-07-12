/**
 * World Domination — the endgame meta-layer. Once you're genuinely powerful (a billionaire, a
 * sitting head of state, or hugely influential) you can open a campaign to bring every foreign
 * nation under your sway. You project three kinds of power at a target each year — economic
 * (buys influence with money), political (spends political capital + influence), and soft power
 * (charisma/fame/reputation) — each strongest under your chosen doctrine. Influence climbs against
 * a nation's hostility; cross the control threshold and you can consolidate it. Control every
 * foreign nation and you win the world.
 *
 * Self-contained leaf module like legal.ts / aviation.ts. State lives on GameState.domination.
 */
import type { GameState, WorldDomination } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log, netWorth } from './engine';

export interface DominationActionResult {
  ok: boolean;
  message: string;
}

export const CONTROL_THRESHOLD = 80; // influence needed before a nation can be consolidated
export const BILLION = 1_000_000_000;

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

/** True if the player currently meets the (generous) bar to open a domination campaign. */
export function canLaunchDomination(state: GameState): boolean {
  const p = state.player;
  const home = state.countries.find((c) => c.isPlayerHome);
  const isHeadOfState = home?.leaderId === 'player';
  return netWorth(state) >= BILLION || isHeadOfState || p.influence >= 70;
}

export function launchDomination(state: GameState, doctrine: 'economic' | 'political' | 'soft'): DominationActionResult {
  if (state.domination?.active) return { ok: false, message: 'Your campaign is already underway.' };
  if (!canLaunchDomination(state)) {
    return { ok: false, message: 'The world will not follow just anyone. Become a billionaire, a head of state, or hugely influential first.' };
  }
  const targets = state.countries
    .filter((c) => !c.isPlayerHome)
    .map((c) => ({
      countryId: c.id,
      // Nations that already like you start with a head start; hostility seeds from stability + rivalry.
      influence: clamp(20 + (home(state)?.relations[c.id] ?? 0) * 0.15, 0, 45),
      hostility: clamp(30 + c.stability * 0.3 + c.militaryPower * 0.2, 10, 90),
      controlled: false,
    }));
  const dom: WorldDomination = { active: true, founded: state.year, doctrine, targets, won: false };
  state.domination = dom;
  log(state, `🌍 You opened a campaign for global dominance — doctrine: ${doctrine} power. ${targets.length} nations stand between you and the world.`, 'milestone');
  return { ok: true, message: 'World Domination campaign launched.' };
}

function home(state: GameState) {
  return state.countries.find((c) => c.isPlayerHome);
}

/** Project one kind of power at a target nation this year (one action per nation per year). */
export function projectPower(state: GameState, countryId: string, kind: 'economic' | 'political' | 'soft'): DominationActionResult {
  const dom = state.domination;
  if (!dom?.active) return { ok: false, message: 'No active campaign.' };
  const target = dom.targets.find((t) => t.countryId === countryId);
  if (!target) return { ok: false, message: 'Unknown nation.' };
  if (target.controlled) return { ok: false, message: 'That nation is already under your control.' };
  const cdKey = `domination_project_${countryId}`;
  if (onCooldown(state, cdKey)) return { ok: false, message: 'You have already worked this nation this year.' };

  const p = state.player;
  const country = state.countries.find((c) => c.id === countryId);
  if (!country) return { ok: false, message: 'Unknown nation.' };

  // Cost + base effect per kind. Doctrine match gives a real bonus.
  const doctrineBonus = dom.doctrine === kind ? 1.5 : 1.0;
  let cost = 0;
  let base = 0;
  if (kind === 'economic') {
    cost = Math.max(2_000_000, netWorth(state) * 0.01); // 1% of net worth, min $2M
    if (p.money < cost) return { ok: false, message: `Economic pressure on ${country.name} costs ${'$' + Math.round(cost).toLocaleString()}.` };
    p.money -= cost;
    base = 8;
  } else if (kind === 'political') {
    if (p.politicalCapital < 15) return { ok: false, message: 'You need at least 15 political capital to lean on a foreign government.' };
    p.politicalCapital -= 15;
    base = 8;
  } else {
    // soft power: charisma + reputation + fame, no hard cost but capped by your standing
    if (p.reputation < 20 && p.charisma < 40) return { ok: false, message: 'You lack the public standing to sway a nation through soft power yet.' };
    base = 5 + p.charisma * 0.06 + p.reputation * 0.04;
  }

  setCooldown(state, cdKey);
  const rng = withRng(state);
  // Effectiveness is dragged down by the nation's hostility; doctrine + a little rng shape it.
  const gain = clamp(base * doctrineBonus * (1 - target.hostility / 200) * rng.range(0.8, 1.2), 1, 30);
  target.influence = clamp100(target.influence + gain);
  target.hostility = clamp100(target.hostility - rng.range(1, 4)); // pressure wears down resistance

  // A hostile nation can push back on a heavy-handed move.
  if (kind !== 'soft' && rng.chance(target.hostility / 260)) {
    target.hostility = clamp100(target.hostility + rng.range(4, 10));
    p.notoriety = clamp100(p.notoriety + 2);
    commit(state, rng);
    log(state, `${country.name} publicly rebuffed your influence campaign — hostility hardened.`, 'bad');
    return { ok: true, message: `${country.name}: +${Math.round(gain)} influence, but they pushed back.` };
  }

  commit(state, rng);
  const readyNote = target.influence >= CONTROL_THRESHOLD ? ' — ripe to consolidate!' : '';
  log(state, `Your ${kind} campaign in ${country.name} raised your influence to ${Math.round(target.influence)}%${readyNote}`, 'good');
  return { ok: true, message: `${country.name}: influence now ${Math.round(target.influence)}%.` };
}

/** Formally bring a nation you dominate under control once influence is high enough. */
export function consolidateControl(state: GameState, countryId: string): DominationActionResult {
  const dom = state.domination;
  if (!dom?.active) return { ok: false, message: 'No active campaign.' };
  const target = dom.targets.find((t) => t.countryId === countryId);
  if (!target) return { ok: false, message: 'Unknown nation.' };
  if (target.controlled) return { ok: false, message: 'Already under your control.' };
  if (target.influence < CONTROL_THRESHOLD) {
    return { ok: false, message: `You need ${CONTROL_THRESHOLD}% influence to consolidate — you have ${Math.round(target.influence)}%.` };
  }
  target.controlled = true;
  const country = state.countries.find((c) => c.id === countryId);
  state.player.influence = clamp100(state.player.influence + 3);
  const controlledCount = dom.targets.filter((t) => t.controlled).length;
  if (controlledCount === 1) awardAchievement(state, 'first_conquest');
  if (controlledCount >= Math.ceil(dom.targets.length / 2)) awardAchievement(state, 'economic_hegemon');
  log(state, `🚩 ${country?.name ?? 'A nation'} now answers to you. ${controlledCount}/${dom.targets.length} nations under control.`, 'milestone');

  // Win check
  if (dom.targets.every((t) => t.controlled)) {
    dom.won = true;
    awardAchievement(state, 'world_dominator');
    log(state, `👑🌍 THE WORLD IS YOURS. Every nation on Earth bends to your will. You have achieved total global domination.`, 'milestone');
    return { ok: true, message: 'You have conquered the world.' };
  }
  return { ok: true, message: `${country?.name ?? 'Nation'} consolidated.` };
}

// ---------------------------------------------------------------------------
// Yearly tick — hostility regenerates; neglected controlled nations can slip.
// ---------------------------------------------------------------------------

export function tickDomination(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const dom = state.domination;
  if (!dom?.active || dom.won) return headlines;

  for (const t of dom.targets) {
    const country = state.countries.find((c) => c.id === t.countryId);
    if (!t.controlled) {
      // Uncontrolled nations slowly recover a little hostility if you leave them alone.
      t.hostility = clamp100(t.hostility + rng.range(0, 1.5));
      t.influence = clamp100(t.influence - rng.range(0, 1)); // influence decays without attention
    } else {
      // A controlled nation with lingering hostility can occasionally rebel and slip free.
      if (rng.chance(t.hostility / 900)) {
        t.controlled = false;
        t.influence = clamp100(t.influence - rng.range(10, 20));
        t.hostility = clamp100(t.hostility + rng.range(5, 12));
        headlines.push(`Unrest in ${country?.name ?? 'a client state'} threw off your control`);
      }
    }
  }
  return headlines;
}
