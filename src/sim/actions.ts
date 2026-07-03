/**
 * Player actions: the verbs the UI invokes between years. Each mutates the
 * game state and returns a short result message. They validate affordability
 * and eligibility so the UI can surface clean errors. RNG-consuming actions
 * advance the persisted stream so outcomes stay deterministic on replay.
 */
import type { GameState, Gender, OfficeKind, PropertyAsset } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { INDUSTRY_BY_ID, INDUSTRIES } from '../data/industries';
import { LAW_BY_ID } from '../data/laws';
import { makeCompanyName, makePartyName } from '../data/names';
import { createCompany, nextCompanyId, companyValuation } from './business';
import { doIPO } from './market';
import { OFFICE_SPEC_BY_KIND, eligibleFor, estimateLawVote } from './politics';
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

export type CompanyLever = 'marketingPct' | 'rdPct' | 'priceLevel' | 'salaryLevel' | 'dividendPayoutPct' | 'automation';

export function setCompanyLever(state: GameState, companyId: string, lever: CompanyLever, value: number): ActionResult {
  const c = state.companies[companyId];
  if (!c || !c.playerOwned) return { ok: false, message: 'Not your company.' };
  const bounds: Record<CompanyLever, [number, number]> = {
    marketingPct: [0, 0.25], rdPct: [0, 0.25], priceLevel: [0.7, 1.5], salaryLevel: [0.85, 1.4], dividendPayoutPct: [0, 0.9], automation: [0, 100],
  };
  const [lo, hi] = bounds[lever];
  if (lever === 'automation') {
    // Automation costs capital to raise.
    const delta = clamp(value, lo, hi) - c.automation;
    if (delta > 0) {
      const cost = delta * c.revenue * 0.01;
      if (cost > c.cash) return { ok: false, message: 'Not enough company cash to automate.' };
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

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

export function propertyListings(state: GameState): Omit<PropertyAsset, 'id' | 'purchasePrice' | 'mortgage'>[] {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const rng = new RNG(state.seed ^ (state.year * 40503));
  const kinds: PropertyAsset['kind'][] = ['apartment', 'house', 'mansion', 'commercial', 'land', 'island'];
  const basePrices: Record<PropertyAsset['kind'], number> = { apartment: 220_000, house: 480_000, mansion: 2_800_000, commercial: 3_500_000, land: 900_000, island: 45_000_000 };
  return kinds.map((kind) => {
    const city = rng.pick(home.cities);
    const value = Math.round(basePrices[kind] * city.costOfLiving * (home.economy.housingIndex / 100) * rng.range(0.85, 1.2));
    const rentalYield = kind === 'land' ? 0 : kind === 'commercial' ? rng.range(0.06, 0.09) : rng.range(0.03, 0.06);
    return { name: `${kind[0].toUpperCase()}${kind.slice(1)} in ${city.name}`, kind, cityId: city.id, value, rentalYield };
  });
}

export function buyProperty(state: GameState, listing: Omit<PropertyAsset, 'id' | 'purchasePrice' | 'mortgage'>, useMortgage: boolean): ActionResult {
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
    mortgage: useMortgage ? listing.value * 0.8 : 0,
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

export function launchCampaign(state: GameState, officeKind: OfficeKind, warChest: number): ActionResult {
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
  p.campaign = { officeKind, regionName: region, warChest, momentum: 0, yearsToElection: officeKind === 'head_of_state' || officeKind === 'governor' ? 1 : 0 };
  log(state, `📣 Launched a campaign for ${spec.title} of ${region} with a $${warChest.toLocaleString()} war chest.`, 'politics');
  return { ok: true, message: `Campaign for ${spec.title} underway.` };
}

/** Discretionary campaign activities that spend money/PC for momentum. */
export function campaignAction(state: GameState, kind: 'ads' | 'rally' | 'doorknock' | 'fundraise'): ActionResult {
  const p = state.player;
  if (!p.campaign) return { ok: false, message: 'No active campaign.' };
  const rng = withRng(state);
  let msg = '';
  switch (kind) {
    case 'ads': {
      const cost = 50_000;
      if (p.money < cost) return { ok: false, message: 'Not enough for an ad blitz.' };
      p.money -= cost;
      const gain = 3 + (p.skills['media_public_relations'] ?? 0) * 0.05 + rng.range(0, 3);
      p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
      msg = `Ran attack ads. Momentum +${gain.toFixed(0)}.`;
      break;
    }
    case 'rally': {
      const gain = 2 + p.charisma * 0.05 + (p.skills['politics_public_speaking'] ?? 0) * 0.04 + rng.range(-1, 3);
      p.campaign.momentum = clamp(p.campaign.momentum + gain, -50, 50);
      p.health = clamp100(p.health - 1);
      msg = `Held a rally. Momentum +${gain.toFixed(0)}.`;
      break;
    }
    case 'doorknock': {
      const gain = 1.5 + (p.skills['politics_grassroots_organizing'] ?? 0) * 0.04 + rng.range(-0.5, 2);
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
  }
  commit(state, rng);
  return { ok: true, message: msg };
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

// ---------------------------------------------------------------------------
// Lifestyle / misc
// ---------------------------------------------------------------------------

export function doActivity(state: GameState, kind: 'vacation' | 'gym' | 'doctor' | 'charity' | 'party' | 'meditate'): ActionResult {
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
