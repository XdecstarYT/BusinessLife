/**
 * Entertainment Career: actor or musician fame path — auditions/roles, albums/tours, an agent
 * who takes a cut, awards shows, scandals and feuds. Self-contained leaf module (like
 * military.ts/drugs.ts), not routed through actions.ts. Static catalog in data/entertainment.ts.
 */
import type { EntertainmentCareer, EntertainmentProject, EntertainmentTrack, GameState } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { SK } from '../data/skills';
import { AGENT_CUT, AGENT_SIGN_COST, ALBUM_TITLE_WORDS, AWARDS, FILM_TITLE_WORDS, LABEL_NAMES, PROJECT_BUDGET_TIERS, STUDIO_NAMES } from '../data/entertainment';

export interface EntertainmentActionResult {
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
function requireAge(state: GameState, minAge: number, activity: string): EntertainmentActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
function isActive(c: EntertainmentCareer | null): c is EntertainmentCareer {
  return !!c && c.active;
}
function makeTitle(rng: RNG, track: EntertainmentTrack): string {
  const words = track === 'actor' ? FILM_TITLE_WORDS : ALBUM_TITLE_WORDS;
  return `${rng.pick(words.adjectives)} ${rng.pick(words.nouns)}`;
}

export function startEntertainmentCareer(state: GameState, track: EntertainmentTrack): EntertainmentActionResult {
  const ageGate = requireAge(state, 14, 'chasing fame');
  if (ageGate) return ageGate;
  const p = state.player;
  if (isActive(p.entertainmentCareer)) return { ok: false, message: 'You are already chasing fame.' };
  p.entertainmentCareer = {
    active: true, track, fame: 1, talent: clamp100(20 + (p.charisma - 50) * 0.3),
    wealth: 0, hasAgent: false, agentCut: 0, labelOrStudioId: null, projects: [],
    scandalsCount: 0, feudTargetName: null, retired: false,
  };
  log(state, track === 'actor' ? `You started chasing an acting career — first stop, open casting calls.` : `You started chasing a music career — first stop, open mics.`, 'info');
  return { ok: true, message: `${track === 'actor' ? 'Acting' : 'Music'} career started.` };
}

/** Unpaid work on your craft — the only lever available before you land your first project. */
export function trainCraft(state: GameState): EntertainmentActionResult {
  const c = state.player.entertainmentCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to start a career first.' };
  if (onCooldown(state, 'ent_train')) return { ok: false, message: 'Already trained this year.' };
  setCooldown(state, 'ent_train');
  const p = state.player;
  const rng = withRng(state);
  const gain = rng.range(1.5, 4) + (p.smarts - 50) * 0.02;
  c.talent = clamp100(c.talent + gain);
  const skillId = c.track === 'actor' ? SK.film : SK.marketing;
  p.skills[skillId] = clamp100((p.skills[skillId] ?? 0) + rng.range(1, 3));
  commit(state, rng);
  log(state, `Spent the year training your craft — talent up to ${Math.round(c.talent)}.`, 'info');
  return { ok: true, message: `Talent now ${Math.round(c.talent)}.` };
}

/** Sign with an agent/manager, who takes a cut of every future project payout in exchange for
 * better auditions and bigger opportunities. */
export function hireAgent(state: GameState): EntertainmentActionResult {
  const c = state.player.entertainmentCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to start a career first.' };
  if (c.hasAgent) return { ok: false, message: 'You already have an agent.' };
  const p = state.player;
  if (AGENT_SIGN_COST > p.money) return { ok: false, message: `Needs $${AGENT_SIGN_COST.toLocaleString()}.` };
  p.money -= AGENT_SIGN_COST;
  c.hasAgent = true;
  c.agentCut = AGENT_CUT;
  c.fame = clamp100(c.fame + 3);
  log(state, `Signed with an agent — better rooms, for a ${Math.round(AGENT_CUT * 100)}% cut.`, 'money');
  return { ok: true, message: 'Agent signed.' };
}

/** Audition/pitch for a role or record deal at the highest budget tier your fame qualifies for.
 * Success lands a project; failure just costs the year and a little talent-building consolation. */
export function auditionForProject(state: GameState): EntertainmentActionResult {
  const c = state.player.entertainmentCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to start a career first.' };
  if (onCooldown(state, 'ent_audition')) return { ok: false, message: 'Already auditioned this year.' };
  setCooldown(state, 'ent_audition');
  const p = state.player;
  const rng = withRng(state);
  const tier = [...PROJECT_BUDGET_TIERS].reverse().find((t) => c.fame >= t.minFame) ?? PROJECT_BUDGET_TIERS[0];
  const chance = clamp(0.25 + c.talent * 0.006 + c.fame * 0.003 + (c.hasAgent ? 0.15 : 0), 0.05, 0.9);
  if (!rng.chance(chance)) {
    c.talent = clamp100(c.talent + rng.range(0.5, 1.5));
    commit(state, rng);
    log(state, `Didn't land the ${tier.label.toLowerCase()} project you auditioned for. Keep grinding.`, 'bad');
    return { ok: false, message: 'No callback.' };
  }
  const kind: EntertainmentProject['kind'] = c.track === 'actor' ? 'film' : 'album';
  const title = makeTitle(rng, c.track);
  const houses = c.track === 'actor' ? STUDIO_NAMES : LABEL_NAMES;
  const house = rng.pick(houses);
  c.labelOrStudioId = house;
  const performanceScore = clamp100(rng.range(20, 55) + c.talent * 0.4 + c.fame * 0.1);
  const grossMult = performanceScore / 50;
  const grossPayout = Math.round(tier.budget * 0.08 * grossMult);
  const cut = c.hasAgent ? c.agentCut : 0;
  const netPayout = Math.round(grossPayout * (1 - cut));
  p.money += netPayout;
  c.wealth += netPayout;
  const project: EntertainmentProject = {
    id: `ent_${state.year}_${c.projects.length}`, title, kind, yearReleased: state.year,
    budgetOrBudgetTier: tier.tier, performanceScore, awardsWon: [],
  };
  c.projects.push(project);
  const fameGain = clamp(performanceScore * 0.25 * (tier.tier * 0.5), 1, 25);
  c.fame = clamp100(c.fame + fameGain);
  p.notoriety = clamp100(p.notoriety + fameGain * 0.2);
  if (c.projects.length === 1) awardAchievement(state, 'entertainment_star');
  if (c.fame >= 60) awardAchievement(state, 'superstar');
  commit(state, rng);
  log(state, `🎬 "${title}" (${tier.label}) released via ${house} — earned $${netPayout.toLocaleString()}. Fame up to ${Math.round(c.fame)}.`, 'money');
  return { ok: true, message: `"${title}" released, earning $${netPayout.toLocaleString()}.` };
}

/** Musicians only: a concert tour, monetizing existing fame rather than releasing new work. */
export function goOnTour(state: GameState): EntertainmentActionResult {
  const c = state.player.entertainmentCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to start a career first.' };
  if (c.track !== 'musician') return { ok: false, message: 'Only musicians can tour.' };
  if (onCooldown(state, 'ent_tour')) return { ok: false, message: 'Already toured this year.' };
  if (c.fame < 10) return { ok: false, message: 'You need more fame before venues will book you.' };
  setCooldown(state, 'ent_tour');
  const p = state.player;
  const rng = withRng(state);
  const grossPayout = Math.round(c.fame * rng.range(8_000, 22_000) * (1 + c.talent * 0.01));
  const cut = c.hasAgent ? c.agentCut : 0;
  const netPayout = Math.round(grossPayout * (1 - cut));
  p.money += netPayout;
  c.wealth += netPayout;
  p.health = clamp100(p.health - rng.range(3, 9));
  p.happiness = clamp100(p.happiness + rng.range(2, 8));
  c.fame = clamp100(c.fame + rng.range(1, 4));
  const project: EntertainmentProject = { id: `ent_${state.year}_${c.projects.length}`, title: `${makeTitle(rng, 'musician')} Tour`, kind: 'tour', yearReleased: state.year, budgetOrBudgetTier: 0, performanceScore: Math.round(clamp(c.fame + rng.range(-10, 10), 0, 100)), awardsWon: [] };
  c.projects.push(project);
  commit(state, rng);
  log(state, `🎤 Wrapped a tour — grossed $${netPayout.toLocaleString()}, but you're exhausted.`, 'money');
  return { ok: true, message: `Tour grossed $${netPayout.toLocaleString()}.` };
}

/** A publicity stunt: real risk of a scandal, but a shot at a big, cheap fame spike. */
export function courtControversy(state: GameState): EntertainmentActionResult {
  const c = state.player.entertainmentCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to start a career first.' };
  if (onCooldown(state, 'ent_controversy')) return { ok: false, message: 'Already stirred things up this year.' };
  setCooldown(state, 'ent_controversy');
  const p = state.player;
  const rng = withRng(state);
  if (rng.chance(0.45)) {
    c.scandalsCount++;
    c.fame = clamp100(c.fame - rng.range(5, 15));
    p.reputation = clamp100(p.reputation - rng.range(8, 18));
    p.notoriety = clamp100(p.notoriety + rng.range(10, 20));
    if (c.scandalsCount >= 3) awardAchievement(state, 'scandal_survivor');
    commit(state, rng);
    log(state, `📰 The stunt blew up in your face — a real scandal, and your reputation took a hit.`, 'bad');
    return { ok: false, message: 'Backfired into a scandal.' };
  }
  const fameGain = rng.range(4, 12);
  c.fame = clamp100(c.fame + fameGain);
  p.notoriety = clamp100(p.notoriety + fameGain * 0.5);
  commit(state, rng);
  log(state, `Pulled off a headline-grabbing stunt — fame up to ${Math.round(c.fame)}.`, 'info');
  return { ok: true, message: `Fame up to ${Math.round(c.fame)}.` };
}

/** Attend the year's awards show; you're only nominated if you released something recent and good. */
export function attendAwardsShow(state: GameState): EntertainmentActionResult {
  const c = state.player.entertainmentCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to start a career first.' };
  if (onCooldown(state, 'ent_awards')) return { ok: false, message: 'Already been to this year\'s ceremony.' };
  setCooldown(state, 'ent_awards');
  const recent = c.projects.filter((pr) => state.year - pr.yearReleased <= 1 && pr.performanceScore >= 55);
  if (!recent.length) return { ok: false, message: 'You need a strong recent project to get nominated.' };
  const rng = withRng(state);
  const eligible = AWARDS.filter((a) => a.track === 'both' || a.track === c.track);
  const nomination = rng.pick(eligible);
  const best = recent.reduce((a, b) => (a.performanceScore > b.performanceScore ? a : b));
  const chance = clamp(0.15 + best.performanceScore * 0.006 + c.fame * 0.003, 0.05, 0.7);
  if (rng.chance(chance)) {
    best.awardsWon.push(nomination.id);
    c.fame = clamp100(c.fame + nomination.prestige * 0.3);
    state.player.reputation = clamp100(state.player.reputation + nomination.prestige * 0.1);
    if (nomination.id === 'lifetime_achievement') awardAchievement(state, 'hall_of_fame_entertainer');
    awardAchievement(state, nomination.track === 'actor' ? 'oscar_winner' : nomination.track === 'musician' ? 'grammy_winner' : 'hall_of_fame_entertainer');
    commit(state, rng);
    log(state, `${nomination.icon} You won ${nomination.name} for "${best.title}"!`, 'milestone');
    return { ok: true, message: `Won ${nomination.name}!` };
  }
  commit(state, rng);
  log(state, `Nominated for ${nomination.name} but didn't take it home.`, 'info');
  return { ok: false, message: `Nominated for ${nomination.name}, lost.` };
}

/** Walk away from the spotlight for good. A career with only one project is a "one-hit wonder";
 * one that peaked high before stopping earns the hall-of-fame-adjacent retired-legend badge. */
export function retireFromEntertainment(state: GameState): EntertainmentActionResult {
  const c = state.player.entertainmentCareer;
  if (!isActive(c)) return { ok: false, message: 'You are not in the industry.' };
  c.active = false;
  c.retired = true;
  if (c.projects.length === 1) awardAchievement(state, 'one_hit_wonder');
  if (c.fame >= 70) awardAchievement(state, 'retired_legend');
  state.player.happiness = clamp100(state.player.happiness + 5);
  log(state, `You stepped away from the spotlight for good.`, 'good');
  return { ok: true, message: 'Retired from entertainment.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — passive fame decay, aging out, feud flareups
// ---------------------------------------------------------------------------

export function tickEntertainmentCareer(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const c = state.player.entertainmentCareer;
  if (!isActive(c)) return headlines;
  const p = state.player;

  // Fame decays if you don't keep working, faster once you're already famous.
  const recentWork = c.projects.some((pr) => state.year - pr.yearReleased <= 2);
  if (!recentWork) c.fame = clamp100(c.fame - clamp(c.fame * 0.04, 0.5, 6));

  // A rival feud can flare up unprompted once you're famous enough to have enemies.
  if (!c.feudTargetName && c.fame > 30 && rng.chance(0.06)) {
    c.feudTargetName = rng.pick(['a rival co-star', 'a chart rival', 'a former collaborator', 'an industry critic']);
    p.happiness = clamp100(p.happiness - 3);
    headlines.push(`${p.name} is now feuding publicly with ${c.feudTargetName}`);
  } else if (c.feudTargetName && rng.chance(0.3)) {
    c.feudTargetName = null;
  }

  if (c.fame >= 90 && !state.achievements.includes('superstar')) state.achievements.push('superstar');
  return headlines;
}
