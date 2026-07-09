/** Modal that presents a fired event and its choices, then its outcome. */
import { useGame } from '../store/gameStore';
import { Button } from './components';
import type { EffectSpec } from '../sim/types';

const EFFECT_LABEL: { key: keyof EffectSpec; label: string; good: (v: number) => boolean; fmt?: (v: number) => string }[] = [
  { key: 'money', label: '💵', good: (v) => v > 0, fmt: (v) => (v > 0 ? '+' : '') + `$${Math.abs(v).toLocaleString()}` },
  { key: 'health', label: 'Health', good: (v) => v > 0 },
  { key: 'happiness', label: 'Happiness', good: (v) => v > 0 },
  { key: 'reputation', label: 'Reputation', good: (v) => v > 0 },
  { key: 'popularity', label: 'Popularity', good: (v) => v > 0 },
  { key: 'influence', label: 'Influence', good: (v) => v > 0 },
  { key: 'karma', label: 'Karma', good: (v) => v > 0 },
  { key: 'notoriety', label: 'Notoriety', good: (v) => v < 0 },
];

export function EventModal() {
  const { activeEvent, eventQueue, eventResult, chooseEvent, dismissEventResult } = useGame();

  if (eventResult) {
    return (
      <Overlay>
        <div className="text-4xl text-center mb-3">📜</div>
        {eventResult.text && <p className="text-center text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">{eventResult.text}</p>}
        {eventResult.logs.length > 0 && (
          <div className="space-y-1 mb-4">
            {eventResult.logs.map((l, i) => (
              <p key={i} className="text-sm text-center text-slate-500 dark:text-slate-400">{l}</p>
            ))}
          </div>
        )}
        <Button className="w-full" size="lg" onClick={dismissEventResult}>Continue</Button>
      </Overlay>
    );
  }

  if (!activeEvent) return null;

  return (
    <Overlay>
      <div className="text-3xl text-center mb-3">⚡</div>
      {eventQueue.length > 0 && (
        <div className="text-center text-xs font-semibold text-brand-500 mb-2">
          {eventQueue.length} more event{eventQueue.length > 1 ? 's' : ''} waiting after this one
        </div>
      )}
      <p className="text-center text-base font-semibold text-slate-800 dark:text-slate-100 mb-5 leading-relaxed">{activeEvent.text}</p>
      <div className="space-y-2">
        {activeEvent.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => chooseEvent(choice)}
            className="w-full text-left p-4 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-brand-50 dark:hover:bg-ink-700 border border-transparent hover:border-brand-300 transition-colors"
          >
            <div className="font-semibold text-slate-800 dark:text-slate-100">{choice.label}</div>
            {choice.effects && <EffectPreview fx={choice.effects} />}
            {choice.skillCheck && <div className="text-xs text-brand-500 mt-1">🎲 Skill check — your skills improve the odds</div>}
            {choice.outcomes && !choice.skillCheck && <div className="text-xs text-slate-400 mt-1">🎲 Outcome uncertain</div>}
          </button>
        ))}
      </div>
    </Overlay>
  );
}

function EffectPreview({ fx }: { fx: EffectSpec }) {
  const chips = EFFECT_LABEL.filter((e) => typeof fx[e.key] === 'number' && fx[e.key] !== 0).map((e) => {
    const v = fx[e.key] as number;
    const good = e.good(v);
    return (
      <span key={e.key} className={`text-[11px] font-semibold ${good ? 'text-emerald-500' : 'text-rose-500'}`}>
        {e.fmt ? e.fmt(v) : `${e.label} ${v > 0 ? '+' : ''}${v}`}
      </span>
    );
  });
  if (chips.length === 0) return null;
  return <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">{chips}</div>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-ink-850 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 anim-in border border-slate-100 dark:border-ink-800 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
