/**
 * Political simulation: the office ladder, campaigns and elections, party
 * dynamics, legislation, government approval, and geopolitics (relations,
 * sanctions, wars). NPC politicians pursue their own careers; national
 * elections happen with or without the player.
 */
import type { CabinetPortfolio, Country, GameState, InfrastructureKind, LawDef, ManifestoPromise, Office, OfficeKind } from './types';
import { clamp, clamp100 } from './types';
import { LAW_BY_ID } from '../data/laws';
import { SK } from '../data/skills';
import type { RNG } from './rng';
import { randomMindTraits } from './npcMind';

export interface OfficeSpec {
  kind: OfficeKind;
  title: string;
  minAge: number;
  minPopularity: number;
  minInfluence: number;
  termYears: number;
  salary: number;
  campaignCostBase: number;
  requiresParty: boolean;
  prerequisite: OfficeKind[] | null; // any of these previously held (or currently)
}

export const OFFICE_LADDER: OfficeSpec[] = [
  { kind: 'councillor', title: 'City Councillor', minAge: 18, minPopularity: 5, minInfluence: 0, termYears: 4, salary: 55_000, campaignCostBase: 10_000, requiresParty: false, prerequisite: null },
  { kind: 'mayor', title: 'Mayor', minAge: 21, minPopularity: 15, minInfluence: 5, termYears: 4, salary: 130_000, campaignCostBase: 80_000, requiresParty: false, prerequisite: null },
  { kind: 'state_legislator', title: 'State Legislator', minAge: 21, minPopularity: 12, minInfluence: 5, termYears: 4, salary: 95_000, campaignCostBase: 60_000, requiresParty: true, prerequisite: null },
  { kind: 'governor', title: 'Governor', minAge: 25, minPopularity: 30, minInfluence: 15, termYears: 4, salary: 210_000, campaignCostBase: 500_000, requiresParty: true, prerequisite: ['mayor', 'state_legislator', 'councillor'] },
  { kind: 'legislator', title: 'Member of Parliament', minAge: 23, minPopularity: 25, minInfluence: 10, termYears: 4, salary: 175_000, campaignCostBase: 250_000, requiresParty: true, prerequisite: null },
  { kind: 'minister', title: 'Cabinet Minister', minAge: 28, minPopularity: 35, minInfluence: 30, termYears: 4, salary: 240_000, campaignCostBase: 0, requiresParty: true, prerequisite: ['legislator', 'governor'] },
  { kind: 'party_leader', title: 'Party Leader', minAge: 30, minPopularity: 40, minInfluence: 40, termYears: 99, salary: 200_000, campaignCostBase: 100_000, requiresParty: true, prerequisite: ['legislator', 'minister', 'governor'] },
  { kind: 'head_of_state', title: 'Head of Government', minAge: 35, minPopularity: 45, minInfluence: 50, termYears: 4, salary: 400_000, campaignCostBase: 5_000_000, requiresParty: true, prerequisite: ['party_leader', 'minister', 'governor'] },
];

export const OFFICE_SPEC_BY_KIND: Record<string, OfficeSpec> = Object.fromEntries(OFFICE_LADDER.map((o) => [o.kind, o]));

export function heldOffices(state: GameState): OfficeKind[] {
  const held: OfficeKind[] = [];
  if (state.player.office) held.push(state.player.office.kind);
  // Past offices are recorded as `office:<kind>` achievements when won.
  for (const a of state.achievements) {
    if (a.startsWith('office:')) held.push(a.slice(7) as OfficeKind);
  }
  return held;
}

export function eligibleFor(state: GameState, spec: OfficeSpec): { ok: boolean; reason: string } {
  const p = state.player;
  if (p.inJailYears > 0) return { ok: false, reason: 'You are in prison.' };
  if (p.age < spec.minAge) return { ok: false, reason: `Must be at least ${spec.minAge}.` };
  if (p.popularity < spec.minPopularity) return { ok: false, reason: `Needs ${spec.minPopularity}+ popularity.` };
  if (p.influence < spec.minInfluence) return { ok: false, reason: `Needs ${spec.minInfluence}+ influence.` };
  if (spec.requiresParty && !p.partyId) return { ok: false, reason: 'Requires party membership.' };
  if (spec.prerequisite) {
    const held = heldOffices(state);
    if (!spec.prerequisite.some((k) => held.includes(k))) {
      return { ok: false, reason: `Requires prior office: ${spec.prerequisite.map((k) => OFFICE_SPEC_BY_KIND[k].title).join(' or ')}.` };
    }
  }
  if (p.office?.kind === spec.kind) return { ok: false, reason: 'Already holding this office.' };
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if ((home.system === 'dictatorship' || home.system === 'monarchy') && spec.kind === 'head_of_state' && home.leaderId !== 'player') {
    return { ok: false, reason: `${home.name} does not hold free national elections.` };
  }
  return { ok: true, reason: '' };
}

/** Election-day win probability for the player's active campaign. */
export function campaignWinChance(state: GameState, rng?: RNG): number {
  const p = state.player;
  const c = p.campaign;
  if (!c) return 0;
  const spec = OFFICE_SPEC_BY_KIND[c.officeKind];
  const home = state.countries.find((k) => k.id === p.countryId)!;
  const party = home.parties.find((x) => x.id === p.partyId);

  let score = 0;
  score += (p.popularity - 40) * 0.9;
  score += c.momentum * 1.1;
  score += (p.charisma - 50) * 0.3;
  score += ((p.skills[SK.campaigning] ?? 0) + (p.skills[SK.publicSpeaking] ?? 0)) * 0.15;
  score += Math.min(25, Math.sqrt(c.warChest / Math.max(1, spec.campaignCostBase)) * 12);
  if (party) score += (party.support - 100 / home.parties.length) * 0.6;
  // Anti-incumbent sentiment when the government is unpopular helps challengers
  if (spec.kind === 'head_of_state' || spec.kind === 'legislator') {
    score += (45 - home.approvalOfGovernment) * 0.35;
  }
  score -= p.criminalRecord * 8;
  score -= p.notoriety * 0.4;
  if (rng) score += rng.range(-6, 6);
  return clamp(0.5 + score / 100, 0.02, 0.97);
}

export interface LawVoteEstimate {
  chance: number;
  supportSeats: number;
  totalSeats: number;
}

/** Estimate legislature support for a law based on party ideologies. */
export function estimateLawVote(state: GameState, country: Country, law: LawDef): LawVoteEstimate {
  let supportSeats = 0;
  for (const party of country.parties) {
    // A coalition partner votes with the government on discipline, not conscience.
    if (country.coalitionPartnerId === party.id) {
      supportSeats += party.seats * 0.85;
      continue;
    }
    // Left parties weight `left` bloc, right parties `right`; business/worker blocs mix in.
    const leftW = clamp01((50 - party.ideology) / 100);
    const rightW = 1 - leftW;
    const stance = law.support.left * leftW + law.support.right * rightW +
      law.support.business * (rightW - 0.5) * 0.4 + law.support.workers * (leftW - 0.5) * 0.4;
    const voteShare = clamp(0.5 + stance * 0.6, 0.05, 0.95);
    supportSeats += party.seats * voteShare;
  }
  const p = state.player;
  // Player's political capital and lobbying skill sway marginal votes.
  const sway = (p.politicalCapital * 0.6 + (p.skills[SK.lobbying] ?? 0) * 0.1 + (p.skills[SK.coalition] ?? 0) * 0.1) / 100 + (p.lobbyingFirmHired ? 0.08 : 0);
  const total = Math.max(1, country.totalSeats);
  const chance = clamp(supportSeats / total + sway, 0.03, 0.97);
  return { chance, supportSeats: Math.round(supportSeats), totalSeats: total };
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

const PROMISE_LOWER_IS_BETTER: Record<ManifestoPromise, boolean> = {
  tax_cuts: true,
  jobs: true, // metric is unemployment
  crime_reduction: true,
  healthcare: false,
  education: false,
  infrastructure: false,
};

/** Current real-world value of the metric a manifesto promise is judged against. */
export function promiseMetricValue(country: Country, promise: ManifestoPromise): number {
  switch (promise) {
    case 'tax_cuts': return country.economy.taxRates.income;
    case 'healthcare': return country.healthcare;
    case 'education': return country.education;
    case 'jobs': return country.economy.unemployment;
    case 'infrastructure': return country.infrastructure;
    case 'crime_reduction':
      return country.cities.length ? country.cities.reduce((s, c) => s + c.crime, 0) / country.cities.length : 50;
  }
}

export interface PromiseStatus {
  promise: ManifestoPromise;
  fulfilled: boolean;
  changePct: number;
}

/** Judges each manifesto promise against how its metric moved since the office began. */
export function promiseFulfillment(office: Office, country: Country): PromiseStatus[] {
  return office.promises.map((promise) => {
    const baseline = office.promiseBaseline[promise] ?? promiseMetricValue(country, promise);
    const current = promiseMetricValue(country, promise);
    const fulfilled = PROMISE_LOWER_IS_BETTER[promise] ? current < baseline : current > baseline;
    const changePct = baseline !== 0 ? ((current - baseline) / Math.abs(baseline)) * 100 : 0;
    return { promise, fulfilled, changePct };
  });
}

export interface OpinionSegment {
  label: string;
  value: number; // 0..100 approval-like score
}

export interface OpinionBreakdown {
  byIdeology: OpinionSegment[];
  byClass: OpinionSegment[];
  byAge: OpinionSegment[];
  byRegion: OpinionSegment[];
}

/** Public opinion segmented by ideology/class/age/region, derived from the real laws in force
 * (their left/right/business/worker support blocs) and country conditions — not a literal per-citizen poll,
 * but a defensible aggregate consistent with how the legislature vote itself is estimated. */
export function publicOpinionBreakdown(country: Country): OpinionBreakdown {
  const laws = country.lawsInForce.map((id) => LAW_BY_ID[id]).filter((l): l is LawDef => !!l);
  const baseline = country.approvalOfGovernment;
  const avgSupport = (bloc: keyof LawDef['support']) =>
    laws.length ? laws.reduce((s, l) => s + l.support[bloc], 0) / laws.length : 0;

  const byIdeology: OpinionSegment[] = [
    { label: 'Left', value: Math.round(clamp100(baseline + avgSupport('left') * 40)) },
    { label: 'Center', value: Math.round(clamp100(baseline + (avgSupport('left') + avgSupport('right')) * 10)) },
    { label: 'Right', value: Math.round(clamp100(baseline + avgSupport('right') * 40)) },
  ];
  const byClass: OpinionSegment[] = [
    { label: 'Business owners', value: Math.round(clamp100(baseline + avgSupport('business') * 40)) },
    { label: 'Workers', value: Math.round(clamp100(baseline + avgSupport('workers') * 40)) },
  ];
  const e = country.economy;
  const byAge: OpinionSegment[] = [
    { label: '18-30', value: Math.round(clamp100(baseline - e.unemployment * 100 * 0.4 + avgSupport('workers') * 15)) },
    { label: '31-60', value: Math.round(clamp100(baseline + avgSupport('business') * 10)) },
    { label: '61+', value: Math.round(clamp100(baseline + (country.healthcare - 50) * 0.3)) },
  ];
  const byRegion: OpinionSegment[] = country.cities.slice(0, 8).map((city) => ({
    label: city.name,
    value: Math.round(clamp100(baseline + (50 - city.crime) * 0.2 - (city.costOfLiving - 1) * 20)),
  }));

  return { byIdeology, byClass, byAge, byRegion };
}

const MEGA_PROJECT_KINDS = new Set(['bridge', 'tunnel', 'bullet_train', 'stadium', 'dam', 'space_program']);
const MEGA_PROJECT_LABELS: Partial<Record<InfrastructureKind, string>> = {
  space_program: 'national space program',
  bullet_train: 'bullet train network',
};

/** A city-by-city breakdown of an election result, as a lightweight substitute for a literal
 * interactive electorate map — city character (crime, cost of living) swings the vote a bit. */
export function electionRegionalBreakdown(home: Country, playerSharePct: number, rng: RNG): { cityName: string; playerSharePct: number }[] {
  return home.cities.slice(0, 8).map((city) => ({
    cityName: city.name,
    playerSharePct: Math.round(clamp(playerSharePct + (50 - city.crime) * 0.15 - (city.costOfLiving - 1) * 15 + rng.range(-5, 5), 1, 99)),
  }));
}

/** Yearly political tick for one country. Returns notable headlines. */
export function tickPolitics(state: GameState, country: Country, rng: RNG): string[] {
  const headlines: string[] = [];
  const e = country.economy;
  const playerIsLeader = country.leaderId === 'player';

  if (country.militaryReadiness === undefined) { // backfill for saves from before V18 military depth
    country.militaryReadiness = country.militaryPower * 0.7;
    country.warExhaustion = 0;
    country.warCasualtiesTotal = 0;
  }
  // Military readiness drifts toward what the Defense budget share can sustain — chronically
  // under-funding it (below the ~16.7% even-split baseline) lets it decay; over-funding slowly
  // builds it. Distinct from the raw militaryPower score, which cabinet meetings/laws move directly.
  country.militaryReadiness = clamp100(country.militaryReadiness + (country.budgetAllocations.Defense - 16.7) * 0.06 + rng.range(-0.5, 0.5));

  // Government approval follows the economy and stability.
  const drift =
    (e.gdpGrowth - 0.02) * 220 -
    Math.max(0, e.inflation - 0.03) * 160 -
    (e.unemployment - 0.05) * 120 +
    (country.stability - 60) * 0.05;
  country.approvalOfGovernment = clamp100(country.approvalOfGovernment * 0.75 + (48 + drift) * 0.25 + rng.range(-4, 4));

  // If the player leads the country, their popularity tracks approval.
  if (playerIsLeader) {
    state.player.popularity = clamp100(state.player.popularity * 0.7 + country.approvalOfGovernment * 0.3);
  }

  // Unrest: protests and strikes build when approval is low, unemployment is high, or stability is shaky.
  const unrestTarget = clamp(
    (50 - country.approvalOfGovernment) * 0.6 + Math.max(0, e.unemployment - 0.06) * 300 + Math.max(0, 50 - country.stability) * 0.4,
    0,
    100,
  );
  country.unrest = clamp100(country.unrest * 0.8 + unrestTarget * 0.2 + rng.range(-3, 3));
  if (country.unrest > 70 && rng.chance(0.35)) {
    headlines.push(`✊ Mass protests grip ${country.name} as public anger boils over`);
    country.economy.businessConfidence = clamp100(country.economy.businessConfidence - 4);
    if (playerIsLeader) state.player.popularity = clamp100(state.player.popularity - 3);
  } else if (country.unrest > 45 && rng.chance(0.25)) {
    headlines.push(`📢 Strikes and demonstrations disrupt ${country.name}`);
  }

  // National cyberattacks: higher cyber defense reduces both odds and severity.
  const cyberAttackChance = clamp(0.05 - (country.cyberDefense / 100) * 0.035, 0.01, 0.05);
  if (rng.chance(cyberAttackChance)) {
    const severity = rng.range(0.3, 1) * (1 - country.cyberDefense / 200);
    country.economy.businessConfidence = clamp100(country.economy.businessConfidence - severity * 8);
    const targets = Object.values(state.companies).filter((c) => c.status === 'active' && c.countryId === country.id);
    const target = targets.length ? rng.pick(targets) : null;
    if (target) {
      target.cash = Math.max(0, target.cash - target.cash * severity * 0.1);
      target.brand = clamp100(target.brand - severity * 5);
    }
    headlines.push(target
      ? `🖥️ A major cyberattack struck ${country.name}, disrupting ${target.name} and rattling markets`
      : `🖥️ A major cyberattack struck ${country.name}'s critical infrastructure`);
  }

  // AI Opposition Leader: while the player governs, a rival politician builds a public profile
  // critiquing the government, adapting how loudly they push based on approval.
  if (playerIsLeader) {
    if (country.oppositionLeaderId && !state.npcs[country.oppositionLeaderId]?.alive) country.oppositionLeaderId = null;
    if (!country.oppositionLeaderId) {
      const candidate = Object.values(state.npcs).find(
        (n) => n.alive && n.countryId === country.id && n.role === 'politician' && n.id !== state.player.politicalHeirId,
      );
      if (candidate) country.oppositionLeaderId = candidate.id;
    }
    const opposition = country.oppositionLeaderId ? state.npcs[country.oppositionLeaderId] : null;
    if (opposition) {
      const critiqueChance = clamp(0.06 + Math.max(0, 50 - country.approvalOfGovernment) * 0.004, 0.05, 0.4);
      if (rng.chance(critiqueChance)) {
        const hit = 1 + (opposition.charisma / 100) * 3;
        state.player.popularity = clamp100(state.player.popularity - hit);
        opposition.popularity = clamp100(opposition.popularity + hit * 0.6);
        headlines.push(`🗣️ Opposition leader ${opposition.name} publicly slammed the government's record`);
      }
    }
  } else if (country.oppositionLeaderId) {
    country.oppositionLeaderId = null;
  }

  // Cabinet ministers (player-led governments only) nudge their portfolio's stat each year.
  // Budget allocation scales each portfolio's pull relative to an equal 16.67% baseline share.
  if (playerIsLeader) {
    for (const [portfolio, npcId] of Object.entries(country.cabinet)) {
      const minister = npcId === 'player' ? null : state.npcs[npcId];
      if (npcId !== 'player' && (!minister || !minister.alive)) continue;
      const competence = minister ? minister.competence : state.player.smarts;
      const integrity = minister ? minister.integrity : state.player.karma;
      const share = country.budgetAllocations[portfolio as CabinetPortfolio] ?? 16.67;
      const budgetMult = clamp(share / 16.67, 0.3, 2.5);
      const pull = (competence - 50) * 0.03 * budgetMult;
      if (portfolio === 'Finance') country.economy.businessConfidence = clamp100(country.economy.businessConfidence + pull);
      else if (portfolio === 'Health') country.healthcare = clamp100(country.healthcare + pull);
      else if (portfolio === 'Education') country.education = clamp100(country.education + pull);
      else if (portfolio === 'Defense') country.militaryPower = clamp100(country.militaryPower + pull);
      else if (portfolio === 'Justice') country.corruption = clamp100(country.corruption - (integrity - 50) * 0.03 * budgetMult);
      else if (portfolio === 'Foreign Affairs') {
        for (const otherId of Object.keys(country.relations)) {
          country.relations[otherId] = clamp(country.relations[otherId] + pull * 0.3, -100, 100);
        }
      }
    }
  }

  // Cabinet resignation risk: ministers with low confidence or a soured relationship with the player may quit.
  if (playerIsLeader) {
    for (const [portfolio, npcId] of Object.entries(country.cabinet)) {
      if (npcId === 'player') continue;
      const minister = state.npcs[npcId];
      if (!minister || !minister.alive) continue;
      const risk = clamp(
        (50 - minister.popularity) * 0.002 + (50 - minister.integrity) * 0.0015 + (50 - minister.opinionOfPlayer) * 0.001,
        0.01,
        0.3,
      );
      if (rng.chance(risk)) {
        delete country.cabinet[portfolio];
        headlines.push(`🚪 ${minister.name} resigns as Minister for ${portfolio} amid falling confidence`);
        state.player.popularity = clamp100(state.player.popularity - 2);
      }
    }
  }

  // Infrastructure projects funded via launchInfrastructureProject() complete over several years.
  if (country.infrastructureProjects.length) {
    const finished: string[] = [];
    for (const proj of country.infrastructureProjects) {
      proj.yearsLeft--;
      if (proj.yearsLeft <= 0) {
        country.infrastructure = clamp100(country.infrastructure + 8);
        if (proj.kind === 'internet' || proj.kind === 'power') country.economy.businessConfidence = clamp100(country.economy.businessConfidence + 4);
        if (proj.kind === 'roads' || proj.kind === 'rail') country.economy.gdpGrowth += 0.002;
        if (proj.kind === 'airport') country.economy.businessConfidence = clamp100(country.economy.businessConfidence + 3);
        if (proj.kind === 'space_program') {
          country.militaryPower = clamp100(country.militaryPower + 10);
          country.economy.businessConfidence = clamp100(country.economy.businessConfidence + 10);
          country.stability = clamp100(country.stability + 5);
          if (playerIsLeader) {
            state.player.reputation = clamp100(state.player.reputation + 15);
            state.player.popularity = clamp100(state.player.popularity + 10);
            if (!state.achievements.includes('space_pioneer')) state.achievements.push('space_pioneer');
          }
        } else if (proj.kind === 'bridge' || proj.kind === 'tunnel') {
          country.economy.gdpGrowth += 0.0025;
          country.economy.businessConfidence = clamp100(country.economy.businessConfidence + 3);
        } else if (proj.kind === 'bullet_train') {
          country.economy.gdpGrowth += 0.004;
          country.economy.businessConfidence = clamp100(country.economy.businessConfidence + 6);
        } else if (proj.kind === 'stadium') {
          country.economy.businessConfidence = clamp100(country.economy.businessConfidence + 3);
          if (playerIsLeader) state.player.popularity = clamp100(state.player.popularity + 6);
        } else if (proj.kind === 'dam') {
          country.energyRenewableShare = clamp100(country.energyRenewableShare + 8);
          country.economy.businessConfidence = clamp100(country.economy.businessConfidence + 4);
        }
        if (playerIsLeader && MEGA_PROJECT_KINDS.has(proj.kind) && !state.achievements.includes('mega_builder')) {
          state.achievements.push('mega_builder');
        }
        headlines.push(`🏗️ ${country.name} completed a new ${MEGA_PROJECT_LABELS[proj.kind] ?? proj.kind} project.`);
        if (playerIsLeader && proj.kind !== 'space_program' && !state.achievements.includes('nation_builder')) state.achievements.push('nation_builder');
        finished.push(proj.id);
      }
    }
    if (finished.length) country.infrastructureProjects = country.infrastructureProjects.filter((p) => !finished.includes(p.id));
  }

  // Party support drifts with approval (governing party) and noise.
  if (country.parties.length > 0) {
    const governing = country.parties.reduce((a, b) => (a.seats > b.seats ? a : b));
    for (const party of country.parties) {
      const isGov = party === governing;
      let delta = rng.range(-2.5, 2.5);
      if (isGov) delta += (country.approvalOfGovernment - 48) * 0.12;
      party.support = Math.max(1, party.support + delta);
    }
    const total = country.parties.reduce((s, p) => s + p.support, 0);
    for (const party of country.parties) party.support = (party.support / total) * 100;

    // National election cycle
    if (country.electionInYears > 0) country.electionInYears--;
    if (country.electionInYears <= 0 && country.totalSeats > 0) {
      country.electionInYears = 4;
      let remaining = country.totalSeats;
      const sorted = [...country.parties].sort((a, b) => b.support - a.support);
      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        const share = clamp(p.support / 100 + rng.range(-0.04, 0.04), 0.02, 0.9);
        p.seats = i === sorted.length - 1 ? Math.max(0, remaining) : Math.min(remaining, Math.round(country.totalSeats * share));
        remaining -= p.seats;
      }
      const winner = country.parties.reduce((a, b) => (a.seats > b.seats ? a : b));
      // Player wins/loses the top job only via their own campaign, handled elsewhere;
      // here NPC leadership changes hands.
      if (!playerIsLeader) {
        const newLeaderId = winner.leaderId ?? country.leaderId;
        if (newLeaderId && newLeaderId !== country.leaderId) {
          country.leaderId = newLeaderId;
          const npc = newLeaderId ? state.npcs[newLeaderId] : null;
          headlines.push(`${country.flag} ${winner.name} wins the ${country.name} election; ${npc?.name ?? 'a new leader'} becomes ${country.leaderTitle}`);
          country.approvalOfGovernment = clamp100(50 + rng.range(-5, 10));
        } else {
          headlines.push(`${country.flag} ${winner.name} retains power in the ${country.name} general election`);
        }
      } else if (state.player.office?.kind === 'head_of_state') {
        // The player's own re-election is resolved via their campaign each cycle.
      }
    }
  }

  // NPC legislatures pass laws occasionally (not in the player's chair).
  if (!playerIsLeader && country.totalSeats > 0 && rng.chance(0.3)) {
    const candidates = Object.values(LAW_BY_ID).filter((l) => !country.lawsInForce.includes(l.id));
    if (candidates.length) {
      const law = rng.pick(candidates);
      const est = estimateLawVote(state, country, law);
      if (rng.chance(est.chance)) {
        country.lawsInForce.push(law.id);
        headlines.push(`${country.flag} ${country.name} passes the ${law.name}`);
      }
    }
  }
  // Autocracies decree laws aligned with the ruler.
  if ((country.system === 'dictatorship' || country.system === 'monarchy') && !playerIsLeader && rng.chance(0.25)) {
    const candidates = Object.values(LAW_BY_ID).filter((l) => !country.lawsInForce.includes(l.id) && l.support.right >= -0.2);
    if (candidates.length) {
      const law = rng.pick(candidates);
      country.lawsInForce.push(law.id);
      headlines.push(`${country.flag} ${country.name} decrees the ${law.name}`);
    }
  }

  // Judicial review: a low-integrity court can arbitrarily strike down a law in force.
  if (country.lawsInForce.length && rng.chance(clamp(0.05 * (1 - country.judicialIntegrity / 130), 0.005, 0.08))) {
    const lawId = rng.pick(country.lawsInForce);
    const law = LAW_BY_ID[lawId];
    country.lawsInForce = country.lawsInForce.filter((id) => id !== lawId);
    headlines.push(`⚖️ ${country.name}'s courts struck down the ${law?.name ?? 'law'}`);
  }

  // Geopolitics: relations drift; sanctions and (rare) wars.
  for (const other of state.countries) {
    if (other.id === country.id) continue;
    const rel = country.relations[other.id] ?? 0;
    country.relations[other.id] = clamp(rel + rng.range(-6, 6), -100, 100);
    const r = country.relations[other.id];
    if (r < -60 && !country.sanctionsOn.includes(other.id) && rng.chance(0.3)) {
      country.sanctionsOn.push(other.id);
      headlines.push(`${country.flag} ${country.name} imposes sanctions on ${other.name}`);
      other.economy.businessConfidence = clamp100(other.economy.businessConfidence - 5);
    }
    if (r > -30 && country.sanctionsOn.includes(other.id)) {
      country.sanctionsOn = country.sanctionsOn.filter((x) => x !== other.id);
      headlines.push(`${country.flag} ${country.name} lifts sanctions on ${other.name}`);
    }
    if (r < -80 && !country.atWarWith.includes(other.id) && rng.chance(0.08)) {
      country.atWarWith.push(other.id);
      other.atWarWith.push(country.id);
      headlines.push(`⚔️ WAR: ${country.name} and ${other.name} enter open conflict`);
    }
    if (country.atWarWith.includes(other.id)) {
      // A war strategy chosen via declareWar() differentiates the yearly toll and peace odds.
      // Readiness now matters: a country fighting under-prepared racks up exhaustion and
      // casualties faster than one that invested in its military beforehand.
      const strategy = country.warStrategies[other.id];
      const readinessGap = other.militaryReadiness - country.militaryReadiness; // positive = country is outmatched
      let peaceChance = 0.3;
      let casualtyRate = 0.00015;
      if (strategy === 'blockade') {
        other.economy.businessConfidence = clamp100(other.economy.businessConfidence - 3);
        other.economy.gdpGrowth -= 0.01;
        peaceChance = 0.2;
        casualtyRate = 0.00008;
      } else if (strategy === 'invasion') {
        country.stability = clamp100(country.stability - 2);
        other.stability = clamp100(other.stability - 4);
        peaceChance = 0.4;
        casualtyRate = 0.00025;
      }
      country.warExhaustion = clamp100(country.warExhaustion + 4 + Math.max(0, readinessGap) * 0.08);
      peaceChance = clamp(peaceChance + country.warExhaustion * 0.006 + Math.max(0, readinessGap) * 0.004, 0.05, 0.9);
      country.approvalOfGovernment = clamp100(country.approvalOfGovernment - country.warExhaustion * 0.02);
      const casualties = Math.round(country.population * casualtyRate * (1 + Math.max(0, readinessGap) / 100));
      country.population = Math.max(1000, country.population - casualties);
      country.warCasualtiesTotal += casualties;
      if (rng.chance(peaceChance)) {
        country.atWarWith = country.atWarWith.filter((x) => x !== other.id);
        other.atWarWith = other.atWarWith.filter((x) => x !== country.id);
        delete country.warStrategies[other.id];
        country.relations[other.id] = -40;
        other.relations[country.id] = -40;
        country.infrastructure = clamp100(country.infrastructure - 4); // reconstruction toll
        headlines.push(`🕊️ Peace: ${country.name} and ${other.name} sign an armistice after ${Math.round(country.warExhaustion / 6)} years of grinding war`);
      }
    }
  }
  if (country.atWarWith.length === 0) {
    country.warExhaustion = clamp100(country.warExhaustion - 6); // recovers once at peace with everyone
  }

  // Coups in unstable autocracies/low-stability states.
  if (country.stability < 30 && !playerIsLeader && rng.chance(0.12)) {
    const general = Object.values(state.npcs).find((n) => n.countryId === country.id && n.alive && n.role === 'politician' && n.id !== country.leaderId);
    if (general) {
      country.leaderId = general.id;
      country.system = 'dictatorship';
      country.leaderTitle = 'General';
      country.totalSeats = 0;
      country.parties = [];
      country.stability = clamp100(country.stability + 10);
      country.pressFreedom = clamp100(country.pressFreedom - 30);
      headlines.push(`🚨 COUP in ${country.name}: ${general.name} seizes power`);
    }
  }

  return headlines;
}

/** Age NPCs, retire/replace dead leaders, evolve ambitions. */
export function tickNPCs(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  for (const npc of Object.values(state.npcs)) {
    if (!npc.alive) continue;
    if (npc.mood === undefined) Object.assign(npc, randomMindTraits(rng)); // backfill for saves from before V17 NPC minds
    npc.age++;
    const deathChance = npc.age > 90 ? 0.25 : npc.age > 80 ? 0.09 : npc.age > 70 ? 0.035 : npc.age > 60 ? 0.012 : 0.004;
    if (rng.chance(deathChance)) {
      npc.alive = false;
      const country = state.countries.find((c) => c.id === npc.countryId);
      if (country && country.leaderId === npc.id) {
        // Succession
        const successor = Object.values(state.npcs).find((n) => n.alive && n.countryId === country.id && n.role === 'politician' && n.id !== npc.id);
        if (successor) {
          country.leaderId = successor.id;
          headlines.push(`${country.flag} ${country.leaderTitle} ${npc.name} of ${country.name} dies; ${successor.name} takes over`);
        }
      } else if (npc.companyId && state.companies[npc.companyId]?.status === 'active') {
        const heir = Object.values(state.npcs).find((n) => n.alive && n.role === 'executive' && !n.companyId);
        if (heir) {
          heir.companyId = npc.companyId;
          state.companies[npc.companyId].founderId = heir.id;
        }
      }
      continue;
    }
    const wealthDelta = rng.range(-0.08, 0.12);
    npc.popularity = clamp100(npc.popularity + rng.range(-4, 4));
    npc.wealth = Math.max(0, npc.wealth * (1 + wealthDelta));
    // Opinions decay toward neutral
    npc.opinionOfPlayer = Math.round(npc.opinionOfPlayer * 0.92);

    // Dynamic mind state: cheap mean-reverting random walks, once a year, for every NPC.
    // A wealth drop this year raises financial pressure; a rise eases it.
    npc.financialPressure = clamp100(npc.financialPressure - wealthDelta * 60 + rng.range(-3, 3) - (npc.financialPressure - 25) * 0.06);
    npc.stress = clamp100(npc.stress + npc.financialPressure * 0.02 + rng.range(-4, 4) - (npc.stress - 35) * 0.08);
    npc.fatigue = clamp100(npc.fatigue + rng.range(-5, 5) - (npc.fatigue - 30) * 0.1);
    npc.mood = clamp100(npc.mood + rng.range(-5, 5) - npc.stress * 0.03 - (npc.mood - 55) * 0.05);
    npc.careerSatisfaction = clamp100(npc.careerSatisfaction + rng.range(-4, 4) + (npc.competence - 50) * 0.01 - (npc.careerSatisfaction - 55) * 0.05);
    npc.relationshipTension = clamp100(npc.relationshipTension - (npc.relationshipTension - 10) * 0.1);
  }
  return headlines;
}
