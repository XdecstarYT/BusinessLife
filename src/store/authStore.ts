/**
 * Live auth state: a tiny Zustand store that mirrors supabase.auth's current session so any
 * component can read `useAuth().user` without prop-drilling. Populated once at module load and
 * kept in sync via onAuthStateChange (covers sign in/up/out and token refresh) for the lifetime
 * of the tab.
 */
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../net/supabaseClient';

interface AuthStoreState {
  user: User | null;
  /** False until the initial getSession() resolves, so the UI can avoid a sign-in flash. */
  initialized: boolean;
}

export const useAuth = create<AuthStoreState>(() => ({ user: null, initialized: false }));

void supabase.auth.getSession().then(({ data }) => {
  useAuth.setState({ user: data.session?.user ?? null, initialized: true });
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuth.setState({ user: session?.user ?? null, initialized: true });
});
