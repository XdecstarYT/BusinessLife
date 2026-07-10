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

/** Take a private company public. `ipoYear` defaults to the founding year (for world-gen
 * backstory companies whose IPO predates play, so they never render as "under construction");
 * pass the current game year for a real player/NPC IPO that happens mid-game. */
export function doIPO(c: Company, rng: RNG, ipoYear?: number): number {
  const value = Math.max(c.revenue * 1.5, c.profit * 14) + c.assets - c.debt;
  const hype = rng.range(0.8, 1.4);
  const priced = Math.max(1_000_000, value * hype);
  // Sell 25% new shares to the market.
  const newShares = Math.round(c.sharesOutstanding / 3);
  const raise = (priced / (c.sharesOutstanding + newShares)) * newShares;
  c.sharesOutstanding += newShares;
  c.playerSharePct = c.playerOwned ? c.playerSharePct * (c.sharesOutstanding - newShares) / c.sharesOutstanding : 0;
  c.isPublic = true;
  c.ipoYear = ipoYear ?? c.foundedYear;
  c.sharePrice = priced / c.sharesOutstanding;
  c.cash += raise;
  c.institutionalOwnPct = rng.range(0.2, 0.5);
  c.analystExpectation = Math.max(c.profit * 1.1, c.revenue * 0.06);
  return raise;
}

/** True through the calendar year after ipoYear — the "under construction" window during
 * which a freshly-public company's HQ building hasn't finished going up on the city map yet. */
export function isBuildingUnderConstruction(c: Company, year: number): boolean {
  return c.isPublic && c.ipoYear !== null && year <= c.ipoYear;
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
      const payout = (totalDividend / c.sharesOutstanding) * holding.shares;
      if (player.drip) {
        // Dividend reinvestment plan: buy more shares instead of taking cash.
        const newShares = Math.floor(payout / c.sharePrice);
        if (newShares > 0) {
          const cost = newShares * c.sharePrice;
          holding.costBasis = (holding.costBasis * holding.shares + cost) / (holding.shares + newShares);
          holding.shares += newShares;
          player.money += payout - cost;
        } else {
          player.money += payout;
        }
      } else {
        player.money += payout;
      }
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

/** Value-neutral share retirement for NPC companies (mirrors the player-facing buybackShares in
 * actions.ts — same "no price bump" math, see that function's comment for why). Not exported:
 * only ever called from the yearly lifecycle tick below, never directly by the player. */
function npcBuyback(c: Company, spend: number): void {
  if (spend <= 0 || spend > c.cash) return;
  const sharesRetired = spend / c.sharePrice;
  if (sharesRetired >= c.sharesOutstanding * 0.5) return;
  c.cash -= spend;
  c.sharesOutstanding -= sharesRetired;
}

/** Yearly stock-lifecycle pass: splits shares when the price runs too high for a healthy float
 * (keeps per-share prices in a readable band over long playthroughs instead of drifting into the
 * tens of thousands), and lets cash-rich mature NPC public companies occasionally retire their own
 * stock the same way the player can via actions.ts's buybackShares. */
export function tickStockLifecycle(state: GameState, rng: RNG): string[] {
  const logs: string[] = [];
  for (const c of Object.values(state.companies)) {
    if (!c.isPublic || c.status !== 'active') continue;

    if (c.sharePrice >= 400) {
      const ratio = c.sharePrice >= 2000 ? 10 : 4;
      c.sharePrice /= ratio;
      c.sharesOutstanding *= ratio;
      for (const h of state.player.portfolio) {
        if (h.companyId !== c.id) continue;
        h.shares *= ratio;
        h.costBasis /= ratio;
      }
      for (const o of state.player.limitOrders) {
        if (o.companyId === c.id) o.targetPrice /= ratio;
      }
      if (c.playerOwned || state.player.portfolio.some((h) => h.companyId === c.id)) {
        logs.push(`${c.name} splits its stock ${ratio}-for-1.`);
      }
      continue;
    }

    if (!c.playerOwned && c.cash > c.revenue * 0.5 && c.profit > 0 && rng.chance(0.05)) {
      npcBuyback(c, c.cash * rng.range(0.05, 0.15));
    }
  }
  return logs;
}

/** Buy shares partly with borrowed money. Buying power = cash + 50% of current long portfolio value. */
export function buyOnMargin(state: GameState, companyId: string, spend: number): TradeResult {
  const c = state.companies[companyId];
  const p = state.player;
  if (!c?.isPublic || c.status !== 'active') return { ok: false, message: 'Not tradable.' };
  if (spend <= 0) return { ok: false, message: 'Invalid amount.' };
  const maxBorrow = Math.max(0, longPortfolioValue(state) * 0.5 - p.marginDebt);
  const available = p.money + maxBorrow;
  if (spend > available) return { ok: false, message: 'Exceeds available margin buying power.' };
  const borrow = Math.max(0, spend - p.money);
  p.money -= Math.min(p.money, spend);
  p.marginDebt += borrow;
  const shares = Math.floor(spend / c.sharePrice);
  if (shares < 1) return { ok: false, message: 'Cannot afford a single share.' };
  const cost = shares * c.sharePrice;
  const existing = p.portfolio.find((h) => h.companyId === companyId && h.shares > 0);
  if (existing) {
    existing.costBasis = (existing.costBasis * existing.shares + cost) / (existing.shares + shares);
    existing.shares += shares;
  } else {
    p.portfolio.push({ companyId, shares, costBasis: c.sharePrice });
  }
  return { ok: true, message: `Bought ${shares.toLocaleString()} shares of ${c.name} on margin (${money0(borrow)} borrowed).` };
}

function money0(v: number): string {
  return `$${Math.round(v).toLocaleString()}`;
}

function longPortfolioValue(state: GameState): number {
  let total = 0;
  for (const h of state.player.portfolio) {
    if (h.shares <= 0) continue;
    const c = state.companies[h.companyId];
    if (c?.status === 'active' && c.isPublic) total += h.shares * c.sharePrice;
  }
  return total;
}

/** Yearly margin upkeep: charge interest, and force-liquidate if below the maintenance margin. */
export function tickMargin(state: GameState): string[] {
  const p = state.player;
  const logs: string[] = [];
  if (p.marginDebt <= 0) return logs;
  const home = state.countries.find((c) => c.id === p.countryId);
  const rate = (home?.economy.interestRate ?? 0.04) + 0.04;
  const interest = p.marginDebt * rate;
  p.money -= interest;
  logs.push(`Paid $${Math.round(interest).toLocaleString()} in margin interest.`);
  const longValue = longPortfolioValue(state);
  if (longValue < p.marginDebt * 1.25) {
    // Margin call: force-sell long positions until the debt is covered.
    const longs = p.portfolio.filter((h) => h.shares > 0);
    for (const h of longs) {
      if (p.marginDebt <= 0) break;
      const c = state.companies[h.companyId];
      if (!c || !c.isPublic || c.status !== 'active') continue;
      const toSell = h.shares;
      const proceeds = toSell * c.sharePrice;
      p.money += proceeds;
      h.shares = 0;
      const repay = Math.min(p.marginDebt, proceeds);
      p.money -= repay;
      p.marginDebt -= repay;
    }
    p.portfolio = p.portfolio.filter((x) => x.shares !== 0);
    logs.push(`🚨 Margin call! Positions were liquidated to cover $${Math.round(p.marginDebt).toLocaleString()} of remaining debt.`);
  }
  return logs;
}

/** Check standing limit orders against current prices and execute any that trigger. */
export function checkLimitOrders(state: GameState): string[] {
  const p = state.player;
  if (!p.limitOrders.length) return [];
  const logs: string[] = [];
  const remaining: typeof p.limitOrders = [];
  for (const order of p.limitOrders) {
    const c = state.companies[order.companyId];
    if (!c || !c.isPublic || c.status !== 'active') continue;
    const triggered = order.kind === 'buy' ? c.sharePrice <= order.targetPrice : c.sharePrice >= order.targetPrice;
    if (!triggered) {
      remaining.push(order);
      continue;
    }
    if (order.kind === 'buy') {
      const res = buyShares(state, order.companyId, Math.min(order.amount, p.money));
      logs.push(`Limit order triggered: ${res.message}`);
    } else {
      const holding = p.portfolio.find((h) => h.companyId === order.companyId && h.shares > 0);
      if (holding) {
        const fraction = clamp(order.amount / (holding.shares * c.sharePrice), 0, 1);
        const res = sellShares(state, order.companyId, fraction);
        logs.push(`Limit order triggered: ${res.message}`);
      }
    }
  }
  p.limitOrders = remaining;
  return logs;
}

let limitOrderCounter = 0;

export function placeLimitOrder(state: GameState, companyId: string, kind: 'buy' | 'sell', targetPrice: number, amount: number): TradeResult {
  const c = state.companies[companyId];
  const p = state.player;
  if (!c?.isPublic || c.status !== 'active') return { ok: false, message: 'Not tradable.' };
  if (targetPrice <= 0 || amount <= 0) return { ok: false, message: 'Invalid order.' };
  if (p.limitOrders.length >= 10) return { ok: false, message: 'Maximum of 10 standing limit orders.' };
  limitOrderCounter = Math.max(limitOrderCounter, p.limitOrders.length) + 1;
  p.limitOrders.push({ id: `limit_${state.year}_${limitOrderCounter}`, companyId, kind, targetPrice, amount });
  return { ok: true, message: `Limit ${kind} order placed for ${c.name} at $${targetPrice.toFixed(2)}.` };
}

export function cancelLimitOrder(state: GameState, orderId: string): TradeResult {
  const p = state.player;
  if (!p.limitOrders.some((o) => o.id === orderId)) return { ok: false, message: 'Order not found.' };
  p.limitOrders = p.limitOrders.filter((o) => o.id !== orderId);
  return { ok: true, message: 'Limit order cancelled.' };
}

export function toggleDrip(state: GameState): TradeResult {
  state.player.drip = !state.player.drip;
  return { ok: true, message: state.player.drip ? 'Dividend reinvestment enabled.' : 'Dividend reinvestment disabled.' };
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
