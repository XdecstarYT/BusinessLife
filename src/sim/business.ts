/**
 * Company simulation. Revenue emerges from industry economics x the macro
 * cycle x company decisions (pricing, marketing, R&D, staffing, automation)
 * x laws in force x competition. Applies to both player-run companies and
 * the hundreds of NPC/public companies that populate the stock market.
 */
import type { ActivistDemand, Company, Country, CreditRating, GameState, Industry, RivalStrategy } from './types';
import { clamp, clamp01, clamp100 } from './types';
import { aggregateLawEffects, lawIndustryModifier } from './economy';
import { INDUSTRY_BY_ID } from '../data/industries';
import { doIPO } from './market';
import type { RNG } from './rng';

let companyCounter = 0;
export function nextCompanyId(state: GameState): string {
  // Derive from existing keys to stay stable across save/load.
  companyCounter = Math.max(companyCounter, Object.keys(state.companies).length);
  return `co_${++companyCounter}_${state.year}`;
}

export interface FoundCompanyOptions {
  name: string;
  industry: Industry;
  countryId: string;
  founderId: string;
  playerOwned: boolean;
  capital: number; // initial funding
  year: number;
  scale?: number; // NPC companies can start at scale (1 = startup)
}

export function createCompany(opts: FoundCompanyOptions, rng: RNG): Company {
  const { industry } = opts;
  const scale = opts.scale ?? 1;
  const baseRevenue = opts.capital * rng.range(0.8, 1.6) * scale;
  const employees = Math.max(1, Math.round((baseRevenue / 90_000) * (0.5 + industry.laborIntensity)));
  return {
    id: '', // assigned by caller via nextCompanyId
    name: opts.name,
    industryId: industry.id,
    countryId: opts.countryId,
    foundedYear: opts.year,
    founderId: opts.founderId,
    playerOwned: opts.playerOwned,
    playerSharePct: opts.playerOwned ? 1 : 0,
    cash: opts.capital * 0.4,
    revenue: baseRevenue,
    expenses: baseRevenue * (1 - industry.baseMargin * rng.range(0.5, 1)),
    profit: 0,
    debt: 0,
    debtRate: 0.06,
    assets: opts.capital * 0.6 * (0.5 + industry.capitalIntensity),
    employees,
    salaryLevel: 1,
    morale: rng.range(55, 75),
    managerQuality: rng.range(35, 65),
    automation: industry.techIntensity * 20,
    unionized: false,
    quality: rng.range(40, 60),
    brand: opts.playerOwned ? rng.range(5, 15) : rng.range(20, 70),
    customerSatisfaction: rng.range(45, 65),
    esg: rng.range(30, 60),
    marketShare: 0.001 * scale,
    priceLevel: 1,
    marketingPct: 0.05,
    rdPct: industry.techIntensity * 0.06,
    isPublic: false,
    ipoYear: null,
    sharesOutstanding: 1_000_000 * Math.max(1, Math.round(scale)),
    sharePrice: 0,
    dividendPayoutPct: 0,
    analystExpectation: 0,
    institutionalOwnPct: 0,
    shortInterest: 0,
    lawsuits: 0,
    insured: false,
    politicalInfluence: 0,
    patents: 0,
    trademarks: 0,
    cyberDefense: rng.range(10, 30),
    supplyChainResilience: rng.range(10, 30),
    hqTier: 0,
    culture: 'flexible',
    successorId: null,
    executives: [],
    bondDebt: 0,
    bondRate: 0,
    bondYearsLeft: 0,
    franchiseCount: 0,
    loyaltyProgram: false,
    securityInvested: false,
    moonshot: null,
    ceoName: null,
    ceoSkill: 0,
    ceoSalary: 0,
    lastGovContractBidYear: null,
    lastGrantYear: null,
    jointVenturePartnerId: null,
    jointVentureYearsLeft: 0,
    jointVentureInvestment: 0,
    factories: [],
    internationalOffices: [],
    hasVentureArm: false,
    ventureInvestments: [],
    activeCampaign: null,
    campaignsRun: 0,
    grudgeAgainstPlayer: 0,
    rivalStrategy: null,
    manufacturingCapacity: 100,
    demandBacklog: 0,
    stockoutStreak: 0,
    creditRating: 'BBB',
    antitrustScrutinyYears: 0,
    antitrustCaseOpen: false,
    activistCampaign: null,
    status: 'active',
    history: [],
  };
}

/** Physical-goods industries whose revenue growth is actually gated by production capacity (see
 * Company.manufacturingCapacity below) — software, finance, media and other non-physical
 * industries are exempt and behave exactly as before this system existed. */
const MANUFACTURING_TAGS = new Set([
  'manufacturing', 'industrial', 'auto', 'consumer', 'retail', 'food', 'agriculture',
  'construction', 'defense', 'luxury', 'mining', 'energy', 'oil', 'gas', 'coal', 'solar',
  'nuclear', 'housing',
]);

export function isManufacturingIndustry(ind: Industry): boolean {
  return ind.tags.some((t) => MANUFACTURING_TAGS.has(t));
}

/** V54: recompute manufacturingCapacity toward its target each tick (smoothed, not snapped, so
 * building/losing a factory shows up as a trend rather than an instant jump). Two sources:
 * a small organic baseline from automation/workforce (artisanal-scale output with no dedicated
 * factories), and the real payoff from V50's factories — normalized against the company's current
 * revenue so bigger companies genuinely need more factories to stay at 100, not just one. */
function tickManufacturingCapacity(c: Company): void {
  const factoryScore = c.factories.reduce(
    (sum, f) => sum + f.capacityUnits * (0.7 + f.automationLevel * 0.15) * (f.condition / 100),
    0,
  );
  const capacityFromFactories = (factoryScore / Math.max(1, c.revenue / 40_000)) * 100;
  const organicCapacity = 55 + Math.min(25, c.automation * 0.25);
  const targetCapacity = clamp(organicCapacity + capacityFromFactories, 10, 220);
  c.manufacturingCapacity += (targetCapacity - c.manufacturingCapacity) * 0.35;
}

/** Fair-value estimate used for sales, acquisitions and IPO pricing. */
export function companyValuation(c: Company): number {
  const profitBase = Math.max(c.profit, c.revenue * 0.05);
  const growthMult = c.history.length >= 2 && c.history[c.history.length - 1].revenue > c.history[c.history.length - 2].revenue * 1.15 ? 1.5 : 1;
  const brandMult = 0.8 + (c.brand / 100) * 0.6;
  const value = profitBase * 12 * growthMult * brandMult + c.assets + c.cash - c.debt - c.bondDebt;
  return Math.max(0, Math.round(value));
}

/** V56: Credit Rating Agency — a pure function of leverage, profitability and cash runway, so it
 * can be recomputed cheaply every tick without any persisted history. Feeds into the interest
 * rate charged on new debt (see debtRate below and issueCorporateBond in actions.ts); it does
 * NOT retroactively reprice debt already on the books. */
const CREDIT_RATING_ORDER: CreditRating[] = ['D', 'CCC', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA'];
export const CREDIT_RATING_SPREAD: Record<CreditRating, number> = {
  AAA: -0.012, AA: -0.006, A: -0.002, BBB: 0.004, BB: 0.014, B: 0.03, CCC: 0.06, D: 0.1,
};

export function computeCreditRating(c: Company): CreditRating {
  const totalDebt = c.debt + c.bondDebt;
  const leverage = totalDebt / Math.max(1, c.assets + c.cash);
  const margin = c.revenue > 0 ? c.profit / c.revenue : -1;
  const cashRunwayMonths = c.expenses > 0 ? c.cash / (c.expenses / 12) : 12;
  let score = 100;
  score -= leverage * 120;
  score -= Math.max(0, -margin) * 200;
  score += clamp(margin, -0.1, 0.2) * 100;
  score -= Math.max(0, 6 - cashRunwayMonths) * 5;
  if (score >= 90) return 'AAA';
  if (score >= 78) return 'AA';
  if (score >= 65) return 'A';
  if (score >= 50) return 'BBB';
  if (score >= 35) return 'BB';
  if (score >= 20) return 'B';
  if (score >= 5) return 'CCC';
  return 'D';
}

/** Secular industry rise/decline across decades: tech-driven, lightly-regulated industries
 * trend up over time; capital-heavy, high-regulation, low-tech ones trend down. Cheap flat
 * pass over the (static) industry catalogue, called once a year from advanceYear. */
export function tickIndustryEra(state: GameState, rng: RNG): void {
  for (const ind of state.industries) {
    const prev = state.industryEraMultiplier[ind.id] ?? 1;
    // V51: a persistent, permanent-outlasting-the-player nudge from how much the player's own
    // companies have historically shaped this industry (see the legacy-accumulation hook in
    // engine.ts's per-company loop) — an industry you dominated keeps trending your way for
    // years after you've moved on, and one you gutted keeps sagging.
    const legacy = state.industryDisruptionLegacy[ind.id] ?? 0;
    const drift = (ind.techIntensity - 0.4) * 0.006 - (ind.regulationSensitivity - 0.5) * 0.002 + legacy * 0.0015 + rng.range(-0.003, 0.003);
    state.industryEraMultiplier[ind.id] = clamp(prev + drift, 0.55, 1.85);
    if (legacy !== 0) state.industryDisruptionLegacy[ind.id] = legacy * 0.985;
  }
}

export interface CompanyTickContext {
  state: GameState;
  country: Country;
  rng: RNG;
}

export interface CompanyTickResult {
  wentBankrupt: boolean;
  headline: string | null;
}

export function tickCompany(c: Company, ctx: CompanyTickContext): CompanyTickResult {
  if (c.status !== 'active') return { wentBankrupt: false, headline: null };
  const { country, rng, state } = ctx;
  const ind = INDUSTRY_BY_ID[c.industryId];
  const e = country.economy;
  const law = aggregateLawEffects(country);
  let headline: string | null = null;
  // Backfill for saves from before V54's manufacturing-capacity system.
  c.manufacturingCapacity ??= 100;
  c.demandBacklog ??= 0;
  c.stockoutStreak ??= 0;

  // --- Demand ------------------------------------------------------------
  const cycle = 1 + e.gdpGrowth * (1 + ind.cyclicality * 3);
  const confidence = 0.9 + (e.consumerConfidence / 100) * 0.2;
  const lawMult = lawIndustryModifier(law, ind.tags);
  // Price elasticity: cheap gains share, premium needs brand+quality. A loyalty/membership
  // program makes customers noticeably less price-sensitive at the premium end.
  const priceFit = c.priceLevel <= 1
    ? 1 + (1 - c.priceLevel) * 0.8
    : 1 - (c.priceLevel - 1) * (1.4 - (c.brand + c.quality) / 250) * (c.loyaltyProgram ? 0.75 : 1);
  // C-suite executives (hired via hireExecutive()) each lift a distinct lever.
  const cfo = c.executives.find((x) => x.role === 'cfo');
  const coo = c.executives.find((x) => x.role === 'coo');
  const cmo = c.executives.find((x) => x.role === 'cmo');
  const marketingPower = 1 + Math.sqrt(clamp01(c.marketingPct)) * 0.55 + (cmo ? cmo.skill / 100 * 0.15 : 0);
  const qualityPull = 0.75 + ((c.quality + c.customerSatisfaction) / 200) * 0.5;
  // HQ tier (0=Basic Office..3=Megacomplex) lifts manager effectiveness and morale
  // ceiling but costs more upkeep. Culture is a set of tradeoffs, not a straight bonus.
  const hqBonus = c.hqTier * 0.025;
  const cultureOverheadMult = c.culture === 'remote' ? 0.82 : c.culture === 'traditional' ? 1.08 : c.culture === 'startup' ? 0.92 : 1;
  const cultureMoraleNoise = c.culture === 'remote' || c.culture === 'startup' ? 5 : 3;
  const cultureRdBoost = c.culture === 'startup' ? 1.15 : 1;
  const cooBonus = coo ? coo.skill / 100 * 0.06 : 0;
  const managerMult = 0.85 + (c.managerQuality / 100) * 0.3 + hqBonus + cooBonus;
  const moraleMult = 0.9 + (c.morale / 100) * 0.2 + hqBonus * 0.6;
  const noise = 1 + rng.normal(0, ind.volatility * 0.5);

  // Commodity exposure: producers ride the price, consumers pay it. A diversified
  // supply chain dampens the cost-side exposure (not the producer's market upside).
  let commodityMult = 1;
  for (const [tag, price] of Object.entries(e.commodities)) {
    const idx = (price - 100) / 100;
    if (ind.tags.includes(`commodity_${tag}`)) commodityMult += idx * 0.5;
    else if (tag === 'oil' && (ind.tags.includes('transport') || ind.tags.includes('airline'))) {
      commodityMult -= idx * 0.25 * (1 - c.supplyChainResilience / 200);
    }
  }

  // Climate change: agriculture bears rising climate risk directly; insurers see more claims
  // but also charge more, netting out to a smaller but real drag.
  let climateMult = 1;
  if (ind.tags.includes('agriculture')) climateMult -= (country.climateRisk / 100) * 0.3;
  else if (ind.tags.includes('insurance')) climateMult -= (country.climateRisk / 100) * 0.08;

  // Global world events (pandemic / trade war / tech boom) hit or help industries by tag.
  let worldEventMult = 1;
  const worldEvent = state.worldEvent;
  if (worldEvent?.type === 'pandemic') {
    if (ind.tags.includes('health')) worldEventMult += worldEvent.severity * 0.4;
    if (ind.tags.includes('tourism') || ind.tags.includes('airline') || ind.tags.includes('entertainment')) {
      worldEventMult -= worldEvent.severity * 0.45;
    }
    if (ind.tags.includes('platform') || ind.tags.includes('software')) worldEventMult += worldEvent.severity * 0.15;
  } else if (worldEvent?.type === 'trade_war') {
    if (ind.tags.includes('export')) worldEventMult -= worldEvent.severity * 0.35;
    if (ind.tags.includes('shipping') || ind.tags.includes('airline')) worldEventMult -= worldEvent.severity * 0.15;
  } else if (worldEvent?.type === 'tech_boom') {
    if (ind.tags.includes('tech') || ind.tags.includes('ai') || ind.tags.includes('software') || ind.tags.includes('platform')) {
      worldEventMult += worldEvent.severity * 0.3;
    }
  } else if (worldEvent?.type === 'oil_crisis') {
    if (ind.tags.includes('oil') || ind.tags.includes('energy')) worldEventMult += worldEvent.severity * 0.35;
    if (ind.tags.includes('airline') || ind.tags.includes('shipping') || ind.tags.includes('logistics')) worldEventMult -= worldEvent.severity * 0.3;
    if (ind.tags.includes('green') || ind.tags.includes('renewable')) worldEventMult += worldEvent.severity * 0.2;
  } else if (worldEvent?.type === 'banking_collapse') {
    if (ind.tags.includes('finance') || ind.tags.includes('banking') || ind.tags.includes('real_estate') || ind.tags.includes('property')) {
      worldEventMult -= worldEvent.severity * 0.35;
    }
  } else if (worldEvent?.type === 'ai_disruption') {
    if (ind.tags.includes('ai') || ind.tags.includes('tech') || ind.tags.includes('software')) worldEventMult += worldEvent.severity * 0.25;
    if (ind.laborIntensity > 0.6) worldEventMult -= worldEvent.severity * 0.2;
  } else if (worldEvent?.type === 'semiconductor_shortage') {
    if (ind.tags.includes('tech') || ind.tags.includes('auto') || ind.tags.includes('industrial')) {
      worldEventMult -= worldEvent.severity * 0.3;
    }
  } else if (worldEvent?.type === 'food_crisis') {
    if (ind.tags.includes('agriculture') || ind.tags.includes('commodity_grain')) worldEventMult += worldEvent.severity * 0.3;
    if (ind.tags.includes('food') && !ind.tags.includes('agriculture')) worldEventMult -= worldEvent.severity * 0.2;
  } else if (worldEvent?.type === 'shipping_disruption') {
    if (ind.tags.includes('shipping') || ind.tags.includes('logistics') || ind.tags.includes('export')) {
      worldEventMult -= worldEvent.severity * 0.35;
    }
  } else if (worldEvent?.type === 'currency_crash') {
    if (ind.tags.includes('export')) worldEventMult += worldEvent.severity * 0.3;
    if (ind.tags.includes('consumer') && !ind.tags.includes('export')) worldEventMult -= worldEvent.severity * 0.15;
  }

  // Market saturation: every industry is finite, so the very largest firms see their upside
  // compression toward flat as they approach and exceed a plausible ceiling for one company.
  // Without this, uncapped per-year growth multipliers compound without bound across very
  // long playthroughs (e.g. multi-generation play via dynasty succession).
  const saturation = clamp(1 - Math.log10(Math.max(1, c.revenue / 5e9)) * 0.35, 0.15, 1);

  // Secular rise/decline: over decades, tech-driven industries trend up and heavily-regulated,
  // low-tech ones trend down (see tickIndustryEra). Defaults to 1 for industries with no history yet.
  const eraMult = state.industryEraMultiplier[ind.id] ?? 1;

  const growthPotential = cycle * confidence * lawMult * priceFit * marketingPower * qualityPull * managerMult * moraleMult * commodityMult * worldEventMult * climateMult * eraMult * noise;
  const cappedGrowth = 1 + (clamp(growthPotential, 0.4, 2.2) - 1) * saturation;
  const desiredRevenue = Math.max(1000, c.revenue * cappedGrowth);

  // --- Manufacturing capacity vs. demand (V54) ----------------------------
  // Physical-goods companies can't just will their revenue up to what the formula above wants —
  // they need real production capacity (factories) to fulfill it. Service/software/finance
  // industries are untouched: desiredRevenue applies exactly as before this system existed.
  if (isManufacturingIndustry(ind)) {
    tickManufacturingCapacity(c);
    const capacityRatio = clamp(c.manufacturingCapacity / 100, 0.15, 2.5);
    const desiredGrowth = desiredRevenue - c.revenue;
    const prevStockoutStreak = c.stockoutStreak;
    if (desiredGrowth > 0) {
      const fulfillableGrowth = desiredGrowth * Math.min(1, capacityRatio);
      const unmet = desiredGrowth - fulfillableGrowth;
      c.revenue += fulfillableGrowth;
      // Backlog accumulates unmet demand but also bleeds away (customers who can't wait buy
      // from a competitor instead), and spare capacity beyond this year's growth chips into
      // any existing backlog — a factory investment finally showing results.
      c.demandBacklog = Math.max(0, c.demandBacklog * 0.6 + unmet);
      if (capacityRatio > 1 && c.demandBacklog > 0) {
        const spare = c.revenue * (capacityRatio - 1) * 0.2;
        const recovered = Math.min(c.demandBacklog, spare);
        c.revenue += recovered;
        c.demandBacklog -= recovered;
      }
      c.stockoutStreak = unmet > desiredGrowth * 0.1 ? c.stockoutStreak + 1 : Math.max(0, c.stockoutStreak - 1);
    } else {
      c.revenue = desiredRevenue;
      c.demandBacklog *= 0.7;
      c.stockoutStreak = Math.max(0, c.stockoutStreak - 1);
    }
    // Sustained stockouts finally cost real customers, not just this year's growth.
    if (c.stockoutStreak >= 3) {
      c.revenue *= 0.97;
      c.customerSatisfaction = clamp100(c.customerSatisfaction - 2);
    }
    if (c.playerOwned && c.stockoutStreak === 2) {
      headline = headline ?? `${c.name} can't keep up with demand — customers are waiting on backorders`;
    }
    if (c.playerOwned) {
      if (capacityRatio >= 1.5 && c.stockoutStreak === 0 && !state.achievements.includes('supply_chain_master')) {
        state.achievements.push('supply_chain_master');
      }
      if (prevStockoutStreak >= 3 && c.stockoutStreak === 0 && !state.achievements.includes('back_on_track')) {
        state.achievements.push('back_on_track');
      }
    }
  } else {
    c.revenue = desiredRevenue;
  }

  // Retail theft & security: unprotected retail-tagged businesses lose a slice of revenue to
  // shrinkage, scaled by the country's average crime rate; security investment eliminates it
  // at an ongoing overhead cost (see overheads below).
  if (ind.tags.includes('retail') && !c.securityInvested) {
    const avgCrime = country.cities.length ? country.cities.reduce((s, ct) => s + ct.crime, 0) / country.cities.length : 40;
    c.revenue = Math.max(1000, c.revenue * (1 - (avgCrime / 100) * 0.06));
  }

  // --- Costs ----------------------------------------------------------------
  // A tight labor market bids up wages and slows hiring (everyone's competing for the same talent).
  const tightnessWageMult = 1 + Math.max(0, country.laborMarketTightness - 50) * 0.004;
  const avgWage = Math.max(e.minimumWage, 42_000 * (e.gdp / (country.population / 1e6) / 40_000)) * c.salaryLevel * tightnessWageMult;
  const targetEmployees = Math.max(1, Math.round((c.revenue / 95_000) * (0.4 + ind.laborIntensity) * (1 - c.automation / 100 * 0.6)));
  // Hiring/firing friction; tighter labor markets slow how fast headcount can catch up.
  const hiringSpeed = clamp(0.5 - Math.max(0, country.laborMarketTightness - 50) * 0.004, 0.2, 0.5);
  c.employees = Math.round(c.employees + (targetEmployees - c.employees) * hiringSpeed);
  const laborCost = c.employees * avgWage;
  const inputCost = c.revenue * (1 - ind.baseMargin) * 0.55 * commodityMult;
  const marketingCost = c.revenue * c.marketingPct;
  const rdCost = c.revenue * c.rdPct;
  const cfoDebtDiscount = cfo ? cfo.skill / 100 * 0.015 : 0;
  const interest = c.debt * Math.max(0.01, c.debtRate - cfoDebtDiscount);
  const bondInterest = c.bondDebt * c.bondRate;
  const execSalaries = c.executives.reduce((s, x) => s + x.salary, 0);
  const hqOverhead = c.hqTier * c.assets * 0.006;
  const overheads = c.assets * 0.04 * cultureOverheadMult + hqOverhead + execSalaries + (c.insured ? c.revenue * 0.01 : 0) + (c.securityInvested ? c.revenue * 0.015 : 0);
  c.expenses = laborCost + inputCost + marketingCost + rdCost + interest + bondInterest + overheads;

  // Corporate bond amortization: fixed-term principal repayment alongside the interest above.
  if (c.bondYearsLeft > 0) {
    const amort = c.bondDebt / c.bondYearsLeft;
    c.cash -= amort;
    c.bondDebt = Math.max(0, c.bondDebt - amort);
    c.bondYearsLeft--;
  }

  // Rivals occasionally poach an executive, more likely when morale is weak.
  if (c.executives.length && rng.chance(0.04 + Math.max(0, (45 - c.morale) * 0.003))) {
    const poached = rng.pick(c.executives);
    c.executives = c.executives.filter((x) => x !== poached);
    headline = headline ?? `${poached.name} departs ${c.name} for a rival offer`;
  }

  const pretax = c.revenue - c.expenses;
  const tax = pretax > 0 ? pretax * e.taxRates.corporate : 0;
  c.profit = pretax - tax;
  c.cash += c.profit;

  // --- Soft stats -------------------------------------------------------------
  // National research level (built via fundUniversityResearch()) amplifies R&D for tech-heavy firms.
  const researchBoost = 1 + (country.researchLevel / 100) * ind.techIntensity * 0.4;
  const rdPower = c.rdPct * (1 + ind.techIntensity) * cultureRdBoost * researchBoost;
  c.quality = clamp100(c.quality + rdPower * 90 - 2 + rng.range(-2, 2));
  c.brand = clamp100(c.brand + c.marketingPct * 40 - 1.5 + (c.customerSatisfaction - 50) * 0.05 + c.hqTier * 0.4 + c.trademarks * 0.3 + rng.range(-1.5, 1.5));
  c.customerSatisfaction = clamp100(
    c.customerSatisfaction * 0.6 + (c.quality * 0.5 + (1.1 - c.priceLevel) * 40 + 30) * 0.4 + rng.range(-4, 4),
  );
  const salaryHappiness = (c.salaryLevel - 1) * 30;
  c.morale = clamp100(c.morale * 0.7 + (50 + salaryHappiness + (c.managerQuality - 50) * 0.3 - (c.automation > 60 ? 8 : 0) + c.hqTier * 2) * 0.3 + rng.range(-cultureMoraleNoise, cultureMoraleNoise));
  c.managerQuality = clamp100(c.managerQuality + rng.range(-2, c.culture === 'traditional' ? 5 : 3));
  c.esg = clamp100(c.esg + rng.range(-2, 2));

  // Unionization pressure when morale is low in labor-heavy industries; a tight labor
  // market emboldens workers to organize (they have leverage — jobs are plentiful).
  const tightnessStrikeBonus = Math.max(0, country.laborMarketTightness - 50) * 0.002;
  if (!c.unionized && ind.laborIntensity > 0.5 && c.morale < 40 && rng.chance(0.2 + tightnessStrikeBonus)) {
    c.unionized = true;
    headline = `Workers at ${c.name} vote to unionize after morale slump`;
  }
  if (c.unionized) c.salaryLevel = Math.max(c.salaryLevel, 1.05);

  // Patents: heavy, sustained R&D occasionally lands a patent. Each pays a
  // small ongoing royalty and dings a same-industry rival's brand a touch.
  const patentChance = c.rdPct > 0.08 ? c.rdPct * ind.techIntensity * 0.15 : 0;
  if (rng.chance(patentChance)) {
    c.patents++;
    headline = headline ?? `${c.name} is granted a new patent`;
    const rivals = Object.values(state.companies).filter(
      (r) => r.status === 'active' && r.industryId === c.industryId && r.id !== c.id,
    );
    if (rivals.length) rng.pick(rivals).brand = clamp100(rng.pick(rivals).brand - rng.range(1, 4));
  }
  if (c.patents > 0) c.cash += c.patents * c.revenue * 0.004;
  // Franchised locations pay a small ongoing royalty back to the parent brand.
  if (c.franchiseCount > 0) c.cash += c.franchiseCount * c.revenue * 0.006;
  if (c.loyaltyProgram) c.customerSatisfaction = clamp100(c.customerSatisfaction + 3);

  // Joint venture: a modest ongoing synergy boost while it runs (shared marketing/R&D with the
  // partner), then a one-time payout when the term ends — weighted by both companies' real
  // strength, so a strong partner is a genuinely better bet, not just flavor text. If the partner
  // collapses mid-term, the deal quietly dissolves and the investment is forfeited.
  if (c.jointVenturePartnerId) {
    const partner = state.companies[c.jointVenturePartnerId];
    if (!partner || partner.status !== 'active') {
      c.jointVenturePartnerId = null;
      c.jointVentureYearsLeft = 0;
      c.jointVentureInvestment = 0;
    } else {
      c.brand = clamp100(c.brand + 0.5);
      c.quality = clamp100(c.quality + 0.3);
      c.jointVentureYearsLeft--;
      if (c.jointVentureYearsLeft <= 0) {
        const combinedStrength = (c.managerQuality + c.brand + c.quality + partner.managerQuality + partner.brand + partner.quality) / 600;
        const payoutMult = clamp(0.4 + (combinedStrength + rng.range(-0.3, 0.3)) * 2.6, 0.2, 3.5);
        const payout = c.jointVentureInvestment * payoutMult;
        c.cash += payout;
        headline = headline ?? (
          payoutMult >= 1.5 ? `${c.name}'s joint venture with ${partner.name} pays off big`
          : payoutMult >= 0.9 ? `${c.name}'s joint venture with ${partner.name} wraps up`
          : `${c.name}'s joint venture with ${partner.name} falls short of expectations`
        );
        c.jointVenturePartnerId = null;
        c.jointVentureYearsLeft = 0;
        c.jointVentureInvestment = 0;
      }
    }
  }

  // Media & influence companies slowly build political/cultural sway with reach and reputation.
  if (ind.tags.includes('media')) {
    const growth = (ind.tags.includes('influence') ? 1.5 : 0.5) * (c.brand / 100);
    c.politicalInfluence = clamp100(c.politicalInfluence + growth + rng.range(-1, 1));
  } else if (c.politicalInfluence > 0) {
    c.politicalInfluence = clamp100(c.politicalInfluence - 1);
  }

  // Random lawsuits and breaches in regulated/risky industries; cyber defense mitigates both.
  const riskShield = 1 - (c.cyberDefense / 100) * 0.6;
  if (rng.chance(ind.regulationSensitivity * 0.06 * riskShield)) {
    c.lawsuits++;
    const damages = c.revenue * rng.range(0.01, 0.08);
    c.cash -= c.insured ? damages * 0.3 : damages;
  }
  if (ind.techIntensity > 0.5 && rng.chance(0.025 * riskShield)) {
    const damages = c.revenue * rng.range(0.02, 0.1);
    c.cash -= damages;
    c.brand = clamp100(c.brand - rng.range(2, 8));
    headline = headline ?? `${c.name} discloses a data breach`;
  }

  // --- Credit rating (V56) -------------------------------------------------------
  c.creditRating ??= 'BBB';
  const newRating = computeCreditRating(c);
  if (newRating !== c.creditRating) {
    const upgraded = CREDIT_RATING_ORDER.indexOf(newRating) > CREDIT_RATING_ORDER.indexOf(c.creditRating);
    if (c.playerOwned) {
      headline = headline ?? `${c.name}'s credit rating was ${upgraded ? 'upgraded' : 'downgraded'} to ${newRating}`;
      if (newRating === 'AAA' && !state.achievements.includes('aaa_rated')) state.achievements.push('aaa_rated');
    }
    c.creditRating = newRating;
  }

  // --- Antitrust regulation (V56) -------------------------------------------------
  // Sustained market dominance draws real regulatory scrutiny — ignoring it too long forces an
  // automatic settlement; the player can instead proactively settleAntitrustCase or gamble on
  // fightAntitrustCase (see actions.ts) once a case is open.
  if (c.playerOwned) {
    c.antitrustScrutinyYears ??= 0;
    c.antitrustCaseOpen ??= false;
    if (c.marketShare > 0.35) c.antitrustScrutinyYears++;
    else c.antitrustScrutinyYears = Math.max(0, c.antitrustScrutinyYears - 1);
    if (!c.antitrustCaseOpen && c.antitrustScrutinyYears >= 3) {
      c.antitrustCaseOpen = true;
      headline = headline ?? `Regulators open an antitrust investigation into ${c.name}'s dominant market position`;
    } else if (c.antitrustCaseOpen && c.antitrustScrutinyYears >= 6) {
      c.marketShare *= 0.6;
      c.revenue *= 0.9;
      c.cash = Math.max(0, c.cash - Math.max(20_000, c.revenue * 0.02));
      c.antitrustCaseOpen = false;
      c.antitrustScrutinyYears = 0;
      headline = `Regulators forced a breakup of ${c.name} after its antitrust case went unresolved too long`;
    }
  }

  // --- Shareholder activism (V56) -------------------------------------------------
  c.activistCampaign ??= null;
  if (c.playerOwned && c.isPublic && !c.activistCampaign) {
    const margin = c.revenue > 0 ? c.profit / c.revenue : 0;
    const underperforming = margin < 0.03 || c.brand < 35;
    const triggerChance = underperforming ? 0.05 + c.institutionalOwnPct * 0.001 : 0.005;
    if (rng.chance(triggerChance)) {
      const demandPool: ActivistDemand[] = c.revenue > 5_000_000
        ? ['dividend', 'buyback', 'ceo_change', 'spinoff']
        : ['dividend', 'buyback', 'ceo_change'];
      const demand = rng.pick(demandPool);
      const investorName = `${rng.pick(['Ironclad', 'Vanguard Point', 'Blackridge', 'Harbor Peak', 'Meridian', 'Northbridge'])} Capital`;
      c.activistCampaign = {
        investorName,
        demand,
        strength: clamp(40 + c.institutionalOwnPct * 0.4 + rng.range(-10, 15), 20, 95),
        yearsActive: 0,
      };
      headline = headline ?? `${investorName} builds a stake in ${c.name} and demands changes`;
    }
  } else if (c.activistCampaign) {
    c.activistCampaign.yearsActive++;
  }

  // --- Debt & bankruptcy ---------------------------------------------------------
  c.debtRate = Math.max(0.01, e.interestRate + 0.03 + (c.debt > c.assets ? 0.04 : 0) + (CREDIT_RATING_SPREAD[c.creditRating] ?? 0));
  if (c.cash < 0) {
    // Auto-borrow to cover shortfalls while creditworthy.
    const need = -c.cash;
    if (c.debt + need < c.assets * 1.5 + c.revenue * 0.5) {
      c.debt += need;
      c.cash = 0;
    } else {
      c.status = 'bankrupt';
      return { wentBankrupt: true, headline: `${c.name} files for bankruptcy` };
    }
  }
  // Pay down debt from surplus cash.
  if (c.debt > 0 && c.cash > c.revenue * 0.3) {
    const pay = Math.min(c.debt, c.cash - c.revenue * 0.25);
    c.debt -= pay;
    c.cash -= pay;
  }

  // Reinvest: assets grow with capex out of cash.
  const capex = Math.max(0, c.cash * 0.1 * ind.capitalIntensity);
  c.cash -= capex;
  c.assets = c.assets * 0.96 + capex;

  c.history.push({ year: state.year, revenue: c.revenue, profit: c.profit, employees: c.employees, sharePrice: c.isPublic ? c.sharePrice : null });
  if (c.history.length > 100) c.history.shift();

  return { wentBankrupt: false, headline };
}

/** NPC-owned companies adjust their own strategy each year. */
export function npcManageCompany(c: Company, rng: RNG): void {
  // Player-owned companies are hands-on by default, but a hired CEO (chairman mode)
  // takes over day-to-day lever tuning just like an NPC founder would.
  if (c.playerOwned && !c.ceoName) return;
  // Drift toward sensible settings with idiosyncratic style.
  if (c.profit < 0) {
    c.marketingPct = clamp(c.marketingPct - 0.01, 0.01, 0.2);
    c.salaryLevel = clamp(c.salaryLevel - 0.02, 0.85, 1.4);
  } else {
    if (rng.chance(0.4)) c.marketingPct = clamp(c.marketingPct + rng.range(-0.01, 0.015), 0.01, 0.2);
    if (rng.chance(0.3)) c.rdPct = clamp(c.rdPct + rng.range(-0.01, 0.015), 0, 0.25);
  }
  if (c.morale < 45 && rng.chance(0.5)) c.salaryLevel = clamp(c.salaryLevel + 0.05, 0.85, 1.4);
  if (rng.chance(0.2)) c.priceLevel = clamp(c.priceLevel + rng.range(-0.05, 0.05), 0.75, 1.45);
}

/** Competitor AI depth: NPC-owned companies occasionally consolidate within an
 * industry/country, with the stronger firm absorbing a smaller rival. Player
 * companies are never a merger party here (see attemptHostileTakeover for that). */
export function tickMergers(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const groups = new Map<string, Company[]>();
  for (const c of Object.values(state.companies)) {
    if (c.status !== 'active' || c.playerOwned) continue;
    const key = `${c.countryId}|${c.industryId}`;
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }
  for (const list of groups.values()) {
    if (list.length < 2 || !rng.chance(0.05)) continue;
    const sorted = [...list].sort((a, b) => b.revenue - a.revenue);
    const acquirer = sorted[0];
    const target = rng.pick(sorted.slice(1));
    if (!target || target.status !== 'active') continue;
    acquirer.revenue += target.revenue * 0.55;
    acquirer.employees += Math.round(target.employees * 0.7);
    acquirer.assets += target.assets * 0.6;
    acquirer.marketShare = Math.min(1, acquirer.marketShare + target.marketShare);
    acquirer.brand = clamp100(acquirer.brand + 3);
    target.status = 'acquired';
    headlines.push(`${acquirer.name} acquires rival ${target.name} in a market consolidation.`);
  }
  return headlines;
}

/** Strong private NPC companies occasionally go public on their own, keeping the stock market —
 * and the city skyline (see CityHubScene's IPO construction lifecycle) — growing over time even
 * when the player never triggers an IPO themselves. */
export function tickNpcIPOs(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  for (const c of Object.values(state.companies)) {
    if (c.status !== 'active' || c.playerOwned || c.isPublic) continue;
    if (c.revenue < 8_000_000 || c.profit <= 0) continue;
    if (!rng.chance(0.04)) continue;
    const raised = doIPO(c, rng, state.year);
    headlines.push(`${c.name} goes public, raising $${Math.round(raised).toLocaleString()} on the exchange.`);
  }
  return headlines;
}

/** V55: Rival Empires — the strategy a rival settles into the first time it actually attacks the
 * player, derived from its own real stats rather than assigned randomly, so a rival plays true to
 * character (an R&D-heavy firm keeps fighting with patents, not price cuts) for the rest of the
 * game. Assigned once and never reassigned — see Company.rivalStrategy. */
export function assignRivalStrategy(c: Company, rng: RNG): RivalStrategy {
  const scores: Record<RivalStrategy, number> = {
    aggressive_expander: c.marketShare * 100 + rng.range(0, 8),
    price_warrior: (1.15 - c.priceLevel) * 40 + rng.range(0, 8),
    tech_innovator: c.rdPct * 200 + rng.range(0, 8),
    brand_builder: c.brand * 0.5 + c.marketingPct * 100 + rng.range(0, 8),
    talent_raider: c.salaryLevel * 30 + c.morale * 0.3 + rng.range(0, 8),
  };
  return (Object.entries(scores) as [RivalStrategy, number][]).reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

/** UI-facing label/icon/blurb per strategy — shared so the Business screen's rival cards read
 * the same character the tick logic actually plays out (see STRATEGY_ATTACK_WEIGHTS below). */
export const RIVAL_STRATEGY_INFO: Record<RivalStrategy, { label: string; icon: string; blurb: string }> = {
  aggressive_expander: { label: 'Aggressive Expander', icon: '📈', blurb: 'Chasing market share fast, often at your expense.' },
  price_warrior: { label: 'Price Warrior', icon: '🏷️', blurb: 'Wins on price, and isn\'t shy about starting a war over it.' },
  tech_innovator: { label: 'Tech Innovator', icon: '🔬', blurb: 'Leans on R&D and patents to fight, not price cuts.' },
  brand_builder: { label: 'Brand Builder', icon: '📣', blurb: 'Fights with marketing and reputation, not the courtroom.' },
  talent_raider: { label: 'Talent Raider', icon: '🎯', blurb: 'Comes after your people before your product.' },
};

/** How strongly each strategy leans toward each attack kind — a weight of 1 is baseline (no
 * lean); the pick below is still randomized, just skewed toward the rival's character. */
const STRATEGY_ATTACK_WEIGHTS: Record<RivalStrategy, Record<'misinformation' | 'poaching' | 'undercutting' | 'legal_action', number>> = {
  aggressive_expander: { misinformation: 1, poaching: 1, undercutting: 2.2, legal_action: 0.6 },
  price_warrior: { misinformation: 0.6, poaching: 0.6, undercutting: 3, legal_action: 0.5 },
  tech_innovator: { misinformation: 0.6, poaching: 0.8, undercutting: 0.6, legal_action: 2.8 },
  brand_builder: { misinformation: 2.6, poaching: 0.6, undercutting: 0.7, legal_action: 0.8 },
  talent_raider: { misinformation: 0.6, poaching: 2.8, undercutting: 0.6, legal_action: 0.7 },
};

/** NPC rivals occasionally take a shot at a player-owned company: smear campaigns, poaching,
 * price undercutting, or aggressive legal action. Purely emergent — the player doesn't trigger
 * this directly, but V51's grudge system (bumped by attemptHostileTakeover/startPriceWar/
 * filePatentLawsuit/spyOnCompany/protectionRacket in actions.ts) makes it targeted: a rival who
 * remembers being wronged is both more likely to strike and more likely to be the one who does.
 * V55 layers a settled RivalStrategy on top so which kind of attack a given rival favors is a
 * consistent character trait, not a fresh coin flip every time. */
export function tickCorporateSabotage(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  // Grudge decays on its own every year regardless of whether it boils over this time.
  for (const co of Object.values(state.companies)) {
    if (co.status !== 'active') continue;
    co.grudgeAgainstPlayer ??= 0;
    co.rivalStrategy ??= null;
    if (co.grudgeAgainstPlayer >= 90 && !state.achievements.includes('arch_nemesis')) state.achievements.push('arch_nemesis');
    if (co.grudgeAgainstPlayer > 0) co.grudgeAgainstPlayer = Math.max(0, co.grudgeAgainstPlayer - 3);
  }
  for (const c of Object.values(state.companies)) {
    if (c.status !== 'active' || !c.playerOwned) continue;
    const rivals = Object.values(state.companies).filter(
      (r) => r.status === 'active' && !r.playerOwned && r.industryId === c.industryId && r.countryId === c.countryId && r.revenue > c.revenue * 0.3,
    );
    if (!rivals.length) continue;
    const maxGrudge = Math.max(0, ...rivals.map((r) => r.grudgeAgainstPlayer));
    if (!rng.chance(0.06 + maxGrudge * 0.0035)) continue;
    const rival = rng.weighted(rivals, (r) => 1 + r.grudgeAgainstPlayer * 0.2);
    if (!rival.rivalStrategy) rival.rivalStrategy = assignRivalStrategy(rival, rng);
    const grudging = rival.grudgeAgainstPlayer > 40;
    const weights = STRATEGY_ATTACK_WEIGHTS[rival.rivalStrategy];
    const kind = rng.weighted(
      ['misinformation', 'poaching', 'undercutting', 'legal_action'] as const,
      (k) => weights[k],
    );
    const grudgeSuffix = grudging ? ` — still settling the score over your past dealings` : '';
    if (kind === 'misinformation') {
      c.brand = clamp100(c.brand - rng.range(4, 10) * (grudging ? 1.4 : 1));
      headlines.push(`${rival.name} is spreading misinformation about ${c.name} online${grudgeSuffix}.`);
    } else if (kind === 'poaching') {
      c.managerQuality = clamp100(c.managerQuality - rng.range(3, 8));
      c.morale = clamp100(c.morale - rng.range(2, 6));
      headlines.push(`${rival.name} poached several key staff from ${c.name}${grudgeSuffix}.`);
    } else if (kind === 'undercutting') {
      c.revenue = Math.max(1000, c.revenue * (1 - rng.range(0.03, 0.08) * (grudging ? 1.3 : 1)));
      headlines.push(`${rival.name} is aggressively undercutting ${c.name} on price${grudgeSuffix}.`);
    } else {
      const legalCost = Math.min(c.cash, Math.max(5_000, c.revenue * 0.02));
      c.cash -= legalCost;
      c.brand = clamp100(c.brand - rng.range(1, 4));
      headlines.push(`${c.name} is fighting off a nuisance lawsuit filed by ${rival.name}${grudgeSuffix}.`);
    }
    // Acting on the grudge is cathartic — it doesn't erase the history, but it takes the edge off.
    rival.grudgeAgainstPlayer = clamp(rival.grudgeAgainstPlayer * 0.5, 0, 100);
  }
  return headlines;
}
