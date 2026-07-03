/**
 * Company simulation. Revenue emerges from industry economics x the macro
 * cycle x company decisions (pricing, marketing, R&D, staffing, automation)
 * x laws in force x competition. Applies to both player-run companies and
 * the hundreds of NPC/public companies that populate the stock market.
 */
import type { Company, Country, GameState, Industry } from './types';
import { clamp, clamp01, clamp100 } from './types';
import { aggregateLawEffects, lawIndustryModifier } from './economy';
import { INDUSTRY_BY_ID } from '../data/industries';
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
    cyberDefense: rng.range(10, 30),
    successorId: null,
    status: 'active',
    history: [],
  };
}

/** Fair-value estimate used for sales, acquisitions and IPO pricing. */
export function companyValuation(c: Company): number {
  const profitBase = Math.max(c.profit, c.revenue * 0.05);
  const growthMult = c.history.length >= 2 && c.history[c.history.length - 1].revenue > c.history[c.history.length - 2].revenue * 1.15 ? 1.5 : 1;
  const brandMult = 0.8 + (c.brand / 100) * 0.6;
  const value = profitBase * 12 * growthMult * brandMult + c.assets + c.cash - c.debt;
  return Math.max(0, Math.round(value));
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

  // --- Demand ------------------------------------------------------------
  const cycle = 1 + e.gdpGrowth * (1 + ind.cyclicality * 3);
  const confidence = 0.9 + (e.consumerConfidence / 100) * 0.2;
  const lawMult = lawIndustryModifier(law, ind.tags);
  // Price elasticity: cheap gains share, premium needs brand+quality.
  const priceFit = c.priceLevel <= 1
    ? 1 + (1 - c.priceLevel) * 0.8
    : 1 - (c.priceLevel - 1) * (1.4 - (c.brand + c.quality) / 250);
  const marketingPower = 1 + Math.sqrt(clamp01(c.marketingPct)) * 0.55;
  const qualityPull = 0.75 + ((c.quality + c.customerSatisfaction) / 200) * 0.5;
  const managerMult = 0.85 + (c.managerQuality / 100) * 0.3;
  const moraleMult = 0.9 + (c.morale / 100) * 0.2;
  const noise = 1 + rng.normal(0, ind.volatility * 0.5);

  // Commodity exposure: producers ride the price, consumers pay it.
  let commodityMult = 1;
  for (const [tag, price] of Object.entries(e.commodities)) {
    const idx = (price - 100) / 100;
    if (ind.tags.includes(`commodity_${tag}`)) commodityMult += idx * 0.5;
    else if (tag === 'oil' && (ind.tags.includes('transport') || ind.tags.includes('airline'))) commodityMult -= idx * 0.25;
  }

  // Global world events (e.g. a pandemic) hit or help industries by tag.
  let worldEventMult = 1;
  const worldEvent = state.worldEvent;
  if (worldEvent?.type === 'pandemic') {
    if (ind.tags.includes('health')) worldEventMult += worldEvent.severity * 0.4;
    if (ind.tags.includes('tourism') || ind.tags.includes('airline') || ind.tags.includes('entertainment')) {
      worldEventMult -= worldEvent.severity * 0.45;
    }
    if (ind.tags.includes('platform') || ind.tags.includes('software')) worldEventMult += worldEvent.severity * 0.15;
  }

  const growthPotential = cycle * confidence * lawMult * priceFit * marketingPower * qualityPull * managerMult * moraleMult * commodityMult * worldEventMult * noise;
  c.revenue = Math.max(1000, c.revenue * clamp(growthPotential, 0.4, 2.2));

  // --- Costs ----------------------------------------------------------------
  const avgWage = Math.max(e.minimumWage, 42_000 * (e.gdp / (country.population / 1e6) / 40_000)) * c.salaryLevel;
  const targetEmployees = Math.max(1, Math.round((c.revenue / 95_000) * (0.4 + ind.laborIntensity) * (1 - c.automation / 100 * 0.6)));
  // Hiring/firing friction
  c.employees = Math.round(c.employees + (targetEmployees - c.employees) * 0.5);
  const laborCost = c.employees * avgWage;
  const inputCost = c.revenue * (1 - ind.baseMargin) * 0.55 * commodityMult;
  const marketingCost = c.revenue * c.marketingPct;
  const rdCost = c.revenue * c.rdPct;
  const interest = c.debt * c.debtRate;
  const overheads = c.assets * 0.04 + (c.insured ? c.revenue * 0.01 : 0);
  c.expenses = laborCost + inputCost + marketingCost + rdCost + interest + overheads;

  const pretax = c.revenue - c.expenses;
  const tax = pretax > 0 ? pretax * e.taxRates.corporate : 0;
  c.profit = pretax - tax;
  c.cash += c.profit;

  // --- Soft stats -------------------------------------------------------------
  const rdPower = c.rdPct * (1 + ind.techIntensity);
  c.quality = clamp100(c.quality + rdPower * 90 - 2 + rng.range(-2, 2));
  c.brand = clamp100(c.brand + c.marketingPct * 40 - 1.5 + (c.customerSatisfaction - 50) * 0.05 + rng.range(-1.5, 1.5));
  c.customerSatisfaction = clamp100(
    c.customerSatisfaction * 0.6 + (c.quality * 0.5 + (1.1 - c.priceLevel) * 40 + 30) * 0.4 + rng.range(-4, 4),
  );
  const salaryHappiness = (c.salaryLevel - 1) * 30;
  c.morale = clamp100(c.morale * 0.7 + (50 + salaryHappiness + (c.managerQuality - 50) * 0.3 - (c.automation > 60 ? 8 : 0)) * 0.3 + rng.range(-3, 3));
  c.managerQuality = clamp100(c.managerQuality + rng.range(-2, 3));
  c.esg = clamp100(c.esg + rng.range(-2, 2));

  // Unionization pressure when morale is low in labor-heavy industries.
  if (!c.unionized && ind.laborIntensity > 0.5 && c.morale < 40 && rng.chance(0.2)) {
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

  // --- Debt & bankruptcy ---------------------------------------------------------
  c.debtRate = e.interestRate + 0.03 + (c.debt > c.assets ? 0.04 : 0);
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
  if (c.playerOwned) return;
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
