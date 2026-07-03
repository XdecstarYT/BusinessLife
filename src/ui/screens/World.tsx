/** World screen: macro dashboard, countries, diplomacy, commodities. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { Badge, BarList, Button, Card, LineChart, Modal, SectionHeader, StatBar } from '../components';
import { money, num, pct, signedPct } from '../format';
import { CABINET_PORTFOLIOS, type AdvisorSpecialty, type CabinetPortfolio, type Country, type InfrastructureKind, type WorldEvent } from '../../sim/types';
import {
  advisorRecommendation,
  counterEspionage,
  declareWar,
  dismissAdvisor,
  fundIntelligenceAgency,
  gatherIntelligence,
  hireAdvisor,
  imposeSanctions,
  launchInfrastructureProject,
  liftSanctions,
  sendForeignAid,
  setBudgetAllocation,
  setTaxRate,
  signPeaceTreaty,
  signTradeAgreement,
} from '../../sim/actions';
import { economicForecast } from '../../sim/economy';

const INFRA_KINDS: InfrastructureKind[] = ['roads', 'rail', 'airport', 'power', 'internet'];
const ADVISOR_SPECIALTIES: AdvisorSpecialty[] = ['economy', 'military', 'diplomacy'];

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
  const { state, run } = useGame();
  if (!state) return null;
  const leader = country.leaderId === 'player' ? state.player.name : country.leaderId ? state.npcs[country.leaderId]?.name : 'Vacant';
  const home = state.countries.find((c) => c.id === state.player.countryId)!;
  const isForeign = country.id !== home.id;
  const isLeader = home.leaderId === 'player';
  const relation = home.relations[country.id] ?? 0;
  const atWar = home.atWarWith.includes(country.id);
  const sanctioned = home.sanctionsOn.includes(country.id);
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

      {isForeign && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">Diplomacy</span>
            <Badge tone={relation > 20 ? 'good' : relation < -20 ? 'bad' : 'neutral'}>Relations {Math.round(relation)}</Badge>
          </div>
          {atWar && <Badge tone="bad">⚔️ At War</Badge>}
          {sanctioned && <Badge tone="warn">🚫 Sanctioned</Badge>}
          {!isLeader ? (
            <p className="text-xs text-slate-400 mt-2">Become head of state of {home.name} to conduct foreign policy.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {atWar ? (
                <Button size="sm" onClick={() => run(signPeaceTreaty, country.id)} className="col-span-2">🕊️ Sign Peace Treaty</Button>
              ) : (
                <Button size="sm" variant="danger" onClick={() => run(declareWar, country.id)}>⚔️ Declare War</Button>
              )}
              {sanctioned ? (
                <Button size="sm" variant="soft" onClick={() => run(liftSanctions, country.id)}>Lift Sanctions</Button>
              ) : (
                <Button size="sm" variant="soft" onClick={() => run(imposeSanctions, country.id)}>🚫 Sanction</Button>
              )}
              <Button size="sm" variant="soft" onClick={() => run(sendForeignAid, country.id)}>🤲 Send Aid (10 PC)</Button>
              <Button size="sm" variant="soft" onClick={() => run(signTradeAgreement, country.id)}>🤝 Trade Deal (10 PC)</Button>
              <Button size="sm" variant="soft" className="col-span-2" onClick={() => run(gatherIntelligence, country.id)}>🕵️ Gather Intelligence</Button>
            </div>
          )}
        </div>
      )}

      {!isForeign && isLeader && <GovernmentTools country={country} />}
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

function GovernmentTools({ country }: { country: Country }) {
  const { state, run } = useGame();
  const [taxDraft, setTaxDraft] = useState<Record<string, number>>({});
  if (!state) return null;
  const forecast = economicForecast(country.economy);
  const p = state.player;

  return (
    <div className="mt-5">
      <SectionHeader title="Government & Economy" />

      <div className="font-bold mb-2 text-sm">Budget Allocation</div>
      <BarList
        items={CABINET_PORTFOLIOS.map((portfolio) => ({
          label: portfolio,
          value: Math.round(country.budgetAllocations[portfolio]),
          color: '#337dff',
        }))}
      />
      <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
        {CABINET_PORTFOLIOS.map((portfolio) => (
          <div key={portfolio} className="flex items-center justify-between bg-slate-100 dark:bg-ink-800 rounded-xl px-2 py-1.5">
            <span className="text-[10px] font-semibold truncate">{portfolio}</span>
            <div className="flex gap-1">
              <button
                className="w-5 h-5 rounded-full bg-slate-200 dark:bg-ink-700 text-xs font-bold"
                onClick={() => run(setBudgetAllocation, portfolio as CabinetPortfolio, country.budgetAllocations[portfolio] - 3)}
              >
                -
              </button>
              <button
                className="w-5 h-5 rounded-full bg-slate-200 dark:bg-ink-700 text-xs font-bold"
                onClick={() => run(setBudgetAllocation, portfolio as CabinetPortfolio, country.budgetAllocations[portfolio] + 3)}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="font-bold mb-2 text-sm">Direct Tax Rates</div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(['income', 'corporate', 'sales', 'capitalGains'] as const).map((tax) => {
          const current = Math.round(country.economy.taxRates[tax] * 100);
          const draft = taxDraft[tax] ?? current;
          return (
            <div key={tax} className="bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="capitalize font-semibold">{tax}</span>
                <span className="font-bold text-brand-500">{draft}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={70}
                value={draft}
                onChange={(e) => setTaxDraft((d) => ({ ...d, [tax]: Number(e.target.value) }))}
                onMouseUp={() => run(setTaxRate, tax, taxDraft[tax] ?? current)}
                onTouchEnd={() => run(setTaxRate, tax, taxDraft[tax] ?? current)}
                className="w-full"
              />
            </div>
          );
        })}
      </div>

      <div className="font-bold mb-2 text-sm">Economic Forecast (next year)</div>
      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
        <div className="bg-slate-100 dark:bg-ink-800 rounded-xl px-2 py-2">
          <div className="text-[10px] text-slate-400">Growth</div>
          <div className="font-bold">{signedPct(forecast.gdpGrowth)}</div>
        </div>
        <div className="bg-slate-100 dark:bg-ink-800 rounded-xl px-2 py-2">
          <div className="text-[10px] text-slate-400">Inflation</div>
          <div className="font-bold">{pct(forecast.inflation, 1)}</div>
        </div>
        <div className="bg-slate-100 dark:bg-ink-800 rounded-xl px-2 py-2">
          <div className="text-[10px] text-slate-400">Unemployment</div>
          <div className="font-bold">{pct(forecast.unemployment, 1)}</div>
        </div>
      </div>

      <div className="font-bold mb-2 text-sm">Infrastructure Projects</div>
      {country.infrastructureProjects.length > 0 && (
        <div className="space-y-1 mb-2">
          {country.infrastructureProjects.map((proj) => (
            <div key={proj.id} className="flex justify-between text-xs bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2">
              <span className="capitalize font-semibold">{proj.kind}</span>
              <span className="text-slate-500 dark:text-slate-400">{proj.yearsLeft}yr left</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {INFRA_KINDS.map((kind) => (
          <Button
            key={kind}
            size="sm"
            variant="soft"
            disabled={country.infrastructureProjects.some((pr) => pr.kind === kind)}
            onClick={() => run(launchInfrastructureProject, kind)}
          >
            {kind}
          </Button>
        ))}
      </div>

      <div className="font-bold mb-2 text-sm">AI Advisors</div>
      <div className="space-y-2 mb-4">
        {ADVISOR_SPECIALTIES.map((spec) => {
          const advisor = p.advisors.find((a) => a.specialty === spec);
          return (
            <div key={spec} className="bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2">
              <div className="flex justify-between items-center">
                <span className="capitalize font-semibold text-sm">{spec} Advisor</span>
                {advisor ? (
                  <Button size="sm" variant="ghost" onClick={() => run(dismissAdvisor, spec)}>Dismiss</Button>
                ) : (
                  <Button size="sm" variant="soft" onClick={() => run(hireAdvisor, spec)}>Hire ($50k)</Button>
                )}
              </div>
              {advisor && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{advisorRecommendation(state, advisor)}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="font-bold mb-2 text-sm">Intelligence Agency</div>
      <Card className="p-3">
        <StatBar label="Capability" value={country.intelCapability} />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button size="sm" variant="soft" onClick={() => run(fundIntelligenceAgency, 50_000)}>Fund ($50k)</Button>
          <Button size="sm" variant="soft" onClick={() => run(counterEspionage)}>Counter-Espionage ($20k)</Button>
        </div>
      </Card>
    </div>
  );
}
