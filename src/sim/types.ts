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

// V52: a multi-year personal brand deal, paid out the same way as Memoir royalties (see
// tickPersonalFinance) — signed via signSponsorshipDeal() once socialFollowers is high enough.
export interface SponsorshipDeal {
  brand: string;
  yearsLeft: number;
  incomePerYear: number;
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
  yearsServedThisSentence: number; // counts up while jailed, resets to 0 on release; gates parole eligibility

  skills: Record<string, number>; // skillId -> 0..100
  education: EducationRecord[];
  studying: { degree: string; field: string; skillId: string; yearsLeft: number; totalYears: number; costPerYear: number } | null;

  // V19: mental health & investigation heat
  stress: number; // 0..100, general life stress — distinct from PlayerJob.stress, fed by it plus money/relationship/unemployment pressure
  burnoutUntilYear: number | null; // sustained high stress triggers this; dents performance/happiness/skill-gain until it passes
  investigationHeat: number; // 0..100, law-enforcement attention built up by a life of crime; can trigger a real arrest independent of any single action's own risk roll

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
  sponsorshipDeal: SponsorshipDeal | null; // V52: multi-year personal brand deal, paid like memoir royalties
  socialFollowers: number; // social-media audience size
  cancelledUntilYear: number | null; // a viral backlash is actively depressing reputation/popularity until this year
  lastSocialPostYear: number | null; // cooldown so posting can't be spammed for free rolls
  actionCooldowns: Record<string, number>; // arbitrary key -> year last used; guards repeatable actions (lifestyle activities, freelance gigs, networking, campaign actions) against being spammed for free stat/money farming within the same year
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
  casinoTotalWagered: number; // lifetime stake across all casino games, for the Stats screen
  casinoBiggestWin: number; // single largest payout ever collected (any casino game, including a jackpot)
  pets: Pet[]; // adopted companions — they age, bond, and eventually pass on
  lotteryTicketsThisYear: number; // spam guard, resets each year
  scratchCardsThisYear: number; // spam guard, resets each year
  athlete: AthleteCareer | null; // V35: soccer/football/running career, independent of the office job/company paths
  military: MilitaryCareer | null; // V44: enlisted service career, independent of the job/company/athlete paths
  drugOperation: DrugOperation | null; // V47: Drug Empire — independent of crimeFamilyId, though membership boosts it
  entertainmentCareer: EntertainmentCareer | null; // V49: actor/musician fame career
  medicalCareer: MedicalCareer | null; // V49: doctor/surgeon career
  cult: CultMovement | null; // V49: founded religious/spiritual movement
  astronaut: AstronautCareer | null; // V49: space agency career
  prisonLife: PrisonLifeState | null; // V49: cellblock politics while incarcerated, reset on release
}

// ---------------------------------------------------------------------------
// V49: five mega features — Entertainment, Medical, Cult, Space, Prison Life
// ---------------------------------------------------------------------------

export type EntertainmentTrack = 'actor' | 'musician';

export interface EntertainmentProject {
  id: string;
  title: string;
  kind: 'film' | 'album' | 'tour' | 'single' | 'show';
  yearReleased: number;
  budgetOrBudgetTier: number;
  performanceScore: number; // 0..100, box office / chart performance
  awardsWon: string[]; // award ids
}

export interface EntertainmentCareer {
  active: boolean;
  track: EntertainmentTrack;
  fame: number; // 0..100
  talent: number; // 0..100, grows with training/roles
  wealth: number; // lifetime entertainment earnings, informational
  hasAgent: boolean;
  agentCut: number; // 0..1, share of earnings taken
  labelOrStudioId: string | null; // name of the label/studio currently signed to, if any
  projects: EntertainmentProject[];
  scandalsCount: number;
  feudTargetName: string | null;
  retired: boolean;
}

export type MedicalSpecialty = string; // id into data/medical.ts MEDICAL_SPECIALTIES

export interface MedicalCareer {
  active: boolean;
  stage: 'med_school' | 'residency' | 'attending' | 'retired';
  specialtyId: string | null;
  hospitalId: string | null;
  yearsOfService: number;
  skill: number; // 0..100, patient outcomes and promotion odds
  reputation: number; // 0..100, hospital standing
  patientsSaved: number;
  patientsLost: number;
  malpracticeSuits: number;
  publications: number;
  rank: number; // 0 = student/resident, 1..4 = attending -> senior -> chief -> medical director
  licenseRevoked: boolean;
}

export interface CultMovement {
  active: boolean;
  name: string;
  founded: number; // year founded
  followers: number;
  funds: number; // donations collected, separate from player.money until extracted
  charisma: number; // 0..100, drives recruitment and donation size
  suspicion: number; // 0..100, law-enforcement/media attention
  compoundLevel: number; // 0..5
  raidsSurvived: number;
  disbanded: boolean;
  disbandedReason: 'raided' | 'collapsed' | 'voluntary' | null;
}

export interface AstronautCareer {
  active: boolean;
  agencyId: string | null; // national space agency (by countryId) or 'private'
  rank: number; // 0 = candidate, 1..4 = pilot -> commander -> veteran -> chief astronaut
  trainingScore: number; // 0..100
  missionsFlown: number;
  hoursInSpace: number;
  walkedOnMoon: boolean;
  walkedOnMars: boolean;
  fatalityRisk: number; // 0..1, current mission risk, informational
  activeMission: SpaceMission | null;
}

export interface SpaceMission {
  id: string;
  name: string;
  kind: 'orbital' | 'station' | 'moon' | 'mars';
  startYear: number;
  durationYears: number;
  danger: number; // 0..1
}

export interface PrisonLifeState {
  gangId: string | null; // prison gang name, distinct from outside CrimeFamily
  respect: number; // 0..100, standing in the yard
  contraband: number; // units of smuggled goods held
  cellblockHeat: number; // 0..100, guard attention on the player specifically
  timesInSolitary: number;
  riotsParticipated: number;
  snitched: boolean;
}

/**
 * A drug-dealing operation: independent of joining a CrimeFamily (you can run corners solo), but
 * synergizes with it. Three upgrade tracks (storage/grow/lab) are independently levelled 0..5;
 * `heat` is this operation's own law-enforcement attention, separate from (but feeding into)
 * Player.investigationHeat.
 */
export interface DrugOperation {
  active: boolean;
  storageLevel: number; // 0..5 — stash capacity
  growLevel: number; // 0..5 — free weed production per year
  labLevel: number; // 0..5 — free meth production per year; labLevel>=3 unlocks tier-4 sourcing
  stash: Record<string, number>; // drug id -> units held
  reputation: number; // 0..100 — street cred; drives demand, dealer recruitment, and tier gating
  turf: number; // 0..100 — corners controlled, independent of CrimeFamily.turf
  heat: number; // 0..100 — this operation's own law-enforcement attention
  dealersHired: number; // street crew selling passively on the player's behalf
  busts: number; // lifetime raid count
  lifetimeRevenue: number; // for Stats/achievements
  odIncidents: number; // customers who overdosed on the player's product
}

export type PetKind = 'dog' | 'cat' | 'parrot' | 'horse' | 'snake' | 'goldfish';

export interface Pet {
  id: string;
  kind: PetKind;
  name: string;
  ageYears: number;
  health: number; // 0..100, decays late in life and with illness
  bond: number; // 0..100, built by playing; scales the yearly happiness boost and the grief at the end
}

/** One entry on the player's per-life bucket list. `description` is resolved at
 * generation time so saves and the UI never need the definition table. */
export interface BucketGoal {
  defId: string;
  description: string;
  target: number;
  done: boolean;
  rewardMoney: number;
  rewardHappiness: number;
}

// ---------------------------------------------------------------------------
// V35: Athlete career (soccer, football, running)
// ---------------------------------------------------------------------------

export type AthleteSport = 'soccer' | 'football' | 'running';

/** Soccer/football positions and running specializations are all just string ids defined in
 * data/athletics.ts (same "content is data" pattern as skills/industries) — the type layer only
 * needs to know which sport a career belongs to, not enumerate every position by name. */
export type AthleteLevel = 'youth' | 'academy' | 'college' | 'semipro' | 'pro' | 'elite' | 'retired';

export interface AthleteInjury {
  kind: string; // e.g. 'hamstring_strain', 'ACL_tear' — id into data/athletics.ts INJURY_TYPES
  name: string;
  severity: number; // 1..10, higher = worse
  weeksOut: number; // remaining recovery time in-season, decremented on advance
  startYear: number;
  reinjuryRisk: number; // 0..100, elevated for the rest of the season after returning
}

export interface AthleteContract {
  teamId: string | null; // null = free agent / unsigned amateur
  salary: number; // per year
  signingBonus: number;
  yearsLeft: number;
  performanceBonusPerGoalOrWin: number; // small per-goal (soccer) / per-win (football) kicker
}

export interface AthleteEndorsement {
  brand: string;
  annualValue: number;
  yearsLeft: number;
}

export interface AthleteCareerStats {
  seasonsPlayed: number;
  matchesPlayed: number;
  goals: number; // soccer
  assists: number; // soccer
  cleanSheets: number; // soccer goalkeepers
  passingYards: number; // football
  rushingYards: number; // football
  receivingYards: number; // football
  touchdowns: number; // football
  tackles: number; // football
  interceptions: number; // football
  racesRun: number; // running
  racesWon: number; // running
  medalsGold: number;
  medalsSilver: number;
  medalsBronze: number;
  mvpAwards: number;
}

export interface AthleteCareer {
  sport: AthleteSport;
  position: string; // id into data/athletics.ts SOCCER_POSITIONS / FOOTBALL_POSITIONS
  event: string | null; // running only: id into data/athletics.ts RUNNING_EVENTS, e.g. '100m', 'marathon'
  level: AthleteLevel;
  attributes: Record<string, number>; // attribute id -> 0..100, ids from data/athletics.ts per sport
  overallRating: number; // derived 0..100 composite, recomputed after training/aging/injury
  potentialCeiling: number; // 0..100, rolled at career start; overallRating asymptotes toward it
  fitness: number; // 0..100, match-day readiness; drained by playing/training, restored by rest
  form: number; // 0..100, hot/cold streak, drifts toward 50 and nudged by recent results
  morale: number; // 0..100, affects training gains and injury risk
  teamId: string | null; // references a team id in data/athletics.ts (soccer/football only)
  leagueId: string | null;
  contract: AthleteContract | null;
  injuries: AthleteInjury[]; // history
  currentInjury: AthleteInjury | null;
  trainingFocus: string | null; // attribute id being emphasized this year
  seasonStats: AthleteCareerStats;
  careerStats: AthleteCareerStats;
  personalBests: Partial<Record<string, number>>; // running: event id -> seconds (lower is better)
  endorsements: AthleteEndorsement[];
  yearsPro: number;
  retired: boolean;
  hallOfFame: boolean;
  startedYear: number;
  fixtures: AthleteMatchFixture[]; // this season's schedule, soccer/football only
  nextMeetId: string | null; // running only: next meet on the calendar
  seasonYear: number; // the year `fixtures` covers; regenerated when it falls behind state.year
}

/** One scheduled game in a soccer/football season — the player can play it out in the 3D
 * match scene or quick-simulate it; either way it resolves into `resultSummary`. */
export interface AthleteMatchFixture {
  id: string;
  opponentTeamId: string;
  week: number; // 1-based position in the season schedule
  played: boolean;
  resultSummary: string | null; // e.g. "W 3-1" once played
  playerRatingThisMatch: number | null; // 0..10 match rating once played
}

/** Dynamic per-season standing for a team defined statically in data/athletics.ts —
 * mirrors the Industry (static) / Company (dynamic) split used elsewhere. */
export interface AthleteTeamState {
  teamId: string;
  wins: number;
  losses: number;
  draws: number; // soccer only
  points: number; // league table points
  goalsFor: number; // soccer
  goalsAgainst: number; // soccer
  seasonYear: number; // the year this record covers; reset (along with wins/losses/etc above) when it
  // falls behind state.year — prestige and currentLeagueId below intentionally persist across that reset.
  prestige: number; // 0..100, dynamic team strength: seeded from the static catalog, then evolves every
  // year with results (win big, gain prestige) and random transfer-market swings — see tickAthleteWorld.
  currentLeagueId: string; // may differ from the static catalog's leagueId after a promotion/relegation
}

// ---------------------------------------------------------------------------
// V44: Military Service career
// ---------------------------------------------------------------------------

export type MilitaryBranch = 'army' | 'navy' | 'air_force' | 'marines' | 'coast_guard' | 'space_force';

/** null while still serving; set the moment the career ends, one way or another. */
export type MilitaryDischargeType = 'honorable' | 'general' | 'medical' | 'dishonorable' | 'kia' | null;

export interface MilitaryInjury {
  kind: string; // id into data/military.ts MILITARY_INJURY_TYPES
  name: string;
  severity: number; // 1..10
  permanent: boolean; // permanent injuries add to disabilityRating and never fully heal
  yearSustained: number;
}

/** One tour: a posting to a base/theater, optionally against a specific enemy nation if the
 * home country is at war when the tour starts. Ends on rotation home, a wound serious enough to
 * evacuate, or death. */
export interface MilitaryDeployment {
  id: string;
  baseId: string; // id into data/military.ts MILITARY_BASES — the posting/theater
  conflictCountryId: string | null; // the enemy nation this tour was fought against, if any (peacetime postings have none)
  startYear: number;
  endYear: number | null; // null while still deployed
  missionsCompleted: number;
  outcome: 'ongoing' | 'completed' | 'wounded' | 'kia' | 'medically_evacuated';
}

export interface MilitaryMedal {
  id: string; // id into data/military.ts MILITARY_MEDALS
  name: string;
  yearAwarded: number;
  citation: string; // flavor text for why it was awarded
}

export interface MilitaryCareer {
  branch: MilitaryBranch;
  specialtyId: string; // id into data/military.ts MILITARY_SPECIALTIES (MOS/rating), fixed at enlistment
  rankIndex: number; // 0-based index into data/military.ts RANKS_BY_BRANCH[branch]
  yearsOfService: number;
  enlistedYear: number;
  discipline: number; // 0..100 — promotion odds, court-martial risk when it slips low
  combatSkill: number; // 0..100 — mission success/survival odds; grows with deployments and training
  leadership: number; // 0..100 — command-billet eligibility and promotion speed; grows with rank/time
  fitness: number; // 0..100 — drained on deployment, restored by garrison time/training
  disabilityRating: number; // 0..100 cumulative, from permanent injuries — sets VA compensation after discharge
  currentDeployment: MilitaryDeployment | null;
  deployments: MilitaryDeployment[]; // completed tour history
  injuries: MilitaryInjury[];
  medals: MilitaryMedal[];
  warCrimesCommitted: number; // dark-path counter — tanks karma/reputation and raises court-martial risk
  heroicActsCount: number; // light-path counter — feeds medal odds and reputation
  courtMartialed: boolean;
  dischargeType: MilitaryDischargeType;
  dischargeYear: number | null;
  veteranPensionPerYear: number; // set on an honorable/medical/general discharge; paid out yearly like a civilian pension
  reenlistedCount: number; // how many times this life has signed on for another term
  drafted: boolean; // conscripted rather than volunteered — skipped boot camp, sent straight to training
  bootCampPassed: boolean; // volunteers must clear the 3D obstacle course; drafted service members are exempt
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

  // V18: military depth — militaryPower above is a raw/latent capability score; readiness is
  // the trained/supplied/battle-ready sliver of it that actually determines war performance.
  militaryReadiness: number; // 0..100, drifts toward the Defense budget share; decays if under-funded
  warExhaustion: number; // 0..100, builds while at war (faster under an invasion strategy), decays at peace; dampens approval and pushes both sides toward peace
  warCasualtiesTotal: number; // cumulative population lost to war across this playthrough (flavor + real population drag)

  lastNoConfidenceYear: number | null; // gates automatic legislative no-confidence risk to at most one attempt per year
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
  ipoYear: number | null; // year doIPO() ran; building is "under construction" through the following year
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

  // Joint venture: a multi-year capital-pooling deal with a named partner company, distinct from
  // a full merger (tickMergers) — both sides keep independent ownership, gain a modest ongoing
  // synergy boost while it runs, and the investment resolves into a one-time payout (which can be
  // a loss) when the term ends.
  jointVenturePartnerId: string | null;
  jointVentureYearsLeft: number;
  jointVentureInvestment: number;

  // V50: Corporate Empire expansion — physical manufacturing capacity, international
  // subsidiaries, an in-house venture capital arm, and structured advertising campaigns.
  // All additive/orthogonal to the core tickCompany() financial model (see corpExpansion.ts).
  factories: Factory[];
  internationalOffices: ForeignOffice[];
  hasVentureArm: boolean;
  ventureInvestments: VentureInvestment[];
  activeCampaign: AdCampaign | null;
  campaignsRun: number; // lifetime count, informational

  // V51: Dynamic World Engine — an NPC rival's memory of specific player actions against it
  // (failed takeover bids, price wars, patent suits, espionage, shakedowns). Grows targeted, more
  // frequent retaliation via tickCorporateSabotage; decays slowly on its own.
  grudgeAgainstPlayer: number; // 0..100

  // V54: Manufacturing capacity vs. demand — for physical-goods industries (see
  // MANUFACTURING_TAGS in business.ts), this actually gates revenue growth, unlike the V50
  // factories' pure cash dividend. manufacturingCapacity is computed each tick from factories
  // (see corpExpansion.ts) relative to the company's current scale; when demand growth outstrips
  // it, the shortfall is banked as demandBacklog (lost sales the company is failing to fulfill)
  // instead of silently vanishing, and can be recovered once capacity catches up. Non-physical
  // industries (software, finance, services, ...) are never gated by this at all.
  manufacturingCapacity: number; // 0..~200; 100 = comfortably meeting current demand
  demandBacklog: number; // $ of unmet demand carried forward, revenue-equivalent
  stockoutStreak: number; // consecutive years capacity failed to keep up with demand

  status: CompanyStatus;
  history: CompanyHistoryPoint[];
}

export interface Moonshot {
  yearsLeft: number;
  invested: number; // total committed; burned over the project's life
}

// V50: Corporate Empire expansion sub-types (see Company.factories/internationalOffices/
// ventureInvestments/activeCampaign above, and sim/corpExpansion.ts for the behavior).
export interface Factory {
  id: string;
  countryId: string; // domestic (== Company.countryId) or foreign (requires an office there first)
  capacityUnits: number; // production capacity; grants an ongoing output dividend in the tick
  automationLevel: number; // 0..5, raises the dividend and is itself upgradeable
  condition: number; // 0..100, decays slowly and dents the dividend when low
  builtYear: number;
}

export interface ForeignOffice {
  id: string;
  countryId: string;
  openedYear: number;
  strength: number; // 0..100, ramps up over time and scales the international revenue contribution
}

export interface VentureInvestment {
  id: string;
  targetCompanyId: string;
  investedYear: number;
  amountInvested: number;
  equityPct: number; // 0..1 stake in the target, fixed at investment time
}

export type AdChannel = 'tv' | 'social' | 'influencer' | 'billboard' | 'guerrilla';

export interface AdCampaign {
  channel: AdChannel;
  totalBudget: number; // charged upfront from company cash when launched
  totalYears: number;
  yearsLeft: number;
  startYear: number;
}

// ---------------------------------------------------------------------------
// Product Design & Commerce (the Studio)
// ---------------------------------------------------------------------------

export type ProductCategory =
  | 'smartphone' | 'laptop' | 'tablet' | 'wearable' | 'gaming' | 'audio'
  | 'appliance' | 'smart_home' | 'furniture' | 'fashion' | 'shoes' | 'jewelry'
  | 'cosmetics' | 'automotive' | 'food_beverage' | 'medical' | 'industrial'
  | 'toys' | 'sports' | 'luxury'
  | 'drone' | 'camera' | 'tv' | 'bicycle' | 'eyewear' | 'instrument' | 'kitchenware' | 'powertool'
  | 'pet_tech' | 'baby_gear' | 'outdoor_gear' | 'stationery';

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
  companyGrudgeDelta?: number; // V51: adjusts the subject company's grudgeAgainstPlayer
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
  // V51: Dynamic World Engine
  hasGrudgingRival?: boolean; // an active NPC company (any industry, same country) with real grudge built up
  minAchievements?: number;
  momentumState?: 'hot' | 'cold'; // gates on state.worldMomentum crossing a threshold either way
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
  /** Text supports placeholders: {name} {city} {country} {company} {npc} {amount} {industry} {year}
   * {achievementCount} — {company} resolves to the grudging rival when hasGrudgingRival is set. */
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
  category: 'economy' | 'business' | 'politics' | 'world' | 'markets' | 'society' | 'player' | 'sports';
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
  /** Set by any code path that kills the player outside the yearly tick (suicide, KIA in a
   * playable mission) so gameOverCheck can report the real cause instead of guessing from
   * age/health. Cleared once consumed. */
  pendingDeathReason: string | null;
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

  // Crime Syndicate Engine: real, named organized-crime families competing with each other in
  // every country, not just an abstract "rival crew" backdrop to the player's own crimeRank —
  // see sim/crime.ts. The player's own family (if any) is one of these, found by bossId.
  crimeFamilies: CrimeFamily[];

  // Casino: sparse machineId -> current progressive jackpot pool. World-persistent (not reset per
  // player action) so the pot really does grow between spins and pays out big when it finally hits.
  casinoJackpots: Record<string, number>;

  // Bucket list: a handful of personal goals rolled at birth, checked each year, each paying a
  // real reward on completion. Finishing the whole list is its own achievement.
  bucketList: BucketGoal[];

  // V35: Athlete career — dynamic per-season state for every soccer/football team defined
  // statically in data/athletics.ts, keyed by team id. Populated lazily the first time any team
  // is referenced (tryout, standings view, AI-vs-AI season sim) rather than for all teams up front.
  athleteTeams: Record<string, AthleteTeamState>;

  // V51: Dynamic World Engine — self-relative momentum (dynamic difficulty/pacing) and a
  // persistent per-industry record of how much the player's own companies have shaped it, which
  // outlives the player exiting that industry (see business.ts's tickIndustryEra).
  worldMomentum: number; // -100..100, recent net-worth growth vs. the player's own longer-run trend
  industryDisruptionLegacy: Record<string, number>; // sparse industryId -> cumulative player impact, decays slowly
}

export interface CrimeFamily {
  id: string;
  name: string;
  countryId: string;
  bossId: string; // NPC id, role: 'criminal'
  strength: number; // 0..100, combat/economic power — drives turf-war and crackdown outcomes
  turf: number; // 0..100, share of the country's criminal territory this family controls
  heat: number; // 0..100, law-enforcement attention specifically on this family
  alliedWith: string[]; // other CrimeFamily ids, mutual non-aggression + turf-war backup
  atWarWith: string[]; // other CrimeFamily ids, actively fighting for turf
  disbanded: boolean; // true once taken down by a crackdown or wiped out in a war
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
