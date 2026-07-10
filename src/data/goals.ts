/**
 * Bucket-list goal definitions. A life rolls a handful of these at birth (one
 * target tier each); the engine re-checks progress every year and pays the
 * reward when a goal completes. Checks live here keyed by id — the serialized
 * BucketGoal instance carries only { defId, description, target, done, rewards }
 * so saves stay plain JSON.
 */
import type { BucketGoal, GameState } from '../sim/types';
import { netWorth } from '../sim/engine';
import { portfolioValue } from '../sim/market';
import type { RNG } from '../sim/rng';

export interface GoalDef {
  id: string;
  /** Target tiers, easy → hard. One is rolled per life. */
  targets: number[];
  describe: (target: number) => string;
  /** 0..1 completion fraction against the rolled target. */
  progress: (state: GameState, target: number) => number;
  rewardMoney: (target: number) => number;
  rewardHappiness: number;
}

const fmt = (n: number) => `$${n.toLocaleString()}`;

export const GOAL_DEFS: GoalDef[] = [
  {
    id: 'net_worth',
    targets: [1_000_000, 10_000_000, 100_000_000],
    describe: (t) => `Build a net worth of ${fmt(t)}`,
    progress: (s, t) => netWorth(s) / t,
    rewardMoney: (t) => Math.round(t * 0.02),
    rewardHappiness: 10,
  },
  {
    id: 'properties',
    targets: [2, 4, 8],
    describe: (t) => `Own ${t} properties at once`,
    progress: (s, t) => s.player.properties.length / t,
    rewardMoney: (t) => t * 12_500,
    rewardHappiness: 8,
  },
  {
    id: 'companies',
    targets: [1, 3, 5],
    describe: (t) => (t === 1 ? 'Found a company' : `Found ${t} companies`),
    progress: (s, t) => s.player.companies.length / t,
    rewardMoney: (t) => t * 20_000,
    rewardHappiness: 8,
  },
  {
    id: 'ipo',
    targets: [1],
    describe: () => 'Take a company public',
    progress: (s) => (s.achievements.includes('ipo_ceo') ? 1 : 0),
    rewardMoney: () => 250_000,
    rewardHappiness: 12,
  },
  {
    id: 'marry',
    targets: [1],
    describe: () => 'Get married',
    progress: (s) => (s.player.spouseId ? 1 : 0),
    rewardMoney: () => 25_000,
    rewardHappiness: 15,
  },
  {
    id: 'children',
    targets: [1, 2, 4],
    describe: (t) => (t === 1 ? 'Have a child' : `Raise ${t} children`),
    progress: (s, t) => s.player.children.length / t,
    rewardMoney: (t) => t * 10_000,
    rewardHappiness: 15,
  },
  {
    id: 'office',
    targets: [1],
    describe: () => 'Win political office',
    progress: (s) => (s.player.office || s.achievements.some((a) => a.startsWith('office:')) ? 1 : 0),
    rewardMoney: () => 100_000,
    rewardHappiness: 12,
  },
  {
    id: 'followers',
    targets: [10_000, 100_000, 1_000_000],
    describe: (t) => `Reach ${t.toLocaleString()} social-media followers`,
    progress: (s, t) => s.player.socialFollowers / t,
    rewardMoney: (t) => Math.round(t * 0.5),
    rewardHappiness: 10,
  },
  {
    id: 'skill_master',
    targets: [1],
    describe: () => 'Master any skill to 100',
    progress: (s) => (Object.values(s.player.skills).some((v) => v >= 100) ? 1 : 0),
    rewardMoney: () => 75_000,
    rewardHappiness: 10,
  },
  {
    id: 'casino_win',
    targets: [10_000, 100_000],
    describe: (t) => `Win ${fmt(t)} in a single casino payout`,
    progress: (s, t) => s.player.casinoBiggestWin / t,
    rewardMoney: (t) => Math.round(t * 0.25),
    rewardHappiness: 8,
  },
  {
    id: 'portfolio',
    targets: [250_000, 2_500_000, 25_000_000],
    describe: (t) => `Grow a stock portfolio worth ${fmt(t)}`,
    progress: (s, t) => portfolioValue(s) / t,
    rewardMoney: (t) => Math.round(t * 0.03),
    rewardHappiness: 8,
  },
  {
    id: 'pet_bond',
    targets: [90],
    describe: () => "Raise a pet's bond to 90",
    progress: (s, t) => Math.max(0, ...(s.player.pets ?? []).map((x) => x.bond)) / t,
    rewardMoney: () => 15_000,
    rewardHappiness: 15,
  },
  {
    id: 'memoir',
    targets: [1],
    describe: () => 'Publish your memoir',
    progress: (s) => (s.player.memoir || s.achievements.includes('memoirist') ? 1 : 0),
    rewardMoney: () => 50_000,
    rewardHappiness: 10,
  },
  {
    id: 'foundation',
    targets: [1],
    describe: () => 'Found a charitable foundation',
    progress: (s) => (s.player.foundation ? 1 : 0),
    rewardMoney: () => 50_000,
    rewardHappiness: 12,
  },
];

export const GOAL_DEF_BY_ID: Record<string, GoalDef> = Object.fromEntries(GOAL_DEFS.map((g) => [g.id, g]));

/** Roll a fresh bucket list: distinct goal defs, one random target tier each. */
export function generateBucketList(rng: RNG, count = 6): BucketGoal[] {
  const pool = [...GOAL_DEFS];
  const picked: BucketGoal[] = [];
  while (picked.length < count && pool.length) {
    const def = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    const target = rng.pick(def.targets);
    picked.push({
      defId: def.id,
      description: def.describe(target),
      target,
      done: false,
      rewardMoney: def.rewardMoney(target),
      rewardHappiness: def.rewardHappiness,
    });
  }
  return picked;
}
