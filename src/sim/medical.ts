/**
 * Medical Career: med school → residency → attending physician, treating patients, publishing
 * research, and risking malpractice suits. Self-contained leaf module (like military.ts/
 * drugs.ts/entertainment.ts), not routed through actions.ts. Static catalog in data/medical.ts.
 */
import type { GameState, MedicalCareer } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { SK } from '../data/skills';
import { HOSPITAL_NAMES, MED_SCHOOL_COST_PER_YEAR, MED_SCHOOL_YEARS, MEDICAL_RANK_TITLES, MEDICAL_SPECIALTIES, MEDICAL_SPECIALTY_BY_ID, RESIDENCY_YEARS } from '../data/medical';

export interface MedicalActionResult {
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
function requireAge(state: GameState, minAge: number, activity: string): MedicalActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
function isActive(c: MedicalCareer | null): c is MedicalCareer {
  return !!c && c.active;
}

export function enrollMedSchool(state: GameState): MedicalActionResult {
  const ageGate = requireAge(state, 18, 'medical school');
  if (ageGate) return ageGate;
  const p = state.player;
  if (isActive(p.medicalCareer)) return { ok: false, message: 'You are already on the medical track.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  p.medicalCareer = {
    active: true, stage: 'med_school', specialtyId: null, hospitalId: null, yearsOfService: 0,
    skill: 10, reputation: 20, patientsSaved: 0, patientsLost: 0, malpracticeSuits: 0,
    publications: 0, rank: 0, licenseRevoked: false,
  };
  log(state, `You enrolled in medical school. Years of study ahead.`, 'info');
  return { ok: true, message: 'Enrolled in medical school.' };
}

/** Once med school is finished, pick a specialty and start residency at a hospital. */
export function matchResidency(state: GameState, specialtyId: string): MedicalActionResult {
  const c = state.player.medicalCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to be on the medical track.' };
  if (c.stage !== 'med_school') return { ok: false, message: 'You are not ready to match yet.' };
  if (c.yearsOfService < MED_SCHOOL_YEARS) return { ok: false, message: `You still have ${MED_SCHOOL_YEARS - c.yearsOfService} year(s) of med school left.` };
  const specialty = MEDICAL_SPECIALTY_BY_ID[specialtyId];
  if (!specialty) return { ok: false, message: 'Unknown specialty.' };
  const rng = withRng(state);
  const matchChance = clamp(0.9 - specialty.difficulty * 0.006 + (state.player.smarts - 50) * 0.003, 0.15, 0.97);
  if (!rng.chance(matchChance)) {
    commit(state, rng);
    log(state, `You didn't match into ${specialty.name} this cycle — try again next year, or pick something less competitive.`, 'bad');
    return { ok: false, message: `Failed to match into ${specialty.name}.` };
  }
  c.stage = 'residency';
  c.specialtyId = specialtyId;
  c.hospitalId = rng.pick(HOSPITAL_NAMES);
  c.yearsOfService = 0;
  commit(state, rng);
  log(state, `Matched into a ${specialty.name} residency at ${c.hospitalId}.`, 'milestone');
  return { ok: true, message: `Matched into ${specialty.name} residency.` };
}

/** Take on a patient this year — the core skill-building, reputation-risking loop of the career. */
export function treatPatient(state: GameState): MedicalActionResult {
  const c = state.player.medicalCareer;
  if (!isActive(c) || (c.stage !== 'residency' && c.stage !== 'attending')) return { ok: false, message: 'You need to be practicing medicine.' };
  if (c.licenseRevoked) return { ok: false, message: 'Your license was revoked — you can no longer practice.' };
  if (onCooldown(state, 'med_treat_patient')) return { ok: false, message: 'Already treated your caseload this year.' };
  setCooldown(state, 'med_treat_patient');
  const p = state.player;
  const specialty = c.specialtyId ? MEDICAL_SPECIALTY_BY_ID[c.specialtyId] : MEDICAL_SPECIALTIES[0];
  const rng = withRng(state);
  const successChance = clamp(0.5 + c.skill * 0.005 - specialty.difficulty * 0.003 + (p.skills[SK.medicine] ?? 0) * 0.002, 0.15, 0.96);
  if (rng.chance(successChance)) {
    c.patientsSaved++;
    c.skill = clamp100(c.skill + rng.range(1, 3));
    c.reputation = clamp100(c.reputation + rng.range(1, 3));
    p.skills[SK.medicine] = clamp100((p.skills[SK.medicine] ?? 0) + rng.range(1, 3));
    p.happiness = clamp100(p.happiness + 2);
    if (c.patientsSaved === 1) awardAchievement(state, 'doctor_licensed');
    if (c.patientsSaved >= 100) awardAchievement(state, 'life_saver');
    if (c.patientsSaved >= 500) awardAchievement(state, 'hero_doctor');
    if (c.specialtyId === 'surgery' && c.patientsSaved >= 50) awardAchievement(state, 'master_surgeon');
    commit(state, rng);
    log(state, `You treated a difficult ${specialty.name.toLowerCase()} case successfully.`, 'good');
    return { ok: true, message: 'Patient treated successfully.' };
  }
  c.patientsLost++;
  c.reputation = clamp100(c.reputation - rng.range(4, 10));
  p.happiness = clamp100(p.happiness - 6);
  const suitChance = clamp(specialty.malpracticeBaseRisk * (1 - c.skill / 150), 0.01, 0.5);
  if (rng.chance(suitChance)) {
    c.malpracticeSuits++;
    const settlement = Math.round(20_000 + specialty.difficulty * 3_000 * rng.range(0.5, 1.5));
    p.money = Math.max(0, p.money - settlement);
    c.reputation = clamp100(c.reputation - 12);
    if (c.malpracticeSuits >= 3) {
      c.licenseRevoked = true;
      c.active = false;
      awardAchievement(state, 'license_revoked');
      commit(state, rng);
      log(state, `🚨 A third malpractice suit cost you your license. Your medical career is over.`, 'bad');
      return { ok: false, message: 'License revoked after repeated malpractice suits.' };
    }
    if (c.malpracticeSuits === 1) awardAchievement(state, 'malpractice_survivor');
    commit(state, rng);
    log(state, `⚠️ A patient outcome went badly — hit with a malpractice suit, settled for $${settlement.toLocaleString()}.`, 'bad');
    return { ok: false, message: `Malpractice suit — settled for $${settlement.toLocaleString()}.` };
  }
  commit(state, rng);
  log(state, `Lost a patient despite your best efforts. It weighs on you.`, 'bad');
  return { ok: false, message: 'Lost a patient.' };
}

/** Publish research: slower payoff than treating patients, but builds reputation reliably and
 * gates the "medical pioneer" achievement without malpractice risk. */
export function publishResearch(state: GameState): MedicalActionResult {
  const c = state.player.medicalCareer;
  if (!isActive(c) || c.stage !== 'attending') return { ok: false, message: 'Only attendings have time to publish.' };
  if (onCooldown(state, 'med_publish')) return { ok: false, message: 'Already published this year.' };
  setCooldown(state, 'med_publish');
  const p = state.player;
  const rng = withRng(state);
  c.publications++;
  c.reputation = clamp100(c.reputation + rng.range(3, 8));
  c.skill = clamp100(c.skill + rng.range(1, 2));
  p.reputation = clamp100(p.reputation + 1);
  if (c.publications >= 10) awardAchievement(state, 'medical_pioneer');
  commit(state, rng);
  log(state, `Published research in your field — reputation up to ${Math.round(c.reputation)}.`, 'info');
  return { ok: true, message: 'Research published.' };
}

/** Push for the next rank up the attending ladder — chief-of-staff-adjacent territory at rank 3. */
export function seekPromotion(state: GameState): MedicalActionResult {
  const c = state.player.medicalCareer;
  if (!isActive(c) || c.stage !== 'attending') return { ok: false, message: 'You need to be an attending physician.' };
  if (c.rank >= MEDICAL_RANK_TITLES.length - 1) return { ok: false, message: 'You have reached the top of the ladder.' };
  if (onCooldown(state, 'med_promotion')) return { ok: false, message: 'Already sought promotion this year.' };
  setCooldown(state, 'med_promotion');
  const rng = withRng(state);
  const chance = clamp(0.2 + c.reputation * 0.006 + c.publications * 0.02, 0.05, 0.85);
  if (rng.chance(chance)) {
    c.rank++;
    commit(state, rng);
    const title = MEDICAL_RANK_TITLES[c.rank];
    if (c.rank === 2) awardAchievement(state, 'chief_of_staff');
    log(state, `Promoted to ${title}.`, 'good');
    return { ok: true, message: `Promoted to ${title}.` };
  }
  commit(state, rng);
  log(state, `Passed over for promotion this cycle.`, 'bad');
  return { ok: false, message: 'Passed over.' };
}

export function retireFromMedicine(state: GameState): MedicalActionResult {
  const c = state.player.medicalCareer;
  if (!isActive(c)) return { ok: false, message: 'You are not practicing medicine.' };
  c.active = false;
  c.stage = 'retired';
  state.player.happiness = clamp100(state.player.happiness + 5);
  if (c.patientsSaved >= 500) awardAchievement(state, 'hero_doctor');
  log(state, `You retired from medicine after a career treating ${c.patientsSaved} patients.`, 'good');
  return { ok: true, message: 'Retired from medicine.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — tuition/salary, stage transitions, ambient reputation drift
// ---------------------------------------------------------------------------

export function tickMedicalCareer(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const c = state.player.medicalCareer;
  if (!isActive(c)) return headlines;
  const p = state.player;
  if (p.inJailYears > 0) return headlines;

  if (c.stage === 'med_school') {
    p.money -= MED_SCHOOL_COST_PER_YEAR;
    c.yearsOfService++;
    p.smarts = clamp100(p.smarts + 1.5);
    if (c.yearsOfService >= MED_SCHOOL_YEARS && !c.specialtyId) {
      headlines.push(`${p.name} graduated medical school and is ready to match into residency`);
    }
  } else if (c.stage === 'residency') {
    p.money += 58_000; // resident stipend
    c.yearsOfService++;
    c.skill = clamp100(c.skill + rng.range(2, 5));
    if (c.yearsOfService >= RESIDENCY_YEARS) {
      c.stage = 'attending';
      c.yearsOfService = 0;
      c.rank = 0;
      awardAchievement(state, 'doctor_licensed');
      headlines.push(`${p.name} completed residency and is now a practicing attending physician`);
    }
  } else if (c.stage === 'attending') {
    const specialty = c.specialtyId ? MEDICAL_SPECIALTY_BY_ID[c.specialtyId] : MEDICAL_SPECIALTIES[0];
    const rankMult = 1 + c.rank * 0.35;
    const salary = Math.round(specialty.baseSalary * rankMult * (0.7 + c.skill * 0.006));
    p.money += salary;
    c.yearsOfService++;
    // Ambient reputation decay if you never publish or treat anyone in a given year.
    c.reputation = clamp(c.reputation - 1, 0, 100);
  }
  return headlines;
}
