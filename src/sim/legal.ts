/**
 * Legal Career: law school → associate → partner, arguing cases and risking bar complaints, with
 * an optional late-career leap to the bench. Self-contained leaf module (like medical.ts/
 * military.ts/entertainment.ts), not routed through actions.ts. Static catalog in data/legal.ts.
 */
import type { GameState, LegalCareer } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { SK } from '../data/skills';
import {
  ASSOCIATE_YEARS, JUDGESHIP_MIN_PARTNER_RANK, JUDGESHIP_MIN_REPUTATION, LAW_FIRM_NAMES,
  LAW_SCHOOL_COST_PER_YEAR, LAW_SCHOOL_YEARS, LEGAL_RANK_TITLES, LEGAL_SPECIALTIES, LEGAL_SPECIALTY_BY_ID,
} from '../data/legal';

export interface LegalActionResult {
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
function requireAge(state: GameState, minAge: number, activity: string): LegalActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
function isActive(c: LegalCareer | null): c is LegalCareer {
  return !!c && c.active;
}

export function enrollLawSchool(state: GameState): LegalActionResult {
  const ageGate = requireAge(state, 18, 'law school');
  if (ageGate) return ageGate;
  const p = state.player;
  if (isActive(p.legalCareer)) return { ok: false, message: 'You are already on the legal track.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  p.legalCareer = {
    active: true, stage: 'law_school', specialtyId: null, firmId: null, yearsOfService: 0,
    skill: 10, reputation: 20, casesWon: 0, casesLost: 0, barComplaints: 0,
    publications: 0, rank: 0, disbarred: false,
  };
  log(state, `You enrolled in law school. Years of study ahead.`, 'info');
  return { ok: true, message: 'Enrolled in law school.' };
}

/** Once law school is finished, pick a specialty and join a firm as an associate. */
export function joinFirm(state: GameState, specialtyId: string): LegalActionResult {
  const c = state.player.legalCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to be on the legal track.' };
  if (c.stage !== 'law_school') return { ok: false, message: 'You are not ready to join a firm yet.' };
  if (c.yearsOfService < LAW_SCHOOL_YEARS) return { ok: false, message: `You still have ${LAW_SCHOOL_YEARS - c.yearsOfService} year(s) of law school left.` };
  const specialty = LEGAL_SPECIALTY_BY_ID[specialtyId];
  if (!specialty) return { ok: false, message: 'Unknown specialty.' };
  const rng = withRng(state);
  const barPassChance = clamp(0.75 + (state.player.smarts - 50) * 0.004, 0.2, 0.97);
  if (!rng.chance(barPassChance)) {
    commit(state, rng);
    log(state, `You didn't pass the bar exam this sitting — you can retake it next year.`, 'bad');
    return { ok: false, message: 'Failed the bar exam.' };
  }
  c.stage = 'associate';
  c.specialtyId = specialtyId;
  c.firmId = rng.pick(LAW_FIRM_NAMES);
  c.yearsOfService = 0;
  commit(state, rng);
  awardAchievement(state, 'lawyer_licensed');
  log(state, `Passed the bar and joined ${c.firmId} as an associate in ${specialty.name}.`, 'milestone');
  return { ok: true, message: `Joined ${c.firmId} as an associate.` };
}

/** Take on a case this year — the core skill-building, reputation-risking loop of the career. */
export function takeCase(state: GameState): LegalActionResult {
  const c = state.player.legalCareer;
  if (!isActive(c) || (c.stage !== 'associate' && c.stage !== 'partner')) return { ok: false, message: 'You need to be practicing law.' };
  if (c.disbarred) return { ok: false, message: 'You were disbarred — you can no longer practice.' };
  if (onCooldown(state, 'legal_take_case')) return { ok: false, message: 'Already carrying a full caseload this year.' };
  setCooldown(state, 'legal_take_case');
  const p = state.player;
  const specialty = c.specialtyId ? LEGAL_SPECIALTY_BY_ID[c.specialtyId] : LEGAL_SPECIALTIES[0];
  const rng = withRng(state);
  const successChance = clamp(0.5 + c.skill * 0.005 - specialty.difficulty * 0.003 + (p.skills[SK.law] ?? 0) * 0.002, 0.15, 0.96);
  if (rng.chance(successChance)) {
    c.casesWon++;
    c.skill = clamp100(c.skill + rng.range(1, 3));
    c.reputation = clamp100(c.reputation + rng.range(1, 3));
    p.skills[SK.law] = clamp100((p.skills[SK.law] ?? 0) + rng.range(1, 3));
    p.happiness = clamp100(p.happiness + 2);
    if (c.casesWon >= 100) awardAchievement(state, 'case_closer');
    if (c.casesWon >= 500) awardAchievement(state, 'legal_legend');
    if (c.specialtyId === 'litigation' && c.casesWon >= 50) awardAchievement(state, 'litigation_ace');
    commit(state, rng);
    log(state, `You won a tough ${specialty.name.toLowerCase()} case.`, 'good');
    return { ok: true, message: 'Case won.' };
  }
  c.casesLost++;
  c.reputation = clamp100(c.reputation - rng.range(4, 10));
  p.happiness = clamp100(p.happiness - 6);
  const complaintChance = clamp(specialty.complaintBaseRisk * (1 - c.skill / 150), 0.01, 0.5);
  if (rng.chance(complaintChance)) {
    c.barComplaints++;
    const settlement = Math.round(15_000 + specialty.difficulty * 2_500 * rng.range(0.5, 1.5));
    p.money = Math.max(0, p.money - settlement);
    c.reputation = clamp100(c.reputation - 12);
    if (c.barComplaints >= 3) {
      c.disbarred = true;
      c.active = false;
      awardAchievement(state, 'disbarred');
      commit(state, rng);
      log(state, `🚨 A third bar complaint cost you your license. Your legal career is over.`, 'bad');
      return { ok: false, message: 'Disbarred after repeated complaints.' };
    }
    if (c.barComplaints === 1) awardAchievement(state, 'bar_survivor');
    commit(state, rng);
    log(state, `⚠️ A case went badly — hit with a bar complaint, settled for $${settlement.toLocaleString()}.`, 'bad');
    return { ok: false, message: `Bar complaint — settled for $${settlement.toLocaleString()}.` };
  }
  commit(state, rng);
  log(state, `Lost a case despite your best argument. It weighs on you.`, 'bad');
  return { ok: false, message: 'Lost a case.' };
}

/** Publish a law review article: slower payoff than casework, but builds reputation reliably
 * without bar-complaint risk. */
export function publishLawReview(state: GameState): LegalActionResult {
  const c = state.player.legalCareer;
  if (!isActive(c) || c.stage !== 'partner') return { ok: false, message: 'Only partners have time to publish.' };
  if (onCooldown(state, 'legal_publish')) return { ok: false, message: 'Already published this year.' };
  setCooldown(state, 'legal_publish');
  const p = state.player;
  const rng = withRng(state);
  c.publications++;
  c.reputation = clamp100(c.reputation + rng.range(3, 8));
  c.skill = clamp100(c.skill + rng.range(1, 2));
  p.reputation = clamp100(p.reputation + 1);
  if (c.publications >= 10) awardAchievement(state, 'legal_scholar');
  commit(state, rng);
  log(state, `Published a law review article — reputation up to ${Math.round(c.reputation)}.`, 'info');
  return { ok: true, message: 'Law review article published.' };
}

/** Push for the next rank up the partner ladder. */
export function seekLegalPromotion(state: GameState): LegalActionResult {
  const c = state.player.legalCareer;
  if (!isActive(c) || c.stage !== 'partner') return { ok: false, message: 'You need to be a partner.' };
  if (c.rank >= LEGAL_RANK_TITLES.length - 1) return { ok: false, message: 'You have reached the top of the ladder.' };
  if (onCooldown(state, 'legal_promotion')) return { ok: false, message: 'Already sought promotion this year.' };
  setCooldown(state, 'legal_promotion');
  const rng = withRng(state);
  const chance = clamp(0.2 + c.reputation * 0.006 + c.publications * 0.02, 0.05, 0.85);
  if (rng.chance(chance)) {
    c.rank++;
    commit(state, rng);
    const title = LEGAL_RANK_TITLES[c.rank];
    if (c.rank === 2) awardAchievement(state, 'named_partner');
    log(state, `Promoted to ${title}.`, 'good');
    return { ok: true, message: `Promoted to ${title}.` };
  }
  commit(state, rng);
  log(state, `Passed over for promotion this cycle.`, 'bad');
  return { ok: false, message: 'Passed over.' };
}

/** A unique late-career branch: leave private practice for a judicial appointment. Requires real
 * standing (senior partner rank + high reputation) — this is a one-way door, closing out casework
 * for good in favor of presiding over them instead. */
export function seekJudgeship(state: GameState): LegalActionResult {
  const c = state.player.legalCareer;
  if (!isActive(c) || c.stage !== 'partner') return { ok: false, message: 'You need to be a practicing partner.' };
  if (c.rank < JUDGESHIP_MIN_PARTNER_RANK) return { ok: false, message: `You need to reach ${LEGAL_RANK_TITLES[JUDGESHIP_MIN_PARTNER_RANK]} first.` };
  if (c.reputation < JUDGESHIP_MIN_REPUTATION) return { ok: false, message: `You need at least ${JUDGESHIP_MIN_REPUTATION} reputation to be considered.` };
  if (onCooldown(state, 'legal_judgeship')) return { ok: false, message: 'Already sought an appointment this year.' };
  setCooldown(state, 'legal_judgeship');
  const rng = withRng(state);
  const chance = clamp(0.15 + (c.reputation - JUDGESHIP_MIN_REPUTATION) * 0.01 + c.publications * 0.015, 0.05, 0.7);
  if (rng.chance(chance)) {
    c.stage = 'judge';
    c.yearsOfService = 0;
    commit(state, rng);
    awardAchievement(state, 'appointed_judge');
    state.player.reputation = clamp100(state.player.reputation + 10);
    state.player.influence = clamp100(state.player.influence + 8);
    log(state, `You were appointed to the bench. From now on, you preside — you don't argue.`, 'milestone');
    return { ok: true, message: 'Appointed to the bench.' };
  }
  commit(state, rng);
  log(state, `Your judicial nomination stalled in committee — you can try again next year.`, 'bad');
  return { ok: false, message: 'Nomination stalled.' };
}

export function retireFromLaw(state: GameState): LegalActionResult {
  const c = state.player.legalCareer;
  if (!isActive(c)) return { ok: false, message: 'You are not practicing law.' };
  c.active = false;
  c.stage = 'retired';
  state.player.happiness = clamp100(state.player.happiness + 5);
  if (c.casesWon >= 500) awardAchievement(state, 'legal_legend');
  log(state, `You retired from the law after a career of ${c.casesWon} cases won.`, 'good');
  return { ok: true, message: 'Retired from law.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — tuition/salary, stage transitions, ambient reputation drift
// ---------------------------------------------------------------------------

export function tickLegalCareer(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const c = state.player.legalCareer;
  if (!isActive(c)) return headlines;
  const p = state.player;
  if (p.inJailYears > 0) return headlines;

  if (c.stage === 'law_school') {
    p.money -= LAW_SCHOOL_COST_PER_YEAR;
    c.yearsOfService++;
    p.smarts = clamp100(p.smarts + 1.5);
    if (c.yearsOfService >= LAW_SCHOOL_YEARS && !c.specialtyId) {
      headlines.push(`${p.name} graduated law school and is ready to sit the bar`);
    }
  } else if (c.stage === 'associate') {
    p.money += 68_000; // associate salary
    c.yearsOfService++;
    c.skill = clamp100(c.skill + rng.range(2, 5));
    if (c.yearsOfService >= ASSOCIATE_YEARS) {
      c.stage = 'partner';
      c.yearsOfService = 0;
      c.rank = 0;
      headlines.push(`${p.name} made partner after years as an associate`);
    }
  } else if (c.stage === 'partner') {
    const specialty = c.specialtyId ? LEGAL_SPECIALTY_BY_ID[c.specialtyId] : LEGAL_SPECIALTIES[0];
    const rankMult = 1 + c.rank * 0.4;
    const salary = Math.round(specialty.baseSalary * rankMult * (0.7 + c.skill * 0.006));
    p.money += salary;
    c.yearsOfService++;
    c.reputation = clamp(c.reputation - 1, 0, 100);
  } else if (c.stage === 'judge') {
    p.money += 190_000;
    c.yearsOfService++;
    p.influence = clamp100(p.influence + 0.5);
  }
  return headlines;
}
