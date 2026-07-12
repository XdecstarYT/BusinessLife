/**
 * App chrome, styled after BitLife: a flat signature-green header banner
 * (identity left, bank balance right), a persistent four-stat strip —
 * Happiness / Health / Smarts / Charisma — pinned above the tab bar, and a
 * five-slot bottom bar whose center is the big raised circular AGE button
 * that advances the year from anywhere. "Job / Assets / Relations" cover the
 * classic tabs; "Activities" opens a sheet listing every other screen, so
 * everything stays reachable in at most two taps.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGame, type Screen } from '../store/gameStore';
import { titleForRank } from '../data/careers';
import { money } from './format';
import { IconAssets, IconCareer, IconHeart, IconMenu, IconMoon, IconSun } from './icons';
import { AnimatedNumber, ListRow, ListSectionBar, ListSheetHeader, TextInput } from './components';

const SIDE_TABS: { screen: Screen; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { screen: 'career', label: 'Job', Icon: IconCareer },
  { screen: 'assets', label: 'Assets', Icon: IconAssets },
  { screen: 'family', label: 'Relations', Icon: IconHeart },
];

interface ActivityEntry {
  screen: Screen;
  label: string;
  subtitle: string;
  icon: string;
}

// Grouped BitLife-style: a gray category bar, then icon + bold title + gray
// subtitle rows — everything besides the four pinned tab-bar slots lives here.
const ACTIVITY_GROUPS: { title: string; items: ActivityEntry[] }[] = [
  {
    title: 'Featured',
    items: [
      { screen: 'life', label: 'Life Story', subtitle: 'Your story, year by year', icon: '📖' },
      { screen: 'explore', label: 'City', subtitle: 'Walk your empire in 3D', icon: '🏙️' },
    ],
  },
  {
    title: 'Play',
    items: [
      { screen: 'athlete', label: 'Athlete', subtitle: 'Play soccer, football & running in 3D', icon: '🏟️' },
      { screen: 'military', label: 'Military Service', subtitle: 'Enlist, deploy, earn medals', icon: '🪖' },
      { screen: 'drugs', label: 'Drug Empire', subtitle: 'Deal, produce, and control turf', icon: '🌿' },
      { screen: 'casino', label: 'Casino', subtitle: 'Slots, tables, sports book', icon: '🎰' },
      { screen: 'entertainment', label: 'Entertainment', subtitle: 'Chase fame as an actor or musician', icon: '🎬' },
      { screen: 'medical', label: 'Medical Career', subtitle: 'Med school, residency, save lives', icon: '🩺' },
      { screen: 'cult', label: 'Movement', subtitle: 'Found a following, collect donations', icon: '🔮' },
      { screen: 'space', label: 'Space Program', subtitle: 'Train and fly real missions', icon: '🚀' },
      { screen: 'legal', label: 'Legal Career', subtitle: 'Law school, cases, maybe the bench', icon: '⚖️' },
      { screen: 'culinary', label: 'Culinary Empire', subtitle: 'Cook your way to your own restaurant', icon: '👨‍🍳' },
    ],
  },
  {
    title: 'Empire',
    items: [
      { screen: 'business', label: 'Business', subtitle: 'Found and run companies', icon: '🏢' },
      { screen: 'market', label: 'Markets', subtitle: 'Trade stocks, crypto & more', icon: '📈' },
      { screen: 'studio', label: 'Studio', subtitle: 'Design and launch products', icon: '✨' },
      { screen: 'politics', label: 'Politics', subtitle: 'Run for office, pass laws', icon: '🏛️' },
    ],
  },
  {
    title: 'World',
    items: [
      { screen: 'world', label: 'World', subtitle: 'Foreign relations & global events', icon: '🌍' },
      { screen: 'news', label: 'News', subtitle: "Today's headlines", icon: '📰' },
    ],
  },
  {
    title: 'You',
    items: [
      { screen: 'stats', label: 'Stats', subtitle: 'Your full life story', icon: '📊' },
      { screen: 'leaderboard', label: 'Ranks', subtitle: 'Global leaderboard', icon: '🏆' },
    ],
  },
];
const ACTIVITY_SCREENS: Screen[] = ACTIVITY_GROUPS.flatMap((g) => g.items.map((i) => i.screen));

/** BitLife-style stat meter: emoji, label, thin bar, percent readout. `faces`, if given, is a
 * worst-to-best tier list — the icon itself reacts to the stat instead of staying static, the
 * same way BitLife's own head icon changes expression with mood. */
function MeterBar({ emoji, label, value, faces }: { emoji: string; label: string; value: number; faces?: string[] }) {
  const v = Math.max(0, Math.min(100, value));
  const fill = v < 25 ? 'bg-rose-500' : v < 50 ? 'bg-amber-400' : 'bg-brand-500';
  const icon = faces ? faces[Math.min(faces.length - 1, Math.floor((v / 100) * faces.length))] : emoji;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-sm leading-none shrink-0 transition-all duration-300">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
          <span className="truncate">{label}</span>
          <span>{Math.round(v)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-ink-700 overflow-hidden">
          <div className={`h-full rounded-full ${fill} transition-all duration-500`} style={{ width: `${v}%` }} />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state, screen, setScreen, nextYear, darkMode, toggleDark, toMenu } = useGame();
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [activityQuery, setActivityQuery] = useState('');
  const [agePulse, setAgePulse] = useState(0);
  const prevMoney = useRef<number | null>(null);
  const [moneyFlash, setMoneyFlash] = useState<'up' | 'down' | null>(null);
  const currentMoney = state?.player.money ?? null;
  useEffect(() => {
    if (currentMoney === null) return;
    if (prevMoney.current !== null && prevMoney.current !== currentMoney) {
      setMoneyFlash(currentMoney > prevMoney.current ? 'up' : 'down');
      const t = setTimeout(() => setMoneyFlash(null), 700);
      prevMoney.current = currentMoney;
      return () => clearTimeout(t);
    }
    prevMoney.current = currentMoney;
  }, [currentMoney]);
  if (!state) return <>{children}</>;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const inActivities = ACTIVITY_SCREENS.includes(screen);
  const closeActivities = () => { setActivitiesOpen(false); setActivityQuery(''); };
  const q = activityQuery.trim().toLowerCase();
  const filteredGroups = q
    ? ACTIVITY_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)),
      })).filter((group) => group.items.length > 0)
    : ACTIVITY_GROUPS;
  const occupation = p.office
    ? `${p.office.title} of ${p.office.regionName}`
    : p.job
      ? titleForRank(p.job.title, p.job.rank)
      : p.retired
        ? 'Retired'
        : 'Unemployed';

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-ink-900 text-slate-900 dark:text-white app-bg">
      {/* Top banner — flat BitLife green */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-md pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => setScreen('life')} className="flex items-center gap-2.5 min-w-0 group text-left">
            <div className="w-10 h-10 rounded-full bg-white text-brand-600 flex items-center justify-center font-black text-lg shrink-0 shadow group-active:scale-95 transition-transform">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm truncate leading-tight flex items-center gap-1" title={p.name}>
                {state.achievements.includes('born_royal') && <span title="Born Royal">👑</span>}
                {p.name}
              </div>
              <div className="text-[11px] text-white/85 leading-tight truncate">
                {occupation} · Age {p.age} · {home.flag}
              </div>
            </div>
          </button>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div
                className={`font-black leading-tight whitespace-nowrap drop-shadow-sm rounded-lg px-1 -mx-1 transition-colors duration-500 ${
                  moneyFlash === 'up' ? 'bg-emerald-400/40' : moneyFlash === 'down' ? 'bg-rose-500/40' : ''
                }`}
              >
                <AnimatedNumber value={p.money} format={(n) => money(n, home.currencySymbol)} />
              </div>
              <div className="text-[10px] text-white/85 leading-tight whitespace-nowrap">Bank Balance · {state.year}</div>
            </div>
            <button
              onClick={toggleDark}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0 transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Content — keyed by screen so each navigation replays the entrance animation */}
      <main
        key={screen}
        className="anim-screen flex-1 max-w-2xl lg:max-w-3xl xl:max-w-4xl w-full mx-auto px-4 pb-40 pt-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
      >
        {children}
      </main>

      {/* Persistent BitLife stat strip + tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-ink-850/95 backdrop-blur-xl border-t border-slate-200/70 dark:border-ink-800 shadow-[0_-4px_20px_rgb(15_23_42/0.08)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <button
          onClick={() => setScreen('stats')}
          className="w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto px-4 pt-2 pb-1.5 grid grid-cols-4 gap-3 border-b border-slate-100 dark:border-ink-800"
          aria-label="Open full stats"
        >
          <MeterBar emoji="😊" label="Happiness" value={p.happiness} faces={['😭', '😢', '😕', '😐', '🙂', '😄']} />
          <MeterBar emoji="❤️" label="Health" value={p.health} faces={['💀', '🤒', '😷', '🙂', '💪', '💪']} />
          <MeterBar emoji="🧠" label="Smarts" value={p.smarts} />
          <MeterBar emoji="😎" label="Charisma" value={p.charisma} />
        </button>
        <div className="max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto px-2 flex items-end justify-around">
          {SIDE_TABS.slice(0, 2).map(({ screen: s, label, Icon }) => (
            <TabButton key={s} active={screen === s} label={label} Icon={Icon} onClick={() => setScreen(s)} />
          ))}
          {/* The signature center AGE button — raised above the bar */}
          <div className="relative flex-1 min-w-0 flex justify-center">
            <button
              onClick={() => { setAgePulse((n) => n + 1); nextYear(); }}
              aria-label="Age up one year"
              className="relative -top-5 w-16 h-16 rounded-full bg-gradient-to-b from-brand-400 to-brand-600 text-white flex flex-col items-center justify-center border-4 border-white dark:border-ink-850 [box-shadow:var(--shadow-glow-brand)] active:scale-90 transition-transform duration-150"
            >
              {agePulse > 0 && <span key={agePulse} aria-hidden className="absolute inset-0 rounded-full bg-brand-400 animate-ping" />}
              <span className="relative text-2xl font-black leading-none">+</span>
              <span className="relative text-[10px] font-extrabold tracking-widest leading-none">AGE</span>
            </button>
          </div>
          <TabButton
            active={screen === 'family'}
            label="Relations"
            Icon={IconHeart}
            onClick={() => setScreen('family')}
          />
          <TabButton active={inActivities} label="Activities" Icon={IconMenu} onClick={() => setActivitiesOpen(true)} />
        </div>
      </nav>

      {/* Activities sheet: every other screen, BitLife-style grouped scrolling list */}
      {activitiesOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm anim-fade" onClick={closeActivities} />
          <div className="relative w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-[#fdf6df] dark:bg-ink-900 rounded-t-3xl sm:rounded-3xl shadow-2xl anim-sheet overflow-hidden">
            <ListSheetHeader title="Activities" onClose={closeActivities} />
            <div className="px-4 sm:px-4 pb-2">
              <TextInput
                value={activityQuery}
                onChange={(e) => setActivityQuery(e.target.value)}
                placeholder="🔍 Search activities…"
                autoFocus={false}
              />
            </div>
            <div className="overflow-y-auto flex-1 px-4 sm:px-0">
              {filteredGroups.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No activities match "{activityQuery}".</div>
              )}
              {filteredGroups.map((group) => (
                <div key={group.title}>
                  <ListSectionBar label={group.title} />
                  {group.items.map((item) => (
                    <ListRow
                      key={item.screen}
                      icon={item.icon}
                      title={item.label}
                      subtitle={item.subtitle}
                      onClick={() => { setScreen(item.screen); closeActivities(); }}
                    />
                  ))}
                </div>
              ))}
              <div className="p-4">
                <button
                  onClick={() => { closeActivities(); toMenu(); }}
                  className="w-full rounded-2xl bg-slate-100 dark:bg-ink-800 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors"
                >
                  ⏏️ Save &amp; Main Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  Icon: (p: { className?: string }) => ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 py-2 px-0.5 flex-1 min-w-0 transition-colors duration-200 ${
        active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-1 w-11 h-7 rounded-full bg-brand-500/12 dark:bg-brand-400/15 transition-[opacity,transform] duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
          active ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
      />
      <Icon className="relative w-6 h-6 shrink-0" />
      <span className="relative text-[10px] sm:text-[11px] font-bold w-full text-center leading-tight">{label}</span>
    </button>
  );
}
