/** Toasts and the game-over screen. */
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { checkRoyaltyFromTop, fetchTopLegacy, submitLegacyScore } from '../net/leaderboard';
import { awardRibbonForLife, type RibbonDef } from '../data/ribbons';
import { Button } from './components';

export function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="fixed bottom-24 inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-in pointer-events-auto rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg max-w-sm text-center ${
            t.tone === 'err' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-ink-900'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function GameOver() {
  const { state, toMenu, toast } = useGame();
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'done'>('idle');
  // Award this life's ribbon exactly once when the game-over screen first shows
  // (not per render, and not while a succession offer might still continue the run).
  const [ribbonAward, setRibbonAward] = useState<{ ribbon: RibbonDef; firstTime: boolean } | null>(null);
  const awardedFor = useRef<object | null>(null);
  useEffect(() => {
    if (state?.gameOver && !state.pendingSuccession && awardedFor.current !== state.gameOver) {
      awardedFor.current = state.gameOver;
      setRibbonAward(awardRibbonForLife(state));
    }
  }, [state, state?.gameOver, state?.pendingSuccession]);
  if (!state?.gameOver || state.pendingSuccession) return null;
  const go = state.gameOver;
  const home = state.countries.find((c) => c.id === state.player.countryId);

  const submitLegacy = async () => {
    setSubmitState('submitting');
    const result = await submitLegacyScore(state.player.name, go.legacyScore, go.finalAge, state.year, home?.name ?? null);
    setSubmitState('done');
    if (result === 'submitted') {
      toast('🏆 New personal best posted to the Legacy leaderboard.', 'ok');
      // Check for a fresh #1 right away, while we know the network is reachable, rather than
      // waiting for the player to open the Leaderboard screen on their own.
      try {
        const top = await fetchTopLegacy(1);
        if (checkRoyaltyFromTop('legacy', top[0])) {
          toast("👑 You're #1 worldwide! Your next life can be born into royalty.", 'ok');
        }
      } catch { /* best-effort — the Leaderboard screen will catch it on next visit */ }
    } else if (result === 'not_a_new_best') {
      toast("Not a new best for this device — leaderboard wasn't updated.", 'ok');
    } else {
      toast('Could not reach the leaderboard — check your connection.', 'err');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur" />
      <div className="relative w-full max-w-md bg-white dark:bg-ink-850 rounded-3xl shadow-2xl p-8 anim-in text-center border border-slate-100 dark:border-ink-800">
        <div className="text-5xl mb-3">⚰️</div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{state.player.name}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-3">{go.reason}</p>
        {ribbonAward && (
          <div className="mb-4 rounded-2xl bg-gradient-to-b from-brand-400 to-brand-600 text-white px-5 py-3 [box-shadow:var(--shadow-glow-brand)] anim-in">
            <div className="text-3xl leading-none mb-1">{ribbonAward.ribbon.icon}</div>
            <div className="font-black tracking-wide">{ribbonAward.ribbon.name} Ribbon{ribbonAward.firstTime ? ' — NEW!' : ''}</div>
            <div className="text-[11px] text-white/85">{ribbonAward.ribbon.description}</div>
          </div>
        )}
        <div className="inline-flex flex-col items-center bg-brand-500/10 rounded-2xl px-5 py-3 mb-4">
          <div className="text-[10px] uppercase font-bold text-brand-500 tracking-wide">Legacy Score</div>
          <div className="text-3xl font-black text-brand-500">{go.legacyScore}<span className="text-base text-slate-400">/100</span></div>
        </div>
        <div className="bg-slate-100 dark:bg-ink-800 rounded-2xl p-4 space-y-1.5 text-left mb-6">
          {go.summary.map((line, i) => (
            <p key={i} className={`text-sm ${i === 1 ? 'font-bold text-emerald-500' : 'text-slate-600 dark:text-slate-300'}`}>{line}</p>
          ))}
        </div>
        <Button
          variant="soft"
          className="w-full mb-2"
          disabled={submitState !== 'idle'}
          onClick={submitLegacy}
        >
          {submitState === 'submitting' ? 'Submitting…' : submitState === 'done' ? '🏆 Submitted' : '🏆 Submit to Legacy Leaderboard'}
        </Button>
        <Button size="lg" className="w-full" onClick={toMenu}>Start a New Life</Button>
      </div>
    </div>
  );
}
