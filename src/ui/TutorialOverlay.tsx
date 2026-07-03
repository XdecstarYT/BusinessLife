/** A light, dismissible first-launch walkthrough of the core loop. Shown once per browser. */
import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { Button } from './components';

const SEEN_KEY = 'businesslife_tutorial_seen';

const STEPS = [
  {
    icon: '🕰️',
    title: 'You control time',
    body: 'Use +1 Day, +1 Week, or Year → on the Life hub to advance. Days and weeks are quick flavor ticks; the full economy, markets, and politics resolve once a year.',
  },
  {
    icon: '🧭',
    title: 'Everything is one tap away',
    body: 'The hub grid and bottom tab bar reach Career, Business, Markets, Assets, Politics, Family, World, News, and Stats from anywhere. Tap "More" for the rest.',
  },
  {
    icon: '🏢',
    title: 'Build your empire',
    body: 'Found companies, invest in stocks, buy property, and climb the political ladder — all at once if you want. Nothing is mutually exclusive.',
  },
  {
    icon: '📜',
    title: 'Choices shape your story',
    body: 'Events pop up as your life unfolds. Pick wisely — your stats, skills, and reputation all influence the odds.',
  },
];

export function TutorialOverlay() {
  const { state } = useGame();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return !!localStorage.getItem(SEEN_KEY);
    } catch {
      return false;
    }
  });
  const [step, setStep] = useState(0);

  if (!state || dismissed) return null;

  const finish = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore storage errors (private browsing, etc.) */
    }
    setDismissed(true);
  };

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-ink-850 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 anim-in border border-slate-100 dark:border-ink-800">
        <div className="text-4xl text-center mb-3">{s.icon}</div>
        <h3 className="text-lg font-extrabold text-center mb-2">{s.title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5">{s.body}</p>
        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-brand-500' : 'w-1.5 bg-slate-200 dark:bg-ink-700'}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {!last && (
            <Button variant="ghost" className="flex-1" onClick={finish}>
              Skip
            </Button>
          )}
          <Button className="flex-1" onClick={() => (last ? finish() : setStep((s) => s + 1))}>
            {last ? "Let's go" : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
