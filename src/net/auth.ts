/**
 * Real accounts: email+password auth via Supabase Auth. Password hashing, session tokens and
 * rate-limiting are all handled server-side by Supabase — this module never sees or stores a
 * password beyond the single signIn/signUp call, and never rolls its own crypto. Auth state
 * itself lives in store/authStore.ts (a live subscription to supabase.auth), so any component
 * can read the current user without threading it through props; this module is just the request
 * layer (sign up / sign in / sign out) plus small display helpers.
 */
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface AuthOutcome {
  ok: boolean;
  message: string;
  /** Set when sign-up succeeded but the project requires email confirmation before sign-in. */
  needsEmailConfirm?: boolean;
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out — check your connection.')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export async function signUp(email: string, password: string, displayName: string): Promise<AuthOutcome> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !trimmedEmail.includes('@')) return { ok: false, message: 'Enter a valid email address.' };
  if (password.length < 6) return { ok: false, message: 'Password must be at least 6 characters.' };
  try {
    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { display_name: displayName.trim().slice(0, 24) || trimmedEmail.split('@')[0] } },
      }),
    );
    if (error) return { ok: false, message: error.message };
    if (!data.session) return { ok: true, message: 'Check your email to confirm your account.', needsEmailConfirm: true };
    return { ok: true, message: 'Account created!' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sign-up failed.' };
  }
}

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  try {
    const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }));
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Signed in.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sign-in failed.' };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function displayNameOf(user: User | null | undefined): string {
  if (!user) return '';
  const meta = user.user_metadata as { display_name?: string } | undefined;
  return meta?.display_name || user.email?.split('@')[0] || 'Bitizen';
}
