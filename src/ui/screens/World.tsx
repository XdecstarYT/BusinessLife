/** World screen: macro dashboard, countries, diplomacy, commodities. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { Badge, BarList, Card, LineChart, Modal, SectionHeader, StatBar } from '../components';
import { money, num, pct, signedPct } from '../format';
import type { Country, WorldEvent } from '../../sim/types';

const WORLD_EVENT_INFO: Record<WorldEvent['type'], { emoji: string; label: string; desc: string; tone: 'bad' | 'good' }> = {
  pandemic: { emoji: '🦠', label: 'Global Pandemic', desc: 'Tourism, airlines and entertainment are hit hard; health and remote-work industries are up.', tone: 'bad' },
  trade_war: { emoji: '⚔️', label: 'Global Trade War', desc: 'Exporters and shippers are squeezed by tariffs; inflation is running hotter than usual.', tone: 'bad' },
  tech_boom: { emoji: '🚀', label: 'Tech Boom', desc: 'Tech, AI and software stocks are surging; business confidence is elevated worldwide.', tone: 'good' },
};

function WorldEventBanner({ event }: { event: WorldEvent }) {
  const info = WORLD_EVENT_INFO[event.type];
  return (
    <Card className={`p-4 mb-4 border-2 ${info.tone === 'bad' ? 'border-rose-400' : 'border-emerald-400'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{info.emoji}</span>
        <span className="font-extrabold">{info.label}</span>
        <Badge tone={info.tone}>{event.yearsLeft} yr left</Badge>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{info.desc}</p>
    </Card>
  );
}

export function World() {
  const { state } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  if (!state) return null;
  const home = state.countries.find((c) => c.id === state.player.countryId)!;
  const e = home.economy;

  return (
    <div>
      {state.worldEvent && <WorldEventBanner event={state.worldEvent} />}
      <SectionHeader title={`${home.flag} ${home.name} Economy`} />
      <div className="grid grid-cols-2 gap-3">
        <Metric label="GDP" value={money(e.gdp * 1e9, home.currencySymbol)} />
        <Metric label="Growth" value={signedPct(e.gdpGrowth)} tone={e.gdpGrowth >= 0 ? 'good' : 'bad'} />
        <Metric label="Inflation" value={pct(e.inflation)} tone={e.inflation > 0.05 ? 'bad' : undefined} />
        <Metric label="Interest Rate" value={pct(e.interestRate)} />
        <Metric label="Unemployment" value={pct(e.unemployment)} tone={e.unemployment > 0.08 ? 'bad' : undefined} />
        <Metric label="Regime" value={e.regime} cap />
      </div>

      <Card className="p-4 mt-4">
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">GDP History</div>
        <div className="h-20">
          <LineChart data={e.history.map((h) => h.gdp)} height={80} color="#10b981" showAxis format={(v) => money(v * 1e9)} />
        </div>
      </Card>

      <SectionHeader title="Commodities" />
      <Card className="p-4">
        <BarList
          items={Object.entries(e.commodities).map(([k, v]) => ({ label: k.toUpperCase(), value: v, color: '#f59e0b' }))}
          format={(v) => num(v)}
        />
      </Card>

      <SectionHeader title="Nations" />
      <div className="space-y-2">
        {[...state.countries].sort((a, b) => b.economy.gdp - a.economy.gdp).map((c) => (
          <Card key={c.id} className="p-3 flex items-center gap-3" onClick={() => setSelected(c.id)}>
            <span className="text-2xl shrink-0">{c.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold flex items-center gap-2 min-w-0">
                <span className="truncate" title={c.name}>{c.name}</span>
                {c.isPlayerHome && <Badge tone="brand">Home</Badge>}
                {c.atWarWith.length > 0 && <Badge tone="bad">⚔️ War</Badge>}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {num(c.population / 1e6)}M people · {money(c.economy.gdp * 1e9)} GDP · {c.system}
              </div>
            </div>
            <div className={`text-sm font-bold shrink-0 ${c.economy.gdpGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {signedPct(c.economy.gdpGrowth)}
            </div>
          </Card>
        ))}
      </div>

      {selected && <CountryModal country={state.countries.find((c) => c.id === selected)!} onClose={() => setSelected(null)} />}
    </div>
  );

  function Metric({ label, value, tone, cap }: { label: string; value: string; tone?: 'good' | 'bad'; cap?: boolean }) {
    return (
      <Card className="p-3">
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className={`font-extrabold ${cap ? 'capitalize' : ''} ${tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-rose-500' : ''}`}>{value}</div>
      </Card>
    );
  }
}

function CountryModal({ country, onClose }: { country: Country; onClose: () => void }) {
  const { state } = useGame();
  if (!state) return null;
  const leader = country.leaderId === 'player' ? state.player.name : country.leaderId ? state.npcs[country.leaderId]?.name : 'Vacant';
  return (
    <Modal open onClose={onClose} title={`${country.flag} ${country.name}`}>
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge tone="brand">{country.system}</Badge>
        <Badge>{country.leaderTitle}: {leader}</Badge>
        {country.resources.slice(0, 4).map((r) => <Badge key={r}>{r.replace('commodity_', '')}</Badge>)}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <Row label="Population" value={`${num(country.population / 1e6)}M`} />
        <Row label="GDP" value={money(country.economy.gdp * 1e9)} />
        <Row label="Growth" value={signedPct(country.economy.gdpGrowth)} />
        <Row label="Military" value={`${Math.round(country.militaryPower)}/100`} />
      </div>
      <div className="space-y-3 mb-4">
        <StatBar label="Stability" value={country.stability} />
        <StatBar label="Corruption" value={country.corruption} />
        <StatBar label="Healthcare" value={country.healthcare} />
        <StatBar label="Education" value={country.education} />
        <StatBar label="Infrastructure" value={country.infrastructure} />
      </div>
      {country.totalSeats > 0 && (
        <>
          <div className="font-bold mb-2">Legislature</div>
          <BarList
            items={[...country.parties].sort((a, b) => b.seats - a.seats).map((p) => ({
              label: p.name + (p.leaderId === 'player' ? ' (you)' : ''),
              value: p.seats,
              color: p.ideology < -20 ? '#ef4444' : p.ideology > 20 ? '#3b82f6' : '#a855f7',
            }))}
          />
        </>
      )}
      {country.lawsInForce.length > 0 && (
        <div className="mt-4">
          <div className="font-bold mb-2">Laws in force ({country.lawsInForce.length})</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{country.lawsInForce.length} statutes shaping this economy.</div>
        </div>
      )}
    </Modal>
  );

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
    );
  }
}
