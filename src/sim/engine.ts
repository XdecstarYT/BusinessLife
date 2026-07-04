/**
 * Yearly simulation orchestrator. advanceYear() runs the world one year:
 * macro economy → geopolitics → companies → stock market → NPCs → the
 * player's own life (job, study, office, campaign, assets) → events → news.
 * Pure function of (state, rng): UI-free and worker-friendly.
 */
import type { Country, GameState, LifeLogEntry, Player } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { tickCommodities, tickEconomy } from './economy';
import { npcManageCompany, tickCompany, tickMergers, tickCorporateSabotage, companyValuation } from './business';
import { tickStock, portfolioValue, checkLimitOrders, tickMargin } from './market';
import { campaignWinChance, electionRegionalBreakdown, OFFICE_SPEC_BY_KIND, promiseFulfillment, promiseMetricValue, tickNPCs, tickPolitics } from './politics';
import { fireEvents } from './events';
import { generateNews } from './news';
import { INDUSTRY_BY_ID } from '../data/industries';
import { distributeEstate, dynastyScore, tickFamily } from './family';
import { tickWorldEvents } from './worldEvents';
import { tryFireDailyEvent } from './dailyEvents';
import { tickLifestyleAssets } from './lifestyle';
import { SK } from '../data/skills';

const SPECIAL_BIRTHDAYS = new Set([18, 21, 25, 30, 40, 50, 60, 65, 70, 75, 80, 90, 100]);

export function log(state: GameState, text: string, kind: LifeLogEntry['kind'] = 'info'): void {
  state.lifeLog.push({ year: state.year, age: state.player.age, text, kind });
}

/** Appends to the sparse, world-level (not personal) history chronicle — major milestones only. */
export function logHistory(state: GameState, text: string): void {
  state.worldHistory.push({ year: state.year, text });
  if (state.worldHistory.length > 300) state.worldHistory.splice(0, state.worldHistory.length - 300);
}

const MAJOR_HEADLINE_MARKERS = ['WAR:', 'Peace:', 'COUP', 'wins the', 'retains power', 'dies;'];

export function netWorth(state: GameState): number {
  const p = state.player;
  let total = p.money + portfolioValue(state) - p.marginDebt + p.dirtyMoney;
  total += p.savingsBalance + p.cryptoUnits * state.cryptoPrice;
  for (const td of p.termDeposits) total += td.principal;
  for (const lux of p.luxuryAssets) total += lux.value;
  for (const prop of p.properties) total += prop.value - prop.mortgage;
  for (const loan of p.loans) total -= loan.principal;
  for (const id of p.companies) {
    const c = state.companies[id];
    if (!c || c.status !== 'active') continue;
    total += (c.isPublic ? c.sharePrice * c.sharesOutstanding : companyValuation(c)) * c.playerSharePct;
  }
  return Math.round(total);
}

/** Assigns and resolves a random mid-game challenge: a stretch goal with a deadline and a cash reward. */
function tickChallenge(state: GameState, rng: RNG): void {
  const p = state.player;
  if (!p.challenge) {
    if (!rng.chance(0.12)) return;
    const kind = rng.pick(['net_worth', 'reputation', 'companies'] as const);
    if (kind === 'net_worth') {
      const target = Math.round(Math.max(50_000, netWorth(state)) * rng.range(1.4, 2));
      p.challenge = { id: `chal_${state.year}`, description: `Grow your net worth to $${target.toLocaleString()}`, kind, targetValue: target, deadlineYear: state.year + 5, rewardMoney: target * 0.05 };
    } else if (kind === 'reputation') {
      const target = Math.min(100, Math.round(p.reputation + rng.range(15, 30)));
      p.challenge = { id: `chal_${state.year}`, description: `Raise your reputation to ${target}`, kind, targetValue: target, deadlineYear: state.year + 4, rewardMoney: 75_000 };
    } else {
      const target = p.companies.length + rng.int(1, 2);
      p.challenge = { id: `chal_${state.year}`, description: `Own ${target} active companies`, kind, targetValue: target, deadlineYear: state.year + 6, rewardMoney: 100_000 };
    }
    log(state, `🎯 New challenge: ${p.challenge.description} by ${p.challenge.deadlineYear}.`, 'info');
    return;
  }
  const c = p.challenge;
  const current = c.kind === 'net_worth' ? netWorth(state) : c.kind === 'reputation' ? p.reputation : p.companies.filter((id) => state.companies[id]?.status === 'active').length;
  if (current >= c.targetValue) {
    p.money += c.rewardMoney;
    p.happiness = clamp100(p.happiness + 8);
    if (!state.achievements.includes('challenge_crusher')) state.achievements.push('challenge_crusher');
    log(state, `🏅 Challenge complete: ${c.description}! Reward: $${Math.round(c.rewardMoney).toLocaleString()}.`, 'good');
    p.challenge = null;
  } else if (state.year >= c.deadlineYear) {
    log(state, `⌛ Challenge expired: ${c.description}.`, 'bad');
    p.happiness = clamp100(p.happiness - 3);
    p.challenge = null;
  }
}

/** Crypto: a single, very volatile global asset with boom/bust dynamics riding world sentiment. */
function tickCrypto(state: GameState, rng: RNG): void {
  const home = state.countries.find((c) => c.isPlayerHome)!;
  const sentiment = (home.economy.businessConfidence - 50) * 0.002;
  const boostFromTechBoom = state.worldEvent?.type === 'tech_boom' ? 0.15 : 0;
  const hitFromBankCollapse = state.worldEvent?.type === 'banking_collapse' ? -0.2 : 0;
  const drift = rng.range(-0.35, 0.45) + sentiment + boostFromTechBoom + hitFromBankCollapse;
  state.cryptoPrice = clamp(state.cryptoPrice * (1 + drift), 50, 5_000_000);
  state.cryptoHistory.push(Math.round(state.cryptoPrice));
  if (state.cryptoHistory.length > 120) state.cryptoHistory.shift();
}

/** Savings interest, term-deposit maturity, foundation grants, pension, memoir royalties. */
function tickPersonalFinance(state: GameState, rng: RNG): void {
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const savingsRate = Math.max(0, home.economy.interestRate - 0.01);
  if (p.savingsBalance > 0) p.savingsBalance = Math.round(p.savingsBalance * (1 + savingsRate));

  for (const td of [...p.termDeposits]) {
    td.yearsLeft--;
    if (td.yearsLeft <= 0) {
      const matured = Math.round(td.principal * (1 + td.rate));
      p.money += matured;
      p.termDeposits = p.termDeposits.filter((x) => x.id !== td.id);
      log(state, `A term deposit matured, paying out $${matured.toLocaleString()}.`, 'money');
    } else {
      td.principal = Math.round(td.principal * (1 + td.rate));
    }
  }

  if (p.foundation) {
    const f = p.foundation;
    f.endowment = Math.round(f.endowment * (1 + rng.range(0.02, 0.06)));
    const grants = Math.round(f.endowment * 0.05);
    if (grants > 0) {
      f.endowment -= grants;
      f.totalGiven += grants;
      p.karma = clamp100(p.karma + 2);
      p.reputation = clamp100(p.reputation + 1);
      p.popularity = clamp100(p.popularity + 0.5);
      if (f.totalGiven >= 1_000_000 && !state.achievements.includes('foundation_million')) {
        state.achievements.push('foundation_million');
        log(state, `🏆 The ${f.name} has now given away over $1 million.`, 'milestone');
      }
    }
  }

  if (p.retired && p.pensionIncome > 0 && p.alive) {
    p.money += p.pensionIncome;
  }

  if (p.memoir) {
    p.money += p.memoir.royaltyPerYear;
    p.memoir.yearsLeft--;
    if (p.memoir.yearsLeft <= 0) {
      log(state, `Royalties from "${p.memoir.title}" have run their course.`, 'info');
      p.memoir = null;
    }
  }
}

/** Annual industry awards: the home nation's standout company is honored each year. */
function tickIndustryAwards(state: GameState, rng: RNG): string[] {
  const home = state.countries.find((c) => c.isPlayerHome)!;
  const candidates = Object.values(state.companies).filter(
    (c) => c.status === 'active' && c.countryId === home.id && c.history.length >= 2,
  );
  if (candidates.length < 3) return [];
  const scored = candidates
    .map((c) => {
      const a = c.history[c.history.length - 2].revenue;
      const b = c.history[c.history.length - 1].revenue;
      return { c, growth: a > 0 ? b / a - 1 : 0 };
    })
    .sort((x, y) => y.growth - x.growth);
  const winner = scored[0].c;
  winner.brand = clamp100(winner.brand + 5);
  winner.morale = clamp100(winner.morale + 4);
  if (winner.playerOwned) {
    state.player.reputation = clamp100(state.player.reputation + 5);
    if (!state.achievements.includes('company_of_the_year')) state.achievements.push('company_of_the_year');
    log(state, `🏆 ${winner.name} was named Company of the Year!`, 'milestone');
  }
  void rng;
  return [`🏆 ${winner.name} named ${home.name}'s Company of the Year`];
}

/** Global Games: a won bid builds for several years, then the hosting year pays off. */
function tickGlobalGames(state: GameState, country: Country): string[] {
  if (country.globalGamesYear === null) return [];
  const headlines: string[] = [];
  if (state.year < country.globalGamesYear) {
    country.economy.budgetBalance = clamp(country.economy.budgetBalance - 0.005, -0.3, 0.1);
    country.infrastructure = clamp100(country.infrastructure + 1.5);
  } else if (state.year === country.globalGamesYear) {
    country.economy.businessConfidence = clamp100(country.economy.businessConfidence + 10);
    country.economy.consumerConfidence = clamp100(country.economy.consumerConfidence + 8);
    country.stability = clamp100(country.stability + 4);
    headlines.push(`🏟️ The Global Games open in ${country.name} to worldwide fanfare`);
    if (country.leaderId === 'player') {
      state.player.popularity = clamp100(state.player.popularity + 10);
      state.player.reputation = clamp100(state.player.reputation + 6);
      if (!state.achievements.includes('games_host')) state.achievements.push('games_host');
      log(state, `🏟️ Your nation hosted the Global Games — a triumph on the world stage.`, 'milestone');
    }
    country.globalGamesYear = null;
  }
  return headlines;
}

/** Moonshot R&D projects burn cash yearly and resolve at the end: breakthrough or bust. */
function tickMoonshots(state: GameState, rng: RNG): void {
  for (const c of Object.values(state.companies)) {
    if (c.status !== 'active' || !c.moonshot) continue;
    const burn = c.moonshot.invested / Math.max(1, c.moonshot.yearsLeft + 1);
    c.cash -= burn;
    c.moonshot.yearsLeft--;
    if (c.moonshot.yearsLeft <= 0) {
      const country = state.countries.find((k) => k.id === c.countryId)!;
      const chance = clamp(0.35 + c.rdPct * 1.2 + (country.researchLevel / 100) * 0.2, 0.15, 0.7);
      if (rng.chance(chance)) {
        c.patents += 3;
        c.quality = clamp100(c.quality + 10);
        c.brand = clamp100(c.brand + 8);
        c.revenue *= 1.15;
        if (c.playerOwned) {
          if (!state.achievements.includes('moonshot_landed')) state.achievements.push('moonshot_landed');
          log(state, `🚀 ${c.name}'s moonshot paid off — a genuine breakthrough!`, 'milestone');
        }
      } else if (c.playerOwned) {
        log(state, `💥 ${c.name}'s moonshot project ended in failure. The R&D is a sunk cost.`, 'bad');
      }
      c.moonshot = null;
    }
  }
}

/** Hired CEOs: paid from company cash, pull managerQuality toward their skill, and may quit. */
function tickCEOs(state: GameState, rng: RNG): void {
  for (const c of Object.values(state.companies)) {
    if (c.status !== 'active' || !c.ceoName || !c.playerOwned) continue;
    c.cash -= c.ceoSalary;
    c.managerQuality = clamp100(c.managerQuality * 0.7 + c.ceoSkill * 0.3);
    if (c.cash < 0 && rng.chance(0.4)) {
      log(state, `${c.ceoName} resigned as CEO of ${c.name} — the company can no longer afford them.`, 'bad');
      c.ceoName = null;
      c.ceoSkill = 0;
      c.ceoSalary = 0;
    } else if (rng.chance(0.04)) {
      log(state, `${c.ceoName} was poached from ${c.name} by a rival firm.`, 'bad');
      c.ceoName = null;
      c.ceoSkill = 0;
      c.ceoSalary = 0;
    }
  }
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
      const fulfillment = p.office.promises.length ? promiseFulfillment(p.office, home) : [];
      const fulfilledRatio = fulfillment.length ? fulfillment.filter((f) => f.fulfilled).length / fulfillment.length : 0.5;
      const winChance = clamp(
        0.35 + (p.popularity - 45) / 100 + (home.approvalOfGovernment - 45) / 200 + (fulfilledRatio - 0.5) * 0.15,
        0.05,
        0.95,
      );
      const won = rng.chance(winChance);
      state.player.lastElectionResult = {
        won,
        officeTitle: p.office.title,
        regionName: p.office.regionName,
        playerSharePct: Math.round(winChance * 100),
        rivalSharePct: Math.round((1 - winChance) * 100),
        regionalBreakdown: electionRegionalBreakdown(home, winChance * 100, rng),
      };
      if (won) {
        p.office.yearsInOffice = 0;
        for (const promise of p.office.promises) p.office.promiseBaseline[promise] = promiseMetricValue(home, promise);
        log(state, `Re-elected as ${p.office.title} for another ${p.office.termYears}-year term.`, 'politics');
        p.politicalCapital = clamp(p.politicalCapital + 5, 0, 100);
        if (fulfillment.length) {
          const kept = fulfillment.filter((f) => f.fulfilled).length;
          log(state, `Manifesto scorecard: kept ${kept}/${fulfillment.length} promises.`, 'politics');
          if (kept === fulfillment.length && !state.achievements.includes('manifesto_keeper')) {
            state.achievements.push('manifesto_keeper');
          }
        }
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
      const promises = p.campaign.promises;
      const won = rng.chance(chance);
      state.player.lastElectionResult = {
        won,
        officeTitle: spec.title,
        regionName: p.campaign.regionName,
        playerSharePct: Math.round(chance * 100),
        rivalSharePct: Math.round((1 - chance) * 100),
        regionalBreakdown: electionRegionalBreakdown(home, chance * 100, rng),
      };
      if (won) {
        p.office = {
          kind: spec.kind,
          title: spec.title,
          regionName: p.campaign.regionName,
          termYears: spec.termYears,
          yearsInOffice: 0,
          yearsInOfficeTotal: p.office?.kind === spec.kind ? p.office.yearsInOfficeTotal : 0,
          promises,
          promiseBaseline: Object.fromEntries(promises.map((pr) => [pr, promiseMetricValue(home, pr)])),
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

  // Lobbying firm retainer: ongoing upkeep for a permanent law-pass sway bonus.
  if (p.lobbyingFirmHired) p.money -= 25_000;

  // Think tank retainer: slower-burn upkeep that builds influence (and approval, if leader).
  if (p.thinkTankFunded) {
    p.money -= 15_000;
    p.influence = clamp100(p.influence + 0.6);
    if (home.leaderId === 'player') home.approvalOfGovernment = clamp100(home.approvalOfGovernment + 0.4);
  }

  // PR agency retainer: dampens negative reputation/popularity/happiness hits (see events.ts).
  if (p.prAgencyHired) p.money -= 10_000;

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
  const difficultyMortalityMult = state.difficulty === 'casual' ? 0.6 : state.difficulty === 'ironman' ? 1.4 : 1;
  if (rng.chance(mortality * healthMult * (1 - home.healthcare / 300) * difficultyMortalityMult)) {
    p.alive = false;
  }
}

/** A rough 0..100 composite of wealth, dynasty, office and achievements at death. */
function computeLegacyScore(state: GameState, worth: number): number {
  const p = state.player;
  let score = 0;
  score += clamp(Math.log10(Math.max(1, worth)) * 3, 0, 25);
  score += Math.min(20, state.achievements.length * 1.5);
  score += dynastyScore(state) * 0.25;
  const officeAchievements = state.achievements.filter((a) => a.startsWith('office:'));
  if (officeAchievements.some((a) => a === 'office:head_of_state')) score += 20;
  else if (officeAchievements.some((a) => a === 'office:minister' || a === 'office:governor')) score += 12;
  else if (officeAchievements.length) score += 6;
  score += Math.min(10, p.companies.length * 2);
  return Math.round(clamp(score, 0, 100));
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
  const legacyScore = computeLegacyScore(state, worth);
  state.gameOver = {
    reason,
    summary,
    finalNetWorth: worth,
    finalAge: p.age,
    legacyScore,
  };
  log(state, `You died at age ${p.age}. ${state.gameOver.reason}`, 'milestone');
  for (const note of estateNotes) log(state, note, 'milestone');
  log(state, `Legacy score: ${legacyScore}/100.`, 'milestone');

  // Offer to continue play as a surviving heir per the will, instead of ending the story here.
  const candidateOf = (id: string | null, relation: 'Spouse' | 'Child' | 'Grandchild') => {
    if (!id) return null;
    const npc = state.npcs[id];
    if (!npc || !npc.alive || npc.age < 16) return null;
    return { npcId: id, name: npc.name, relation, isPrimaryHeir: id === p.primaryHeirId };
  };
  const candidates = [
    candidateOf(p.spouseId, 'Spouse'),
    ...p.children.map((id) => candidateOf(id, 'Child')),
    ...p.grandchildren.map((id) => candidateOf(id, 'Grandchild')),
  ].filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => Number(b.isPrimaryHeir) - Number(a.isPrimaryHeir));
  if (candidates.length && state.difficulty !== 'ironman') {
    state.pendingSuccession = { deceasedName: p.name, candidates };
  }
}

/** Continue play as a chosen heir instead of ending the game. Inherits their wealth/company and
 * resets the rest of the player scaffold fresh, incrementing the dynasty generation counter. */
export function continueAsHeir(state: GameState, npcId: string): GameState {
  const npc = state.npcs[npcId];
  if (!npc) return state;
  const oldPlayer = state.player;
  const inheritedCompanies = Object.values(state.companies)
    .filter((c) => c.status === 'active' && c.founderId === npcId)
    .map((c) => c.id);
  for (const id of inheritedCompanies) {
    state.companies[id].playerOwned = true;
  }
  const newPlayer: Player = {
    ...oldPlayer,
    name: npc.name,
    gender: npc.gender,
    age: npc.age,
    alive: true,
    countryId: npc.countryId,
    health: 85,
    happiness: 65,
    smarts: clamp100(npc.competence),
    charisma: clamp100(npc.charisma),
    reputation: 5,
    popularity: 0,
    influence: 0,
    karma: 50,
    notoriety: 0,
    money: npc.wealth,
    criminalRecord: 0,
    inJailYears: 0,
    skills: {},
    education: [],
    studying: null,
    job: null,
    companies: inheritedCompanies,
    lifeInsurance: null,
    spouseId: null,
    children: [],
    grandchildren: [],
    divorceCount: 0,
    primaryHeirId: null,
    hasPrenup: false,
    mentorId: null,
    rivalId: null,
    crimeFamilyId: null,
    crimeRank: 0,
    turfControl: 0,
    dirtyMoney: 0,
    inWitnessProtection: false,
    partyId: null,
    office: null,
    politicalCapital: 0,
    politicalHeirId: null,
    advisors: [],
    campaign: null,
    lastElectionResult: null,
    relationships: [],
    limitOrders: [],
    marginDebt: 0,
    drip: false,
    challenge: null,
    cryptoUnits: 0,
    savingsBalance: 0,
    termDeposits: [],
    foundation: null,
    retired: false,
    pensionIncome: 0,
    memoir: null,
    luxuryAssets: [],
    celebrityStakes: [],
  };
  delete state.npcs[npcId];
  state.player = newPlayer;
  state.generation++;
  state.gameOver = null;
  state.pendingSuccession = null;
  state.yearRecap = null;
  log(state, `🕯️ Life goes on: you continue the story as ${npc.name}, generation ${state.generation}.`, 'milestone');
  logHistory(state, `🕯️ ${oldPlayer.name}'s dynasty continues through ${npc.name} (generation ${state.generation})`);
  if (!state.achievements.includes('dynasty_continued')) state.achievements.push('dynasty_continued');
  return state;
}

/**
 * Advance the world by one year. Mutates and returns the same state object;
 * callers (the Zustand store) treat it as an opaque transaction and re-wrap.
 */
export function advanceYear(state: GameState): GameState {
  if (state.gameOver) return state;
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  const netWorthStart = netWorth(state);
  const yearBefore = state.year;

  state.year++;
  state.player.age++;
  state.calendarDay = 0;
  if (SPECIAL_BIRTHDAYS.has(state.player.age) && state.player.alive) {
    log(state, `🎂 You turn ${state.player.age} today.`, 'milestone');
  }

  // 1. World economy
  tickCommodities(state, rng);
  const worldEventHeadlines = tickWorldEvents(state, rng);
  for (const h of worldEventHeadlines) logHistory(state, h);
  const politicalHeadlines: string[] = [...worldEventHeadlines];
  for (const country of state.countries) {
    const res = tickEconomy(state, country, rng);
    if (res.crisis === 'crash' && country.isPlayerHome) politicalHeadlines.push(`Stock market crash wipes billions off ${country.name} shares`);
    if (res.crisis === 'debt' && country.isPlayerHome) politicalHeadlines.push(`${country.name} debt crisis: bond yields spike as investors flee`);
    if (res.crisis === 'disaster' && country.isPlayerHome) politicalHeadlines.push(`🌪️ Climate disaster strikes ${country.name}: property damaged, confidence shaken`);
    if (res.weatherHeadline && country.isPlayerHome) politicalHeadlines.push(res.weatherHeadline);
  }

  // 2. Politics & NPCs
  for (const country of state.countries) {
    const countryHeadlines = tickPolitics(state, country, rng);
    for (const h of countryHeadlines) {
      if (MAJOR_HEADLINE_MARKERS.some((m) => h.includes(m))) logHistory(state, h);
    }
    politicalHeadlines.push(...countryHeadlines);
    const gamesHeadlines = tickGlobalGames(state, country);
    for (const h of gamesHeadlines) logHistory(state, h);
    politicalHeadlines.push(...gamesHeadlines);
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
  businessHeadlines.push(...tickMergers(state, rng));
  businessHeadlines.push(...tickCorporateSabotage(state, rng));
  businessHeadlines.push(...tickIndustryAwards(state, rng));
  tickMoonshots(state, rng);
  tickCEOs(state, rng);
  tickCrypto(state, rng);
  for (const l of checkLimitOrders(state)) log(state, l, 'money');
  for (const l of tickMargin(state)) log(state, l, 'bad');

  // 4. The player's own year
  tickPlayerLife(state, rng);
  if (state.player.alive) tickFamily(state, rng);
  if (state.player.alive) tickChallenge(state, rng);
  if (state.player.alive) for (const h of tickLifestyleAssets(state, rng)) log(state, h, 'money');
  if (state.player.alive) tickPersonalFinance(state, rng);

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
  const netWorthEnd = netWorth(state);
  state.netWorthHistory.push({ year: state.year, value: netWorthEnd });
  state.yearRecap = {
    year: yearBefore,
    netWorthStart,
    netWorthEnd,
    headlines: [...politicalHeadlines.slice(0, 3), ...businessHeadlines.slice(0, 2)],
  };
  gameOverCheck(state);

  // Milestone achievements
  const worth = state.netWorthHistory[state.netWorthHistory.length - 1].value;
  const ownedCompanies = p.companies.map((id) => state.companies[id]).filter((c) => c && c.status === 'active');
  const milestones: [string, boolean][] = [
    ['millionaire', worth >= 1e6],
    ['deca_millionaire', worth >= 1e7],
    ['billionaire', worth >= 1e9],
    ['centenarian', p.age >= 100],
    ['centa_millionaire', worth >= 1e8],
    ['multi_billionaire', worth >= 1e10],
    ['nonagenarian', p.age >= 90],
    ['centenarian_elite', p.age >= 110],
    ['renaissance_mind', Object.values(p.skills).filter((v) => v >= 80).length >= 5],
    ['health_nut', p.health >= 98],
    ['zen_master', p.happiness >= 98],
    ['company_empire', ownedCompanies.length >= 5],
    ['public_company_mogul', ownedCompanies.filter((c) => c.isPublic).length >= 3],
    ['notorious', p.notoriety >= 90],
    ['paragon', p.reputation >= 90 && p.karma >= 80],
    ['property_baron', p.properties.length >= 10],
    ['portfolio_titan', portfolioValue(state) >= 1e7],
    ['patent_powerhouse', ownedCompanies.reduce((s, c) => s + c.patents, 0) >= 10],
    ['trademark_empire', ownedCompanies.reduce((s, c) => s + c.trademarks, 0) >= 10],
    ['grand_dynasty', state.generation >= 3],
    ['big_family_tree', p.grandchildren.length >= 3],
    ['ironman_survivor', state.difficulty === 'ironman' && p.alive && p.age >= 70],
    ['lifelong_learner', p.education.length >= 3],
    ['luxury_collector', p.luxuryAssets.length >= 3],
    ['debt_free', p.loans.length === 0 && p.age >= 30],
    ['ten_skills_mastered', Object.values(p.skills).filter((v) => v >= 50).length >= 10],
    ['crime_free_life', p.age >= 50 && p.criminalRecord === 0 && p.notoriety === 0],
    ['happily_married', !!p.spouseId && p.divorceCount === 0 && p.age >= 40],
    ['serial_entrepreneur', Object.values(state.companies).filter((c) => c.founderId === 'player').length >= 5],
    ['influence_peddler', p.influence >= 90],
    ['silver_tongue', p.charisma >= 95],
    ['saint', p.karma >= 98],
    ['iron_will', p.karma <= 5 && p.age >= 40],
    ['polyglot_scholar', (p.skills[SK.foreignLanguages] ?? 0) >= 90],
    ['market_whale', portfolioValue(state) >= 5e7],
    ['ten_year_veteran_ceo', ownedCompanies.some((c) => state.year - c.foundedYear >= 10)],
    ['unbreakable', p.health >= 90 && p.age >= 80],
    ['jetsetter', p.luxuryAssets.some((a) => a.kind === 'private_jet')],
    ['island_life', p.luxuryAssets.some((a) => a.kind === 'island')],
    ['crypto_millionaire', p.cryptoUnits * state.cryptoPrice >= 1e6],
  ];
  const MILESTONE_LOG: Record<string, string> = {
    millionaire: '🏆 You are a millionaire!',
    deca_millionaire: '🏆 Your net worth passed $10 million.',
    billionaire: '🏆 BILLIONAIRE. You have joined the ten-figure club.',
    centenarian: '🏆 You turned 100 years old.',
    centa_millionaire: '🏆 Your net worth passed $100 million.',
    multi_billionaire: '🏆 Your net worth passed $10 billion.',
    nonagenarian: '🏆 You turned 90 years old.',
    centenarian_elite: '🏆 You turned 110 years old.',
    renaissance_mind: '🏆 Five skills mastered above 80 — a true renaissance mind.',
    health_nut: '🏆 Peak physical health.',
    zen_master: '🏆 Blissfully, serenely happy.',
    company_empire: '🏆 You control an empire of 5+ active companies.',
    public_company_mogul: '🏆 You control 3+ publicly listed companies.',
    notorious: '🏆 Your notoriety has reached legendary levels.',
    paragon: '🏆 A paragon of reputation and character.',
    property_baron: '🏆 You own 10+ properties.',
    portfolio_titan: '🏆 Your stock portfolio passed $10 million.',
    patent_powerhouse: '🏆 Your companies hold 10+ patents.',
    trademark_empire: '🏆 Your companies hold 10+ trademarks.',
    grand_dynasty: '🏆 Your dynasty has reached its third generation.',
    big_family_tree: '🏆 You have 3+ grandchildren.',
    ironman_survivor: '🏆 Survived to 70 on Iron Man difficulty.',
    lifelong_learner: '🏆 Earned three or more degrees.',
    luxury_collector: '🏆 Assembled a collection of 3+ luxury assets.',
    debt_free: '🏆 Debt-free with decades of life ahead of you.',
    ten_skills_mastered: '🏆 Ten or more skills above 50.',
    crime_free_life: '🏆 Fifty years old with a spotless record.',
    happily_married: '🏆 Happily married for the long haul.',
    serial_entrepreneur: '🏆 Founded five or more companies.',
    influence_peddler: '🏆 Your influence has reached elite levels.',
    silver_tongue: '🏆 A truly silver tongue.',
    saint: '🏆 A saintly reputation for good.',
    iron_will: '🏆 An iron will, unmoved by conscience.',
    polyglot_scholar: '🏆 Mastered foreign languages.',
    market_whale: '🏆 Your stock portfolio passed $50 million.',
    ten_year_veteran_ceo: '🏆 Run a company for ten years or more.',
    unbreakable: '🏆 Peak health at 80 years old.',
    jetsetter: '🏆 You own a private jet.',
    island_life: '🏆 You own a private island.',
    crypto_millionaire: '🏆 Your crypto holdings passed $1 million.',
  };
  for (const [key, hit] of milestones) {
    if (hit && !state.achievements.includes(key)) {
      state.achievements.push(key);
      if (MILESTONE_LOG[key]) log(state, MILESTONE_LOG[key], 'milestone');
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
