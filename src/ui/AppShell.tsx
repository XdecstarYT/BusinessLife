/**
 * App chrome. A flat, editorial header (identity left, bank balance right) and a
 * persistent four-stat strip — Happiness / Health / Smarts / Charisma — sit above
 * navigation that adapts to viewport width:
 *  - `lg:` and wider: a persistent left sidebar lists every screen (pinned tabs +
 *    grouped activities, with search), so nothing is ever more than one click away
 *    and the Activities sheet never has to open.
 *  - narrower than `lg:`: the classic bottom tab bar (Job / Assets / center AGE
 *    button / Relations / Activities) with a searchable, grouped Activities sheet
 *    for everything else — now with a "Recents" section pinned above the groups.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

// Grouped: a gray category bar, then icon + bold title + gray subtitle rows —
// everything besides the pinned tab-bar slots lives here.
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
      { screen: 'aviation', label: 'Aviation', subtitle: 'Become a pilot — fly real 3D routes', icon: '✈️' },
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
      { screen: 'domination', label: 'World Domination', subtitle: 'The endgame — conquer the globe', icon: '👑' },
      { screen: 'news', label: 'News', subtitle: "Today's headlines", icon: '📰' },
    ],
  },
  {
    title: 'You',
    items: [
      { screen: 'stats', label: 'Stats', subtitle: 'Your full life story', icon: '📊' },
      { screen: 'leaderboard', label: 'Ranks', subtitle: 'Global leaderboard', icon: '🏆' },
      { screen: 'updates', label: 'Update Log', subtitle: "What's new in the game", icon: '🆕' },
    ],
  },
];
const ACTIVITY_SCREENS: Screen[] = ACTIVITY_GROUPS.flatMap((g) => g.items.map((i) => i.screen));
const ACTIVITY_BY_SCREEN = new Map(ACTIVITY_GROUPS.flatMap((g) => g.items).map((i) => [i.screen, i]));

const RECENTS_KEY = 'bl_recent_screens';
const RECENTS_MAX = 4;
function loadRecents(): Screen[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as Screen[]) : [];
  } catch {
    return [];
  }
}
function saveRecents(list: Screen[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — recents just won't persist */
  }
}

/** Stat meter: emoji, label, thin bar, percent readout. `faces`, if given, is a worst-to-best
 * tier list — the icon itself reacts to the stat instead of staying static. */
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
  const [navQuery, setNavQuery] = useState('');
  const [agePulse, setAgePulse] = useState(0);
  const [recents, setRecents] = useState<Screen[]>(() => loadRecents());
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

  // Track the last few non-pinned screens visited so the mobile Activities sheet can surface
  // them above the full grouped list — fewer taps to get back to whatever you were just doing.
  useEffect(() => {
    if (!ACTIVITY_SCREENS.includes(screen)) return;
    setRecents((prev) => {
      const next = [screen, ...prev.filter((s) => s !== screen)].slice(0, RECENTS_MAX);
      saveRecents(next);
      return next;
    });
  }, [screen]);

  const inActivities = ACTIVITY_SCREENS.includes(screen);
  const closeActivities = () => { setActivitiesOpen(false); setNavQuery(''); };
  const q = navQuery.trim().toLowerCase();
  const filteredGroups = useMemo(
    () =>
      q
        ? ACTIVITY_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter((item) => item.label.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)),
          })).filter((group) => group.items.length > 0)
        : ACTIVITY_GROUPS,
    [q],
  );
  const recentEntries = recents.map((s) => ACTIVITY_BY_SCREEN.get(s)).filter((e): e is ActivityEntry => !!e);

  if (!state) return <>{children}</>;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const occupation = p.office
    ? `${p.office.title} of ${p.office.regionName}`
    : p.job
      ? titleForRank(p.job.title, p.job.rank)
      : p.retired
        ? 'Retired'
        : 'Unemployed';

  const ageUp = () => { setAgePulse((n) => n + 1); nextYear(); };

  return (
    <div className="min-h-full flex bg-slate-50 dark:bg-ink-900 text-slate-900 dark:text-white app-bg">
      {/* Persistent desktop sidebar — every screen one click away, with its own search. */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-slate-200 dark:border-ink-800 bg-white dark:bg-ink-850">
        <button onClick={() => setScreen('life')} className="flex items-center gap-2.5 px-4 py-4 text-left border-b border-slate-100 dark:border-ink-800">
          <div className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {p.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate leading-tight" title={p.name}>{p.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">{occupation} · Age {p.age}</div>
          </div>
        </button>

        <div className="px-3 pt-3">
          <TextInput value={navQuery} onChange={(e) => setNavQuery(e.target.value)} placeholder="🔍 Search…" />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-3">
          {!q && (
            <div className="mb-1">
              {SIDE_TABS.map(({ screen: s, label, Icon }) => (
                <SidebarRow key={s} active={screen === s} label={label} icon={<Icon className="w-[18px] h-[18px]" />} onClick={() => setScreen(s)} />
              ))}
            </div>
          )}
          {filteredGroups.map((group) => (
            <div key={group.title} className="mt-3 first:mt-0">
              <div className="px-2.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{group.title}</div>
              {group.items.map((item) => (
                <SidebarRow
                  key={item.screen}
                  active={screen === item.screen}
                  label={item.label}
                  icon={<span className="text-[15px] leading-none">{item.icon}</span>}
                  onClick={() => setScreen(item.screen)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-ink-800 space-y-2">
          <button
            onClick={ageUp}
            className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm py-2.5 transition-colors active:scale-[0.98]"
          >
            + Age Up
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDark}
              className="flex-1 rounded-xl bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors"
            >
              {darkMode ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />} Theme
            </button>
            <button
              onClick={toMenu}
              className="flex-1 rounded-xl bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300 py-2 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors"
            >
              ⏏️ Menu
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top banner — flat, editorial: identity + balance, no chrome games away with. */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-ink-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-ink-800 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <div className="max-w-2xl xl:max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <button onClick={() => setScreen('life')} className="flex lg:hidden items-center gap-2.5 min-w-0 group text-left">
              <div className="w-9 h-9 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm shrink-0 group-active:scale-95 transition-transform">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate leading-tight flex items-center gap-1" title={p.name}>
                  {state.achievements.includes('born_royal') && <span title="Born Royal">👑</span>}
                  {p.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                  {occupation} · Age {p.age} · {home.flag}
                </div>
              </div>
            </button>
            <div className="hidden lg:block text-sm font-semibold text-slate-500 dark:text-slate-400">{state.year}</div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div
                  className={`font-bold leading-tight whitespace-nowrap rounded-lg px-1 -mx-1 transition-colors duration-500 ${
                    moneyFlash === 'up' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : moneyFlash === 'down' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : ''
                  }`}
                >
                  <AnimatedNumber value={p.money} format={(n) => money(n, home.currencySymbol)} />
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight whitespace-nowrap lg:hidden">Bank Balance · {state.year}</div>
              </div>
              <button
                onClick={toggleDark}
                className="hidden lg:flex w-8 h-8 rounded-full bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 transition-colors"
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
          className="anim-screen flex-1 max-w-2xl xl:max-w-3xl w-full mx-auto px-4 pb-40 lg:pb-10 pt-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
        >
          {children}
        </main>

        {/* Mobile-only: persistent stat strip + tab bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-ink-850/95 backdrop-blur-xl border-t border-slate-200 dark:border-ink-800 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <button
            onClick={() => setScreen('stats')}
            className="w-full max-w-2xl xl:max-w-3xl mx-auto px-4 pt-2 pb-1.5 grid grid-cols-4 gap-3 border-b border-slate-100 dark:border-ink-800"
            aria-label="Open full stats"
          >
            <MeterBar emoji="😊" label="Happiness" value={p.happiness} faces={['😭', '😢', '😕', '😐', '🙂', '😄']} />
            <MeterBar emoji="❤️" label="Health" value={p.health} faces={['💀', '🤒', '😷', '🙂', '💪', '💪']} />
            <MeterBar emoji="🧠" label="Smarts" value={p.smarts} />
            <MeterBar emoji="😎" label="Charisma" value={p.charisma} />
          </button>
          <div className="max-w-2xl xl:max-w-3xl mx-auto px-2 flex items-end justify-around">
            {SIDE_TABS.slice(0, 2).map(({ screen: s, label, Icon }) => (
              <TabButton key={s} active={screen === s} label={label} Icon={Icon} onClick={() => setScreen(s)} />
            ))}
            {/* The center AGE button — raised above the bar */}
            <div className="relative flex-1 min-w-0 flex justify-center">
              <button
                onClick={ageUp}
                aria-label="Age up one year"
                className="relative -top-5 w-16 h-16 rounded-full bg-brand-500 text-white flex flex-col items-center justify-center border-4 border-white dark:border-ink-850 [box-shadow:var(--shadow-lift-lg)] active:scale-90 transition-transform duration-150"
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

        {/* Mobile Activities sheet: recents, then every other screen grouped + searchable. */}
        {activitiesOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm anim-fade" onClick={closeActivities} />
            <div className="relative w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-ink-900 rounded-t-2xl sm:rounded-2xl shadow-2xl anim-sheet overflow-hidden">
              <ListSheetHeader title="Activities" onClose={closeActivities} />
              <div className="px-4 sm:px-4 pb-2 pt-3">
                <TextInput
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  placeholder="🔍 Search activities…"
                  autoFocus={false}
                />
              </div>
              <div className="overflow-y-auto flex-1 px-4 sm:px-0">
                {filteredGroups.length === 0 && (
                  <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No activities match "{navQuery}".</div>
                )}
                {!q && recentEntries.length > 0 && (
                  <div>
                    <ListSectionBar label="Recent" />
                    {recentEntries.map((item) => (
                      <ListRow
                        key={`recent-${item.screen}`}
                        icon={item.icon}
                        title={item.label}
                        subtitle={item.subtitle}
                        onClick={() => { setScreen(item.screen); closeActivities(); }}
                      />
                    ))}
                  </div>
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
                    className="w-full rounded-xl bg-slate-100 dark:bg-ink-800 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors"
                  >
                    ⏏️ Save &amp; Main Menu
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarRow({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-ink-800'
      }`}
    >
      <span className="shrink-0 w-[18px] flex items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
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
