/** News feed: dynamically generated headlines, filterable by category. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { Card, Pill, PillRow, SectionHeader } from '../components';
import type { NewsItem } from '../../sim/types';

const CATS: { key: NewsItem['category'] | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'economy', label: 'Economy' },
  { key: 'markets', label: 'Markets' },
  { key: 'business', label: 'Business' },
  { key: 'politics', label: 'Politics' },
  { key: 'world', label: 'World' },
  { key: 'society', label: 'Society' },
];

const CAT_EMOJI: Record<string, string> = {
  economy: '📊', markets: '📈', business: '🏢', politics: '🏛️', world: '🌍', society: '👥', player: '⭐',
};

export function News() {
  const { state } = useGame();
  const [cat, setCat] = useState<NewsItem['category'] | 'all'>('all');
  if (!state) return null;
  const items = [...state.news].reverse().filter((n) => cat === 'all' || n.category === cat);

  return (
    <div>
      <SectionHeader title="The Wire" />
      <PillRow>
        {CATS.map((c) => (
          <Pill key={c.key} label={c.label} active={cat === c.key} onClick={() => setCat(c.key)} />
        ))}
      </PillRow>
      <div className="mt-3 space-y-2">
        {items.length === 0 && <Card className="p-6 text-center text-slate-500 dark:text-slate-400">No headlines yet. Advance a year to see the world react.</Card>}
        {items.map((n, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{CAT_EMOJI[n.category] ?? '📰'}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">{n.outlet} · {n.year}</span>
              {n.sentiment > 0.4 && <span className="text-xs text-emerald-500">▲</span>}
              {n.sentiment < -0.4 && <span className="text-xs text-rose-500">▼</span>}
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{n.headline}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
