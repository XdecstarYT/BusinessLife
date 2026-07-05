/**
 * World generation: expands country seeds into a living world with states,
 * cities, parties, politicians, executives and publicly listed companies,
 * then creates the 18-year-old player character inside it.
 */
import type { City, Country, CountryState, Difficulty, GameState, Gender, NPC, NPCRole, Party, Player } from './types';
import { RNG, hashSeed } from './rng';
import { COUNTRY_SEEDS } from '../data/countries';
import { initEconomy } from './economy';
import { makeCityName, makeCompanyName, makePartyName, makePersonName, makeStateName } from '../data/names';
import { INDUSTRIES } from '../data/industries';
import { createCompany, nextCompanyId } from './business';
import { doIPO } from './market';
import { SKILLS } from '../data/skills';

let npcCounter = 0;
function makeNPC(rng: RNG, countryId: string, role: NPCRole, overrides: Partial<NPC> = {}): NPC {
  const gender: Gender = rng.chance(0.5) ? 'male' : 'female';
  return {
    id: `npc_${++npcCounter}`,
    name: makePersonName(rng, gender),
    gender,
    age: rng.int(32, 68),
    alive: true,
    countryId,
    role,
    wealth: role === 'executive' || role === 'investor' ? rng.range(2e6, 5e9) : rng.range(5e4, 5e6),
    competence: rng.int(30, 90),
    charisma: rng.int(25, 90),
    ambition: rng.int(30, 95),
    riskTolerance: rng.int(15, 90),
    ideology: rng.int(-80, 80),
    integrity: rng.int(15, 95),
    popularity: rng.int(20, 70),
    opinionOfPlayer: 0,
    partyId: null,
    officeKind: null,
    companyId: null,
    goal: rng.pick([
      'build a business empire', 'reach the top of politics', 'get rich quietly', 'change the country',
      'protect their family legacy', 'be remembered', 'accumulate power', 'retire early to an island',
    ]),
    memory: [],
    ...overrides,
  };
}

function generateParties(rng: RNG, seed: { ideologyLean: number }, totalSeats: number): Party[] {
  const count = rng.int(3, 5);
  const parties: Party[] = [];
  const anchors = rng.shuffle([-55, -25, 5, 35, 65]).slice(0, count);
  let remainingSeats = totalSeats;
  for (let i = 0; i < count; i++) {
    const ideology = anchors[i] + rng.int(-10, 10);
    // Closer to national lean = more support
    const fit = Math.max(5, 45 - Math.abs(ideology - seed.ideologyLean) * 0.55 + rng.int(-8, 8));
    parties.push({
      id: `party_${npcCounter}_${i}_${Math.floor(rng.next() * 1e6)}`,
      name: makePartyName(rng),
      ideology,
      seats: 0,
      support: fit,
      leaderId: null,
      playerCreated: false,
    });
  }
  // Normalize support to 100 and allocate seats proportionally.
  const totalSupport = parties.reduce((s, p) => s + p.support, 0);
  for (const p of parties) p.support = (p.support / totalSupport) * 100;
  parties.sort((a, b) => b.support - a.support);
  for (let i = 0; i < parties.length; i++) {
    const p = parties[i];
    p.seats = i === parties.length - 1 ? remainingSeats : Math.round(totalSeats * (p.support / 100));
    remainingSeats -= p.seats;
  }
  return parties;
}

export type Scenario = 'modern' | 'recession' | 'boom' | 'crisis';

export interface NewGameConfig {
  playerName: string;
  gender: Gender;
  seedText: string;
  startYear?: number;
  scenario?: Scenario;
  difficulty?: Difficulty;
  legacyBonus?: number; // starting money bonus carried over from a previous life's Legacy Score
}

export function generateWorld(config: NewGameConfig): GameState {
  npcCounter = 0;
  const seedNum = hashSeed(config.seedText || `${Date.now()}`);
  const rng = new RNG(seedNum);
  const startYear = config.startYear ?? 2026;

  const npcs: Record<string, NPC> = {};
  const countries: Country[] = [];

  for (const seed of COUNTRY_SEEDS) {
    const totalSeats = seed.system === 'dictatorship' || seed.system === 'monarchy' ? 0 : rng.pick([120, 150, 200, 300]);
    const parties = totalSeats > 0 ? generateParties(rng, seed, totalSeats) : [];

    // States & cities
    const states: CountryState[] = [];
    const cities: City[] = [];
    const stateCount = rng.int(3, 6);
    const usedStateNames = new Set<string>();
    for (let s = 0; s < stateCount; s++) {
      let sName = makeStateName(rng);
      while (usedStateNames.has(sName)) sName = makeStateName(rng);
      usedStateNames.add(sName);
      const stateId = `${seed.id}_state_${s}`;
      const cityIds: string[] = [];
      const cityCount = rng.int(2, 4);
      for (let ci = 0; ci < cityCount; ci++) {
        const cityId = `${stateId}_city_${ci}`;
        cityIds.push(cityId);
        cities.push({
          id: cityId,
          name: makeCityName(rng),
          stateId,
          population: Math.round(seed.population * rng.range(0.005, 0.12)),
          costOfLiving: rng.range(0.75, 1.5),
          crime: rng.range(20, 60),
          mayorId: null,
        });
      }
      const governor = makeNPC(rng, seed.id, 'politician', { partyId: parties[0]?.id ?? null, officeKind: 'governor' });
      npcs[governor.id] = governor;
      states.push({
        id: stateId,
        name: sName,
        population: 0, // filled below
        governorId: governor.id,
        cityIds,
      });
    }
    for (const st of states) {
      st.population = cities.filter((c) => c.stateId === st.id).reduce((s, c) => s + c.population, 0);
    }
    // Mayors for the biggest cities
    for (const city of cities.slice(0, 6)) {
      const mayor = makeNPC(rng, seed.id, 'politician', { officeKind: 'mayor', partyId: parties.length ? rng.pick(parties).id : null });
      npcs[mayor.id] = mayor;
      city.mayorId = mayor.id;
    }

    // National leader
    const leader = makeNPC(rng, seed.id, 'politician', {
      officeKind: seed.system === 'dictatorship' ? 'dictator' : seed.system === 'monarchy' ? 'monarch' : 'head_of_state',
      partyId: parties[0]?.id ?? null,
      popularity: rng.int(35, 65),
      age: rng.int(45, 75),
    });
    npcs[leader.id] = leader;
    if (parties[0]) parties[0].leaderId = leader.id;
    for (const p of parties.slice(1)) {
      const pl = makeNPC(rng, seed.id, 'politician', { partyId: p.id });
      npcs[pl.id] = pl;
      p.leaderId = pl.id;
    }

    const country: Country = {
      id: seed.id,
      name: seed.name,
      flag: seed.flag,
      currency: seed.currency,
      currencySymbol: seed.currencySymbol,
      population: seed.population,
      birthRate: rng.range(8, 22),
      deathRate: rng.range(6, 11),
      migrationRate: rng.range(-3, 6),
      system: seed.system,
      leaderId: leader.id,
      leaderTitle: seed.leaderTitle,
      parties,
      totalSeats,
      electionInYears: totalSeats > 0 ? rng.int(1, 4) : 0,
      stability: seed.stability,
      corruption: seed.corruption,
      pressFreedom: seed.pressFreedom,
      approvalOfGovernment: rng.range(35, 60),
      militaryPower: seed.militaryPower,
      literacy: rng.range(80, 99),
      healthcare: Math.min(95, seed.gdpPerCapita / 1000 + rng.range(10, 30)),
      education: Math.min(95, seed.gdpPerCapita / 1000 + rng.range(10, 30)),
      infrastructure: Math.min(95, seed.gdpPerCapita / 900 + rng.range(5, 25)),
      climateRisk: seed.climateRisk,
      resources: seed.resources,
      relations: {},
      atWarWith: [],
      sanctionsOn: [],
      lawsInForce: [],
      cabinet: {},
      coalitionPartnerId: null,
      economy: initEconomy(seed, rng, config.scenario ?? 'modern'),
      states,
      cities,
      isPlayerHome: !!seed.isPlayerHome,
      budgetAllocations: { Finance: 16.67, 'Foreign Affairs': 16.67, Defense: 16.67, Health: 16.67, Education: 16.67, Justice: 16.65 },
      infrastructureProjects: [],
      intelCapability: rng.range(15, 40),
      taxAdjustments: {},
      immigrationQuota: rng.range(35, 65),
      warStrategies: {},
      chiefJusticeId: null,
      judicialIntegrity: rng.range(40, 75),
      allianceId: null,
      laborMarketTightness: rng.range(30, 60),
      researchLevel: rng.range(20, 50),
      energyRenewableShare: rng.range(15, 45),
      unrest: rng.range(5, 20),
      cyberDefense: rng.range(25, 55),
      oppositionLeaderId: null,
      globalGamesYear: null,
    };
    countries.push(country);
  }

  // Diplomatic relations
  for (const a of countries) {
    for (const b of countries) {
      if (a.id === b.id) continue;
      const ideologyGap = Math.abs((a.system === 'dictatorship' ? 60 : 0) - (b.system === 'dictatorship' ? 60 : 0));
      a.relations[b.id] = Math.round(rng.range(-30, 60) - ideologyGap * 0.4);
    }
  }

  // Build the game state scaffold, then fill companies (needs state for ids).
  const state: GameState = {
    version: 1,
    saveName: config.playerName,
    seed: seedNum,
    rngState: 0,
    year: startYear,
    startYear,
    player: null as unknown as Player, // assigned below
    countries,
    industries: INDUSTRIES,
    companies: {},
    npcs,
    news: [],
    lifeLog: [],
    pendingEvents: [],
    firedOnce: [],
    achievements: [],
    netWorthHistory: [],
    gameOver: null,
    worldEvent: null,
    generation: 1,
    calendarDay: 0,
    difficulty: config.difficulty ?? 'standard',
    alliances: [],
    yearRecap: null,
    pendingSuccession: null,
    worldHistory: [],
    cryptoPrice: rng.range(800, 3_000),
    cryptoHistory: [],
    products: {},
    productTech: [],
    storefront: { name: `${config.playerName.split(' ').pop()} Studio`, theme: 'aurora', featuredProductId: null },
    componentShortage: null,
    customParts: {},
  };

  // Public + private NPC companies per country (more in the player's home).
  for (const country of countries) {
    const gdpScale = country.economy.gdp;
    const count = country.isPlayerHome ? 26 : rng.int(10, 16);
    for (let i = 0; i < count; i++) {
      const industry = rng.pick(INDUSTRIES);
      const exec = makeNPC(rng, country.id, 'executive');
      npcs[exec.id] = exec;
      const scale = rng.range(3, 60) * Math.max(0.3, gdpScale / 2000);
      const capital = industry.startupCost * scale;
      const co = createCompany({
        name: makeCompanyName(rng, industry.sector, exec.name.split(' ').pop()),
        industry,
        countryId: country.id,
        founderId: exec.id,
        playerOwned: false,
        capital,
        year: startYear - rng.int(3, 60),
        scale,
      }, rng);
      co.id = nextCompanyId(state);
      exec.companyId = co.id;
      // Simulate a bit of maturity
      co.brand = rng.range(30, 85);
      co.quality = rng.range(40, 85);
      co.managerQuality = rng.range(40, 85);
      co.profit = co.revenue * industry.baseMargin * rng.range(0.4, 1.2);
      co.cash = co.revenue * rng.range(0.1, 0.4);
      state.companies[co.id] = co;
      if (rng.chance(0.7)) {
        doIPO(co, rng);
        co.dividendPayoutPct = rng.chance(0.5) ? rng.range(0.1, 0.5) : 0;
      }
    }
    // A few more notable NPCs per country
    for (let i = 0; i < 6; i++) {
      const roles: NPCRole[] = ['investor', 'journalist', 'union_leader', 'celebrity', 'criminal', 'citizen'];
      const npc = makeNPC(rng, country.id, rng.pick(roles));
      npcs[npc.id] = npc;
    }
  }

  // --- Player ------------------------------------------------------------
  const home = countries.find((c) => c.isPlayerHome)!;
  const homeCity = rng.pick(home.cities);
  const skills: Record<string, number> = {};
  for (const s of SKILLS) skills[s.id] = 0;
  // A few random aptitudes
  for (let i = 0; i < 6; i++) skills[rng.pick(SKILLS).id] = rng.int(5, 25);

  const player: Player = {
    name: config.playerName,
    gender: config.gender,
    age: 18,
    alive: true,
    countryId: home.id,
    cityId: homeCity.id,
    health: rng.int(75, 95),
    happiness: rng.int(60, 85),
    smarts: rng.int(40, 85),
    charisma: rng.int(35, 80),
    reputation: 5,
    popularity: 0,
    influence: 0,
    karma: 50,
    notoriety: 0,
    money: rng.int(500, 5_000) + Math.max(0, config.legacyBonus ?? 0),
    criminalRecord: 0,
    inJailYears: 0,
    skills,
    education: [],
    studying: null,
    job: null,
    companies: [],
    portfolio: [],
    properties: [],
    loans: [],
    bonds: [],
    forexPositions: [],
    lifeInsurance: null,
    relationships: [],
    spouseId: null,
    children: [],
    grandchildren: [],
    divorceCount: 0,
    primaryHeirId: null,
    mentorId: null,
    rivalId: null,
    crimeFamilyId: null,
    crimeRank: 0,
    partyId: null,
    office: null,
    politicalCapital: 0,
    politicalHeirId: null,
    advisors: [],
    campaign: null,
    lastElectionResult: null,
    hasPrenup: false,
    lobbyingFirmHired: false,
    marginDebt: 0,
    drip: false,
    limitOrders: [],
    challenge: null,
    dirtyMoney: 0,
    turfControl: 0,
    inWitnessProtection: false,
    thinkTankFunded: false,
    prAgencyHired: false,
    luxuryAssets: [],
    celebrityStakes: [],
    cryptoUnits: 0,
    savingsBalance: 0,
    termDeposits: [],
    foundation: null,
    retired: false,
    pensionIncome: 0,
    memoir: null,
  };
  // Parents
  for (const kind of ['parent', 'parent'] as const) {
    const parent = makeNPC(rng, home.id, 'family', { age: rng.int(40, 55) });
    npcs[parent.id] = parent;
    player.relationships.push({ npcId: parent.id, kind, closeness: rng.int(55, 95) });
  }

  state.player = player;
  state.rngState = rng.state;
  state.lifeLog.push({
    year: startYear,
    age: 18,
    text: `You turn 18 in ${homeCity.name}, ${home.name}. The world is yours to take — build an empire, run the country, or both.`,
    kind: 'milestone',
  });
  state.netWorthHistory.push({ year: startYear, value: player.money });
  return state;
}
