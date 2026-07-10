/**
 * Supabase client for the one online feature in an otherwise fully-offline game: the global
 * leaderboard. The URL and publishable key below are not secrets — Supabase publishable keys are
 * designed to ship inside client bundles, with `leaderboard_entries`'s row-level security policies
 * (see the `create_leaderboard_entries` migration) as the only real access boundary. Every other
 * system in this app still runs entirely client-side against IndexedDB; only leaderboard.ts talks
 * to this client, and it degrades to "offline" rather than breaking anything else if unreachable.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://scbcctovkurysiuxdmrd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_uSxxfnvBxyQ4zbY7nokT2w_GYKBWdin';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
