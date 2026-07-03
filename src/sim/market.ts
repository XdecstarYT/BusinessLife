/**
 * Stock market simulation. Public companies trade at prices driven by
 * fundamentals (earnings vs. analyst expectations), the macro equity index,
 * sentiment/momentum, short interest and noise. The player can buy, sell and
 * short-sell shares; dividends are paid from company profits.
 */
import type { Company, GameState } from './types';
import { clamp } from './types';
import type { RNG } from './rng';
import { INDUSTRY_BY_ID } from '../data/industries';

export function peRatio(c: Company): number | null {
  if (!c.isPublic || c.profit <= 0) return null;
  const eps = c.profit / c.sharesOutstanding;
  return c.sharePrice / eps;
}

export function marketCap(c: Company): number {
  return c.isPublic ? c.sharePrice * c.sharesOutstanding : 0;
}

/** Take a private company public. Returns cash raised into the company. */
export function doIPO(c: Company, rng: RNG): number {
  const value = Math.max(c.revenue * 1.5, c.profit * 14) + c.assets - c.debt;
  const hype = rng.range(0.8, 1.4);
  const priced = Math.max(1_000_000, value * hype);
  // Sell 25% new shares to the market.
  const newShares = Math.round(c.sharesOutstanding / 3);
  const raise = (priced / (c.sharesOutstanding + newShares)) * newShares;
  c.sharesOutstanding += newShares;
  c.playerSharePct = c.playerOwned ? c.playerSharePct * (c.sharesOutstanding - newShares) / c.sharesOutstanding : 0;
  c.isPublic = true;
  c.sharePrice = priced / c.sharesOutstanding;
  c.cash += raise;
  c.institutionalOwnPct = rng.range(0.2, 0.5);
  c.analystExpectation = Math.max(c.profit * 1.1, c.revenue * 0.06);
  return raise;
}

export function tickStock(c: Company, state: GameState, rng: RNG): void {
  if (!c.isPublic || c.status !== 'active') return;
  const country = state.countries.find((k) => k.id === c.countryId)!;
  const e = country.economy;
  const ind = INDUSTRY_BY_ID[c.industryId];

  // Earnings surprise vs. analyst expectation
  const expected = c.analystExpectation || Math.max(c.revenue * 0.05, 1);
  const surprise = clamp((c.profit - expected) / Math.max(Math.abs(expected), 1), -1.5, 1.5);

  const marketDrift = (e.stockIndex / Math.max(1, e.history.length ? e.history[Math.max(0, e.history.length - 2)]?.stockIndex ?? 100 : 100)) - 1;
  const momentum = c.history.length >= 2 && c.history[c.history.length - 1].sharePrice && c.history[c.history.length - 2].sharePrice
    ? clamp(((c.history[c.history.length - 1].sharePrice! / c.history[c.history.length - 2].sharePrice!) - 1) * 0.3, -0.1, 0.1)
    : 0;

  let drift =
    surprise * 0.25 +
    marketDrift * 0.8 +
    momentum +
    (c.brand - 50) * 0.001 +
    rng.normal(0, ind.volatility * 0.35);

  // Squeeze mechanics: heavy short interest amplifies moves.
  drift *= 1 + c.shortInterest * 0.5 * (drift > 0 ? 1 : 1.3);
  c.sharePrice = Math.max(0.01, c.sharePrice * (1 + clamp(drift, -0.7, 1.5)));

  // Shorts drift with valuation heat.
  const pe = peRatio(c);
  c.shortInterest = clamp(c.shortInterest + (pe !== null && pe > 40 ? 0.03 : -0.02) + rng.range(-0.02, 0.02), 0, 0.5);
  c.institutionalOwnPct = clamp(c.institutionalOwnPct + rng.range(-0.03, 0.03) + surprise * 0.02, 0.05, 0.9);

  // Analysts update expectations
  c.analystExpectation = c.profit * rng.range(1.0, 1.15) * (e.regime === 'boom' ? 1.1 : e.regime === 'recession' ? 0.9 : 1);

  // Dividends
  if (c.profit > 0 && c.dividendPayoutPct > 0) {
    const totalDividend = c.profit * c.dividendPayoutPct;
    c.cash -= totalDividend;
    // Player receives dividends via portfolio pass (store) and founder stake:
    const player = state.player;
    if (c.playerOwned && c.playerSharePct > 0) {
      player.money += totalDividend * c.playerSharePct;
    }
    const holding = player.portfolio.find((h) => h.companyId === c.id && h.shares > 0);
    if (holding) {
      player.money += (totalDividend / c.sharesOutstanding) * holding.shares;
    }
  }
}

export interface TradeResult {
  ok: boolean;
  message: string;
}

export function buyShares(state: GameState, companyId: string, spend: number): TradeResult {
  const c = state.companies[companyId];
  const p = state.player;
  if (!c?.isPublic || c.status !== 'active') return { ok: false, message: 'Not tradable.' };
  if (spend <= 0 || spend > p.money) return { ok: false, message: 'Not enough cash.' };
  const shares = Math.floor(spend / c.sharePrice);
  if (shares < 1) return { ok: false, message: 'Cannot afford a single share.' };
  const cost = shares * c.sharePrice;
  p.money -= cost;
  const existing = p.portfolio.find((h) => h.companyId === companyId && h.shares > 0);
  if (existing) {
    existing.costBasis = (existing.costBasis * existing.shares + cost) / (existing.shares + shares);
    existing.shares += shares;
  } else {
    p.portfolio.push({ companyId, shares, costBasis: c.sharePrice });
  }
  return { ok: true, message: `Bought ${shares.toLocaleString()} shares of ${c.name}.` };
}

export function sellShares(state: GameState, companyId: string, fraction: number): TradeResult {
  const c = state.companies[companyId];
  const p = state.player;
  const h = p.portfolio.find((x) => x.companyId === companyId && x.shares > 0);
  if (!c || !h) return { ok: false, message: 'No position.' };
  const toSell = Math.max(1, Math.floor(h.shares * fraction));
  const proceeds = toSell * c.sharePrice;
  const gain = (c.sharePrice - h.costBasis) * toSell;
  const country = state.countries.find((k) => k.id === p.countryId)!;
  const tax = gain > 0 ? gain * country.economy.taxRates.capitalGains : 0;
  p.money += proceeds - tax;
  h.shares -= toSell;
  p.portfolio = p.portfolio.filter((x) => x.shares !== 0);
  return { ok: true, message: `Sold ${toSell.toLocaleString()} shares for ${Math.round(proceeds).toLocaleString()}.` };
}

export function shortShares(state: GameState, companyId: string, exposure: number): TradeResult {
  const c = state.companies[companyId];
  const p = state.player;
  if (!c?.isPublic || c.status !== 'active') return { ok: false, message: 'Not tradable.' };
  // Require 50% margin
  if (exposure > p.money * 2) return { ok: false, message: 'Insufficient margin (50% required).' };
  const shares = Math.floor(exposure / c.sharePrice);
  if (shares < 1) return { ok: false, message: 'Exposure too small.' };
  p.money += shares * c.sharePrice; // proceeds credited; owed shares recorded as negative
  const existing = p.portfolio.find((h) => h.companyId === companyId && h.shares < 0);
  if (existing) {
    existing.costBasis = (existing.costBasis * -existing.shares + shares * c.sharePrice) / (-existing.shares + shares);
    existing.shares -= shares;
  } else {
    p.portfolio.push({ companyId, shares: -shares, costBasis: c.sharePrice });
  }
  c.shortInterest = clamp(c.shortInterest + 0.02, 0, 0.6);
  return { ok: true, message: `Shorted ${shares.toLocaleString()} shares of ${c.name}.` };
}

export function coverShort(state: GameState, companyId: string, fraction: number): TradeResult {
  const c = state.companies[companyId];
  const p = state.player;
  const h = p.portfolio.find((x) => x.companyId === companyId && x.shares < 0);
  if (!c || !h) return { ok: false, message: 'No short position.' };
  const toCover = Math.max(1, Math.floor(-h.shares * fraction));
  const cost = toCover * c.sharePrice;
  if (cost > p.money) return { ok: false, message: 'Not enough cash to cover.' };
  p.money -= cost;
  h.shares += toCover;
  p.portfolio = p.portfolio.filter((x) => x.shares !== 0);
  return { ok: true, message: `Covered ${toCover.toLocaleString()} shares.` };
}

/** Net liquidation value of the player's portfolio. */
export function portfolioValue(state: GameState): number {
  let total = 0;
  for (const h of state.player.portfolio) {
    const c = state.companies[h.companyId];
    if (!c) continue;
    const price = c.status === 'active' && c.isPublic ? c.sharePrice : 0;
    if (h.shares > 0) total += h.shares * price;
    else total += h.shares * price + -h.shares * h.costBasis * 1.5; // short: margin held minus liability
  }
  return total;
}
