/**
 * Global Leaderboard: the one online screen in the game. Two tabs share one row per device — a
 * live Net Worth ranking you can resubmit any time your run is going, and a Legacy Score ranking
 * that only updates when a completed life actually beats your device's previous best (submitted
 * from the death screen, see ui/Overlays.tsx). Fails soft: no connection just shows a friendly
 * offline state instead of breaking the rest of the (otherwise fully offline) game.
 */
import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { netWorth } from '../../sim/engine';
import { fetchTopLegacy, fetchTopNetWorth, submitNetWorth, type LegacyEntry, type NetWorthEntry } from '../../net/leaderboard';
import { Badge, Button, Card, SectionHeader } from '../components';
import { money } from '../format';
import { IconTrophy } from '../icons';

type Tab = 'networth' | 'legacy';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard() {
  const { state, toast } = useGame();
  const [tab, setTab] = useState<Tab>('networth');
  const [netWorthRows, setNetWorthRows] = useState<NetWorthEntry[] | null>(null);
  const [legacyRows, setLegacyRows] = useState<LegacyEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(() => state?.player.name ?? 'Anonymous');

  const load = () => {
    setLoadError(false);
    setNetWorthRows(null);
    setLegacyRows(null);
    Promise.all([fetchTopNetWorth(), fetchTopLegacy()])
      .then(([nw, lg]) => { setNetWorthRows(nw); setLegacyRows(lg); })
      .catch(() => setLoadError(true));
  };

  useEffect(load, []);

  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId);
  const myNetWorth = netWorth(state);

  const submit = async () => {
    setSubmitting(true);
    const ok = await submitNetWorth(name, myNetWorth, home?.name ?? null);
    setSubmitting(false);
    toast(ok ? '🏆 Score submitted to the leaderboard.' : 'Could not reach the leaderboard — check your connection.', ok ? 'ok' : 'err');
    if (ok) load();
  };

  const rows = tab === 'networth' ? netWorthRows : legacyRows;

  return (
    <div>
      <SectionHeader title="🏆 Leaderboard" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
        The one online part of an otherwise fully offline game — a public, no-login board. Anyone can post a
        score under any name, so treat it as bragging rights, not a certified ranking.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => setTab('networth')}
          className={`text-sm font-semibold py-2.5 rounded-xl transition-colors ${tab === 'networth' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'}`}
        >
          💰 Net Worth
        </button>
        <button
          onClick={() => setTab('legacy')}
          className={`text-sm font-semibold py-2.5 rounded-xl transition-colors ${tab === 'legacy' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'}`}
        >
          ⚰️ Legacy Score
        </button>
      </div>

      {tab === 'networth' && (
        <Card className="p-4 mb-3">
          <div className="font-bold mb-2">Submit Your Score</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Your name"
            className="w-full rounded-xl bg-slate-100 dark:bg-ink-800 px-3 py-2 text-sm mb-2 outline-none"
          />
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-slate-500 dark:text-slate-400">Current net worth</span>
            <span className="font-extrabold text-emerald-500">{money(myNetWorth)}</span>
          </div>
          <Button className="w-full" onClick={submit} disabled={submitting || !name.trim()}>
            {submitting ? 'Submitting…' : '🏆 Submit to Leaderboard'}
          </Button>
        </Card>
      )}

      {loadError && (
        <Card className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 mb-3">
          Couldn't reach the leaderboard. It's an online feature — the rest of the game works fine offline.
          <Button className="mt-3" onClick={load}>Retry</Button>
        </Card>
      )}

      {!loadError && rows === null && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />)}
        </div>
      )}

      {!loadError && rows !== null && rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No entries yet — be the first on the board.
        </Card>
      )}

      {!loadError && rows !== null && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const mine = row.device_id === localStorage.getItem('bl_device_id');
            return (
              <Card key={row.device_id} className={`p-3.5 flex items-center gap-3 ${mine ? 'ring-2 ring-brand-500' : ''}`}>
                <div className="w-8 text-center text-lg font-black text-slate-400 shrink-0">{MEDALS[i] ?? i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate flex items-center gap-1.5">
                    {row.player_name}
                    {mine && <Badge tone="brand">You</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {row.country ?? 'Unknown'}
                    {tab === 'legacy' && (row as LegacyEntry).legacy_age !== null && ` · Died at ${(row as LegacyEntry).legacy_age}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {tab === 'networth' ? (
                    <div className="font-extrabold text-emerald-500">{money((row as NetWorthEntry).net_worth)}</div>
                  ) : (
                    <div className="font-extrabold text-brand-500 flex items-center gap-1">
                      <IconTrophy className="w-4 h-4" />{(row as LegacyEntry).legacy_score}<span className="text-xs text-slate-400 font-normal">/100</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
