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
  kind: 'parent' | 'sibling' | 'spouse' | 'child' | 'grandchild' | 'friend' | 'rival' | 'mentor' | 'ally';
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

export type MaintenanceLevel = 'minimal' | 'standard' | 'premium';

export interface PropertyAsset {
  id: string;
  name: string;
  kind: 'apartment' | 'house' | 'mansion' | 'commercial' | 'land' | 'island' | 'penthouse';
  cityId: string;
  value: number;
  purchasePrice: number;
  rentalYield: number; // fraction of value per year, 0 if not rented out
  baseRentalYield: number; // remembered yield so toggling rental status is reversible
  mortgage: number; // outstanding principal
  insured: boolean;
  yearBuilt: number; // construction year — undeveloped land uses the purchase year
  condition: number; // 0..100, decays with age and neglect, restored by renovation
  energyEfficiency: number; // 0..100, ages slowly, boosted by renovation
  maintenanceLevel: MaintenanceLevel; // player-chosen upkeep spend; trades cost for condition
  lastRenovatedYear: number | null;
}

export type LuxuryAssetKind = 'private_jet' | 'yacht' | 'island' | 'sports_team' | 'racehorse' | 'artwork';

export interface LuxuryAsset {
  id: string;
  kind: LuxuryAssetKind;
  name: string;
  value: number;
  upkeepPerYear: number;
  yearAcquired: number;
}

export interface CelebrityStake {
  npcId: string;
  invested: number;
  stakePct: number; // 0..1
}

export interface TermDeposit {
  id: string;
  principal: number;
  rate: number; // fixed at opening
  yearsLeft: number;
}

export interface CharityFoundation {
  name: string;
  endowment: number; // invested corpus; grants ~5% per year
  totalGiven: number; // lifetime grants distributed
}

export interface Memoir {
  title: string;
  yearsLeft: number; // remaining royalty years
  royaltyPerYear: number;
}

export interface Bond {
  id: string;
  countryId: string;
  principal: number;
  rate: number; // fixed annual coupon
  yearsLeft: number;
}

export interface ForexPosition {
  id: string;
  countryId: string; // the foreign currency being speculated on
  notional: number; // position size in home currency
  entryRate: number; // country.economy.exchangeRate at entry
  short: boolean; // betting the foreign currency weakens vs home
}

export interface LifeInsurancePolicy {
  monthlyPremium: number; // deducted yearly as premium*12
  payout: number;
}

export interface LimitOrder {
  id: string;
  companyId: string;
  kind: 'buy' | 'sell';
  targetPrice: number; // executes when sharePrice crosses this threshold
  amount: number; // dollar amount to transact when triggered
}

export type ChallengeKind = 'net_worth' | 'reputation' | 'companies';

export interface Challenge {
  id: string;
  description: string;
  kind: ChallengeKind;
  targetValue: number;
  deadlineYear: number;
  rewardMoney: number;
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
  promises: ManifestoPromise[];
  promiseBaseline: Partial<Record<ManifestoPromise, number>>;
}

export const MANIFESTO_PROMISES = ['tax_cuts', 'healthcare', 'education', 'jobs', 'crime_reduction', 'infrastructure'] as const;
export type ManifestoPromise = (typeof MANIFESTO_PROMISES)[number];

export const CAREER_RANKS = ['intern', 'junior', 'mid', 'senior', 'manager', 'executive'] as const;
export type CareerRank = (typeof CAREER_RANKS)[number];

export type CoworkerPersonality = 'friendly' | 'competitive' | 'toxic' | 'mentoring' | 'political';

export interface Coworker {
  id: string;
  name: string;
  role: 'manager' | 'peer';
  personality: CoworkerPersonality;
  rapport: number; // 0..100
  memory: string[]; // notable interactions with the player (network, HR reports, incidents)
}

export type WorkStyle = 'standard' | 'overtime' | 'flexible';

export interface PlayerJob {
  title: string;
  industryId: string;
  employerId: string | null; // company id, or null for generic employer
  employerName: string;
  salary: number;
  performance: number; // 0..100
  yearsInRole: number; // years since the last promotion/rank change
  yearsAtCompany: number; // total tenure, survives promotions
  track: 'none' | 'corporate' | 'public' | 'media' | 'crime';
  rank: CareerRank;
  stress: number; // 0..100, driven by work style and toxic coworkers; hurts health/performance
  reliability: number; // 0..100, punctuality/attendance proxy; drifts with stress and health
  workStyle: WorkStyle;
  coworkers: Coworker[]; // a manager plus one or two peers
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
  bonds: Bond[];
  forexPositions: ForexPosition[];
  lifeInsurance: LifeInsurancePolicy | null;

  relationships: Relationship[];
  spouseId: string | null; // NPC id; also present in relationships as kind 'spouse'
  children: string[]; // NPC ids; also present in relationships as kind 'child'
  grandchildren: string[]; // NPC ids; also present in relationships as kind 'grandchild'
  divorceCount: number;
  primaryHeirId: string | null; // designated in a will; gets priority in the estate split and top billing at succession
  mentorId: string | null; // NPC id; also present in relationships as kind 'mentor'
  rivalId: string | null; // NPC id; also present in relationships as kind 'rival'
  crimeFamilyId: string | null; // NPC id of the boss, if the player has joined organized crime
  crimeRank: number; // 0 = not in the family, 1..5 = rank climbed
  partyId: string | null;
  office: Office | null;
  politicalCapital: number; // spend to pass laws, gain from wins
  politicalHeirId: string | null; // NPC id (adult child) designated to inherit party/popularity on death
  advisors: Advisor[]; // up to 3 hired AI advisors offering recommendations that can be wrong
  hasPrenup: boolean; // current marriage has a prenuptial agreement protecting premarital assets
  lobbyingFirmHired: boolean; // ongoing retainer that boosts law-pass odds
  marginDebt: number; // borrowed amount financing leveraged stock positions
  drip: boolean; // dividend reinvestment plan: dividends auto-buy more shares of the same stock
  limitOrders: LimitOrder[];
  challenge: Challenge | null; // an active random mid-game objective
  dirtyMoney: number; // illicit proceeds from heists/rackets; must be laundered before spending freely
  turfControl: number; // 0..100, crime family's territorial strength; boosts heist/racket payouts
  inWitnessProtection: boolean; // wiped criminal record/notoriety at a steep one-time cost
  thinkTankFunded: boolean; // ongoing retainer that slowly builds influence and (if leader) approval
  prAgencyHired: boolean; // ongoing retainer that softens negative reputation/popularity/happiness hits
  luxuryAssets: LuxuryAsset[]; // billionaire lifestyle purchases: jets, yachts, islands, sports teams, racehorses, art
  celebrityStakes: CelebrityStake[]; // equity-like stakes in a celebrity NPC's earning power
  cryptoUnits: number; // holdings of the world's single (volatile) cryptocurrency
  savingsBalance: number; // bank savings account earning the policy rate minus a spread
  termDeposits: TermDeposit[]; // locked deposits at a fixed rate until maturity
  foundation: CharityFoundation | null; // personal charitable foundation, once founded
  retired: boolean; // formally retired from employment
  pensionIncome: number; // yearly pension once retired, based on career at retirement
  lastFiredYear: number | null; // reference damage window — dents interview odds and offers for a few years
  freelanceReputation: number; // 0..100, gig-economy standing independent of any employer
  freelanceGigsCompleted: number;
  unemployedYears: number; // consecutive years without a job or company; drives skill decay and safety-net support
  memoir: Memoir | null; // published autobiography paying royalties for a few years
  socialFollowers: number; // social-media audience size
  cancelledUntilYear: number | null; // a viral backlash is actively depressing reputation/popularity until this year
  lastSocialPostYear: number | null; // cooldown so posting can't be spammed for free rolls
  campaign: null | {
    officeKind: OfficeKind;
    regionName: string;
    warChest: number;
    momentum: number; // -50..50 swing on top of fundamentals
    yearsToElection: number;
    consultantHired: boolean; // boosts momentum gains from campaign actions
    promises: ManifestoPromise[]; // manifesto pledges made at launch, tracked for fulfillment in office
  };
  lastElectionResult: ElectionResult | null; // transient: set on resolution, cleared once the UI shows it
}

export interface ElectionResult {
  won: boolean;
  officeTitle: string;
  regionName: string;
  playerSharePct: number; // estimated vote share, 0..100
  rivalSharePct: number;
  regionalBreakdown: { cityName: string; playerSharePct: number }[];
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
  parentId?: string; // NPC id of the parent, for tracking grandchildren lineage

  // V17: stable personality dials (0..100), distinct from the career/politics-facing
  // competence/charisma/ambition/riskTolerance/integrity above — these drive relationship
  // and social-decision math instead of career/investing behaviour.
  empathy: number;
  aggression: number;
  socialConfidence: number;
  discipline: number;
  loyalty: number;
  curiosity: number;

  // V17: dynamic day-to-day state (0..100), drifts a little every year in tickNPCs.
  mood: number;
  stress: number;
  fatigue: number;
  financialPressure: number;
  relationshipTension: number; // specifically about their relationship with the player
  careerSatisfaction: number;
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
  cabinet: Record<string, string>; // portfolio key -> NPC id or 'player'
  coalitionPartnerId: string | null; // party id propping up the governing party/player
  economy: Economy;
  states: CountryState[];
  cities: City[];
  isPlayerHome: boolean;
  budgetAllocations: Record<CabinetPortfolio, number>; // share of budget per portfolio, sums to 100
  infrastructureProjects: InfrastructureProject[];
  intelCapability: number; // 0..100, national intelligence agency strength
  taxAdjustments: Partial<TaxRates>; // player-set direct rate offsets, layered on top of legislated rates
  immigrationQuota: number; // 0..100, openness; shifts migrationRate and labor supply
  warStrategies: Record<string, 'blockade' | 'invasion'>; // enemy countryId -> chosen strategy
  chiefJusticeId: string | null; // NPC id nominated to head the judiciary
  judicialIntegrity: number; // 0..100, higher = fewer arbitrary law strike-downs
  allianceId: string | null; // Alliance id this nation belongs to, if any
  laborMarketTightness: number; // 0..100, higher = harder/costlier hiring, more strike risk
  researchLevel: number; // 0..100, national R&D strength; boosts tech-intensive industries
  energyRenewableShare: number; // 0..100, share of the grid that's renewable; dampens climate risk growth
  unrest: number; // 0..100, active protest/strike movement intensity
  cyberDefense: number; // 0..100, national cyber defense strength; dampens cyberattack severity
  oppositionLeaderId: string | null; // NPC id; reactively critiques the player's government and adapts
  globalGamesYear: number | null; // year this nation hosts the Global Games, if a bid was won
}

export const CABINET_PORTFOLIOS = ['Finance', 'Foreign Affairs', 'Defense', 'Health', 'Education', 'Justice'] as const;
export type CabinetPortfolio = (typeof CABINET_PORTFOLIOS)[number];

export type InfrastructureKind =
  | 'roads'
  | 'rail'
  | 'airport'
  | 'power'
  | 'internet'
  | 'space_program'
  | 'bridge'
  | 'tunnel'
  | 'bullet_train'
  | 'stadium'
  | 'dam';

export interface InfrastructureProject {
  id: string;
  kind: InfrastructureKind;
  yearsLeft: number;
  totalYears: number;
}

export type AdvisorSpecialty = 'economy' | 'military' | 'diplomacy';

export interface Advisor {
  specialty: AdvisorSpecialty;
  accuracy: number; // 0..100, chance their recommendation actually pans out
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

  patents: number; // granted patents; each pays a small royalty and dings a rival
  trademarks: number; // filed trademarks; small ongoing brand-growth bonus
  cyberDefense: number; // 0..100, reduces breach/lawsuit risk
  supplyChainResilience: number; // 0..100, dampens commodity-price exposure
  hqTier: number; // 0=Basic Office, 1=Campus, 2=Tower, 3=Megacomplex
  culture: 'traditional' | 'flexible' | 'remote' | 'startup';
  successorId: string | null; // player's child (NPC id) designated to inherit this company

  executives: Executive[]; // hired CFO/COO/CMO, up to one per role
  bondDebt: number; // fixed-rate corporate bond principal outstanding
  bondRate: number; // locked coupon rate at issuance
  bondYearsLeft: number; // years remaining on the current bond term
  franchiseCount: number; // franchised locations; each pays a small ongoing royalty
  loyaltyProgram: boolean; // a membership/rewards program lifting retention and brand
  securityInvested: boolean; // loss-prevention investment; eliminates retail shrinkage at an ongoing cost
  moonshot: Moonshot | null; // a multi-year, high-risk R&D bet
  ceoName: string | null; // hired professional CEO running day-to-day (chairman mode)
  ceoSkill: number; // 0..100
  ceoSalary: number; // yearly, paid from company cash
  lastGovContractBidYear: number | null; // gates one bid per company per year
  lastGrantYear: number | null; // gates one grant application per company per year

  status: CompanyStatus;
  history: CompanyHistoryPoint[];
}

export interface Moonshot {
  yearsLeft: number;
  invested: number; // total committed; burned over the project's life
}

// ---------------------------------------------------------------------------
// Product Design & Commerce (the Studio)
// ---------------------------------------------------------------------------

export type ProductCategory =
  | 'smartphone' | 'laptop' | 'tablet' | 'wearable' | 'gaming' | 'audio'
  | 'appliance' | 'smart_home' | 'furniture' | 'fashion' | 'shoes' | 'jewelry'
  | 'cosmetics' | 'automotive' | 'food_beverage' | 'medical' | 'industrial'
  | 'toys' | 'sports' | 'luxury'
  | 'drone' | 'camera' | 'tv' | 'bicycle' | 'eyewear' | 'instrument' | 'kitchenware' | 'powertool';

export type ProductMaterialId =
  | 'aluminum' | 'titanium' | 'steel' | 'carbon_fiber' | 'glass' | 'leather'
  | 'plastic' | 'ceramic' | 'wood' | 'marble' | 'fabric' | 'gold' | 'chrome'
  | 'copper' | 'eco_composite' | 'recycled';

export type ProductStage = 'concept' | 'prototype' | 'testing' | 'production' | 'launched' | 'retired';
export type PublishState = 'draft' | 'internal' | 'portfolio' | 'marketplace' | 'public';
export type ManufacturingStrategy = 'handmade' | 'boutique' | 'regional' | 'overseas' | 'automated' | 'sustainable' | 'luxury_craft' | 'mass';
export type PackagingStyle = 'minimal' | 'premium' | 'eco' | 'playful' | 'industrial';
export type ProductFinish = 'matte' | 'gloss' | 'metallic' | 'brushed';
export type StudioLighting = 'studio' | 'sunset' | 'showroom' | 'noir';
export type LaunchVenue = 'livestream' | 'rooftop_party' | 'convention_keynote' | 'flagship_theater';
export type SalesChannel = 'storefront' | 'online' | 'retail' | 'boutique';

/** Per-part customization: overrides the body/accent defaults for one named piece of the model. */
export interface PartOverride {
  color: string | null;
  materialId: ProductMaterialId | null;
  finish: ProductFinish | null;
}

/** Component sourcing tiers — every slot of a product's bill of materials is chosen per tier. */
export type ComponentTier = 'budget' | 'standard' | 'premium';

/** Customer segments for market research and demand targeting. */
export type CustomerSegment = 'value' | 'early_adopters' | 'luxury_buyers' | 'eco' | 'families';

/** An active quality defect discovered in the field; resolve it with a recall or risk trust. */
export interface ProductDefect {
  name: string;
  severity: number; // 1..3
  year: number;
}

/** A player-engineered component (e.g. the "Bat62" battery): installable in your
 * products in place of a sourcing tier, and sellable on the global component market. */
export interface CustomPart {
  id: string;
  companyId: string; // owning company — engineering costs and sales revenue flow here
  name: string;
  componentId: string; // which component slot type it fits ('battery', 'chip', …)
  version: number; // revision count; revisions raise the grade
  grade: number; // 0..100 engineering grade — drives every stat below
  quality: number; // quality bonus contributed to products using it
  defectMod: number; // defect-rate delta
  costMult: number; // unit-cost multiplier vs a standard sourced part
  luxury: number; // perceived-premium bonus
  forSale: boolean; // listed on the global component market
  unitsSoldTotal: number;
  revenueTotal: number;
  yearDesigned: number;
}

/** Parametric 3D form: drives the procedural product mesh in the Studio viewport. */
export interface ProductForm {
  size: number; // 0.6..1.8 overall scale
  slimness: number; // 0..1 thinner/sleeker
  curvature: number; // 0..1 soft/rounded vs sharp
  accent: number; // 0..1 how prominent accent details are
  bodyColor: string; // hex
  accentColor: string; // hex
  finish: ProductFinish;
  lighting: StudioLighting; // preferred preview lighting preset
}

export interface ProductTestScores {
  appearance: number; innovation: number; comfort: number; reliability: number;
  performance: number; easeOfUse: number; sustainability: number; buildQuality: number; value: number;
}

export interface ProductReview {
  year: number;
  stars: number; // 1..5
  text: string;
}

export interface ProductSalesPoint {
  year: number;
  units: number;
  revenue: number;
  profit: number;
}

export interface Product {
  id: string;
  companyId: string; // owning (player) company; profits flow into it
  name: string;
  tagline: string;
  category: ProductCategory;
  generation: number; // 1..n; upgraded generations supersede their predecessor
  predecessorId: string | null;
  stage: ProductStage;
  publishState: PublishState;
  materials: [ProductMaterialId, ProductMaterialId]; // primary body + accent
  form: ProductForm;
  partOverrides: Record<string, PartOverride>; // per-part color/material/finish, keyed by part id
  components: Record<string, string>; // per slot: a ComponentTier, or a CustomPart id
  targetSegment: CustomerSegment | null; // demand focus after market research
  segmentInsights: Partial<Record<CustomerSegment, number>>; // fit scores revealed by focus groups
  warrantyYears: number; // 0..3 — costs per unit, lifts trust and rating
  trust: number; // 0..100 consumer trust; scales demand
  activeDefect: ProductDefect | null;
  recalls: number;
  features: string[]; // granted by unlocked product tech
  packaging: PackagingStyle;
  manufacturing: ManufacturingStrategy;
  price: number;
  patented: boolean;
  testScores: ProductTestScores | null;
  iterations: number; // refinement passes
  designQuality: number; // 0..100, grows with refinement and R&D
  hype: number; // 0..100 launch buzz, decays yearly
  brandPower: number; // 0..100 product-brand strength
  yearDesigned: number;
  yearLaunched: number | null;
  unitsSoldTotal: number;
  revenueTotal: number;
  profitTotal: number;
  rating: number; // 0..5 running customer rating
  reviews: ProductReview[];
  returnRate: number; // 0..1
  marketingBudget: number; // per-year spend from company cash
  channels: SalesChannel[];
  salesHistory: ProductSalesPoint[];
}

export interface Storefront {
  name: string;
  theme: 'aurora' | 'noir' | 'porcelain' | 'terra';
  featuredProductId: string | null;
}

export type ExecutiveRole = 'cfo' | 'coo' | 'cmo';

export interface Executive {
  role: ExecutiveRole;
  name: string;
  skill: number; // 0..100
  salary: number;
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
  companySharePctDelta?: number; // dilutes/restores the player's stake in the subject company
  loseCompany?: boolean; // subject company is lost entirely (hostile takeover succeeds)
  propertyValuePct?: number; // applied to every owned property's value; insured properties take half the hit if negative
  jobPerformance?: number;
  criminalRecord?: number;
  jailYears?: number;
  loseJob?: boolean;
  campaignMomentum?: number;
  approvalOfGovernment?: number;
  achievement?: string; // unlocks this achievement id if not already held
  socialFollowersPct?: number; // fraction change to social-media follower count
  cancelledYears?: number; // sets/extends a social-media backlash window this many years out
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
  hasSpouse?: boolean;
  hasChildren?: boolean;
  hasProperty?: boolean;
  businessPublic?: boolean; // has an active company that is publicly listed
  duringWorldEvent?: WorldEventType;
  inCrimeFamily?: boolean;
  hasMentor?: boolean;
  hasRival?: boolean;
  minFollowers?: number;
  cancelled?: boolean; // is currently in the middle of a social-media backlash
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

/**
 * Lightweight flavor events for daily/weekly advancement: small guaranteed
 * effects, no player choice, auto-resolved and just logged/toasted so the
 * player can fast-forward days or weeks without a wall of blocking modals.
 * The big choice-driven EventTemplate pool above still fires only once a
 * year, when the calendar rolls over.
 */
export interface DailyEventTemplate {
  id: string;
  weight: number;
  text: string;
  effects: EffectSpec;
  conditions?: Pick<EventConditions, 'minAge' | 'maxAge' | 'minMoney' | 'employed' | 'hasBusiness' | 'hasSpouse' | 'hasChildren' | 'hasStocks'>;
}

// ---------------------------------------------------------------------------
// News & logs
// ---------------------------------------------------------------------------

export interface NewsItem {
  year: number;
  category: 'economy' | 'business' | 'politics' | 'world' | 'markets' | 'society' | 'player';
  subtype?: 'breaking' | 'editorial' | 'investigative' | 'interview' | 'election';
  headline: string;
  outlet: string;
  sentiment: number; // -1..1
}

export interface WorldHistoryEntry {
  year: number;
  text: string;
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
  legacyScore: number; // 0..100, a rough composite of wealth, dynasty, office and achievements
}

export type WorldEventType =
  | 'pandemic' | 'trade_war' | 'tech_boom' | 'oil_crisis' | 'banking_collapse' | 'ai_disruption'
  | 'semiconductor_shortage' | 'food_crisis' | 'shipping_disruption' | 'currency_crash';

export interface WorldEvent {
  type: WorldEventType;
  yearsLeft: number;
  severity: number; // 0..1
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
  worldEvent: WorldEvent | null;
  generation: number; // dynasty counter; increments when an heir inherits and play continues
  calendarDay: number; // 0..364, days elapsed in the current year via daily/weekly advancement
  difficulty: Difficulty;
  alliances: Alliance[];
  yearRecap: YearRecap | null; // transient: set after each advanceYear(), cleared once the UI shows it
  pendingSuccession: SuccessionOffer | null; // transient: set on death when a will/heir continuation is available
  worldHistory: WorldHistoryEntry[]; // sparse chronicle of major world-level milestones, spans generations
  cryptoPrice: number; // the world's single cryptocurrency, priced in the home currency
  cryptoHistory: number[]; // recent yearly closes for charting
  products: Record<string, Product>; // the Studio: player-designed products
  productTech: string[]; // unlocked product R&D node ids
  storefront: Storefront; // the player's customizable product storefront
  componentShortage: { componentId: string; yearsLeft: number } | null; // global supply-chain squeeze
  customParts: Record<string, CustomPart>; // player-engineered components

  // V17: generational world evolution
  culturalProgressivism: number; // 0..100, drifts slowly across decades; nudged by tech/AI-era world events
  shockHistory: Partial<Record<WorldEventType, number>>; // world-event type -> years since it last ended (undefined = never happened)
  industryEraMultiplier: Record<string, number>; // sparse industryId -> growth multiplier from secular rise/decline over decades
}

export interface SuccessionCandidate {
  npcId: string;
  name: string;
  relation: 'Spouse' | 'Child' | 'Grandchild';
  isPrimaryHeir: boolean;
}

export interface SuccessionOffer {
  deceasedName: string;
  candidates: SuccessionCandidate[];
}

export type Difficulty = 'casual' | 'standard' | 'ironman';

export interface Alliance {
  id: string;
  name: string;
  founderCountryId: string;
  memberCountryIds: string[];
}

export interface YearRecap {
  year: number;
  netWorthStart: number;
  netWorthEnd: number;
  headlines: string[];
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
