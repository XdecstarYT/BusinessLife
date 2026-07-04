/** World screen: macro dashboard, countries, diplomacy, commodities. */
import { lazy, Suspense, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { Badge, BarList, Button, Card, LineChart, Modal, SectionHeader, StatBar } from '../components';
import { money, num, pct, signedPct } from '../format';

const TradeNetworkScene = lazy(() => import('../three/TradeNetworkScene').then((m) => ({ default: m.TradeNetworkScene })));
import { CABINET_PORTFOLIOS, type AdvisorSpecialty, type CabinetPortfolio, type Country, type InfrastructureKind, type WorldEvent } from '../../sim/types';
import {
  advisorRecommendation,
  attendSummit,
  cabinetCandidates,
  callReferendum,
  cancelLobbyingFirm,
  cancelThinkTank,
  counterEspionage,
  declareWar,
  dismissAdvisor,
  foundAlliance,
  fundThinkTank,
  fundIntelligenceAgency,
  fundNationalCyberDefense,
  fundUniversityResearch,
  gatherIntelligence,
  hireAdvisor,
  hireLobbyingFirm,
  imposeSanctions,
  investInHealthcare,
  issueGovernmentBonds,
  joinAlliance,
  launchInfrastructureProject,
  leaveAlliance,
  liftSanctions,
  nominateChiefJustice,
  sendForeignAid,
  setBudgetAllocation,
  setEnergyMix,
  setImmigrationQuota,
  setTaxRate,
  signPeaceTreaty,
  signTradeAgreement,
} from '../../sim/actions';
import { economicForecast } from '../../sim/economy';
import { LAW_BY_ID } from '../../data/laws';

const INFRA_KINDS: InfrastructureKind[] = ['roads', 'rail', 'airport', 'power', 'internet', 'space_program', 'bridge', 'tunnel', 'bullet_train', 'stadium', 'dam'];
const ADVISOR_SPECIALTIES: AdvisorSpecialty[] = ['economy', 'military', 'diplomacy'];

const WORLD_EVENT_INFO: Record<WorldEvent['type'], { emoji: string; label: string; desc: string; tone: 'bad' | 'good' }> = {
  pandemic: { emoji: '🦠', label: 'Global Pandemic', desc: 'Tourism, airlines and entertainment are hit hard; health and remote-work industries are up.', tone: 'bad' },
  trade_war: { emoji: '⚔️', label: 'Global Trade War', desc: 'Exporters and shippers are squeezed by tariffs; inflation is running hotter than usual.', tone: 'bad' },
  tech_boom: { emoji: '🚀', label: 'Tech Boom', desc: 'Tech, AI and software stocks are surging; business confidence is elevated worldwide.', tone: 'good' },
  oil_crisis: { emoji: '🛢️', label: 'Global Oil Crisis', desc: 'Energy prices are spiking; inflation is running hot and confidence is shaken worldwide.', tone: 'bad' },
  banking_collapse: { emoji: '🏦', label: 'Banking Collapse', desc: 'A credit crunch is rattling markets and confidence everywhere; rates are climbing.', tone: 'bad' },
  ai_disruption: { emoji: '🤖', label: 'AI Disruption', desc: 'Automation is reshaping labor markets; unemployment is up even as business confidence rises.', tone: 'bad' },
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

      <SectionHeader title="Trade & Transport Network" />
      <Card className="p-3 mb-4">
        <Suspense fallback={<div className="w-full h-52 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />}>
          <TradeNetworkScene
            homeName={home.name}
            routes={state.countries
              .filter((c) => c.id !== home.id)
              .map((c) => ({ name: c.name, relations: home.relations[c.id] ?? 0, atWar: home.atWarWith.includes(c.id) }))}
          />
        </Suspense>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
          Air and shipping traffic scales with diplomatic relations; routes to nations you're at war with are severed.
        </p>
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
        <StatBar label="Climate risk" value={country.climateRisk} />
        <StatBar label="Labor market tightness" value={country.laborMarketTightness} />
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
                <>
                  <Button size="sm" variant="danger" onClick={() => run(declareWar, country.id, 'invasion')}>⚔️ Invade</Button>
                  <Button size="sm" variant="danger" onClick={() => run(declareWar, country.id, 'blockade')}>🚢 Blockade</Button>
                </>
              )}
              {sanctioned ? (
                <Button size="sm" variant="soft" onClick={() => run(liftSanctions, country.id)}>Lift Sanctions</Button>
              ) : (
                <Button size="sm" variant="soft" onClick={() => run(imposeSanctions, country.id)}>🚫 Sanction</Button>
              )}
              <Button size="sm" variant="soft" onClick={() => run(sendForeignAid, country.id)}>🤲 Send Aid (10 PC)</Button>
              <Button size="sm" variant="soft" onClick={() => run(signTradeAgreement, country.id)}>🤝 Trade Deal (10 PC)</Button>
              <Button size="sm" variant="soft" className="col-span-2" onClick={() => run(gatherIntelligence, country.id)}>🕵️ Gather Intelligence</Button>
              {country.allianceId && !home.allianceId && (
                <Button size="sm" variant="soft" className="col-span-2" onClick={() => run(joinAlliance, country.allianceId!)}>
                  🤝 Join {state.alliances.find((a) => a.id === country.allianceId)?.name ?? 'their alliance'}
                </Button>
              )}
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
  const [immigrationDraft, setImmigrationDraft] = useState<number | null>(null);
  const [energyDraft, setEnergyDraft] = useState<number | null>(null);
  const [nominating, setNominating] = useState(false);
  const [referendumPicker, setReferendumPicker] = useState(false);
  const [allianceNamer, setAllianceNamer] = useState(false);
  const [allianceName, setAllianceName] = useState('');
  if (!state) return null;
  const forecast = economicForecast(country.economy);
  const p = state.player;
  const chiefJustice = country.chiefJusticeId ? state.npcs[country.chiefJusticeId] : null;
  const alliance = country.allianceId ? state.alliances.find((a) => a.id === country.allianceId) : null;
  const referendumLaws = Object.values(LAW_BY_ID).filter((l) => !country.lawsInForce.includes(l.id));

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

      <div className="font-bold mb-2 text-sm">Immigration Policy</div>
      <div className="bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2 mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-semibold">Quota (openness)</span>
          <span className="font-bold text-brand-500">{Math.round(immigrationDraft ?? country.immigrationQuota)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={immigrationDraft ?? country.immigrationQuota}
          onChange={(e) => setImmigrationDraft(Number(e.target.value))}
          onMouseUp={() => run(setImmigrationQuota, immigrationDraft ?? country.immigrationQuota)}
          onTouchEnd={() => run(setImmigrationQuota, immigrationDraft ?? country.immigrationQuota)}
          className="w-full"
        />
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Higher openness grows the population and labor supply faster, and softens minimum-wage growth.</div>
      </div>

      <div className="font-bold mb-2 text-sm">Science, Health & Energy</div>
      <Card className="p-3 mb-4 space-y-3">
        <StatBar label="Research level" value={country.researchLevel} />
        <StatBar label="Healthcare" value={country.healthcare} />
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold">Renewable energy share</span>
            <span className="font-bold text-brand-500">{Math.round(energyDraft ?? country.energyRenewableShare)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={energyDraft ?? country.energyRenewableShare}
            onChange={(e) => setEnergyDraft(Number(e.target.value))}
            onMouseUp={() => run(setEnergyMix, energyDraft ?? country.energyRenewableShare)}
            onTouchEnd={() => run(setEnergyMix, energyDraft ?? country.energyRenewableShare)}
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="soft" onClick={() => run(fundUniversityResearch, 100_000)}>🎓 Fund Research ($100k)</Button>
          <Button size="sm" variant="soft" onClick={() => run(investInHealthcare, 100_000)}>🏥 Fund Healthcare ($100k)</Button>
        </div>
      </Card>

      <div className="font-bold mb-2 text-sm">Treasury & National Security</div>
      <Card className="p-3 mb-4 space-y-3">
        <StatBar label="Cyber defense" value={country.cyberDefense} />
        <div className="text-[11px] text-slate-500 dark:text-slate-400">Debt-to-GDP: {Math.round(country.economy.govDebtToGdp * 100)}% · Budget balance: {signedPct(country.economy.budgetBalance)}</div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="soft" onClick={() => run(issueGovernmentBonds, 5)}>🏦 Issue Bonds (5% GDP)</Button>
          <Button size="sm" variant="soft" onClick={() => run(fundNationalCyberDefense, 100_000)}>🖥️ Fund Cyber Defense ($100k)</Button>
        </div>
      </Card>

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
              <span className="capitalize font-semibold">{proj.kind.replace('_', ' ')}</span>
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
            {kind.replace('_', ' ')}
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
      <Card className="p-3 mb-4">
        <StatBar label="Capability" value={country.intelCapability} />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button size="sm" variant="soft" onClick={() => run(fundIntelligenceAgency, 50_000)}>Fund ($50k)</Button>
          <Button size="sm" variant="soft" onClick={() => run(counterEspionage)}>Counter-Espionage ($20k)</Button>
        </div>
      </Card>

      <div className="font-bold mb-2 text-sm">Judiciary</div>
      <Card className="p-3 mb-4">
        <StatBar label="Judicial integrity" value={country.judicialIntegrity} />
        <div className="text-xs text-slate-500 dark:text-slate-400 my-2">
          {chiefJustice ? `Chief Justice: ${chiefJustice.name}` : 'No Chief Justice confirmed.'} Low integrity courts occasionally strike down laws arbitrarily.
        </div>
        <Button size="sm" variant="soft" className="w-full" onClick={() => setNominating(true)}>Nominate Chief Justice</Button>
      </Card>

      <div className="font-bold mb-2 text-sm">Referendum</div>
      <Card className="p-3 mb-4">
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Put a law directly to the public instead of the legislature (15 PC). Odds blend approval with legislative support.
        </div>
        <Button size="sm" variant="soft" className="w-full" onClick={() => setReferendumPicker(true)}>Call Referendum</Button>
      </Card>

      <div className="font-bold mb-2 text-sm">Lobbying Firm</div>
      <Card className="p-3 mb-4 flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">$75k to retain, $25k/yr upkeep. Permanently boosts law-pass odds.</div>
        {p.lobbyingFirmHired ? (
          <Button size="sm" variant="ghost" onClick={() => run(cancelLobbyingFirm)}>Cancel</Button>
        ) : (
          <Button size="sm" variant="soft" onClick={() => run(hireLobbyingFirm)}>Retain</Button>
        )}
      </Card>

      <div className="font-bold mb-2 text-sm">Think Tank</div>
      <Card className="p-3 mb-4 flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">$60k to fund, $15k/yr upkeep. Slowly builds influence, and approval if you lead.</div>
        {p.thinkTankFunded ? (
          <Button size="sm" variant="ghost" onClick={() => run(cancelThinkTank)}>Cancel</Button>
        ) : (
          <Button size="sm" variant="soft" onClick={() => run(fundThinkTank)}>Fund</Button>
        )}
      </Card>

      <div className="font-bold mb-2 text-sm">Alliance</div>
      <Card className="p-3">
        {alliance ? (
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <div className="font-bold">{alliance.name}</div>
              <div className="text-slate-500 dark:text-slate-400">{alliance.memberCountryIds.length} member nation(s)</div>
            </div>
            <Button size="sm" variant="danger" onClick={() => run(leaveAlliance)}>Leave</Button>
          </div>
        ) : (
          <Button size="sm" variant="soft" className="w-full" onClick={() => setAllianceNamer(true)}>Found an Alliance</Button>
        )}
      </Card>

      <div className="font-bold mb-2 text-sm">International Summit</div>
      <Card className="p-3 mb-4 flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">15 PC. Warms relations with every nation you aren't at war with, with a chance of a diplomatic breakthrough.</div>
        <Button size="sm" variant="soft" onClick={() => run(attendSummit)}>Attend</Button>
      </Card>

      {nominating && (
        <Modal open onClose={() => setNominating(false)} title="Nominate Chief Justice">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {cabinetCandidates(state).length === 0 && <p className="text-center text-slate-400 py-6">No eligible nominees right now.</p>}
            {cabinetCandidates(state).map((n) => (
              <button
                key={n.id}
                onClick={() => { run(nominateChiefJustice, n.id); setNominating(false); }}
                className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
              >
                <div className="font-semibold">{n.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Integrity {n.integrity}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {referendumPicker && (
        <Modal open onClose={() => setReferendumPicker(false)} title="Call a Referendum">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {referendumLaws.map((l) => (
              <button
                key={l.id}
                onClick={() => { run(callReferendum, l.id); setReferendumPicker(false); }}
                className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
              >
                <div className="font-semibold">{l.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{l.description}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {allianceNamer && (
        <Modal open onClose={() => setAllianceNamer(false)} title="Found an Alliance">
          <input
            value={allianceName}
            onChange={(e) => setAllianceName(e.target.value)}
            placeholder="Alliance name"
            maxLength={40}
            className="w-full rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-ink-800 border border-transparent focus:border-brand-400 outline-none mb-3"
          />
          <Button
            className="w-full"
            onClick={() => { run(foundAlliance, allianceName); setAllianceNamer(false); setAllianceName(''); }}
          >
            Found Alliance
          </Button>
        </Modal>
      )}
    </div>
  );
}
