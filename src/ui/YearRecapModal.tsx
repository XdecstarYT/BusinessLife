/** A brief "Year in Review" recap shown after each Year-advance: net worth change and top headlines. */
import { useGame } from '../store/gameStore';
import { Button } from './components';
import { money, signedPct } from './format';

export function YearRecapModal() {
  const { state, dismissYearRecap } = useGame();
  const recap = state?.yearRecap ?? null;
  if (!recap) return null;
  const delta = recap.netWorthEnd - recap.netWorthStart;
  const pct = recap.netWorthStart !== 0 ? delta / Math.abs(recap.netWorthStart) : 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-ink-850 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 anim-in border border-slate-100 dark:border-ink-800">
        <div className="text-xs text-center uppercase font-bold tracking-wide text-brand-500 mb-1">Year in Review</div>
        <div className="text-center font-extrabold text-lg mb-4">{recap.year} → {recap.year + 1}</div>
        <div className="bg-slate-100 dark:bg-ink-800 rounded-2xl p-4 text-center mb-4">
          <div className="text-xs text-slate-400">Net Worth</div>
          <div className="text-2xl font-black">{money(recap.netWorthEnd)}</div>
          <div className={`text-sm font-semibold ${delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {delta >= 0 ? '+' : ''}{money(delta)} ({signedPct(pct)})
          </div>
        </div>
        {recap.headlines.length > 0 && (
          <div className="space-y-1.5 mb-5">
            {recap.headlines.map((h, i) => (
              <p key={i} className="text-sm text-slate-600 dark:text-slate-300">{h}</p>
            ))}
          </div>
        )}
        <Button className="w-full" size="lg" onClick={dismissYearRecap}>Continue</Button>
      </div>
    </div>
  );
}
