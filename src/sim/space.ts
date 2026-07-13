/**
 * Space Program: join an agency, train, fly missions with real fatality risk, and climb the
 * astronaut ranks. Self-contained leaf module (like military.ts/drugs.ts), not routed through
 * actions.ts. Static catalog in data/space.ts. Mission-fatality risk reuses the
 * state.pendingDeathReason + p.alive = false pattern established by military.ts, so a fatal
 * mission ends the game immediately via the shared gameOverCheck() path.
 */
import type { AstronautCareer, GameState } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { SK } from '../data/skills';
import { ASTRONAUT_ACTIVE_SALARY_BASE, ASTRONAUT_CANDIDATE_SALARY, ASTRONAUT_RANK_TITLES, MISSIONS, SPACE_AGENCIES } from '../data/space';

export interface SpaceActionResult {
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
function requireAge(state: GameState, minAge: number, activity: string): SpaceActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
function isActive(c: AstronautCareer | null): c is AstronautCareer {
  return !!c && c.active;
}

export function joinSpaceAgency(state: GameState, agencyId: string): SpaceActionResult {
  const ageGate = requireAge(state, 21, 'joining a space program');
  if (ageGate) return ageGate;
  const p = state.player;
  if (isActive(p.astronaut)) return { ok: false, message: 'You are already an astronaut candidate.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  if (!SPACE_AGENCIES.includes(agencyId)) return { ok: false, message: 'Unknown agency.' };
  p.astronaut = {
    active: true, agencyId, rank: 0, trainingScore: 10, missionsFlown: 0, hoursInSpace: 0,
    walkedOnMoon: false, walkedOnMars: false, fatalityRisk: 0, activeMission: null,
  };
  awardAchievement(state, 'astronaut_candidate');
  log(state, `You were accepted as an astronaut candidate at ${agencyId}.`, 'milestone');
  return { ok: true, message: 'Accepted as astronaut candidate.' };
}

/** Simulator hours, centrifuge runs, EVA drills — the only lever before you're mission-qualified. */
export function trainForMission(state: GameState): SpaceActionResult {
  const c = state.player.astronaut;
  if (!isActive(c)) return { ok: false, message: 'You need to join a space agency first.' };
  if (c.activeMission) return { ok: false, message: 'You are currently on a mission.' };
  if (onCooldown(state, 'space_train')) return { ok: false, message: 'Already trained this year.' };
  setCooldown(state, 'space_train');
  const p = state.player;
  const rng = withRng(state);
  const gain = rng.range(3, 8) + (p.health - 50) * 0.03;
  c.trainingScore = clamp100(c.trainingScore + gain);
  p.skills[SK.aerospace] = clamp100((p.skills[SK.aerospace] ?? 0) + rng.range(1, 3));
  p.health = clamp100(p.health + 1);
  commit(state, rng);
  log(state, `Grueling training this year — training score up to ${Math.round(c.trainingScore)}.`, 'info');
  return { ok: true, message: `Training score now ${Math.round(c.trainingScore)}.` };
}

/** Fly the requested mission type — real fatality risk, mitigated by training and rank. */
export function launchMission(state: GameState, kind: 'orbital' | 'station' | 'moon' | 'mars'): SpaceActionResult {
  const c = state.player.astronaut;
  if (!isActive(c)) return { ok: false, message: 'You need to join a space agency first.' };
  if (c.activeMission) return { ok: false, message: 'You are already on a mission.' };
  const def = MISSIONS.find((m) => m.kind === kind);
  if (!def) return { ok: false, message: 'Unknown mission type.' };
  if (c.rank < def.minRank) return { ok: false, message: `You need to be a ${ASTRONAUT_RANK_TITLES[def.minRank]} or higher to fly this.` };
  if (c.trainingScore < def.minTrainingScore) return { ok: false, message: `You need a training score of at least ${def.minTrainingScore}.` };
  c.activeMission = { id: `sm_${state.year}`, name: def.name, kind, startYear: state.year, durationYears: def.durationYears, danger: clamp(def.baseDanger * (1 - c.trainingScore / 200), 0.005, 0.5) };
  c.fatalityRisk = c.activeMission.danger;
  log(state, `🚀 Launched on a ${def.name} — ${def.durationYears} year(s) in space, real danger involved.`, 'milestone');
  return { ok: true, message: `Launched: ${def.name}.` };
}

/** Push for the next astronaut rank, gated by missions flown and training. */
export function seekAstronautPromotion(state: GameState): SpaceActionResult {
  const c = state.player.astronaut;
  if (!isActive(c)) return { ok: false, message: 'You need to join a space agency first.' };
  if (c.rank >= ASTRONAUT_RANK_TITLES.length - 1) return { ok: false, message: 'You have reached the top of the ladder.' };
  if (onCooldown(state, 'space_promotion')) return { ok: false, message: 'Already sought promotion this year.' };
  setCooldown(state, 'space_promotion');
  const rng = withRng(state);
  const chance = clamp(0.15 + c.missionsFlown * 0.12 + c.trainingScore * 0.003, 0.05, 0.85);
  if (rng.chance(chance)) {
    c.rank++;
    commit(state, rng);
    const title = ASTRONAUT_RANK_TITLES[c.rank];
    if (c.rank === ASTRONAUT_RANK_TITLES.length - 1) awardAchievement(state, 'chief_astronaut');
    log(state, `Promoted to ${title}.`, 'good');
    return { ok: true, message: `Promoted to ${title}.` };
  }
  commit(state, rng);
  log(state, `Passed over for promotion this cycle.`, 'bad');
  return { ok: false, message: 'Passed over.' };
}

export function retireFromSpaceProgram(state: GameState): SpaceActionResult {
  const c = state.player.astronaut;
  if (!isActive(c)) return { ok: false, message: 'You are not in a space program.' };
  if (c.activeMission) return { ok: false, message: 'You cannot retire mid-mission.' };
  c.active = false;
  state.player.happiness = clamp100(state.player.happiness + 5);
  log(state, `You retired from the space program after ${c.missionsFlown} mission(s).`, 'good');
  return { ok: true, message: 'Retired from the space program.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — mission progress, resolution (success/fatality), salary
// ---------------------------------------------------------------------------

export function tickSpaceProgram(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const c = state.player.astronaut;
  if (!isActive(c)) return headlines;
  const p = state.player;
  if (p.inJailYears > 0) return headlines;

  p.money += c.activeMission ? ASTRONAUT_ACTIVE_SALARY_BASE * (1 + c.rank * 0.25) : ASTRONAUT_CANDIDATE_SALARY;

  if (c.activeMission) {
    const mission = c.activeMission;
    const yearsElapsed = state.year - mission.startYear + 1;
    if (yearsElapsed >= mission.durationYears) {
      if (rng.chance(mission.danger)) {
        c.activeMission = null;
        p.alive = false;
        state.pendingDeathReason = `Lost during the ${mission.name} — a catastrophic mission failure.`;
        awardAchievement(state, 'lost_in_space');
        headlines.push(`💀 ${p.name} was lost during the ${mission.name}`);
        return headlines;
      }
      c.missionsFlown++;
      c.hoursInSpace += mission.durationYears * 4_380;
      const def = MISSIONS.find((m) => m.kind === mission.kind)!;
      p.money += def.payout;
      if (mission.kind === 'moon') { c.walkedOnMoon = true; awardAchievement(state, 'moonwalker'); }
      if (mission.kind === 'mars') { c.walkedOnMars = true; awardAchievement(state, 'mars_pioneer'); }
      if (mission.kind === 'station' && c.rank >= 2) awardAchievement(state, 'space_station_commander');
      if (c.missionsFlown >= 5) awardAchievement(state, 'orbital_veteran');
      p.reputation = clamp100(p.reputation + 8);
      p.notoriety = clamp100(p.notoriety + 5);
      c.activeMission = null;
      c.fatalityRisk = 0;
      log(state, `🎉 Successfully completed the ${mission.name} — a triumphant return, earning $${def.payout.toLocaleString()}.`, 'milestone');
      headlines.push(`${p.name} returns safely from the ${mission.name}`);
    }
  }
  return headlines;
}
