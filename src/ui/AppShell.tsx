/**
 * App chrome: a sticky top bar (identity, cash, year, theme toggle) and a
 * bottom tab bar in the style of the reference. The bar covers the four most
 * frequent sections plus a "More" tab that opens a sheet listing every
 * remaining screen — so every screen is reachable in at most two taps from
 * anywhere in the app, not just from the Life hub grid.
 */
import { useState, type ReactNode } from 'react';
import { useGame, type Screen } from '../store/gameStore';
import { money } from './format';
import {
  IconAssets,
  IconBusiness,
  IconCareer,
  IconHeart,
  IconLife,
  IconMarket,
  IconMenu,
  IconMoon,
  IconNews,
  IconPolitics,
  IconSpark,
  IconStats,
  IconSun,
  IconWorld,
} from './icons';
import { Modal } from './components';

const TABS: { screen: Screen; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { screen: 'life', label: 'Life', Icon: IconLife },
  { screen: 'business', label: 'Business', Icon: IconBusiness },
  { screen: 'market', label: 'Markets', Icon: IconMarket },
  { screen: 'politics', label: 'Politics', Icon: IconPolitics },
];

const MORE_SCREENS: { screen: Screen; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { screen: 'studio', label: 'Studio', Icon: IconSpark },
  { screen: 'career', label: 'Career', Icon: IconCareer },
  { screen: 'assets', label: 'Assets', Icon: IconAssets },
  { screen: 'family', label: 'Family', Icon: IconHeart },
  { screen: 'world', label: 'World', Icon: IconWorld },
  { screen: 'news', label: 'News', Icon: IconNews },
  { screen: 'stats', label: 'Stats', Icon: IconStats },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { state, screen, setScreen, darkMode, toggleDark, toMenu } = useGame();
  const [moreOpen, setMoreOpen] = useState(false);
  if (!state) return <>{children}</>;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const inMore = MORE_SCREENS.some((m) => m.screen === screen);

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
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 py-2.5 px-0.5 flex-1 min-w-0 ${
              inMore ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <IconMenu className="w-6 h-6 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold w-full text-center leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* "More" sheet: every remaining screen, reachable from anywhere */}
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="grid grid-cols-3 gap-4">
          {MORE_SCREENS.map(({ screen: s, label, Icon }) => (
            <button
              key={s}
              onClick={() => { setScreen(s); setMoreOpen(false); }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  screen === s ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
