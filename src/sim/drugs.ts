/**
 * Drug Empire: buy/produce/sell product, build out a stash house/grow house/meth lab, recruit
 * street dealers, and fight for corners — a self-contained leaf module (like casino.ts/
 * athletics.ts/military.ts), not routed through actions.ts. Independent of joining a CrimeFamily
 * (you can run this solo) but synergizes with one if you're in it: family turf softens heat and
 * boosts demand a little, the same way military.ts ties into the real war system rather than
 * duplicating it.
 */
import type { DrugOperation, GameState } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { SK } from '../data/skills';
import {
  DRUG_BY_ID, drugCapacity, facilityUpgradeCost, stashTotal,
  MAX_DEALERS_PER_TURF, DEALER_HIRE_COST, DEALER_BASELINE_UNITS,
  GROW_YIELD_PER_LEVEL, LAB_YIELD_PER_LEVEL,
} from '../data/drugs';

export interface DrugActionResult {
  ok: boolean;
  message: string;
}

// Local copies of actions.ts's RNG-draw/cooldown patterns — kept dependency-free per the leaf-
// module convention (see casino.ts/athletics.ts/military.ts).
function withRng(state: GameState): RNG {
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  return rng;
}
function commit(state: GameState, rng: RNG): void {
  state.rngState = rng.state;
}
function onCooldown(state: GameState, key: string): boolean {
  return state.player.actionCooldowns[key] === state.year;
}
function setCooldown(state: GameState, key: string): void {
  state.player.actionCooldowns[key] = state.year;
}
function requireAge(state: GameState, minAge: number, activity: string): DrugActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}

function isActive(op: DrugOperation | null): op is DrugOperation {
  return !!op && op.active;
}

export function startDealing(state: GameState): DrugActionResult {
  const ageGate = requireAge(state, 16, 'dealing');
  if (ageGate) return ageGate;
  const p = state.player;
  if (isActive(p.drugOperation)) return { ok: false, message: 'You are already in the game.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  p.drugOperation = {
    active: true, storageLevel: 0, growLevel: 0, labLevel: 0, stash: {},
    reputation: 10, turf: 0, heat: 0, dealersHired: 0, busts: 0, lifetimeRevenue: 0, odIncidents: 0,
  };
  awardAchievement(state, 'drug_dealer');
  p.karma = clamp100(p.karma - 5);
  log(state, `You started slinging product on the corner. No going back now.`, 'bad');
  return { ok: true, message: 'You are officially in the game.' };
}

/** Buy wholesale product with clean cash — building the stash before you can sell it. */
export function buyProduct(state: GameState, drugId: string, units: number): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You need to be dealing to buy product.' };
  const p = state.player;
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const drug = DRUG_BY_ID[drugId];
  if (!drug) return { ok: false, message: 'Unknown product.' };
  if (units <= 0) return { ok: false, message: 'Pick a real quantity.' };
  if (op.reputation < drug.minReputation) return { ok: false, message: `Your rep isn't high enough for ${drug.name} yet — build it up on lower tiers first.` };
  if (drug.tier >= 4 && op.labLevel < 3 && !state.player.crimeFamilyId) {
    return { ok: false, message: 'You need a level-3+ lab or a crime family connection to source that.' };
  }
  const capacity = drugCapacity(op);
  if (stashTotal(op.stash) + units > capacity) return { ok: false, message: `Not enough stash capacity (${capacity} units) — upgrade storage first.` };
  const cost = Math.round(units * drug.wholesaleCost);
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  const rng = withRng(state);
  // A small chance the "supplier" is an undercover buy-bust, scaled up by existing heat.
  const stingChance = clamp(0.02 + op.heat * 0.0015, 0.02, 0.18);
  if (rng.chance(stingChance)) {
    p.money -= cost;
    const jailYears = rng.int(1, 2);
    p.criminalRecord++;
    p.inJailYears += jailYears;
    op.busts++;
    op.heat = clamp100(op.heat - 20);
    p.investigationHeat = clamp100(p.investigationHeat + 20);
    p.notoriety = clamp100(p.notoriety + 8);
    awardAchievement(state, 'first_bust');
    commit(state, rng);
    log(state, `🚨 The "supplier" was an undercover cop. Busted buying — ${jailYears} year(s).`, 'bad');
    return { ok: false, message: `Buy-bust! ${jailYears} year(s) in prison.` };
  }
  p.money -= cost;
  op.stash[drugId] = (op.stash[drugId] ?? 0) + units;
  commit(state, rng);
  log(state, `Bought ${units} units of ${drug.name} for $${cost.toLocaleString()}.`, 'money');
  return { ok: true, message: `Stocked ${units} units of ${drug.name}.` };
}

/** Sell stash on the street for illicit proceeds — real money, but it's dirty until laundered. */
export function sellProduct(state: GameState, drugId: string, units: number): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You need to be dealing to sell.' };
  const p = state.player;
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const drug = DRUG_BY_ID[drugId];
  if (!drug) return { ok: false, message: 'Unknown product.' };
  const held = op.stash[drugId] ?? 0;
  if (units <= 0 || units > held) return { ok: false, message: `You only have ${held} units of ${drug.name}.` };
  const rng = withRng(state);
  const inFamily = !!p.crimeFamilyId;
  const demandMult = clamp(0.6 + op.reputation / 100 + op.turf / 150 + (inFamily ? 0.15 : 0), 0.4, 2.2);
  const revenue = Math.round(units * drug.streetPrice * demandMult);

  op.stash[drugId] = held - units;
  p.dirtyMoney += revenue;
  op.lifetimeRevenue += revenue;
  op.reputation = clamp100(op.reputation + Math.min(3, units * 0.15));
  const heatGain = units * drug.heatPerUnit * (inFamily ? 0.75 : 1);
  op.heat = clamp100(op.heat + heatGain);
  p.investigationHeat = clamp100(p.investigationHeat + heatGain * 0.4);
  p.notoriety = clamp100(p.notoriety + heatGain * 0.15);

  let message = `Sold ${units} units of ${drug.name} for $${revenue.toLocaleString()} (dirty).`;
  let kind: 'money' | 'bad' = 'money';

  // Overdose risk: a customer dies/nearly dies on a bad batch — hurts reputation and spikes heat.
  const odChance = clamp(1 - Math.pow(1 - drug.odRiskPerUnit * (drug.addictiveness / 40), units), 0, 0.6);
  if (rng.chance(odChance)) {
    op.odIncidents++;
    op.reputation = clamp100(op.reputation - 15);
    op.heat = clamp100(op.heat + 15);
    p.investigationHeat = clamp100(p.investigationHeat + 10);
    p.karma = clamp100(p.karma - 10);
    kind = 'bad';
    message = `Sold ${units} units of ${drug.name} — but a customer overdosed on your product. It's making noise.`;
    if (op.odIncidents >= 3) awardAchievement(state, 'blood_on_your_hands');
  }

  // Sting risk on the sale side too, independent of the buy side.
  const stingChance = clamp(0.015 + op.heat * 0.0018, 0.015, 0.22);
  if (rng.chance(stingChance)) {
    const jailYears = rng.int(1, 3);
    p.criminalRecord++;
    p.inJailYears += jailYears;
    op.busts++;
    op.heat = clamp100(op.heat - 25);
    p.investigationHeat = clamp100(p.investigationHeat + 25);
    p.notoriety = clamp100(p.notoriety + 10);
    awardAchievement(state, 'first_bust');
    commit(state, rng);
    log(state, `🚨 That buyer was undercover. Busted selling — ${jailYears} year(s).`, 'bad');
    return { ok: false, message: `Sting operation! ${jailYears} year(s) in prison.` };
  }

  if (op.lifetimeRevenue >= 1_000_000) awardAchievement(state, 'drug_kingpin');
  if (op.lifetimeRevenue >= 5_000_000) awardAchievement(state, 'narco_baron');
  commit(state, rng);
  log(state, message, kind);
  return { ok: true, message: `Sold for $${revenue.toLocaleString()} (dirty money).` };
}

/** Upgrade one of the three independent tracks: storage (capacity), grow (free weed/yr), or lab
 * (free meth/yr, and gates tier-4 sourcing at level 3+). */
export function investFacility(state: GameState, track: 'storage' | 'grow' | 'lab'): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You need to be dealing first.' };
  const p = state.player;
  const level = track === 'storage' ? op.storageLevel : track === 'grow' ? op.growLevel : op.labLevel;
  if (level >= 5) return { ok: false, message: 'Already maxed out.' };
  const cost = facilityUpgradeCost(track, level + 1);
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  if (track === 'storage') op.storageLevel++;
  else if (track === 'grow') op.growLevel++;
  else op.labLevel++;
  const newLevel = track === 'storage' ? op.storageLevel : track === 'grow' ? op.growLevel : op.labLevel;
  const label = track === 'storage' ? 'Stash House' : track === 'grow' ? 'Grow House' : 'Meth Lab';
  if (newLevel === 5) {
    if (track === 'grow') awardAchievement(state, 'green_thumb');
    if (track === 'lab') awardAchievement(state, 'the_cook');
    if (track === 'storage') awardAchievement(state, 'stash_master');
  }
  log(state, `${label} upgraded to level ${newLevel} for $${cost.toLocaleString()}.`, 'money');
  return { ok: true, message: `${label} is now level ${newLevel}.` };
}

export function hireDealer(state: GameState): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You need to be dealing first.' };
  const p = state.player;
  const maxDealers = Math.floor(op.turf * MAX_DEALERS_PER_TURF) + (op.storageLevel > 0 ? 1 : 0);
  if (op.dealersHired >= maxDealers) return { ok: false, message: maxDealers === 0 ? 'You need turf before you can put anyone to work.' : 'You have no room for more dealers — take more turf first.' };
  if (DEALER_HIRE_COST > p.money) return { ok: false, message: `Needs $${DEALER_HIRE_COST.toLocaleString()}.` };
  p.money -= DEALER_HIRE_COST;
  op.dealersHired++;
  log(state, `Recruited another street dealer to move product for you.`, 'info');
  return { ok: true, message: 'Dealer hired.' };
}

export function fireDealer(state: GameState): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You need to be dealing first.' };
  if (op.dealersHired <= 0) return { ok: false, message: 'You have no one to let go.' };
  op.dealersHired--;
  log(state, `Cut a dealer loose — fewer eyes on the operation.`, 'info');
  return { ok: true, message: 'Dealer let go.' };
}

/** Push into contested corners — risk a violent encounter for a shot at more turf. */
export function expandTurf(state: GameState): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You need to be dealing first.' };
  if (onCooldown(state, 'drug_expand_turf')) return { ok: false, message: 'You already pushed into new corners this year.' };
  setCooldown(state, 'drug_expand_turf');
  const p = state.player;
  const rng = withRng(state);
  const skill = (p.skills[SK.streetSmarts] ?? 0) * 0.7 + (p.skills[SK.evasion] ?? 0) * 0.3;
  const chance = clamp(0.5 + skill * 0.003 + op.reputation * 0.002, 0.2, 0.85);
  if (rng.chance(chance)) {
    const gain = rng.range(4, 12);
    op.turf = clamp100(op.turf + gain);
    op.reputation = clamp100(op.reputation + 2);
    p.notoriety = clamp100(p.notoriety + 3);
    if (op.turf >= 50) awardAchievement(state, 'turf_taken');
    commit(state, rng);
    log(state, `Muscled into new territory — turf up to ${Math.round(op.turf)}%.`, 'bad');
    return { ok: true, message: `Turf increased to ${Math.round(op.turf)}%.` };
  }
  const injury = rng.chance(0.5);
  if (injury) p.health = clamp100(p.health - rng.range(5, 15));
  p.happiness = clamp100(p.happiness - rng.range(4, 10));
  op.heat = clamp100(op.heat + 8);
  commit(state, rng);
  log(state, `A rival crew beat you back${injury ? ' and you took a beating' : ''}. No turf gained.`, 'bad');
  return { ok: false, message: 'Rivals pushed you back.' };
}

/** Stretch a batch to double its units — more product to move, but a rougher cut raises this
 * year's overdose and heat risk on whatever you sell from it. */
export function cutProduct(state: GameState, drugId: string): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You need to be dealing first.' };
  if (onCooldown(state, 'drug_cut_product')) return { ok: false, message: 'Already cut a batch this year.' };
  const held = op.stash[drugId] ?? 0;
  if (held <= 0) return { ok: false, message: 'Nothing in stash to cut.' };
  const drug = DRUG_BY_ID[drugId];
  if (!drug) return { ok: false, message: 'Unknown product.' };
  const capacity = drugCapacity(op);
  const doubled = Math.min(held * 2, capacity - (stashTotal(op.stash) - held));
  setCooldown(state, 'drug_cut_product');
  const rng = withRng(state);
  op.stash[drugId] = doubled;
  op.heat = clamp100(op.heat + 6);
  const caught = rng.chance(0.12);
  commit(state, rng);
  if (caught) {
    op.reputation = clamp100(op.reputation - 10);
    log(state, `Word got out your ${drug.name} is stepped on — reputation took a hit.`, 'bad');
    return { ok: true, message: `Batch cut to ${doubled} units, but customers noticed.` };
  }
  log(state, `Cut the ${drug.name} batch — now ${doubled} units, riskier to move.`, 'info');
  return { ok: true, message: `Batch cut to ${doubled} units.` };
}

/** Pay to make a specific problem — this operation's own heat — go away for now. */
export function bribeCop(state: GameState): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You need to be dealing first.' };
  if (onCooldown(state, 'drug_bribe_cop')) return { ok: false, message: 'Already paid someone off this year.' };
  const p = state.player;
  const cost = 8_000 + op.heat * 400;
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  setCooldown(state, 'drug_bribe_cop');
  p.money -= cost;
  const rng = withRng(state);
  const chance = clamp(0.55 + (p.skills[SK.bribery] ?? 0) * 0.004, 0.25, 0.85);
  if (rng.chance(chance)) {
    op.heat = clamp100(op.heat - 30);
    commit(state, rng);
    log(state, `Paid off a beat cop to look the other way. Heat down.`, 'money');
    return { ok: true, message: 'Heat reduced.' };
  }
  op.heat = clamp100(op.heat + 15);
  p.notoriety = clamp100(p.notoriety + 10);
  p.investigationHeat = clamp100(p.investigationHeat + 15);
  commit(state, rng);
  log(state, `The cop wasn't dirty — you just handed Internal Affairs a case.`, 'bad');
  return { ok: false, message: 'Bribe backfired.' };
}

/** Walk away from the game entirely — clears the operation but not your record. */
export function retireFromDealing(state: GameState): DrugActionResult {
  const op = state.player.drugOperation;
  if (!isActive(op)) return { ok: false, message: 'You are not in the game.' };
  const p = state.player;
  const wasKingpin = op.lifetimeRevenue >= 1_000_000;
  op.active = false;
  p.karma = clamp100(p.karma + 8);
  if (wasKingpin) awardAchievement(state, 'gone_straight_dealer');
  log(state, `You got out of the game for good.`, 'good');
  return { ok: true, message: 'You walked away clean.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — production, passive dealer sales, heat decay, raids
// ---------------------------------------------------------------------------

export function tickDrugOperation(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const op = state.player.drugOperation;
  if (!isActive(op)) return headlines;
  const p = state.player;
  if (p.inJailYears > 0) return headlines;
  const inFamily = !!p.crimeFamilyId;
  const capacity = drugCapacity(op);

  // Free production from grow/lab tracks, capped by remaining capacity.
  let room = capacity - stashTotal(op.stash);
  if (op.growLevel > 0 && room > 0) {
    const yield_ = Math.min(room, op.growLevel * GROW_YIELD_PER_LEVEL);
    op.stash.weed = (op.stash.weed ?? 0) + yield_;
    room -= yield_;
  }
  if (op.labLevel > 0 && room > 0) {
    const yield_ = Math.min(room, op.labLevel * LAB_YIELD_PER_LEVEL);
    op.stash.meth = (op.stash.meth ?? 0) + yield_;
    room -= yield_;
  }

  // Hired dealers passively move product across whatever's in stash, prioritizing the biggest
  // piles first (easiest to offload without drawing extra attention to any one line).
  if (op.dealersHired > 0) {
    let remainingCapacityToSell = op.dealersHired * DEALER_BASELINE_UNITS;
    const entries = Object.entries(op.stash).filter(([, u]) => u > 0).sort((a, b) => b[1] - a[1]);
    let dealerRevenue = 0;
    let dealerHeat = 0;
    for (const [drugId, units] of entries) {
      if (remainingCapacityToSell <= 0) break;
      const drug = DRUG_BY_ID[drugId];
      if (!drug) continue;
      const sell = Math.min(units, remainingCapacityToSell);
      op.stash[drugId] = units - sell;
      remainingCapacityToSell -= sell;
      const demandMult = clamp(0.6 + op.reputation / 100 + op.turf / 150 + (inFamily ? 0.15 : 0), 0.4, 2.2);
      dealerRevenue += sell * drug.streetPrice * demandMult * 0.85; // dealers cut themselves a share
      dealerHeat += sell * drug.heatPerUnit * 0.6; // spread across many hands, less heat per unit than the player selling directly
      if (rng.chance(clamp(1 - Math.pow(1 - drug.odRiskPerUnit * (drug.addictiveness / 40), sell), 0, 0.4))) {
        op.odIncidents++;
        op.reputation = clamp100(op.reputation - 5);
      }
    }
    if (dealerRevenue > 0) {
      p.dirtyMoney += Math.round(dealerRevenue);
      op.lifetimeRevenue += Math.round(dealerRevenue);
      op.heat = clamp100(op.heat + dealerHeat);
      p.investigationHeat = clamp100(p.investigationHeat + dealerHeat * 0.3);
    }
  }

  // Heat cools on its own unless the operation stayed very active this year.
  op.heat = clamp100(op.heat - (op.dealersHired > 0 || op.heat > 50 ? 4 : 9));
  // Reputation decays slowly if the operation goes quiet.
  if (stashTotal(op.stash) === 0 && op.dealersHired === 0) op.reputation = clamp100(op.reputation - 3);

  // Raid risk climbs with heat; a bust costs stash, facility levels, and real jail time.
  const raidChance = clamp((op.heat - 45) * 0.008 * (inFamily ? 0.7 : 1), 0, 0.4);
  if (op.heat > 45 && rng.chance(raidChance)) {
    const severity = rng.range(0.3, 0.75);
    for (const id of Object.keys(op.stash)) op.stash[id] = Math.round((op.stash[id] ?? 0) * (1 - severity));
    op.storageLevel = Math.max(0, Math.round(op.storageLevel * (1 - severity * 0.5)));
    op.growLevel = Math.max(0, Math.round(op.growLevel * (1 - severity * 0.5)));
    op.labLevel = Math.max(0, Math.round(op.labLevel * (1 - severity * 0.5)));
    op.dealersHired = Math.max(0, Math.round(op.dealersHired * (1 - severity)));
    op.busts++;
    op.heat = clamp100(op.heat - 35);
    const jailYears = rng.int(1, 4);
    p.criminalRecord++;
    p.inJailYears += jailYears;
    p.investigationHeat = clamp100(p.investigationHeat - 20);
    p.notoriety = clamp100(p.notoriety + 15);
    p.reputation = clamp100(p.reputation - 10);
    awardAchievement(state, 'first_bust');
    headlines.push(`🚨 Raided! Your operation was hit hard — ${jailYears} year(s) behind bars.`);
  } else if (op.busts === 0 && op.lifetimeRevenue >= 500_000) {
    awardAchievement(state, 'untouchable');
  }

  if (stashTotal(op.stash) >= capacity) headlines.push(`Your stash is maxed out — upgrade storage or move product before it goes to waste.`);
  return headlines;
}
