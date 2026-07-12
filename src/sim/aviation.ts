/**
 * Aviation Career: student pilot → first officer → airline captain. Self-contained leaf module
 * (like legal.ts / medical.ts), not routed through actions.ts. Static catalog in data/aviation.ts.
 *
 * The signature loop is flying: `runFlight(state, score)` takes a 0..1 performance score from the
 * playable 3D FlightScene minigame (see ui/three/FlightScene.tsx) and resolves a real flight leg —
 * logging block hours (which gate the next license), paying you, and drifting your safety rating.
 * A rough flight risks a safety incident; three incidents suspend your license for good, the same
 * escalating-strike pattern legal.ts uses for bar complaints.
 */
import type { GameState, AviationCareer } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { SK } from '../data/skills';
import {
  AIRCRAFT_BY_ID, AIRLINE_NAMES, CAPTAIN_RANK_TITLES, FIRST_OFFICER_SALARY, FLIGHT_SCHOOL_COST_PER_YEAR,
  MAX_INCIDENTS, PILOT_LICENSES, PILOT_LICENSE_BY_ID, ROUTE_BY_ID, ROUTES, licenseRank,
} from '../data/aviation';

export interface AviationActionResult {
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
function requireAge(state: GameState, minAge: number, activity: string): AviationActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
function isActive(c: AviationCareer | null): c is AviationCareer {
  return !!c && c.active;
}

export function enrollFlightSchool(state: GameState): AviationActionResult {
  const ageGate = requireAge(state, 17, 'flight school');
  if (ageGate) return ageGate;
  const p = state.player;
  if (isActive(p.aviation)) return { ok: false, message: 'You are already training as a pilot.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  if (p.money < FLIGHT_SCHOOL_COST_PER_YEAR) return { ok: false, message: `You need at least $${FLIGHT_SCHOOL_COST_PER_YEAR.toLocaleString()} to start flight school.` };
  p.aviation = {
    active: true, stage: 'flight_school', licenseId: null, airlineName: null, aircraftId: 'cessna172',
    typeRatings: ['cessna172'], yearsOfService: 0, hoursLogged: 0, flightsCompleted: 0,
    skill: 12, safetyRating: 80, incidents: 0, rank: 0, licenseSuspended: false,
  };
  log(state, `You enrolled in flight school and stepped into a Cessna 172 for your first lesson.`, 'info');
  return { ok: true, message: 'Enrolled in flight school.' };
}

/** Test for the next license up (PPL → CPL → ATPL) once you've logged the required hours. */
export function earnLicense(state: GameState): AviationActionResult {
  const c = state.player.aviation;
  if (!isActive(c)) return { ok: false, message: 'You need to be training as a pilot.' };
  if (c.licenseSuspended) return { ok: false, message: 'Your license is suspended — you cannot test for a new rating.' };
  const nextIdx = licenseRank(c.licenseId) + 1;
  if (nextIdx >= PILOT_LICENSES.length) return { ok: false, message: 'You already hold the highest license there is.' };
  const next = PILOT_LICENSES[nextIdx];
  if (c.hoursLogged < next.hoursRequired) {
    return { ok: false, message: `You need ${next.hoursRequired} logged hours for the ${next.short} — you have ${Math.floor(c.hoursLogged)}.` };
  }
  const p = state.player;
  if (p.money < next.cost) return { ok: false, message: `The ${next.short} checkride and coursework cost $${next.cost.toLocaleString()}.` };
  if (onCooldown(state, 'aviation_license')) return { ok: false, message: 'Already sat a checkride this year.' };
  setCooldown(state, 'aviation_license');
  p.money -= next.cost;
  const rng = withRng(state);
  const passChance = clamp(0.6 + c.skill * 0.004 + (p.smarts - 50) * 0.003, 0.25, 0.97);
  if (!rng.chance(passChance)) {
    commit(state, rng);
    log(state, `You failed the ${next.short} checkride this attempt — you can retest next year.`, 'bad');
    return { ok: false, message: `Failed the ${next.short} checkride.` };
  }
  c.licenseId = next.id;
  commit(state, rng);
  if (next.id === 'ppl') awardAchievement(state, 'first_wings');
  if (next.id === 'atpl') awardAchievement(state, 'airline_rated');
  // Passing the CPL graduates you from the school into the job market as a first officer.
  if (next.id === 'cpl' && c.stage === 'flight_school') {
    c.stage = 'first_officer';
    c.airlineName = rng.pick(AIRLINE_NAMES);
    c.aircraftId = 'regionaljet';
    if (!c.typeRatings.includes('regionaljet')) c.typeRatings.push('regionaljet');
    log(state, `You earned your ${next.name} and signed on as a First Officer at ${c.airlineName}.`, 'milestone');
    return { ok: true, message: `Earned your ${next.short} — hired as a First Officer.` };
  }
  log(state, `You passed the ${next.name} checkride.`, 'milestone');
  return { ok: true, message: `Earned your ${next.short}.` };
}

/** Add a type rating so you can fly a bigger, better-paying aircraft. */
export function addTypeRating(state: GameState, aircraftId: string): AviationActionResult {
  const c = state.player.aviation;
  if (!isActive(c)) return { ok: false, message: 'You need to be an active pilot.' };
  const ac = AIRCRAFT_BY_ID[aircraftId];
  if (!ac) return { ok: false, message: 'Unknown aircraft type.' };
  if (c.typeRatings.includes(aircraftId)) return { ok: false, message: `You already hold a ${ac.name} rating.` };
  if (licenseRank(c.licenseId) < licenseRank(ac.minLicense)) {
    return { ok: false, message: `The ${ac.name} requires a ${PILOT_LICENSE_BY_ID[ac.minLicense].short} first.` };
  }
  const p = state.player;
  if (p.money < ac.typeRatingCost) return { ok: false, message: `A ${ac.name} type rating costs $${ac.typeRatingCost.toLocaleString()}.` };
  p.money -= ac.typeRatingCost;
  c.typeRatings.push(aircraftId);
  c.aircraftId = aircraftId;
  if (aircraftId === 'superjumbo') awardAchievement(state, 'superjumbo_rated');
  log(state, `You earned a type rating on the ${ac.name} and moved to the flight deck.`, 'good');
  return { ok: true, message: `Type-rated on the ${ac.name}.` };
}

/** Set which of your held type ratings you're currently flying. */
export function selectAircraft(state: GameState, aircraftId: string): AviationActionResult {
  const c = state.player.aviation;
  if (!isActive(c)) return { ok: false, message: 'You need to be an active pilot.' };
  if (!c.typeRatings.includes(aircraftId)) return { ok: false, message: 'You are not type-rated on that aircraft.' };
  c.aircraftId = aircraftId;
  return { ok: true, message: `Now flying the ${AIRCRAFT_BY_ID[aircraftId].name}.` };
}

/** Resolve a flown leg. `score` (0..1) is the FlightScene minigame performance. Logs block hours,
 * pays block pay, drifts safety, and risks an incident on a poorly-flown leg. */
export function runFlight(state: GameState, routeId: string, score: number): AviationActionResult {
  const c = state.player.aviation;
  if (!isActive(c)) return { ok: false, message: 'You need to be an active pilot.' };
  if (c.licenseSuspended) return { ok: false, message: 'Your license is suspended — you cannot fly.' };
  if (onCooldown(state, 'aviation_flight')) return { ok: false, message: 'You have already flown your duty legs this year.' };
  setCooldown(state, 'aviation_flight');
  const route = ROUTE_BY_ID[routeId] ?? ROUTES[0];
  const ac = c.aircraftId ? AIRCRAFT_BY_ID[c.aircraftId] : AIRCRAFT_BY_ID.cessna172;
  const p = state.player;
  const rng = withRng(state);
  const s = clamp(score, 0, 1);

  c.hoursLogged += route.hours;
  c.flightsCompleted++;
  // Skill grows faster on a well-flown leg; block pay scales with the aircraft and route.
  c.skill = clamp100(c.skill + rng.range(1, 3) + s * 2);
  p.skills[SK.aviation] = clamp100((p.skills[SK.aviation] ?? 0) + rng.range(1, 3));

  // Block pay only really lands once you're at least a first officer flying revenue routes.
  if (c.stage !== 'flight_school') {
    const pay = Math.round(ac.basePay * 0.06 * route.payMult * (0.6 + s * 0.8));
    p.money += pay;
  }

  // A demanding aircraft flown badly can produce a real safety incident. Skill and a sharp
  // minigame score both push the risk down; three incidents ground you for good.
  const incidentRisk = clamp((ac.difficulty * 0.004) * (1 - s) * (1 - c.skill / 200), 0.005, 0.4);
  if (rng.chance(incidentRisk)) {
    c.incidents++;
    c.safetyRating = clamp100(c.safetyRating - rng.range(12, 22));
    p.happiness = clamp100(p.happiness - 6);
    if (c.incidents >= MAX_INCIDENTS) {
      c.licenseSuspended = true;
      c.active = false;
      awardAchievement(state, 'grounded');
      commit(state, rng);
      log(state, `🚨 A third safety incident cost you your license. Your flying career is over.`, 'bad');
      return { ok: false, message: 'License suspended after repeated incidents.' };
    }
    commit(state, rng);
    log(state, `⚠️ A rough leg into turbulence became a reportable safety incident. Two more and you're grounded.`, 'bad');
    return { ok: false, message: `Safety incident logged (${c.incidents}/${MAX_INCIDENTS}).` };
  }

  // Clean flight: nudge safety back up, small happiness lift, perfect-score achievement.
  c.safetyRating = clamp100(c.safetyRating + (s > 0.6 ? rng.range(1, 3) : 0));
  p.happiness = clamp100(p.happiness + (s > 0.8 ? 3 : 1));
  if (s >= 0.97) awardAchievement(state, 'greaser_landing');
  if (c.flightsCompleted >= 100) awardAchievement(state, 'century_of_flights');
  commit(state, rng);
  log(state, `You flew the ${route.name} on the ${ac.name} — ${Math.round(s * 100)}% clean. Logged ${route.hours}h.`, 'good');
  return { ok: true, message: `Flight complete — ${Math.round(s * 100)}% score, +${route.hours}h.` };
}

/** Push for the next captain rank. Only meaningful once you've upgraded to captain. */
export function seekCaptainPromotion(state: GameState): AviationActionResult {
  const c = state.player.aviation;
  if (!isActive(c) || c.stage !== 'captain') return { ok: false, message: 'You need to be a captain.' };
  if (c.rank >= CAPTAIN_RANK_TITLES.length - 1) return { ok: false, message: 'You have reached the top of the ladder — Chief Pilot.' };
  if (onCooldown(state, 'aviation_promotion')) return { ok: false, message: 'Already sought promotion this year.' };
  setCooldown(state, 'aviation_promotion');
  const rng = withRng(state);
  const chance = clamp(0.15 + c.skill * 0.005 + c.safetyRating * 0.003 - c.incidents * 0.1, 0.05, 0.8);
  if (rng.chance(chance)) {
    c.rank++;
    commit(state, rng);
    const title = CAPTAIN_RANK_TITLES[c.rank];
    if (c.rank === CAPTAIN_RANK_TITLES.length - 1) awardAchievement(state, 'chief_pilot');
    log(state, `Promoted to ${title}.`, 'good');
    return { ok: true, message: `Promoted to ${title}.` };
  }
  commit(state, rng);
  log(state, `Passed over for the upgrade this bid cycle.`, 'bad');
  return { ok: false, message: 'Passed over for promotion.' };
}

export function retireFromAviation(state: GameState): AviationActionResult {
  const c = state.player.aviation;
  if (!isActive(c)) return { ok: false, message: 'You are not an active pilot.' };
  c.active = false;
  c.stage = 'retired';
  state.player.happiness = clamp100(state.player.happiness + 5);
  if (c.flightsCompleted >= 100) awardAchievement(state, 'century_of_flights');
  log(state, `You hung up your wings after ${c.flightsCompleted} flights and ${Math.floor(c.hoursLogged)} logged hours.`, 'good');
  return { ok: true, message: 'Retired from aviation.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — tuition/salary, stage upgrade to captain, ambient safety drift
// ---------------------------------------------------------------------------

export function tickAviation(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const c = state.player.aviation;
  if (!isActive(c)) return headlines;
  const p = state.player;
  if (p.inJailYears > 0) return headlines;

  c.yearsOfService++;

  if (c.stage === 'flight_school') {
    p.money -= FLIGHT_SCHOOL_COST_PER_YEAR;
    // Passive hour-building between minigame flights so the school phase progresses even if you
    // don't fly the minigame every single year.
    c.hoursLogged += rng.range(20, 45);
    c.skill = clamp100(c.skill + rng.range(1, 3));
    if (!c.licenseId && c.hoursLogged >= PILOT_LICENSES[0].hoursRequired) {
      headlines.push(`${p.name} has logged enough hours to test for a Private Pilot License`);
    }
  } else if (c.stage === 'first_officer') {
    p.money += FIRST_OFFICER_SALARY;
    c.hoursLogged += rng.range(300, 600); // line flying builds hours fast
    c.skill = clamp100(c.skill + rng.range(2, 4));
    // Upgrade to captain once you hold an ATPL and enough seasoning.
    if (c.licenseId === 'atpl' && c.skill >= 45 && c.flightsCompleted >= 3) {
      c.stage = 'captain';
      c.rank = 0;
      headlines.push(`${p.name} upgraded to Captain at ${c.airlineName}`);
    }
  } else if (c.stage === 'captain') {
    const ac = c.aircraftId ? AIRCRAFT_BY_ID[c.aircraftId] : AIRCRAFT_BY_ID.regionaljet;
    const rankMult = 1 + c.rank * 0.25;
    const salary = Math.round(ac.basePay * rankMult * (0.75 + c.skill * 0.004));
    p.money += salary;
    c.hoursLogged += rng.range(400, 700);
  }

  // Safety rating drifts gently back toward a healthy baseline between incidents.
  c.safetyRating = clamp100(c.safetyRating + (c.safetyRating < 80 ? 1 : 0));
  return headlines;
}
