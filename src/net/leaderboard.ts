/**
 * Global leaderboard: the one place BusinessLife talks to a server. Two independent rankings share
 * one row per device (see the `leaderboard_entries` table): a "live" net-worth board that always
 * reflects whatever you last submitted, and a "legacy" board that only accepts a new legacy score
 * if it beats the device's previous best completed life. A device can hold exactly one row on each
 * board — resubmitting updates it in place rather than spamming new entries.
 *
 * There is no login and no server authority over the game itself (the whole sim runs client-side),
 * so `deviceId` is just a locally-generated identifier, not a real credential — see the RLS policy
 * comments in the migration for why this is an intentional honor-system tradeoff, not an oversight.
 * The `fetchTop*` reads throw on any failure (query error, network error, or timeout) so the UI can
 * tell "genuinely empty" apart from "couldn't load"; the `submit*` writes catch everything and
 * resolve to a status instead, since their call sites just need a yes/no to toast. Either way, a
 * flaky or absent connection degrades this one screen — it never touches the offline game around it.
 */
import { supabase } from './supabaseClient';

const DEVICE_ID_KEY = 'bl_device_id';

/** Supabase-js's fetch layer can hang rather than reject on some network failures (a blocked
 * proxy, a dead Wi-Fi hotspot) — without a bound, a caller awaiting it would spin forever. Every
 * network call in this module races against this so the UI always reaches a definite state. */
function withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Leaderboard request timed out.')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Royalty: a #1 finish on either board banks a one-life "born into royalty"
// perk, offered as an opt-in on the next new-game screen (see ui/screens/Menu.tsx)
// and spent by sim/world.ts's generateWorld when bornRoyal is set. Banked, not
// live — once you've been seen at #1 the perk is yours to use whenever you next
// start a life, even if you've since been knocked off the top spot; this avoids
// a perk that quietly vanishes between checking the board and clicking "New Life."
// ---------------------------------------------------------------------------

export type RoyaltySource = 'networth' | 'legacy';
const ROYALTY_KEY = 'bl_royalty_sources';

function readRoyaltySources(): RoyaltySource[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(ROYALTY_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((s): s is RoyaltySource => s === 'networth' || s === 'legacy') : [];
  } catch {
    return [];
  }
}

/** Checks the top row of an already-fetched leaderboard slice against this device, banking
 * royalty eligibility if it's currently #1. Returns true only the first time it's earned, so
 * callers can toast once instead of on every repeat check. */
export function checkRoyaltyFromTop(source: RoyaltySource, topRow: { device_id: string } | undefined): boolean {
  if (!topRow || topRow.device_id !== getDeviceId()) return false;
  const sources = readRoyaltySources();
  if (sources.includes(source)) return false;
  sources.push(source);
  localStorage.setItem(ROYALTY_KEY, JSON.stringify(sources));
  return true;
}

export function getRoyaltySources(): RoyaltySource[] {
  return readRoyaltySources();
}

/** Spends the banked perk(s) — call once a new life actually applies it. */
export function consumeRoyalty(): void {
  localStorage.removeItem(ROYALTY_KEY);
}

export interface NetWorthEntry {
  device_id: string;
  player_name: string;
  net_worth: number;
  country: string | null;
  updated_at: string;
}

export interface LegacyEntry {
  device_id: string;
  player_name: string;
  legacy_score: number;
  legacy_age: number | null;
  legacy_year: number | null;
  country: string | null;
  updated_at: string;
}

/** Throws on any failure (query error, network error, or timeout) — callers decide how to
 * present "couldn't load" to the user; this module never silently turns a failure into an
 * empty result, which would be indistinguishable from a genuinely empty leaderboard. */
export async function fetchTopNetWorth(limit = 25): Promise<NetWorthEntry[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('leaderboard_entries')
      .select('device_id,player_name,net_worth,country,updated_at')
      .order('net_worth', { ascending: false })
      .limit(limit),
  );
  if (error) throw error;
  return data ?? [];
}

export async function fetchTopLegacy(limit = 25): Promise<LegacyEntry[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('leaderboard_entries')
      .select('device_id,player_name,legacy_score,legacy_age,legacy_year,country,updated_at')
      .not('legacy_score', 'is', null)
      .order('legacy_score', { ascending: false })
      .limit(limit),
  );
  if (error) throw error;
  return (data ?? []) as LegacyEntry[];
}

/** Always overwrites — this board is meant to reflect your current run, not a personal best.
 * Returns false (rather than throwing) on failure since this is a terminal UI action already
 * wrapped in its own try/catch-free call site that just needs a yes/no to toast. */
export async function submitNetWorth(name: string, netWorth: number, country: string | null): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      supabase.from('leaderboard_entries').upsert(
        {
          device_id: getDeviceId(),
          player_name: name.trim().slice(0, 24) || 'Anonymous',
          net_worth: Math.max(0, Math.round(netWorth)),
          country,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' },
      ),
    );
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('submitNetWorth failed:', e);
    return false;
  }
}

/** Only overwrites the device's row if this life's score beats its previous best. */
export async function submitLegacyScore(
  name: string,
  legacyScore: number,
  legacyAge: number,
  legacyYear: number,
  country: string | null,
): Promise<'submitted' | 'not_a_new_best' | 'failed'> {
  const deviceId = getDeviceId();
  let existing: { legacy_score: number | null } | null;
  try {
    const res = await withTimeout(
      supabase.from('leaderboard_entries').select('legacy_score').eq('device_id', deviceId).maybeSingle(),
    );
    if (res.error) throw res.error;
    existing = res.data;
  } catch (e) {
    console.error('submitLegacyScore read failed:', e);
    return 'failed';
  }
  if (existing && existing.legacy_score !== null && existing.legacy_score >= legacyScore) return 'not_a_new_best';

  try {
    const { error } = await withTimeout(
      supabase.from('leaderboard_entries').upsert(
        {
          device_id: deviceId,
          player_name: name.trim().slice(0, 24) || 'Anonymous',
          legacy_score: Math.round(legacyScore),
          legacy_age: Math.round(legacyAge),
          legacy_year: Math.round(legacyYear),
          country,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' },
      ),
    );
    if (error) throw error;
    return 'submitted';
  } catch (e) {
    console.error('submitLegacyScore write failed:', e);
    return 'failed';
  }
}
