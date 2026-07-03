/**
 * Yearly simulation orchestrator. advanceYear() runs the world one year:
 * macro economy → geopolitics → companies → stock market → NPCs → the
 * player's own life (job, study, office, campaign, assets) → events → news.
 * Pure function of (state, rng): UI-free and worker-friendly.
 */
import type { GameState, LifeLogEntry } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { tickCommodities, tickEconomy } from './economy';
import { npcManageCompany, tickCompany, companyValuation } from './business';
import { tickStock, portfolioValue } from './market';
import { campaignWinChance, OFFICE_SPEC_BY_KIND, tickNPCs, tickPolitics } from './politics';
import { fireEvents } from './events';
import { generateNews } from './news';
import { INDUSTRY_BY_ID } from '../data/industries';
import { distributeEstate, tickFamily } from './family';
import { tickWorldEvents } from './worldEvents';
import { tryFireDailyEvent } from './dailyEvents';

const SPECIAL_BIRTHDAYS = new Set([18, 21, 25, 30, 40, 50, 60, 65, 70, 75, 80, 90, 100]);

export function log(state: GameState, text: string, kind: LifeLogEntry['kind'] = 'info'): void {
  state.lifeLog.push({ year: state.year, age: state.player.age, text, kind });
}

export function netWorth(state: GameState): number {
  const p = state.player;
  let total = p.money + portfolioValue(state);
  for (const prop of p.properties) total += prop.value - prop.mortgage;
  for (const loan of p.loans) total -= loan.principal;
  for (const id of p.companies) {
    const c = state.companies[id];
    if (!c || c.status !== 'active') continue;
    total += (c.isPublic ? c.sharePrice * c.sharesOutstanding : companyValuation(c)) * c.playerSharePct;
  }
  return Math.round(total);
}

function tickPlayerLife(state: GameState, rng: RNG): void {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const city = home.cities.find((c) => c.id === p.cityId) ?? home.cities[0];
  const e = home.economy;

  // --- Jail ---------------------------------------------------------------
  if (p.inJailYears > 0) {
    p.inJailYears--;
    p.happiness = clamp100(p.happiness - 6);
    p.reputation = clamp100(p.reputation - 2);
    if (p.inJailYears === 0) {
      log(state, 'You were released from prison.', 'milestone');
      if (!state.achievements.includes('jailbird')) state.achievements.push('jailbird');
    }
    return; // No job/study/campaign progression inside.
  }

  // --- Study --------------------------------------------------------------
  if (p.studying) {
    p.money -= p.studying.costPerYear;
    p.studying.yearsLeft--;
    p.smarts = clamp100(p.smarts + 2);
    if (p.studying.yearsLeft <= 0) {
      p.education.push({ degree: p.studying.degree, field: p.studying.field, yearCompleted: state.year });
      log(state, `You graduated with a ${p.studying.degree} in ${p.studying.field}.`, 'milestone');
      p.reputation = clamp100(p.reputation + 4);
      p.studying = null;
    }
  }

  // --- Job ----------------------------------------------------------------
  if (p.job) {
    const gross = p.job.salary;
    const tax = gross * e.taxRates.income * 0.7; // effective rate below top marginal
    p.money += gross - tax;
    p.job.yearsInRole++;
    const skillLvl = p.skills[INDUSTRY_BY_ID[p.job.industryId]?.skillId ?? ''] ?? 0;
    p.job.performance = clamp100(p.job.performance + (p.smarts - 50) * 0.06 + skillLvl * 0.03 + rng.range(-6, 6));
    // Raises & promotions
    if (p.job.performance > 70 && rng.chance(0.5)) {
      const bump = rng.range(0.04, 0.15);
      p.job.salary = Math.round(p.job.salary * (1 + bump + e.inflation));
      if (rng.chance(0.3)) {
        p.job.title = `Senior ${p.job.title.replace(/^Senior /, '')}`;
        log(state, `Promoted! You are now ${p.job.title} earning $${p.job.salary.toLocaleString()}.`, 'good');
      }
    } else {
      p.job.salary = Math.round(p.job.salary * (1 + e.inflation * 0.8));
    }
    // Layoffs in downturns
    if ((e.regime === 'recession' || e.regime === 'depression') && rng.chance(0.12 + Math.max(0, 40 - p.job.performance) * 0.004)) {
      log(state, `You were laid off from your job as ${p.job.title} at ${p.job.employerName}.`, 'bad');
      p.job = null;
      p.happiness = clamp100(p.happiness - 8);
    }
    // Passive skill growth from working
    const ind = p.job ? INDUSTRY_BY_ID[p.job.industryId] : null;
    if (ind) p.skills[ind.skillId] = clamp100((p.skills[ind.skillId] ?? 0) + rng.range(2, 5));
  }

  // --- Office -------------------------------------------------------------
  if (p.office) {
    const spec = OFFICE_SPEC_BY_KIND[p.office.kind];
    p.money += spec.salary * (1 - e.taxRates.income * 0.6);
    p.office.yearsInOffice++;
    p.office.yearsInOfficeTotal++;
    p.politicalCapital = clamp(p.politicalCapital + 2, 0, 100);
    p.influence = clamp100(p.influence + 1.5);
    // Local approval drift for sub-national offices
    if (p.office.kind !== 'head_of_state' && p.office.kind !== 'dictator' && p.office.kind !== 'monarch') {
      p.popularity = clamp100(p.popularity + (e.gdpGrowth > 0.02 ? 1 : -1.5) + rng.range(-2, 2));
    }
    // Term end: face re-election or step down (dictators/monarchs don't).
    if (p.office.kind !== 'dictator' && p.office.kind !== 'monarch' && p.office.yearsInOffice >= p.office.termYears) {
      const winChance = clamp(0.35 + (p.popularity - 45) / 100 + (home.approvalOfGovernment - 45) / 200, 0.05, 0.95);
      if (rng.chance(winChance)) {
        p.office.yearsInOffice = 0;
        log(state, `Re-elected as ${p.office.title} for another ${p.office.termYears}-year term.`, 'politics');
        p.politicalCapital = clamp(p.politicalCapital + 5, 0, 100);
      } else {
        log(state, `You lost re-election and left office as ${p.office.title}.`, 'bad');
        if (p.office.kind === 'head_of_state' && home.leaderId === 'player') {
          const successor = Object.values(state.npcs).find((n) => n.alive && n.countryId === home.id && n.role === 'politician');
          home.leaderId = successor?.id ?? null;
        }
        p.office = null;
        p.happiness = clamp100(p.happiness - 6);
      }
    }
    // Dictators risk coups when stability collapses.
    if (p.office && p.office.kind === 'dictator' && home.stability < 25 && rng.chance(0.25)) {
      log(state, 'A military coup toppled your regime! You barely escaped with your life.', 'bad');
      p.office = null;
      home.leaderId = null;
      p.popularity = clamp100(p.popularity - 20);
      p.money *= 0.5;
      home.system = 'presidential';
      home.totalSeats = 150;
    }
  }

  // --- Campaign -----------------------------------------------------------
  if (p.campaign) {
    p.campaign.yearsToElection--;
    p.campaign.momentum = clamp(p.campaign.momentum * 0.8, -50, 50);
    if (p.campaign.yearsToElection <= 0) {
      const chance = campaignWinChance(state, rng);
      const spec = OFFICE_SPEC_BY_KIND[p.campaign.officeKind];
      if (rng.chance(chance)) {
        p.office = {
          kind: spec.kind,
          title: spec.title,
          regionName: p.campaign.regionName,
          termYears: spec.termYears,
          yearsInOffice: 0,
          yearsInOfficeTotal: p.office?.kind === spec.kind ? p.office.yearsInOfficeTotal : 0,
        };
        if (!state.achievements.includes(`office:${spec.kind}`)) state.achievements.push(`office:${spec.kind}`);
        p.popularity = clamp100(p.popularity + 8);
        p.politicalCapital = clamp(p.politicalCapital + 10, 0, 100);
        log(state, `🎉 VICTORY! You won the election and became ${spec.title} of ${p.campaign.regionName}.`, 'milestone');
        if (spec.kind === 'head_of_state') {
          home.leaderId = 'player';
          home.approvalOfGovernment = clamp100(52 + rng.range(-4, 8));
          log(state, `You are now the ${home.leaderTitle} of ${home.name}.`, 'milestone');
        }
        if (spec.kind === 'party_leader' && p.partyId) {
          const party = home.parties.find((x) => x.id === p.partyId);
          if (party) party.leaderId = 'player';
        }
      } else {
        log(state, `You lost the ${spec.title} election. ${Math.round(chance * 100)}% odds weren't enough.`, 'bad');
        p.happiness = clamp100(p.happiness - 8);
        p.popularity = clamp100(p.popularity - 3);
      }
      p.campaign = null;
    }
  }

  // --- Personal finances -----------------------------------------------------
  const costOfLiving = 18_000 * city.costOfLiving * (1 + Math.max(0, (e.history.length ? e.history[e.history.length - 1].gdp / e.history[0].gdp : 1) - 1) * 0.1);
  p.money -= costOfLiving * (p.money > 5_000_000 ? 4 : p.money > 500_000 ? 2 : 1); // lifestyle creep
  for (const loan of p.loans) {
    const interest = loan.principal * loan.rate;
    const repay = loan.principal / Math.max(1, loan.yearsLeft);
    p.money -= interest + repay;
    loan.principal -= repay;
    loan.yearsLeft--;
  }
  p.loans = p.loans.filter((l) => l.principal > 1 && l.yearsLeft > 0);

  // Government bonds: pay a fixed coupon each year, then return principal at maturity.
  for (const bond of p.bonds) {
    p.money += bond.principal * bond.rate;
    bond.yearsLeft--;
  }
  const maturing = p.bonds.filter((b) => b.yearsLeft <= 0);
  for (const bond of maturing) {
    p.money += bond.principal;
    const country = state.countries.find((c) => c.id === bond.countryId);
    log(state, `A $${Math.round(bond.principal).toLocaleString()} bond from ${country?.name ?? 'a foreign government'} matured.`, 'money');
  }
  p.bonds = p.bonds.filter((b) => b.yearsLeft > 0);

  // Life insurance premium (payout is handled in family.ts's distributeEstate on death).
  if (p.lifeInsurance) p.money -= p.lifeInsurance.monthlyPremium * 12;

  for (const prop of p.properties) {
    prop.value = Math.max(10_000, prop.value * (e.housingIndex / Math.max(1, e.history.length >= 2 ? e.history[e.history.length - 2].housingIndex : 100)));
    if (prop.rentalYield > 0) p.money += prop.value * prop.rentalYield * 0.85; // net of costs
    if (prop.mortgage > 0) {
      const pay = prop.mortgage * (e.interestRate + 0.02) + prop.mortgage * 0.05;
      p.money -= pay;
      prop.mortgage = Math.max(0, prop.mortgage - prop.mortgage * 0.05);
    }
  }

  // Debt spiral: negative cash converts to a personal loan at punitive rates.
  if (p.money < 0) {
    const need = -p.money;
    p.loans.push({ id: `loan_auto_${state.year}`, principal: need, rate: e.interestRate + 0.08, yearsLeft: 5, purpose: 'Emergency credit' });
    p.money = 0;
    log(state, `You fell into debt and took emergency credit of $${Math.round(need).toLocaleString()}.`, 'bad');
  }

  // --- Body & mind -----------------------------------------------------------
  const ageDecay = p.age > 70 ? 3.5 : p.age > 55 ? 2 : p.age > 40 ? 1 : 0.4;
  p.health = clamp100(p.health - ageDecay + (p.happiness - 50) * 0.02 + rng.range(-2, 2));
  const moneyComfort = p.money > 100_000 ? 1 : p.money < 2_000 ? -2 : 0;
  p.happiness = clamp100(p.happiness + moneyComfort + (p.health - 60) * 0.03 + rng.range(-3, 3));
  p.notoriety = Math.max(0, p.notoriety - 1);

  // --- Mortality ----------------------------------------------------------------
  const mortality = p.age > 95 ? 0.35 : p.age > 85 ? 0.12 : p.age > 75 ? 0.05 : p.age > 65 ? 0.015 : 0.002;
  const healthMult = p.health < 20 ? 4 : p.health < 40 ? 2 : 1;
  if (rng.chance(mortality * healthMult * (1 - home.healthcare / 300))) {
    p.alive = false;
  }
}

function gameOverCheck(state: GameState): void {
  const p = state.player;
  if (p.alive) return;
  const worth = netWorth(state);
  const summary: string[] = [
    `Died at age ${p.age} in ${state.year}.`,
    `Final net worth: $${worth.toLocaleString()}.`,
    `Companies founded: ${p.companies.length}.`,
    `Highest office: ${state.achievements.filter((a) => a.startsWith('office:')).map((a) => OFFICE_SPEC_BY_KIND[a.slice(7)]?.title).filter(Boolean).pop() ?? 'None'}.`,
    `Criminal convictions: ${p.criminalRecord}.`,
    `Karma: ${Math.round(p.karma)}/100.`,
  ];
  const estateNotes = distributeEstate(state);
  if (estateNotes.length) summary.push(...estateNotes);
  const reason =
    p.health <= 5
      ? 'Your health gave out.'
      : p.age >= 75
        ? 'You died of old age.'
        : p.age >= 50
          ? 'An unexpected illness took you before your time.'
          : 'Tragedy struck — your life was cut short unexpectedly.';
  state.gameOver = {
    reason,
    summary,
    finalNetWorth: worth,
    finalAge: p.age,
  };
  log(state, `You died at age ${p.age}. ${state.gameOver.reason}`, 'milestone');
  for (const note of estateNotes) log(state, note, 'milestone');
}

/**
 * Advance the world by one year. Mutates and returns the same state object;
 * callers (the Zustand store) treat it as an opaque transaction and re-wrap.
 */
export function advanceYear(state: GameState): GameState {
  if (state.gameOver) return state;
  const rng = new RNG(state.seed);
  rng.state = state.rngState;

  state.year++;
  state.player.age++;
  state.calendarDay = 0;
  if (SPECIAL_BIRTHDAYS.has(state.player.age) && state.player.alive) {
    log(state, `🎂 You turn ${state.player.age} today.`, 'milestone');
  }

  // 1. World economy
  tickCommodities(state, rng);
  const worldEventHeadlines = tickWorldEvents(state, rng);
  const politicalHeadlines: string[] = [...worldEventHeadlines];
  for (const country of state.countries) {
    const res = tickEconomy(state, country, rng);
    if (res.crisis === 'crash' && country.isPlayerHome) politicalHeadlines.push(`Stock market crash wipes billions off ${country.name} shares`);
    if (res.crisis === 'debt' && country.isPlayerHome) politicalHeadlines.push(`${country.name} debt crisis: bond yields spike as investors flee`);
  }

  // 2. Politics & NPCs
  for (const country of state.countries) {
    politicalHeadlines.push(...tickPolitics(state, country, rng));
  }
  politicalHeadlines.push(...tickNPCs(state, rng));

  // 3. Companies & markets
  const businessHeadlines: string[] = [];
  for (const company of Object.values(state.companies)) {
    if (company.status !== 'active') continue;
    const country = state.countries.find((c) => c.id === company.countryId)!;
    npcManageCompany(company, rng);
    const res = tickCompany(company, { state, country, rng });
    if (res.headline && (company.playerOwned || company.isPublic)) businessHeadlines.push(res.headline);
    if (res.wentBankrupt && company.playerOwned) {
      log(state, `💥 ${company.name} went bankrupt. Your equity is worthless.`, 'bad');
      state.player.happiness = clamp100(state.player.happiness - 10);
      state.player.reputation = clamp100(state.player.reputation - 5);
    }
    tickStock(company, state, rng);
  }

  // 4. The player's own year
  tickPlayerLife(state, rng);
  if (state.player.alive) tickFamily(state, rng);

  // 5. Player company income: dividends from private profitable companies
  const p = state.player;
  for (const id of p.companies) {
    const c = state.companies[id];
    if (!c || c.status !== 'active' || c.isPublic) continue;
    if (c.profit > 0 && c.cash > c.revenue * 0.15) {
      const draw = Math.min(c.cash * 0.3, c.profit * 0.5) * c.playerSharePct;
      c.cash -= draw / Math.max(0.01, c.playerSharePct); // total distribution incl. co-owners
      p.money += draw;
    }
  }

  // 6. Events for the player to resolve
  state.pendingEvents = p.alive ? fireEvents(state, rng) : [];

  // 7. News
  const news = generateNews(state, rng, politicalHeadlines.slice(0, 6), businessHeadlines.slice(0, 4));
  state.news.push(...news);
  if (state.news.length > 400) state.news.splice(0, state.news.length - 400);

  // 8. Records & endings
  state.netWorthHistory.push({ year: state.year, value: netWorth(state) });
  gameOverCheck(state);

  // Milestone achievements
  const worth = state.netWorthHistory[state.netWorthHistory.length - 1].value;
  const milestones: [string, boolean][] = [
    ['millionaire', worth >= 1e6],
    ['deca_millionaire', worth >= 1e7],
    ['billionaire', worth >= 1e9],
    ['centenarian', p.age >= 100],
  ];
  for (const [key, hit] of milestones) {
    if (hit && !state.achievements.includes(key)) {
      state.achievements.push(key);
      if (key === 'millionaire') log(state, '🏆 You are a millionaire!', 'milestone');
      if (key === 'deca_millionaire') log(state, '🏆 Your net worth passed $10 million.', 'milestone');
      if (key === 'billionaire') log(state, '🏆 BILLIONAIRE. You have joined the ten-figure club.', 'milestone');
      if (key === 'centenarian') log(state, '🏆 You turned 100 years old.', 'milestone');
    }
  }

  if (state.lifeLog.length > 600) state.lifeLog.splice(0, state.lifeLog.length - 600);
  state.rngState = rng.state;
  return state;
}

// ---------------------------------------------------------------------------
// Daily / weekly advancement — lightweight, non-blocking ticks that let the
// player fast-forward between the "big" yearly decisions. A day never fires
// the full economy/company/politics simulation; it only rolls a small chance
// of a small flavor event and a tiny stat drift. When enough days accumulate
// to complete a year, the existing advanceYear() runs exactly once and the
// calendar resets — so the yearly simulation stays authoritative either way.
// ---------------------------------------------------------------------------

export interface DailyTickResult {
  state: GameState;
  headlines: string[]; // flavor lines from the day(s) advanced, for a toast — never blocking
  rolledIntoNewYear: boolean;
}

function tickOneDay(state: GameState): { headline: string | null; rolledIntoNewYear: boolean } {
  if (state.gameOver) return { headline: null, rolledIntoNewYear: false };
  const rng = new RNG(state.seed);
  rng.state = state.rngState;

  state.calendarDay++;
  let headline: string | null = null;
  const p = state.player;
  if (p.alive && p.inJailYears <= 0) {
    headline = tryFireDailyEvent(state, rng);
    p.happiness = clamp100(p.happiness + rng.range(-0.3, 0.3));
    p.health = clamp100(p.health + rng.range(-0.15, 0.15));
  }
  if (headline) log(state, headline, 'info');
  state.rngState = rng.state;

  let rolledIntoNewYear = false;
  if (state.calendarDay >= 365 && !state.gameOver) {
    rolledIntoNewYear = true;
    advanceYear(state);
  }
  return { headline, rolledIntoNewYear };
}

/** Advance a single day. Cheap enough to call repeatedly without UI lag. */
export function advanceDay(state: GameState): DailyTickResult {
  const res = tickOneDay(state);
  return { state, headlines: res.headline ? [res.headline] : [], rolledIntoNewYear: res.rolledIntoNewYear };
}

/** Advance seven days in one call; rolls into a new year mid-week if the calendar completes. */
export function advanceWeek(state: GameState): DailyTickResult {
  const headlines: string[] = [];
  let rolledIntoNewYear = false;
  for (let i = 0; i < 7; i++) {
    if (state.gameOver) break;
    const res = tickOneDay(state);
    if (res.headline) headlines.push(res.headline);
    if (res.rolledIntoNewYear) rolledIntoNewYear = true;
  }
  return { state, headlines, rolledIntoNewYear };
}
