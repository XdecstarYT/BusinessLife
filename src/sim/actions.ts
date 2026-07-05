/**
 * Player actions: the verbs the UI invokes between years. Each mutates the
 * game state and returns a short result message. They validate affordability
 * and eligibility so the UI can surface clean errors. RNG-consuming actions
 * advance the persisted stream so outcomes stay deterministic on replay.
 */
import type { Advisor, AdvisorSpecialty, CabinetPortfolio, Company, Coworker, Executive, ExecutiveRole, GameState, Gender, InfrastructureKind, ManifestoPromise, MaintenanceLevel, OfficeKind, PropertyAsset, TaxRates, WorkStyle } from './types';
import { CABINET_PORTFOLIOS, clamp, clamp100 } from './types';
import { RNG } from './rng';
import { INDUSTRY_BY_ID, INDUSTRIES } from '../data/industries';
import { LAW_BY_ID } from '../data/laws';
import { SK } from '../data/skills';
import { makeCompanyName, makePartyName, makePersonName } from '../data/names';
import {
  CAREER_LADDER, COWORKER_PERSONALITIES, COWORKER_PERSONALITY_BY_ID,
  FREELANCE_GIG_BY_ID, FREELANCE_GIGS, rankIndex, titleForRank, WORK_STYLE_BY_ID,
} from '../data/careers';
import { createCompany, nextCompanyId, companyValuation } from './business';
import { doIPO, marketCap } from './market';
import { OFFICE_SPEC_BY_KIND, campaignWinChance, eligibleFor, estimateLawVote } from './politics';
import { log, logHistory } from './engine';
import { pushMemory } from './npcMind';
import { POST_STYLE_BY_ID, POST_STYLES } from '../data/socialMedia';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Draw a fresh RNG seeded from the persisted stream, and persist it back. */
function withRng(state: GameState): RNG {
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  return rng;
}
function commit(state: GameState, rng: RNG): void {
  state.rngState = rng.state;
}

/** Per-year rate limiting for repeatable actions with no other natural cost/cooldown
 * (lifestyle activities, freelance gigs, networking) — without this, a `run()` call can be
 * dispatched an unlimited number of times in one sitting to farm stats/skills/money for free. */
function onCooldown(state: GameState, key: string): boolean {
  return state.player.actionCooldowns[key] === state.year;
}
function setCooldown(state: GameState, key: string): void {
  state.player.actionCooldowns[key] = state.year;
}

// ---------------------------------------------------------------------------
// Education & careers
// ---------------------------------------------------------------------------

export const DEGREES = [
  { degree: 'Certificate', field: 'Trade', years: 1, cost: 8_000, smarts: 2, skillId: SK.construction },
  { degree: "Bachelor's", field: 'Business', years: 3, cost: 25_000, smarts: 6, skillId: SK.management },
  { degree: "Bachelor's", field: 'Economics', years: 3, cost: 25_000, smarts: 6, skillId: SK.economics },
  { degree: "Bachelor's", field: 'Law', years: 4, cost: 40_000, smarts: 7, skillId: SK.law },
  { degree: "Bachelor's", field: 'Engineering', years: 4, cost: 35_000, smarts: 7, skillId: SK.engineering },
  { degree: "Bachelor's", field: 'Computer Science', years: 3, cost: 30_000, smarts: 7, skillId: SK.programming },
  { degree: "Bachelor's", field: 'Political Science', years: 3, cost: 24_000, smarts: 6, skillId: SK.policy },
  { degree: "Bachelor's", field: 'Medicine', years: 6, cost: 70_000, smarts: 9, skillId: SK.medicine },
  { degree: 'MBA', field: 'Business Administration', years: 2, cost: 90_000, smarts: 5, skillId: SK.management },
  { degree: 'Doctorate', field: 'Research', years: 4, cost: 20_000, smarts: 8, skillId: SK.research },
  { degree: 'Vocational Certificate', field: 'Culinary Arts', years: 1, cost: 12_000, smarts: 2, skillId: SK.cooking },
  { degree: 'Executive MBA', field: 'International Business', years: 2, cost: 140_000, smarts: 6, skillId: SK.diplomacy },
  { degree: 'PhD', field: 'Artificial Intelligence', years: 5, cost: 60_000, smarts: 10, skillId: SK.ai },
  { degree: "Juris Doctor", field: 'Advanced Law', years: 3, cost: 85_000, smarts: 8, skillId: SK.law },
  { degree: 'Diploma', field: 'Foreign Languages', years: 1, cost: 10_000, smarts: 3, skillId: SK.foreignLanguages },
  { degree: "Bachelor's", field: 'Marketing', years: 3, cost: 22_000, smarts: 6, skillId: SK.marketing },
  { degree: "Bachelor's", field: 'Psychology', years: 3, cost: 23_000, smarts: 6, skillId: SK.persuasion },
  { degree: "Bachelor's", field: 'Environmental Science', years: 4, cost: 32_000, smarts: 7, skillId: SK.research },
  { degree: 'Master\'s', field: 'Finance', years: 2, cost: 55_000, smarts: 6, skillId: SK.investing },
  { degree: 'Master\'s', field: 'Public Policy', years: 2, cost: 45_000, smarts: 6, skillId: SK.policy },
  { degree: 'Master\'s', field: 'Data Science', years: 2, cost: 50_000, smarts: 7, skillId: SK.ai },
  { degree: 'Vocational Certificate', field: 'Aviation', years: 2, cost: 45_000, smarts: 4, skillId: SK.aerospace },
  { degree: 'Vocational Certificate', field: 'Electrical Trades', years: 2, cost: 18_000, smarts: 3, skillId: SK.construction },
  { degree: 'PhD', field: 'Biotechnology', years: 5, cost: 65_000, smarts: 10, skillId: SK.biotech },
  { degree: 'Doctorate', field: 'Public Health', years: 5, cost: 55_000, smarts: 9, skillId: SK.medicine },
];

/** Enrolling rolls for a merit scholarship (smarts-driven) that cuts tuition for the whole
 * programme — a real, one-time-per-enrollment break, not guaranteed. */
export function enroll(state: GameState, index: number): ActionResult {
  const p = state.player;
  const d = DEGREES[index];
  if (!d) return { ok: false, message: 'Unknown programme.' };
  if (p.studying) return { ok: false, message: 'You are already studying.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const rng = withRng(state);
  const scholarshipChance = clamp(0.1 + Math.max(0, p.smarts - 60) * 0.01, 0.05, 0.6);
  const scholarship = rng.chance(scholarshipChance);
  const costPerYear = Math.round((d.cost / d.years) * (scholarship ? rng.range(0.5, 0.75) : 1));
  commit(state, rng);
  p.studying = { degree: d.degree, field: d.field, skillId: d.skillId, yearsLeft: d.years, totalYears: d.years, costPerYear };
  p.smarts = clamp100(p.smarts + d.smarts);
  log(state, `Enrolled in a ${d.degree} in ${d.field}.${scholarship ? ' Awarded a merit scholarship.' : ''}`, 'info');
  return {
    ok: true,
    message: scholarship
      ? `Enrolled with a scholarship! ${d.years} years at $${costPerYear.toLocaleString()}/yr.`
      : `Enrolled. ${d.years} years at $${costPerYear.toLocaleString()}/yr.`,
  };
}

/** Withdraw early — the further along you are, the more it costs your reputation and happiness;
 * no tuition refund. Real consequence for a real choice, not a free undo. */
export function dropOutOfSchool(state: GameState): ActionResult {
  const p = state.player;
  if (!p.studying) return { ok: false, message: 'You are not enrolled in anything.' };
  const progress = 1 - p.studying.yearsLeft / p.studying.totalYears;
  const happinessHit = Math.round(4 + progress * 10);
  const reputationHit = Math.round(2 + progress * 6);
  const { degree, field } = p.studying;
  p.happiness = clamp100(p.happiness - happinessHit);
  p.reputation = clamp100(p.reputation - reputationHit);
  p.studying = null;
  log(state, `Dropped out of the ${degree} in ${field}.`, 'bad');
  return { ok: true, message: `Withdrew from your studies. Happiness -${happinessHit}, reputation -${reputationHit}.` };
}

/** Job openings generated from home-country industries, scaled by the player. */
export function jobOpenings(state: GameState): { title: string; industryId: string; salary: number; requiredSmarts: number; track: 'corporate' | 'public' | 'media' | 'crime' }[] {
  const p = state.player;
  const rng = new RNG(state.seed ^ (state.year * 2654435761));
  const eduBonus = p.education.length * 0.25 + (p.education.some((e) => e.degree === 'MBA' || e.degree === 'Doctorate') ? 0.4 : 0);
  const out: { title: string; industryId: string; salary: number; requiredSmarts: number; track: 'corporate' | 'public' | 'media' | 'crime' }[] = [];
  const pool = rng.shuffle(INDUSTRIES).slice(0, 8);
  for (const ind of pool) {
    const seniority = clamp(0.3 + (p.skills[ind.skillId] ?? 0) / 120 + eduBonus, 0.3, 2.5);
    const base = 38_000 + ind.startupCost / 50_000 * 1000;
    const salary = Math.round(base * seniority * (1 + (p.smarts - 50) / 200));
    const titles = ['Analyst', 'Associate', 'Manager', 'Director', 'Specialist', 'Consultant', 'Lead'];
    const track: 'corporate' | 'media' = ind.tags.includes('media') ? 'media' : 'corporate';
    out.push({
      title: `${ind.sector} ${rng.pick(titles)}`,
      industryId: ind.id,
      salary,
      requiredSmarts: Math.round(30 + ind.techIntensity * 40),
      track,
    });
  }
  // Public-sector entry role
  out.push({ title: 'Political Staffer', industryId: 'services_law_firm', salary: 52_000, requiredSmarts: 40, track: 'public' });
  return out;
}

function makeCoworker(state: GameState, rng: RNG, role: 'manager' | 'peer', tag: string): Coworker {
  return {
    id: `cw_${state.year}_${tag}`,
    name: makePersonName(rng, rng.chance(0.5) ? 'male' : 'female'),
    role,
    personality: rng.pick(COWORKER_PERSONALITIES).id,
    rapport: Math.round(rng.range(role === 'manager' ? 40 : 35, role === 'manager' ? 60 : 65)),
    memory: [],
  };
}

/** A real hiring process: reference/background check, an interview score from your
 * skills/charisma/reputation, and an optional salary negotiation with real upside and
 * a small risk of blowing up the offer. Replaces a flat always-succeeds "Apply". */
export function takeJob(state: GameState, opening: { title: string; industryId: string; salary: number; requiredSmarts: number; track: string }, negotiate = false): ActionResult {
  const p = state.player;
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  if (p.smarts < opening.requiredSmarts) return { ok: false, message: `Requires ${opening.requiredSmarts}+ smarts.` };
  const rng = withRng(state);
  const ind = INDUSTRY_BY_ID[opening.industryId];
  const skillLvl = ind ? (p.skills[ind.skillId] ?? 0) : 0;

  // Reference/background check: a firing in the last few years dents your odds.
  const yearsSinceFired = p.lastFiredYear === null ? 99 : state.year - p.lastFiredYear;
  const referencePenalty = yearsSinceFired < 3 ? (3 - yearsSinceFired) * 0.1 : 0;

  const interviewScore = clamp100(
    30 + (p.smarts - 30) * 0.3 + skillLvl * 0.25 + (p.charisma - 30) * 0.15 + (p.reputation - 30) * 0.1 + rng.range(-12, 12),
  );
  const passChance = clamp(0.4 + interviewScore / 160 - referencePenalty, 0.05, 0.92);
  if (!rng.chance(passChance)) {
    commit(state, rng);
    const reason = referencePenalty > 0.15
      ? 'A reference check flagged concerns from your last role.'
      : rng.pick(['They went with another candidate.', "They passed after the behavioral round — not quite the fit they needed.", 'Strong field this round; no offer.']);
    log(state, `Interview for ${opening.title} didn't land: ${reason}`, 'bad');
    return { ok: false, message: reason };
  }

  let salary = opening.salary;
  if (negotiate) {
    const negChance = clamp(0.3 + (p.charisma - 30) * 0.01 + skillLvl * 0.003, 0.1, 0.85);
    if (rng.chance(negChance)) {
      const bump = rng.range(0.05, 0.18);
      salary = Math.round(salary * (1 + bump));
    } else if (rng.chance(0.15)) {
      commit(state, rng);
      log(state, `${opening.title} offer rescinded after a hard negotiating push.`, 'bad');
      return { ok: false, message: 'You pushed too hard in negotiations and the offer was pulled.' };
    }
  }

  const employerName = makeCompanyName(rng, ind?.sector ?? 'default');
  const coworkers = [makeCoworker(state, rng, 'manager', 'm')];
  const peerCount = rng.chance(0.5) ? 2 : 1;
  for (let i = 0; i < peerCount; i++) coworkers.push(makeCoworker(state, rng, 'peer', `p${i}`));

  p.job = {
    title: opening.title,
    industryId: opening.industryId,
    employerId: null,
    employerName,
    salary,
    performance: 55,
    yearsInRole: 0,
    yearsAtCompany: 0,
    track: opening.track as 'corporate' | 'public' | 'media' | 'crime' | 'none',
    rank: 'junior',
    stress: 20,
    reliability: 70,
    workStyle: 'standard',
    coworkers,
  };
  p.unemployedYears = 0;
  commit(state, rng);
  log(state, `Started a new job: ${titleForRank(opening.title, 'junior')} at ${employerName} ($${salary.toLocaleString()}/yr).`, 'good');
  return { ok: true, message: `Hired as ${titleForRank(opening.title, 'junior')}${negotiate && salary !== opening.salary ? ` — negotiated up to $${salary.toLocaleString()}` : ''}.` };
}

export function quitJob(state: GameState): ActionResult {
  if (!state.player.job) return { ok: false, message: 'You have no job.' };
  log(state, `You quit your job as ${titleForRank(state.player.job.title, state.player.job.rank)}.`, 'info');
  state.player.job = null;
  return { ok: true, message: 'You quit your job.' };
}

/** Player-initiated push up the career ladder — separate from (and better odds
 * than) the small passive promotion chance rolled each year. */
export function applyForPromotion(state: GameState): ActionResult {
  const p = state.player;
  if (!p.job) return { ok: false, message: 'You need a job first.' };
  const idx = rankIndex(p.job.rank);
  if (idx >= CAREER_LADDER.length - 1) return { ok: false, message: 'Already at the top of the ladder.' };
  const current = CAREER_LADDER[idx];
  const next = CAREER_LADDER[idx + 1];
  if (p.job.yearsInRole < current.minYearsToPromote) {
    return { ok: false, message: `Needs ${current.minYearsToPromote}+ year(s) in your current rank first.` };
  }
  if (p.job.performance < current.minPerformanceToPromote) {
    return { ok: false, message: `Performance needs to be ${current.minPerformanceToPromote}+ (currently ${Math.round(p.job.performance)}).` };
  }
  const rng = withRng(state);
  const manager = p.job.coworkers.find((c) => c.role === 'manager');
  const managerBonus = manager ? (manager.rapport - 50) * 0.006 : 0;
  const chance = clamp(0.4 + (p.job.performance - current.minPerformanceToPromote) * 0.01 + managerBonus, 0.1, 0.9);
  const success = rng.chance(chance);
  commit(state, rng);
  if (!success) {
    p.job.stress = clamp100(p.job.stress + 5);
    log(state, `Passed over for promotion to ${titleForRank(p.job.title, next.id)}.`, 'bad');
    return { ok: false, message: 'Passed over this time — try again once your case is stronger.' };
  }
  p.job.rank = next.id;
  p.job.yearsInRole = 0;
  p.job.salary = Math.round(p.job.salary * (next.salaryMult / current.salaryMult));
  p.reputation = clamp100(p.reputation + 3);
  if (next.id === 'executive' && !state.achievements.includes('corner_office')) state.achievements.push('corner_office');
  log(state, `Promoted! You are now ${titleForRank(p.job.title, next.id)} earning $${p.job.salary.toLocaleString()}.`, 'good');
  return { ok: true, message: `Promoted to ${titleForRank(p.job.title, next.id)}.` };
}

export function networkWithCoworker(state: GameState, coworkerId: string): ActionResult {
  const p = state.player;
  if (!p.job) return { ok: false, message: 'You have no job.' };
  const cw = p.job.coworkers.find((c) => c.id === coworkerId);
  if (!cw) return { ok: false, message: 'Coworker not found.' };
  if (onCooldown(state, `network_cw_${coworkerId}`)) return { ok: false, message: `Already caught up with ${cw.name} this year — try again next year.` };
  setCooldown(state, `network_cw_${coworkerId}`);
  const rng = withRng(state);
  const personality = COWORKER_PERSONALITY_BY_ID[cw.personality];
  const gain = rng.range(4, 10) * personality.rapportGainMult;
  cw.rapport = clamp100(cw.rapport + gain);
  p.happiness = clamp100(p.happiness + 1);
  pushMemory(cw, `Made an effort to connect, ${state.year}.`);
  commit(state, rng);
  return { ok: true, message: `Rapport with ${cw.name} is now ${Math.round(cw.rapport)}.` };
}

/** Reporting a genuinely toxic/political coworker is more likely to be upheld; crying
 * wolf on a friendly one risks your own standing and their rapport with you. */
export function reportToHR(state: GameState, coworkerId: string): ActionResult {
  const p = state.player;
  if (!p.job) return { ok: false, message: 'You have no job.' };
  const cw = p.job.coworkers.find((c) => c.id === coworkerId);
  if (!cw) return { ok: false, message: 'Coworker not found.' };
  const rng = withRng(state);
  const justified = cw.personality === 'toxic' || cw.personality === 'political';
  const upheld = rng.chance(justified ? 0.65 : 0.25);
  if (upheld) {
    const wasManager = cw.role === 'manager';
    p.job.coworkers = p.job.coworkers.filter((c) => c.id !== coworkerId);
    if (wasManager) p.job.coworkers.push(makeCoworker(state, rng, 'manager', `m${state.year}`));
    p.job.stress = clamp100(p.job.stress - 15);
    commit(state, rng);
    log(state, `HR upheld your complaint about ${cw.name}.`, 'good');
    return { ok: true, message: `HR upheld it — ${cw.name} was moved out${wasManager ? ' and a new manager was assigned' : ''}.` };
  }
  p.job.performance = clamp100(p.job.performance - 5);
  p.job.stress = clamp100(p.job.stress + 8);
  cw.rapport = clamp100(cw.rapport - 20);
  pushMemory(cw, `Was reported to HR by ${p.name} over an unfounded complaint, ${state.year}.`);
  commit(state, rng);
  log(state, `HR found no wrongdoing in your complaint about ${cw.name}.`, 'bad');
  return { ok: false, message: `HR found no wrongdoing — it's awkward with ${cw.name} now.` };
}

export function setWorkStyle(state: GameState, style: WorkStyle): ActionResult {
  const p = state.player;
  if (!p.job) return { ok: false, message: 'You have no job.' };
  const oldMult = WORK_STYLE_BY_ID[p.job.workStyle].salaryMult;
  const newMult = WORK_STYLE_BY_ID[style].salaryMult;
  p.job.salary = Math.round((p.job.salary / oldMult) * newMult);
  p.job.workStyle = style;
  return { ok: true, message: `Now working ${WORK_STYLE_BY_ID[style].label.toLowerCase()}.` };
}

// ---------------------------------------------------------------------------
// Freelance & gig economy — independent of any formal employer
// ---------------------------------------------------------------------------

export function freelanceGigListings() {
  return FREELANCE_GIGS;
}

export function takeFreelanceGig(state: GameState, gigId: string): ActionResult {
  const p = state.player;
  const gig = FREELANCE_GIG_BY_ID[gigId];
  if (!gig) return { ok: false, message: 'Unknown gig.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  if (onCooldown(state, `gig_${gigId}`)) return { ok: false, message: 'Already took that gig this year — try again next year.' };
  setCooldown(state, `gig_${gigId}`);
  const rng = withRng(state);
  const skillLvl = gig.skillId ? (p.skills[gig.skillId] ?? 0) : 30;
  const successChance = clamp(0.5 + skillLvl / 250 + (p.freelanceReputation - 30) / 200, 0.15, 0.95);
  const success = rng.chance(successChance);
  if (success) {
    const pay = Math.round(gig.basePay * rng.range(0.85, 1.3) * (1 + p.freelanceReputation / 200));
    p.money += pay;
    p.freelanceReputation = clamp100(p.freelanceReputation + rng.range(1, 4));
    p.freelanceGigsCompleted++;
    if (gig.skillId) p.skills[gig.skillId] = clamp100((p.skills[gig.skillId] ?? 0) + rng.range(1, 3));
    commit(state, rng);
    if (p.freelanceGigsCompleted === 1 && !state.achievements.includes('first_gig')) state.achievements.push('first_gig');
    if (p.freelanceGigsCompleted >= 50 && !state.achievements.includes('gig_economy_star')) state.achievements.push('gig_economy_star');
    log(state, `Freelance: ${gig.label} paid $${pay.toLocaleString()}.`, 'money');
    return { ok: true, message: `Earned $${pay.toLocaleString()} from ${gig.label}.` };
  }
  p.freelanceReputation = clamp100(p.freelanceReputation - rng.range(2, 6));
  commit(state, rng);
  log(state, `Freelance gig fell through: ${gig.label}.`, 'bad');
  return { ok: false, message: `The ${gig.label.toLowerCase()} gig fell through — a bad review hurt your freelance standing.` };
}

// ---------------------------------------------------------------------------
// Social media
// ---------------------------------------------------------------------------

export function socialMediaPostStyles() {
  return POST_STYLES;
}

/** Post something. Reach and backlash risk both scale with the chosen style, your
 * socialMedia skill, and how much you already have to lose — the highest-reach styles
 * are also the ones most likely to blow up. Rate-limited to once a year so it can't be
 * spammed for free rolls, mirroring the fix applied to the gov-contract/grant exploit. */
export function postOnSocialMedia(state: GameState, styleId: string): ActionResult {
  const p = state.player;
  if (p.cancelledUntilYear !== null && p.cancelledUntilYear >= state.year) {
    return { ok: false, message: `You're still in the middle of a backlash — lay low until ${p.cancelledUntilYear + 1}.` };
  }
  if (p.lastSocialPostYear === state.year) return { ok: false, message: 'Already posted this year — give it time to breathe.' };
  const style = POST_STYLE_BY_ID[styleId];
  if (!style) return { ok: false, message: 'Unknown post style.' };
  const rng = withRng(state);
  const skillLvl = p.skills[SK.socialMedia] ?? 0;
  const audienceReach = Math.log10(p.socialFollowers + 100) / 2;
  const viralityChance = clamp(style.viralityBase + skillLvl * 0.003 + (p.charisma - 50) * 0.002 + audienceReach * 0.05, 0.03, 0.75);
  const backlashChance = clamp(style.backlashRisk - skillLvl * 0.0025 + (p.reputation < 40 ? 0.05 : 0), 0.01, 0.6);
  p.lastSocialPostYear = state.year;

  const roll = rng.next();
  if (roll < backlashChance) {
    const hit = rng.range(6, 18) * style.reputationSwing;
    p.reputation = clamp100(p.reputation - hit);
    p.popularity = clamp100(p.popularity - hit * 0.7);
    p.socialFollowers = Math.max(0, Math.round(p.socialFollowers * (1 - rng.range(0.1, 0.35))));
    p.cancelledUntilYear = state.year + rng.int(1, 3);
    commit(state, rng);
    log(state, `🔥 Your ${style.label.toLowerCase()} post blew up in the worst way — you're facing a real backlash.`, 'bad');
    return { ok: false, message: `Backlash! Reputation and popularity took a hit, and you're "cancelled" until ${p.cancelledUntilYear}.` };
  }
  if (roll < backlashChance + viralityChance) {
    const gain = Math.round(rng.range(500, 5000) * (1 + p.socialFollowers / 20_000));
    p.socialFollowers += gain;
    const boost = rng.range(2, 6) * style.reputationSwing;
    p.reputation = clamp100(p.reputation + boost * 0.5);
    p.popularity = clamp100(p.popularity + boost * 0.6);
    p.skills[SK.socialMedia] = clamp100((p.skills[SK.socialMedia] ?? 0) + 1);
    commit(state, rng);
    log(state, `🚀 Your ${style.label.toLowerCase()} post went viral! Followers: ${p.socialFollowers.toLocaleString()}.`, 'good');
    if (p.socialFollowers > 100_000 && !state.achievements.includes('viral_star')) state.achievements.push('viral_star');
    return { ok: true, message: `It went viral! +${gain.toLocaleString()} followers.` };
  }
  p.socialFollowers += Math.round(rng.range(5, 60));
  commit(state, rng);
  return { ok: true, message: 'Modest engagement — nothing viral this time.' };
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

export function startCompany(state: GameState, industryId: string, name: string, funding: number): ActionResult {
  const p = state.player;
  const ind = INDUSTRY_BY_ID[industryId];
  if (!ind) return { ok: false, message: 'Unknown industry.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const minFunding = Math.round(ind.startupCost * 0.5);
  if (funding < minFunding) return { ok: false, message: `Needs at least $${minFunding.toLocaleString()} to launch.` };
  if (funding > p.money) return { ok: false, message: 'You cannot afford that.' };
  const rng = withRng(state);
  p.money -= funding;
  const co = createCompany({
    name: name.trim() || makeCompanyName(rng, ind.sector, p.name.split(' ').pop()),
    industry: ind,
    countryId: p.countryId,
    founderId: 'player',
    playerOwned: true,
    capital: funding,
    year: state.year,
  }, rng);
  co.id = nextCompanyId(state);
  state.companies[co.id] = co;
  p.companies.push(co.id);
  p.reputation = clamp100(p.reputation + 2);
  if (!state.achievements.includes('first_company')) state.achievements.push('first_company');
  commit(state, rng);
  log(state, `🚀 Founded ${co.name}, a ${ind.name} company, with $${funding.toLocaleString()} in capital.`, 'business');
  return { ok: true, message: `${co.name} is open for business!` };
}

export function investInCompany(state: GameState, companyId: string, amount: number): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || c.status !== 'active' || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= amount;
  c.cash += amount * 0.4;
  c.assets += amount * 0.6;
  return { ok: true, message: `Invested $${amount.toLocaleString()} into ${c.name}.` };
}

export function withdrawFromCompany(state: GameState, companyId: string, amount: number): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || c.status !== 'active' || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  const available = c.cash * c.playerSharePct;
  if (amount <= 0 || amount > available) return { ok: false, message: `Only $${Math.round(available).toLocaleString()} available to draw.` };
  c.cash -= amount / Math.max(0.01, c.playerSharePct);
  p.money += amount;
  return { ok: true, message: `Drew $${amount.toLocaleString()} from ${c.name}.` };
}

export type CompanyLever = 'marketingPct' | 'rdPct' | 'priceLevel' | 'salaryLevel' | 'dividendPayoutPct' | 'automation' | 'cyberDefense';

export function setCompanyLever(state: GameState, companyId: string, lever: CompanyLever, value: number): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  const bounds: Record<CompanyLever, [number, number]> = {
    marketingPct: [0, 0.25], rdPct: [0, 0.25], priceLevel: [0.7, 1.5], salaryLevel: [0.85, 1.4], dividendPayoutPct: [0, 0.9], automation: [0, 100], cyberDefense: [0, 100],
  };
  const [lo, hi] = bounds[lever];
  if (lever === 'automation' || lever === 'cyberDefense') {
    // Automation/security both cost capital to raise.
    const delta = clamp(value, lo, hi) - c[lever];
    if (delta > 0) {
      const cost = delta * c.revenue * (lever === 'automation' ? 0.01 : 0.006);
      if (cost > c.cash) return { ok: false, message: 'Not enough company cash for that.' };
      c.cash -= cost;
    }
  }
  (c as unknown as Record<CompanyLever, number>)[lever] = clamp(value, lo, hi);
  return { ok: true, message: 'Strategy updated.' };
}

export function takeCompanyPublic(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status !== 'active' || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  if (c.isPublic) return { ok: false, message: 'Already public.' };
  if (c.revenue < 5_000_000) return { ok: false, message: 'Company needs $5m+ revenue to IPO.' };
  const rng = withRng(state);
  const raised = doIPO(c, rng);
  if (!state.achievements.includes('ipo_ceo')) state.achievements.push('ipo_ceo');
  commit(state, rng);
  log(state, `📈 ${c.name} went public, raising $${Math.round(raised).toLocaleString()}. You retain ${Math.round(c.playerSharePct * 100)}%.`, 'business');
  return { ok: true, message: `IPO complete — $${Math.round(raised).toLocaleString()} raised.` };
}

export function sellCompany(state: GameState, companyId: string): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || c.status !== 'active' || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  const value = c.isPublic ? c.sharePrice * c.sharesOutstanding * c.playerSharePct : companyValuation(c) * c.playerSharePct;
  const country = state.countries.find((k) => k.id === p.countryId)!;
  const tax = value * country.economy.taxRates.capitalGains * 0.6;
  p.money += value - tax;
  c.status = 'sold';
  c.playerOwned = false;
  p.companies = p.companies.filter((id) => id !== companyId);
  log(state, `Sold ${c.name} for $${Math.round(value).toLocaleString()} (net of tax).`, 'money');
  return { ok: true, message: `Sold ${c.name} for $${Math.round(value - tax).toLocaleString()}.` };
}

/** Corporate espionage: steal trade secrets from a rival, at real legal risk. */
export function spyOnCompany(state: GameState, targetCompanyId: string): ActionResult {
  const p = state.player;
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned) return { ok: false, message: 'Invalid target.' };
  const cost = Math.round(20_000 + target.revenue * 0.002);
  if (cost > p.money) return { ok: false, message: `Espionage costs $${cost.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= cost;
  const skill = (p.skills[SK.hacking] ?? 0) * 0.6 + (p.skills[SK.streetSmarts] ?? 0) * 0.4;
  const chance = clamp(0.35 + skill * 0.005 - target.cyberDefense * 0.003, 0.05, 0.85);
  const success = rng.chance(chance);
  if (success) {
    const beneficiaries = p.companies
      .map((id) => state.companies[id])
      .filter((co): co is Company => !!co && co.status === 'active' && co.industryId === target.industryId);
    for (const b of beneficiaries) {
      b.quality = clamp100(b.quality + 6);
      b.brand = clamp100(b.brand + 3);
    }
    target.brand = clamp100(target.brand - 5);
    target.quality = clamp100(target.quality - 3);
    p.notoriety = clamp100(p.notoriety + 4);
    commit(state, rng);
    log(state, `🕵️ Corporate espionage against ${target.name} paid off.`, 'business');
    return {
      ok: true,
      message: beneficiaries.length
        ? `Stole trade secrets from ${target.name}.`
        : `Learned about ${target.name}'s operations, but have no company in that industry to use it.`,
    };
  }
  p.notoriety = clamp100(p.notoriety + 8);
  p.reputation = clamp100(p.reputation - 6);
  const founder = target.founderId !== 'player' ? state.npcs[target.founderId] : null;
  if (founder) founder.opinionOfPlayer = clamp(founder.opinionOfPlayer - 40, -100, 100);
  if (rng.chance(0.3)) p.criminalRecord++;
  commit(state, rng);
  log(state, `🚨 Your corporate espionage attempt against ${target.name} was exposed.`, 'bad');
  return { ok: false, message: `Caught red-handed spying on ${target.name}.` };
}

/** Attempt to acquire an NPC-owned public company by outbidding the market. */
export function attemptHostileTakeover(state: GameState, targetCompanyId: string, offerAmount: number): ActionResult {
  const p = state.player;
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned || !target.isPublic) {
    return { ok: false, message: 'Not a valid takeover target.' };
  }
  if (offerAmount > p.money) return { ok: false, message: 'You cannot afford that offer.' };
  const cap = Math.max(1, marketCap(target));
  const ratio = offerAmount / cap;
  if (ratio < 0.6) return { ok: false, message: 'Offer is too low to be taken seriously (needs 60%+ of market cap).' };
  const rng = withRng(state);
  const skill = (p.skills[SK.negotiation] ?? 0) * 0.4 + p.influence * 0.4;
  const chance = clamp(0.1 + (ratio - 1) * 0.6 + skill * 0.003, 0.05, 0.9);
  const success = rng.chance(chance);
  const dueDiligenceFee = offerAmount * 0.05;
  if (!success) {
    p.money -= dueDiligenceFee;
    commit(state, rng);
    log(state, `Your takeover bid for ${target.name} was rebuffed by the board.`, 'bad');
    return { ok: false, message: `${target.name}'s board rejected your bid.` };
  }
  p.money -= offerAmount;
  target.playerOwned = true;
  target.playerSharePct = clamp(0.51 + (ratio - 1) * 0.2, 0.51, 0.95);
  target.founderId = 'player';
  p.companies.push(target.id);
  p.reputation = clamp100(p.reputation + 3);
  p.influence = clamp100(p.influence + 2);
  commit(state, rng);
  log(state, `🏴 Hostile takeover complete: you now control ${target.name}.`, 'business');
  return { ok: true, message: `Acquired ${target.name}!` };
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

export function propertyListings(state: GameState): Omit<PropertyAsset, 'id' | 'purchasePrice' | 'mortgage' | 'insured' | 'yearBuilt' | 'condition' | 'energyEfficiency' | 'maintenanceLevel' | 'lastRenovatedYear'>[] {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const rng = new RNG(state.seed ^ (state.year * 40503));
  const kinds: PropertyAsset['kind'][] = ['apartment', 'house', 'mansion', 'commercial', 'land', 'island', 'penthouse'];
  const basePrices: Record<PropertyAsset['kind'], number> = {
    apartment: 220_000, house: 480_000, mansion: 2_800_000, commercial: 3_500_000, land: 900_000, island: 45_000_000, penthouse: 6_500_000,
  };
  return kinds.map((kind) => {
    const city = rng.pick(home.cities);
    const value = Math.round(basePrices[kind] * city.costOfLiving * (home.economy.housingIndex / 100) * rng.range(0.85, 1.2));
    const rentalYield = kind === 'land' ? 0 : kind === 'commercial' ? rng.range(0.06, 0.09) : kind === 'penthouse' ? rng.range(0.04, 0.07) : rng.range(0.03, 0.06);
    return { name: `${kind[0].toUpperCase()}${kind.slice(1)} in ${city.name}`, kind, cityId: city.id, value, rentalYield, baseRentalYield: rentalYield };
  });
}

export function buyProperty(state: GameState, listing: Omit<PropertyAsset, 'id' | 'purchasePrice' | 'mortgage' | 'insured' | 'yearBuilt' | 'condition' | 'energyEfficiency' | 'maintenanceLevel' | 'lastRenovatedYear'>, useMortgage: boolean): ActionResult {
  const p = state.player;
  const deposit = useMortgage ? listing.value * 0.2 : listing.value;
  if (deposit > p.money) return { ok: false, message: useMortgage ? 'Cannot afford the 20% deposit.' : 'Cannot afford it outright.' };
  const rng = withRng(state);
  p.money -= deposit;
  // Undeveloped land has no structure to age or maintain; built properties get a
  // believable construction age, with condition/efficiency drawn down accordingly.
  const isLand = listing.kind === 'land';
  const age = isLand ? 0 : Math.round(rng.range(0, 45));
  const yearBuilt = state.year - age;
  const condition = isLand ? 100 : clamp100(92 - age * 0.7 + rng.range(-8, 8));
  const energyEfficiency = isLand ? 100 : clamp100(95 - age * 0.9 + rng.range(-8, 8));
  p.properties.push({
    id: `prop_${state.year}_${p.properties.length}`,
    name: listing.name,
    kind: listing.kind,
    cityId: listing.cityId,
    value: listing.value,
    purchasePrice: listing.value,
    rentalYield: listing.rentalYield,
    baseRentalYield: listing.baseRentalYield,
    mortgage: useMortgage ? listing.value * 0.8 : 0,
    insured: false,
    yearBuilt,
    condition,
    energyEfficiency,
    maintenanceLevel: 'standard',
    lastRenovatedYear: null,
  });
  commit(state, rng);
  log(state, `🏠 Bought ${listing.name} for $${listing.value.toLocaleString()}${useMortgage ? ' (mortgaged)' : ''}.`, 'money');
  return { ok: true, message: `Purchased ${listing.name}.` };
}

export function sellProperty(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  const net = prop.value - prop.mortgage;
  p.money += net;
  p.properties = p.properties.filter((x) => x.id !== propertyId);
  log(state, `Sold ${prop.name} for $${Math.round(net).toLocaleString()} (net of mortgage).`, 'money');
  return { ok: true, message: `Sold ${prop.name}.` };
}

export function renovateProperty(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  // Neglected properties need deeper (costlier) work to bring back up to code.
  const neglectSurcharge = Math.max(0, 70 - prop.condition) * 0.0015;
  const cost = Math.round(prop.value * (0.08 + neglectSurcharge));
  if (cost > p.money) return { ok: false, message: `Renovation costs $${cost.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= cost;
  const bump = rng.range(0.1, 0.15);
  prop.value = Math.round(prop.value * (1 + bump));
  if (prop.rentalYield > 0) prop.baseRentalYield = Math.min(0.12, prop.baseRentalYield * 1.1);
  const wasCondemned = prop.condition < 20;
  prop.condition = clamp100(92 + rng.range(-3, 3));
  prop.energyEfficiency = clamp100(prop.energyEfficiency + 20);
  prop.lastRenovatedYear = state.year;
  commit(state, rng);
  if (wasCondemned && !state.achievements.includes('condemned_no_more')) state.achievements.push('condemned_no_more');
  log(state, `Renovated ${prop.name}, boosting its value by ${Math.round(bump * 100)}% and restoring it to like-new condition.`, 'money');
  return { ok: true, message: `${prop.name} renovated.` };
}

export function setMaintenanceLevel(state: GameState, propertyId: string, level: MaintenanceLevel): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  if (prop.kind === 'land') return { ok: false, message: 'Undeveloped land needs no maintenance.' };
  prop.maintenanceLevel = level;
  return { ok: true, message: `${prop.name}: ${level} maintenance.` };
}

export function toggleRentalStatus(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  if (prop.kind === 'land') return { ok: false, message: 'Undeveloped land cannot be rented out.' };
  if (prop.rentalYield > 0) {
    prop.rentalYield = 0;
    return { ok: true, message: `${prop.name} is now for your own use.` };
  }
  prop.rentalYield = prop.baseRentalYield;
  return { ok: true, message: `${prop.name} is now rented out.` };
}

export function togglePropertyInsurance(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  prop.insured = !prop.insured;
  return { ok: true, message: prop.insured ? `${prop.name} is now insured.` : `Cancelled insurance for ${prop.name}.` };
}

// ---------------------------------------------------------------------------
// Financial instruments — bonds, forex speculation, insurance
// ---------------------------------------------------------------------------

export function buyBond(state: GameState, countryId: string, principal: number, years: number): ActionResult {
  const p = state.player;
  const country = state.countries.find((c) => c.id === countryId);
  if (!country) return { ok: false, message: 'Unknown country.' };
  if (principal <= 0 || principal > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= principal;
  const rate = country.economy.interestRate + 0.01;
  p.bonds.push({ id: `bond_${state.year}_${p.bonds.length}`, countryId, principal, rate, yearsLeft: years });
  if (!state.achievements.includes('bond_investor')) state.achievements.push('bond_investor');
  log(state, `Bought a $${principal.toLocaleString()} ${country.name} government bond at ${(rate * 100).toFixed(1)}% over ${years} years.`, 'money');
  return { ok: true, message: `Bond purchased at ${(rate * 100).toFixed(1)}%.` };
}

export function sellBondEarly(state: GameState, bondId: string): ActionResult {
  const p = state.player;
  const bond = p.bonds.find((b) => b.id === bondId);
  if (!bond) return { ok: false, message: 'Bond not found.' };
  const penalty = bond.principal * 0.08;
  p.money += bond.principal - penalty;
  p.bonds = p.bonds.filter((b) => b.id !== bondId);
  return { ok: true, message: `Redeemed early for $${Math.round(bond.principal - penalty).toLocaleString()} (8% early-exit penalty).` };
}

export function openForexPosition(state: GameState, countryId: string, notional: number, short: boolean): ActionResult {
  const p = state.player;
  const country = state.countries.find((c) => c.id === countryId);
  if (!country) return { ok: false, message: 'Unknown country.' };
  if (notional <= 0 || notional > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= notional;
  p.forexPositions.push({
    id: `fx_${state.year}_${p.forexPositions.length}`,
    countryId,
    notional,
    entryRate: country.economy.exchangeRate,
    short,
  });
  if (!state.achievements.includes('forex_trader')) state.achievements.push('forex_trader');
  log(state, `Opened a ${short ? 'short' : 'long'} $${notional.toLocaleString()} forex position on the ${country.currency}.`, 'money');
  return { ok: true, message: `Forex position opened.` };
}

export function closeForexPosition(state: GameState, positionId: string): ActionResult {
  const p = state.player;
  const pos = p.forexPositions.find((f) => f.id === positionId);
  if (!pos) return { ok: false, message: 'Position not found.' };
  const country = state.countries.find((c) => c.id === pos.countryId);
  const currentRate = country?.economy.exchangeRate ?? pos.entryRate;
  const ratio = currentRate / pos.entryRate;
  const payout = pos.short ? pos.notional * (2 - ratio) : pos.notional * ratio;
  p.money += Math.max(0, payout);
  p.forexPositions = p.forexPositions.filter((f) => f.id !== positionId);
  const pl = payout - pos.notional;
  log(state, `Closed forex position for $${Math.round(Math.max(0, payout)).toLocaleString()} (${pl >= 0 ? '+' : ''}$${Math.round(pl).toLocaleString()}).`, pl >= 0 ? 'money' : 'bad');
  return { ok: true, message: `Position closed.` };
}

export function toggleCompanyInsurance(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  c.insured = !c.insured;
  return { ok: true, message: c.insured ? `${c.name} is now insured.` : `Cancelled insurance for ${c.name}.` };
}

// ---------------------------------------------------------------------------
// Business mechanics: brand deals, training, supply chain, quality, recalls
// ---------------------------------------------------------------------------

export function hireBrandAmbassador(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(20_000, c.revenue * 0.03);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  const rng = withRng(state);
  c.cash -= cost;
  if (rng.chance(0.75)) {
    c.brand = clamp100(c.brand + rng.range(6, 12));
    commit(state, rng);
    log(state, `${c.name} signed a brand ambassador deal. Brand awareness jumped.`, 'business');
    return { ok: true, message: 'The ambassador deal is a hit.' };
  }
  c.brand = clamp100(c.brand - rng.range(2, 5));
  commit(state, rng);
  log(state, `${c.name}'s new brand ambassador caused a minor controversy.`, 'bad');
  return { ok: false, message: 'The ambassador caused a stir. Brand took a small hit.' };
}

export function runTrainingProgram(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(10_000, c.revenue * 0.015);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.managerQuality = clamp100(c.managerQuality + 6);
  c.morale = clamp100(c.morale + 8);
  log(state, `${c.name} ran an employee training program.`, 'business');
  return { ok: true, message: 'Training complete. Morale and management quality improved.' };
}

export function diversifySupplyChain(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(15_000, c.revenue * 0.02);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  if (c.supplyChainResilience >= 95) return { ok: false, message: 'Supply chain is already highly diversified.' };
  c.cash -= cost;
  c.supplyChainResilience = clamp100(c.supplyChainResilience + 15);
  log(state, `${c.name} diversified its supply chain, reducing commodity-price exposure.`, 'business');
  return { ok: true, message: 'Supply chain diversified.' };
}

export function qualityAudit(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(8_000, c.revenue * 0.01);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.quality = clamp100(c.quality + 5);
  c.customerSatisfaction = clamp100(c.customerSatisfaction + 5);
  log(state, `${c.name} completed a quality control audit.`, 'business');
  return { ok: true, message: 'Quality audit complete.' };
}

export function proactiveRecall(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(30_000, c.revenue * 0.04);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.quality = clamp100(c.quality + 8);
  c.customerSatisfaction = clamp100(c.customerSatisfaction + 4);
  if (c.lawsuits > 0) c.lawsuits--;
  log(state, `${c.name} issued a proactive product recall ahead of any complaints.`, 'business');
  return { ok: true, message: 'Recall handled proactively — customers noticed the diligence.' };
}

// ---------------------------------------------------------------------------
// Corporate HQ tiers & culture
// ---------------------------------------------------------------------------

export const HQ_TIERS = [
  { tier: 0, name: 'Basic Office', blurb: 'A modest office suite. No special perks.' },
  { tier: 1, name: 'Campus', blurb: 'A dedicated campus — modest morale and brand lift.' },
  { tier: 2, name: 'Tower', blurb: 'A signature tower — strong morale, management and brand lift.' },
  { tier: 3, name: 'Megacomplex', blurb: 'A flagship megacomplex — the strongest morale, management and brand lift money can buy.' },
] as const;

export const CULTURE_INFO: Record<Company['culture'], { label: string; blurb: string }> = {
  traditional: { label: 'Traditional', blurb: 'Faster management growth, steadier morale, higher overhead.' },
  flexible: { label: 'Flexible', blurb: 'A balanced, no-drawback default.' },
  remote: { label: 'Remote-First', blurb: 'Lower overhead, but morale swings harder year to year.' },
  startup: { label: 'Startup', blurb: 'R&D hits harder, but morale is volatile and overhead runs lean.' },
};

export function upgradeHQ(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.hqTier >= 3) return { ok: false, message: 'Already at the top HQ tier.' };
  const cost = (c.hqTier + 1) * Math.max(50_000, c.revenue * 0.25);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.hqTier++;
  const tierName = HQ_TIERS[c.hqTier].name;
  if (c.hqTier >= 3 && !state.achievements.includes('hq_megacomplex')) state.achievements.push('hq_megacomplex');
  log(state, `${c.name} moved into a new ${tierName} HQ.`, 'business');
  return { ok: true, message: `Upgraded to ${tierName}.` };
}

export function setCompanyCulture(state: GameState, companyId: string, culture: Company['culture']): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.culture === culture) return { ok: false, message: 'That is already the culture.' };
  const cost = Math.max(5_000, c.revenue * 0.005);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} to restructure.` };
  c.cash -= cost;
  c.culture = culture;
  log(state, `${c.name} adopted a ${CULTURE_INFO[culture].label.toLowerCase()} workplace culture.`, 'business');
  return { ok: true, message: `Culture set to ${CULTURE_INFO[culture].label}.` };
}

export function runGraduateProgram(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(35_000, c.revenue * 0.04);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.managerQuality = clamp100(c.managerQuality + 12);
  c.quality = clamp100(c.quality + 4);
  log(state, `${c.name} launched a graduate development program.`, 'business');
  return { ok: true, message: 'Graduate program complete. Management and quality improved.' };
}

export function runLeadershipProgram(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(80_000, c.revenue * 0.08);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.managerQuality = clamp100(c.managerQuality + 20);
  c.morale = clamp100(c.morale + 12);
  c.brand = clamp100(c.brand + 5);
  log(state, `${c.name} ran an executive leadership program.`, 'business');
  return { ok: true, message: 'Leadership program complete. Management, morale and brand all improved.' };
}

// ---------------------------------------------------------------------------
// Corporate structure: executives, bonds, buybacks, spin-offs
// ---------------------------------------------------------------------------

const EXEC_TITLES: Record<ExecutiveRole, string> = { cfo: 'CFO', coo: 'COO', cmo: 'CMO' };

export function hireExecutive(state: GameState, companyId: string, role: ExecutiveRole): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.executives.some((e) => e.role === role)) return { ok: false, message: `${c.name} already has a ${EXEC_TITLES[role]}.` };
  const salary = Math.max(80_000, c.revenue * 0.01);
  const signOnBonus = salary * 0.5;
  if (signOnBonus > c.cash) return { ok: false, message: `Needs $${Math.round(signOnBonus).toLocaleString()} in company cash for the sign-on bonus.` };
  const rng = withRng(state);
  c.cash -= signOnBonus;
  const exec: Executive = { role, name: makePersonName(rng, rng.chance(0.5) ? 'male' : 'female'), skill: rng.range(45, 90), salary };
  c.executives.push(exec);
  commit(state, rng);
  log(state, `${c.name} hired ${exec.name} as ${EXEC_TITLES[role]}.`, 'business');
  return { ok: true, message: `${exec.name} joins as ${EXEC_TITLES[role]}.` };
}

export function fireExecutive(state: GameState, companyId: string, role: ExecutiveRole): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const exec = c.executives.find((e) => e.role === role);
  if (!exec) return { ok: false, message: `No ${EXEC_TITLES[role]} to let go.` };
  c.executives = c.executives.filter((e) => e.role !== role);
  log(state, `${exec.name} departed as ${EXEC_TITLES[role]} of ${c.name}.`, 'business');
  return { ok: true, message: `${exec.name} has left the company.` };
}

export function issueCorporateBond(state: GameState, companyId: string, amount: number, termYears: number): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.bondDebt > 0) return { ok: false, message: 'Repay the existing corporate bond before issuing another.' };
  if (amount <= 0 || amount > c.assets * 2 + c.revenue) return { ok: false, message: 'Bond amount is too large relative to the company\'s size.' };
  const country = state.countries.find((k) => k.id === c.countryId)!;
  const riskSpread = clamp((c.debt + c.bondDebt) / Math.max(1, c.assets), 0, 1) * 0.03;
  const rate = country.economy.interestRate + 0.02 + riskSpread;
  c.cash += amount;
  c.bondDebt = amount;
  c.bondRate = rate;
  c.bondYearsLeft = clamp(termYears, 2, 10);
  log(state, `${c.name} issued a $${Math.round(amount).toLocaleString()} corporate bond at ${(rate * 100).toFixed(1)}%.`, 'business');
  return { ok: true, message: `Bond issued: $${Math.round(amount).toLocaleString()} at ${(rate * 100).toFixed(1)}%.` };
}

export function buybackShares(state: GameState, companyId: string, amount: number): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || !c.isPublic || c.status !== 'active') return { ok: false, message: 'Only public companies you control can buy back shares.' };
  if (amount <= 0 || amount > c.cash) return { ok: false, message: `Needs $${Math.round(amount).toLocaleString()} in company cash.` };
  const cap = Math.max(1, marketCap(c));
  const sharesRetired = amount / c.sharePrice;
  if (sharesRetired >= c.sharesOutstanding * 0.5) return { ok: false, message: 'Cannot retire more than half of shares outstanding at once.' };
  c.cash -= amount;
  c.sharesOutstanding -= sharesRetired;
  c.playerSharePct = clamp(c.playerSharePct * (c.sharesOutstanding + sharesRetired) / c.sharesOutstanding, 0, 1);
  c.sharePrice = c.sharePrice * (1 + clamp(amount / cap, 0, 0.3) * 0.5);
  log(state, `${c.name} bought back $${Math.round(amount).toLocaleString()} of its own shares.`, 'business');
  return { ok: true, message: `Retired ${Math.round(sharesRetired).toLocaleString()} shares.` };
}

export function spinOffCompany(state: GameState, companyId: string): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.revenue < 5_000_000) return { ok: false, message: 'The company needs at least $5M in revenue to support a spin-off.' };
  const ind = INDUSTRY_BY_ID[c.industryId];
  const rng = withRng(state);
  const spinFraction = 0.4;
  const newId = nextCompanyId(state);
  const spin = createCompany(
    { name: `${c.name} Ventures`, industry: ind, countryId: c.countryId, founderId: 'player', playerOwned: true, capital: c.assets * spinFraction, year: state.year },
    rng,
  );
  spin.id = newId;
  spin.revenue = c.revenue * spinFraction;
  spin.employees = Math.round(c.employees * spinFraction);
  spin.cash = c.cash * spinFraction * 0.5;
  spin.brand = c.brand * 0.7;
  spin.quality = c.quality;
  spin.playerSharePct = 0.7;
  state.companies[newId] = spin;
  p.companies.push(newId);

  c.revenue *= 1 - spinFraction;
  c.assets *= 1 - spinFraction;
  c.employees = Math.round(c.employees * (1 - spinFraction));
  c.cash -= spin.cash;

  commit(state, rng);
  log(state, `${c.name} spun off a new entity, ${spin.name}, retaining a 70% stake.`, 'business');
  return { ok: true, message: `${spin.name} spun off successfully.` };
}

export function fileTrademark(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.trademarks >= 5) return { ok: false, message: 'Already holds the maximum useful trademarks.' };
  const cost = Math.max(5_000, c.revenue * 0.003);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.trademarks++;
  c.brand = clamp100(c.brand + 1);
  if (c.trademarks >= 5 && !state.achievements.includes('trademark_portfolio')) state.achievements.push('trademark_portfolio');
  log(state, `${c.name} filed a new trademark.`, 'business');
  return { ok: true, message: `Trademark filed for ${c.name}.` };
}

// ---------------------------------------------------------------------------
// V7: Corporate/economic depth — recruitment, incubator/VC, franchising, loyalty
// ---------------------------------------------------------------------------

export function runRecruitmentDrive(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const country = state.countries.find((k) => k.id === c.countryId)!;
  const cost = Math.max(15_000, c.revenue * 0.02) * (1 + Math.max(0, country.laborMarketTightness - 50) * 0.01);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash — talent is expensive in this market.` };
  const rng = withRng(state);
  c.cash -= cost;
  const chance = clamp(0.75 - Math.max(0, country.laborMarketTightness - 50) * 0.006, 0.35, 0.9);
  const success = rng.chance(chance);
  commit(state, rng);
  if (success) {
    c.managerQuality = clamp100(c.managerQuality + 8);
    c.morale = clamp100(c.morale + 4);
    log(state, `${c.name} won a competitive recruitment drive against rival employers.`, 'business');
    return { ok: true, message: 'Recruitment drive succeeded. Management quality and morale up.' };
  }
  log(state, `${c.name}'s recruitment drive lost top candidates to rival offers.`, 'bad');
  return { ok: false, message: 'Rivals out-bid you for the best candidates.' };
}

/** Invest in a small private NPC-owned company for an equity stake — a lightweight VC/incubator mechanic. */
export function investInStartup(state: GameState, targetCompanyId: string, amount: number): ActionResult {
  const p = state.player;
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned || target.isPublic) return { ok: false, message: 'Invalid startup target.' };
  if (target.revenue > 3_000_000) return { ok: false, message: 'Too large to be a startup investment — try a hostile takeover instead once public.' };
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Not enough cash.' };
  const value = companyValuation(target);
  const stake = clamp(amount / Math.max(1, value + amount), 0.02, 0.4);
  p.money -= amount;
  target.cash += amount;
  target.playerSharePct = stake;
  target.playerOwned = true;
  p.companies.push(target.id);
  log(state, `Invested $${Math.round(amount).toLocaleString()} in startup ${target.name} for a ${(stake * 100).toFixed(1)}% stake.`, 'business');
  if (!state.achievements.includes('startup_investor')) state.achievements.push('startup_investor');
  return { ok: true, message: `Acquired a ${(stake * 100).toFixed(1)}% stake in ${target.name}.` };
}

export function franchiseCompany(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.brand < 55) return { ok: false, message: 'Needs at least 55 brand strength to attract franchisees.' };
  const cost = Math.max(20_000, c.revenue * 0.05);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  const rng = withRng(state);
  c.cash -= cost;
  const chance = clamp(0.4 + (c.brand - 55) * 0.01, 0.2, 0.85);
  const success = rng.chance(chance);
  commit(state, rng);
  if (success) {
    c.franchiseCount++;
    log(state, `${c.name} opened a new franchised location (${c.franchiseCount} total).`, 'business');
    return { ok: true, message: `New franchise opened. ${c.franchiseCount} location(s) now paying royalties.` };
  }
  log(state, `${c.name} failed to attract a franchisee this round.`, 'bad');
  return { ok: false, message: 'No franchisee signed on this time.' };
}

export function launchLoyaltyProgram(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.loyaltyProgram) return { ok: false, message: 'Already running a loyalty program.' };
  const cost = Math.max(10_000, c.revenue * 0.015);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.loyaltyProgram = true;
  c.customerSatisfaction = clamp100(c.customerSatisfaction + 5);
  log(state, `${c.name} launched a customer loyalty/membership program.`, 'business');
  return { ok: true, message: 'Loyalty program launched.' };
}

export function investInRetailSecurity(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const ind = INDUSTRY_BY_ID[c.industryId];
  if (!ind.tags.includes('retail')) return { ok: false, message: 'Only retail businesses face meaningful shrinkage.' };
  if (c.securityInvested) return { ok: false, message: 'Loss-prevention is already in place.' };
  const cost = Math.max(8_000, c.revenue * 0.01);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.securityInvested = true;
  log(state, `${c.name} installed CCTV and loss-prevention staff to cut down on shrinkage.`, 'business');
  return { ok: true, message: 'Security investment made. Shrinkage eliminated at an ongoing cost.' };
}

/** Present quarterly-style earnings and take analyst questions; can move the share price either way. */
export function holdInvestorConference(state: GameState, companyId: string): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || !c.isPublic || c.status !== 'active') return { ok: false, message: 'Only public companies you control hold investor conferences.' };
  const rng = withRng(state);
  const skill = (p.skills[SK.negotiation] ?? 0) + (p.skills[SK.publicSpeaking] ?? 0);
  const fundamentals = clamp((c.profit / Math.max(1, c.revenue)) * 2, -0.3, 0.3);
  const chance = clamp(0.45 + skill * 0.003 + fundamentals, 0.15, 0.85);
  const wentWell = rng.chance(chance);
  const move = wentWell ? rng.range(0.02, 0.08) : -rng.range(0.02, 0.08);
  c.sharePrice = Math.max(0.01, c.sharePrice * (1 + move));
  c.brand = clamp100(c.brand + (wentWell ? 2 : -2));
  commit(state, rng);
  log(state, wentWell
    ? `📊 ${c.name}'s investor conference impressed analysts; shares moved ${(move * 100).toFixed(1)}%.`
    : `📊 ${c.name}'s investor conference raised tough questions; shares fell ${(-move * 100).toFixed(1)}%.`, 'business');
  return { ok: true, message: wentWell ? `Shares up ${(move * 100).toFixed(1)}%.` : `Shares down ${(-move * 100).toFixed(1)}%.` };
}

/** Push for a breakthrough patent ahead of industry rivals. */
export function raceForInnovation(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const country = state.countries.find((k) => k.id === c.countryId)!;
  const cost = Math.max(40_000, c.revenue * 0.08);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  const rng = withRng(state);
  c.cash -= cost;
  const chance = clamp(0.3 + c.rdPct * 1.8 + (country.researchLevel / 100) * 0.25, 0.1, 0.75);
  const won = rng.chance(chance);
  const rivals = Object.values(state.companies).filter(
    (r) => r.status === 'active' && r.id !== c.id && r.industryId === c.industryId && r.countryId === c.countryId,
  );
  const rival = rivals.length ? rng.pick(rivals) : null;
  commit(state, rng);
  if (won) {
    c.patents++;
    c.quality = clamp100(c.quality + 5);
    c.brand = clamp100(c.brand + 4);
    if (!state.achievements.includes('innovation_leader')) state.achievements.push('innovation_leader');
    log(state, `🔬 ${c.name} won the innovation race, filing a breakthrough patent first.`, 'business');
    return { ok: true, message: 'You won the innovation race! Patent filed.' };
  }
  c.brand = clamp100(c.brand - 2);
  log(state, rival
    ? `🔬 ${rival.name} beat ${c.name} to the breakthrough patent.`
    : `🔬 ${c.name}'s R&D push didn't pan out before a rival got there first.`, 'bad');
  return { ok: false, message: rival ? `${rival.name} won the race instead.` : 'A rival got there first.' };
}

/** Read-only: an AI consultant's best-guess strategic tip based on current company fundamentals. */
export function consultantRecommendation(company: { cash: number; morale: number; brand: number; quality: number; debt: number; revenue: number; customerSatisfaction: number; loyaltyProgram: boolean; securityInvested: boolean }, industryTags: string[]): string {
  if (company.morale < 40) return 'Morale is low — a training program or leadership initiative could stabilize your workforce before it hurts output.';
  if (company.debt > company.revenue * 0.6) return 'Debt is high relative to revenue — consider paying it down or issuing equity instead of more debt.';
  if (company.brand < 40) return 'Brand awareness is weak — a brand ambassador deal or marketing push would help you compete on more than price.';
  if (company.quality < 40) return 'Product quality is lagging — a quality audit could catch issues before they become a recall.';
  if (company.customerSatisfaction < 45 && !company.loyaltyProgram) return 'Customer satisfaction is soft — a loyalty program tends to pay for itself in retention.';
  if (industryTags.includes('retail') && !company.securityInvested) return 'This is a retail business without loss-prevention — shrinkage is quietly eating into your margin.';
  if (company.cash > company.revenue * 0.4) return 'You are sitting on a lot of idle cash — consider a buyback, a bond paydown, or reinvesting in growth.';
  return 'Fundamentals look solid. Consider an investor conference to build market confidence, or push for the next innovation.';
}

/** A political extension of the existing celebrity/brand-ambassador system: courting a
 * celebrity endorsement for an active campaign instead of a company. */
export function seekCelebrityEndorsement(state: GameState): ActionResult {
  const p = state.player;
  if (!p.campaign) return { ok: false, message: 'You need an active campaign to seek an endorsement.' };
  const cost = 30_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  const celeb = Object.values(state.npcs).find((n) => n.alive && n.countryId === p.countryId && n.role === 'celebrity');
  if (!celeb) return { ok: false, message: 'No notable celebrities in your country right now.' };
  const rng = withRng(state);
  p.money -= cost;
  const chance = clamp(0.5 + (p.reputation - 50) * 0.004 + celeb.opinionOfPlayer * 0.002, 0.15, 0.9);
  const success = rng.chance(chance);
  if (success) {
    const gain = rng.range(4, 9);
    p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
    p.popularity = clamp100(p.popularity + 2);
    if (!state.achievements.includes('celebrity_backed')) state.achievements.push('celebrity_backed');
    commit(state, rng);
    log(state, `⭐ ${celeb.name} publicly endorsed your campaign.`, 'politics');
    return { ok: true, message: `${celeb.name} endorsed you! Momentum +${gain.toFixed(0)}.` };
  }
  p.campaign.momentum = clamp(p.campaign.momentum - 3, -50, 50);
  commit(state, rng);
  log(state, `${celeb.name} declined to endorse you — and said so publicly.`, 'bad');
  return { ok: false, message: `${celeb.name} publicly turned you down.` };
}

export function buyLifeInsurance(state: GameState, monthlyPremium: number): ActionResult {
  const p = state.player;
  if (p.lifeInsurance) return { ok: false, message: 'You already have a life insurance policy.' };
  if (monthlyPremium <= 0 || monthlyPremium * 12 > p.money) return { ok: false, message: 'Cannot afford the first year of premiums.' };
  p.lifeInsurance = { monthlyPremium, payout: monthlyPremium * 12 * 20 };
  log(state, `Took out a life insurance policy: $${monthlyPremium.toLocaleString()}/month for a $${(monthlyPremium * 240).toLocaleString()} payout.`, 'money');
  return { ok: true, message: 'Life insurance policy active.' };
}

export function cancelLifeInsurance(state: GameState): ActionResult {
  const p = state.player;
  if (!p.lifeInsurance) return { ok: false, message: 'No active policy.' };
  p.lifeInsurance = null;
  return { ok: true, message: 'Life insurance cancelled.' };
}

// ---------------------------------------------------------------------------
// Politics
// ---------------------------------------------------------------------------

export function joinParty(state: GameState, partyId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const party = home.parties.find((x) => x.id === partyId);
  if (!party) return { ok: false, message: 'Party not found.' };
  p.partyId = partyId;
  p.influence = clamp100(p.influence + 2);
  log(state, `Joined the ${party.name}.`, 'politics');
  return { ok: true, message: `You are now a member of the ${party.name}.` };
}

export function leaveParty(state: GameState): ActionResult {
  const p = state.player;
  if (!p.partyId) return { ok: false, message: 'You are not in a party.' };
  p.partyId = null;
  return { ok: true, message: 'You left your party.' };
}

export function foundParty(state: GameState, name: string, ideology: number): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if (home.totalSeats === 0) return { ok: false, message: `${home.name} has no free legislature to contest.` };
  if (p.influence < 25) return { ok: false, message: 'Founding a party needs 25+ influence.' };
  if (p.money < 250_000) return { ok: false, message: 'Founding a party costs $250,000.' };
  const rng = withRng(state);
  p.money -= 250_000;
  const party = {
    id: `party_player_${state.year}`,
    name: name.trim() || makePartyName(rng),
    ideology: clamp(ideology, -100, 100),
    seats: 0,
    support: 5 + p.popularity * 0.1,
    leaderId: 'player',
    playerCreated: true,
  };
  home.parties.push(party);
  // Renormalize support.
  const total = home.parties.reduce((s, x) => s + x.support, 0);
  for (const x of home.parties) x.support = (x.support / total) * 100;
  p.partyId = party.id;
  commit(state, rng);
  if (!state.achievements.includes('founded_party')) state.achievements.push('founded_party');
  log(state, `🏛️ Founded the ${party.name} and became its leader.`, 'politics');
  return { ok: true, message: `The ${party.name} is born.` };
}

export function availableOffices(state: GameState) {
  return OFFICE_LADDER_WITH_ELIGIBILITY(state);
}
function OFFICE_LADDER_WITH_ELIGIBILITY(state: GameState) {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  return Object.values(OFFICE_SPEC_BY_KIND).map((spec) => {
    const elig = eligibleFor(state, spec);
    const region = spec.kind === 'mayor' || spec.kind === 'councillor'
      ? home.cities.find((c) => c.id === p.cityId)?.name ?? home.name
      : spec.kind === 'governor'
        ? home.states.find((s) => s.cityIds.includes(p.cityId))?.name ?? home.name
        : home.name;
    const cost = Math.round(spec.campaignCostBase * (1 + home.economy.gdp / 5000));
    return { spec, eligible: elig.ok, reason: elig.reason, region, cost };
  });
}

export function launchCampaign(state: GameState, officeKind: OfficeKind, warChest: number, promises: ManifestoPromise[] = []): ActionResult {
  const p = state.player;
  if (p.campaign) return { ok: false, message: 'You are already campaigning.' };
  const spec = OFFICE_SPEC_BY_KIND[officeKind];
  const elig = eligibleFor(state, spec);
  if (!elig.ok) return { ok: false, message: elig.reason };
  if (warChest > p.money) return { ok: false, message: 'You cannot fund that war chest.' };
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const region = spec.kind === 'mayor' || spec.kind === 'councillor'
    ? home.cities.find((c) => c.id === p.cityId)?.name ?? home.name
    : spec.kind === 'governor'
      ? home.states.find((s) => s.cityIds.includes(p.cityId))?.name ?? home.name
      : home.name;
  p.money -= warChest;
  p.campaign = {
    officeKind,
    regionName: region,
    warChest,
    momentum: 0,
    yearsToElection: officeKind === 'head_of_state' || officeKind === 'governor' ? 1 : 0,
    consultantHired: false,
    promises: promises.slice(0, 3),
  };
  log(state, `📣 Launched a campaign for ${spec.title} of ${region} with a $${warChest.toLocaleString()} war chest.`, 'politics');
  return { ok: true, message: `Campaign for ${spec.title} underway.` };
}

/** Discretionary campaign activities that spend money/PC for momentum. */
export function campaignAction(state: GameState, kind: 'ads' | 'rally' | 'doorknock' | 'fundraise' | 'consultant' | 'polling' | 'debate'): ActionResult {
  const p = state.player;
  if (!p.campaign) return { ok: false, message: 'No active campaign.' };
  if (onCooldown(state, `campaign_${kind}`)) return { ok: false, message: 'Already did that this year — try again next year.' };
  const rng = withRng(state);
  const boost = p.campaign.consultantHired ? 1.25 : 1;
  let msg = '';
  switch (kind) {
    case 'ads': {
      const cost = 50_000;
      if (p.money < cost) return { ok: false, message: 'Not enough for an ad blitz.' };
      p.money -= cost;
      const gain = (3 + (p.skills['media_public_relations'] ?? 0) * 0.05 + rng.range(0, 3)) * boost;
      p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
      msg = `Ran attack ads. Momentum +${gain.toFixed(0)}.`;
      break;
    }
    case 'rally': {
      const gain = (2 + p.charisma * 0.05 + (p.skills['politics_public_speaking'] ?? 0) * 0.04 + rng.range(-1, 3)) * boost;
      p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
      p.health = clamp100(p.health - 1);
      msg = `Held a rally. Momentum +${gain.toFixed(0)}.`;
      break;
    }
    case 'doorknock': {
      const gain = (1.5 + (p.skills['politics_grassroots_organizing'] ?? 0) * 0.04 + rng.range(-0.5, 2)) * boost;
      p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
      p.popularity = clamp100(p.popularity + 0.5);
      msg = `Knocked on doors. Momentum +${gain.toFixed(1)}, popularity nudged up.`;
      break;
    }
    case 'fundraise': {
      const raised = 20_000 + p.influence * 4_000 + (p.skills['business_fundraising'] ?? 0) * 2_000 * rng.range(0.5, 1.5);
      p.campaign.warChest += raised;
      msg = `Fundraiser brought in $${Math.round(raised).toLocaleString()}.`;
      break;
    }
    case 'consultant': {
      const cost = 100_000;
      if (p.campaign.consultantHired) return { ok: false, message: 'You already have a campaign consultant.' };
      if (p.money < cost) return { ok: false, message: 'Cannot afford a top consultant ($100,000).' };
      p.money -= cost;
      p.campaign.consultantHired = true;
      msg = 'Hired a top campaign consultant. All future momentum gains +25%.';
      break;
    }
    case 'polling': {
      const cost = 15_000;
      if (p.money < cost) return { ok: false, message: 'Not enough for a polling firm.' };
      p.money -= cost;
      const chance = campaignWinChance(state, rng);
      msg = `Internal polling puts you at ${Math.round(chance * 100)}% to win.`;
      break;
    }
    case 'debate': {
      const skill = (p.skills[SK.debate] ?? 0) * 0.7 + p.charisma * 0.3;
      const chance = clamp(0.4 + skill * 0.004, 0.1, 0.85);
      const success = rng.chance(chance);
      const swing = (4 + rng.range(0, 4)) * boost;
      if (success) {
        p.campaign.momentum = clamp(p.campaign.momentum + swing, -50, 50);
        if (!state.achievements.includes('debate_winner')) state.achievements.push('debate_winner');
        setCooldown(state, `campaign_${kind}`);
        commit(state, rng);
        return { ok: true, message: `You won the debate. Momentum +${swing.toFixed(0)}.` };
      }
      p.campaign.momentum = clamp(p.campaign.momentum - swing * 0.6, -50, 50);
      setCooldown(state, `campaign_${kind}`);
      commit(state, rng);
      return { ok: false, message: `Your opponent won the exchange. Momentum -${(swing * 0.6).toFixed(0)}.` };
    }
  }
  setCooldown(state, `campaign_${kind}`);
  commit(state, rng);
  return { ok: true, message: msg };
}

/** A stump-speech-adjacent action for anyone campaigning or in office; can backfire. */
export function holdPressConference(state: GameState): ActionResult {
  const p = state.player;
  if (!p.office && !p.campaign) return { ok: false, message: 'You need to hold office or be campaigning to call a press conference.' };
  const rng = withRng(state);
  const skill = (p.skills[SK.debate] ?? 0) * 0.5 + (p.skills['media_public_relations'] ?? 0) * 0.5;
  const chance = clamp(0.5 + skill * 0.004 + (p.charisma - 50) * 0.003, 0.15, 0.9);
  const success = rng.chance(chance);
  if (success) {
    const gain = rng.range(2, 5);
    p.popularity = clamp100(p.popularity + gain);
    if (p.campaign) p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
    commit(state, rng);
    log(state, '🎤 Your press conference landed well with the media.', 'politics');
    return { ok: true, message: 'Press conference was a hit.' };
  }
  const loss = rng.range(1, 4);
  p.popularity = clamp100(p.popularity - loss);
  if (p.campaign) p.campaign.momentum = clamp(p.campaign.momentum - loss, -50, 50);
  commit(state, rng);
  log(state, '📰 A reporter caught you off guard at your press conference.', 'bad');
  return { ok: false, message: 'The press conference went sideways.' };
}

export function proposedLaws(state: GameState) {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const canLegislate = home.leaderId === 'player' || p.office?.kind === 'minister' || p.office?.kind === 'legislator' || p.office?.kind === 'head_of_state';
  return Object.values(LAW_BY_ID).map((law) => {
    const inForce = home.lawsInForce.includes(law.id);
    const est = estimateLawVote(state, home, law);
    return { law, inForce, chance: est.chance, canLegislate };
  });
}

export function proposeLaw(state: GameState, lawId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const law = LAW_BY_ID[lawId];
  if (!law) return { ok: false, message: 'Unknown law.' };
  const isAutocrat = (home.system === 'dictatorship' || home.system === 'monarchy') && home.leaderId === 'player';
  const canLegislate = isAutocrat || home.leaderId === 'player' || p.office?.kind === 'minister' || p.office?.kind === 'legislator' || p.office?.kind === 'head_of_state';
  if (!canLegislate) return { ok: false, message: 'You need a seat in government to propose laws.' };
  if (home.lawsInForce.includes(lawId)) return { ok: false, message: 'Already in force.' };
  if (p.politicalCapital < 5) return { ok: false, message: 'Needs at least 5 political capital.' };
  const rng = withRng(state);
  p.politicalCapital = clamp(p.politicalCapital - 5, 0, 100);

  if (isAutocrat) {
    home.lawsInForce.push(lawId);
    home.approvalOfGovernment = clamp100(home.approvalOfGovernment + law.approvalImpact);
    commit(state, rng);
    log(state, `⚖️ You decreed the ${law.name}.`, 'politics');
    return { ok: true, message: `Decreed: ${law.name}.` };
  }

  const est = estimateLawVote(state, home, law);
  const passed = rng.chance(est.chance);
  commit(state, rng);
  if (passed) {
    home.lawsInForce.push(lawId);
    home.approvalOfGovernment = clamp100(home.approvalOfGovernment + law.approvalImpact);
    p.popularity = clamp100(p.popularity + law.approvalImpact * 0.4);
    p.influence = clamp100(p.influence + 2);
    log(state, `⚖️ Your ${law.name} passed the legislature (${est.supportSeats}/${est.totalSeats}).`, 'politics');
    return { ok: true, message: `${law.name} passed!` };
  }
  log(state, `Your ${law.name} was voted down (${est.supportSeats}/${est.totalSeats}).`, 'bad');
  return { ok: false, message: `${law.name} failed to pass.` };
}

export function repealLaw(state: GameState, lawId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const law = LAW_BY_ID[lawId];
  if (!law || !home.lawsInForce.includes(lawId)) return { ok: false, message: 'Law is not in force.' };
  if (!law.repealable) return { ok: false, message: 'This law cannot be repealed.' };
  const isAutocrat = (home.system === 'dictatorship' || home.system === 'monarchy') && home.leaderId === 'player';
  const canLegislate = isAutocrat || home.leaderId === 'player' || p.office?.kind === 'minister' || p.office?.kind === 'head_of_state';
  if (!canLegislate) return { ok: false, message: 'You lack the power to repeal laws.' };
  if (p.politicalCapital < 5) return { ok: false, message: 'Needs at least 5 political capital.' };
  p.politicalCapital = clamp(p.politicalCapital - 5, 0, 100);
  home.lawsInForce = home.lawsInForce.filter((id) => id !== lawId);
  log(state, `Repealed the ${law.name}.`, 'politics');
  return { ok: true, message: `${law.name} repealed.` };
}

/** NPC politicians in the player's home country, eligible for cabinet appointment. */
export function cabinetCandidates(state: GameState) {
  const p = state.player;
  return Object.values(state.npcs).filter((n) => n.alive && n.countryId === p.countryId && n.role === 'politician');
}

export function appointMinister(state: GameState, portfolio: CabinetPortfolio, npcId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if (home.leaderId !== 'player') return { ok: false, message: 'Only the head of state appoints ministers.' };
  if (!CABINET_PORTFOLIOS.includes(portfolio)) return { ok: false, message: 'Unknown portfolio.' };
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive) return { ok: false, message: 'Candidate unavailable.' };
  home.cabinet[portfolio] = npcId;
  log(state, `Appointed ${npc.name} as Minister for ${portfolio}.`, 'politics');
  return { ok: true, message: `${npc.name} appointed Minister for ${portfolio}.` };
}

export function dismissMinister(state: GameState, portfolio: CabinetPortfolio): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if (home.leaderId !== 'player') return { ok: false, message: 'Only the head of state reshuffles cabinet.' };
  if (!home.cabinet[portfolio]) return { ok: false, message: 'That portfolio is vacant.' };
  const name = state.npcs[home.cabinet[portfolio]]?.name ?? 'The minister';
  delete home.cabinet[portfolio];
  log(state, `${name} was dismissed from the cabinet.`, 'politics');
  return { ok: true, message: `${name} dismissed.` };
}

export function negotiateCoalition(state: GameState, partnerPartyId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if (home.totalSeats === 0) return { ok: false, message: 'No legislature to form a coalition in.' };
  if (!p.partyId) return { ok: false, message: 'Join or found a party first.' };
  const myParty = home.parties.find((x) => x.id === p.partyId);
  if (!myParty) return { ok: false, message: 'Party not found.' };
  if (myParty.seats / home.totalSeats >= 0.5) return { ok: false, message: 'Your party already holds a majority.' };
  const partner = home.parties.find((x) => x.id === partnerPartyId);
  if (!partner || partner.id === p.partyId) return { ok: false, message: 'Invalid coalition partner.' };
  if (p.politicalCapital < 10) return { ok: false, message: 'Needs at least 10 political capital.' };
  p.politicalCapital = clamp(p.politicalCapital - 10, 0, 100);
  home.coalitionPartnerId = partnerPartyId;
  if (!state.achievements.includes('coalition_builder')) state.achievements.push('coalition_builder');
  log(state, `🤝 Formed a governing coalition with the ${partner.name}.`, 'politics');
  return { ok: true, message: `Coalition formed with the ${partner.name}.` };
}

// ---------------------------------------------------------------------------
// Diplomacy — only actionable while the player leads their home country
// ---------------------------------------------------------------------------

function requireLeadership(state: GameState): { home: ReturnType<typeof homeOf>; error: ActionResult | null } {
  const home = homeOf(state);
  if (home.leaderId !== 'player') return { home, error: { ok: false, message: 'Only the head of state can conduct foreign policy.' } };
  return { home, error: null };
}
function homeOf(state: GameState) {
  return state.countries.find((c) => c.id === state.player.countryId)!;
}

export function declareWar(state: GameState, targetCountryId: string, strategy: 'blockade' | 'invasion' = 'invasion'): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  if (home.atWarWith.includes(target.id)) return { ok: false, message: `Already at war with ${target.name}.` };
  home.atWarWith.push(target.id);
  target.atWarWith.push(home.id);
  home.warStrategies[target.id] = strategy;
  home.relations[target.id] = -100;
  target.relations[home.id] = -100;
  home.stability = clamp(home.stability - (strategy === 'invasion' ? 8 : 3), 0, 100);
  if (!state.achievements.includes('diplomat')) state.achievements.push('diplomat');
  const label = strategy === 'blockade' ? 'an economic blockade' : 'a full invasion';
  log(state, `⚔️ You declared war on ${target.name} with ${label}.`, 'politics');
  logHistory(state, `⚔️ WAR: ${home.name} declares war on ${target.name} (${strategy})`);
  return { ok: true, message: `War declared on ${target.name} (${strategy}).` };
}

export function signPeaceTreaty(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || !home.atWarWith.includes(target.id)) return { ok: false, message: 'You are not at war with that nation.' };
  home.atWarWith = home.atWarWith.filter((id) => id !== target.id);
  target.atWarWith = target.atWarWith.filter((id) => id !== home.id);
  delete home.warStrategies[target.id];
  home.relations[target.id] = -20;
  target.relations[home.id] = -20;
  home.stability = clamp(home.stability + 4, 0, 100);
  state.player.popularity = clamp100(state.player.popularity + 5);
  if (!state.achievements.includes('diplomat')) state.achievements.push('diplomat');
  log(state, `🕊️ You signed a peace treaty with ${target.name}.`, 'politics');
  logHistory(state, `🕊️ Peace: ${home.name} and ${target.name} sign an armistice`);
  return { ok: true, message: `Peace signed with ${target.name}.` };
}

export function imposeSanctions(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  if (home.sanctionsOn.includes(target.id)) return { ok: false, message: `Already sanctioning ${target.name}.` };
  home.sanctionsOn.push(target.id);
  home.relations[target.id] = clamp((home.relations[target.id] ?? 0) - 30, -100, 100);
  target.economy.businessConfidence = clamp100(target.economy.businessConfidence - 6);
  log(state, `🚫 You imposed sanctions on ${target.name}.`, 'politics');
  return { ok: true, message: `Sanctions imposed on ${target.name}.` };
}

export function liftSanctions(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (!home.sanctionsOn.includes(targetCountryId)) return { ok: false, message: 'No sanctions in place on that nation.' };
  home.sanctionsOn = home.sanctionsOn.filter((id) => id !== targetCountryId);
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (target) home.relations[target.id] = clamp((home.relations[target.id] ?? 0) + 15, -100, 100);
  log(state, `Sanctions on ${target?.name ?? 'the nation'} were lifted.`, 'politics');
  return { ok: true, message: 'Sanctions lifted.' };
}

export function sendForeignAid(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const p = state.player;
  if (p.politicalCapital < 10) return { ok: false, message: 'Needs at least 10 political capital.' };
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  p.politicalCapital = clamp(p.politicalCapital - 10, 0, 100);
  home.economy.budgetBalance = clamp(home.economy.budgetBalance - 0.002, -0.2, 0.1);
  home.relations[target.id] = clamp((home.relations[target.id] ?? 0) + 15, -100, 100);
  target.relations[home.id] = clamp((target.relations[home.id] ?? 0) + 20, -100, 100);
  target.economy.consumerConfidence = clamp100(target.economy.consumerConfidence + 3);
  if (!state.achievements.includes('diplomat')) state.achievements.push('diplomat');
  log(state, `🤲 You sent foreign aid to ${target.name}.`, 'politics');
  return { ok: true, message: `Aid sent to ${target.name}.` };
}

export function signTradeAgreement(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const p = state.player;
  if (p.politicalCapital < 10) return { ok: false, message: 'Needs at least 10 political capital.' };
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  p.politicalCapital = clamp(p.politicalCapital - 10, 0, 100);
  home.relations[target.id] = clamp((home.relations[target.id] ?? 0) + 20, -100, 100);
  target.relations[home.id] = clamp((target.relations[home.id] ?? 0) + 20, -100, 100);
  home.economy.businessConfidence = clamp100(home.economy.businessConfidence + 3);
  target.economy.businessConfidence = clamp100(target.economy.businessConfidence + 3);
  if (!state.achievements.includes('diplomat')) state.achievements.push('diplomat');
  log(state, `🤝 You signed a trade agreement with ${target.name}.`, 'politics');
  return { ok: true, message: `Trade agreement signed with ${target.name}.` };
}

// ---------------------------------------------------------------------------
// Government & economy tools — head-of-state powers
// ---------------------------------------------------------------------------

export function setBudgetAllocation(state: GameState, portfolio: CabinetPortfolio, sharePct: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = clamp(sharePct, 2, 60);
  const others = CABINET_PORTFOLIOS.filter((p) => p !== portfolio);
  const otherTotal = others.reduce((s, p) => s + home.budgetAllocations[p], 0);
  const remaining = 100 - target;
  home.budgetAllocations[portfolio] = target;
  if (otherTotal > 0) {
    for (const p of others) home.budgetAllocations[p] = (home.budgetAllocations[p] / otherTotal) * remaining;
  }
  log(state, `Adjusted the ${portfolio} budget allocation to ${target.toFixed(1)}%.`, 'politics');
  return { ok: true, message: `${portfolio} now receives ${target.toFixed(1)}% of the budget.` };
}

export function setTaxRate(state: GameState, tax: keyof TaxRates, ratePct: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const rate = clamp(ratePct / 100, 0, 0.7);
  const current = home.economy.taxRates[tax];
  const existingAdj = home.taxAdjustments[tax] ?? 0;
  home.taxAdjustments[tax] = clamp(existingAdj + (rate - current), -0.35, 0.35);
  log(state, `Set the direct ${tax} tax rate target to ${Math.round(rate * 100)}%.`, 'politics');
  return { ok: true, message: `${tax} tax rate target set to ${Math.round(rate * 100)}%.` };
}

export function setImmigrationQuota(state: GameState, quotaPct: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  home.immigrationQuota = clamp(quotaPct, 0, 100);
  log(state, `Set the national immigration quota to ${Math.round(home.immigrationQuota)}%.`, 'politics');
  return { ok: true, message: `Immigration quota set to ${Math.round(home.immigrationQuota)}%.` };
}

const INFRA_SPECS: Record<InfrastructureKind, { capitalCost: number; budgetHit: number; years: number }> = {
  roads: { capitalCost: 15, budgetHit: 0.01, years: 2 },
  rail: { capitalCost: 20, budgetHit: 0.015, years: 3 },
  airport: { capitalCost: 25, budgetHit: 0.02, years: 3 },
  power: { capitalCost: 18, budgetHit: 0.012, years: 2 },
  internet: { capitalCost: 15, budgetHit: 0.01, years: 2 },
  space_program: { capitalCost: 60, budgetHit: 0.05, years: 8 },
  bridge: { capitalCost: 22, budgetHit: 0.015, years: 3 },
  tunnel: { capitalCost: 28, budgetHit: 0.02, years: 4 },
  bullet_train: { capitalCost: 45, budgetHit: 0.035, years: 6 },
  stadium: { capitalCost: 20, budgetHit: 0.012, years: 2 },
  dam: { capitalCost: 35, budgetHit: 0.025, years: 5 },
};

export function launchInfrastructureProject(state: GameState, kind: InfrastructureKind): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (home.infrastructureProjects.some((p) => p.kind === kind)) return { ok: false, message: `A ${kind} project is already underway.` };
  const spec = INFRA_SPECS[kind];
  const p = state.player;
  if (p.politicalCapital < spec.capitalCost) return { ok: false, message: `Needs ${spec.capitalCost} political capital.` };
  p.politicalCapital = clamp(p.politicalCapital - spec.capitalCost, 0, 100);
  home.economy.budgetBalance = clamp(home.economy.budgetBalance - spec.budgetHit, -0.2, 0.1);
  home.infrastructureProjects.push({ id: `infra-${home.id}-${kind}-${state.year}`, kind, yearsLeft: spec.years, totalYears: spec.years });
  log(state, `🏗️ ${home.name} broke ground on a new ${kind} project.`, 'politics');
  return { ok: true, message: `${kind} project underway, ${spec.years} year(s) to completion.` };
}

/** The national treasury issues government bonds to fund spending; the yield reflects investor
 * confidence (rate rises as business confidence falls), and it raises the debt-to-GDP ratio. */
export function issueGovernmentBonds(state: GameState, amountPctOfGdp: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = clamp(amountPctOfGdp, 1, 20);
  const yieldPct = home.economy.interestRate + Math.max(0, (60 - home.economy.businessConfidence) * 0.0015);
  home.economy.govDebtToGdp = clamp(home.economy.govDebtToGdp + target / 100, 0, 4);
  home.economy.budgetBalance = clamp(home.economy.budgetBalance + (target / 100) * 0.7, -0.3, 0.1);
  log(state, `🏦 Issued government bonds worth ${target.toFixed(1)}% of GDP at an estimated ${(yieldPct * 100).toFixed(1)}% yield.`, 'politics');
  return { ok: true, message: `Bonds issued at ~${(yieldPct * 100).toFixed(1)}% yield.` };
}

export function fundNationalCyberDefense(state: GameState, amount: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (amount <= 0 || amount > state.player.money) return { ok: false, message: 'Invalid funding amount.' };
  state.player.money -= amount;
  home.cyberDefense = clamp100(home.cyberDefense + amount / 25_000);
  log(state, `Invested $${amount.toLocaleString()} in national cyber defense.`, 'politics');
  return { ok: true, message: `National cyber defense now ${Math.round(home.cyberDefense)}.` };
}

/** Direct investment in military readiness — training, logistics, and supply, distinct from
 * the raw militaryPower score. This is what actually determines war performance, casualty rates
 * and how quickly exhaustion builds if the country ends up fighting. */
export function investInMilitaryReadiness(state: GameState, amount: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (amount <= 0 || amount > state.player.money) return { ok: false, message: 'Invalid funding amount.' };
  state.player.money -= amount;
  home.militaryReadiness = clamp100(home.militaryReadiness + amount / 30_000);
  home.militaryPower = clamp100(home.militaryPower + amount / 80_000);
  log(state, `Invested $${amount.toLocaleString()} in military readiness.`, 'politics');
  return { ok: true, message: `Military readiness now ${Math.round(home.militaryReadiness)}.` };
}

const ADVISOR_COST = 50_000;

export function hireAdvisor(state: GameState, specialty: AdvisorSpecialty): ActionResult {
  const p = state.player;
  if (p.advisors.length >= 3) return { ok: false, message: 'You already have 3 advisors.' };
  if (p.advisors.some((a) => a.specialty === specialty)) return { ok: false, message: `Already have a ${specialty} advisor.` };
  if (p.money < ADVISOR_COST) return { ok: false, message: `Needs $${ADVISOR_COST.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= ADVISOR_COST;
  const accuracy = rng.range(45, 90);
  p.advisors.push({ specialty, accuracy });
  if (p.advisors.length >= 3 && !state.achievements.includes('advisor_team')) state.achievements.push('advisor_team');
  commit(state, rng);
  log(state, `Hired a ${specialty} advisor.`, 'politics');
  return { ok: true, message: `Advisor hired (self-reported ${Math.round(accuracy)}% reliable — take it with a grain of salt).` };
}

export function dismissAdvisor(state: GameState, specialty: AdvisorSpecialty): ActionResult {
  const p = state.player;
  if (!p.advisors.some((a) => a.specialty === specialty)) return { ok: false, message: 'No such advisor.' };
  p.advisors = p.advisors.filter((a) => a.specialty !== specialty);
  return { ok: true, message: 'Advisor dismissed.' };
}

/** A pure, non-mutating recommendation string — deliberately can be wrong, scaled by the advisor's accuracy. */
export function advisorRecommendation(state: GameState, advisor: Advisor): string {
  const home = state.countries.find((c) => c.id === state.player.countryId);
  if (!home) return 'No data available.';
  const roll = (state.year * 7 + Math.round(advisor.accuracy) * 3) % 100;
  const isGood = roll < advisor.accuracy;
  if (advisor.specialty === 'economy') {
    const overheating = home.economy.inflation > 0.045;
    const trueAdvice = overheating
      ? 'Inflation is running hot — raise taxes or trim spending to cool demand.'
      : 'Growth looks fragile — cut taxes or fund infrastructure to stimulate demand.';
    const falseAdvice = overheating
      ? 'Cut taxes now to keep growth strong.'
      : 'Raise taxes — the economy is overheating.';
    return isGood ? trueAdvice : falseAdvice;
  }
  if (advisor.specialty === 'military') {
    const atWar = home.atWarWith.length > 0;
    const trueAdvice = atWar
      ? 'Seek a peace treaty — prolonged war is eroding stability.'
      : 'Military spending looks adequate — hold steady.';
    const falseAdvice = atWar ? 'Escalate the conflict — victory is within reach.' : 'Boost defense spending — a threat looms.';
    return isGood ? trueAdvice : falseAdvice;
  }
  const isolated = Object.values(home.relations).every((r) => r < 10);
  const trueAdvice = isolated
    ? 'Relations are cold across the board — a trade agreement could thaw things.'
    : 'Diplomatic standing looks solid — maintain current relationships.';
  const falseAdvice = isolated ? 'Consider sanctions to project strength.' : 'Relations are fraying — brace for conflict.';
  return isGood ? trueAdvice : falseAdvice;
}

export function fundIntelligenceAgency(state: GameState, amount: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (amount <= 0 || amount > state.player.money) return { ok: false, message: 'Invalid funding amount.' };
  state.player.money -= amount;
  home.intelCapability = clamp100(home.intelCapability + amount / 50_000);
  log(state, `Invested $${amount.toLocaleString()} in the national intelligence agency.`, 'politics');
  return { ok: true, message: `Intelligence capability now ${Math.round(home.intelCapability)}.` };
}

export function gatherIntelligence(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  const rng = withRng(state);
  const chance = clamp(0.3 + home.intelCapability / 200 - target.intelCapability / 300, 0.1, 0.9);
  const success = rng.chance(chance);
  commit(state, rng);
  if (success) {
    home.relations[target.id] = clamp((home.relations[target.id] ?? 0) + 5, -100, 100);
    state.player.influence = clamp100(state.player.influence + 3);
    if (!state.achievements.includes('intel_operative')) state.achievements.push('intel_operative');
    log(state, `🕵️ Intelligence gathered on ${target.name} strengthened your negotiating position.`, 'politics');
    return { ok: true, message: `Intelligence operation against ${target.name} succeeded.` };
  }
  home.relations[target.id] = clamp((home.relations[target.id] ?? 0) - 10, -100, 100);
  log(state, `🚨 An intelligence operation against ${target.name} was exposed.`, 'bad');
  return { ok: false, message: `The operation against ${target.name} was exposed.` };
}

export function counterEspionage(state: GameState): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const cost = 20_000;
  if (state.player.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  state.player.money -= cost;
  home.stability = clamp100(home.stability + 3);
  home.intelCapability = clamp100(home.intelCapability + 5);
  log(state, `Counter-espionage sweep strengthened national security.`, 'politics');
  return { ok: true, message: 'Counter-espionage operation complete.' };
}

export function nominateChiefJustice(state: GameState, npcId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive || npc.countryId !== home.id) return { ok: false, message: 'Invalid nominee.' };
  home.chiefJusticeId = npcId;
  home.judicialIntegrity = clamp100(home.judicialIntegrity * 0.4 + npc.integrity * 0.6);
  log(state, `${npc.name} was confirmed as Chief Justice of ${home.name}.`, 'politics');
  return { ok: true, message: `${npc.name} confirmed as Chief Justice.` };
}

export function callReferendum(state: GameState, lawId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const p = state.player;
  const law = LAW_BY_ID[lawId];
  if (!law) return { ok: false, message: 'Unknown law.' };
  if (home.lawsInForce.includes(law.id)) return { ok: false, message: `${law.name} is already in force.` };
  if (p.politicalCapital < 15) return { ok: false, message: 'Needs at least 15 political capital.' };
  p.politicalCapital = clamp(p.politicalCapital - 15, 0, 100);
  const legislatureEst = estimateLawVote(state, home, law);
  const chance = clamp((legislatureEst.chance + home.approvalOfGovernment / 100) / 2, 0.05, 0.95);
  const rng = withRng(state);
  const passed = rng.chance(chance);
  commit(state, rng);
  if (passed) {
    home.lawsInForce.push(law.id);
    log(state, `🗳️ The referendum on the ${law.name} passed.`, 'politics');
    return { ok: true, message: `Referendum passed: ${law.name} is now in force.` };
  }
  state.player.popularity = clamp100(state.player.popularity - 2);
  log(state, `🗳️ The referendum on the ${law.name} failed at the ballot box.`, 'bad');
  return { ok: false, message: `Referendum failed: ${law.name} was rejected.` };
}

export function hireLobbyingFirm(state: GameState): ActionResult {
  const p = state.player;
  if (p.lobbyingFirmHired) return { ok: false, message: 'You already retain a lobbying firm.' };
  const cost = 75_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  p.lobbyingFirmHired = true;
  log(state, `Retained a lobbying firm ($25k/yr upkeep) to sway legislative votes.`, 'politics');
  return { ok: true, message: 'Lobbying firm retained.' };
}

export function cancelLobbyingFirm(state: GameState): ActionResult {
  const p = state.player;
  if (!p.lobbyingFirmHired) return { ok: false, message: 'No lobbying firm retained.' };
  p.lobbyingFirmHired = false;
  log(state, `Cancelled the lobbying firm retainer.`, 'politics');
  return { ok: true, message: 'Lobbying firm retainer cancelled.' };
}

export function foundAlliance(state: GameState, name: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (home.allianceId) return { ok: false, message: `${home.name} already belongs to an alliance.` };
  const id = `alliance_${state.year}_${state.alliances.length + 1}`;
  state.alliances.push({ id, name: name.trim() || `${home.name} Pact`, founderCountryId: home.id, memberCountryIds: [home.id] });
  home.allianceId = id;
  log(state, `${home.name} founded the ${name || `${home.name} Pact`} alliance.`, 'politics');
  logHistory(state, `🤝 ${home.name} founds the ${name || `${home.name} Pact`} alliance`);
  return { ok: true, message: 'Alliance founded.' };
}

export function joinAlliance(state: GameState, allianceId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (home.allianceId) return { ok: false, message: `${home.name} already belongs to an alliance.` };
  const alliance = state.alliances.find((a) => a.id === allianceId);
  if (!alliance) return { ok: false, message: 'Alliance not found.' };
  alliance.memberCountryIds.push(home.id);
  home.allianceId = alliance.id;
  for (const memberId of alliance.memberCountryIds) {
    if (memberId === home.id) continue;
    const member = state.countries.find((c) => c.id === memberId);
    if (member) {
      home.relations[member.id] = clamp((home.relations[member.id] ?? 0) + 25, -100, 100);
      member.relations[home.id] = clamp((member.relations[home.id] ?? 0) + 25, -100, 100);
    }
  }
  log(state, `${home.name} joined the ${alliance.name} alliance.`, 'politics');
  return { ok: true, message: `Joined ${alliance.name}.` };
}

export function leaveAlliance(state: GameState): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (!home.allianceId) return { ok: false, message: 'Not in an alliance.' };
  const alliance = state.alliances.find((a) => a.id === home.allianceId);
  if (alliance) alliance.memberCountryIds = alliance.memberCountryIds.filter((id) => id !== home.id);
  home.allianceId = null;
  log(state, `${home.name} withdrew from its alliance.`, 'politics');
  return { ok: true, message: 'Left the alliance.' };
}

// ---------------------------------------------------------------------------
// V7: Governance depth — board/shareholder votes, anti-corruption, procurement,
// grants, think tanks
// ---------------------------------------------------------------------------

export type BoardProposal = 'increase_dividend' | 'exec_compensation' | 'block_activist';

export function proposeBoardResolution(state: GameState, companyId: string, proposal: BoardProposal): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || !c.isPublic || c.status !== 'active') return { ok: false, message: 'Only public companies you control can hold a board vote.' };
  const rng = withRng(state);
  const chance = clamp(0.3 + c.playerSharePct * 0.5 + (c.esg - 50) * 0.002 + (c.customerSatisfaction - 50) * 0.001, 0.05, 0.95);
  const passed = rng.chance(chance);
  commit(state, rng);
  if (!passed) {
    log(state, `Shareholders voted down your ${proposal.replace('_', ' ')} resolution at ${c.name}.`, 'bad');
    return { ok: false, message: 'The board voted against your proposal.' };
  }
  if (proposal === 'increase_dividend') {
    c.dividendPayoutPct = clamp(c.dividendPayoutPct + 0.05, 0, 0.9);
    log(state, `Shareholders approved a higher dividend at ${c.name}.`, 'business');
    return { ok: true, message: 'Dividend increase approved.' };
  }
  if (proposal === 'exec_compensation') {
    const cost = c.executives.reduce((s, e) => s + e.salary, 0) * 0.3;
    if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
    c.cash -= cost;
    for (const e of c.executives) e.salary *= 1.2;
    c.morale = clamp100(c.morale + 6);
    log(state, `Shareholders approved a richer executive pay package at ${c.name}.`, 'business');
    return { ok: true, message: 'Executive compensation increased. Morale up.' };
  }
  // block_activist
  c.shortInterest = clamp(c.shortInterest * 0.5, 0, 0.6);
  c.brand = clamp100(c.brand + 3);
  log(state, `Shareholders backed the board against an activist push at ${c.name}.`, 'business');
  return { ok: true, message: 'Activist campaign rebuffed.' };
}

export function investigateOfficial(state: GameState, npcId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive || npc.countryId !== home.id) return { ok: false, message: 'Invalid target.' };
  const rng = withRng(state);
  const corruptChance = clamp(1 - npc.integrity / 100, 0.05, 0.95);
  const found = rng.chance(corruptChance);
  commit(state, rng);
  if (found) {
    for (const [portfolio, id] of Object.entries(home.cabinet)) {
      if (id === npcId) delete home.cabinet[portfolio];
    }
    home.corruption = clamp100(home.corruption - 4);
    state.player.reputation = clamp100(state.player.reputation + 6);
    state.player.popularity = clamp100(state.player.popularity + 3);
    log(state, `🕵️ An anti-corruption probe removed ${npc.name} from office.`, 'politics');
    return { ok: true, message: `${npc.name} was exposed and removed from office.` };
  }
  state.player.popularity = clamp100(state.player.popularity - 4);
  state.player.reputation = clamp100(state.player.reputation - 2);
  log(state, `An anti-corruption probe into ${npc.name} turned up nothing — critics call it a witch hunt.`, 'bad');
  return { ok: false, message: `The investigation into ${npc.name} found nothing.` };
}

export function bidOnGovernmentContract(state: GameState, companyId: string): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.lastGovContractBidYear === state.year) return { ok: false, message: 'Already bid on a government contract this year — try again next year.' };
  const home = state.countries.find((k) => k.id === c.countryId)!;
  const bidCost = Math.max(8_000, c.revenue * 0.01);
  if (bidCost > c.cash) return { ok: false, message: `Needs $${Math.round(bidCost).toLocaleString()} in company cash to prepare a bid.` };
  const rng = withRng(state);
  c.cash -= bidCost;
  c.lastGovContractBidYear = state.year;
  const chance = clamp(0.2 + (c.brand / 100) * 0.2 + (p.politicalCapital / 100) * 0.2 + (home.corruption / 100) * (p.notoriety > 20 ? 0.15 : -0.05), 0.05, 0.85);
  const won = rng.chance(chance);
  if (won) {
    const value = Math.max(20_000, c.revenue * rng.range(0.15, 0.4));
    c.cash += value;
    c.brand = clamp100(c.brand + 3);
    commit(state, rng);
    log(state, `🏛️ ${c.name} won a government contract worth $${Math.round(value).toLocaleString()}.`, 'business');
    return { ok: true, message: `Won the contract: $${Math.round(value).toLocaleString()}.` };
  }
  commit(state, rng);
  log(state, `${c.name}'s bid for a government contract was passed over.`, 'bad');
  return { ok: false, message: 'The contract went to another bidder.' };
}

export function applyForGrant(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.lastGrantYear === state.year) return { ok: false, message: 'Already applied for a grant this year — try again next year.' };
  const home = state.countries.find((k) => k.id === c.countryId)!;
  if (home.economy.budgetBalance < -0.08) return { ok: false, message: `${home.name}'s budget is too strained to fund grants right now.` };
  const applicationCost = Math.max(3_000, c.revenue * 0.003);
  if (applicationCost > c.cash) return { ok: false, message: `Needs $${Math.round(applicationCost).toLocaleString()} in company cash to prepare the application.` };
  const rng = withRng(state);
  c.cash -= applicationCost;
  c.lastGrantYear = state.year;
  const chance = clamp(0.25 + c.rdPct * 2, 0.1, 0.8);
  const approved = rng.chance(chance);
  commit(state, rng);
  if (approved) {
    const amount = Math.max(15_000, c.revenue * 0.05);
    c.cash += amount;
    c.quality = clamp100(c.quality + 3);
    log(state, `${c.name} was awarded a government R&D grant of $${Math.round(amount).toLocaleString()}.`, 'business');
    return { ok: true, message: `Grant awarded: $${Math.round(amount).toLocaleString()}.` };
  }
  return { ok: false, message: 'Grant application rejected.' };
}

export function fundThinkTank(state: GameState): ActionResult {
  const p = state.player;
  if (p.thinkTankFunded) return { ok: false, message: 'You already fund a think tank.' };
  const cost = 60_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  p.thinkTankFunded = true;
  log(state, `Founded a policy think tank ($15k/yr upkeep) to build long-term influence.`, 'politics');
  return { ok: true, message: 'Think tank funded.' };
}

export function cancelThinkTank(state: GameState): ActionResult {
  const p = state.player;
  if (!p.thinkTankFunded) return { ok: false, message: 'No think tank to defund.' };
  p.thinkTankFunded = false;
  log(state, `Defunded your policy think tank.`, 'politics');
  return { ok: true, message: 'Think tank defunded.' };
}

// ---------------------------------------------------------------------------
// V7: Science, health & energy depth
// ---------------------------------------------------------------------------

export function fundUniversityResearch(state: GameState, amount: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (amount <= 0 || amount > state.player.money) return { ok: false, message: 'Invalid funding amount.' };
  state.player.money -= amount;
  home.researchLevel = clamp100(home.researchLevel + amount / 40_000);
  home.education = clamp100(home.education + amount / 200_000);
  log(state, `Invested $${amount.toLocaleString()} in university research funding.`, 'politics');
  return { ok: true, message: `National research level now ${Math.round(home.researchLevel)}.` };
}

export function investInHealthcare(state: GameState, amount: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (amount <= 0 || amount > state.player.money) return { ok: false, message: 'Invalid funding amount.' };
  state.player.money -= amount;
  home.healthcare = clamp100(home.healthcare + amount / 30_000);
  log(state, `Invested $${amount.toLocaleString()} directly into the healthcare system.`, 'politics');
  return { ok: true, message: `Healthcare quality now ${Math.round(home.healthcare)}.` };
}

export function runClinicalTrial(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const ind = INDUSTRY_BY_ID[c.industryId];
  if (!ind.tags.includes('health') || ind.techIntensity < 0.5) return { ok: false, message: 'Only R&D-heavy health/pharma companies can run clinical trials.' };
  const cost = Math.max(60_000, c.revenue * 0.1);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  const country = state.countries.find((k) => k.id === c.countryId)!;
  const rng = withRng(state);
  c.cash -= cost;
  const chance = clamp(0.25 + c.rdPct * 1.5 + (country.researchLevel / 100) * 0.2, 0.1, 0.75);
  const success = rng.chance(chance);
  commit(state, rng);
  if (success) {
    c.patents++;
    c.quality = clamp100(c.quality + 6);
    c.brand = clamp100(c.brand + 4);
    log(state, `💊 ${c.name}'s clinical trial succeeded — a new drug patent was granted.`, 'business');
    return { ok: true, message: 'Clinical trial succeeded! Patent granted.' };
  }
  log(state, `${c.name}'s clinical trial failed to meet its endpoints.`, 'bad');
  return { ok: false, message: 'The trial failed. The R&D spend is a sunk cost.' };
}

export function setEnergyMix(state: GameState, renewableSharePct: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = clamp(renewableSharePct, 0, 100);
  const cost = Math.abs(target - home.energyRenewableShare) * 15_000;
  if (cost > state.player.money) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} to retool the grid that much.` };
  state.player.money -= cost;
  home.energyRenewableShare = target;
  log(state, `Shifted the national energy grid to ${Math.round(target)}% renewable.`, 'politics');
  return { ok: true, message: `Grid now ${Math.round(target)}% renewable.` };
}

// ---------------------------------------------------------------------------
// V7: Media ownership & reputation management
// ---------------------------------------------------------------------------

export function runFavorableCoverage(state: GameState, companyId: string): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  const ind = INDUSTRY_BY_ID[c?.industryId ?? ''];
  if (!c || !c.playerOwned || c.status !== 'active' || !ind?.tags.includes('media')) return { ok: false, message: 'Not a media company you control.' };
  if (c.politicalInfluence < 20) return { ok: false, message: 'Needs at least 20 political influence built up.' };
  c.politicalInfluence = clamp(c.politicalInfluence - 20, 0, 100);
  const gain = 3 + c.politicalInfluence * 0.05;
  p.reputation = clamp100(p.reputation + gain);
  p.popularity = clamp100(p.popularity + gain * 0.6);
  p.karma = clamp100(p.karma - 2);
  log(state, `${c.name} ran a flattering profile piece on you.`, 'business');
  return { ok: true, message: `Reputation +${gain.toFixed(0)} from favorable coverage.` };
}

export function hirePRAgency(state: GameState): ActionResult {
  const p = state.player;
  if (p.prAgencyHired) return { ok: false, message: 'You already retain a PR agency.' };
  const cost = 50_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  p.prAgencyHired = true;
  log(state, `Retained a PR agency ($10k/yr upkeep) to manage your public image.`, 'politics');
  return { ok: true, message: 'PR agency retained.' };
}

export function cancelPRAgency(state: GameState): ActionResult {
  const p = state.player;
  if (!p.prAgencyHired) return { ok: false, message: 'No PR agency retained.' };
  p.prAgencyHired = false;
  log(state, `Cancelled the PR agency retainer.`, 'politics');
  return { ok: true, message: 'PR agency retainer cancelled.' };
}

// ---------------------------------------------------------------------------
// V7: Diplomacy depth — international summits
// ---------------------------------------------------------------------------

export function attendSummit(state: GameState): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const p = state.player;
  const cost = 15;
  if (p.politicalCapital < cost) return { ok: false, message: `Needs ${cost} political capital.` };
  p.politicalCapital = clamp(p.politicalCapital - cost, 0, 100);
  const rng = withRng(state);
  const others = state.countries.filter((k) => k.id !== home.id && !home.atWarWith.includes(k.id));
  for (const other of others) {
    home.relations[other.id] = clamp((home.relations[other.id] ?? 0) + rng.range(3, 8), -100, 100);
    other.relations[home.id] = clamp((other.relations[home.id] ?? 0) + rng.range(3, 8), -100, 100);
  }
  const breakthrough = rng.chance(0.3);
  p.reputation = clamp100(p.reputation + (breakthrough ? 8 : 3));
  p.influence = clamp100(p.influence + (breakthrough ? 6 : 2));
  if (breakthrough) home.economy.businessConfidence = clamp100(home.economy.businessConfidence + 4);
  commit(state, rng);
  if (!state.achievements.includes('summit_diplomat')) state.achievements.push('summit_diplomat');
  log(state, breakthrough
    ? `🌐 A landmark agreement came out of the international summit.`
    : `🌐 You attended an international summit, warming relations across the board.`, 'politics');
  return { ok: true, message: breakthrough ? 'Summit breakthrough! Relations and confidence up.' : 'Relations improved with every nation present.' };
}

// ---------------------------------------------------------------------------
// V8: Government depth — cabinet meetings, budget speech, protests
// ---------------------------------------------------------------------------

const PORTFOLIO_THEMES: Record<CabinetPortfolio, string> = {
  Finance: 'a tax and spending package',
  'Foreign Affairs': 'a diplomatic realignment',
  Defense: 'a military spending increase',
  Health: 'a healthcare funding boost',
  Education: 'a school funding reform',
  Justice: 'a crime crackdown package',
};

/** A cabinet meeting: a random appointed minister presents and argues for a policy in their portfolio. */
export function holdCabinetMeeting(state: GameState): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const appointed = Object.entries(home.cabinet).filter(([, id]) => id !== 'player');
  if (!appointed.length) return { ok: false, message: 'No appointed ministers to convene.' };
  const rng = withRng(state);
  const [portfolio, npcId] = rng.pick(appointed);
  const minister = state.npcs[npcId];
  if (!minister || !minister.alive) {
    commit(state, rng);
    return { ok: false, message: 'That minister is no longer available.' };
  }
  const theme = PORTFOLIO_THEMES[portfolio as CabinetPortfolio];
  const chance = clamp(0.35 + (minister.competence - 50) * 0.005 + (state.player.politicalCapital - 50) * 0.002, 0.15, 0.85);
  const agreed = rng.chance(chance);
  const rivalMinister = appointed.find(([pf]) => pf !== portfolio);
  const rivalName = rivalMinister ? state.npcs[rivalMinister[1]]?.name : null;
  commit(state, rng);
  if (agreed) {
    const pull = 4 + minister.competence * 0.04;
    if (portfolio === 'Finance') home.economy.businessConfidence = clamp100(home.economy.businessConfidence + pull);
    else if (portfolio === 'Health') home.healthcare = clamp100(home.healthcare + pull);
    else if (portfolio === 'Education') home.education = clamp100(home.education + pull);
    else if (portfolio === 'Defense') home.militaryPower = clamp100(home.militaryPower + pull);
    else if (portfolio === 'Justice') home.corruption = clamp100(home.corruption - pull);
    else for (const otherId of Object.keys(home.relations)) home.relations[otherId] = clamp(home.relations[otherId] + pull * 0.3, -100, 100);
    minister.opinionOfPlayer = clamp(minister.opinionOfPlayer + 8, -100, 100);
    log(state, `🏛️ Cabinet meeting: ${minister.name} won backing for ${theme}.`, 'politics');
    return { ok: true, message: `The cabinet agreed to ${minister.name}'s ${theme}.` };
  }
  const clash = rivalName ? ` ${rivalName} argued against it.` : '';
  minister.opinionOfPlayer = clamp(minister.opinionOfPlayer - 5, -100, 100);
  log(state, `🏛️ Cabinet meeting: ${minister.name}'s ${theme} was shot down.${clash}`, 'bad');
  return { ok: false, message: `The cabinet couldn't agree on ${minister.name}'s proposal.${clash}` };
}

/** Deliver the national budget speech live in parliament; markets and voters react instantly. */
export function deliverBudgetSpeech(state: GameState): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const p = state.player;
  const cost = 10;
  if (p.politicalCapital < cost) return { ok: false, message: `Needs ${cost} political capital.` };
  p.politicalCapital = clamp(p.politicalCapital - cost, 0, 100);
  const rng = withRng(state);
  const balance = home.economy.budgetBalance ?? 0;
  const skill = (p.skills[SK.publicSpeaking] ?? 0) + (p.skills[SK.economics] ?? 0);
  const deliveryChance = clamp(0.5 + skill * 0.003 + (p.charisma - 50) * 0.003, 0.2, 0.9);
  const wellReceived = rng.chance(deliveryChance);
  const balanceMult = balance >= 0 ? 1 : -1;
  const popularityChange = wellReceived ? rng.range(3, 7) * (balance >= -0.05 ? 1 : 0.3) : -rng.range(2, 6);
  const confidenceChange = wellReceived ? rng.range(2, 5) * balanceMult : -rng.range(1, 4);
  p.popularity = clamp100(p.popularity + popularityChange);
  home.economy.businessConfidence = clamp100(home.economy.businessConfidence + confidenceChange);
  home.economy.stockIndex = home.economy.stockIndex * (1 + confidenceChange * 0.002);
  commit(state, rng);
  if (!state.achievements.includes('budget_orator')) state.achievements.push('budget_orator');
  log(state, wellReceived
    ? `📜 Your budget speech landed well; markets and voters both responded positively.`
    : `📜 Your budget speech fell flat in the chamber.`, 'politics');
  return { ok: true, message: wellReceived ? 'Budget speech well received.' : 'The speech underwhelmed.' };
}

export type ProtestResponse = 'concede' | 'crackdown' | 'ignore';

/** Respond to a live protest/strike movement. */
export function respondToProtests(state: GameState, approach: ProtestResponse): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (home.unrest < 30) return { ok: false, message: 'There is no significant unrest to respond to right now.' };
  const p = state.player;
  const rng = withRng(state);
  if (approach === 'concede') {
    home.unrest = clamp100(home.unrest - rng.range(15, 30));
    p.popularity = clamp100(p.popularity + rng.range(3, 7));
    home.economy.budgetBalance = (home.economy.budgetBalance ?? 0) - 0.01;
    log(state, `You made concessions to protesters, easing unrest at a fiscal cost.`, 'politics');
    commit(state, rng);
    return { ok: true, message: 'Unrest eased through concessions.' };
  }
  if (approach === 'crackdown') {
    home.unrest = clamp100(home.unrest - rng.range(25, 45));
    home.stability = clamp(home.stability - rng.range(2, 6), 0, 100);
    p.karma = clamp100(p.karma - rng.range(4, 10));
    const backlash = rng.chance(0.4);
    p.popularity = clamp100(p.popularity + (backlash ? -rng.range(5, 12) : rng.range(1, 4)));
    log(state, backlash
      ? `Your crackdown on protesters drew international condemnation.`
      : `Your crackdown restored order quickly.`, backlash ? 'bad' : 'politics');
    commit(state, rng);
    return { ok: true, message: backlash ? 'Order restored, but at a reputational cost.' : 'Order restored.' };
  }
  home.unrest = clamp100(home.unrest + rng.range(2, 8));
  p.popularity = clamp100(p.popularity - rng.range(1, 4));
  log(state, `You ignored the unrest; it festers.`, 'bad');
  commit(state, rng);
  return { ok: true, message: 'Unrest continues to build.' };
}

// ---------------------------------------------------------------------------
// Crime & the underworld
// ---------------------------------------------------------------------------

export const CRIME_RANK_TITLES = ['', 'Associate', 'Soldier', 'Capo', 'Underboss', 'Boss'];

export function joinCrimeFamily(state: GameState): ActionResult {
  const p = state.player;
  if (p.crimeFamilyId) return { ok: false, message: 'You are already in the family.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const rng = withRng(state);
  const candidates = Object.values(state.npcs).filter((n) => n.alive && n.countryId === p.countryId && n.role === 'criminal');
  const boss = candidates.length ? rng.pick(candidates) : null;
  p.crimeFamilyId = boss?.id ?? 'unknown_boss';
  p.crimeRank = 1;
  p.notoriety = clamp100(p.notoriety + 10);
  p.karma = clamp100(p.karma - 10);
  commit(state, rng);
  log(state, `🕶️ You were initiated into ${boss?.name ?? 'a criminal organization'}'s family as an Associate.`, 'bad');
  return { ok: true, message: `Welcome to the family, Associate.` };
}

export function heist(state: GameState): ActionResult {
  const p = state.player;
  if (!p.crimeFamilyId) return { ok: false, message: 'You need to be in the family first.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const rng = withRng(state);
  const skill = (p.skills[SK.streetSmarts] ?? 0) * 0.6 + (p.skills[SK.evasion] ?? 0) * 0.4;
  const chance = clamp(0.4 + skill * 0.004 + p.crimeRank * 0.03, 0.1, 0.85);
  const success = rng.chance(chance);
  if (success) {
    const take = rng.range(20_000, 60_000) * p.crimeRank * (1 + p.turfControl / 200);
    p.dirtyMoney += take;
    p.notoriety = clamp100(p.notoriety + 5);
    p.investigationHeat = clamp100(p.investigationHeat + 12);
    if (p.crimeRank < 5 && rng.chance(0.25)) {
      p.crimeRank++;
      if (p.crimeRank === 5 && !state.achievements.includes('crime_boss')) state.achievements.push('crime_boss');
      log(state, `You were promoted to ${CRIME_RANK_TITLES[p.crimeRank]}.`, 'bad');
    }
    commit(state, rng);
    log(state, `💰 The heist paid off: $${Math.round(take).toLocaleString()}.`, 'money');
    return { ok: true, message: `Scored $${Math.round(take).toLocaleString()}.` };
  }
  const jailYears = rng.int(1, 3);
  p.criminalRecord++;
  p.inJailYears += jailYears;
  p.job = null;
  p.campaign = null;
  p.office = null;
  p.reputation = clamp100(p.reputation - 15);
  commit(state, rng);
  log(state, `🚨 The heist went wrong. You were caught and sentenced to ${jailYears} years.`, 'bad');
  return { ok: false, message: `Caught! ${jailYears} years in prison.` };
}

export function protectionRacket(state: GameState, targetCompanyId: string): ActionResult {
  const p = state.player;
  if (!p.crimeFamilyId) return { ok: false, message: 'You need to be in the family first.' };
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned) return { ok: false, message: 'Invalid target.' };
  const rng = withRng(state);
  const take = Math.min(target.cash, target.revenue * 0.05 * p.crimeRank);
  if (take < 1000) return { ok: false, message: 'That business has nothing worth taking.' };
  const chance = clamp(0.7 + (p.skills[SK.bribery] ?? 0) * 0.002, 0.3, 0.9);
  if (rng.chance(chance)) {
    target.cash -= take;
    p.dirtyMoney += take * (1 + p.turfControl / 200);
    p.notoriety = clamp100(p.notoriety + 3);
    p.investigationHeat = clamp100(p.investigationHeat + 8);
    commit(state, rng);
    log(state, `Shook down ${target.name} for $${Math.round(take).toLocaleString()}.`, 'bad');
    return { ok: true, message: `Collected $${Math.round(take).toLocaleString()}.` };
  }
  p.reputation = clamp100(p.reputation - 5);
  p.notoriety = clamp100(p.notoriety + 6);
  p.investigationHeat = clamp100(p.investigationHeat + 20);
  commit(state, rng);
  log(state, `${target.name} refused to pay and reported you.`, 'bad');
  return { ok: false, message: 'They refused and reported you.' };
}

export function bribeJudge(state: GameState): ActionResult {
  const p = state.player;
  if (p.inJailYears <= 0) return { ok: false, message: 'You are not currently facing a sentence.' };
  const cost = 40_000 + p.inJailYears * 15_000;
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= cost;
  const chance = clamp(0.4 + (p.skills[SK.bribery] ?? 0) * 0.005, 0.1, 0.8);
  if (rng.chance(chance)) {
    const reduction = Math.min(p.inJailYears, rng.int(1, 3));
    p.inJailYears -= reduction;
    commit(state, rng);
    log(state, `A judge was persuaded to cut ${reduction} year(s) from your sentence.`, 'bad');
    return { ok: true, message: `Sentence reduced by ${reduction} year(s).` };
  }
  p.inJailYears += 1;
  p.notoriety = clamp100(p.notoriety + 5);
  commit(state, rng);
  log(state, `The bribery attempt was discovered — a year was added to your sentence.`, 'bad');
  return { ok: false, message: 'Caught bribing the judge. +1 year.' };
}

export function attemptPrisonEscape(state: GameState): ActionResult {
  const p = state.player;
  if (p.inJailYears <= 0) return { ok: false, message: 'You are not in prison.' };
  const rng = withRng(state);
  const chance = clamp(0.15 + (p.skills[SK.streetSmarts] ?? 0) * 0.003, 0.05, 0.5);
  if (rng.chance(chance)) {
    p.inJailYears = 0;
    p.notoriety = clamp100(p.notoriety + 20);
    commit(state, rng);
    log(state, `🏃 You escaped from prison! You're now a fugitive with a much higher profile.`, 'bad');
    return { ok: true, message: 'You escaped!' };
  }
  p.inJailYears += 2;
  commit(state, rng);
  log(state, `Your escape attempt failed. Two years were added to your sentence.`, 'bad');
  return { ok: false, message: 'Escape failed. +2 years.' };
}

/** Request early release once you've served at least a year of the current sentence — real
 * behavior-based leniency, not a guaranteed out. Odds favor a clean record, low notoriety,
 * good karma, and time already served; a denial can be appealed again next year. */
export function requestParole(state: GameState): ActionResult {
  const p = state.player;
  if (p.inJailYears <= 0) return { ok: false, message: 'You are not in prison.' };
  if (p.yearsServedThisSentence < 1) return { ok: false, message: 'You need to serve at least a year before requesting parole.' };
  if (onCooldown(state, 'parole_request')) return { ok: false, message: 'The board already heard your case this year — try again next year.' };
  setCooldown(state, 'parole_request');
  const rng = withRng(state);
  const chance = clamp(
    0.25 + (60 - p.criminalRecord * 8) * 0.005 + (p.karma - 50) * 0.003 - p.notoriety * 0.003 + p.yearsServedThisSentence * 0.05,
    0.05,
    0.85,
  );
  const granted = rng.chance(chance);
  commit(state, rng);
  if (granted) {
    const timeLeft = p.inJailYears;
    p.inJailYears = 0;
    p.yearsServedThisSentence = 0;
    p.happiness = clamp100(p.happiness + 10);
    log(state, `You were granted parole, ${timeLeft} year(s) early.`, 'good');
    if (!state.achievements.includes('early_release')) state.achievements.push('early_release');
    return { ok: true, message: `Parole granted! Released ${timeLeft} year(s) early.` };
  }
  log(state, 'The parole board denied your request.', 'bad');
  return { ok: false, message: 'Parole denied. You can appeal again next year.' };
}

export function goStraight(state: GameState): ActionResult {
  const p = state.player;
  if (!p.crimeFamilyId) return { ok: false, message: 'You are not in the family.' };
  const cost = 50_000 * p.crimeRank;
  if (cost > p.money) return { ok: false, message: `The family wants $${cost.toLocaleString()} to let you walk.` };
  p.money -= cost;
  p.crimeFamilyId = null;
  p.crimeRank = 0;
  p.turfControl = 0;
  p.notoriety = clamp100(p.notoriety - 15);
  p.karma = clamp100(p.karma + 10);
  log(state, `You paid your way out of the family and went straight.`, 'good');
  return { ok: true, message: 'You left the criminal underworld behind.' };
}

export function launderMoney(state: GameState, companyId: string, amount: number): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'You need an active front business.' };
  if (amount <= 0 || amount > p.dirtyMoney) return { ok: false, message: 'Not enough dirty money.' };
  const rng = withRng(state);
  const skill = p.skills[SK.moneyLaundering] ?? 0;
  const cut = clamp(0.35 - c.brand / 500 - skill * 0.001, 0.1, 0.35);
  const clean = amount * (1 - cut);
  const caught = rng.chance(clamp(0.08 - c.brand * 0.0003 - skill * 0.0004, 0.01, 0.08));
  p.dirtyMoney -= amount;
  commit(state, rng);
  if (caught) {
    c.lawsuits++;
    p.notoriety = clamp100(p.notoriety + 15);
    p.criminalRecord++;
    p.investigationHeat = clamp100(p.investigationHeat + 18);
    log(state, `🚨 A laundering operation through ${c.name} was flagged by regulators.`, 'bad');
    return { ok: false, message: `The operation was flagged. Dirty money lost, and ${c.name} faces scrutiny.` };
  }
  p.money += clean;
  p.investigationHeat = clamp100(p.investigationHeat + 6);
  log(state, `Laundered $${Math.round(amount).toLocaleString()} through ${c.name} (${Math.round(cut * 100)}% cut).`, 'bad');
  return { ok: true, message: `Cleaned $${Math.round(clean).toLocaleString()}.` };
}

export function contestTerritory(state: GameState): ActionResult {
  const p = state.player;
  if (!p.crimeFamilyId) return { ok: false, message: 'You need to be in the family first.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  if (p.turfControl >= 100) return { ok: false, message: 'You already control all the turf worth having.' };
  const rng = withRng(state);
  const skill = (p.skills[SK.streetSmarts] ?? 0) * 0.6 + (p.skills[SK.bribery] ?? 0) * 0.4;
  const chance = clamp(0.35 + skill * 0.004 + p.crimeRank * 0.05, 0.15, 0.85);
  const success = rng.chance(chance);
  if (success) {
    const gain = rng.range(8, 18);
    p.turfControl = clamp100(p.turfControl + gain);
    p.notoriety = clamp100(p.notoriety + 4);
    p.investigationHeat = clamp100(p.investigationHeat + 7);
    commit(state, rng);
    log(state, `Your family expanded its turf. Territory control now ${Math.round(p.turfControl)}.`, 'bad');
    return { ok: true, message: `Turf control +${gain.toFixed(0)}.` };
  }
  const loss = rng.range(5, 12);
  p.turfControl = clamp100(p.turfControl - loss);
  p.health = clamp100(p.health - rng.range(5, 15));
  p.investigationHeat = clamp100(p.investigationHeat + 10);
  commit(state, rng);
  log(state, `A rival crew pushed back hard on your turf grab.`, 'bad');
  return { ok: false, message: 'The turf war went badly. You took losses.' };
}

export function enterWitnessProtection(state: GameState): ActionResult {
  const p = state.player;
  if (p.crimeFamilyId) return { ok: false, message: 'Go straight first — you cannot enter protection while still in the family.' };
  if (p.inWitnessProtection) return { ok: false, message: 'Already in witness protection.' };
  const cost = 100_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  p.criminalRecord = 0;
  p.notoriety = 0;
  p.turfControl = 0;
  p.inWitnessProtection = true;
  p.reputation = clamp(p.reputation - 10, 0, 100);
  if (p.rivalId) p.rivalId = null;
  p.happiness = clamp100(p.happiness - 8);
  log(state, `You entered witness protection, wiping your criminal record at the cost of your old life.`, 'good');
  return { ok: true, message: 'Your criminal record and notoriety were wiped clean.' };
}

// ---------------------------------------------------------------------------
// Lifestyle / misc
// ---------------------------------------------------------------------------

export type ActivityKind =
  | 'vacation' | 'gym' | 'doctor' | 'charity' | 'party' | 'meditate'
  | 'book_club' | 'therapy' | 'adopt_pet' | 'learn_instrument' | 'road_trip'
  | 'art_collecting' | 'wine_tasting' | 'poker_night' | 'volunteer' | 'seminar'
  | 'spa_day' | 'home_improvement' | 'blog' | 'learn_language'
  | 'yoga' | 'cooking_class' | 'golf_day' | 'chess_tournament' | 'sailing_lesson'
  | 'skydiving' | 'marathon_training' | 'museum_visit' | 'live_concert' | 'camping_trip'
  | 'yacht_day' | 'wine_country_tour' | 'gallery_opening' | 'fishing_trip' | 'martial_arts'
  | 'stand_up_comedy' | 'public_speaking_course' | 'coding_bootcamp' | 'cybersecurity_course'
  | 'personal_finance_course' | 'industry_conference' | 'startup_weekend' | 'life_coaching'
  | 'mindfulness_retreat' | 'debate_club' | 'improv_class' | 'dance_lessons' | 'first_aid_course'
  | 'investment_seminar' | 'negotiation_workshop';

export function doActivity(state: GameState, kind: ActivityKind): ActionResult {
  const p = state.player;
  if (onCooldown(state, `activity_${kind}`)) return { ok: false, message: 'You already did that this year — try again next year.' };
  const rng = withRng(state);
  let msg = '';
  switch (kind) {
    case 'vacation': {
      const cost = Math.max(2_000, p.money * 0.02);
      if (cost > p.money) return { ok: false, message: 'Too broke to travel.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 10);
      p.health = clamp100(p.health + 3);
      p.stress = clamp100(p.stress - 12);
      msg = 'You took a rejuvenating vacation.';
      break;
    }
    case 'gym': {
      p.money -= 1_200;
      p.health = clamp100(p.health + 6);
      p.skills['lifestyle_fitness'] = clamp100((p.skills['lifestyle_fitness'] ?? 0) + 6);
      msg = 'A year of training. Health improved.';
      break;
    }
    case 'doctor': {
      const cost = 3_000;
      p.money -= cost;
      p.health = clamp100(p.health + 10);
      msg = 'Comprehensive medical care restored your health.';
      break;
    }
    case 'charity': {
      const amt = Math.max(1_000, p.money * 0.05);
      if (amt > p.money) return { ok: false, message: 'Nothing to give.' };
      p.money -= amt;
      p.karma = clamp100(p.karma + 8);
      p.reputation = clamp100(p.reputation + 2);
      p.popularity = clamp100(p.popularity + 1);
      if (!state.achievements.includes('philanthropist')) state.achievements.push('philanthropist');
      msg = `Donated $${Math.round(amt).toLocaleString()} to charity.`;
      break;
    }
    case 'party': {
      p.money -= 5_000;
      p.happiness = clamp100(p.happiness + 6);
      p.charisma = clamp100(p.charisma + 1);
      p.health = clamp100(p.health - 2);
      if (rng.chance(0.2)) { p.influence = clamp100(p.influence + 2); msg = 'You threw a lavish party and made powerful new friends.'; }
      else msg = 'A great party — you needed that.';
      break;
    }
    case 'meditate': {
      p.happiness = clamp100(p.happiness + 4);
      p.health = clamp100(p.health + 2);
      p.smarts = clamp100(p.smarts + 1);
      p.stress = clamp100(p.stress - 8);
      msg = 'A calmer, sharper mind.';
      break;
    }
    case 'book_club': {
      p.money -= 200;
      p.smarts = clamp100(p.smarts + 2);
      p.happiness = clamp100(p.happiness + 2);
      p.skills[SK.foreignLanguages] = clamp100((p.skills[SK.foreignLanguages] ?? 0) + 1);
      msg = 'A lively book club discussion sharpened your mind.';
      break;
    }
    case 'therapy': {
      const cost = 4_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford therapy sessions.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 8);
      p.health = clamp100(p.health + 3);
      p.stress = clamp100(p.stress - 22);
      msg = 'A year of therapy left you feeling lighter and clearer-headed.';
      break;
    }
    case 'adopt_pet': {
      const cost = 500;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the adoption fee.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 8);
      p.karma = clamp100(p.karma + 2);
      msg = 'You adopted a pet. Life is better with a companion around.';
      break;
    }
    case 'learn_instrument': {
      p.money -= 600;
      p.happiness = clamp100(p.happiness + 3);
      p.charisma = clamp100(p.charisma + 1);
      msg = 'You picked up a new instrument. Progress is slow but satisfying.';
      break;
    }
    case 'road_trip': {
      const cost = 2_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the trip.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 7);
      p.health = clamp100(p.health + 1);
      msg = 'An open-road trip cleared your head.';
      break;
    }
    case 'art_collecting': {
      const cost = 5_000;
      if (cost > p.money) return { ok: false, message: 'Not enough to collect art seriously.' };
      p.money -= cost;
      p.skills[SK.artCollecting] = clamp100((p.skills[SK.artCollecting] ?? 0) + 10);
      p.happiness = clamp100(p.happiness + 3);
      p.reputation = clamp100(p.reputation + 1);
      msg = 'You added a striking new piece to your collection.';
      break;
    }
    case 'wine_tasting': {
      const cost = 300;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the tasting.' };
      p.money -= cost;
      p.skills[SK.wineTasting] = clamp100((p.skills[SK.wineTasting] ?? 0) + 8);
      p.happiness = clamp100(p.happiness + 3);
      msg = 'An evening of wine tasting refined your palate.';
      break;
    }
    case 'poker_night': {
      const buyIn = 500;
      if (buyIn > p.money) return { ok: false, message: 'Cannot afford to buy in.' };
      p.money -= buyIn;
      p.skills[SK.poker] = clamp100((p.skills[SK.poker] ?? 0) + 10);
      const skillLvl = p.skills[SK.poker] ?? 0;
      if (rng.chance(0.35 + skillLvl * 0.003)) {
        const winnings = buyIn * rng.range(1.5, 4);
        p.money += winnings;
        p.happiness = clamp100(p.happiness + 4);
        msg = `Poker night paid off — you won $${Math.round(winnings).toLocaleString()}.`;
      } else {
        p.happiness = clamp100(p.happiness - 1);
        msg = 'Poker night was rough. You lost your buy-in.';
      }
      break;
    }
    case 'volunteer': {
      p.karma = clamp100(p.karma + 6);
      p.reputation = clamp100(p.reputation + 1);
      p.happiness = clamp100(p.happiness + 3);
      msg = 'A year of volunteering left the community — and you — better off.';
      break;
    }
    case 'seminar': {
      const cost = 800;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the seminar.' };
      p.money -= cost;
      p.smarts = clamp100(p.smarts + 2);
      p.skills[SK.economics] = clamp100((p.skills[SK.economics] ?? 0) + 8);
      msg = 'A professional seminar expanded your thinking.';
      break;
    }
    case 'spa_day': {
      const cost = 400;
      if (cost > p.money) return { ok: false, message: 'Cannot afford a spa day.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 6);
      p.health = clamp100(p.health + 3);
      p.stress = clamp100(p.stress - 10);
      msg = 'A relaxing spa day recharged you.';
      break;
    }
    case 'home_improvement': {
      const cost = 3_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford renovations.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 3);
      if (p.properties.length > 0) {
        p.properties[0].value *= 1.03;
        msg = `Renovations boosted the value of ${p.properties[0].name}.`;
      } else {
        msg = 'You spruced up your living space.';
      }
      break;
    }
    case 'blog': {
      p.skills[SK.writing] = clamp100((p.skills[SK.writing] ?? 0) + 8);
      p.happiness = clamp100(p.happiness + 2);
      if (rng.chance(0.15)) {
        const earnings = rng.range(500, 5_000);
        p.money += earnings;
        p.reputation = clamp100(p.reputation + 2);
        msg = `Your blog found an audience — it earned $${Math.round(earnings).toLocaleString()} in ad revenue.`;
      } else {
        msg = 'You kept up your blog this year. A modest but loyal readership.';
      }
      break;
    }
    case 'learn_language': {
      const cost = 600;
      if (cost > p.money) return { ok: false, message: 'Cannot afford language lessons.' };
      p.money -= cost;
      p.skills[SK.foreignLanguages] = clamp100((p.skills[SK.foreignLanguages] ?? 0) + 10);
      p.smarts = clamp100(p.smarts + 1);
      msg = 'You made real progress learning a new language.';
      break;
    }
    case 'yoga': {
      p.happiness = clamp100(p.happiness + 4);
      p.health = clamp100(p.health + 4);
      p.skills[SK.fitness] = clamp100((p.skills[SK.fitness] ?? 0) + 4);
      p.stress = clamp100(p.stress - 7);
      msg = 'A calming yoga session left you centered.';
      break;
    }
    case 'cooking_class': {
      const cost = 400;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the cooking class.' };
      p.money -= cost;
      p.skills[SK.cooking] = clamp100((p.skills[SK.cooking] ?? 0) + 10);
      p.happiness = clamp100(p.happiness + 3);
      msg = 'You picked up some real kitchen skills.';
      break;
    }
    case 'golf_day': {
      const cost = 900;
      if (cost > p.money) return { ok: false, message: 'Cannot afford a round of golf.' };
      p.money -= cost;
      p.skills[SK.golf] = clamp100((p.skills[SK.golf] ?? 0) + 8);
      p.influence = clamp100(p.influence + 2);
      msg = 'A round of golf with well-connected company.';
      break;
    }
    case 'chess_tournament': {
      p.skills[SK.chess] = clamp100((p.skills[SK.chess] ?? 0) + 10);
      p.smarts = clamp100(p.smarts + 2);
      msg = 'A hard-fought chess tournament sharpened your mind.';
      break;
    }
    case 'sailing_lesson': {
      const cost = 700;
      if (cost > p.money) return { ok: false, message: 'Cannot afford sailing lessons.' };
      p.money -= cost;
      p.skills[SK.sailing] = clamp100((p.skills[SK.sailing] ?? 0) + 9);
      p.happiness = clamp100(p.happiness + 4);
      msg = 'You learned to read the wind out on the water.';
      break;
    }
    case 'skydiving': {
      const cost = 800;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the jump.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 12);
      if (rng.chance(0.08)) {
        p.health = clamp100(p.health - 8);
        msg = 'A rough landing left you bruised, but what a rush.';
      } else {
        msg = 'An exhilarating jump you will never forget.';
      }
      break;
    }
    case 'marathon_training': {
      p.health = clamp100(p.health + 8);
      p.skills[SK.fitness] = clamp100((p.skills[SK.fitness] ?? 0) + 12);
      p.happiness = clamp100(p.happiness + 3);
      msg = 'Months of training paid off at the finish line.';
      break;
    }
    case 'museum_visit': {
      const cost = 150;
      p.money -= cost;
      p.smarts = clamp100(p.smarts + 2);
      p.happiness = clamp100(p.happiness + 3);
      msg = 'A thoughtful afternoon among the exhibits.';
      break;
    }
    case 'live_concert': {
      const cost = 500;
      if (cost > p.money) return { ok: false, message: 'Cannot afford concert tickets.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 8);
      msg = 'An unforgettable night of live music.';
      break;
    }
    case 'camping_trip': {
      const cost = 300;
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 6);
      p.health = clamp100(p.health + 3);
      msg = 'A weekend off the grid recharged you.';
      break;
    }
    case 'yacht_day': {
      const cost = 4_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford to charter a yacht.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 9);
      p.reputation = clamp100(p.reputation + 1);
      msg = 'A day chartering a yacht with the right crowd.';
      break;
    }
    case 'wine_country_tour': {
      const cost = 1_200;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the wine tour.' };
      p.money -= cost;
      p.skills[SK.wineTasting] = clamp100((p.skills[SK.wineTasting] ?? 0) + 9);
      p.happiness = clamp100(p.happiness + 5);
      msg = 'A refined tour through the vineyards.';
      break;
    }
    case 'gallery_opening': {
      const cost = 250;
      p.money -= cost;
      p.skills[SK.artCollecting] = clamp100((p.skills[SK.artCollecting] ?? 0) + 7);
      p.influence = clamp100(p.influence + 2);
      msg = 'A gallery opening full of interesting conversations.';
      break;
    }
    case 'fishing_trip': {
      const cost = 200;
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 5);
      p.health = clamp100(p.health + 2);
      msg = 'A peaceful day out on the water.';
      break;
    }
    case 'martial_arts': {
      p.health = clamp100(p.health + 6);
      p.skills[SK.fitness] = clamp100((p.skills[SK.fitness] ?? 0) + 8);
      msg = 'Discipline and sparring built real strength.';
      break;
    }
    case 'stand_up_comedy': {
      p.charisma = clamp100(p.charisma + 3);
      p.happiness = clamp100(p.happiness + 6);
      msg = 'You bombed a little, then killed it. Great night.';
      break;
    }
    case 'public_speaking_course': {
      const cost = 500;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the course.' };
      p.money -= cost;
      p.skills[SK.publicSpeaking] = clamp100((p.skills[SK.publicSpeaking] ?? 0) + 10);
      msg = 'You are far more comfortable in front of a crowd now.';
      break;
    }
    case 'coding_bootcamp': {
      const cost = 2_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the bootcamp.' };
      p.money -= cost;
      p.skills[SK.programming] = clamp100((p.skills[SK.programming] ?? 0) + 14);
      msg = 'An intensive bootcamp leveled up your coding.';
      break;
    }
    case 'cybersecurity_course': {
      const cost = 1_500;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the course.' };
      p.money -= cost;
      p.skills[SK.cybersecurity] = clamp100((p.skills[SK.cybersecurity] ?? 0) + 12);
      msg = 'You now think like an attacker and a defender.';
      break;
    }
    case 'personal_finance_course': {
      const cost = 600;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the course.' };
      p.money -= cost;
      p.skills[SK.accounting] = clamp100((p.skills[SK.accounting] ?? 0) + 10);
      msg = 'Your handle on personal finance is much sharper.';
      break;
    }
    case 'industry_conference': {
      const cost = 1_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the conference.' };
      p.money -= cost;
      p.reputation = clamp100(p.reputation + 3);
      if (p.job) {
        const ind = INDUSTRY_BY_ID[p.job.industryId];
        if (ind) p.skills[ind.skillId] = clamp100((p.skills[ind.skillId] ?? 0) + 6);
      }
      msg = 'A packed conference full of useful contacts.';
      break;
    }
    case 'startup_weekend': {
      p.skills[SK.strategy] = clamp100((p.skills[SK.strategy] ?? 0) + 10);
      p.happiness = clamp100(p.happiness + 3);
      msg = 'A frantic weekend building something from nothing.';
      break;
    }
    case 'life_coaching': {
      const cost = 800;
      if (cost > p.money) return { ok: false, message: 'Cannot afford a life coach.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 6);
      p.smarts = clamp100(p.smarts + 2);
      p.stress = clamp100(p.stress - 9);
      msg = 'A clarifying session on where your life is headed.';
      break;
    }
    case 'mindfulness_retreat': {
      const cost = 1_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the retreat.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 8);
      p.health = clamp100(p.health + 4);
      p.karma = clamp100(p.karma + 3);
      p.stress = clamp100(p.stress - 16);
      msg = 'A quiet retreat left you grounded and clear-headed.';
      break;
    }
    case 'debate_club': {
      p.skills[SK.debate] = clamp100((p.skills[SK.debate] ?? 0) + 10);
      p.smarts = clamp100(p.smarts + 1);
      msg = 'A spirited debate sharpened your arguments.';
      break;
    }
    case 'improv_class': {
      const cost = 300;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the class.' };
      p.money -= cost;
      p.charisma = clamp100(p.charisma + 3);
      p.happiness = clamp100(p.happiness + 4);
      msg = 'Thinking on your feet just got a lot easier.';
      break;
    }
    case 'dance_lessons': {
      const cost = 350;
      if (cost > p.money) return { ok: false, message: 'Cannot afford dance lessons.' };
      p.money -= cost;
      p.charisma = clamp100(p.charisma + 2);
      p.happiness = clamp100(p.happiness + 5);
      msg = 'You have got some real moves now.';
      break;
    }
    case 'first_aid_course': {
      const cost = 250;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the course.' };
      p.money -= cost;
      p.skills[SK.medicine] = clamp100((p.skills[SK.medicine] ?? 0) + 8);
      msg = 'You could save a life now if you had to.';
      break;
    }
    case 'investment_seminar': {
      const cost = 700;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the seminar.' };
      p.money -= cost;
      p.skills[SK.investing] = clamp100((p.skills[SK.investing] ?? 0) + 10);
      msg = 'A seminar full of genuinely useful investing frameworks.';
      break;
    }
    case 'negotiation_workshop': {
      const cost = 900;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the workshop.' };
      p.money -= cost;
      p.skills[SK.negotiation] = clamp100((p.skills[SK.negotiation] ?? 0) + 11);
      msg = 'You will not be out-negotiated so easily anymore.';
      break;
    }
  }
  setCooldown(state, `activity_${kind}`);
  commit(state, rng);
  return { ok: true, message: msg };
}

export function takeLoan(state: GameState, amount: number, years: number): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const netWorthGuess = p.money + p.properties.reduce((s, x) => s + x.value - x.mortgage, 0);
  if (amount > Math.max(50_000, netWorthGuess * 2 + 100_000)) return { ok: false, message: 'The bank rejected the loan as too large.' };
  const rate = home.economy.interestRate + 0.04 + (p.criminalRecord > 0 ? 0.03 : 0);
  p.loans.push({ id: `loan_${state.year}_${p.loans.length}`, principal: amount, rate, yearsLeft: years, purpose: 'Personal loan' });
  p.money += amount;
  log(state, `Took a $${amount.toLocaleString()} loan at ${(rate * 100).toFixed(1)}% over ${years} years.`, 'money');
  return { ok: true, message: `Loan approved at ${(rate * 100).toFixed(1)}%.` };
}

// ---------------------------------------------------------------------------
// V10: small standalone actions across systems
// ---------------------------------------------------------------------------

export function renameCompany(state: GameState, companyId: string, newName: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, message: 'Enter a name.' };
  const oldName = c.name;
  c.name = trimmed.slice(0, 40);
  log(state, `${oldName} was renamed to ${c.name}.`, 'business');
  return { ok: true, message: `Renamed to ${c.name}.` };
}

export function refinanceMortgage(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop || prop.mortgage <= 0) return { ok: false, message: 'No mortgage on this property to refinance.' };
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const fee = Math.max(500, prop.mortgage * 0.01);
  if (fee > p.money) return { ok: false, message: `Needs $${Math.round(fee).toLocaleString()} in closing fees.` };
  p.money -= fee;
  const newRate = home.economy.interestRate + 0.02;
  log(state, `Refinanced the mortgage on ${prop.name} at ${(newRate * 100).toFixed(1)}%.`, 'money');
  return { ok: true, message: `Refinanced at ${(newRate * 100).toFixed(1)}%.` };
}

export function refinancePersonalLoan(state: GameState, loanId: string): ActionResult {
  const p = state.player;
  const loan = p.loans.find((x) => x.id === loanId);
  if (!loan) return { ok: false, message: 'Loan not found.' };
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const newRate = home.economy.interestRate + 0.04 + (p.criminalRecord > 0 ? 0.03 : 0);
  if (newRate >= loan.rate) return { ok: false, message: 'Current rates are not better than your existing loan.' };
  const fee = Math.max(200, loan.principal * 0.01);
  if (fee > p.money) return { ok: false, message: `Needs $${Math.round(fee).toLocaleString()} in fees.` };
  p.money -= fee;
  loan.rate = newRate;
  log(state, `Refinanced a personal loan down to ${(newRate * 100).toFixed(1)}%.`, 'money');
  return { ok: true, message: `New rate: ${(newRate * 100).toFixed(1)}%.` };
}

export function giftMoneyToChild(state: GameState, npcId: string, amount: number): ActionResult {
  const p = state.player;
  if (!p.children.includes(npcId)) return { ok: false, message: 'Not your child.' };
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive) return { ok: false, message: 'Child unavailable.' };
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= amount;
  npc.wealth += amount;
  npc.opinionOfPlayer = clamp(npc.opinionOfPlayer + 6, -100, 100);
  p.happiness = clamp100(p.happiness + 2);
  log(state, `You gifted ${npc.name} $${Math.round(amount).toLocaleString()}.`, 'money');
  return { ok: true, message: `Gifted $${Math.round(amount).toLocaleString()} to ${npc.name}.` };
}

export function investInChildEducation(state: GameState, npcId: string, amount: number): ActionResult {
  const p = state.player;
  if (!p.children.includes(npcId)) return { ok: false, message: 'Not your child.' };
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive) return { ok: false, message: 'Child unavailable.' };
  if (npc.age >= 22) return { ok: false, message: 'Too old to benefit from extra schooling.' };
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= amount;
  npc.competence = clamp100(npc.competence + amount / 5_000);
  npc.opinionOfPlayer = clamp(npc.opinionOfPlayer + 4, -100, 100);
  log(state, `Invested $${Math.round(amount).toLocaleString()} in ${npc.name}'s education.`, 'money');
  return { ok: true, message: `${npc.name}'s prospects just got brighter.` };
}

export function sponsorLocalSportsTeam(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(10_000, c.revenue * 0.015);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.brand = clamp100(c.brand + 4);
  state.player.reputation = clamp100(state.player.reputation + 1);
  log(state, `${c.name} sponsored a local sports team, winning over the community.`, 'business');
  return { ok: true, message: 'Sponsorship boosted local brand goodwill.' };
}

export function hostFundraiserGala(state: GameState): ActionResult {
  const p = state.player;
  if (!p.campaign) return { ok: false, message: 'You need an active campaign.' };
  const cost = 15_000;
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= cost;
  const raised = Math.round(cost * rng.range(1.5, 3.5));
  p.campaign.warChest += raised;
  p.campaign.momentum = clamp(p.campaign.momentum + 2, -50, 50);
  commit(state, rng);
  log(state, `🎉 Your fundraiser gala raised $${raised.toLocaleString()} for the campaign.`, 'politics');
  return { ok: true, message: `Raised $${raised.toLocaleString()}.` };
}

export function issuePublicApology(state: GameState): ActionResult {
  const p = state.player;
  if (p.notoriety <= 0 && p.reputation >= 50) return { ok: false, message: 'Nothing to apologize for right now.' };
  p.notoriety = clamp100(p.notoriety - 6);
  p.karma = clamp100(p.karma + 3);
  p.popularity = clamp100(p.popularity - 2);
  log(state, `You issued a public apology, taking a small popularity hit to clear the air.`, 'info');
  return { ok: true, message: 'Notoriety reduced; popularity took a small hit.' };
}

export function takeSabbatical(state: GameState): ActionResult {
  const p = state.player;
  if (!p.job) return { ok: false, message: 'You need a job to take a sabbatical from.' };
  p.happiness = clamp100(p.happiness + 10);
  p.health = clamp100(p.health + 5);
  p.job.performance = clamp100(p.job.performance - 10);
  log(state, `You took a sabbatical to recharge. It cost you some job performance.`, 'good');
  return { ok: true, message: 'A well-deserved break, at some career cost.' };
}

export function donateToPoliticalParty(state: GameState, partyId: string, amount: number): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const party = home.parties.find((x) => x.id === partyId);
  if (!party) return { ok: false, message: 'Party not found.' };
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= amount;
  party.support = clamp100(party.support + amount / 20_000);
  p.influence = clamp100(p.influence + amount / 40_000);
  log(state, `Donated $${Math.round(amount).toLocaleString()} to ${party.name}.`, 'money');
  return { ok: true, message: `${party.name}'s polling ticked up.` };
}

// ---------------------------------------------------------------------------
// V11: crypto, banking, foundation, retirement, casino, memoir, global games,
// moonshots, hired CEOs
// ---------------------------------------------------------------------------

export function buyCrypto(state: GameState, amount: number): ActionResult {
  const p = state.player;
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Invalid amount.' };
  const units = amount / state.cryptoPrice;
  p.money -= amount;
  p.cryptoUnits += units;
  log(state, `Bought ${units.toFixed(4)} crypto at $${Math.round(state.cryptoPrice).toLocaleString()}.`, 'money');
  if (!state.achievements.includes('crypto_trader')) state.achievements.push('crypto_trader');
  return { ok: true, message: `Bought ${units.toFixed(4)} units.` };
}

export function sellCrypto(state: GameState, units: number): ActionResult {
  const p = state.player;
  if (units <= 0 || units > p.cryptoUnits) return { ok: false, message: 'Not enough crypto.' };
  const proceeds = units * state.cryptoPrice;
  p.cryptoUnits -= units;
  p.money += proceeds;
  log(state, `Sold ${units.toFixed(4)} crypto for $${Math.round(proceeds).toLocaleString()}.`, 'money');
  return { ok: true, message: `Sold for $${Math.round(proceeds).toLocaleString()}.` };
}

export function depositSavings(state: GameState, amount: number): ActionResult {
  const p = state.player;
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= amount;
  p.savingsBalance += amount;
  return { ok: true, message: `Deposited $${Math.round(amount).toLocaleString()} into savings.` };
}

export function withdrawSavings(state: GameState, amount: number): ActionResult {
  const p = state.player;
  if (amount <= 0 || amount > p.savingsBalance) return { ok: false, message: 'Not enough in savings.' };
  p.savingsBalance -= amount;
  p.money += amount;
  return { ok: true, message: `Withdrew $${Math.round(amount).toLocaleString()}.` };
}

export function openTermDeposit(state: GameState, amount: number, years: number): ActionResult {
  const p = state.player;
  if (amount < 1_000 || amount > p.money) return { ok: false, message: 'Needs at least $1,000 you can spare.' };
  const yrs = clamp(Math.round(years), 1, 10);
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const rate = home.economy.interestRate + 0.005 + yrs * 0.002;
  p.money -= amount;
  p.termDeposits.push({ id: `td_${state.year}_${p.termDeposits.length}`, principal: amount, rate, yearsLeft: yrs });
  log(state, `Opened a ${yrs}-year term deposit at ${(rate * 100).toFixed(1)}%.`, 'money');
  return { ok: true, message: `Locked in ${(rate * 100).toFixed(1)}% for ${yrs} years.` };
}

export function foundCharityFoundation(state: GameState, name: string): ActionResult {
  const p = state.player;
  if (p.foundation) return { ok: false, message: 'You already run a foundation.' };
  const cost = 250_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()} to endow a foundation.` };
  p.money -= cost;
  p.foundation = { name: name.trim() || `The ${p.name.split(' ').pop()} Foundation`, endowment: cost, totalGiven: 0 };
  p.karma = clamp100(p.karma + 5);
  p.reputation = clamp100(p.reputation + 3);
  if (!state.achievements.includes('foundation_founder')) state.achievements.push('foundation_founder');
  log(state, `❤️ You founded ${p.foundation.name} with a $${cost.toLocaleString()} endowment.`, 'milestone');
  return { ok: true, message: `${p.foundation.name} is established.` };
}

export function donateToFoundation(state: GameState, amount: number): ActionResult {
  const p = state.player;
  if (!p.foundation) return { ok: false, message: 'Found a foundation first.' };
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= amount;
  p.foundation.endowment += amount;
  p.karma = clamp100(p.karma + Math.min(5, amount / 100_000));
  log(state, `Endowed ${p.foundation.name} with a further $${Math.round(amount).toLocaleString()}.`, 'money');
  return { ok: true, message: 'Endowment increased.' };
}

export function retire(state: GameState): ActionResult {
  const p = state.player;
  if (p.retired) return { ok: false, message: 'You are already retired.' };
  if (p.age < 60) return { ok: false, message: 'Retirement opens at age 60.' };
  const lastSalary = p.job?.salary ?? 0;
  const officeSalary = p.office ? 50_000 : 0;
  p.pensionIncome = Math.round(Math.max(12_000, (lastSalary + officeSalary) * 0.45));
  p.retired = true;
  p.job = null;
  p.happiness = clamp100(p.happiness + 8);
  if (!state.achievements.includes('retired')) state.achievements.push('retired');
  log(state, `🌅 You formally retired. Pension: $${p.pensionIncome.toLocaleString()}/yr.`, 'milestone');
  return { ok: true, message: `Retired with a $${p.pensionIncome.toLocaleString()}/yr pension.` };
}

export type CasinoGame = 'blackjack' | 'roulette' | 'slots';

export function playCasino(state: GameState, game: CasinoGame, stake: number): ActionResult {
  const p = state.player;
  if (stake <= 0 || stake > p.money) return { ok: false, message: 'Invalid stake.' };
  const rng = withRng(state);
  p.money -= stake;
  const pokerEdge = (p.skills[SK.poker] ?? 0) / 100;
  let winChance: number;
  let payoutMult: number;
  if (game === 'blackjack') {
    winChance = clamp(0.46 + pokerEdge * 0.08, 0.3, 0.56);
    payoutMult = 2;
  } else if (game === 'roulette') {
    winChance = 0.47;
    payoutMult = 2;
  } else {
    winChance = 0.12;
    payoutMult = 8;
  }
  const won = rng.chance(winChance);
  commit(state, rng);
  p.skills[SK.poker] = clamp100((p.skills[SK.poker] ?? 0) + 1);
  if (won) {
    const winnings = Math.round(stake * payoutMult);
    p.money += winnings;
    p.happiness = clamp100(p.happiness + 3);
    if (winnings - stake >= 50_000 && !state.achievements.includes('high_roller')) state.achievements.push('high_roller');
    log(state, `🎰 Won $${(winnings - stake).toLocaleString()} at the casino (${game}).`, 'money');
    return { ok: true, message: `You won $${(winnings - stake).toLocaleString()}!` };
  }
  p.happiness = clamp100(p.happiness - 2);
  log(state, `🎰 Lost $${stake.toLocaleString()} at the casino (${game}).`, 'bad');
  return { ok: true, message: `The house took your $${stake.toLocaleString()}.` };
}

export function writeMemoir(state: GameState, title: string): ActionResult {
  const p = state.player;
  if (p.memoir) return { ok: false, message: 'Your current memoir is still selling.' };
  if (p.age < 35) return { ok: false, message: 'You need a bit more life to write about — come back at 35.' };
  const fame = p.reputation + p.popularity + p.notoriety * 1.5;
  const rng = withRng(state);
  const royaltyPerYear = Math.round(Math.max(5_000, fame * rng.range(400, 900)));
  commit(state, rng);
  p.memoir = { title: title.trim() || `${p.name}: My Story`, yearsLeft: 5, royaltyPerYear };
  p.happiness = clamp100(p.happiness + 4);
  p.reputation = clamp100(p.reputation + 2);
  const bestseller = royaltyPerYear >= 60_000;
  if (bestseller && !state.achievements.includes('bestselling_author')) state.achievements.push('bestselling_author');
  log(state, `📖 You published "${p.memoir.title}"${bestseller ? ' — an instant bestseller' : ''}. Royalties: $${royaltyPerYear.toLocaleString()}/yr for 5 years.`, 'milestone');
  return { ok: true, message: bestseller ? 'A bestseller! Strong royalties locked in.' : 'Published. Modest royalties will trickle in.' };
}

export function bidToHostGlobalGames(state: GameState): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (home.globalGamesYear !== null) return { ok: false, message: 'Your nation is already preparing to host.' };
  const p = state.player;
  const cost = 25;
  if (p.politicalCapital < cost) return { ok: false, message: `Needs ${cost} political capital.` };
  p.politicalCapital = clamp(p.politicalCapital - cost, 0, 100);
  const rng = withRng(state);
  const chance = clamp(0.3 + (home.infrastructure - 50) * 0.005 + (home.stability - 50) * 0.004, 0.1, 0.75);
  const won = rng.chance(chance);
  commit(state, rng);
  if (!won) {
    p.popularity = clamp100(p.popularity - 2);
    log(state, `Your Global Games bid was passed over for a rival nation.`, 'bad');
    return { ok: false, message: 'The bid failed this cycle.' };
  }
  home.globalGamesYear = state.year + 5;
  p.popularity = clamp100(p.popularity + 5);
  logHistory(state, `🏟️ ${home.name} wins the bid to host the Global Games in ${home.globalGamesYear}`);
  log(state, `🏟️ ${home.name} won the bid to host the Global Games in ${home.globalGamesYear}!`, 'politics');
  return { ok: true, message: `Hosting the Global Games in ${home.globalGamesYear}.` };
}

export function startMoonshot(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.moonshot) return { ok: false, message: 'A moonshot is already underway.' };
  const cost = Math.max(200_000, c.revenue * 0.25);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash committed over the project.` };
  const rng = withRng(state);
  const years = rng.int(3, 5);
  commit(state, rng);
  c.moonshot = { yearsLeft: years, invested: cost };
  log(state, `🚀 ${c.name} committed $${Math.round(cost).toLocaleString()} to a ${years}-year moonshot project.`, 'business');
  return { ok: true, message: `Moonshot underway: ${years} years, $${Math.round(cost).toLocaleString()} committed.` };
}

export function hireCEO(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.ceoName) return { ok: false, message: `${c.ceoName} already runs ${c.name}.` };
  const rng = withRng(state);
  const skill = Math.round(rng.range(55, 92));
  const salary = Math.round(Math.max(120_000, c.revenue * 0.015) * (skill / 70));
  if (salary * 1.5 > c.cash) {
    commit(state, rng);
    return { ok: false, message: `The company can't afford a credible CEO (~$${salary.toLocaleString()}/yr).` };
  }
  const ceoName = makePersonName(rng, rng.chance(0.5) ? 'male' : 'female');
  commit(state, rng);
  c.ceoName = ceoName;
  c.ceoSkill = skill;
  c.ceoSalary = salary;
  if (!state.achievements.includes('chairman')) state.achievements.push('chairman');
  log(state, `🤝 ${ceoName} hired as CEO of ${c.name} (skill ${skill}, $${salary.toLocaleString()}/yr). You move to the chairman's seat.`, 'business');
  return { ok: true, message: `${ceoName} now runs ${c.name} day-to-day.` };
}

export function fireCEO(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active' || !c.ceoName) return { ok: false, message: 'No CEO to dismiss.' };
  const severance = Math.round(c.ceoSalary * 0.5);
  c.cash -= severance;
  log(state, `${c.ceoName} was dismissed as CEO of ${c.name} ($${severance.toLocaleString()} severance). You are back in charge.`, 'business');
  c.ceoName = null;
  c.ceoSkill = 0;
  c.ceoSalary = 0;
  return { ok: true, message: 'You are back running the company directly.' };
}

export const NEW_GAME_GENDERS: Gender[] = ['male', 'female'];
