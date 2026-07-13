/**
 * Ribbons: a BitLife-style life-summary award granted once per completed life,
 * chosen as the first matching entry in priority order (most specific first).
 * The collection persists across lives in localStorage, giving every death a
 * reason to start over: "which ribbon haven't I earned yet?"
 */
import type { GameState } from '../sim/types';
import { netWorth } from '../sim/engine';

export interface RibbonDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (state: GameState) => boolean;
}

const has = (s: GameState, id: string) => s.achievements.includes(id);

/** Priority order: top-most matching ribbon is the one awarded. */
export const RIBBONS: RibbonDef[] = [
  { id: 'legend', name: 'Legend', icon: '🏆', description: 'Finish with a legacy score of 95+.', check: (s) => (s.gameOver?.legacyScore ?? 0) >= 95 },
  { id: 'supreme', name: 'Supreme', icon: '🪙', description: 'Die a multi-billionaire.', check: (s) => netWorth(s) >= 1e10 },
  { id: 'head_of_state', name: 'Commander', icon: '🏛️', description: 'Lead your nation as head of state.', check: (s) => has(s, 'office:head_of_state') },
  { id: 'kingpin', name: 'Kingpin', icon: '🕶️', description: 'Die at the top of a crime family.', check: (s) => s.player.crimeRank >= 5 || has(s, 'crime_family_kingpin') },
  { id: 'billionaire', name: 'Billionaire', icon: '💎', description: 'Die with a ten-figure net worth.', check: (s) => netWorth(s) >= 1e9 },
  { id: 'dynasty', name: 'Dynasty', icon: '🏰', description: 'See your family line span three generations.', check: (s) => s.generation >= 3 },
  { id: 'centenarian', name: 'Centenarian', icon: '💯', description: 'Live to 100.', check: (s) => s.player.age >= 100 },
  { id: 'royalty', name: 'Royalty', icon: '👑', description: 'Live a life that began on the throne.', check: (s) => has(s, 'born_royal') },
  { id: 'mogul', name: 'Mogul', icon: '🏢', description: 'Die holding five companies at once.', check: (s) => s.player.companies.length >= 5 },
  { id: 'politician', name: 'Statesman', icon: '🗳️', description: 'Hold any political office.', check: (s) => s.achievements.some((a) => a.startsWith('office:')) },
  { id: 'wolf', name: 'Wolf of the Exchange', icon: '📈', description: 'Build a nine-figure stock fortune.', check: (s) => has(s, 'stock_market_legend') },
  { id: 'jackpot', name: 'Jackpot', icon: '🎰', description: 'Win a lottery or casino jackpot.', check: (s) => has(s, 'lottery_jackpot') || has(s, 'casino_whale') || has(s, 'high_stakes_gambler') },
  { id: 'scholar', name: 'Scholar', icon: '🎓', description: 'Master a skill to 100.', check: (s) => Object.values(s.player.skills).some((v) => v >= 100) },
  { id: 'jailbird', name: 'Jailbird', icon: '🔒', description: 'Rack up three or more convictions.', check: (s) => s.player.criminalRecord >= 3 },
  { id: 'saint', name: 'Saint', icon: '😇', description: 'Die with karma of 90+ and a clean record.', check: (s) => s.player.karma >= 90 && s.player.criminalRecord === 0 },
  { id: 'famous', name: 'Famous', icon: '🌟', description: 'Die with a million followers.', check: (s) => s.player.socialFollowers >= 1_000_000 },
  { id: 'family_first', name: 'Family First', icon: '👨‍👩‍👧‍👦', description: 'Die married with three or more children.', check: (s) => !!s.player.spouseId && s.player.children.length >= 3 },
  { id: 'landlord', name: 'Landlord', icon: '🏘️', description: 'Die holding six or more properties.', check: (s) => s.player.properties.length >= 6 },
  { id: 'best_friend', name: 'Best Friend', icon: '🐾', description: 'Die with a fully bonded pet at your side.', check: (s) => (s.player.pets ?? []).some((x) => x.bond >= 95) },
  { id: 'globetrotter', name: 'High Roller', icon: '🛥️', description: 'Die owning three or more luxury assets.', check: (s) => s.player.luxuryAssets.length >= 3 },
  { id: 'wealthy', name: 'Wealthy', icon: '💰', description: 'Die a multi-millionaire.', check: (s) => netWorth(s) >= 10_000_000 },
  { id: 'bucket_kicker', name: 'Bucket Kicker', icon: '🎯', description: 'Complete your entire bucket list.', check: (s) => (s.bucketList ?? []).length > 0 && (s.bucketList ?? []).every((g) => g.done) },
  { id: 'survivor', name: 'Survivor', icon: '🌅', description: 'Make it past 85.', check: (s) => s.player.age >= 85 },
  { id: 'ordinary', name: 'Ordinary', icon: '🎗️', description: 'Live a quiet, unremarkable life. Someone has to.', check: () => true },
];

const STORAGE_KEY = 'bl_ribbons';

export function getRibbonCabinet(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Pick the life's ribbon, persist it to the cross-life cabinet, and return it
 * along with whether this is the first time it has ever been earned. */
export function awardRibbonForLife(state: GameState): { ribbon: RibbonDef; firstTime: boolean } {
  const ribbon = RIBBONS.find((r) => {
    try {
      return r.check(state);
    } catch {
      return false;
    }
  }) ?? RIBBONS[RIBBONS.length - 1];
  let firstTime = false;
  try {
    const cabinet = getRibbonCabinet();
    firstTime = !cabinet[ribbon.id];
    cabinet[ribbon.id] = (cabinet[ribbon.id] ?? 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cabinet));
  } catch { /* private-mode etc. — the ribbon still shows for this life */ }
  return { ribbon, firstTime };
}
