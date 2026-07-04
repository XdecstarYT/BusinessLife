/**
 * Billionaire lifestyle assets (jets, yachts, islands, sports teams, racehorses, art)
 * and celebrity brand investment — pure vanity/prestige spending with real upkeep,
 * plus a couple of assets (racehorses, sports teams) that throw off occasional flavor income.
 */
import type { GameState, LuxuryAsset, LuxuryAssetKind } from './types';
import { clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';

export interface LifestyleActionResult {
  ok: boolean;
  message: string;
}

export interface LuxuryCatalogEntry {
  kind: LuxuryAssetKind;
  label: string;
  baseCost: number;
  upkeepPct: number; // fraction of cost per year
  happiness: number;
  reputation: number;
}

export const LUXURY_CATALOG: LuxuryCatalogEntry[] = [
  { kind: 'private_jet', label: 'Private Jet', baseCost: 20_000_000, upkeepPct: 0.08, happiness: 8, reputation: 3 },
  { kind: 'yacht', label: 'Superyacht', baseCost: 10_000_000, upkeepPct: 0.09, happiness: 6, reputation: 2 },
  { kind: 'island', label: 'Private Island', baseCost: 50_000_000, upkeepPct: 0.03, happiness: 15, reputation: 5 },
  { kind: 'sports_team', label: 'Sports Team', baseCost: 300_000_000, upkeepPct: 0.06, happiness: 10, reputation: 10 },
  { kind: 'racehorse', label: 'Champion Racehorse', baseCost: 500_000, upkeepPct: 0.1, happiness: 4, reputation: 1 },
  { kind: 'artwork', label: 'Famous Artwork', baseCost: 2_000_000, upkeepPct: 0.01, happiness: 3, reputation: 2 },
];

export function buyLuxuryAsset(state: GameState, kind: LuxuryAssetKind, customName?: string): LifestyleActionResult {
  const p = state.player;
  const entry = LUXURY_CATALOG.find((e) => e.kind === kind);
  if (!entry) return { ok: false, message: 'Unknown asset type.' };
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  const cost = Math.round(entry.baseCost * rng.range(0.85, 1.2));
  state.rngState = rng.state;
  if (cost > p.money) return { ok: false, message: `Needs $${cost.toLocaleString()}.` };
  p.money -= cost;
  const asset: LuxuryAsset = {
    id: `lux_${state.year}_${p.luxuryAssets.length}_${kind}`,
    kind,
    name: customName?.trim() || `${p.name.split(' ').pop()}'s ${entry.label}`,
    value: cost,
    upkeepPerYear: Math.round(cost * entry.upkeepPct),
    yearAcquired: state.year,
  };
  p.luxuryAssets.push(asset);
  p.happiness = clamp100(p.happiness + entry.happiness);
  p.reputation = clamp100(p.reputation + entry.reputation);
  if (p.luxuryAssets.length >= 4 && !state.achievements.includes('billionaire_lifestyle')) {
    state.achievements.push('billionaire_lifestyle');
  }
  log(state, `💎 You acquired ${asset.name} for $${cost.toLocaleString()}.`, 'money');
  return { ok: true, message: `Bought ${asset.name}.` };
}

export function sellLuxuryAsset(state: GameState, assetId: string): LifestyleActionResult {
  const p = state.player;
  const idx = p.luxuryAssets.findIndex((a) => a.id === assetId);
  if (idx === -1) return { ok: false, message: 'Asset not found.' };
  const asset = p.luxuryAssets[idx];
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  const proceeds = Math.round(asset.value * rng.range(0.65, 0.9));
  state.rngState = rng.state;
  p.luxuryAssets.splice(idx, 1);
  p.money += proceeds;
  p.happiness = clamp100(p.happiness - 3);
  log(state, `You sold ${asset.name} for $${proceeds.toLocaleString()}.`, 'money');
  return { ok: true, message: `Sold ${asset.name} for $${proceeds.toLocaleString()}.` };
}

/** Invest in a celebrity NPC's brand for a small ongoing royalty tied to their earning power. */
export function investInCelebrityBrand(state: GameState, npcId: string, amount: number): LifestyleActionResult {
  const p = state.player;
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive || npc.role !== 'celebrity' || npc.countryId !== p.countryId) {
    return { ok: false, message: 'Not a notable celebrity in your country.' };
  }
  if (amount <= 0 || amount > p.money) return { ok: false, message: 'Not enough cash.' };
  if (p.celebrityStakes.some((s) => s.npcId === npcId)) return { ok: false, message: 'You already have a stake in this celebrity.' };
  const stakePct = Math.min(0.25, Math.max(0.02, amount / Math.max(1, npc.wealth + amount)));
  p.money -= amount;
  p.celebrityStakes.push({ npcId, invested: amount, stakePct });
  log(state, `You invested $${Math.round(amount).toLocaleString()} in ${npc.name}'s brand for a ${(stakePct * 100).toFixed(1)}% royalty stake.`, 'money');
  if (!state.achievements.includes('celebrity_investor')) state.achievements.push('celebrity_investor');
  return { ok: true, message: `Acquired a ${(stakePct * 100).toFixed(1)}% royalty stake in ${npc.name}.` };
}

export function divestCelebrityStake(state: GameState, npcId: string): LifestyleActionResult {
  const p = state.player;
  const idx = p.celebrityStakes.findIndex((s) => s.npcId === npcId);
  if (idx === -1) return { ok: false, message: 'No stake in that celebrity.' };
  const stake = p.celebrityStakes[idx];
  const npc = state.npcs[npcId];
  const proceeds = Math.round(stake.invested * (npc?.alive ? 1 : 0.3));
  p.celebrityStakes.splice(idx, 1);
  p.money += proceeds;
  log(state, `You cashed out your stake in ${npc?.name ?? 'a celebrity'} for $${proceeds.toLocaleString()}.`, 'money');
  return { ok: true, message: `Cashed out for $${proceeds.toLocaleString()}.` };
}

/** Yearly upkeep, appreciation/depreciation, and flavor payouts for luxury assets and celebrity stakes. */
export function tickLifestyleAssets(state: GameState, rng: RNG): string[] {
  const p = state.player;
  const headlines: string[] = [];

  let totalUpkeep = 0;
  for (const asset of p.luxuryAssets) {
    totalUpkeep += asset.upkeepPerYear;
    if (asset.kind === 'artwork') {
      asset.value = Math.round(asset.value * rng.range(1.0, 1.08));
    } else if (asset.kind === 'island') {
      asset.value = Math.round(asset.value * rng.range(0.99, 1.05));
    } else {
      asset.value = Math.round(asset.value * rng.range(0.93, 0.99));
    }
    if (asset.kind === 'racehorse' && rng.chance(0.25)) {
      const winnings = Math.round(asset.value * rng.range(0.05, 0.25));
      p.money += winnings;
      p.reputation = clamp100(p.reputation + 1);
      headlines.push(`🐎 ${asset.name} won a major race, earning $${winnings.toLocaleString()} in prize money.`);
    }
    if (asset.kind === 'sports_team' && rng.chance(0.3)) {
      const won = rng.chance(0.5);
      if (won) {
        const bonus = Math.round(asset.value * 0.01);
        p.money += bonus;
        p.popularity = clamp100(p.popularity + 3);
        headlines.push(`🏆 ${asset.name} won their championship, delighting fans and sponsors alike.`);
      } else {
        p.happiness = clamp100(p.happiness - 2);
      }
    }
  }
  if (totalUpkeep > 0) {
    if (totalUpkeep <= p.money) {
      p.money -= totalUpkeep;
    } else if (p.luxuryAssets.length) {
      // Can't cover upkeep: force-sell the cheapest asset rather than going into debt.
      const cheapest = [...p.luxuryAssets].sort((a, b) => a.value - b.value)[0];
      p.luxuryAssets = p.luxuryAssets.filter((a) => a.id !== cheapest.id);
      p.money += Math.round(cheapest.value * 0.7);
      p.happiness = clamp100(p.happiness - 8);
      headlines.push(`You could no longer afford the upkeep on ${cheapest.name} and were forced to sell it.`);
    }
  }

  for (const stake of [...p.celebrityStakes]) {
    const npc = state.npcs[stake.npcId];
    if (!npc || !npc.alive) {
      p.celebrityStakes = p.celebrityStakes.filter((s) => s.npcId !== stake.npcId);
      continue;
    }
    const royalty = Math.round(npc.wealth * 0.02 * stake.stakePct);
    if (royalty > 0) p.money += royalty;
  }

  return headlines;
}
