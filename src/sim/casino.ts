/**
 * Casino: named slot machines with a real progressive jackpot pool (sim/types.ts
 * GameState.casinoJackpots), plus the table games (blackjack, roulette, poker). Every game keeps
 * a genuine house edge — skill narrows it but never flips it in the player's favor, the same
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

export type TableGame = 'blackjack' | 'roulette' | 'poker';

export function playTableGame(state: GameState, game: TableGame, stake: number): SlotSpinResult {
  const p = state.player;
  if (stake <= 0 || stake > p.money) return { ok: false, message: 'Invalid stake.', outcome: 'bust', payout: 0 };
  const rng = withRng(state);
  p.money -= stake;
  p.casinoTotalWagered += stake;
  const pokerEdge = (p.skills[SK.poker] ?? 0) / 100;
  let winChance: number;
  let payoutMult: number;
  if (game === 'blackjack') {
    // Skill narrows the house edge but never flips it: capped at 0.49 so a 2x payout always
    // keeps expected value below the stake, no matter how maxed poker skill gets.
    winChance = clamp(0.42 + pokerEdge * 0.07, 0.3, 0.49);
    payoutMult = 2;
  } else if (game === 'poker') {
    winChance = clamp(0.4 + pokerEdge * 0.09, 0.28, 0.48);
    payoutMult = 2;
  } else {
    winChance = 0.47;
    payoutMult = 2;
  }
  const won = rng.chance(winChance);
  p.skills[SK.poker] = clamp100((p.skills[SK.poker] ?? 0) + 1);
  const winnings = won ? Math.round(stake * payoutMult) : 0;
  if (won) p.money += winnings;
  p.happiness = clamp100(p.happiness + (won ? 3 : -2));
  if (winnings > p.casinoBiggestWin) p.casinoBiggestWin = winnings;
  commit(state, rng);
  const label = game === 'blackjack' ? 'blackjack' : game === 'poker' ? 'poker' : 'roulette';
  if (won) {
    if (winnings - stake >= 50_000 && !state.achievements.includes('high_roller')) state.achievements.push('high_roller');
    log(state, `🃏 Won $${(winnings - stake).toLocaleString()} at the casino (${label}).`, 'money');
    return { ok: true, message: `You won $${(winnings - stake).toLocaleString()}!`, outcome: 'small', payout: winnings };
  }
  log(state, `🃏 Lost $${stake.toLocaleString()} at the casino (${label}).`, 'bad');
  return { ok: true, message: `The house took your $${stake.toLocaleString()}.`, outcome: 'bust', payout: 0 };
}
