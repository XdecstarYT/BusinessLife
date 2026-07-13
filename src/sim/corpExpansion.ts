/**
 * Corporate Empire expansion (V50): friendly full-buyout acquisitions, physical manufacturing
 * (factories with capacity + automation), international subsidiaries (foreign offices), an
 * in-house venture capital arm (a portfolio of minority startup stakes, distinct from
 * investInStartup's one-shot personal angel investing in actions.ts), and structured multi-year
 * advertising campaigns. Self-contained leaf module (like military.ts/drugs.ts), not routed
 * through actions.ts, though its actions operate on the same Company entities. Static catalog
 * in data/corpExpansion.ts. All tick effects are additive to tickCompany()'s core financial
 * model (business.ts) rather than woven into it, to avoid destabilizing that already-tuned system.
 */
import type { AdChannel, Company, GameState } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { companyValuation } from './business';
import { INDUSTRY_BY_ID } from '../data/industries';
import {
  AD_CAMPAIGN_MAX_YEARS, AD_CAMPAIGN_MIN_BUDGET, AD_CAMPAIGN_MIN_YEARS, AD_CHANNEL_BY_ID,
  ACQUISITION_PREMIUM, automationUpgradeCost, factoryCost, FACTORY_CAPACITY_UNITS,
  foreignOfficeCost, VENTURE_ARM_COST, VENTURE_ARM_MIN_HQ_TIER, VENTURE_MIN_INVESTMENT,
  VENTURE_TARGET_VALUATION_CEILING,
} from '../data/corpExpansion';

export interface CorpActionResult {
  ok: boolean;
  message: string;
}

function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
/** Backfill for saves from before the V50 Corporate Empire expansion. */
function ensureFields(c: Company): void {
  c.factories ??= [];
  c.internationalOffices ??= [];
  c.hasVentureArm ??= false;
  c.ventureInvestments ??= [];
  c.activeCampaign ??= null;
  c.campaignsRun ??= 0;
}

function myCompany(state: GameState, companyId: string): Company | null {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return null;
  ensureFields(c);
  return c;
}

// ---------------------------------------------------------------------------
// Acquisitions — friendly full buyout of a private NPC company (distinct from
// attemptHostileTakeover's contested public-company bid in actions.ts).
// ---------------------------------------------------------------------------

export function acquireCompany(state: GameState, targetCompanyId: string): CorpActionResult {
  const p = state.player;
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned || target.isPublic) {
    return { ok: false, message: 'Not a valid acquisition target.' };
  }
  const price = Math.round(companyValuation(target) * ACQUISITION_PREMIUM);
  if (price > p.money) return { ok: false, message: `Needs $${price.toLocaleString()}.` };
  p.money -= price;
  target.playerOwned = true;
  target.playerSharePct = 1;
  target.founderId = 'player';
  target.grudgeAgainstPlayer = 0;
  p.companies.push(target.id);
  p.reputation = clamp100(p.reputation + 2);
  awardAchievement(state, 'acquisition_king');
  log(state, `You acquired ${target.name} outright for $${price.toLocaleString()}.`, 'business');
  return { ok: true, message: `Acquired ${target.name} for $${price.toLocaleString()}.` };
}

// ---------------------------------------------------------------------------
// Venture capital arm — a company-funded portfolio of minority startup stakes.
// ---------------------------------------------------------------------------

export function foundVentureArm(state: GameState, companyId: string): CorpActionResult {
  const c = myCompany(state, companyId);
  if (!c) return { ok: false, message: 'Not your company.' };
  if (c.hasVentureArm) return { ok: false, message: 'Already has a venture arm.' };
  if (c.hqTier < VENTURE_ARM_MIN_HQ_TIER) return { ok: false, message: 'Needs a bigger headquarters first.' };
  if (VENTURE_ARM_COST > c.cash) return { ok: false, message: `Needs $${VENTURE_ARM_COST.toLocaleString()} in company cash.` };
  c.cash -= VENTURE_ARM_COST;
  c.hasVentureArm = true;
  awardAchievement(state, 'venture_capitalist');
  log(state, `${c.name} founded an in-house venture capital arm.`, 'business');
  return { ok: true, message: 'Venture arm founded.' };
}

export function ventureInvest(state: GameState, companyId: string, targetCompanyId: string, amount: number): CorpActionResult {
  const c = myCompany(state, companyId);
  if (!c) return { ok: false, message: 'Not your company.' };
  if (!c.hasVentureArm) return { ok: false, message: 'Found a venture arm first.' };
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned || target.isPublic) {
    return { ok: false, message: 'Invalid startup target.' };
  }
  const value = companyValuation(target);
  if (value > VENTURE_TARGET_VALUATION_CEILING) return { ok: false, message: 'Too large to be a venture-stage startup — try an acquisition instead.' };
  if (amount < VENTURE_MIN_INVESTMENT) return { ok: false, message: `Needs at least $${VENTURE_MIN_INVESTMENT.toLocaleString()}.` };
  if (amount > c.cash) return { ok: false, message: 'Not enough company cash.' };
  const equityPct = clamp(amount / Math.max(1, value + amount), 0.02, 0.4);
  c.cash -= amount;
  c.ventureInvestments.push({ id: `vc_${state.year}_${c.ventureInvestments.length}`, targetCompanyId, investedYear: state.year, amountInvested: amount, equityPct });
  log(state, `${c.name}'s venture arm invested $${amount.toLocaleString()} in ${target.name} for a ${(equityPct * 100).toFixed(1)}% stake.`, 'business');
  return { ok: true, message: `Invested $${amount.toLocaleString()} in ${target.name}.` };
}

export function exitVentureStake(state: GameState, companyId: string, investmentId: string): CorpActionResult {
  const c = myCompany(state, companyId);
  if (!c) return { ok: false, message: 'Not your company.' };
  const inv = c.ventureInvestments.find((v) => v.id === investmentId);
  if (!inv) return { ok: false, message: 'No such investment.' };
  const target = state.companies[inv.targetCompanyId];
  if (!target || target.status !== 'active') return { ok: false, message: 'That stake already resolved on its own.' };
  const proceeds = Math.round(companyValuation(target) * inv.equityPct);
  c.cash += proceeds;
  c.ventureInvestments = c.ventureInvestments.filter((v) => v.id !== investmentId);
  if (proceeds >= inv.amountInvested * 5) awardAchievement(state, 'unicorn_exit');
  log(state, `${c.name} exited its stake in ${target.name} for $${proceeds.toLocaleString()}.`, 'money');
  return { ok: true, message: `Exited for $${proceeds.toLocaleString()}.` };
}

// ---------------------------------------------------------------------------
// International expansion — foreign offices open a new revenue stream abroad.
// ---------------------------------------------------------------------------

export function openForeignOffice(state: GameState, companyId: string, countryId: string): CorpActionResult {
  const c = myCompany(state, companyId);
  if (!c) return { ok: false, message: 'Not your company.' };
  if (countryId === c.countryId) return { ok: false, message: 'That is your home market already.' };
  if (c.internationalOffices.some((o) => o.countryId === countryId)) return { ok: false, message: 'Already have an office there.' };
  const dest = state.countries.find((x) => x.id === countryId);
  if (!dest) return { ok: false, message: 'Unknown country.' };
  const cost = foreignOfficeCost(dest.economy.gdp);
  if (cost > c.cash) return { ok: false, message: `Needs $${cost.toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.internationalOffices.push({ id: `office_${state.year}_${c.internationalOffices.length}`, countryId, openedYear: state.year, strength: 5 });
  if (c.internationalOffices.length >= 5) awardAchievement(state, 'global_conglomerate');
  log(state, `${c.name} opened a foreign office in ${dest.name} for $${cost.toLocaleString()}.`, 'business');
  return { ok: true, message: `Opened an office in ${dest.name}.` };
}

// ---------------------------------------------------------------------------
// Manufacturing — physical factories add production capacity for an ongoing
// output dividend; automation upgrades raise the dividend further.
// ---------------------------------------------------------------------------

export function buildFactory(state: GameState, companyId: string, countryId: string): CorpActionResult {
  const c = myCompany(state, companyId);
  if (!c) return { ok: false, message: 'Not your company.' };
  if (countryId !== c.countryId && !c.internationalOffices.some((o) => o.countryId === countryId)) {
    return { ok: false, message: 'Open a foreign office there before building a factory.' };
  }
  const ind = INDUSTRY_BY_ID[c.industryId];
  const cost = factoryCost(ind?.capitalIntensity ?? 0.5);
  if (cost > c.cash) return { ok: false, message: `Needs $${cost.toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.factories.push({ id: `factory_${state.year}_${c.factories.length}`, countryId, capacityUnits: FACTORY_CAPACITY_UNITS, automationLevel: 0, condition: 100, builtYear: state.year });
  if (c.factories.length >= 3) awardAchievement(state, 'industrialist');
  log(state, `${c.name} built a new factory for $${cost.toLocaleString()}.`, 'business');
  return { ok: true, message: 'Factory built.' };
}

export function upgradeFactoryAutomation(state: GameState, companyId: string, factoryId: string): CorpActionResult {
  const c = myCompany(state, companyId);
  if (!c) return { ok: false, message: 'Not your company.' };
  const f = c.factories.find((x) => x.id === factoryId);
  if (!f) return { ok: false, message: 'No such factory.' };
  if (f.automationLevel >= 5) return { ok: false, message: 'Already fully automated.' };
  const cost = automationUpgradeCost(f.automationLevel);
  if (cost > c.cash) return { ok: false, message: `Needs $${cost.toLocaleString()} in company cash.` };
  c.cash -= cost;
  f.automationLevel++;
  if (f.automationLevel >= 5) awardAchievement(state, 'automation_pioneer');
  log(state, `Upgraded a factory at ${c.name} to automation level ${f.automationLevel}.`, 'business');
  return { ok: true, message: `Factory automation now level ${f.automationLevel}.` };
}

// ---------------------------------------------------------------------------
// Advertising & marketing campaigns — a structured, multi-year commitment
// distinct from the always-on marketingPct lever in tickCompany().
// ---------------------------------------------------------------------------

export function launchAdCampaign(state: GameState, companyId: string, channel: AdChannel, budget: number, years: number): CorpActionResult {
  const c = myCompany(state, companyId);
  if (!c) return { ok: false, message: 'Not your company.' };
  if (c.activeCampaign) return { ok: false, message: 'A campaign is already running.' };
  if (!AD_CHANNEL_BY_ID[channel]) return { ok: false, message: 'Unknown channel.' };
  if (budget < AD_CAMPAIGN_MIN_BUDGET) return { ok: false, message: `Needs at least $${AD_CAMPAIGN_MIN_BUDGET.toLocaleString()}.` };
  const durationYears = clamp(Math.round(years), AD_CAMPAIGN_MIN_YEARS, AD_CAMPAIGN_MAX_YEARS);
  if (budget > c.cash) return { ok: false, message: 'Not enough company cash.' };
  c.cash -= budget;
  c.activeCampaign = { channel, totalBudget: budget, totalYears: durationYears, yearsLeft: durationYears, startYear: state.year };
  log(state, `${c.name} launched a $${budget.toLocaleString()} ${AD_CHANNEL_BY_ID[channel].name} campaign.`, 'business');
  return { ok: true, message: 'Campaign launched.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — factory dividends, foreign office ramp-up, campaign resolution,
// venture portfolio auto-resolution when a target stops being active.
// ---------------------------------------------------------------------------

export function tickCorpExpansion(c: Company, state: GameState, rng: RNG): string[] {
  if (c.status !== 'active') return [];
  ensureFields(c);
  const headlines: string[] = [];

  for (const f of c.factories) {
    f.condition = clamp(f.condition - rng.range(0.5, 2), 0, 100);
    const upkeep = f.capacityUnits * 8 * (1 + f.automationLevel * 0.1);
    const dividend = f.capacityUnits * (40 + f.automationLevel * 35) * (f.condition / 100);
    c.cash += dividend - upkeep;
  }

  for (const o of c.internationalOffices) {
    o.strength = clamp100(o.strength + rng.range(3, 8));
    const dest = state.countries.find((x) => x.id === o.countryId);
    if (!dest) continue;
    const growthFactor = 1 + dest.economy.gdpGrowth;
    c.cash += c.revenue * 0.015 * (o.strength / 100) * growthFactor;
  }

  if (c.activeCampaign) {
    const camp = c.activeCampaign;
    const def = AD_CHANNEL_BY_ID[camp.channel];
    const yearSpend = camp.totalBudget / camp.totalYears;
    const brandGain = (yearSpend / Math.max(1, c.revenue)) * 100 * def.brandPower;
    c.brand = clamp100(c.brand + brandGain);
    camp.yearsLeft--;
    if (camp.yearsLeft <= 0) {
      if (rng.chance(def.viralChance)) {
        c.brand = clamp100(c.brand + rng.range(10, 25));
        awardAchievement(state, 'viral_campaign');
        headlines.push(`${c.name}'s ${def.name.toLowerCase()} campaign went viral`);
      } else if (rng.chance(def.backfireChance)) {
        c.brand = clamp100(c.brand - rng.range(8, 20));
        awardAchievement(state, 'ad_disaster');
        headlines.push(`${c.name}'s ${def.name.toLowerCase()} campaign backfired badly`);
      }
      c.campaignsRun++;
      c.activeCampaign = null;
    }
  }

  if (c.ventureInvestments.length) {
    const resolved: string[] = [];
    for (const inv of c.ventureInvestments) {
      const target = state.companies[inv.targetCompanyId];
      if (!target || target.status === 'active') continue;
      if (target.status === 'bankrupt') {
        headlines.push(`${c.name}'s venture stake in ${target.name} was wiped out in its bankruptcy`);
      } else {
        const proceeds = Math.round(companyValuation(target) * inv.equityPct);
        c.cash += proceeds;
        if (proceeds >= inv.amountInvested * 5) awardAchievement(state, 'unicorn_exit');
        headlines.push(`${c.name}'s venture stake in ${target.name} cashed out for $${proceeds.toLocaleString()}`);
      }
      resolved.push(inv.id);
    }
    if (resolved.length) c.ventureInvestments = c.ventureInvestments.filter((v) => !resolved.includes(v.id));
  }

  if (c.factories.length > 0 && c.internationalOffices.length > 0 && c.hasVentureArm && c.campaignsRun > 0) {
    awardAchievement(state, 'mega_corp');
  }

  return headlines;
}
