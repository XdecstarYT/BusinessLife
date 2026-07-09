/**
 * Casino: named slot machines with a real progressive jackpot pool (sim/types.ts
 * GameState.casinoJackpots), a real European-rules roulette wheel (37 pockets, real bet types
 * and payouts), a coin-flip table, and card tables (blackjack, poker). Every game keeps a
 * genuine house edge — skill narrows it but never flips it in the player's favor, the same
 * principle a real casino runs on.
 */
import type { GameState } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { SK } from '../data/skills';
import { SLOT_MACHINE_BY_ID, VOLATILITY_PROFILE } from '../data/casino';
import { log } from './engine';

// Local copy of actions.ts's RNG-draw pattern (same `seed`/`rngState` fields) — not imported
// from there since actions.ts doesn't export these two, and duplicating two one-liners here
// avoids adding a module dependency for it.
function withRng(state: GameState): RNG {
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  return rng;
}
function commit(state: GameState, rng: RNG): void {
  state.rngState = rng.state;
}

export interface SlotSpinResult {
  ok: boolean;
  message: string;
  outcome: 'bust' | 'small' | 'big' | 'jackpot';
  payout: number;
}

export function spinSlotMachine(state: GameState, machineId: string, bet: number): SlotSpinResult {
  const p = state.player;
  const def = SLOT_MACHINE_BY_ID[machineId];
  if (!def) return { ok: false, message: 'Unknown machine.', outcome: 'bust', payout: 0 };
  if (def.vipLiquidity > 0 && p.money + p.savingsBalance < def.vipLiquidity) {
    return { ok: false, message: `VIP room — needs $${def.vipLiquidity.toLocaleString()}+ in cash and savings.`, outcome: 'bust', payout: 0 };
  }
  if (bet < def.minBet || bet > def.maxBet) {
    return { ok: false, message: `Bet must be between $${def.minBet.toLocaleString()} and $${def.maxBet.toLocaleString()}.`, outcome: 'bust', payout: 0 };
  }
  if (bet > p.money) return { ok: false, message: 'Not enough cash.', outcome: 'bust', payout: 0 };

  const rng = withRng(state);
  p.money -= bet;
  p.casinoTotalWagered += bet;
  if (state.casinoJackpots[machineId] === undefined) state.casinoJackpots[machineId] = def.jackpotSeed;

  const v = VOLATILITY_PROFILE[def.volatility];
  const roll = rng.next();
  let outcome: SlotSpinResult['outcome'];
  let payout = 0;
  if (roll < v.jackpotChance) {
    outcome = 'jackpot';
    payout = state.casinoJackpots[machineId];
    state.casinoJackpots[machineId] = def.jackpotSeed;
  } else if (roll < v.jackpotChance + v.bigChance) {
    outcome = 'big';
    payout = Math.round(bet * v.bigMult);
    state.casinoJackpots[machineId] += bet * def.jackpotContribRate;
  } else if (roll < v.jackpotChance + v.bigChance + v.smallChance) {
    outcome = 'small';
    payout = Math.round(bet * v.smallMult);
    state.casinoJackpots[machineId] += bet * def.jackpotContribRate;
  } else {
    outcome = 'bust';
    state.casinoJackpots[machineId] += bet * def.jackpotContribRate;
  }
  p.money += payout;
  p.happiness = clamp100(p.happiness + (outcome === 'bust' ? -1 : outcome === 'jackpot' ? 12 : 3));
  if (payout > p.casinoBiggestWin) p.casinoBiggestWin = payout;
  commit(state, rng);

  if (outcome === 'jackpot') {
    if (!state.achievements.includes('jackpot_winner')) state.achievements.push('jackpot_winner');
    log(state, `🎰 JACKPOT on ${def.name}! $${Math.round(payout).toLocaleString()} paid out.`, 'money');
    return { ok: true, message: `JACKPOT! You won $${Math.round(payout).toLocaleString()}!`, outcome, payout };
  }
  if (outcome === 'big') {
    log(state, `🎰 Big win on ${def.name}: $${Math.round(payout - bet).toLocaleString()}.`, 'money');
    return { ok: true, message: `Big win! +$${Math.round(payout - bet).toLocaleString()}.`, outcome, payout };
  }
  if (outcome === 'small') {
    log(state, `🎰 Small win on ${def.name}: $${Math.round(payout - bet).toLocaleString()}.`, 'money');
    return { ok: true, message: `You won $${Math.round(payout - bet).toLocaleString()}.`, outcome, payout };
  }
  log(state, `🎰 Lost $${bet.toLocaleString()} on ${def.name}.`, 'bad');
  return { ok: true, message: `The house took your $${bet.toLocaleString()}.`, outcome, payout };
}

export type TableGame = 'blackjack' | 'poker';

export function playTableGame(state: GameState, game: TableGame, stake: number): SlotSpinResult {
  const p = state.player;
  if (stake <= 0 || stake > p.money) return { ok: false, message: 'Invalid stake.', outcome: 'bust', payout: 0 };
  const rng = withRng(state);
  p.money -= stake;
  p.casinoTotalWagered += stake;
  const pokerEdge = (p.skills[SK.poker] ?? 0) / 100;
  let winChance: number;
  const payoutMult = 2;
  if (game === 'blackjack') {
    // Skill narrows the house edge but never flips it: capped at 0.49 so a 2x payout always
    // keeps expected value below the stake, no matter how maxed poker skill gets.
    winChance = clamp(0.42 + pokerEdge * 0.07, 0.3, 0.49);
  } else {
    winChance = clamp(0.4 + pokerEdge * 0.09, 0.28, 0.48);
  }
  const won = rng.chance(winChance);
  p.skills[SK.poker] = clamp100((p.skills[SK.poker] ?? 0) + 1);
  const winnings = won ? Math.round(stake * payoutMult) : 0;
  if (won) p.money += winnings;
  p.happiness = clamp100(p.happiness + (won ? 3 : -2));
  if (winnings > p.casinoBiggestWin) p.casinoBiggestWin = winnings;
  commit(state, rng);
  const label = game === 'blackjack' ? 'blackjack' : 'poker';
  if (won) {
    if (winnings - stake >= 50_000 && !state.achievements.includes('high_roller')) state.achievements.push('high_roller');
    log(state, `🃏 Won $${(winnings - stake).toLocaleString()} at the casino (${label}).`, 'money');
    return { ok: true, message: `You won $${(winnings - stake).toLocaleString()}!`, outcome: 'small', payout: winnings };
  }
  log(state, `🃏 Lost $${stake.toLocaleString()} at the casino (${label}).`, 'bad');
  return { ok: true, message: `The house took your $${stake.toLocaleString()}.`, outcome: 'bust', payout: 0 };
}

// ---------------------------------------------------------------------------
// Coin flip — the simplest table in the house: a genuinely fair 50/50 coin,
// with the house edge living entirely in a sub-2x payout rather than a rigged coin.
// ---------------------------------------------------------------------------

export type CoinSide = 'heads' | 'tails';
export interface CoinFlipResult extends SlotSpinResult {
  landed: CoinSide;
}

const COIN_PAYOUT_MULT = 1.92; // ~96% RTP on a true 50/50 coin

export function playCoinFlip(state: GameState, side: CoinSide, stake: number): CoinFlipResult {
  const p = state.player;
  if (stake <= 0 || stake > p.money) return { ok: false, message: 'Invalid stake.', outcome: 'bust', payout: 0, landed: 'heads' };
  const rng = withRng(state);
  p.money -= stake;
  p.casinoTotalWagered += stake;
  const landed: CoinSide = rng.chance(0.5) ? 'heads' : 'tails';
  const won = landed === side;
  const payout = won ? Math.round(stake * COIN_PAYOUT_MULT) : 0;
  if (won) p.money += payout;
  p.happiness = clamp100(p.happiness + (won ? 2 : -1));
  if (payout > p.casinoBiggestWin) p.casinoBiggestWin = payout;
  commit(state, rng);
  if (won) {
    log(state, `🪙 Coin landed on ${landed} — won $${(payout - stake).toLocaleString()}.`, 'money');
    return { ok: true, message: `${landed === 'heads' ? 'Heads' : 'Tails'}! You won $${(payout - stake).toLocaleString()}.`, outcome: 'small', payout, landed };
  }
  log(state, `🪙 Coin landed on ${landed} — lost $${stake.toLocaleString()}.`, 'bad');
  return { ok: true, message: `${landed === 'heads' ? 'Heads' : 'Tails'}. The house took your $${stake.toLocaleString()}.`, outcome: 'bust', payout: 0, landed };
}

// ---------------------------------------------------------------------------
// Roulette — real European single-zero rules: 37 pockets (0-36), even-money
// outside bets pay 2x at 18/37 odds, a straight-up number pays 36x at 1/37 odds.
// Both work out to the same real-world ~97.3% RTP — a low, honest house edge.
// ---------------------------------------------------------------------------

export const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type RouletteBetKind = 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'straight';
export interface RouletteBet {
  kind: RouletteBetKind;
  number?: number; // 0..36, required for 'straight'
}
export interface RouletteResult extends SlotSpinResult {
  landedNumber: number;
  landedColor: 'red' | 'black' | 'green';
}

export function rouletteNumberColor(n: number): 'red' | 'black' | 'green' {
  return n === 0 ? 'green' : ROULETTE_RED_NUMBERS.has(n) ? 'red' : 'black';
}

export function spinRoulette(state: GameState, bet: RouletteBet, stake: number): RouletteResult {
  const p = state.player;
  if (stake <= 0 || stake > p.money) return { ok: false, message: 'Invalid stake.', outcome: 'bust', payout: 0, landedNumber: 0, landedColor: 'green' };
  if (bet.kind === 'straight' && (bet.number === undefined || bet.number < 0 || bet.number > 36)) {
    return { ok: false, message: 'Pick a number 0-36 to bet on.', outcome: 'bust', payout: 0, landedNumber: 0, landedColor: 'green' };
  }
  const rng = withRng(state);
  p.money -= stake;
  p.casinoTotalWagered += stake;
  const landedNumber = rng.int(0, 36);
  const landedColor = rouletteNumberColor(landedNumber);

  let won = false;
  let mult = 0;
  switch (bet.kind) {
    case 'red': won = landedColor === 'red'; mult = 2; break;
    case 'black': won = landedColor === 'black'; mult = 2; break;
    case 'odd': won = landedNumber !== 0 && landedNumber % 2 === 1; mult = 2; break;
    case 'even': won = landedNumber !== 0 && landedNumber % 2 === 0; mult = 2; break;
    case 'low': won = landedNumber >= 1 && landedNumber <= 18; mult = 2; break;
    case 'high': won = landedNumber >= 19 && landedNumber <= 36; mult = 2; break;
    case 'straight': won = landedNumber === bet.number; mult = 36; break;
  }
  const payout = won ? Math.round(stake * mult) : 0;
  if (won) p.money += payout;
  p.happiness = clamp100(p.happiness + (won ? 3 : -2));
  if (payout > p.casinoBiggestWin) p.casinoBiggestWin = payout;
  commit(state, rng);

  const pocketLabel = `${landedNumber}${landedColor !== 'green' ? ` ${landedColor}` : ' (green)'}`;
  if (won) {
    if (payout - stake >= 50_000 && !state.achievements.includes('high_roller')) state.achievements.push('high_roller');
    log(state, `🎡 Roulette landed on ${pocketLabel} — won $${(payout - stake).toLocaleString()}.`, 'money');
    return { ok: true, message: `Ball landed on ${pocketLabel}! You won $${(payout - stake).toLocaleString()}.`, outcome: 'small', payout, landedNumber, landedColor };
  }
  log(state, `🎡 Roulette landed on ${pocketLabel} — lost $${stake.toLocaleString()}.`, 'bad');
  return { ok: true, message: `Ball landed on ${pocketLabel}. The house took your $${stake.toLocaleString()}.`, outcome: 'bust', payout: 0, landedNumber, landedColor };
}
