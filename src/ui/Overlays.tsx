/** Toasts and the game-over screen. */
import { useGame } from '../store/gameStore';
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
  const { state, toMenu } = useGame();
  if (!state?.gameOver) return null;
  const go = state.gameOver;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur" />
      <div className="relative w-full max-w-md bg-white dark:bg-ink-850 rounded-3xl shadow-2xl p-8 anim-in text-center border border-slate-100 dark:border-ink-800">
        <div className="text-5xl mb-3">⚰️</div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{state.player.name}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-5">{go.reason}</p>
        <div className="bg-slate-100 dark:bg-ink-800 rounded-2xl p-4 space-y-1.5 text-left mb-6">
          {go.summary.map((line, i) => (
            <p key={i} className={`text-sm ${i === 1 ? 'font-bold text-emerald-500' : 'text-slate-600 dark:text-slate-300'}`}>{line}</p>
          ))}
        </div>
        <Button size="lg" className="w-full" onClick={toMenu}>Start a New Life</Button>
      </div>
    </div>
  );
}
