/**
 * Cloud saves: named per-account game-state snapshots backing the account system, layered on
 * top of (never replacing) the local IndexedDB saves every player already has offline. Gated by
 * real Supabase Auth identity — see the `cloud_saves` RLS policies — so a user can only ever
 * see or touch their own rows. Reads throw on failure so the UI can tell "empty" from "couldn't
 * load"; writes/deletes catch everything and resolve to a status, since their call sites just
 * need a yes/no to toast — the local save is never at risk either way.
 */
import { supabase } from './supabaseClient';
import type { GameState } from '../sim/types';

export interface CloudSaveMeta {
  id: string;
  save_name: string;
  player_name: string | null;
  net_worth: number | null;
  updated_at: string;
}

export const MAX_CLOUD_SAVES = 5;

function withTimeout<T>(promise: PromiseLike<T>, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Cloud request timed out.')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export async function listCloudSaves(userId: string): Promise<CloudSaveMeta[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('cloud_saves')
      .select('id,save_name,player_name,net_worth,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  );
  if (error) throw error;
  return data ?? [];
}

/** Upserts by (user_id, save_name) — saving under an existing name overwrites it in place
 * rather than piling up duplicates. Enforces the cloud-save cap client-side for new names only. */
export async function uploadCloudSave(userId: string, saveName: string, state: GameState): Promise<{ ok: boolean; message: string }> {
  const name = saveName.trim().slice(0, 60) || 'My Save';
  try {
    const existing = await listCloudSaves(userId);
    const isNewSlot = !existing.some((s) => s.save_name === name);
    if (isNewSlot && existing.length >= MAX_CLOUD_SAVES) {
      return { ok: false, message: `Cloud storage is capped at ${MAX_CLOUD_SAVES} saves — delete one first or overwrite an existing name.` };
    }
    const netWorth = state.netWorthHistory[state.netWorthHistory.length - 1]?.value ?? state.player.money;
    const { error } = await withTimeout(
      supabase.from('cloud_saves').upsert(
        {
          user_id: userId,
          save_name: name,
          player_name: state.player.name,
          net_worth: Math.round(netWorth),
          data: state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,save_name' },
      ),
    );
    if (error) throw error;
    return { ok: true, message: `Saved "${name}" to the cloud.` };
  } catch (e) {
    console.error('uploadCloudSave failed:', e);
    return { ok: false, message: 'Could not reach the cloud — check your connection.' };
  }
}

export async function downloadCloudSave(id: string): Promise<GameState> {
  const { data, error } = await withTimeout(supabase.from('cloud_saves').select('data').eq('id', id).single());
  if (error) throw error;
  return data.data as GameState;
}

export async function deleteCloudSave(id: string): Promise<boolean> {
  try {
    const { error } = await withTimeout(supabase.from('cloud_saves').delete().eq('id', id));
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('deleteCloudSave failed:', e);
    return false;
  }
}
