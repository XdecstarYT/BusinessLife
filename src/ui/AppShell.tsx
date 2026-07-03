/**
 * App chrome: a sticky top bar (identity, cash, year, theme toggle) and a
 * bottom tab bar in the style of the reference. The tab bar exposes the five
 * primary sections; secondary sections are reached from the Life hub grid.
 */
import type { ReactNode } from 'react';
import { useGame, type Screen } from '../store/gameStore';
import { money } from './format';
import { IconBusiness, IconLife, IconMarket, IconMoon, IconPolitics, IconSun, IconWorld } from './icons';

const TABS: { screen: Screen; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { screen: 'life', label: 'Life', Icon: IconLife },
  { screen: 'business', label: 'Business', Icon: IconBusiness },
  { screen: 'market', label: 'Markets', Icon: IconMarket },
  { screen: 'politics', label: 'Politics', Icon: IconPolitics },
  { screen: 'world', label: 'World', Icon: IconWorld },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { state, screen, setScreen, darkMode, toggleDark, toMenu } = useGame();
  if (!state) return <>{children}</>;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-ink-900 text-slate-900 dark:text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-slate-50/90 dark:bg-ink-900/90 backdrop-blur border-b border-slate-100 dark:border-ink-800 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={toMenu} className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white font-black shrink-0">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 text-left">
              <div className="font-bold text-sm truncate leading-tight" title={p.name}>{p.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight truncate">
                Age {p.age} · {home.flag} {home.name}
              </div>
            </div>
          </button>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="font-extrabold text-emerald-500 leading-tight whitespace-nowrap">{money(p.money, home.currencySymbol)}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight whitespace-nowrap">Year {state.year}</div>
            </div>
            <button
              onClick={toggleDark}
              className="w-9 h-9 rounded-full bg-slate-100 dark:bg-ink-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0"
              aria-label="Toggle theme"
            >
              {darkMode ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full mx-auto px-4 pb-28 pt-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-ink-850/95 backdrop-blur border-t border-slate-100 dark:border-ink-800 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto px-2 flex justify-around">
          {TABS.map(({ screen: s, label, Icon }) => {
            const active = screen === s;
            return (
              <button
                key={s}
                onClick={() => setScreen(s)}
                className={`flex flex-col items-center gap-0.5 py-2.5 px-0.5 flex-1 min-w-0 ${
                  active ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <Icon className="w-6 h-6 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-semibold w-full text-center leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
