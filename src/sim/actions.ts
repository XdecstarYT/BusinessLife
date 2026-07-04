/**
 * Player actions: the verbs the UI invokes between years. Each mutates the
 * game state and returns a short result message. They validate affordability
 * and eligibility so the UI can surface clean errors. RNG-consuming actions
 * advance the persisted stream so outcomes stay deterministic on replay.
 */
import type { Advisor, AdvisorSpecialty, CabinetPortfolio, Company, Executive, ExecutiveRole, GameState, Gender, InfrastructureKind, ManifestoPromise, OfficeKind, PropertyAsset, TaxRates } from './types';
import { CABINET_PORTFOLIOS, clamp, clamp100 } from './types';
import { RNG } from './rng';
import { INDUSTRY_BY_ID, INDUSTRIES } from '../data/industries';
import { LAW_BY_ID } from '../data/laws';
import { SK } from '../data/skills';
import { makeCompanyName, makePartyName, makePersonName } from '../data/names';
import { createCompany, nextCompanyId, companyValuation } from './business';
import { doIPO, marketCap } from './market';
import { OFFICE_SPEC_BY_KIND, campaignWinChance, eligibleFor, estimateLawVote } from './politics';
import { log } from './engine';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Draw a fresh RNG seeded from the persisted stream, and persist it back. */
function withRng(state: GameState): RNG {
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  return rng;
}
function commit(state: GameState, rng: RNG): void {
  state.rngState = rng.state;
}

// ---------------------------------------------------------------------------
// Education & careers
// ---------------------------------------------------------------------------

export const DEGREES = [
  { degree: 'Certificate', field: 'Trade', years: 1, cost: 8_000, smarts: 2 },
  { degree: "Bachelor's", field: 'Business', years: 3, cost: 25_000, smarts: 6 },
  { degree: "Bachelor's", field: 'Economics', years: 3, cost: 25_000, smarts: 6 },
  { degree: "Bachelor's", field: 'Law', years: 4, cost: 40_000, smarts: 7 },
  { degree: "Bachelor's", field: 'Engineering', years: 4, cost: 35_000, smarts: 7 },
  { degree: "Bachelor's", field: 'Computer Science', years: 3, cost: 30_000, smarts: 7 },
  { degree: "Bachelor's", field: 'Political Science', years: 3, cost: 24_000, smarts: 6 },
  { degree: "Bachelor's", field: 'Medicine', years: 6, cost: 70_000, smarts: 9 },
  { degree: 'MBA', field: 'Business Administration', years: 2, cost: 90_000, smarts: 5 },
  { degree: 'Doctorate', field: 'Research', years: 4, cost: 20_000, smarts: 8 },
  { degree: 'Vocational Certificate', field: 'Culinary Arts', years: 1, cost: 12_000, smarts: 2 },
  { degree: 'Executive MBA', field: 'International Business', years: 2, cost: 140_000, smarts: 6 },
  { degree: 'PhD', field: 'Artificial Intelligence', years: 5, cost: 60_000, smarts: 10 },
  { degree: "Juris Doctor", field: 'Advanced Law', years: 3, cost: 85_000, smarts: 8 },
  { degree: 'Diploma', field: 'Foreign Languages', years: 1, cost: 10_000, smarts: 3 },
];

export function enroll(state: GameState, index: number): ActionResult {
  const p = state.player;
  const d = DEGREES[index];
  if (!d) return { ok: false, message: 'Unknown programme.' };
  if (p.studying) return { ok: false, message: 'You are already studying.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  p.studying = { degree: d.degree, field: d.field, yearsLeft: d.years, costPerYear: Math.round(d.cost / d.years) };
  p.smarts = clamp100(p.smarts + d.smarts);
  log(state, `Enrolled in a ${d.degree} in ${d.field}.`, 'info');
  return { ok: true, message: `Enrolled. ${d.years} years at $${Math.round(d.cost / d.years).toLocaleString()}/yr.` };
}

/** Job openings generated from home-country industries, scaled by the player. */
export function jobOpenings(state: GameState): { title: string; industryId: string; salary: number; requiredSmarts: number; track: 'corporate' | 'public' | 'media' | 'crime' }[] {
  const p = state.player;
  const rng = new RNG(state.seed ^ (state.year * 2654435761));
  const eduBonus = p.education.length * 0.25 + (p.education.some((e) => e.degree === 'MBA' || e.degree === 'Doctorate') ? 0.4 : 0);
  const out: { title: string; industryId: string; salary: number; requiredSmarts: number; track: 'corporate' | 'public' | 'media' | 'crime' }[] = [];
  const pool = rng.shuffle(INDUSTRIES).slice(0, 8);
  for (const ind of pool) {
    const seniority = clamp(0.3 + (p.skills[ind.skillId] ?? 0) / 120 + eduBonus, 0.3, 2.5);
    const base = 38_000 + ind.startupCost / 50_000 * 1000;
    const salary = Math.round(base * seniority * (1 + (p.smarts - 50) / 200));
    const titles = ['Analyst', 'Associate', 'Manager', 'Director', 'Specialist', 'Consultant', 'Lead'];
    const track: 'corporate' | 'media' = ind.tags.includes('media') ? 'media' : 'corporate';
    out.push({
      title: `${ind.sector} ${rng.pick(titles)}`,
      industryId: ind.id,
      salary,
      requiredSmarts: Math.round(30 + ind.techIntensity * 40),
      track,
    });
  }
  // Public-sector entry role
  out.push({ title: 'Political Staffer', industryId: 'services_law_firm', salary: 52_000, requiredSmarts: 40, track: 'public' });
  return out;
}

export function takeJob(state: GameState, opening: { title: string; industryId: string; salary: number; requiredSmarts: number; track: string }): ActionResult {
  const p = state.player;
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  if (p.smarts < opening.requiredSmarts) return { ok: false, message: `Requires ${opening.requiredSmarts}+ smarts.` };
  const ind = INDUSTRY_BY_ID[opening.industryId];
  p.job = {
    title: opening.title,
    industryId: opening.industryId,
    employerId: null,
    employerName: makeCompanyName(new RNG(state.rngState), ind?.sector ?? 'default'),
    salary: opening.salary,
    performance: 55,
    yearsInRole: 0,
    track: opening.track as 'corporate' | 'public' | 'media' | 'crime' | 'none',
  };
  log(state, `Started a new job: ${opening.title} at ${p.job.employerName} ($${opening.salary.toLocaleString()}/yr).`, 'good');
  return { ok: true, message: `Hired as ${opening.title}.` };
}

export function quitJob(state: GameState): ActionResult {
  if (!state.player.job) return { ok: false, message: 'You have no job.' };
  log(state, `You quit your job as ${state.player.job.title}.`, 'info');
  state.player.job = null;
  return { ok: true, message: 'You quit your job.' };
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

export function startCompany(state: GameState, industryId: string, name: string, funding: number): ActionResult {
  const p = state.player;
  const ind = INDUSTRY_BY_ID[industryId];
  if (!ind) return { ok: false, message: 'Unknown industry.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const minFunding = Math.round(ind.startupCost * 0.5);
  if (funding < minFunding) return { ok: false, message: `Needs at least $${minFunding.toLocaleString()} to launch.` };
  if (funding > p.money) return { ok: false, message: 'You cannot afford that.' };
  const rng = withRng(state);
  p.money -= funding;
  const co = createCompany({
    name: name.trim() || makeCompanyName(rng, ind.sector, p.name.split(' ').pop()),
    industry: ind,
    countryId: p.countryId,
    founderId: 'player',
    playerOwned: true,
    capital: funding,
    year: state.year,
  }, rng);
  co.id = nextCompanyId(state);
  state.companies[co.id] = co;
  p.companies.push(co.id);
  p.reputation = clamp100(p.reputation + 2);
  if (!state.achievements.includes('first_company')) state.achievements.push('first_company');
  commit(state, rng);
  log(state, `🚀 Founded ${co.name}, a ${ind.name} company, with $${funding.toLocaleString()} in capital.`, 'business');
  return { ok: true, message: `${co.name} is open for business!` };
}

export function investInCompany(state: GameState, companyId: string, amount: number): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || c.status !== 'active' || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= amount;
  c.cash += amount * 0.4;
  c.assets += amount * 0.6;
  return { ok: true, message: `Invested $${amount.toLocaleString()} into ${c.name}.` };
}

export function withdrawFromCompany(state: GameState, companyId: string, amount: number): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || c.status !== 'active' || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  const available = c.cash * c.playerSharePct;
  if (amount <= 0 || amount > available) return { ok: false, message: `Only $${Math.round(available).toLocaleString()} available to draw.` };
  c.cash -= amount / Math.max(0.01, c.playerSharePct);
  p.money += amount;
  return { ok: true, message: `Drew $${amount.toLocaleString()} from ${c.name}.` };
}

export type CompanyLever = 'marketingPct' | 'rdPct' | 'priceLevel' | 'salaryLevel' | 'dividendPayoutPct' | 'automation' | 'cyberDefense';

export function setCompanyLever(state: GameState, companyId: string, lever: CompanyLever, value: number): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  const bounds: Record<CompanyLever, [number, number]> = {
    marketingPct: [0, 0.25], rdPct: [0, 0.25], priceLevel: [0.7, 1.5], salaryLevel: [0.85, 1.4], dividendPayoutPct: [0, 0.9], automation: [0, 100], cyberDefense: [0, 100],
  };
  const [lo, hi] = bounds[lever];
  if (lever === 'automation' || lever === 'cyberDefense') {
    // Automation/security both cost capital to raise.
    const delta = clamp(value, lo, hi) - c[lever];
    if (delta > 0) {
      const cost = delta * c.revenue * (lever === 'automation' ? 0.01 : 0.006);
      if (cost > c.cash) return { ok: false, message: 'Not enough company cash for that.' };
      c.cash -= cost;
    }
  }
  (c as unknown as Record<CompanyLever, number>)[lever] = clamp(value, lo, hi);
  return { ok: true, message: 'Strategy updated.' };
}

export function takeCompanyPublic(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || c.status !== 'active' || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  if (c.isPublic) return { ok: false, message: 'Already public.' };
  if (c.revenue < 5_000_000) return { ok: false, message: 'Company needs $5m+ revenue to IPO.' };
  const rng = withRng(state);
  const raised = doIPO(c, rng);
  if (!state.achievements.includes('ipo_ceo')) state.achievements.push('ipo_ceo');
  commit(state, rng);
  log(state, `📈 ${c.name} went public, raising $${Math.round(raised).toLocaleString()}. You retain ${Math.round(c.playerSharePct * 100)}%.`, 'business');
  return { ok: true, message: `IPO complete — $${Math.round(raised).toLocaleString()} raised.` };
}

export function sellCompany(state: GameState, companyId: string): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || c.status !== 'active' || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  const value = c.isPublic ? c.sharePrice * c.sharesOutstanding * c.playerSharePct : companyValuation(c) * c.playerSharePct;
  const country = state.countries.find((k) => k.id === p.countryId)!;
  const tax = value * country.economy.taxRates.capitalGains * 0.6;
  p.money += value - tax;
  c.status = 'sold';
  c.playerOwned = false;
  p.companies = p.companies.filter((id) => id !== companyId);
  log(state, `Sold ${c.name} for $${Math.round(value).toLocaleString()} (net of tax).`, 'money');
  return { ok: true, message: `Sold ${c.name} for $${Math.round(value - tax).toLocaleString()}.` };
}

/** Corporate espionage: steal trade secrets from a rival, at real legal risk. */
export function spyOnCompany(state: GameState, targetCompanyId: string): ActionResult {
  const p = state.player;
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned) return { ok: false, message: 'Invalid target.' };
  const cost = Math.round(20_000 + target.revenue * 0.002);
  if (cost > p.money) return { ok: false, message: `Espionage costs $${cost.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= cost;
  const skill = (p.skills[SK.hacking] ?? 0) * 0.6 + (p.skills[SK.streetSmarts] ?? 0) * 0.4;
  const chance = clamp(0.35 + skill * 0.005 - target.cyberDefense * 0.003, 0.05, 0.85);
  const success = rng.chance(chance);
  commit(state, rng);
  if (success) {
    const beneficiaries = p.companies
      .map((id) => state.companies[id])
      .filter((co): co is Company => !!co && co.status === 'active' && co.industryId === target.industryId);
    for (const b of beneficiaries) {
      b.quality = clamp100(b.quality + 6);
      b.brand = clamp100(b.brand + 3);
    }
    target.brand = clamp100(target.brand - 5);
    target.quality = clamp100(target.quality - 3);
    p.notoriety = clamp100(p.notoriety + 4);
    log(state, `🕵️ Corporate espionage against ${target.name} paid off.`, 'business');
    return {
      ok: true,
      message: beneficiaries.length
        ? `Stole trade secrets from ${target.name}.`
        : `Learned about ${target.name}'s operations, but have no company in that industry to use it.`,
    };
  }
  p.notoriety = clamp100(p.notoriety + 8);
  p.reputation = clamp100(p.reputation - 6);
  const founder = target.founderId !== 'player' ? state.npcs[target.founderId] : null;
  if (founder) founder.opinionOfPlayer = clamp(founder.opinionOfPlayer - 40, -100, 100);
  if (rng.chance(0.3)) p.criminalRecord++;
  log(state, `🚨 Your corporate espionage attempt against ${target.name} was exposed.`, 'bad');
  return { ok: false, message: `Caught red-handed spying on ${target.name}.` };
}

/** Attempt to acquire an NPC-owned public company by outbidding the market. */
export function attemptHostileTakeover(state: GameState, targetCompanyId: string, offerAmount: number): ActionResult {
  const p = state.player;
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned || !target.isPublic) {
    return { ok: false, message: 'Not a valid takeover target.' };
  }
  if (offerAmount > p.money) return { ok: false, message: 'You cannot afford that offer.' };
  const cap = Math.max(1, marketCap(target));
  const ratio = offerAmount / cap;
  if (ratio < 0.6) return { ok: false, message: 'Offer is too low to be taken seriously (needs 60%+ of market cap).' };
  const rng = withRng(state);
  const skill = (p.skills[SK.negotiation] ?? 0) * 0.4 + p.influence * 0.4;
  const chance = clamp(0.1 + (ratio - 1) * 0.6 + skill * 0.003, 0.05, 0.9);
  const success = rng.chance(chance);
  const dueDiligenceFee = offerAmount * 0.05;
  if (!success) {
    p.money -= dueDiligenceFee;
    commit(state, rng);
    log(state, `Your takeover bid for ${target.name} was rebuffed by the board.`, 'bad');
    return { ok: false, message: `${target.name}'s board rejected your bid.` };
  }
  p.money -= offerAmount;
  target.playerOwned = true;
  target.playerSharePct = clamp(0.51 + (ratio - 1) * 0.2, 0.51, 0.95);
  target.founderId = 'player';
  p.companies.push(target.id);
  p.reputation = clamp100(p.reputation + 3);
  p.influence = clamp100(p.influence + 2);
  commit(state, rng);
  log(state, `🏴 Hostile takeover complete: you now control ${target.name}.`, 'business');
  return { ok: true, message: `Acquired ${target.name}!` };
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

export function propertyListings(state: GameState): Omit<PropertyAsset, 'id' | 'purchasePrice' | 'mortgage' | 'insured'>[] {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const rng = new RNG(state.seed ^ (state.year * 40503));
  const kinds: PropertyAsset['kind'][] = ['apartment', 'house', 'mansion', 'commercial', 'land', 'island', 'penthouse'];
  const basePrices: Record<PropertyAsset['kind'], number> = {
    apartment: 220_000, house: 480_000, mansion: 2_800_000, commercial: 3_500_000, land: 900_000, island: 45_000_000, penthouse: 6_500_000,
  };
  return kinds.map((kind) => {
    const city = rng.pick(home.cities);
    const value = Math.round(basePrices[kind] * city.costOfLiving * (home.economy.housingIndex / 100) * rng.range(0.85, 1.2));
    const rentalYield = kind === 'land' ? 0 : kind === 'commercial' ? rng.range(0.06, 0.09) : kind === 'penthouse' ? rng.range(0.04, 0.07) : rng.range(0.03, 0.06);
    return { name: `${kind[0].toUpperCase()}${kind.slice(1)} in ${city.name}`, kind, cityId: city.id, value, rentalYield, baseRentalYield: rentalYield };
  });
}

export function buyProperty(state: GameState, listing: Omit<PropertyAsset, 'id' | 'purchasePrice' | 'mortgage' | 'insured'>, useMortgage: boolean): ActionResult {
  const p = state.player;
  const deposit = useMortgage ? listing.value * 0.2 : listing.value;
  if (deposit > p.money) return { ok: false, message: useMortgage ? 'Cannot afford the 20% deposit.' : 'Cannot afford it outright.' };
  p.money -= deposit;
  p.properties.push({
    id: `prop_${state.year}_${p.properties.length}`,
    name: listing.name,
    kind: listing.kind,
    cityId: listing.cityId,
    value: listing.value,
    purchasePrice: listing.value,
    rentalYield: listing.rentalYield,
    baseRentalYield: listing.baseRentalYield,
    mortgage: useMortgage ? listing.value * 0.8 : 0,
    insured: false,
  });
  log(state, `🏠 Bought ${listing.name} for $${listing.value.toLocaleString()}${useMortgage ? ' (mortgaged)' : ''}.`, 'money');
  return { ok: true, message: `Purchased ${listing.name}.` };
}

export function sellProperty(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  const net = prop.value - prop.mortgage;
  p.money += net;
  p.properties = p.properties.filter((x) => x.id !== propertyId);
  log(state, `Sold ${prop.name} for $${Math.round(net).toLocaleString()} (net of mortgage).`, 'money');
  return { ok: true, message: `Sold ${prop.name}.` };
}

export function renovateProperty(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  const cost = Math.round(prop.value * 0.08);
  if (cost > p.money) return { ok: false, message: `Renovation costs $${cost.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= cost;
  const bump = rng.range(0.1, 0.15);
  prop.value = Math.round(prop.value * (1 + bump));
  if (prop.rentalYield > 0) prop.baseRentalYield = Math.min(0.12, prop.baseRentalYield * 1.1);
  commit(state, rng);
  log(state, `Renovated ${prop.name}, boosting its value by ${Math.round(bump * 100)}%.`, 'money');
  return { ok: true, message: `${prop.name} renovated.` };
}

export function toggleRentalStatus(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  if (prop.kind === 'land') return { ok: false, message: 'Undeveloped land cannot be rented out.' };
  if (prop.rentalYield > 0) {
    prop.rentalYield = 0;
    return { ok: true, message: `${prop.name} is now for your own use.` };
  }
  prop.rentalYield = prop.baseRentalYield;
  return { ok: true, message: `${prop.name} is now rented out.` };
}

export function togglePropertyInsurance(state: GameState, propertyId: string): ActionResult {
  const p = state.player;
  const prop = p.properties.find((x) => x.id === propertyId);
  if (!prop) return { ok: false, message: 'Property not found.' };
  prop.insured = !prop.insured;
  return { ok: true, message: prop.insured ? `${prop.name} is now insured.` : `Cancelled insurance for ${prop.name}.` };
}

// ---------------------------------------------------------------------------
// Financial instruments — bonds, forex speculation, insurance
// ---------------------------------------------------------------------------

export function buyBond(state: GameState, countryId: string, principal: number, years: number): ActionResult {
  const p = state.player;
  const country = state.countries.find((c) => c.id === countryId);
  if (!country) return { ok: false, message: 'Unknown country.' };
  if (principal <= 0 || principal > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= principal;
  const rate = country.economy.interestRate + 0.01;
  p.bonds.push({ id: `bond_${state.year}_${p.bonds.length}`, countryId, principal, rate, yearsLeft: years });
  if (!state.achievements.includes('bond_investor')) state.achievements.push('bond_investor');
  log(state, `Bought a $${principal.toLocaleString()} ${country.name} government bond at ${(rate * 100).toFixed(1)}% over ${years} years.`, 'money');
  return { ok: true, message: `Bond purchased at ${(rate * 100).toFixed(1)}%.` };
}

export function sellBondEarly(state: GameState, bondId: string): ActionResult {
  const p = state.player;
  const bond = p.bonds.find((b) => b.id === bondId);
  if (!bond) return { ok: false, message: 'Bond not found.' };
  const penalty = bond.principal * 0.08;
  p.money += bond.principal - penalty;
  p.bonds = p.bonds.filter((b) => b.id !== bondId);
  return { ok: true, message: `Redeemed early for $${Math.round(bond.principal - penalty).toLocaleString()} (8% early-exit penalty).` };
}

export function openForexPosition(state: GameState, countryId: string, notional: number, short: boolean): ActionResult {
  const p = state.player;
  const country = state.countries.find((c) => c.id === countryId);
  if (!country) return { ok: false, message: 'Unknown country.' };
  if (notional <= 0 || notional > p.money) return { ok: false, message: 'Invalid amount.' };
  p.money -= notional;
  p.forexPositions.push({
    id: `fx_${state.year}_${p.forexPositions.length}`,
    countryId,
    notional,
    entryRate: country.economy.exchangeRate,
    short,
  });
  if (!state.achievements.includes('forex_trader')) state.achievements.push('forex_trader');
  log(state, `Opened a ${short ? 'short' : 'long'} $${notional.toLocaleString()} forex position on the ${country.currency}.`, 'money');
  return { ok: true, message: `Forex position opened.` };
}

export function closeForexPosition(state: GameState, positionId: string): ActionResult {
  const p = state.player;
  const pos = p.forexPositions.find((f) => f.id === positionId);
  if (!pos) return { ok: false, message: 'Position not found.' };
  const country = state.countries.find((c) => c.id === pos.countryId);
  const currentRate = country?.economy.exchangeRate ?? pos.entryRate;
  const ratio = currentRate / pos.entryRate;
  const payout = pos.short ? pos.notional * (2 - ratio) : pos.notional * ratio;
  p.money += Math.max(0, payout);
  p.forexPositions = p.forexPositions.filter((f) => f.id !== positionId);
  const pl = payout - pos.notional;
  log(state, `Closed forex position for $${Math.round(Math.max(0, payout)).toLocaleString()} (${pl >= 0 ? '+' : ''}$${Math.round(pl).toLocaleString()}).`, pl >= 0 ? 'money' : 'bad');
  return { ok: true, message: `Position closed.` };
}

export function toggleCompanyInsurance(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  c.insured = !c.insured;
  return { ok: true, message: c.insured ? `${c.name} is now insured.` : `Cancelled insurance for ${c.name}.` };
}

// ---------------------------------------------------------------------------
// Business mechanics: brand deals, training, supply chain, quality, recalls
// ---------------------------------------------------------------------------

export function hireBrandAmbassador(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(20_000, c.revenue * 0.03);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  const rng = withRng(state);
  c.cash -= cost;
  if (rng.chance(0.75)) {
    c.brand = clamp100(c.brand + rng.range(6, 12));
    commit(state, rng);
    log(state, `${c.name} signed a brand ambassador deal. Brand awareness jumped.`, 'business');
    return { ok: true, message: 'The ambassador deal is a hit.' };
  }
  c.brand = clamp100(c.brand - rng.range(2, 5));
  commit(state, rng);
  log(state, `${c.name}'s new brand ambassador caused a minor controversy.`, 'bad');
  return { ok: false, message: 'The ambassador caused a stir. Brand took a small hit.' };
}

export function runTrainingProgram(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(10_000, c.revenue * 0.015);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.managerQuality = clamp100(c.managerQuality + 6);
  c.morale = clamp100(c.morale + 8);
  log(state, `${c.name} ran an employee training program.`, 'business');
  return { ok: true, message: 'Training complete. Morale and management quality improved.' };
}

export function diversifySupplyChain(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(15_000, c.revenue * 0.02);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  if (c.supplyChainResilience >= 95) return { ok: false, message: 'Supply chain is already highly diversified.' };
  c.cash -= cost;
  c.supplyChainResilience = clamp100(c.supplyChainResilience + 15);
  log(state, `${c.name} diversified its supply chain, reducing commodity-price exposure.`, 'business');
  return { ok: true, message: 'Supply chain diversified.' };
}

export function qualityAudit(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(8_000, c.revenue * 0.01);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.quality = clamp100(c.quality + 5);
  c.customerSatisfaction = clamp100(c.customerSatisfaction + 5);
  log(state, `${c.name} completed a quality control audit.`, 'business');
  return { ok: true, message: 'Quality audit complete.' };
}

export function proactiveRecall(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(30_000, c.revenue * 0.04);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.quality = clamp100(c.quality + 8);
  c.customerSatisfaction = clamp100(c.customerSatisfaction + 4);
  if (c.lawsuits > 0) c.lawsuits--;
  log(state, `${c.name} issued a proactive product recall ahead of any complaints.`, 'business');
  return { ok: true, message: 'Recall handled proactively — customers noticed the diligence.' };
}

// ---------------------------------------------------------------------------
// Corporate HQ tiers & culture
// ---------------------------------------------------------------------------

export const HQ_TIERS = [
  { tier: 0, name: 'Basic Office', blurb: 'A modest office suite. No special perks.' },
  { tier: 1, name: 'Campus', blurb: 'A dedicated campus — modest morale and brand lift.' },
  { tier: 2, name: 'Tower', blurb: 'A signature tower — strong morale, management and brand lift.' },
  { tier: 3, name: 'Megacomplex', blurb: 'A flagship megacomplex — the strongest morale, management and brand lift money can buy.' },
] as const;

export const CULTURE_INFO: Record<Company['culture'], { label: string; blurb: string }> = {
  traditional: { label: 'Traditional', blurb: 'Faster management growth, steadier morale, higher overhead.' },
  flexible: { label: 'Flexible', blurb: 'A balanced, no-drawback default.' },
  remote: { label: 'Remote-First', blurb: 'Lower overhead, but morale swings harder year to year.' },
  startup: { label: 'Startup', blurb: 'R&D hits harder, but morale is volatile and overhead runs lean.' },
};

export function upgradeHQ(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.hqTier >= 3) return { ok: false, message: 'Already at the top HQ tier.' };
  const cost = (c.hqTier + 1) * Math.max(50_000, c.revenue * 0.25);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.hqTier++;
  const tierName = HQ_TIERS[c.hqTier].name;
  if (c.hqTier >= 3 && !state.achievements.includes('hq_megacomplex')) state.achievements.push('hq_megacomplex');
  log(state, `${c.name} moved into a new ${tierName} HQ.`, 'business');
  return { ok: true, message: `Upgraded to ${tierName}.` };
}

export function setCompanyCulture(state: GameState, companyId: string, culture: Company['culture']): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.culture === culture) return { ok: false, message: 'That is already the culture.' };
  const cost = Math.max(5_000, c.revenue * 0.005);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} to restructure.` };
  c.cash -= cost;
  c.culture = culture;
  log(state, `${c.name} adopted a ${CULTURE_INFO[culture].label.toLowerCase()} workplace culture.`, 'business');
  return { ok: true, message: `Culture set to ${CULTURE_INFO[culture].label}.` };
}

export function runGraduateProgram(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(35_000, c.revenue * 0.04);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.managerQuality = clamp100(c.managerQuality + 12);
  c.quality = clamp100(c.quality + 4);
  log(state, `${c.name} launched a graduate development program.`, 'business');
  return { ok: true, message: 'Graduate program complete. Management and quality improved.' };
}

export function runLeadershipProgram(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const cost = Math.max(80_000, c.revenue * 0.08);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.managerQuality = clamp100(c.managerQuality + 20);
  c.morale = clamp100(c.morale + 12);
  c.brand = clamp100(c.brand + 5);
  log(state, `${c.name} ran an executive leadership program.`, 'business');
  return { ok: true, message: 'Leadership program complete. Management, morale and brand all improved.' };
}

// ---------------------------------------------------------------------------
// Corporate structure: executives, bonds, buybacks, spin-offs
// ---------------------------------------------------------------------------

const EXEC_TITLES: Record<ExecutiveRole, string> = { cfo: 'CFO', coo: 'COO', cmo: 'CMO' };

export function hireExecutive(state: GameState, companyId: string, role: ExecutiveRole): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.executives.some((e) => e.role === role)) return { ok: false, message: `${c.name} already has a ${EXEC_TITLES[role]}.` };
  const salary = Math.max(80_000, c.revenue * 0.01);
  const signOnBonus = salary * 0.5;
  if (signOnBonus > c.cash) return { ok: false, message: `Needs $${Math.round(signOnBonus).toLocaleString()} in company cash for the sign-on bonus.` };
  const rng = withRng(state);
  c.cash -= signOnBonus;
  const exec: Executive = { role, name: makePersonName(rng, rng.chance(0.5) ? 'male' : 'female'), skill: rng.range(45, 90), salary };
  c.executives.push(exec);
  commit(state, rng);
  log(state, `${c.name} hired ${exec.name} as ${EXEC_TITLES[role]}.`, 'business');
  return { ok: true, message: `${exec.name} joins as ${EXEC_TITLES[role]}.` };
}

export function fireExecutive(state: GameState, companyId: string, role: ExecutiveRole): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  const exec = c.executives.find((e) => e.role === role);
  if (!exec) return { ok: false, message: `No ${EXEC_TITLES[role]} to let go.` };
  c.executives = c.executives.filter((e) => e.role !== role);
  log(state, `${exec.name} departed as ${EXEC_TITLES[role]} of ${c.name}.`, 'business');
  return { ok: true, message: `${exec.name} has left the company.` };
}

export function issueCorporateBond(state: GameState, companyId: string, amount: number, termYears: number): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.bondDebt > 0) return { ok: false, message: 'Repay the existing corporate bond before issuing another.' };
  if (amount <= 0 || amount > c.assets * 2 + c.revenue) return { ok: false, message: 'Bond amount is too large relative to the company\'s size.' };
  const country = state.countries.find((k) => k.id === c.countryId)!;
  const riskSpread = clamp((c.debt + c.bondDebt) / Math.max(1, c.assets), 0, 1) * 0.03;
  const rate = country.economy.interestRate + 0.02 + riskSpread;
  c.cash += amount;
  c.bondDebt = amount;
  c.bondRate = rate;
  c.bondYearsLeft = clamp(termYears, 2, 10);
  log(state, `${c.name} issued a $${Math.round(amount).toLocaleString()} corporate bond at ${(rate * 100).toFixed(1)}%.`, 'business');
  return { ok: true, message: `Bond issued: $${Math.round(amount).toLocaleString()} at ${(rate * 100).toFixed(1)}%.` };
}

export function buybackShares(state: GameState, companyId: string, amount: number): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || !c.isPublic || c.status !== 'active') return { ok: false, message: 'Only public companies you control can buy back shares.' };
  if (amount <= 0 || amount > c.cash) return { ok: false, message: `Needs $${Math.round(amount).toLocaleString()} in company cash.` };
  const cap = Math.max(1, marketCap(c));
  const sharesRetired = amount / c.sharePrice;
  if (sharesRetired >= c.sharesOutstanding * 0.5) return { ok: false, message: 'Cannot retire more than half of shares outstanding at once.' };
  c.cash -= amount;
  c.sharesOutstanding -= sharesRetired;
  c.playerSharePct = clamp(c.playerSharePct * (c.sharesOutstanding + sharesRetired) / c.sharesOutstanding, 0, 1);
  c.sharePrice = c.sharePrice * (1 + clamp(amount / cap, 0, 0.3) * 0.5);
  log(state, `${c.name} bought back $${Math.round(amount).toLocaleString()} of its own shares.`, 'business');
  return { ok: true, message: `Retired ${Math.round(sharesRetired).toLocaleString()} shares.` };
}

export function spinOffCompany(state: GameState, companyId: string): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.revenue < 5_000_000) return { ok: false, message: 'The company needs at least $5M in revenue to support a spin-off.' };
  const ind = INDUSTRY_BY_ID[c.industryId];
  const rng = withRng(state);
  const spinFraction = 0.4;
  const newId = nextCompanyId(state);
  const spin = createCompany(
    { name: `${c.name} Ventures`, industry: ind, countryId: c.countryId, founderId: 'player', playerOwned: true, capital: c.assets * spinFraction, year: state.year },
    rng,
  );
  spin.id = newId;
  spin.revenue = c.revenue * spinFraction;
  spin.employees = Math.round(c.employees * spinFraction);
  spin.cash = c.cash * spinFraction * 0.5;
  spin.brand = c.brand * 0.7;
  spin.quality = c.quality;
  spin.playerSharePct = 0.7;
  state.companies[newId] = spin;
  p.companies.push(newId);

  c.revenue *= 1 - spinFraction;
  c.assets *= 1 - spinFraction;
  c.employees = Math.round(c.employees * (1 - spinFraction));
  c.cash -= spin.cash;

  commit(state, rng);
  log(state, `${c.name} spun off a new entity, ${spin.name}, retaining a 70% stake.`, 'business');
  return { ok: true, message: `${spin.name} spun off successfully.` };
}

export function fileTrademark(state: GameState, companyId: string): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'Not your company.' };
  if (c.trademarks >= 5) return { ok: false, message: 'Already holds the maximum useful trademarks.' };
  const cost = Math.max(5_000, c.revenue * 0.003);
  if (cost > c.cash) return { ok: false, message: `Needs $${Math.round(cost).toLocaleString()} in company cash.` };
  c.cash -= cost;
  c.trademarks++;
  c.brand = clamp100(c.brand + 1);
  if (c.trademarks >= 5 && !state.achievements.includes('trademark_portfolio')) state.achievements.push('trademark_portfolio');
  log(state, `${c.name} filed a new trademark.`, 'business');
  return { ok: true, message: `Trademark filed for ${c.name}.` };
}

/** A political extension of the existing celebrity/brand-ambassador system: courting a
 * celebrity endorsement for an active campaign instead of a company. */
export function seekCelebrityEndorsement(state: GameState): ActionResult {
  const p = state.player;
  if (!p.campaign) return { ok: false, message: 'You need an active campaign to seek an endorsement.' };
  const cost = 30_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  const celeb = Object.values(state.npcs).find((n) => n.alive && n.countryId === p.countryId && n.role === 'celebrity');
  if (!celeb) return { ok: false, message: 'No notable celebrities in your country right now.' };
  const rng = withRng(state);
  p.money -= cost;
  const chance = clamp(0.5 + (p.reputation - 50) * 0.004 + celeb.opinionOfPlayer * 0.002, 0.15, 0.9);
  const success = rng.chance(chance);
  commit(state, rng);
  if (success) {
    const gain = rng.range(4, 9);
    p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
    p.popularity = clamp100(p.popularity + 2);
    if (!state.achievements.includes('celebrity_backed')) state.achievements.push('celebrity_backed');
    log(state, `⭐ ${celeb.name} publicly endorsed your campaign.`, 'politics');
    return { ok: true, message: `${celeb.name} endorsed you! Momentum +${gain.toFixed(0)}.` };
  }
  p.campaign.momentum = clamp(p.campaign.momentum - 3, -50, 50);
  log(state, `${celeb.name} declined to endorse you — and said so publicly.`, 'bad');
  return { ok: false, message: `${celeb.name} publicly turned you down.` };
}

export function buyLifeInsurance(state: GameState, monthlyPremium: number): ActionResult {
  const p = state.player;
  if (p.lifeInsurance) return { ok: false, message: 'You already have a life insurance policy.' };
  if (monthlyPremium <= 0 || monthlyPremium * 12 > p.money) return { ok: false, message: 'Cannot afford the first year of premiums.' };
  p.lifeInsurance = { monthlyPremium, payout: monthlyPremium * 12 * 20 };
  log(state, `Took out a life insurance policy: $${monthlyPremium.toLocaleString()}/month for a $${(monthlyPremium * 240).toLocaleString()} payout.`, 'money');
  return { ok: true, message: 'Life insurance policy active.' };
}

export function cancelLifeInsurance(state: GameState): ActionResult {
  const p = state.player;
  if (!p.lifeInsurance) return { ok: false, message: 'No active policy.' };
  p.lifeInsurance = null;
  return { ok: true, message: 'Life insurance cancelled.' };
}

// ---------------------------------------------------------------------------
// Politics
// ---------------------------------------------------------------------------

export function joinParty(state: GameState, partyId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const party = home.parties.find((x) => x.id === partyId);
  if (!party) return { ok: false, message: 'Party not found.' };
  p.partyId = partyId;
  p.influence = clamp100(p.influence + 2);
  log(state, `Joined the ${party.name}.`, 'politics');
  return { ok: true, message: `You are now a member of the ${party.name}.` };
}

export function leaveParty(state: GameState): ActionResult {
  const p = state.player;
  if (!p.partyId) return { ok: false, message: 'You are not in a party.' };
  p.partyId = null;
  return { ok: true, message: 'You left your party.' };
}

export function foundParty(state: GameState, name: string, ideology: number): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if (home.totalSeats === 0) return { ok: false, message: `${home.name} has no free legislature to contest.` };
  if (p.influence < 25) return { ok: false, message: 'Founding a party needs 25+ influence.' };
  if (p.money < 250_000) return { ok: false, message: 'Founding a party costs $250,000.' };
  const rng = withRng(state);
  p.money -= 250_000;
  const party = {
    id: `party_player_${state.year}`,
    name: name.trim() || makePartyName(rng),
    ideology: clamp(ideology, -100, 100),
    seats: 0,
    support: 5 + p.popularity * 0.1,
    leaderId: 'player',
    playerCreated: true,
  };
  home.parties.push(party);
  // Renormalize support.
  const total = home.parties.reduce((s, x) => s + x.support, 0);
  for (const x of home.parties) x.support = (x.support / total) * 100;
  p.partyId = party.id;
  commit(state, rng);
  if (!state.achievements.includes('founded_party')) state.achievements.push('founded_party');
  log(state, `🏛️ Founded the ${party.name} and became its leader.`, 'politics');
  return { ok: true, message: `The ${party.name} is born.` };
}

export function availableOffices(state: GameState) {
  return OFFICE_LADDER_WITH_ELIGIBILITY(state);
}
function OFFICE_LADDER_WITH_ELIGIBILITY(state: GameState) {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  return Object.values(OFFICE_SPEC_BY_KIND).map((spec) => {
    const elig = eligibleFor(state, spec);
    const region = spec.kind === 'mayor' || spec.kind === 'councillor'
      ? home.cities.find((c) => c.id === p.cityId)?.name ?? home.name
      : spec.kind === 'governor'
        ? home.states.find((s) => s.cityIds.includes(p.cityId))?.name ?? home.name
        : home.name;
    const cost = Math.round(spec.campaignCostBase * (1 + home.economy.gdp / 5000));
    return { spec, eligible: elig.ok, reason: elig.reason, region, cost };
  });
}

export function launchCampaign(state: GameState, officeKind: OfficeKind, warChest: number, promises: ManifestoPromise[] = []): ActionResult {
  const p = state.player;
  if (p.campaign) return { ok: false, message: 'You are already campaigning.' };
  const spec = OFFICE_SPEC_BY_KIND[officeKind];
  const elig = eligibleFor(state, spec);
  if (!elig.ok) return { ok: false, message: elig.reason };
  if (warChest > p.money) return { ok: false, message: 'You cannot fund that war chest.' };
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const region = spec.kind === 'mayor' || spec.kind === 'councillor'
    ? home.cities.find((c) => c.id === p.cityId)?.name ?? home.name
    : spec.kind === 'governor'
      ? home.states.find((s) => s.cityIds.includes(p.cityId))?.name ?? home.name
      : home.name;
  p.money -= warChest;
  p.campaign = {
    officeKind,
    regionName: region,
    warChest,
    momentum: 0,
    yearsToElection: officeKind === 'head_of_state' || officeKind === 'governor' ? 1 : 0,
    consultantHired: false,
    promises: promises.slice(0, 3),
  };
  log(state, `📣 Launched a campaign for ${spec.title} of ${region} with a $${warChest.toLocaleString()} war chest.`, 'politics');
  return { ok: true, message: `Campaign for ${spec.title} underway.` };
}

/** Discretionary campaign activities that spend money/PC for momentum. */
export function campaignAction(state: GameState, kind: 'ads' | 'rally' | 'doorknock' | 'fundraise' | 'consultant' | 'polling' | 'debate'): ActionResult {
  const p = state.player;
  if (!p.campaign) return { ok: false, message: 'No active campaign.' };
  const rng = withRng(state);
  const boost = p.campaign.consultantHired ? 1.25 : 1;
  let msg = '';
  switch (kind) {
    case 'ads': {
      const cost = 50_000;
      if (p.money < cost) return { ok: false, message: 'Not enough for an ad blitz.' };
      p.money -= cost;
      const gain = (3 + (p.skills['media_public_relations'] ?? 0) * 0.05 + rng.range(0, 3)) * boost;
      p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
      msg = `Ran attack ads. Momentum +${gain.toFixed(0)}.`;
      break;
    }
    case 'rally': {
      const gain = (2 + p.charisma * 0.05 + (p.skills['politics_public_speaking'] ?? 0) * 0.04 + rng.range(-1, 3)) * boost;
      p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
      p.health = clamp100(p.health - 1);
      msg = `Held a rally. Momentum +${gain.toFixed(0)}.`;
      break;
    }
    case 'doorknock': {
      const gain = (1.5 + (p.skills['politics_grassroots_organizing'] ?? 0) * 0.04 + rng.range(-0.5, 2)) * boost;
      p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
      p.popularity = clamp100(p.popularity + 0.5);
      msg = `Knocked on doors. Momentum +${gain.toFixed(1)}, popularity nudged up.`;
      break;
    }
    case 'fundraise': {
      const raised = 20_000 + p.influence * 4_000 + (p.skills['business_fundraising'] ?? 0) * 2_000 * rng.range(0.5, 1.5);
      p.campaign.warChest += raised;
      msg = `Fundraiser brought in $${Math.round(raised).toLocaleString()}.`;
      break;
    }
    case 'consultant': {
      const cost = 100_000;
      if (p.campaign.consultantHired) return { ok: false, message: 'You already have a campaign consultant.' };
      if (p.money < cost) return { ok: false, message: 'Cannot afford a top consultant ($100,000).' };
      p.money -= cost;
      p.campaign.consultantHired = true;
      msg = 'Hired a top campaign consultant. All future momentum gains +25%.';
      break;
    }
    case 'polling': {
      const cost = 15_000;
      if (p.money < cost) return { ok: false, message: 'Not enough for a polling firm.' };
      p.money -= cost;
      const chance = campaignWinChance(state, rng);
      msg = `Internal polling puts you at ${Math.round(chance * 100)}% to win.`;
      break;
    }
    case 'debate': {
      const skill = (p.skills[SK.debate] ?? 0) * 0.7 + p.charisma * 0.3;
      const chance = clamp(0.4 + skill * 0.004, 0.1, 0.85);
      const success = rng.chance(chance);
      const swing = (4 + rng.range(0, 4)) * boost;
      if (success) {
        p.campaign.momentum = clamp(p.campaign.momentum + swing, -50, 50);
        if (!state.achievements.includes('debate_winner')) state.achievements.push('debate_winner');
        commit(state, rng);
        return { ok: true, message: `You won the debate. Momentum +${swing.toFixed(0)}.` };
      }
      p.campaign.momentum = clamp(p.campaign.momentum - swing * 0.6, -50, 50);
      commit(state, rng);
      return { ok: false, message: `Your opponent won the exchange. Momentum -${(swing * 0.6).toFixed(0)}.` };
    }
  }
  commit(state, rng);
  return { ok: true, message: msg };
}

/** A stump-speech-adjacent action for anyone campaigning or in office; can backfire. */
export function holdPressConference(state: GameState): ActionResult {
  const p = state.player;
  if (!p.office && !p.campaign) return { ok: false, message: 'You need to hold office or be campaigning to call a press conference.' };
  const rng = withRng(state);
  const skill = (p.skills[SK.debate] ?? 0) * 0.5 + (p.skills['media_public_relations'] ?? 0) * 0.5;
  const chance = clamp(0.5 + skill * 0.004 + (p.charisma - 50) * 0.003, 0.15, 0.9);
  const success = rng.chance(chance);
  commit(state, rng);
  if (success) {
    const gain = rng.range(2, 5);
    p.popularity = clamp100(p.popularity + gain);
    if (p.campaign) p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
    log(state, '🎤 Your press conference landed well with the media.', 'politics');
    return { ok: true, message: 'Press conference was a hit.' };
  }
  const loss = rng.range(1, 4);
  p.popularity = clamp100(p.popularity - loss);
  if (p.campaign) p.campaign.momentum = clamp(p.campaign.momentum - loss, -50, 50);
  log(state, '📰 A reporter caught you off guard at your press conference.', 'bad');
  return { ok: false, message: 'The press conference went sideways.' };
}

export function proposedLaws(state: GameState) {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const canLegislate = home.leaderId === 'player' || p.office?.kind === 'minister' || p.office?.kind === 'legislator' || p.office?.kind === 'head_of_state';
  return Object.values(LAW_BY_ID).map((law) => {
    const inForce = home.lawsInForce.includes(law.id);
    const est = estimateLawVote(state, home, law);
    return { law, inForce, chance: est.chance, canLegislate };
  });
}

export function proposeLaw(state: GameState, lawId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const law = LAW_BY_ID[lawId];
  if (!law) return { ok: false, message: 'Unknown law.' };
  const isAutocrat = (home.system === 'dictatorship' || home.system === 'monarchy') && home.leaderId === 'player';
  const canLegislate = isAutocrat || home.leaderId === 'player' || p.office?.kind === 'minister' || p.office?.kind === 'legislator' || p.office?.kind === 'head_of_state';
  if (!canLegislate) return { ok: false, message: 'You need a seat in government to propose laws.' };
  if (home.lawsInForce.includes(lawId)) return { ok: false, message: 'Already in force.' };
  if (p.politicalCapital < 5) return { ok: false, message: 'Needs at least 5 political capital.' };
  const rng = withRng(state);
  p.politicalCapital = clamp(p.politicalCapital - 5, 0, 100);

  if (isAutocrat) {
    home.lawsInForce.push(lawId);
    home.approvalOfGovernment = clamp100(home.approvalOfGovernment + law.approvalImpact);
    commit(state, rng);
    log(state, `⚖️ You decreed the ${law.name}.`, 'politics');
    return { ok: true, message: `Decreed: ${law.name}.` };
  }

  const est = estimateLawVote(state, home, law);
  const passed = rng.chance(est.chance);
  commit(state, rng);
  if (passed) {
    home.lawsInForce.push(lawId);
    home.approvalOfGovernment = clamp100(home.approvalOfGovernment + law.approvalImpact);
    p.popularity = clamp100(p.popularity + law.approvalImpact * 0.4);
    p.influence = clamp100(p.influence + 2);
    log(state, `⚖️ Your ${law.name} passed the legislature (${est.supportSeats}/${est.totalSeats}).`, 'politics');
    return { ok: true, message: `${law.name} passed!` };
  }
  log(state, `Your ${law.name} was voted down (${est.supportSeats}/${est.totalSeats}).`, 'bad');
  return { ok: false, message: `${law.name} failed to pass.` };
}

export function repealLaw(state: GameState, lawId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const law = LAW_BY_ID[lawId];
  if (!law || !home.lawsInForce.includes(lawId)) return { ok: false, message: 'Law is not in force.' };
  if (!law.repealable) return { ok: false, message: 'This law cannot be repealed.' };
  const isAutocrat = (home.system === 'dictatorship' || home.system === 'monarchy') && home.leaderId === 'player';
  const canLegislate = isAutocrat || home.leaderId === 'player' || p.office?.kind === 'minister' || p.office?.kind === 'head_of_state';
  if (!canLegislate) return { ok: false, message: 'You lack the power to repeal laws.' };
  if (p.politicalCapital < 5) return { ok: false, message: 'Needs at least 5 political capital.' };
  p.politicalCapital = clamp(p.politicalCapital - 5, 0, 100);
  home.lawsInForce = home.lawsInForce.filter((id) => id !== lawId);
  log(state, `Repealed the ${law.name}.`, 'politics');
  return { ok: true, message: `${law.name} repealed.` };
}

/** NPC politicians in the player's home country, eligible for cabinet appointment. */
export function cabinetCandidates(state: GameState) {
  const p = state.player;
  return Object.values(state.npcs).filter((n) => n.alive && n.countryId === p.countryId && n.role === 'politician');
}

export function appointMinister(state: GameState, portfolio: CabinetPortfolio, npcId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if (home.leaderId !== 'player') return { ok: false, message: 'Only the head of state appoints ministers.' };
  if (!CABINET_PORTFOLIOS.includes(portfolio)) return { ok: false, message: 'Unknown portfolio.' };
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive) return { ok: false, message: 'Candidate unavailable.' };
  home.cabinet[portfolio] = npcId;
  log(state, `Appointed ${npc.name} as Minister for ${portfolio}.`, 'politics');
  return { ok: true, message: `${npc.name} appointed Minister for ${portfolio}.` };
}

export function dismissMinister(state: GameState, portfolio: CabinetPortfolio): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if (home.leaderId !== 'player') return { ok: false, message: 'Only the head of state reshuffles cabinet.' };
  if (!home.cabinet[portfolio]) return { ok: false, message: 'That portfolio is vacant.' };
  const name = state.npcs[home.cabinet[portfolio]]?.name ?? 'The minister';
  delete home.cabinet[portfolio];
  log(state, `${name} was dismissed from the cabinet.`, 'politics');
  return { ok: true, message: `${name} dismissed.` };
}

export function negotiateCoalition(state: GameState, partnerPartyId: string): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  if (home.totalSeats === 0) return { ok: false, message: 'No legislature to form a coalition in.' };
  if (!p.partyId) return { ok: false, message: 'Join or found a party first.' };
  const myParty = home.parties.find((x) => x.id === p.partyId);
  if (!myParty) return { ok: false, message: 'Party not found.' };
  if (myParty.seats / home.totalSeats >= 0.5) return { ok: false, message: 'Your party already holds a majority.' };
  const partner = home.parties.find((x) => x.id === partnerPartyId);
  if (!partner || partner.id === p.partyId) return { ok: false, message: 'Invalid coalition partner.' };
  if (p.politicalCapital < 10) return { ok: false, message: 'Needs at least 10 political capital.' };
  p.politicalCapital = clamp(p.politicalCapital - 10, 0, 100);
  home.coalitionPartnerId = partnerPartyId;
  if (!state.achievements.includes('coalition_builder')) state.achievements.push('coalition_builder');
  log(state, `🤝 Formed a governing coalition with the ${partner.name}.`, 'politics');
  return { ok: true, message: `Coalition formed with the ${partner.name}.` };
}

// ---------------------------------------------------------------------------
// Diplomacy — only actionable while the player leads their home country
// ---------------------------------------------------------------------------

function requireLeadership(state: GameState): { home: ReturnType<typeof homeOf>; error: ActionResult | null } {
  const home = homeOf(state);
  if (home.leaderId !== 'player') return { home, error: { ok: false, message: 'Only the head of state can conduct foreign policy.' } };
  return { home, error: null };
}
function homeOf(state: GameState) {
  return state.countries.find((c) => c.id === state.player.countryId)!;
}

export function declareWar(state: GameState, targetCountryId: string, strategy: 'blockade' | 'invasion' = 'invasion'): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  if (home.atWarWith.includes(target.id)) return { ok: false, message: `Already at war with ${target.name}.` };
  home.atWarWith.push(target.id);
  target.atWarWith.push(home.id);
  home.warStrategies[target.id] = strategy;
  home.relations[target.id] = -100;
  target.relations[home.id] = -100;
  home.stability = clamp(home.stability - (strategy === 'invasion' ? 8 : 3), 0, 100);
  if (!state.achievements.includes('diplomat')) state.achievements.push('diplomat');
  const label = strategy === 'blockade' ? 'an economic blockade' : 'a full invasion';
  log(state, `⚔️ You declared war on ${target.name} with ${label}.`, 'politics');
  return { ok: true, message: `War declared on ${target.name} (${strategy}).` };
}

export function signPeaceTreaty(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || !home.atWarWith.includes(target.id)) return { ok: false, message: 'You are not at war with that nation.' };
  home.atWarWith = home.atWarWith.filter((id) => id !== target.id);
  target.atWarWith = target.atWarWith.filter((id) => id !== home.id);
  delete home.warStrategies[target.id];
  home.relations[target.id] = -20;
  target.relations[home.id] = -20;
  home.stability = clamp(home.stability + 4, 0, 100);
  state.player.popularity = clamp100(state.player.popularity + 5);
  if (!state.achievements.includes('diplomat')) state.achievements.push('diplomat');
  log(state, `🕊️ You signed a peace treaty with ${target.name}.`, 'politics');
  return { ok: true, message: `Peace signed with ${target.name}.` };
}

export function imposeSanctions(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  if (home.sanctionsOn.includes(target.id)) return { ok: false, message: `Already sanctioning ${target.name}.` };
  home.sanctionsOn.push(target.id);
  home.relations[target.id] = clamp((home.relations[target.id] ?? 0) - 30, -100, 100);
  target.economy.businessConfidence = clamp100(target.economy.businessConfidence - 6);
  log(state, `🚫 You imposed sanctions on ${target.name}.`, 'politics');
  return { ok: true, message: `Sanctions imposed on ${target.name}.` };
}

export function liftSanctions(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (!home.sanctionsOn.includes(targetCountryId)) return { ok: false, message: 'No sanctions in place on that nation.' };
  home.sanctionsOn = home.sanctionsOn.filter((id) => id !== targetCountryId);
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (target) home.relations[target.id] = clamp((home.relations[target.id] ?? 0) + 15, -100, 100);
  log(state, `Sanctions on ${target?.name ?? 'the nation'} were lifted.`, 'politics');
  return { ok: true, message: 'Sanctions lifted.' };
}

export function sendForeignAid(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const p = state.player;
  if (p.politicalCapital < 10) return { ok: false, message: 'Needs at least 10 political capital.' };
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  p.politicalCapital = clamp(p.politicalCapital - 10, 0, 100);
  home.economy.budgetBalance = clamp(home.economy.budgetBalance - 0.002, -0.2, 0.1);
  home.relations[target.id] = clamp((home.relations[target.id] ?? 0) + 15, -100, 100);
  target.relations[home.id] = clamp((target.relations[home.id] ?? 0) + 20, -100, 100);
  target.economy.consumerConfidence = clamp100(target.economy.consumerConfidence + 3);
  if (!state.achievements.includes('diplomat')) state.achievements.push('diplomat');
  log(state, `🤲 You sent foreign aid to ${target.name}.`, 'politics');
  return { ok: true, message: `Aid sent to ${target.name}.` };
}

export function signTradeAgreement(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const p = state.player;
  if (p.politicalCapital < 10) return { ok: false, message: 'Needs at least 10 political capital.' };
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  p.politicalCapital = clamp(p.politicalCapital - 10, 0, 100);
  home.relations[target.id] = clamp((home.relations[target.id] ?? 0) + 20, -100, 100);
  target.relations[home.id] = clamp((target.relations[home.id] ?? 0) + 20, -100, 100);
  home.economy.businessConfidence = clamp100(home.economy.businessConfidence + 3);
  target.economy.businessConfidence = clamp100(target.economy.businessConfidence + 3);
  if (!state.achievements.includes('diplomat')) state.achievements.push('diplomat');
  log(state, `🤝 You signed a trade agreement with ${target.name}.`, 'politics');
  return { ok: true, message: `Trade agreement signed with ${target.name}.` };
}

// ---------------------------------------------------------------------------
// Government & economy tools — head-of-state powers
// ---------------------------------------------------------------------------

export function setBudgetAllocation(state: GameState, portfolio: CabinetPortfolio, sharePct: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = clamp(sharePct, 2, 60);
  const others = CABINET_PORTFOLIOS.filter((p) => p !== portfolio);
  const otherTotal = others.reduce((s, p) => s + home.budgetAllocations[p], 0);
  const remaining = 100 - target;
  home.budgetAllocations[portfolio] = target;
  if (otherTotal > 0) {
    for (const p of others) home.budgetAllocations[p] = (home.budgetAllocations[p] / otherTotal) * remaining;
  }
  log(state, `Adjusted the ${portfolio} budget allocation to ${target.toFixed(1)}%.`, 'politics');
  return { ok: true, message: `${portfolio} now receives ${target.toFixed(1)}% of the budget.` };
}

export function setTaxRate(state: GameState, tax: keyof TaxRates, ratePct: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const rate = clamp(ratePct / 100, 0, 0.7);
  const current = home.economy.taxRates[tax];
  const existingAdj = home.taxAdjustments[tax] ?? 0;
  home.taxAdjustments[tax] = clamp(existingAdj + (rate - current), -0.35, 0.35);
  log(state, `Set the direct ${tax} tax rate target to ${Math.round(rate * 100)}%.`, 'politics');
  return { ok: true, message: `${tax} tax rate target set to ${Math.round(rate * 100)}%.` };
}

export function setImmigrationQuota(state: GameState, quotaPct: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  home.immigrationQuota = clamp(quotaPct, 0, 100);
  log(state, `Set the national immigration quota to ${Math.round(home.immigrationQuota)}%.`, 'politics');
  return { ok: true, message: `Immigration quota set to ${Math.round(home.immigrationQuota)}%.` };
}

const INFRA_SPECS: Record<InfrastructureKind, { capitalCost: number; budgetHit: number; years: number }> = {
  roads: { capitalCost: 15, budgetHit: 0.01, years: 2 },
  rail: { capitalCost: 20, budgetHit: 0.015, years: 3 },
  airport: { capitalCost: 25, budgetHit: 0.02, years: 3 },
  power: { capitalCost: 18, budgetHit: 0.012, years: 2 },
  internet: { capitalCost: 15, budgetHit: 0.01, years: 2 },
  space_program: { capitalCost: 60, budgetHit: 0.05, years: 8 },
};

export function launchInfrastructureProject(state: GameState, kind: InfrastructureKind): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (home.infrastructureProjects.some((p) => p.kind === kind)) return { ok: false, message: `A ${kind} project is already underway.` };
  const spec = INFRA_SPECS[kind];
  const p = state.player;
  if (p.politicalCapital < spec.capitalCost) return { ok: false, message: `Needs ${spec.capitalCost} political capital.` };
  p.politicalCapital = clamp(p.politicalCapital - spec.capitalCost, 0, 100);
  home.economy.budgetBalance = clamp(home.economy.budgetBalance - spec.budgetHit, -0.2, 0.1);
  home.infrastructureProjects.push({ id: `infra-${home.id}-${kind}-${state.year}`, kind, yearsLeft: spec.years, totalYears: spec.years });
  log(state, `🏗️ ${home.name} broke ground on a new ${kind} project.`, 'politics');
  return { ok: true, message: `${kind} project underway, ${spec.years} year(s) to completion.` };
}

const ADVISOR_COST = 50_000;

export function hireAdvisor(state: GameState, specialty: AdvisorSpecialty): ActionResult {
  const p = state.player;
  if (p.advisors.length >= 3) return { ok: false, message: 'You already have 3 advisors.' };
  if (p.advisors.some((a) => a.specialty === specialty)) return { ok: false, message: `Already have a ${specialty} advisor.` };
  if (p.money < ADVISOR_COST) return { ok: false, message: `Needs $${ADVISOR_COST.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= ADVISOR_COST;
  const accuracy = rng.range(45, 90);
  p.advisors.push({ specialty, accuracy });
  if (p.advisors.length >= 3 && !state.achievements.includes('advisor_team')) state.achievements.push('advisor_team');
  commit(state, rng);
  log(state, `Hired a ${specialty} advisor.`, 'politics');
  return { ok: true, message: `Advisor hired (self-reported ${Math.round(accuracy)}% reliable — take it with a grain of salt).` };
}

export function dismissAdvisor(state: GameState, specialty: AdvisorSpecialty): ActionResult {
  const p = state.player;
  if (!p.advisors.some((a) => a.specialty === specialty)) return { ok: false, message: 'No such advisor.' };
  p.advisors = p.advisors.filter((a) => a.specialty !== specialty);
  return { ok: true, message: 'Advisor dismissed.' };
}

/** A pure, non-mutating recommendation string — deliberately can be wrong, scaled by the advisor's accuracy. */
export function advisorRecommendation(state: GameState, advisor: Advisor): string {
  const home = state.countries.find((c) => c.id === state.player.countryId);
  if (!home) return 'No data available.';
  const roll = (state.year * 7 + Math.round(advisor.accuracy) * 3) % 100;
  const isGood = roll < advisor.accuracy;
  if (advisor.specialty === 'economy') {
    const overheating = home.economy.inflation > 0.045;
    const trueAdvice = overheating
      ? 'Inflation is running hot — raise taxes or trim spending to cool demand.'
      : 'Growth looks fragile — cut taxes or fund infrastructure to stimulate demand.';
    const falseAdvice = overheating
      ? 'Cut taxes now to keep growth strong.'
      : 'Raise taxes — the economy is overheating.';
    return isGood ? trueAdvice : falseAdvice;
  }
  if (advisor.specialty === 'military') {
    const atWar = home.atWarWith.length > 0;
    const trueAdvice = atWar
      ? 'Seek a peace treaty — prolonged war is eroding stability.'
      : 'Military spending looks adequate — hold steady.';
    const falseAdvice = atWar ? 'Escalate the conflict — victory is within reach.' : 'Boost defense spending — a threat looms.';
    return isGood ? trueAdvice : falseAdvice;
  }
  const isolated = Object.values(home.relations).every((r) => r < 10);
  const trueAdvice = isolated
    ? 'Relations are cold across the board — a trade agreement could thaw things.'
    : 'Diplomatic standing looks solid — maintain current relationships.';
  const falseAdvice = isolated ? 'Consider sanctions to project strength.' : 'Relations are fraying — brace for conflict.';
  return isGood ? trueAdvice : falseAdvice;
}

export function fundIntelligenceAgency(state: GameState, amount: number): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (amount <= 0 || amount > state.player.money) return { ok: false, message: 'Invalid funding amount.' };
  state.player.money -= amount;
  home.intelCapability = clamp100(home.intelCapability + amount / 50_000);
  log(state, `Invested $${amount.toLocaleString()} in the national intelligence agency.`, 'politics');
  return { ok: true, message: `Intelligence capability now ${Math.round(home.intelCapability)}.` };
}

export function gatherIntelligence(state: GameState, targetCountryId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const target = state.countries.find((c) => c.id === targetCountryId);
  if (!target || target.id === home.id) return { ok: false, message: 'Invalid target nation.' };
  const rng = withRng(state);
  const chance = clamp(0.3 + home.intelCapability / 200 - target.intelCapability / 300, 0.1, 0.9);
  const success = rng.chance(chance);
  commit(state, rng);
  if (success) {
    home.relations[target.id] = clamp((home.relations[target.id] ?? 0) + 5, -100, 100);
    state.player.influence = clamp100(state.player.influence + 3);
    if (!state.achievements.includes('intel_operative')) state.achievements.push('intel_operative');
    log(state, `🕵️ Intelligence gathered on ${target.name} strengthened your negotiating position.`, 'politics');
    return { ok: true, message: `Intelligence operation against ${target.name} succeeded.` };
  }
  home.relations[target.id] = clamp((home.relations[target.id] ?? 0) - 10, -100, 100);
  log(state, `🚨 An intelligence operation against ${target.name} was exposed.`, 'bad');
  return { ok: false, message: `The operation against ${target.name} was exposed.` };
}

export function counterEspionage(state: GameState): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const cost = 20_000;
  if (state.player.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  state.player.money -= cost;
  home.stability = clamp100(home.stability + 3);
  home.intelCapability = clamp100(home.intelCapability + 5);
  log(state, `Counter-espionage sweep strengthened national security.`, 'politics');
  return { ok: true, message: 'Counter-espionage operation complete.' };
}

export function nominateChiefJustice(state: GameState, npcId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive || npc.countryId !== home.id) return { ok: false, message: 'Invalid nominee.' };
  home.chiefJusticeId = npcId;
  home.judicialIntegrity = clamp100(home.judicialIntegrity * 0.4 + npc.integrity * 0.6);
  log(state, `${npc.name} was confirmed as Chief Justice of ${home.name}.`, 'politics');
  return { ok: true, message: `${npc.name} confirmed as Chief Justice.` };
}

export function callReferendum(state: GameState, lawId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  const p = state.player;
  const law = LAW_BY_ID[lawId];
  if (!law) return { ok: false, message: 'Unknown law.' };
  if (home.lawsInForce.includes(law.id)) return { ok: false, message: `${law.name} is already in force.` };
  if (p.politicalCapital < 15) return { ok: false, message: 'Needs at least 15 political capital.' };
  p.politicalCapital = clamp(p.politicalCapital - 15, 0, 100);
  const legislatureEst = estimateLawVote(state, home, law);
  const chance = clamp((legislatureEst.chance + home.approvalOfGovernment / 100) / 2, 0.05, 0.95);
  const rng = withRng(state);
  const passed = rng.chance(chance);
  commit(state, rng);
  if (passed) {
    home.lawsInForce.push(law.id);
    log(state, `🗳️ The referendum on the ${law.name} passed.`, 'politics');
    return { ok: true, message: `Referendum passed: ${law.name} is now in force.` };
  }
  state.player.popularity = clamp100(state.player.popularity - 2);
  log(state, `🗳️ The referendum on the ${law.name} failed at the ballot box.`, 'bad');
  return { ok: false, message: `Referendum failed: ${law.name} was rejected.` };
}

export function hireLobbyingFirm(state: GameState): ActionResult {
  const p = state.player;
  if (p.lobbyingFirmHired) return { ok: false, message: 'You already retain a lobbying firm.' };
  const cost = 75_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  p.lobbyingFirmHired = true;
  log(state, `Retained a lobbying firm ($25k/yr upkeep) to sway legislative votes.`, 'politics');
  return { ok: true, message: 'Lobbying firm retained.' };
}

export function cancelLobbyingFirm(state: GameState): ActionResult {
  const p = state.player;
  if (!p.lobbyingFirmHired) return { ok: false, message: 'No lobbying firm retained.' };
  p.lobbyingFirmHired = false;
  log(state, `Cancelled the lobbying firm retainer.`, 'politics');
  return { ok: true, message: 'Lobbying firm retainer cancelled.' };
}

export function foundAlliance(state: GameState, name: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (home.allianceId) return { ok: false, message: `${home.name} already belongs to an alliance.` };
  const id = `alliance_${state.year}_${state.alliances.length + 1}`;
  state.alliances.push({ id, name: name.trim() || `${home.name} Pact`, founderCountryId: home.id, memberCountryIds: [home.id] });
  home.allianceId = id;
  log(state, `${home.name} founded the ${name || `${home.name} Pact`} alliance.`, 'politics');
  return { ok: true, message: 'Alliance founded.' };
}

export function joinAlliance(state: GameState, allianceId: string): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (home.allianceId) return { ok: false, message: `${home.name} already belongs to an alliance.` };
  const alliance = state.alliances.find((a) => a.id === allianceId);
  if (!alliance) return { ok: false, message: 'Alliance not found.' };
  alliance.memberCountryIds.push(home.id);
  home.allianceId = alliance.id;
  for (const memberId of alliance.memberCountryIds) {
    if (memberId === home.id) continue;
    const member = state.countries.find((c) => c.id === memberId);
    if (member) {
      home.relations[member.id] = clamp((home.relations[member.id] ?? 0) + 25, -100, 100);
      member.relations[home.id] = clamp((member.relations[home.id] ?? 0) + 25, -100, 100);
    }
  }
  log(state, `${home.name} joined the ${alliance.name} alliance.`, 'politics');
  return { ok: true, message: `Joined ${alliance.name}.` };
}

export function leaveAlliance(state: GameState): ActionResult {
  const { home, error } = requireLeadership(state);
  if (error) return error;
  if (!home.allianceId) return { ok: false, message: 'Not in an alliance.' };
  const alliance = state.alliances.find((a) => a.id === home.allianceId);
  if (alliance) alliance.memberCountryIds = alliance.memberCountryIds.filter((id) => id !== home.id);
  home.allianceId = null;
  log(state, `${home.name} withdrew from its alliance.`, 'politics');
  return { ok: true, message: 'Left the alliance.' };
}

// ---------------------------------------------------------------------------
// Crime & the underworld
// ---------------------------------------------------------------------------

export const CRIME_RANK_TITLES = ['', 'Associate', 'Soldier', 'Capo', 'Underboss', 'Boss'];

export function joinCrimeFamily(state: GameState): ActionResult {
  const p = state.player;
  if (p.crimeFamilyId) return { ok: false, message: 'You are already in the family.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const rng = withRng(state);
  const candidates = Object.values(state.npcs).filter((n) => n.alive && n.countryId === p.countryId && n.role === 'criminal');
  const boss = candidates.length ? rng.pick(candidates) : null;
  p.crimeFamilyId = boss?.id ?? 'unknown_boss';
  p.crimeRank = 1;
  p.notoriety = clamp100(p.notoriety + 10);
  p.karma = clamp100(p.karma - 10);
  commit(state, rng);
  log(state, `🕶️ You were initiated into ${boss?.name ?? 'a criminal organization'}'s family as an Associate.`, 'bad');
  return { ok: true, message: `Welcome to the family, Associate.` };
}

export function heist(state: GameState): ActionResult {
  const p = state.player;
  if (!p.crimeFamilyId) return { ok: false, message: 'You need to be in the family first.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const rng = withRng(state);
  const skill = (p.skills[SK.streetSmarts] ?? 0) * 0.6 + (p.skills[SK.evasion] ?? 0) * 0.4;
  const chance = clamp(0.4 + skill * 0.004 + p.crimeRank * 0.03, 0.1, 0.85);
  const success = rng.chance(chance);
  if (success) {
    const take = rng.range(20_000, 60_000) * p.crimeRank * (1 + p.turfControl / 200);
    p.dirtyMoney += take;
    p.notoriety = clamp100(p.notoriety + 5);
    if (p.crimeRank < 5 && rng.chance(0.25)) {
      p.crimeRank++;
      if (p.crimeRank === 5 && !state.achievements.includes('crime_boss')) state.achievements.push('crime_boss');
      log(state, `You were promoted to ${CRIME_RANK_TITLES[p.crimeRank]}.`, 'bad');
    }
    commit(state, rng);
    log(state, `💰 The heist paid off: $${Math.round(take).toLocaleString()}.`, 'money');
    return { ok: true, message: `Scored $${Math.round(take).toLocaleString()}.` };
  }
  const jailYears = rng.int(1, 3);
  p.criminalRecord++;
  p.inJailYears += jailYears;
  p.job = null;
  p.campaign = null;
  p.office = null;
  p.reputation = clamp100(p.reputation - 15);
  commit(state, rng);
  log(state, `🚨 The heist went wrong. You were caught and sentenced to ${jailYears} years.`, 'bad');
  return { ok: false, message: `Caught! ${jailYears} years in prison.` };
}

export function protectionRacket(state: GameState, targetCompanyId: string): ActionResult {
  const p = state.player;
  if (!p.crimeFamilyId) return { ok: false, message: 'You need to be in the family first.' };
  const target = state.companies[targetCompanyId];
  if (!target || target.status !== 'active' || target.playerOwned) return { ok: false, message: 'Invalid target.' };
  const rng = withRng(state);
  const take = Math.min(target.cash, target.revenue * 0.05 * p.crimeRank);
  if (take < 1000) return { ok: false, message: 'That business has nothing worth taking.' };
  const chance = clamp(0.7 + (p.skills[SK.bribery] ?? 0) * 0.002, 0.3, 0.9);
  if (rng.chance(chance)) {
    target.cash -= take;
    p.dirtyMoney += take * (1 + p.turfControl / 200);
    p.notoriety = clamp100(p.notoriety + 3);
    commit(state, rng);
    log(state, `Shook down ${target.name} for $${Math.round(take).toLocaleString()}.`, 'bad');
    return { ok: true, message: `Collected $${Math.round(take).toLocaleString()}.` };
  }
  p.reputation = clamp100(p.reputation - 5);
  p.notoriety = clamp100(p.notoriety + 6);
  commit(state, rng);
  log(state, `${target.name} refused to pay and reported you.`, 'bad');
  return { ok: false, message: 'They refused and reported you.' };
}

export function bribeJudge(state: GameState): ActionResult {
  const p = state.player;
  if (p.inJailYears <= 0) return { ok: false, message: 'You are not currently facing a sentence.' };
  const cost = 40_000 + p.inJailYears * 15_000;
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  const rng = withRng(state);
  p.money -= cost;
  const chance = clamp(0.4 + (p.skills[SK.bribery] ?? 0) * 0.005, 0.1, 0.8);
  if (rng.chance(chance)) {
    const reduction = Math.min(p.inJailYears, rng.int(1, 3));
    p.inJailYears -= reduction;
    commit(state, rng);
    log(state, `A judge was persuaded to cut ${reduction} year(s) from your sentence.`, 'bad');
    return { ok: true, message: `Sentence reduced by ${reduction} year(s).` };
  }
  p.inJailYears += 1;
  p.notoriety = clamp100(p.notoriety + 5);
  commit(state, rng);
  log(state, `The bribery attempt was discovered — a year was added to your sentence.`, 'bad');
  return { ok: false, message: 'Caught bribing the judge. +1 year.' };
}

export function attemptPrisonEscape(state: GameState): ActionResult {
  const p = state.player;
  if (p.inJailYears <= 0) return { ok: false, message: 'You are not in prison.' };
  const rng = withRng(state);
  const chance = clamp(0.15 + (p.skills[SK.streetSmarts] ?? 0) * 0.003, 0.05, 0.5);
  if (rng.chance(chance)) {
    p.inJailYears = 0;
    p.notoriety = clamp100(p.notoriety + 20);
    commit(state, rng);
    log(state, `🏃 You escaped from prison! You're now a fugitive with a much higher profile.`, 'bad');
    return { ok: true, message: 'You escaped!' };
  }
  p.inJailYears += 2;
  commit(state, rng);
  log(state, `Your escape attempt failed. Two years were added to your sentence.`, 'bad');
  return { ok: false, message: 'Escape failed. +2 years.' };
}

export function goStraight(state: GameState): ActionResult {
  const p = state.player;
  if (!p.crimeFamilyId) return { ok: false, message: 'You are not in the family.' };
  const cost = 50_000 * p.crimeRank;
  if (cost > p.money) return { ok: false, message: `The family wants $${cost.toLocaleString()} to let you walk.` };
  p.money -= cost;
  p.crimeFamilyId = null;
  p.crimeRank = 0;
  p.turfControl = 0;
  p.notoriety = clamp100(p.notoriety - 15);
  p.karma = clamp100(p.karma + 10);
  log(state, `You paid your way out of the family and went straight.`, 'good');
  return { ok: true, message: 'You left the criminal underworld behind.' };
}

export function launderMoney(state: GameState, companyId: string, amount: number): ActionResult {
  const p = state.player;
  const c = state.companies[companyId];
  if (!c || !c.playerOwned || c.status !== 'active') return { ok: false, message: 'You need an active front business.' };
  if (amount <= 0 || amount > p.dirtyMoney) return { ok: false, message: 'Not enough dirty money.' };
  const rng = withRng(state);
  const skill = p.skills[SK.moneyLaundering] ?? 0;
  const cut = clamp(0.35 - c.brand / 500 - skill * 0.001, 0.1, 0.35);
  const clean = amount * (1 - cut);
  const caught = rng.chance(clamp(0.08 - c.brand * 0.0003 - skill * 0.0004, 0.01, 0.08));
  p.dirtyMoney -= amount;
  commit(state, rng);
  if (caught) {
    c.lawsuits++;
    p.notoriety = clamp100(p.notoriety + 15);
    p.criminalRecord++;
    log(state, `🚨 A laundering operation through ${c.name} was flagged by regulators.`, 'bad');
    return { ok: false, message: `The operation was flagged. Dirty money lost, and ${c.name} faces scrutiny.` };
  }
  p.money += clean;
  log(state, `Laundered $${Math.round(amount).toLocaleString()} through ${c.name} (${Math.round(cut * 100)}% cut).`, 'bad');
  return { ok: true, message: `Cleaned $${Math.round(clean).toLocaleString()}.` };
}

export function contestTerritory(state: GameState): ActionResult {
  const p = state.player;
  if (!p.crimeFamilyId) return { ok: false, message: 'You need to be in the family first.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  if (p.turfControl >= 100) return { ok: false, message: 'You already control all the turf worth having.' };
  const rng = withRng(state);
  const skill = (p.skills[SK.streetSmarts] ?? 0) * 0.6 + (p.skills[SK.bribery] ?? 0) * 0.4;
  const chance = clamp(0.35 + skill * 0.004 + p.crimeRank * 0.05, 0.15, 0.85);
  const success = rng.chance(chance);
  if (success) {
    const gain = rng.range(8, 18);
    p.turfControl = clamp100(p.turfControl + gain);
    p.notoriety = clamp100(p.notoriety + 4);
    commit(state, rng);
    log(state, `Your family expanded its turf. Territory control now ${Math.round(p.turfControl)}.`, 'bad');
    return { ok: true, message: `Turf control +${gain.toFixed(0)}.` };
  }
  const loss = rng.range(5, 12);
  p.turfControl = clamp100(p.turfControl - loss);
  p.health = clamp100(p.health - rng.range(5, 15));
  commit(state, rng);
  log(state, `A rival crew pushed back hard on your turf grab.`, 'bad');
  return { ok: false, message: 'The turf war went badly. You took losses.' };
}

export function enterWitnessProtection(state: GameState): ActionResult {
  const p = state.player;
  if (p.crimeFamilyId) return { ok: false, message: 'Go straight first — you cannot enter protection while still in the family.' };
  if (p.inWitnessProtection) return { ok: false, message: 'Already in witness protection.' };
  const cost = 100_000;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  p.criminalRecord = 0;
  p.notoriety = 0;
  p.turfControl = 0;
  p.inWitnessProtection = true;
  p.reputation = clamp(p.reputation - 10, 0, 100);
  if (p.rivalId) p.rivalId = null;
  p.happiness = clamp100(p.happiness - 8);
  log(state, `You entered witness protection, wiping your criminal record at the cost of your old life.`, 'good');
  return { ok: true, message: 'Your criminal record and notoriety were wiped clean.' };
}

// ---------------------------------------------------------------------------
// Lifestyle / misc
// ---------------------------------------------------------------------------

export type ActivityKind =
  | 'vacation' | 'gym' | 'doctor' | 'charity' | 'party' | 'meditate'
  | 'book_club' | 'therapy' | 'adopt_pet' | 'learn_instrument' | 'road_trip'
  | 'art_collecting' | 'wine_tasting' | 'poker_night' | 'volunteer' | 'seminar'
  | 'spa_day' | 'home_improvement' | 'blog' | 'learn_language';

export function doActivity(state: GameState, kind: ActivityKind): ActionResult {
  const p = state.player;
  const rng = withRng(state);
  let msg = '';
  switch (kind) {
    case 'vacation': {
      const cost = Math.max(2_000, p.money * 0.02);
      if (cost > p.money) return { ok: false, message: 'Too broke to travel.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 10);
      p.health = clamp100(p.health + 3);
      msg = 'You took a rejuvenating vacation.';
      break;
    }
    case 'gym': {
      p.money -= 1_200;
      p.health = clamp100(p.health + 6);
      p.skills['lifestyle_fitness'] = clamp100((p.skills['lifestyle_fitness'] ?? 0) + 6);
      msg = 'A year of training. Health improved.';
      break;
    }
    case 'doctor': {
      const cost = 3_000;
      p.money -= cost;
      p.health = clamp100(p.health + 10);
      msg = 'Comprehensive medical care restored your health.';
      break;
    }
    case 'charity': {
      const amt = Math.max(1_000, p.money * 0.05);
      if (amt > p.money) return { ok: false, message: 'Nothing to give.' };
      p.money -= amt;
      p.karma = clamp100(p.karma + 8);
      p.reputation = clamp100(p.reputation + 2);
      p.popularity = clamp100(p.popularity + 1);
      if (!state.achievements.includes('philanthropist')) state.achievements.push('philanthropist');
      msg = `Donated $${Math.round(amt).toLocaleString()} to charity.`;
      break;
    }
    case 'party': {
      p.money -= 5_000;
      p.happiness = clamp100(p.happiness + 6);
      p.charisma = clamp100(p.charisma + 1);
      p.health = clamp100(p.health - 2);
      if (rng.chance(0.2)) { p.influence = clamp100(p.influence + 2); msg = 'You threw a lavish party and made powerful new friends.'; }
      else msg = 'A great party — you needed that.';
      break;
    }
    case 'meditate': {
      p.happiness = clamp100(p.happiness + 4);
      p.health = clamp100(p.health + 2);
      p.smarts = clamp100(p.smarts + 1);
      msg = 'A calmer, sharper mind.';
      break;
    }
    case 'book_club': {
      p.money -= 200;
      p.smarts = clamp100(p.smarts + 2);
      p.happiness = clamp100(p.happiness + 2);
      p.skills[SK.foreignLanguages] = clamp100((p.skills[SK.foreignLanguages] ?? 0) + 1);
      msg = 'A lively book club discussion sharpened your mind.';
      break;
    }
    case 'therapy': {
      const cost = 4_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford therapy sessions.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 8);
      p.health = clamp100(p.health + 3);
      msg = 'A year of therapy left you feeling lighter and clearer-headed.';
      break;
    }
    case 'adopt_pet': {
      const cost = 500;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the adoption fee.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 8);
      p.karma = clamp100(p.karma + 2);
      msg = 'You adopted a pet. Life is better with a companion around.';
      break;
    }
    case 'learn_instrument': {
      p.money -= 600;
      p.happiness = clamp100(p.happiness + 3);
      p.charisma = clamp100(p.charisma + 1);
      msg = 'You picked up a new instrument. Progress is slow but satisfying.';
      break;
    }
    case 'road_trip': {
      const cost = 2_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the trip.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 7);
      p.health = clamp100(p.health + 1);
      msg = 'An open-road trip cleared your head.';
      break;
    }
    case 'art_collecting': {
      const cost = 5_000;
      if (cost > p.money) return { ok: false, message: 'Not enough to collect art seriously.' };
      p.money -= cost;
      p.skills[SK.artCollecting] = clamp100((p.skills[SK.artCollecting] ?? 0) + 10);
      p.happiness = clamp100(p.happiness + 3);
      p.reputation = clamp100(p.reputation + 1);
      msg = 'You added a striking new piece to your collection.';
      break;
    }
    case 'wine_tasting': {
      const cost = 300;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the tasting.' };
      p.money -= cost;
      p.skills[SK.wineTasting] = clamp100((p.skills[SK.wineTasting] ?? 0) + 8);
      p.happiness = clamp100(p.happiness + 3);
      msg = 'An evening of wine tasting refined your palate.';
      break;
    }
    case 'poker_night': {
      const buyIn = 500;
      if (buyIn > p.money) return { ok: false, message: 'Cannot afford to buy in.' };
      p.money -= buyIn;
      p.skills[SK.poker] = clamp100((p.skills[SK.poker] ?? 0) + 10);
      const skillLvl = p.skills[SK.poker] ?? 0;
      if (rng.chance(0.35 + skillLvl * 0.003)) {
        const winnings = buyIn * rng.range(1.5, 4);
        p.money += winnings;
        p.happiness = clamp100(p.happiness + 4);
        msg = `Poker night paid off — you won $${Math.round(winnings).toLocaleString()}.`;
      } else {
        p.happiness = clamp100(p.happiness - 1);
        msg = 'Poker night was rough. You lost your buy-in.';
      }
      break;
    }
    case 'volunteer': {
      p.karma = clamp100(p.karma + 6);
      p.reputation = clamp100(p.reputation + 1);
      p.happiness = clamp100(p.happiness + 3);
      msg = 'A year of volunteering left the community — and you — better off.';
      break;
    }
    case 'seminar': {
      const cost = 800;
      if (cost > p.money) return { ok: false, message: 'Cannot afford the seminar.' };
      p.money -= cost;
      p.smarts = clamp100(p.smarts + 2);
      p.skills[SK.economics] = clamp100((p.skills[SK.economics] ?? 0) + 8);
      msg = 'A professional seminar expanded your thinking.';
      break;
    }
    case 'spa_day': {
      const cost = 400;
      if (cost > p.money) return { ok: false, message: 'Cannot afford a spa day.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 6);
      p.health = clamp100(p.health + 3);
      msg = 'A relaxing spa day recharged you.';
      break;
    }
    case 'home_improvement': {
      const cost = 3_000;
      if (cost > p.money) return { ok: false, message: 'Cannot afford renovations.' };
      p.money -= cost;
      p.happiness = clamp100(p.happiness + 3);
      if (p.properties.length > 0) {
        p.properties[0].value *= 1.03;
        msg = `Renovations boosted the value of ${p.properties[0].name}.`;
      } else {
        msg = 'You spruced up your living space.';
      }
      break;
    }
    case 'blog': {
      p.skills[SK.writing] = clamp100((p.skills[SK.writing] ?? 0) + 8);
      p.happiness = clamp100(p.happiness + 2);
      if (rng.chance(0.15)) {
        const earnings = rng.range(500, 5_000);
        p.money += earnings;
        p.reputation = clamp100(p.reputation + 2);
        msg = `Your blog found an audience — it earned $${Math.round(earnings).toLocaleString()} in ad revenue.`;
      } else {
        msg = 'You kept up your blog this year. A modest but loyal readership.';
      }
      break;
    }
    case 'learn_language': {
      const cost = 600;
      if (cost > p.money) return { ok: false, message: 'Cannot afford language lessons.' };
      p.money -= cost;
      p.skills[SK.foreignLanguages] = clamp100((p.skills[SK.foreignLanguages] ?? 0) + 10);
      p.smarts = clamp100(p.smarts + 1);
      msg = 'You made real progress learning a new language.';
      break;
    }
  }
  commit(state, rng);
  return { ok: true, message: msg };
}

export function takeLoan(state: GameState, amount: number, years: number): ActionResult {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const netWorthGuess = p.money + p.properties.reduce((s, x) => s + x.value - x.mortgage, 0);
  if (amount > Math.max(50_000, netWorthGuess * 2 + 100_000)) return { ok: false, message: 'The bank rejected the loan as too large.' };
  const rate = home.economy.interestRate + 0.04 + (p.criminalRecord > 0 ? 0.03 : 0);
  p.loans.push({ id: `loan_${state.year}_${p.loans.length}`, principal: amount, rate, yearsLeft: years, purpose: 'Personal loan' });
  p.money += amount;
  log(state, `Took a $${amount.toLocaleString()} loan at ${(rate * 100).toFixed(1)}% over ${years} years.`, 'money');
  return { ok: true, message: `Loan approved at ${(rate * 100).toFixed(1)}%.` };
}

export const NEW_GAME_GENDERS: Gender[] = ['male', 'female'];
