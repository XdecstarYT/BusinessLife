/**
 * Supabase client. Two online features live on top of an otherwise fully-offline game: the
 * global leaderboard (device-id honor system, no login) and — since V34 — real accounts
 * (Supabase Auth, email+password) backing optional cloud saves. The URL and publishable key
 * below are not secrets — Supabase publishable keys are designed to ship inside client bundles,
 * with each table's row-level security policies as the only real access boundary:
 * `leaderboard_entries` trusts a locally-generated device id (see net/leaderboard.ts's comment
 * for why that's an intentional honor-system tradeoff), while `cloud_saves` is gated by real
 * `auth.uid()` identity, so RLS there actually enforces "only you can read or write your own
 * saves." Every other system in this app still runs entirely client-side against IndexedDB;
 * signing in is opt-in and everything degrades to "offline" rather than breaking anything else
 * if the network or Supabase is unreachable.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://scbcctovkurysiuxdmrd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_uSxxfnvBxyQ4zbY7nokT2w_GYKBWdin';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bl_auth' },
});
