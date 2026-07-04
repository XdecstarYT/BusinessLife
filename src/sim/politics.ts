/**
 * Political simulation: the office ladder, campaigns and elections, party
 * dynamics, legislation, government approval, and geopolitics (relations,
 * sanctions, wars). NPC politicians pursue their own careers; national
 * elections happen with or without the player.
 */
import type { CabinetPortfolio, Country, GameState, LawDef, ManifestoPromise, Office, OfficeKind } from './types';
import { clamp, clamp100 } from './types';
import { LAW_BY_ID } from '../data/laws';
import { SK } from '../data/skills';
import type { RNG } from './rng';

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

/** Yearly political tick for one country. Returns notable headlines. */
export function tickPolitics(state: GameState, country: Country, rng: RNG): string[] {
  const headlines: string[] = [];
  const e = country.economy;
  const playerIsLeader = country.leaderId === 'player';

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
        }
        headlines.push(`🏗️ ${country.name} completed a new ${proj.kind === 'space_program' ? 'national space program' : proj.kind} project.`);
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
      const strategy = country.warStrategies[other.id];
      let peaceChance = 0.35;
      if (strategy === 'blockade') {
        other.economy.businessConfidence = clamp100(other.economy.businessConfidence - 3);
        other.economy.gdpGrowth -= 0.01;
        peaceChance = 0.22;
      } else if (strategy === 'invasion') {
        country.stability = clamp100(country.stability - 2);
        other.stability = clamp100(other.stability - 4);
        peaceChance = 0.45;
      }
      if (rng.chance(peaceChance)) {
        country.atWarWith = country.atWarWith.filter((x) => x !== other.id);
        other.atWarWith = other.atWarWith.filter((x) => x !== country.id);
        delete country.warStrategies[other.id];
        country.relations[other.id] = -40;
        other.relations[country.id] = -40;
        headlines.push(`🕊️ Peace: ${country.name} and ${other.name} sign an armistice`);
      }
    }
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
    npc.popularity = clamp100(npc.popularity + rng.range(-4, 4));
    npc.wealth = Math.max(0, npc.wealth * (1 + rng.range(-0.08, 0.12)));
    // Opinions decay toward neutral
    npc.opinionOfPlayer = Math.round(npc.opinionOfPlayer * 0.92);
  }
  return headlines;
}
