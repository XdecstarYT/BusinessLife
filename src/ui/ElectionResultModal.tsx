/** Election-night results reveal: an animated vote-share tally shown after a campaign resolves. */
import { lazy, Suspense, useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { Button } from './components';

const ElectionMapScene = lazy(() => import('./three/ElectionMapScene').then((m) => ({ default: m.ElectionMapScene })));

export function ElectionResultModal() {
  const { state, dismissElectionResult } = useGame();
  const result = state?.player.lastElectionResult ?? null;
  const [tally, setTally] = useState(0);

  useEffect(() => {
    if (!result) return;
    setTally(0);
    const target = result.playerSharePct;
    const step = Math.max(1, Math.round(target / 20));
    const id = setInterval(() => {
      setTally((t) => {
        const next = t + step;
        if (next >= target) {
          clearInterval(id);
          return target;
        }
        return next;
      });
    }, 40);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.officeTitle, result?.regionName, result?.won]);

  if (!result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-ink-850 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 anim-in border border-slate-100 dark:border-ink-800">
        <div className="text-xs text-center uppercase font-bold tracking-wide text-brand-500 mb-1">Election Night</div>
        <div className="text-center font-extrabold text-lg mb-1">{result.officeTitle} · {result.regionName}</div>
        <div className={`text-center text-4xl font-black my-4 ${result.won ? 'text-emerald-500' : 'text-rose-500'}`}>
          {result.won ? 'VICTORY' : 'DEFEAT'}
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold">You</span>
              <span className="font-bold">{tally}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
              <div className="h-full bg-brand-500 transition-all duration-150" style={{ width: `${tally}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Opponents</span>
              <span className="font-bold text-slate-500 dark:text-slate-400">{result.rivalSharePct}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
              <div className="h-full bg-slate-400 dark:bg-ink-600" style={{ width: `${result.rivalSharePct}%` }} />
            </div>
          </div>
        </div>
        {result.regionalBreakdown.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ink-800">
            <div className="text-xs font-bold uppercase text-slate-400 mb-2">By City</div>
            <Suspense fallback={<div className="w-full h-48 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />}>
              <ElectionMapScene regionalBreakdown={result.regionalBreakdown} />
            </Suspense>
            <div className="space-y-1.5 max-h-40 overflow-y-auto mt-3">
              {result.regionalBreakdown.map((r) => (
                <div key={r.cityName} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{r.cityName}</span>
                  <span className={`font-semibold ${r.playerSharePct >= 50 ? 'text-emerald-500' : 'text-rose-500'}`}>{r.playerSharePct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <Button className="w-full mt-5" size="lg" onClick={dismissElectionResult}>Continue</Button>
      </div>
    </div>
  );
}
