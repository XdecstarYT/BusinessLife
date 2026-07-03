/**
 * Core type definitions for the BusinessLife simulation.
 *
 * Design notes:
 *  - The entire game state is a single serialisable object (GameState) so it
 *    can be saved to IndexedDB, exported as JSON, and replayed
 *    deterministically together with the RNG stream state.
 *  - Population-scale entities (millions of citizens) are simulated in
 *    aggregate on Country/City records; only "notable" NPCs (politicians,
 *    executives, rivals, family) exist as individual records.
 *  - Content (industries, laws, events, names) is data-driven and lives in
 *    src/data — the engine never hard-codes gameplay content.
 */

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female';

export interface Relationship {
  npcId: string;
  kind: 'parent' | 'sibling' | 'spouse' | 'child' | 'friend' | 'rival' | 'mentor' | 'ally';
  closeness: number; // 0..100
}

export interface EducationRecord {
  degree: string;
  field: string;
  yearCompleted: number;
}

export interface Holding {
  companyId: string;
  shares: number; // negative = short position
  costBasis: number; // average price paid per share
}

export interface PropertyAsset {
  id: string;
  name: string;
  kind: 'apartment' | 'house' | 'mansion' | 'commercial' | 'land' | 'island';
  cityId: string;
  value: number;
  purchasePrice: number;
  rentalYield: number; // fraction of value per year, 0 if not rented
  mortgage: number; // outstanding principal
}

export interface PersonalLoan {
  id: string;
  principal: number;
  rate: number;
  yearsLeft: number;
  purpose: string;
}

export type OfficeKind =
  | 'councillor'
  | 'mayor'
  | 'state_legislator'
  | 'governor'
  | 'legislator' // national MP / congressperson / senator
  | 'minister'
  | 'party_leader'
  | 'head_of_state' // PM or President depending on system
  | 'dictator'
  | 'monarch';

export interface Office {
  kind: OfficeKind;
  title: string;
  regionName: string;
  termYears: number;
  yearsInOffice: number;
  yearsInOfficeTotal: number;
}

export interface PlayerJob {
  title: string;
  industryId: string;
  employerId: string | null; // company id, or null for generic employer
  employerName: string;
  salary: number;
  performance: number; // 0..100
  yearsInRole: number;
  track: 'none' | 'corporate' | 'public' | 'media' | 'crime';
}

export interface Player {
  name: string;
  gender: Gender;
  age: number;
  alive: boolean;
  countryId: string;
  cityId: string;

  // Core stats, 0..100
  health: number;
  happiness: number;
  smarts: number;
  charisma: number;
  reputation: number; // business/professional standing
  popularity: number; // political standing with the public
  influence: number; // elite connections, lobbying power
  karma: number;
  notoriety: number; // criminal-world standing

  money: number;
  criminalRecord: number; // number of convictions
  inJailYears: number;

  skills: Record<string, number>; // skillId -> 0..100
  education: EducationRecord[];
  studying: { degree: string; field: string; yearsLeft: number; costPerYear: number } | null;

  job: PlayerJob | null;
  companies: string[]; // ids of companies the player founded/owns
  portfolio: Holding[];
  properties: PropertyAsset[];
  loans: PersonalLoan[];

  relationships: Relationship[];
  partyId: string | null;
  office: Office | null;
  politicalCapital: number; // spend to pass laws, gain from wins
  campaign: null | {
    officeKind: OfficeKind;
    regionName: string;
    warChest: number;
    momentum: number; // -50..50 swing on top of fundamentals
    yearsToElection: number;
  };
}

export type NPCRole =
  | 'politician'
  | 'executive'
  | 'investor'
  | 'journalist'
  | 'union_leader'
  | 'celebrity'
  | 'criminal'
  | 'family'
  | 'citizen';

export interface NPC {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  alive: boolean;
  countryId: string;
  role: NPCRole;
  wealth: number;
  competence: number; // 0..100
  charisma: number;
  ambition: number; // 0..100 drives career moves
  riskTolerance: number; // 0..100 drives investing/business behaviour
  ideology: number; // -100 (left) .. 100 (right)
  integrity: number; // 0..100, low => corruptible
  popularity: number;
  opinionOfPlayer: number; // -100..100
  partyId: string | null;
  officeKind: OfficeKind | null;
  companyId: string | null; // company they run/own
  goal: string;
  memory: string[]; // notable interactions with the player
}

// ---------------------------------------------------------------------------
// Economy & world
// ---------------------------------------------------------------------------

export type EconomicRegime = 'boom' | 'expansion' | 'stagnation' | 'recession' | 'depression';

export interface EconomySnapshot {
  year: number;
  gdp: number;
  gdpGrowth: number;
  inflation: number;
  interestRate: number;
  unemployment: number;
  stockIndex: number;
  housingIndex: number;
}

export interface TaxRates {
  income: number; // top marginal, fraction
  corporate: number;
  sales: number;
  capitalGains: number;
}

export interface Economy {
  gdp: number; // in billions of local currency
  gdpGrowth: number; // fraction, e.g. 0.025
  inflation: number;
  interestRate: number; // central bank policy rate
  unemployment: number;
  consumerConfidence: number; // 0..100
  businessConfidence: number; // 0..100
  housingIndex: number; // 100 = start of game
  stockIndex: number; // 100 = start of game
  exchangeRate: number; // vs. world reserve currency, 1.0 = par at start
  govDebtToGdp: number; // fraction
  budgetBalance: number; // fraction of GDP, negative = deficit
  taxRates: TaxRates;
  minimumWage: number; // yearly full-time equivalent
  regime: EconomicRegime;
  yearsInRegime: number;
  commodities: Record<string, number>; // price indices: oil, gold, grain, metals, gas
  history: EconomySnapshot[];
}

export interface City {
  id: string;
  name: string;
  stateId: string;
  population: number;
  costOfLiving: number; // multiplier, 1.0 = national average
  crime: number; // 0..100
  mayorId: string | null;
}

export interface CountryState {
  id: string;
  name: string;
  population: number;
  governorId: string | null;
  cityIds: string[];
}

export type PoliticalSystem = 'presidential' | 'parliamentary' | 'monarchy' | 'dictatorship';

export interface Party {
  id: string;
  name: string;
  ideology: number; // -100..100
  seats: number; // share of national legislature seats (out of totalSeats)
  support: number; // current polling, 0..100
  leaderId: string | null;
  playerCreated: boolean;
}

export interface Country {
  id: string;
  name: string;
  flag: string; // emoji
  currency: string;
  currencySymbol: string;
  population: number;
  birthRate: number; // per 1000
  deathRate: number;
  migrationRate: number; // net per 1000
  system: PoliticalSystem;
  leaderId: string | null; // NPC id, or 'player'
  leaderTitle: string;
  parties: Party[];
  totalSeats: number;
  electionInYears: number;
  stability: number; // 0..100
  corruption: number; // 0..100
  pressFreedom: number; // 0..100
  approvalOfGovernment: number; // 0..100
  militaryPower: number; // 0..100
  literacy: number;
  healthcare: number; // quality 0..100
  education: number; // quality 0..100
  infrastructure: number; // 0..100
  climateRisk: number; // 0..100 exposure to disasters
  resources: string[]; // commodity tags this country exports
  relations: Record<string, number>; // countryId -> -100..100
  atWarWith: string[];
  sanctionsOn: string[]; // countries this one sanctions
  lawsInForce: string[]; // law ids currently enacted
  economy: Economy;
  states: CountryState[];
  cities: City[];
  isPlayerHome: boolean;
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

export interface Industry {
  id: string;
  name: string;
  sector: string;
  description: string;
  startupCost: number;
  baseMargin: number; // typical operating margin at neutral settings
  volatility: number; // 0..1 revenue noise
  cyclicality: number; // 0..1 sensitivity to the business cycle
  capitalIntensity: number; // 0..1 — asset/factory heaviness
  laborIntensity: number; // 0..1 — how many employees per revenue
  techIntensity: number; // 0..1 — R&D sensitivity
  regulationSensitivity: number; // 0..1 — exposure to law changes
  skillId: string; // primary skill that improves performance
  tags: string[]; // used by laws/events to target industries
}

export interface CompanyHistoryPoint {
  year: number;
  revenue: number;
  profit: number;
  employees: number;
  sharePrice: number | null;
}

export type CompanyStatus = 'active' | 'bankrupt' | 'sold' | 'acquired';

export interface Company {
  id: string;
  name: string;
  industryId: string;
  countryId: string;
  foundedYear: number;
  founderId: string; // 'player' or NPC id
  playerOwned: boolean;
  playerSharePct: number; // player equity fraction 0..1

  cash: number;
  revenue: number;
  expenses: number;
  profit: number;
  debt: number;
  debtRate: number;
  assets: number; // book value of factories/warehouses/equipment

  employees: number;
  salaryLevel: number; // 0.8 low .. 1.4 generous (multiplier vs market)
  morale: number; // 0..100
  managerQuality: number; // 0..100
  automation: number; // 0..100
  unionized: boolean;

  quality: number; // product quality 0..100
  brand: number; // 0..100
  customerSatisfaction: number; // 0..100
  esg: number; // 0..100
  marketShare: number; // 0..1 of its industry in its country

  priceLevel: number; // 0.7 discount .. 1.5 premium
  marketingPct: number; // fraction of revenue spent on marketing
  rdPct: number; // fraction of revenue spent on R&D

  isPublic: boolean;
  sharesOutstanding: number;
  sharePrice: number;
  dividendPayoutPct: number; // fraction of profit paid out
  analystExpectation: number; // expected profit next year
  institutionalOwnPct: number;
  shortInterest: number; // 0..1

  lawsuits: number;
  insured: boolean;
  politicalInfluence: number; // 0..100 lobbying muscle

  status: CompanyStatus;
  history: CompanyHistoryPoint[];
}

// ---------------------------------------------------------------------------
// Laws & politics content
// ---------------------------------------------------------------------------

export interface LawEffects {
  gdpGrowth?: number; // annual additive modifier while in force
  inflation?: number;
  unemployment?: number;
  businessConfidence?: number; // additive to level while in force
  consumerConfidence?: number;
  stability?: number;
  corruption?: number;
  pressFreedom?: number;
  healthcare?: number;
  education?: number;
  infrastructure?: number;
  militaryPower?: number;
  climateRisk?: number;
  crime?: number; // country-wide crime pressure
  budgetBalance?: number; // fraction of GDP per year
  taxIncome?: number; // sets/offsets tax rates (additive)
  taxCorporate?: number;
  taxSales?: number;
  taxCapitalGains?: number;
  minimumWagePct?: number; // multiplies minimum wage
  industryTagModifiers?: Record<string, number>; // tag -> revenue multiplier offset, e.g. { green: +0.1, oil: -0.15 }
}

export interface LawDef {
  id: string;
  name: string;
  category: string;
  description: string;
  effects: LawEffects;
  // How different blocs feel about it, -1..1. Drives legislature votes & approval.
  support: { left: number; right: number; business: number; workers: number };
  approvalImpact: number; // one-off public approval change when passed
  repealable: boolean;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EffectSpec {
  money?: number;
  moneyPct?: number; // fraction of current money
  moneyAmountMult?: number; // multiplies the fired event's resolved {amount}
  health?: number;
  happiness?: number;
  smarts?: number;
  charisma?: number;
  reputation?: number;
  popularity?: number;
  influence?: number;
  karma?: number;
  notoriety?: number;
  politicalCapital?: number;
  skillXp?: [string, number]; // skillId, amount
  companyCash?: number; // applied to the event's subject company
  companyBrand?: number;
  companyQuality?: number;
  companyMorale?: number;
  jobPerformance?: number;
  criminalRecord?: number;
  jailYears?: number;
  loseJob?: boolean;
  campaignMomentum?: number;
  approvalOfGovernment?: number;
}

export interface EventOutcome {
  chance: number; // weight among outcomes; skill check may shift it
  text: string;
  effects: EffectSpec;
}

export interface EventChoice {
  label: string;
  effects?: EffectSpec; // guaranteed effects
  outcomes?: EventOutcome[]; // random/skill-checked results
  skillCheck?: { skillId: string; bonusPerLevel: number }; // shifts first outcome's chance
}

export interface EventConditions {
  minAge?: number;
  maxAge?: number;
  minMoney?: number;
  maxMoney?: number;
  employed?: boolean;
  hasBusiness?: boolean;
  businessTag?: string; // has a company whose industry has this tag
  inOffice?: OfficeKind[] | 'any';
  notInOffice?: boolean;
  campaigning?: boolean;
  inParty?: boolean;
  minPopularity?: number;
  minReputation?: number;
  minNotoriety?: number;
  regime?: EconomicRegime[];
  hasStocks?: boolean;
  inJail?: boolean;
  studying?: boolean;
  minInfluence?: number;
  track?: PlayerJob['track'];
}

export interface EventTemplate {
  id: string;
  category:
    | 'life'
    | 'career'
    | 'business'
    | 'market'
    | 'politics'
    | 'crime'
    | 'world'
    | 'media'
    | 'family'
    | 'health';
  weight: number;
  once?: boolean;
  conditions?: EventConditions;
  /** Text supports placeholders: {name} {city} {country} {company} {npc} {amount} {industry} {year} */
  text: string;
  /** Resolved once when the event fires; referenced by {amount} and moneyAmountMult. */
  amount?: { min: number; max: number; pctOfMoney?: number };
  choices: EventChoice[];
}

/** An event instance fired for the current year, awaiting the player's choice. */
export interface FiredEvent {
  templateId: string;
  text: string;
  choices: EventChoice[];
  subjectCompanyId: string | null;
  subjectNpcId: string | null;
  amount: number; // resolved {amount} placeholder value
}

// ---------------------------------------------------------------------------
// News & logs
// ---------------------------------------------------------------------------

export interface NewsItem {
  year: number;
  category: 'economy' | 'business' | 'politics' | 'world' | 'markets' | 'society' | 'player';
  headline: string;
  outlet: string;
  sentiment: number; // -1..1
}

export interface LifeLogEntry {
  year: number;
  age: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'money' | 'politics' | 'business' | 'milestone';
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export interface NetWorthPoint {
  year: number;
  value: number;
}

export interface GameOverInfo {
  reason: string;
  summary: string[];
  finalNetWorth: number;
  finalAge: number;
}

export interface GameState {
  version: number;
  saveName: string;
  seed: number;
  rngState: number;
  year: number;
  startYear: number;

  player: Player;
  countries: Country[];
  industries: Industry[];
  companies: Record<string, Company>;
  npcs: Record<string, NPC>;

  news: NewsItem[];
  lifeLog: LifeLogEntry[];
  pendingEvents: FiredEvent[];
  firedOnce: string[];
  achievements: string[];
  netWorthHistory: NetWorthPoint[];
  gameOver: GameOverInfo | null;
}

// ---------------------------------------------------------------------------
// Helpers shared across systems
// ---------------------------------------------------------------------------

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function clamp100(v: number): number {
  return clamp(v, 0, 100);
}
