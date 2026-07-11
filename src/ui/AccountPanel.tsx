/**
 * Account: BitLife's "Bitizen" badge, but with a real account behind it — email+password via
 * Supabase Auth backing optional cloud saves (see net/auth.ts, net/cloudSaves.ts). Signing in is
 * entirely opt-in; every system around this one still works fully offline. Rendered as a card on
 * the main menu with a modal for the actual sign-in/sign-up form and cloud-save management.
 */
import { useState } from 'react';
import { useAuth } from '../store/authStore';
import { useGame } from '../store/gameStore';
import { displayNameOf, signIn, signOut, signUp } from '../net/auth';
import { deleteCloudSave, downloadCloudSave, listCloudSaves, uploadCloudSave, type CloudSaveMeta, MAX_CLOUD_SAVES } from '../net/cloudSaves';
import { Badge, Button, Card, Field, Modal, TextInput } from './components';
import { money } from './format';

export function AccountPanel() {
  const { user, initialized } = useAuth();
  const { state, importFrom, toast } = useGame();
  const [authOpen, setAuthOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [cloudSaves, setCloudSaves] = useState<CloudSaveMeta[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [saveName, setSaveName] = useState('');

  const refreshCloudSaves = async () => {
    if (!user) return;
    setCloudLoading(true);
    try {
      setCloudSaves(await listCloudSaves(user.id));
    } catch {
      toast('Could not reach the cloud — check your connection.', 'err');
    } finally {
      setCloudLoading(false);
    }
  };

  const openManage = () => {
    setManageOpen(true);
    setSaveName(state?.player.name ? `${state.player.name}'s Life` : 'My Save');
    void refreshCloudSaves();
  };

  const submitAuth = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = mode === 'signup' ? await signUp(email, password, displayName) : await signIn(email, password);
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    if (result.needsEmailConfirm) { setNotice(result.message); return; }
    setAuthOpen(false);
    setEmail('');
    setPassword('');
    setDisplayName('');
    toast(mode === 'signup' ? '👋 Account created — welcome!' : '👋 Signed in.', 'ok');
  };

  const doUpload = async () => {
    if (!user || !state) return;
    setCloudLoading(true);
    const res = await uploadCloudSave(user.id, saveName, state);
    toast(res.message, res.ok ? 'ok' : 'err');
    if (res.ok) await refreshCloudSaves();
    setCloudLoading(false);
  };

  const doDownload = async (meta: CloudSaveMeta) => {
    setCloudLoading(true);
    try {
      const cloudState = await downloadCloudSave(meta.id);
      importFrom(JSON.stringify(cloudState));
      setManageOpen(false);
      toast(`Loaded "${meta.save_name}" from the cloud.`, 'ok');
    } catch {
      toast('Could not load that cloud save.', 'err');
    } finally {
      setCloudLoading(false);
    }
  };

  const doDelete = async (meta: CloudSaveMeta) => {
    setCloudLoading(true);
    const ok = await deleteCloudSave(meta.id);
    if (ok) await refreshCloudSaves();
    else toast('Could not delete that cloud save.', 'err');
    setCloudLoading(false);
  };

  if (!initialized) return null;

  return (
    <>
      <Card className="p-5 mt-4">
        {user ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center font-black shrink-0">
                {displayNameOf(user).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate flex items-center gap-1.5">
                  {displayNameOf(user)} <Badge tone="brand">Bitizen</Badge>
                </div>
                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="soft" onClick={openManage}>☁️ Cloud</Button>
              <Button size="sm" variant="ghost" onClick={() => void signOut()}>Sign Out</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-sm">🪪 No account</div>
              <div className="text-[11px] text-slate-400">Sign in to back up your life to the cloud.</div>
            </div>
            <Button size="sm" onClick={() => { setMode('signin'); setAuthOpen(true); }}>Sign In</Button>
          </div>
        )}
      </Card>

      {/* Sign in / sign up */}
      <Modal open={authOpen} onClose={() => setAuthOpen(false)} title={mode === 'signup' ? 'Create Account' : 'Sign In'}>
        <div className="space-y-3">
          {mode === 'signup' && (
            <Field label="Display name">
              <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Bitizen" maxLength={24} />
            </Field>
          )}
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </Field>
          {error && <p className="text-sm text-rose-500 font-semibold">{error}</p>}
          {notice && <p className="text-sm text-emerald-500 font-semibold">{notice}</p>}
          <Button className="w-full" disabled={busy || !email || password.length < 6} onClick={() => void submitAuth()}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </Button>
          <button
            className="w-full text-center text-xs font-semibold text-brand-600 dark:text-brand-400"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setNotice(null); }}
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : "New here? Create an account"}
          </button>
        </div>
      </Modal>

      {/* Cloud save management */}
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Cloud Saves">
        <div className="space-y-4">
          {state && (
            <Card className="p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Save your current life</div>
              <div className="flex gap-2">
                <TextInput value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={60} className="flex-1" />
                <Button size="sm" disabled={cloudLoading} onClick={() => void doUpload()}>Save</Button>
              </div>
              <div className="text-[11px] text-slate-400 mt-2">{cloudSaves.length}/{MAX_CLOUD_SAVES} cloud slots used</div>
            </Card>
          )}
          <div className="space-y-2">
            {cloudSaves.map((s) => (
              <Card key={s.id} className="p-3 flex items-center justify-between gap-2">
                <button className="text-left min-w-0 flex-1" onClick={() => void doDownload(s)} disabled={cloudLoading}>
                  <div className="font-bold text-sm truncate">{s.save_name}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {s.player_name ?? 'Unknown'} · {s.net_worth != null ? money(s.net_worth) : '—'}
                  </div>
                </button>
                <button className="text-rose-500 text-xs font-semibold px-2 shrink-0" onClick={() => void doDelete(s)} disabled={cloudLoading}>
                  Delete
                </button>
              </Card>
            ))}
            {!cloudLoading && cloudSaves.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No cloud saves yet.</p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
