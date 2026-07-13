/** Catalog of named slot machines on the casino floor — each a distinct 3D object with its own
 * theme, stakes and volatility, not an interchangeable generic "slots" button. */

export type SlotVolatility = 'low' | 'medium' | 'high' | 'extreme';

export interface SlotMachineDef {
  id: string;
  name: string;
  theme: string; // flavor line shown in the UI
  color: number; // hex, used for the cabinet in the 3D scene
  minBet: number;
  maxBet: number;
  volatility: SlotVolatility;
  jackpotSeed: number; // pool resets to this after a jackpot hit
  jackpotContribRate: number; // fraction of every non-jackpot bet added to the pool
  vipLiquidity: number; // player must have money+savings >= this to play (0 = open floor)
}

export const SLOT_MACHINES: SlotMachineDef[] = [
  {
    id: 'lucky_sevens', name: 'Lucky Sevens', theme: 'Classic fruit reels — steady, low-drama payouts.',
    color: 0xdc2626, minBet: 50, maxBet: 2_000, volatility: 'low',
    jackpotSeed: 5_000, jackpotContribRate: 0.01, vipLiquidity: 0,
  },
  {
    id: 'golden_pharaoh', name: 'Golden Pharaoh', theme: "Egyptian treasure hunt with a growing tomb jackpot.",
    color: 0xd4af37, minBet: 200, maxBet: 8_000, volatility: 'medium',
    jackpotSeed: 25_000, jackpotContribRate: 0.015, vipLiquidity: 0,
  },
  {
    id: 'dragons_fortune', name: "Dragon's Fortune", theme: 'Eastern dragon reels — bigger swings, bigger scales.',
    color: 0x16a34a, minBet: 250, maxBet: 10_000, volatility: 'medium',
    jackpotSeed: 30_000, jackpotContribRate: 0.015, vipLiquidity: 0,
  },
  {
    id: 'cosmic_reels', name: 'Cosmic Reels', theme: 'Deep-space cabinet — volatile, occasionally spectacular.',
    color: 0x8b5cf6, minBet: 500, maxBet: 20_000, volatility: 'high',
    jackpotSeed: 60_000, jackpotContribRate: 0.02, vipLiquidity: 0,
  },
  {
    id: 'wild_west_gold', name: 'Wild West Gold', theme: 'Outlaw-themed reels with a long-shot bounty jackpot.',
    color: 0xb45309, minBet: 500, maxBet: 20_000, volatility: 'high',
    jackpotSeed: 60_000, jackpotContribRate: 0.02, vipLiquidity: 0,
  },
  {
    id: 'diamond_royale', name: 'Diamond Royale', theme: 'The VIP room\'s high-limit cabinet — extreme swings.',
    color: 0x38bdf8, minBet: 5_000, maxBet: 250_000, volatility: 'extreme',
    jackpotSeed: 500_000, jackpotContribRate: 0.025, vipLiquidity: 2_000_000,
  },
];

export const SLOT_MACHINE_BY_ID: Record<string, SlotMachineDef> = Object.fromEntries(SLOT_MACHINES.map((m) => [m.id, m]));

/** Outcome-bucket weights per volatility tier. Tuned so every tier's expected return (excluding
 * the rare jackpot) stays under 1.0 — the house always has an edge, skill or no skill. */
export const VOLATILITY_PROFILE: Record<SlotVolatility, { smallChance: number; smallMult: number; bigChance: number; bigMult: number; jackpotChance: number }> = {
  low: { smallChance: 0.35, smallMult: 1.8, bigChance: 0.05, bigMult: 5, jackpotChance: 0.0008 }, // RTP ~88%
  medium: { smallChance: 0.28, smallMult: 1.9, bigChance: 0.045, bigMult: 7.5, jackpotChance: 0.0012 }, // RTP ~87%
  high: { smallChance: 0.2, smallMult: 2.2, bigChance: 0.04, bigMult: 9.5, jackpotChance: 0.002 }, // RTP ~82%
  extreme: { smallChance: 0.15, smallMult: 2.6, bigChance: 0.03, bigMult: 13, jackpotChance: 0.003 }, // RTP ~78%
};

/** Display-only expected return-to-player for a machine, excluding the jackpot's own long-shot
 * contribution (shown separately) — always < 1, matching the actual spin math in sim/casino.ts. */
export function slotMachineRTP(def: SlotMachineDef): number {
  const v = VOLATILITY_PROFILE[def.volatility];
  return v.smallChance * v.smallMult + v.bigChance * v.bigMult;
}

// ---------------------------------------------------------------------------
// Sports Book
// ---------------------------------------------------------------------------

export const SPORTS = ['Football', 'Basketball', 'Soccer', 'Boxing'] as const;
export type Sport = (typeof SPORTS)[number];

export const TEAM_CITIES = [
  'Northgate', 'Harborview', 'Ironvale', 'Silverton', 'Redcliff', 'Duskmere', 'Brightwell', 'Stonebridge',
  'Ashford', 'Wolfhollow', 'Crestmoor', 'Fallriver',
];
export const TEAM_MASCOTS = [
  'Falcons', 'Titans', 'Wolves', 'Comets', 'Miners', 'Sharks', 'Ravens', 'Bears', 'Rockets', 'Vipers',
];
