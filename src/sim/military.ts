/**
 * Military Service career: enlist, train, deploy against a real enemy nation your country is
 * currently at war with, rank up, earn medals, and eventually discharge — a self-contained leaf
 * module (like casino.ts/athletics.ts), not routed through actions.ts. Combat is resolved
 * statistically rather than played out (no 3D scene, unlike Athlete) — the drama comes from real
 * risk: injury, death, medals, and a genuine heroism-vs-atrocity choice while deployed.
 *
 * Deployment ties directly into the existing geopolitical war system (Country.atWarWith, mutated
 * by tickPolitics) rather than duplicating it — a soldier can only deploy while their home country
 * is actually at war with someone, and the enemy nation is whichever real country that is.
 */
import type { GameState, MilitaryBranch, MilitaryCareer, MilitaryDeployment } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import {
  BRANCH_BY_ID, MILITARY_BASES, MILITARY_INJURY_TYPES, MILITARY_MEDALS,
  MILITARY_TRAINING_PROGRAMS, RANKS_BY_BRANCH, SPECIALTY_BY_ID, rankAt,
} from '../data/military';

export interface MilitaryActionResult {
  ok: boolean;
  message: string;
}

// Local copies of actions.ts's RNG-draw/cooldown patterns — not imported from there to keep this
// a dependency-free leaf module, same convention as casino.ts/athletics.ts/family.ts.
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
function requireAge(state: GameState, minAge: number, activity: string): MilitaryActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}

function isServing(career: MilitaryCareer | null): career is MilitaryCareer {
  return !!career && career.dischargeType === null;
}

// ---------------------------------------------------------------------------
// Enlistment, training, discharge
// ---------------------------------------------------------------------------

export function enlistInMilitary(state: GameState, branch: MilitaryBranch, specialtyId: string): MilitaryActionResult {
  const ageGate = requireAge(state, 18, 'enlisting');
  if (ageGate) return ageGate;
  const existing = state.player.military;
  if (existing && existing.dischargeType === null) return { ok: false, message: 'You are already serving.' };
  if (existing && existing.dischargeType === 'dishonorable') return { ok: false, message: 'A dishonorable discharge bars you from re-enlisting.' };
  const branchDef = BRANCH_BY_ID[branch];
  const specialty = SPECIALTY_BY_ID[specialtyId];
  if (!branchDef || !specialty) return { ok: false, message: 'Unknown branch or specialty.' };
  const career: MilitaryCareer = {
    branch, specialtyId, rankIndex: 0, yearsOfService: 0, enlistedYear: state.year,
    discipline: 55, combatSkill: 20, leadership: 15, fitness: 65, disabilityRating: 0,
    currentDeployment: null, deployments: [], injuries: [], medals: [],
    warCrimesCommitted: 0, heroicActsCount: 0, courtMartialed: false,
    dischargeType: null, dischargeYear: null, veteranPensionPerYear: 0, reenlistedCount: 0,
  };
  state.player.military = career;
  awardAchievement(state, 'military_enlisted');
  log(state, `Enlisted in the ${branchDef.name} as ${specialty.name}.`, 'info');
  return { ok: true, message: `Welcome to the ${branchDef.name}, ${specialty.name}.` };
}

export function trainMilitary(state: GameState, programId: string): MilitaryActionResult {
  const career = state.player.military;
  if (!isServing(career)) return { ok: false, message: 'You need to be actively serving to train.' };
  if (onCooldown(state, 'military_train')) return { ok: false, message: 'Already trained this year.' };
  const program = MILITARY_TRAINING_PROGRAMS.find((p) => p.id === programId);
  if (!program) return { ok: false, message: 'Unknown training program.' };
  if (career.rankIndex < program.minRankIndex) return { ok: false, message: `You need more seniority for ${program.name}.` };
  career.combatSkill = clamp100(career.combatSkill + program.combatSkillGain);
  career.leadership = clamp100(career.leadership + program.leadershipGain);
  career.fitness = clamp100(career.fitness + program.fitnessGain);
  career.discipline = clamp100(career.discipline + program.disciplineGain);
  setCooldown(state, 'military_train');
  log(state, `Completed ${program.name}.`, 'good');
  return { ok: true, message: `Completed ${program.name}.` };
}

export function deployOverseas(state: GameState): MilitaryActionResult {
  const career = state.player.military;
  if (!isServing(career)) return { ok: false, message: 'You need to be actively serving to deploy.' };
  if (career.currentDeployment) return { ok: false, message: 'You are already deployed.' };
  const home = state.countries.find((c) => c.id === state.player.countryId);
  if (!home || home.atWarWith.length === 0) return { ok: false, message: 'Your country is not at war right now — there is nowhere to deploy.' };
  const rng = withRng(state);
  const conflictCountryId = rng.pick(home.atWarWith);
  const theaters = MILITARY_BASES.filter((b) => !b.homeland);
  const base = rng.pick(theaters.length ? theaters : MILITARY_BASES);
  const deployment: MilitaryDeployment = {
    id: `dep_${state.year}_${rng.int(1000, 9999)}`,
    baseId: base.id, conflictCountryId, startYear: state.year, endYear: null,
    missionsCompleted: 0, outcome: 'ongoing',
  };
  career.currentDeployment = deployment;
  commit(state, rng);
  const enemy = state.countries.find((c) => c.id === conflictCountryId);
  if (career.deployments.length === 0) awardAchievement(state, 'combat_deployment');
  log(state, `Deployed to ${base.name} against ${enemy?.name ?? 'the enemy'}.`, 'info');
  return { ok: true, message: `Deployed to ${base.name}.` };
}

export function requestRotationHome(state: GameState): MilitaryActionResult {
  const career = state.player.military;
  if (!isServing(career) || !career.currentDeployment) return { ok: false, message: 'You are not currently deployed.' };
  const dep = career.currentDeployment;
  dep.outcome = 'completed';
  dep.endYear = state.year;
  career.deployments.push(dep);
  career.currentDeployment = null;
  log(state, `Rotated home after requesting an early end to the tour.`, 'info');
  return { ok: true, message: 'Rotated home.' };
}

/** A genuine light-path choice while deployed: risk yourself to protect civilians/comrades. */
export function actHeroically(state: GameState): MilitaryActionResult {
  const career = state.player.military;
  if (!isServing(career) || !career.currentDeployment) return { ok: false, message: 'You need to be deployed to act.' };
  if (onCooldown(state, 'military_heroic')) return { ok: false, message: 'Already made your move this year.' };
  const rng = withRng(state);
  career.heroicActsCount++;
  career.fitness = clamp100(career.fitness - rng.range(5, 12));
  const p = state.player;
  p.reputation = clamp100(p.reputation + rng.range(2, 5));
  p.karma = clamp100(p.karma + rng.range(2, 6));
  let message = 'You put yourself in harm\'s way to protect others.';
  if (rng.chance(0.35)) {
    const eligible = MILITARY_MEDALS.filter((m) => m.requiresHeroism);
    const medal = rng.pick(eligible);
    career.medals.push({ id: medal.id, name: medal.name, yearAwarded: state.year, citation: 'For conspicuous gallantry under fire.' });
    p.reputation = clamp100(p.reputation + medal.reputationGain);
    p.karma = clamp100(p.karma + medal.karmaGain);
    message = `Awarded the ${medal.name} for gallantry under fire.`;
    if (medal.id === 'medal_of_honor') awardAchievement(state, 'medal_of_honor');
    if (medal.id === 'bronze_star') awardAchievement(state, 'bronze_star');
    if (medal.id === 'silver_star') awardAchievement(state, 'silver_star');
  }
  if (career.heroicActsCount >= 5) awardAchievement(state, 'war_hero');
  setCooldown(state, 'military_heroic');
  log(state, message, 'good');
  return { ok: true, message };
}

/** A genuine dark-path choice while deployed: cross a line for personal gain or self-preservation. */
export function commitWarCrime(state: GameState): MilitaryActionResult {
  const career = state.player.military;
  if (!isServing(career) || !career.currentDeployment) return { ok: false, message: 'You need to be deployed to act.' };
  if (onCooldown(state, 'military_warcrime')) return { ok: false, message: 'Already made your move this year.' };
  const rng = withRng(state);
  const p = state.player;
  career.warCrimesCommitted++;
  career.discipline = clamp100(career.discipline - rng.range(8, 18));
  p.karma = clamp100(p.karma - rng.range(10, 22));
  p.reputation = clamp100(p.reputation - rng.range(5, 12));
  p.notoriety = clamp100(p.notoriety + rng.range(4, 10));
  const loot = Math.round(rng.range(2_000, 15_000));
  p.money += loot;
  commit(state, rng);
  const message = `You crossed a line in the field for ${Math.round(loot).toLocaleString()} — it won't be forgotten.`;
  setCooldown(state, 'military_warcrime');
  log(state, message, 'bad');
  return { ok: true, message };
}

export interface MissionOutcome {
  hostilesEliminated: number;
  hostilesTotal: number;
  damageTaken: number; // 0..100
  survived: boolean;
}

/** Resolves a played-out mission from either the ground-combat or air-combat 3D scene — a strong
 * run grows combat skill faster and can land a medal; a bad one risks a real (if softened, since
 * the player was actually fighting back rather than just statistically exposed) injury. One
 * playable mission per year, on top of whatever the yearly tick resolves automatically. */
export function resolveCombatMission(state: GameState, outcome: MissionOutcome): MilitaryActionResult {
  const career = state.player.military;
  if (!isServing(career) || !career.currentDeployment) return { ok: false, message: 'You need to be deployed to run a mission.' };
  if (onCooldown(state, 'military_mission')) return { ok: false, message: 'Already ran a mission this year.' };
  const rng = withRng(state);
  const p = state.player;
  const dep = career.currentDeployment;
  const accuracy = outcome.hostilesTotal > 0 ? outcome.hostilesEliminated / outcome.hostilesTotal : 0;
  dep.missionsCompleted++;
  career.combatSkill = clamp100(career.combatSkill + Math.round(2 + accuracy * 6));
  p.stress = clamp100(p.stress + rng.range(2, 6));
  p.health = clamp100(p.health - outcome.damageTaken * 0.12);

  let message: string;
  let kind: 'good' | 'bad' = 'good';
  if (!outcome.survived) {
    kind = 'bad';
    const injuryDef = rng.pick(MILITARY_INJURY_TYPES);
    const severity = clamp(Math.round(rng.range(injuryDef.minSeverity, injuryDef.maxSeverity) * 0.7), 1, 10);
    const permanent = rng.chance(injuryDef.permanentChance * 0.6);
    career.injuries.push({ kind: injuryDef.id, name: injuryDef.name, severity, permanent, yearSustained: state.year });
    if (permanent) {
      career.disabilityRating = clamp100(career.disabilityRating + severity * 2);
      awardAchievement(state, 'disabled_veteran');
    }
    awardAchievement(state, 'wounded_warrior');
    message = `Took heavy fire during the mission — sustained a ${injuryDef.name.toLowerCase()}.`;
  } else if (accuracy >= 0.8 && rng.chance(0.45)) {
    p.reputation = clamp100(p.reputation + rng.range(3, 6));
    p.karma = clamp100(p.karma + rng.range(1, 3));
    const eligible = MILITARY_MEDALS.filter((m) => m.requiresHeroism);
    const medal = rng.pick(eligible);
    career.medals.push({ id: medal.id, name: medal.name, yearAwarded: state.year, citation: `For decisive action in the field — ${outcome.hostilesEliminated}/${outcome.hostilesTotal} hostiles engaged.` });
    p.reputation = clamp100(p.reputation + medal.reputationGain);
    message = `Flawless mission — awarded the ${medal.name}.`;
    if (medal.id === 'medal_of_honor') awardAchievement(state, 'medal_of_honor');
    if (medal.id === 'bronze_star') awardAchievement(state, 'bronze_star');
    if (medal.id === 'silver_star') awardAchievement(state, 'silver_star');
  } else {
    message = `Completed the mission — ${outcome.hostilesEliminated}/${outcome.hostilesTotal} hostiles engaged.`;
  }
  if (dep.missionsCompleted >= 15) awardAchievement(state, 'combat_veteran');
  commit(state, rng);
  setCooldown(state, 'military_mission');
  log(state, message, kind);
  return { ok: true, message };
}

export function reenlistForBonus(state: GameState): MilitaryActionResult {
  const career = state.player.military;
  if (!isServing(career)) return { ok: false, message: 'You need to be actively serving to re-enlist.' };
  const lastYear = state.player.actionCooldowns['military_reenlist'] ?? career.enlistedYear;
  if (state.year - lastYear < 4) return { ok: false, message: `Re-enlistment isn't due for ${4 - (state.year - lastYear)} more year(s).` };
  const rank = rankAt(career.branch, career.rankIndex);
  const bonus = Math.round(rank.salary * 0.5);
  state.player.money += bonus;
  career.reenlistedCount++;
  career.discipline = clamp100(career.discipline + 3);
  career.leadership = clamp100(career.leadership + 1);
  state.player.actionCooldowns['military_reenlist'] = state.year;
  if (career.reenlistedCount >= 1) awardAchievement(state, 'reenlisted_veteran');
  log(state, `Re-enlisted for another term — collected a $${bonus.toLocaleString()} bonus.`, 'money');
  return { ok: true, message: `Re-enlisted for a $${bonus.toLocaleString()} bonus.` };
}

export function requestDischarge(state: GameState): MilitaryActionResult {
  const career = state.player.military;
  if (!isServing(career)) return { ok: false, message: 'You are not currently serving.' };
  if (career.currentDeployment) return { ok: false, message: 'You must rotate home before you can discharge.' };
  finalizeDischarge(state, career, 'honorable');
  log(state, `Honorably discharged after ${career.yearsOfService} years of service.`, 'good');
  return { ok: true, message: 'Honorably discharged.' };
}

function finalizeDischarge(state: GameState, career: MilitaryCareer, type: NonNullable<MilitaryCareer['dischargeType']>): void {
  career.dischargeType = type;
  career.dischargeYear = state.year;
  if (type === 'honorable' || type === 'general' || type === 'medical') {
    const rank = rankAt(career.branch, career.rankIndex);
    const serviceFactor = clamp(career.yearsOfService / 20, 0.1, 1.5);
    career.veteranPensionPerYear = Math.round(rank.salary * 0.35 * serviceFactor + career.disabilityRating * 150);
    awardAchievement(state, 'honorable_discharge');
  }
  if (career.yearsOfService >= 20) awardAchievement(state, 'career_soldier');
  if (career.rankIndex >= RANKS_BY_BRANCH[career.branch].length - 1) awardAchievement(state, 'top_enlisted');
  if (career.medals.length >= 5) awardAchievement(state, 'decorated_veteran');
  if (career.deployments.length + (career.currentDeployment ? 1 : 0) >= 3) awardAchievement(state, 'multiple_tours');
  if (career.disabilityRating > 0) awardAchievement(state, 'disabled_veteran');
}

// ---------------------------------------------------------------------------
// Yearly tick — resolves deployment risk, rank progression, court-martial risk
// ---------------------------------------------------------------------------

export function tickMilitaryCareer(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const career = state.player.military;
  if (!isServing(career)) return headlines;
  const p = state.player;
  career.yearsOfService++;

  // Pay
  const branchDef = BRANCH_BY_ID[career.branch];
  const specialty = SPECIALTY_BY_ID[career.specialtyId];
  const rank = rankAt(career.branch, career.rankIndex);
  const salary = Math.round((rank.salary + (specialty?.salaryBonus ?? 0)) * (branchDef?.basePayMultiplier ?? 1));
  p.money += salary;

  // Rank progression
  const ladder = RANKS_BY_BRANCH[career.branch];
  const next = ladder[career.rankIndex + 1];
  if (next && career.yearsOfService >= next.minYears && career.discipline >= 35) {
    const promoteChance = clamp((career.discipline + career.leadership) / 2 / 100, 0.08, 0.85);
    if (rng.chance(promoteChance)) {
      career.rankIndex++;
      career.leadership = clamp100(career.leadership + 2);
      headlines.push(`Promoted to ${next.name}.`);
      if (career.rankIndex >= ladder.length - 1) headlines.push(`Reached the top of the enlisted ranks: ${next.name}.`);
    }
  }

  if (career.currentDeployment) {
    const dep = career.currentDeployment;
    const missionsThisYear = rng.int(2, 6);
    dep.missionsCompleted += missionsThisYear;
    career.combatSkill = clamp100(career.combatSkill + rng.range(1, 4));
    career.fitness = clamp100(career.fitness - rng.range(5, 15));
    p.stress = clamp100(p.stress + rng.range(3, 10));
    if (dep.missionsCompleted >= 15) awardAchievement(state, 'combat_veteran');

    const combatRisk = specialty?.combatRole ? 0.16 : 0.05;
    const survivalFactor = career.combatSkill / 100;
    const injuryChance = combatRisk * (1 - survivalFactor * 0.5);
    if (rng.chance(injuryChance)) {
      const injuryDef = rng.pick(MILITARY_INJURY_TYPES);
      const severity = rng.int(injuryDef.minSeverity, injuryDef.maxSeverity);
      const permanent = rng.chance(injuryDef.permanentChance);
      const deathChance = severity >= 9 ? 0.14 : severity >= 7 ? 0.05 : 0;
      if (rng.chance(deathChance)) {
        dep.outcome = 'kia';
        dep.endYear = state.year;
        career.deployments.push(dep);
        career.currentDeployment = null;
        career.dischargeType = 'kia';
        career.dischargeYear = state.year;
        if (career.medals.length > 0) awardAchievement(state, 'fallen_hero');
        p.alive = false;
        headlines.push(`💀 Killed in action while deployed with the ${branchDef?.name ?? 'military'}.`);
        return headlines;
      }
      career.injuries.push({ kind: injuryDef.id, name: injuryDef.name, severity, permanent, yearSustained: state.year });
      if (permanent) {
        career.disabilityRating = clamp100(career.disabilityRating + severity * 2);
        awardAchievement(state, 'disabled_veteran');
      }
      p.health = clamp100(p.health - severity * 3);
      awardAchievement(state, 'wounded_warrior');
      if (rng.chance(0.6)) {
        const purpleHeart = MILITARY_MEDALS.find((m) => m.id === 'purple_heart')!;
        career.medals.push({ id: purpleHeart.id, name: purpleHeart.name, yearAwarded: state.year, citation: 'Wounded in action.' });
        p.reputation = clamp100(p.reputation + purpleHeart.reputationGain);
        awardAchievement(state, 'purple_heart');
      }
      if (severity >= 7) {
        dep.outcome = 'wounded';
        dep.endYear = state.year;
        career.deployments.push(dep);
        career.currentDeployment = null;
        headlines.push(`Wounded in action (${injuryDef.name}) and medically evacuated from deployment.`);
      } else {
        headlines.push(`Sustained a ${injuryDef.name.toLowerCase()} in the field but remained deployed.`);
      }
    }

    if (career.currentDeployment && state.year - dep.startYear >= rng.int(1, 2)) {
      dep.outcome = 'completed';
      dep.endYear = state.year;
      career.deployments.push(dep);
      career.currentDeployment = null;
      headlines.push(`Rotated home after completing a tour of duty.`);
    }
    if (career.specialtyId === 'eod' && dep.missionsCompleted >= 20) awardAchievement(state, 'eod_survivor');
    if (career.specialtyId === 'special_forces' && dep.missionsCompleted >= 10) awardAchievement(state, 'special_forces_operator');
  } else {
    career.fitness = clamp100(career.fitness + rng.range(3, 8));
    p.stress = clamp100(p.stress - rng.range(1, 4));
  }

  career.discipline = clamp100(career.discipline + rng.range(-2, 2));

  // Court-martial risk climbs with an unpunished pattern of war crimes.
  if (career.warCrimesCommitted > 0 && !career.courtMartialed && rng.chance(0.05 * career.warCrimesCommitted)) {
    career.courtMartialed = true;
    career.dischargeType = 'dishonorable';
    career.dischargeYear = state.year;
    if (career.currentDeployment) {
      career.currentDeployment.outcome = 'completed';
      career.currentDeployment.endYear = state.year;
      career.deployments.push(career.currentDeployment);
      career.currentDeployment = null;
    }
    p.criminalRecord++;
    p.inJailYears += rng.int(1, 5);
    p.reputation = clamp100(p.reputation - 20);
    awardAchievement(state, 'court_martialed');
    headlines.push(`Court-martialed for conduct in the field and dishonorably discharged.`);
  }

  return headlines;
}
