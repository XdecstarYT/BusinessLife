/** Shown on death when a will/heir continuation is available: continue as a family member, or end the story. */
import { useGame } from '../store/gameStore';
import { Badge, Button } from './components';

export function SuccessionModal() {
  const { state, continueAsHeir, endStoryHere } = useGame();
  const offer = state?.pendingSuccession ?? null;
  if (!offer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-ink-850 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 anim-in border border-slate-100 dark:border-ink-800 max-h-[90vh] overflow-y-auto">
        <div className="text-4xl text-center mb-3">🕯️</div>
        <h2 className="text-xl font-black text-center mb-1">{offer.deceasedName} has passed away</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5">
          The story doesn't have to end here. Continue as a family member who inherits per your will, or close this chapter for good.
        </p>
        <div className="space-y-2 mb-4">
          {offer.candidates.map((c) => (
            <button
              key={c.npcId}
              onClick={() => continueAsHeir(c.npcId)}
              className="w-full text-left p-4 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 flex items-center justify-between"
            >
              <div>
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{c.relation}</div>
              </div>
              {c.isPrimaryHeir && <Badge tone="brand">Primary Heir</Badge>}
            </button>
          ))}
        </div>
        <Button variant="ghost" className="w-full" onClick={endStoryHere}>
          End the Story Here
        </Button>
      </div>
    </div>
  );
}
