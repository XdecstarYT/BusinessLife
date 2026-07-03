/**
 * Life hub — the home screen. Featured "advance year" card, player stat bars,
 * a grid of circular icon tiles that navigate the game (mirroring the
 * reference's "Featured brands" grid), quick lifestyle chips, and the life
 * log feed. This is the screen the reference image most directly informs.
 */
import type { ReactNode } from 'react';
import { useGame, type Screen } from '../../store/gameStore';
import { doActivity } from '../../sim/actions';
import { netWorth } from '../../sim/engine';
import { Badge, Button, Card, CircleTile, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';
import {
  IconArrowRight,
  IconAssets,
  IconBrain,
  IconBusiness,
  IconCareer,
  IconHeart,
  IconMarket,
  IconNews,
  IconPolitics,
  IconSpark,
  IconStats,
  IconWorld,
} from '../icons';

const HUB: { screen: Screen; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { screen: 'career', label: 'Career', Icon: IconCareer },
  { screen: 'business', label: 'Business', Icon: IconBusiness },
  { screen: 'market', label: 'Markets', Icon: IconMarket },
  { screen: 'assets', label: 'Assets', Icon: IconAssets },
  { screen: 'politics', label: 'Politics', Icon: IconPolitics },
  { screen: 'family', label: 'Family', Icon: IconHeart },
  { screen: 'world', label: 'World', Icon: IconWorld },
  { screen: 'news', label: 'News', Icon: IconNews },
  { screen: 'stats', label: 'Stats', Icon: IconStats },
];

const LOG_TONE: Record<string, string> = {
  good: 'border-l-emerald-500',
  bad: 'border-l-rose-500',
  money: 'border-l-amber-500',
  politics: 'border-l-violet-500',
  business: 'border-l-brand-500',
  milestone: 'border-l-fuchsia-500',
  info: 'border-l-slate-300 dark:border-l-ink-700',
};

export function Life() {
  const { state, setScreen, nextYear, run, eventQueue, activeEvent } = useGame();
  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const nw = netWorth(state);
  const pendingCount = eventQueue.length + (activeEvent ? 1 : 0);
  const recentLog = [...state.lifeLog].slice(-14).reverse();

  const badgeFor = (s: Screen): string | number | undefined => {
    if (s === 'business') return p.companies.filter((id) => state.companies[id]?.status === 'active').length || undefined;
    if (s === 'politics') return p.office ? '★' : p.campaign ? '!' : undefined;
    if (s === 'family') return p.spouseId ? '💍' : undefined;
    return undefined;
  };

  return (
    <div className="space-y-1">
      {/* Featured hero: advance year */}
      <Card className="overflow-hidden mt-2">
        <div className="bg-gradient-to-br from-brand-600 via-brand-500 to-violet-500 p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-80">Net Worth</div>
              <div className="text-3xl font-black leading-tight">{money(nw, home.currencySymbol)}</div>
              <div className="text-sm opacity-90 mt-1">
                {p.office ? `${p.office.title} of ${p.office.regionName}` : p.job ? p.job.title : 'Independent'}
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <IconSpark className="w-8 h-8" />
            </div>
          </div>
          <Button
            onClick={nextYear}
            className="w-full mt-4 bg-white! text-brand-700! hover:bg-white/90! font-extrabold"
            size="lg"
          >
            {pendingCount > 0 ? `Resolve ${pendingCount} event${pendingCount > 1 ? 's' : ''} first` : `Advance to ${state.year + 1} →`}
          </Button>
        </div>
      </Card>

      {/* Vital stats */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Card className="p-4 space-y-3">
          <StatBar label="Health" value={p.health} icon={<IconHeart className="w-3.5 h-3.5" />} />
          <StatBar label="Happiness" value={p.happiness} icon={<IconSpark className="w-3.5 h-3.5" />} />
          <StatBar label="Smarts" value={p.smarts} icon={<IconBrain className="w-3.5 h-3.5" />} />
        </Card>
        <Card className="p-4 space-y-3">
          <StatBar label="Reputation" value={p.reputation} />
          <StatBar label="Popularity" value={p.popularity} />
          <StatBar label="Influence" value={p.influence} />
        </Card>
      </div>

      {/* Status chips */}
      <PillRow>
        <Badge tone={home.economy.regime === 'recession' || home.economy.regime === 'depression' ? 'bad' : home.economy.regime === 'boom' ? 'good' : 'neutral'}>
          📈 {home.economy.regime}
        </Badge>
        <Badge tone="brand">Karma {Math.round(p.karma)}</Badge>
        {p.notoriety > 3 && <Badge tone="warn">Notoriety {Math.round(p.notoriety)}</Badge>}
        {p.criminalRecord > 0 && <Badge tone="bad">Record ×{p.criminalRecord}</Badge>}
        {p.partyId && <Badge tone="brand">{home.parties.find((x) => x.id === p.partyId)?.name}</Badge>}
        <Badge tone="good">PC {Math.round(p.politicalCapital)}</Badge>
      </PillRow>

      {/* Hub grid — circular icon tiles */}
      <SectionHeader title="Manage" />
      <div className="grid grid-cols-4 gap-y-5 gap-x-2">
        {HUB.map((h, i) => (
          <CircleTile
            key={h.screen}
            icon={<h.Icon className="w-7 h-7" />}
            label={h.label}
            index={i}
            badge={badgeFor(h.screen)}
            onClick={() => setScreen(h.screen)}
          />
        ))}
      </div>

      {/* Lifestyle quick actions */}
      <SectionHeader title="Lifestyle" />
      <PillRow>
        <Pill label="🏖️ Vacation" onClick={() => run(doActivity, 'vacation')} />
        <Pill label="💪 Gym" onClick={() => run(doActivity, 'gym')} />
        <Pill label="🩺 Doctor" onClick={() => run(doActivity, 'doctor')} />
        <Pill label="🧘 Meditate" onClick={() => run(doActivity, 'meditate')} />
        <Pill label="🎉 Party" onClick={() => run(doActivity, 'party')} />
        <Pill label="❤️ Charity" onClick={() => run(doActivity, 'charity')} />
      </PillRow>

      {/* Life log */}
      <SectionHeader title="Life Log" action="News" onAction={() => setScreen('news')} />
      <div className="space-y-2">
        {recentLog.map((entry, i) => (
          <div
            key={i}
            className={`bg-white dark:bg-ink-850 border border-slate-100 dark:border-ink-800 border-l-4 ${LOG_TONE[entry.kind] ?? LOG_TONE.info} rounded-xl px-4 py-2.5`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold text-slate-400">AGE {entry.age}</span>
              {entry.kind === 'milestone' && <IconArrowRight className="w-3 h-3 text-fuchsia-500" />}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">{entry.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
