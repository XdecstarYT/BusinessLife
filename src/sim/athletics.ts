/**
 * Athlete career: soccer, (American) football, and running. A self-contained leaf module
 * (like casino.ts) — not routed through actions.ts — imported directly by the Athlete screen
 * and the three playable 3D match/race scenes. The player's own matches/races are resolved
 * from real outcomes the 3D scenes produce (resolveMatch / resolveRace); every other team's
 * result in the league is resolved statistically once a year in tickAthleteSeason so standings
 * keep evolving without forcing the player to play hundreds of AI-vs-AI games.
 */
import type {
  AthleteCareer, AthleteCareerStats, AthleteInjury, AthleteLevel,
  AthleteSport, AthleteTeamState, GameState,
} from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import {
  AA, ATHLETE_TEAMS, ATTRS_BY_SPORT, ENDORSEMENT_BRANDS, INJURY_TYPES, LEAGUE_BY_ID,
  POSITIONS_BY_SPORT, RUNNING_EVENT_BY_ID, RUNNING_MEET_BY_ID, RUNNING_MEETS, TEAM_BY_ID,
  TRAINING_BY_ID, teamsInLeague, type AthleteTeamDef,
} from '../data/athletics';

export interface AthleteActionResult {
  ok: boolean;
  message: string;
}

// Local copies of actions.ts's RNG-draw/cooldown patterns — not imported from there to keep
// this a dependency-free leaf module, same convention as casino.ts and family.ts.
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
function requireAge(state: GameState, minAge: number, activity: string): AthleteActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}

function sportLabel(sport: AthleteSport): string {
  return sport === 'soccer' ? 'soccer' : sport === 'football' ? 'football' : 'track & field';
}

function emptyStats(): AthleteCareerStats {
  return {
    seasonsPlayed: 0, matchesPlayed: 0, goals: 0, assists: 0, cleanSheets: 0,
    passingYards: 0, rushingYards: 0, receivingYards: 0, touchdowns: 0, tackles: 0, interceptions: 0,
    racesRun: 0, racesWon: 0, medalsGold: 0, medalsSilver: 0, medalsBronze: 0, mvpAwards: 0,
  };
}

function runningWeights(eventId: string): Record<string, number> {
  const ev = RUNNING_EVENT_BY_ID[eventId];
  const w = AA.running;
  if (!ev || ev.type === 'sprint') return { [w.speed]: 2.5, [w.acceleration]: 2, [w.technique]: 1.2, [w.endurance]: 0.5, [w.mentalToughness]: 1 };
  if (ev.type === 'middle') return { [w.speed]: 1.5, [w.acceleration]: 1, [w.endurance]: 2, [w.technique]: 1, [w.mentalToughness]: 1.5 };
  return { [w.endurance]: 2.8, [w.mentalToughness]: 2, [w.technique]: 1, [w.speed]: 0.6, [w.acceleration]: 0.4 };
}

/** Composite 0..100 rating: position-relevant attributes (soccer/football) or event-relevant
 * attributes (running) count roughly double. Exported so UI can preview a training pick's effect. */
export function computeAthleteOverall(career: AthleteCareer): number {
  if (career.sport === 'running') {
    const weights = runningWeights(career.event ?? '100m');
    let sum = 0, weight = 0;
    for (const [attrId, w] of Object.entries(weights)) {
      sum += (career.attributes[attrId] ?? 0) * w;
      weight += w;
    }
    return clamp(Math.round(sum / Math.max(0.001, weight)), 0, 100);
  }
  const positions = POSITIONS_BY_SPORT[career.sport];
  const posDef = positions.find((p) => p.id === career.position);
  const defs = ATTRS_BY_SPORT[career.sport];
  let sum = 0, weight = 0;
  for (const d of defs) {
    const v = career.attributes[d.id] ?? 0;
    const w = posDef?.primaryAttrs.includes(d.id) ? 2.2 : 1;
    sum += v * w;
    weight += w;
  }
  return clamp(Math.round(sum / Math.max(1, weight)), 0, 100);
}

function ageCurveTeamSport(age: number): number {
  if (age < 16) return 1.6;
  if (age < 20) return 1.3;
  if (age < 27) return 1.0;
  if (age < 31) return 0.3;
  if (age < 34) return -0.5;
  return -1.2;
}
function ageCurveRunning(age: number): number {
  if (age < 16) return 1.5;
  if (age < 20) return 1.3;
  if (age < 29) return 1.0;
  if (age < 33) return 0.2;
  if (age < 37) return -0.6;
  return -1.3;
}
function ageFactorFor(career: AthleteCareer, age: number): number {
  return career.sport === 'running' ? ageCurveRunning(age) : ageCurveTeamSport(age);
}

function applyInjury(state: GameState, career: AthleteCareer, rng: RNG): void {
  const pool = INJURY_TYPES.filter((i) => i.sports.includes(career.sport));
  if (!pool.length) return;
  const def = rng.pick(pool);
  const severity = rng.int(def.minSeverity, def.maxSeverity);
  const weeksOut = rng.int(def.minWeeks, def.maxWeeks);
  const injury: AthleteInjury = {
    kind: def.id, name: def.name, severity, weeksOut, startYear: state.year,
    reinjuryRisk: clamp(severity * 4, 5, 60),
  };
  career.injuries.push(injury);
  career.currentInjury = injury;
  career.fitness = clamp100(career.fitness - severity * 3);
  log(state, `🚑 Injury: ${def.name} — expected out ~${weeksOut} weeks.`, 'bad');
}

// ---------------------------------------------------------------------------
// Career start / training
// ---------------------------------------------------------------------------

export function startAthleteCareer(state: GameState, sport: AthleteSport, positionOrEvent: string): AthleteActionResult {
  const p = state.player;
  const ageGate = requireAge(state, 6, 'organized youth sports');
  if (ageGate) return ageGate;
  if (p.athlete && !p.athlete.retired) return { ok: false, message: 'You already have an active athletic career.' };
  if (sport === 'running') {
    if (!RUNNING_EVENT_BY_ID[positionOrEvent]) return { ok: false, message: 'Unknown event.' };
  } else if (!POSITIONS_BY_SPORT[sport].some((pos) => pos.id === positionOrEvent)) {
    return { ok: false, message: 'Unknown position.' };
  }
  const rng = withRng(state);
  const attrs: Record<string, number> = {};
  for (const d of ATTRS_BY_SPORT[sport]) attrs[d.id] = clamp(rng.int(5, 22) + Math.round(p.smarts * 0.04), 0, 100);
  const potentialCeiling = clamp(rng.int(45, 99), 0, 100);
  const level: AthleteLevel = p.age < 16 ? 'youth' : p.age < 18 ? 'academy' : 'semipro';
  const career: AthleteCareer = {
    sport,
    position: sport === 'running' ? '' : positionOrEvent,
    event: sport === 'running' ? positionOrEvent : null,
    level,
    attributes: attrs,
    overallRating: 0,
    potentialCeiling,
    fitness: 100,
    form: 50,
    morale: 70,
    teamId: null,
    leagueId: null,
    contract: null,
    injuries: [],
    currentInjury: null,
    trainingFocus: null,
    seasonStats: emptyStats(),
    careerStats: emptyStats(),
    personalBests: {},
    endorsements: [],
    yearsPro: 0,
    retired: false,
    hallOfFame: false,
    startedYear: state.year,
    fixtures: [],
    nextMeetId: sport === 'running' ? RUNNING_MEETS[0].id : null,
    seasonYear: state.year,
  };
  career.overallRating = computeAthleteOverall(career);
  p.athlete = career;
  commit(state, rng);
  const label = sport === 'soccer' ? '⚽' : sport === 'football' ? '🏈' : '🏃';
  log(state, `${label} You joined organized ${sportLabel(sport)} — the start of an athletic career.`, 'milestone');
  return { ok: true, message: `Your ${sportLabel(sport)} career begins.` };
}

export function trainAthlete(state: GameState, programId: string): AthleteActionResult {
  const p = state.player;
  const career = p.athlete;
  if (!career || career.retired) return { ok: false, message: 'You have no active athletic career.' };
  if (onCooldown(state, 'athlete_train')) return { ok: false, message: 'Already trained this year — try again next year.' };
  const program = TRAINING_BY_ID[programId];
  if (!program || program.sport !== career.sport) return { ok: false, message: 'Invalid training program.' };
  if (program.cost > p.money) return { ok: false, message: `Training costs $${program.cost.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= program.cost;
  setCooldown(state, 'athlete_train');
  const roomToGrow = Math.max(0, career.potentialCeiling - (career.attributes[program.attrId] ?? 0));
  const factor = Math.max(0.15, ageFactorFor(career, p.age));
  const gain = program.gain * factor * (0.5 + rng.next());
  career.attributes[program.attrId] = clamp((career.attributes[program.attrId] ?? 0) + Math.min(gain, roomToGrow + 2), 0, 100);
  career.fitness = clamp100(career.fitness - rng.range(5, 15));
  career.morale = clamp100(career.morale + rng.range(-2, 6));
  career.trainingFocus = program.attrId;
  if (rng.chance(program.injuryRiskPct / 100)) applyInjury(state, career, rng);
  career.overallRating = computeAthleteOverall(career);
  commit(state, rng);
  log(state, `💪 Training: ${program.name}.`, 'info');
  return { ok: true, message: `Trained: ${program.name}.` };
}

// ---------------------------------------------------------------------------
// Teams, contracts, trades
// ---------------------------------------------------------------------------

export function availableTeamsForTryout(state: GameState): AthleteTeamDef[] {
  const career = state.player.athlete;
  if (!career || career.sport === 'running') return [];
  return ATHLETE_TEAMS.filter((t) => t.sport === career.sport);
}

function ensureTeamState(state: GameState, teamId: string, year: number): AthleteTeamState {
  let ts = state.athleteTeams[teamId];
  if (!ts || ts.seasonYear !== year) {
    ts = { teamId, wins: 0, losses: 0, draws: 0, points: 0, goalsFor: 0, goalsAgainst: 0, seasonYear: year };
    state.athleteTeams[teamId] = ts;
  }
  return ts;
}

function ensureSeasonFixtures(state: GameState, career: AthleteCareer, rng: RNG): void {
  if (career.sport === 'running' || !career.leagueId || !career.teamId) return;
  if (career.seasonYear === state.year && career.fixtures.length) return;
  const opponents = teamsInLeague(career.leagueId).filter((t) => t.id !== career.teamId);
  const shuffled = rng.shuffle(opponents);
  const count = Math.min(8, shuffled.length);
  career.fixtures = shuffled.slice(0, count).map((t, i) => ({
    id: `fx_${state.year}_${i}`, opponentTeamId: t.id, week: i + 1, played: false, resultSummary: null, playerRatingThisMatch: null,
  }));
  career.seasonYear = state.year;
  career.seasonStats = emptyStats();
  ensureTeamState(state, career.teamId, state.year);
}

export function tryoutForTeam(state: GameState, teamId: string): AthleteActionResult {
  const career = state.player.athlete;
  if (!career || career.retired) return { ok: false, message: 'You have no active athletic career.' };
  if (career.sport === 'running') return { ok: false, message: 'Running is an individual sport — enter meets instead.' };
  const ageGate = requireAge(state, 16, 'trying out for a team');
  if (ageGate) return ageGate;
  if (career.teamId) return { ok: false, message: 'You are already signed — request a trade or wait for free agency.' };
  const team = TEAM_BY_ID[teamId];
  if (!team || team.sport !== career.sport) return { ok: false, message: 'Unknown team.' };
  if (onCooldown(state, `athlete_tryout_${teamId}`)) return { ok: false, message: 'Already tried out there this year.' };
  const rng = withRng(state);
  setCooldown(state, `athlete_tryout_${teamId}`);
  const chance = clamp(0.15 + (career.overallRating - team.prestige) * 0.012 + (career.form - 50) * 0.002, 0.03, 0.85);
  if (!rng.chance(chance)) {
    commit(state, rng);
    return { ok: false, message: `${team.name} passed on signing you this time.` };
  }
  const salary = Math.round(15_000 + team.prestige * 900 + career.overallRating * 700);
  career.teamId = team.id;
  career.leagueId = team.leagueId;
  career.contract = { teamId: team.id, salary, signingBonus: Math.round(salary * 0.2), yearsLeft: rng.int(1, 3), performanceBonusPerGoalOrWin: Math.round(salary * 0.002) };
  career.level = team.prestige >= 80 ? 'pro' : 'semipro';
  state.player.money += career.contract.signingBonus;
  ensureSeasonFixtures(state, career, rng);
  commit(state, rng);
  log(state, `🖊️ Signed with ${team.name}! $${salary.toLocaleString()}/yr plus a $${career.contract.signingBonus.toLocaleString()} signing bonus.`, 'milestone');
  return { ok: true, message: `You signed with ${team.name}.` };
}

export function negotiateContract(state: GameState): AthleteActionResult {
  const career = state.player.athlete;
  if (!career || !career.contract || !career.teamId) return { ok: false, message: 'No contract to negotiate.' };
  if (career.contract.yearsLeft > 1) return { ok: false, message: 'Your contract still has time left.' };
  if (onCooldown(state, 'athlete_negotiate')) return { ok: false, message: 'Already negotiated this year.' };
  const rng = withRng(state);
  setCooldown(state, 'athlete_negotiate');
  const team = TEAM_BY_ID[career.teamId];
  const chance = clamp(0.4 + (career.form - 50) * 0.004 + (career.overallRating - 50) * 0.003, 0.1, 0.9);
  if (!rng.chance(chance)) {
    commit(state, rng);
    return { ok: false, message: `${team?.name ?? 'The club'} declined to extend your contract — you'll hit free agency.` };
  }
  const raise = 1 + clamp(career.form - 50, -20, 30) / 100;
  career.contract.salary = Math.round(career.contract.salary * raise);
  career.contract.yearsLeft = rng.int(2, 4);
  career.contract.signingBonus = Math.round(career.contract.salary * 0.15);
  state.player.money += career.contract.signingBonus;
  commit(state, rng);
  log(state, `📄 Extended your contract with ${team?.name}: $${career.contract.salary.toLocaleString()}/yr.`, 'money');
  return { ok: true, message: 'Contract extended.' };
}

export function requestTrade(state: GameState, targetTeamId: string): AthleteActionResult {
  const career = state.player.athlete;
  if (!career || !career.teamId) return { ok: false, message: 'No team to trade from.' };
  const target = TEAM_BY_ID[targetTeamId];
  if (!target || target.sport !== career.sport || target.id === career.teamId) return { ok: false, message: 'Invalid trade target.' };
  if (onCooldown(state, 'athlete_trade')) return { ok: false, message: 'Already requested a trade this year.' };
  const rng = withRng(state);
  setCooldown(state, 'athlete_trade');
  const chance = clamp(0.25 + (career.overallRating - target.prestige) * 0.01, 0.05, 0.7);
  if (!rng.chance(chance)) {
    commit(state, rng);
    return { ok: false, message: `${target.name} isn't interested right now.` };
  }
  const oldTeamName = TEAM_BY_ID[career.teamId]?.name;
  career.teamId = target.id;
  career.leagueId = target.leagueId;
  if (career.contract) career.contract.teamId = target.id;
  career.fixtures = [];
  career.morale = clamp100(career.morale + rng.range(-5, 10));
  ensureSeasonFixtures(state, career, rng);
  commit(state, rng);
  log(state, `🔄 Traded from ${oldTeamName} to ${target.name}.`, 'milestone');
  return { ok: true, message: `You're now with ${target.name}.` };
}

export function retireAthlete(state: GameState): AthleteActionResult {
  const career = state.player.athlete;
  if (!career || career.retired) return { ok: false, message: 'No active career to retire from.' };
  career.retired = true;
  career.level = 'retired';
  const cs = career.careerStats;
  const impactScore = cs.goals * 3 + cs.assists * 2 + cs.touchdowns * 4 + cs.tackles * 0.5
    + cs.medalsGold * 20 + cs.medalsSilver * 12 + cs.medalsBronze * 8 + cs.mvpAwards * 15 + career.overallRating;
  if (impactScore >= 120 && !state.achievements.includes('athlete_hall_of_fame')) {
    career.hallOfFame = true;
    state.achievements.push('athlete_hall_of_fame');
  }
  if (!state.achievements.includes('athlete_retired')) state.achievements.push('athlete_retired');
  const p = state.player;
  p.happiness = clamp100(p.happiness + (career.hallOfFame ? 10 : 4));
  log(state, career.hallOfFame
    ? `🏆 You retired from ${sportLabel(career.sport)} — a Hall of Fame career.`
    : `You retired from ${sportLabel(career.sport)}.`, 'milestone');
  return { ok: true, message: career.hallOfFame ? 'Hall of Fame career!' : 'You retired.' };
}

export function signEndorsement(state: GameState, brandId: string): AthleteActionResult {
  const career = state.player.athlete;
  if (!career || career.retired) return { ok: false, message: 'No active career.' };
  const brand = ENDORSEMENT_BRANDS.find((b) => b.id === brandId);
  if (!brand) return { ok: false, message: 'Unknown brand.' };
  if (career.overallRating < brand.minOverall) return { ok: false, message: `${brand.name} wants at least ${brand.minOverall} overall rating.` };
  if (career.endorsements.some((e) => e.brand === brand.name)) return { ok: false, message: 'Already endorsing this brand.' };
  if (career.endorsements.length >= 3) return { ok: false, message: 'You can only juggle 3 endorsement deals at once.' };
  const rng = withRng(state);
  const value = Math.round(brand.baseValue * (0.8 + career.overallRating / 100) * (0.85 + rng.next() * 0.3));
  career.endorsements.push({ brand: brand.name, annualValue: value, yearsLeft: rng.int(1, 3) });
  commit(state, rng);
  log(state, `🤝 Signed an endorsement deal with ${brand.name}: $${value.toLocaleString()}/yr.`, 'money');
  return { ok: true, message: `Signed with ${brand.name}.` };
}

// ---------------------------------------------------------------------------
// Match resolution (soccer / football) — called by the 3D scene when a played match ends,
// or by quickSimFixture when the player chooses to simulate instead of playing.
// ---------------------------------------------------------------------------

export interface MatchOutcomeInput {
  fixtureId: string;
  playerGoals: number;
  playerAssists: number;
  teamGoalsFor: number;
  teamGoalsAgainst: number;
  playerTouchdowns: number;
  playerPassingYards: number;
  playerRushingYards: number;
  playerReceivingYards: number;
  playerTackles: number;
  playerInterceptions: number;
  teamScoreFor: number;
  teamScoreAgainst: number;
}

export function resolveMatch(state: GameState, outcome: MatchOutcomeInput): AthleteActionResult {
  const p = state.player;
  const career = p.athlete;
  if (!career || !career.teamId) return { ok: false, message: 'No active team.' };
  const fixture = career.fixtures.find((f) => f.id === outcome.fixtureId);
  if (!fixture || fixture.played) return { ok: false, message: 'Invalid or already-played fixture.' };
  const rng = withRng(state);
  fixture.played = true;
  const isSoccer = career.sport === 'soccer';
  const forScore = isSoccer ? outcome.teamGoalsFor : outcome.teamScoreFor;
  const againstScore = isSoccer ? outcome.teamGoalsAgainst : outcome.teamScoreAgainst;
  const won = forScore > againstScore;
  const drew = isSoccer && forScore === againstScore;
  fixture.resultSummary = `${won ? 'W' : drew ? 'D' : 'L'} ${forScore}-${againstScore}`;

  let rating = 6.0 + (won ? 0.8 : drew ? 0.2 : -0.4);
  if (isSoccer) rating += outcome.playerGoals * 0.7 + outcome.playerAssists * 0.4;
  else rating += outcome.playerTouchdowns * 0.6 + outcome.playerTackles * 0.15 + outcome.playerInterceptions * 0.5;
  fixture.playerRatingThisMatch = clamp(Math.round(rating * 10) / 10, 0, 10);

  career.seasonStats.matchesPlayed++;
  career.careerStats.matchesPlayed++;
  if (isSoccer) {
    career.seasonStats.goals += outcome.playerGoals; career.careerStats.goals += outcome.playerGoals;
    career.seasonStats.assists += outcome.playerAssists; career.careerStats.assists += outcome.playerAssists;
    if (career.position === 'GK' && outcome.teamGoalsAgainst === 0) { career.seasonStats.cleanSheets++; career.careerStats.cleanSheets++; }
  } else {
    career.seasonStats.touchdowns += outcome.playerTouchdowns; career.careerStats.touchdowns += outcome.playerTouchdowns;
    career.seasonStats.passingYards += outcome.playerPassingYards; career.careerStats.passingYards += outcome.playerPassingYards;
    career.seasonStats.rushingYards += outcome.playerRushingYards; career.careerStats.rushingYards += outcome.playerRushingYards;
    career.seasonStats.receivingYards += outcome.playerReceivingYards; career.careerStats.receivingYards += outcome.playerReceivingYards;
    career.seasonStats.tackles += outcome.playerTackles; career.careerStats.tackles += outcome.playerTackles;
    career.seasonStats.interceptions += outcome.playerInterceptions; career.careerStats.interceptions += outcome.playerInterceptions;
  }

  const ts = ensureTeamState(state, career.teamId, state.year);
  if (won) { ts.wins++; ts.points += isSoccer ? 3 : 1; }
  else if (drew) { ts.draws++; ts.points += 1; }
  else ts.losses++;
  if (isSoccer) { ts.goalsFor += forScore; ts.goalsAgainst += againstScore; }

  career.fitness = clamp100(career.fitness - rng.range(8, 18));
  career.form = clamp100(career.form + (won ? rng.range(2, 8) : drew ? rng.range(-1, 3) : rng.range(-8, -2)));
  career.morale = clamp100(career.morale + (won ? rng.range(1, 5) : rng.range(-4, 1)));
  if (career.contract) {
    const bonusUnits = isSoccer ? outcome.playerGoals : won ? 1 : 0;
    p.money += bonusUnits * career.contract.performanceBonusPerGoalOrWin;
  }
  if (rng.chance(0.05 + Math.max(0, 80 - career.fitness) * 0.001)) applyInjury(state, career, rng);

  career.overallRating = computeAthleteOverall(career);
  commit(state, rng);
  const oppName = TEAM_BY_ID[fixture.opponentTeamId]?.name ?? 'opponent';
  log(state, `${isSoccer ? '⚽' : '🏈'} vs ${oppName}: ${fixture.resultSummary}. Match rating ${fixture.playerRatingThisMatch}/10.`, won ? 'good' : drew ? 'info' : 'bad');
  return { ok: true, message: fixture.resultSummary! };
}

/** Statistical shortcut for a fixture the player chooses not to play out in 3D. */
export function quickSimFixture(state: GameState, fixtureId: string): AthleteActionResult {
  const career = state.player.athlete;
  if (!career) return { ok: false, message: 'No active career.' };
  const fixture = career.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || fixture.played) return { ok: false, message: 'Invalid fixture.' };
  const rng = withRng(state);
  const oppTeam = TEAM_BY_ID[fixture.opponentTeamId];
  const strengthDiff = (career.overallRating - (oppTeam?.prestige ?? 50)) / 100;
  commit(state, rng);
  if (career.sport === 'soccer') {
    const forGoals = Math.max(0, Math.round(rng.normal(1.4 + strengthDiff * 1.5, 1.1)));
    const againstGoals = Math.max(0, Math.round(rng.normal(1.2 - strengthDiff * 1.2, 1.0)));
    const playerGoals = rng.chance(0.35 + Math.max(0, strengthDiff) * 0.3) ? rng.int(0, Math.min(2, forGoals)) : 0;
    const playerAssists = rng.chance(0.25) ? 1 : 0;
    return resolveMatch(state, {
      fixtureId, playerGoals, playerAssists, teamGoalsFor: forGoals, teamGoalsAgainst: againstGoals,
      playerTouchdowns: 0, playerPassingYards: 0, playerRushingYards: 0, playerReceivingYards: 0,
      playerTackles: 0, playerInterceptions: 0, teamScoreFor: 0, teamScoreAgainst: 0,
    });
  }
  const forScore = Math.max(0, Math.round(rng.normal(21 + strengthDiff * 12, 8)));
  const againstScore = Math.max(0, Math.round(rng.normal(20 - strengthDiff * 10, 8)));
  const touchdowns = rng.chance(0.4 + Math.max(0, strengthDiff) * 0.3) ? rng.int(0, 2) : 0;
  return resolveMatch(state, {
    fixtureId, playerGoals: 0, playerAssists: 0, teamGoalsFor: 0, teamGoalsAgainst: 0,
    playerTouchdowns: touchdowns, playerPassingYards: rng.int(0, 250), playerRushingYards: rng.int(0, 90),
    playerReceivingYards: rng.int(0, 90), playerTackles: rng.int(0, 8), playerInterceptions: rng.chance(0.15) ? 1 : 0,
    teamScoreFor: forScore, teamScoreAgainst: againstScore,
  });
}

// ---------------------------------------------------------------------------
// Running races
// ---------------------------------------------------------------------------

export interface RaceResultInput {
  meetId: string;
  playerTimeSeconds: number;
}

export function resolveRace(state: GameState, input: RaceResultInput): AthleteActionResult {
  const p = state.player;
  const career = p.athlete;
  if (!career || career.sport !== 'running' || !career.event) return { ok: false, message: 'No active running career.' };
  const meet = RUNNING_MEET_BY_ID[input.meetId];
  const ev = RUNNING_EVENT_BY_ID[career.event];
  if (!meet || !ev) return { ok: false, message: 'Unknown meet.' };
  const rng = withRng(state);
  const baseline = ev.worldRecordSeconds * (1.06 + (100 - meet.prestige) * 0.003);
  const times: number[] = [];
  for (let i = 0; i < meet.fieldSize - 1; i++) times.push(Math.max(ev.worldRecordSeconds * 1.01, rng.normal(baseline, baseline * 0.05)));
  times.push(input.playerTimeSeconds);
  times.sort((a, b) => a - b);
  const place = times.indexOf(input.playerTimeSeconds) + 1;

  career.seasonStats.racesRun++; career.careerStats.racesRun++;
  if (place === 1) { career.seasonStats.racesWon++; career.careerStats.racesWon++; }
  if (meet.tier === 'championship') {
    if (place === 1) career.careerStats.medalsGold++;
    else if (place === 2) career.careerStats.medalsSilver++;
    else if (place === 3) career.careerStats.medalsBronze++;
  }
  const prevPB = career.personalBests[career.event];
  const isPB = prevPB === undefined || input.playerTimeSeconds < prevPB;
  if (isPB) career.personalBests[career.event] = input.playerTimeSeconds;

  career.fitness = clamp100(career.fitness - rng.range(10, 25));
  career.form = clamp100(career.form + (place <= 3 ? rng.range(2, 8) : rng.range(-4, 2)));
  career.morale = clamp100(career.morale + (place === 1 ? 6 : place <= 3 ? 2 : -2));
  if (rng.chance(0.04 + Math.max(0, 80 - career.fitness) * 0.001)) applyInjury(state, career, rng);

  const idx = RUNNING_MEETS.findIndex((m) => m.id === meet.id);
  career.nextMeetId = RUNNING_MEETS[(idx + 1) % RUNNING_MEETS.length].id;
  career.overallRating = computeAthleteOverall(career);
  commit(state, rng);
  const placeLabel = place === 1 ? '🥇 1st' : place === 2 ? '🥈 2nd' : place === 3 ? '🥉 3rd' : `${place}th`;
  log(state, `🏃 ${meet.name} (${ev.name}): finished ${placeLabel}${isPB ? ' — new personal best!' : ''}.`, place <= 3 ? 'good' : 'info');
  return { ok: true, message: `Finished ${placeLabel}${isPB ? ' (personal best!)' : ''}.` };
}

// ---------------------------------------------------------------------------
// League standings (read-only helper for the UI)
// ---------------------------------------------------------------------------

export function standingsForLeague(state: GameState, leagueId: string): { team: AthleteTeamDef; ts: AthleteTeamState }[] {
  return teamsInLeague(leagueId)
    .map((team) => ({
      team,
      ts: state.athleteTeams[team.id] ?? { teamId: team.id, wins: 0, losses: 0, draws: 0, points: 0, goalsFor: 0, goalsAgainst: 0, seasonYear: state.year },
    }))
    .sort((a, b) => b.ts.points - a.ts.points || (b.ts.goalsFor - b.ts.goalsAgainst) - (a.ts.goalsFor - a.ts.goalsAgainst));
}

/** AI-vs-AI results for every OTHER team in a league — keeps the standings table alive without
 * making the player play or even quick-sim hundreds of games they're not part of. */
function simulateLeagueSeason(state: GameState, leagueId: string, excludeTeamId: string | null, rng: RNG): void {
  const league = LEAGUE_BY_ID[leagueId];
  const teams = teamsInLeague(leagueId).filter((t) => t.id !== excludeTeamId);
  const isSoccer = league?.sport === 'soccer';
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i], b = teams[j];
      const tsA = ensureTeamState(state, a.id, state.year);
      const tsB = ensureTeamState(state, b.id, state.year);
      const diff = (a.prestige - b.prestige) / 100;
      if (isSoccer) {
        const scoreA = Math.max(0, Math.round(rng.normal(1.3 + diff, 1.1)));
        const scoreB = Math.max(0, Math.round(rng.normal(1.3 - diff, 1.1)));
        if (scoreA > scoreB) { tsA.wins++; tsA.points += 3; tsB.losses++; }
        else if (scoreB > scoreA) { tsB.wins++; tsB.points += 3; tsA.losses++; }
        else { tsA.draws++; tsB.draws++; tsA.points++; tsB.points++; }
        tsA.goalsFor += scoreA; tsA.goalsAgainst += scoreB;
        tsB.goalsFor += scoreB; tsB.goalsAgainst += scoreA;
      } else {
        const scoreA = Math.max(0, Math.round(rng.normal(21 + diff * 10, 8)));
        const scoreB = Math.max(0, Math.round(rng.normal(21 - diff * 10, 8)));
        if (scoreA > scoreB) { tsA.wins++; tsA.points += 1; tsB.losses++; }
        else { tsB.wins++; tsB.points += 1; tsA.losses++; }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Yearly tick — aging, injury recovery, contracts, standings, retirement
// ---------------------------------------------------------------------------

export function tickAthleteSeason(state: GameState, rng: RNG): string[] {
  const p = state.player;
  const career = p.athlete;
  const headlines: string[] = [];
  if (!career || career.retired) return headlines;

  if (career.currentInjury) {
    career.currentInjury.weeksOut -= 52;
    if (career.currentInjury.weeksOut <= 0) career.currentInjury = null;
  }

  career.fitness = clamp100(career.fitness + rng.range(10, 30));
  career.morale = clamp(career.morale + (50 - career.morale) * 0.15 + rng.range(-3, 3), 0, 100);
  career.form = clamp(50 + (career.form - 50) * 0.7, 0, 100);

  const factor = ageFactorFor(career, p.age);
  for (const attrId of Object.keys(career.attributes)) {
    if (factor > 0) {
      const room = career.potentialCeiling - career.attributes[attrId];
      career.attributes[attrId] = clamp(career.attributes[attrId] + room * 0.06 * factor, 0, 100);
    } else {
      career.attributes[attrId] = clamp(career.attributes[attrId] + factor * rng.range(1, 3), 0, 100);
    }
  }
  career.overallRating = computeAthleteOverall(career);

  if (career.level === 'youth' && p.age >= 16) career.level = 'academy';
  if (career.overallRating >= 85 && career.level === 'pro') career.level = 'elite';

  if (career.contract) {
    career.contract.yearsLeft -= 1;
    if (career.contract.yearsLeft <= 0) {
      const teamName = TEAM_BY_ID[career.teamId ?? '']?.name ?? 'their club';
      headlines.push(`${p.name} became a free agent after their contract with ${teamName} expired.`);
      career.contract = null;
      career.teamId = null;
      career.leagueId = null;
      career.fixtures = [];
    }
  }

  for (const e of career.endorsements) { p.money += e.annualValue; e.yearsLeft -= 1; }
  career.endorsements = career.endorsements.filter((e) => e.yearsLeft > 0);

  if (career.teamId && career.leagueId && career.sport !== 'running') {
    ensureSeasonFixtures(state, career, rng);
    simulateLeagueSeason(state, career.leagueId, career.teamId, rng);
  } else if (career.sport !== 'running') {
    // unsigned team-sport athlete: nothing else to simulate this year
  }

  const retireAge = career.sport === 'running' ? 38 : 36;
  if (p.age >= retireAge && rng.chance(0.2 + (p.age - retireAge) * 0.12)) {
    const wasHOF = career.hallOfFame;
    retireAthlete(state);
    if (!wasHOF) headlines.push(`${p.name} announced their retirement from professional ${sportLabel(career.sport)}.`);
  }

  return headlines;
}
