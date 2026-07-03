/** Stock market: browse listed companies, trade, short, view portfolio. */
import { useMemo, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { buyShares, coverShort, marketCap, peRatio, sellShares, shortShares, portfolioValue } from '../../sim/market';
import { Badge, Button, Card, LineChart, Modal, Pill, PillRow, SectionHeader } from '../components';
import { money, moneyFull, num, signedPct } from '../format';
import { INDUSTRY_BY_ID } from '../../data/industries';
import type { Company } from '../../sim/types';

export function Market() {
  const { state } = useGame();
  const [tab, setTab] = useState<'market' | 'portfolio'>('market');
  const [sector, setSector] = useState('all');
  const [sort, setSort] = useState<'cap' | 'gain' | 'pe'>('cap');
  const [selected, setSelected] = useState<string | null>(null);
  if (!state) return null;
  const p = state.player;

  const listed = useMemo(
    () => Object.values(state.companies).filter((c) => c.isPublic && c.status === 'active' && c.countryId === p.countryId),
    [state.companies, p.countryId],
  );
  const sectors = ['all', ...new Set(listed.map((c) => INDUSTRY_BY_ID[c.industryId]?.sector).filter(Boolean))] as string[];
  const filtered = listed
    .filter((c) => (sector === 'all' ? true : INDUSTRY_BY_ID[c.industryId]?.sector === sector))
    .sort((a, b) => {
      if (sort === 'cap') return marketCap(b) - marketCap(a);
      if (sort === 'gain') return yearGain(b) - yearGain(a);
      return (peRatio(a) ?? 999) - (peRatio(b) ?? 999);
    });

  const home = state.countries.find((c) => c.id === p.countryId)!;
  const idxHistory = home.economy.history.map((h) => h.stockIndex);

  return (
    <div>
      <SectionHeader title="Stock Market" />

      <Card className="p-4 mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{home.name} Index</span>
          <span className="font-extrabold">{num(home.economy.stockIndex)}</span>
        </div>
        <div className="h-16">
          <LineChart data={idxHistory.length ? idxHistory : [100]} height={64} color="#8b5cf6" />
        </div>
      </Card>

      <PillRow>
        <Pill label="Market" active={tab === 'market'} onClick={() => setTab('market')} />
        <Pill label={`Portfolio (${p.portfolio.length})`} active={tab === 'portfolio'} onClick={() => setTab('portfolio')} />
      </PillRow>

      {tab === 'market' ? (
        <>
          <PillRow>
            {sectors.map((s) => (
              <Pill key={s} label={s === 'all' ? 'All Sectors' : s} active={sector === s} onClick={() => setSector(s)} />
            ))}
          </PillRow>
          <div className="flex gap-2 mt-2 mb-3 text-xs">
            <span className="text-slate-400 self-center">Sort:</span>
            <Pill label="Market cap" active={sort === 'cap'} onClick={() => setSort('cap')} />
            <Pill label="1yr gain" active={sort === 'gain'} onClick={() => setSort('gain')} />
            <Pill label="P/E" active={sort === 'pe'} onClick={() => setSort('pe')} />
          </div>
          <div className="space-y-2">
            {filtered.map((c) => (
              <StockRow key={c.id} c={c} onClick={() => setSelected(c.id)} />
            ))}
          </div>
        </>
      ) : (
        <PortfolioView onSelect={(id) => setSelected(id)} />
      )}

      {selected && <TradeModal companyId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function yearGain(c: Company): number {
  const h = c.history;
  if (h.length < 2) return 0;
  const a = h[h.length - 2].sharePrice;
  const b = h[h.length - 1].sharePrice;
  return a && b ? b / a - 1 : 0;
}

function StockRow({ c, onClick }: { c: Company; onClick: () => void }) {
  const gain = yearGain(c);
  const ind = INDUSTRY_BY_ID[c.industryId];
  return (
    <Card className="p-3 flex items-center gap-3" onClick={onClick}>
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white font-black text-sm shrink-0">
        {c.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold truncate">{c.name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{ind?.name} · cap {money(marketCap(c))}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-bold">{money(c.sharePrice)}</div>
        <div className={`text-xs font-semibold ${gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{signedPct(gain, 1)}</div>
      </div>
    </Card>
  );
}

function PortfolioView({ onSelect }: { onSelect: (id: string) => void }) {
  const { state } = useGame();
  if (!state) return null;
  const p = state.player;
  if (p.portfolio.length === 0) {
    return <Card className="p-6 mt-4 text-center text-slate-500 dark:text-slate-400">No holdings yet. Buy shares from the Market tab.</Card>;
  }
  const value = portfolioValue(state);
  return (
    <div className="mt-4">
      <Card className="p-4 mb-3 text-center">
        <div className="text-xs text-slate-400">Portfolio Value</div>
        <div className="text-2xl font-black text-emerald-500">{money(value)}</div>
      </Card>
      <div className="space-y-2">
        {p.portfolio.map((h) => {
          const c = state.companies[h.companyId];
          if (!c) return null;
          const isShort = h.shares < 0;
          const mv = c.sharePrice * Math.abs(h.shares);
          const pl = isShort ? (h.costBasis - c.sharePrice) * -h.shares : (c.sharePrice - h.costBasis) * h.shares;
          return (
            <Card key={h.companyId} className="p-3 flex items-center justify-between" onClick={() => onSelect(h.companyId)}>
              <div className="min-w-0">
                <div className="font-bold truncate flex items-center gap-2">
                  {c.name} {isShort && <Badge tone="warn">SHORT</Badge>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {num(Math.abs(h.shares))} sh @ {money(h.costBasis)} → {money(c.sharePrice)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-sm">{money(mv)}</div>
                <div className={`text-xs font-semibold ${pl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {pl >= 0 ? '+' : ''}{money(pl)}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TradeModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { state, trade } = useGame();
  const [spend, setSpend] = useState(0);
  if (!state) return null;
  const c = state.companies[companyId];
  if (!c) return null;
  const p = state.player;
  const ind = INDUSTRY_BY_ID[c.industryId];
  const pe = peRatio(c);
  const holding = p.portfolio.find((h) => h.companyId === companyId);
  const gain = yearGain(c);

  return (
    <Modal open onClose={onClose} title={c.name}>
      <div className="flex items-center gap-2 mb-3">
        <Badge tone="brand">{ind?.name}</Badge>
        <Badge>{c.foundedYear}</Badge>
        {c.shortInterest > 0.2 && <Badge tone="warn">High short interest</Badge>}
      </div>
      <div className="h-24 mb-3">
        <LineChart data={c.history.map((h) => h.sharePrice ?? 0)} height={96} color={gain >= 0 ? '#10b981' : '#f43f5e'} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <Stat label="Price" value={money(c.sharePrice)} />
        <Stat label="1yr" value={signedPct(gain)} tone={gain >= 0 ? 'good' : 'bad'} />
        <Stat label="Market cap" value={money(marketCap(c))} />
        <Stat label="P/E" value={pe ? pe.toFixed(1) : '—'} />
        <Stat label="Revenue" value={money(c.revenue)} />
        <Stat label="Profit" value={money(c.profit)} tone={c.profit >= 0 ? 'good' : 'bad'} />
        <Stat label="Dividend" value={c.dividendPayoutPct > 0 ? `${Math.round(c.dividendPayoutPct * 100)}%` : 'None'} />
        <Stat label="Inst. own" value={`${Math.round(c.institutionalOwnPct * 100)}%`} />
      </div>

      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Amount: {moneyFull(spend)}</label>
      <input type="range" min={0} max={Math.round(p.money)} value={spend} onChange={(e) => setSpend(Number(e.target.value))} className="w-full mt-1 mb-2" />
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => trade(buyShares, companyId, spend)}>Buy</Button>
        <Button size="sm" variant="soft" onClick={() => trade(shortShares, companyId, spend)}>Short</Button>
      </div>

      {holding && holding.shares > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Sell position</div>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="danger" onClick={() => trade(sellShares, companyId, 0.5)}>Sell ½</Button>
            <Button size="sm" variant="danger" onClick={() => trade(sellShares, companyId, 1)}>Sell All</Button>
            <div className="text-xs self-center text-slate-400">{num(holding.shares)} sh</div>
          </div>
        </div>
      )}
      {holding && holding.shares < 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Cover short ({num(-holding.shares)} sh)</div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => trade(coverShort, companyId, 0.5)}>Cover ½</Button>
            <Button size="sm" onClick={() => trade(coverShort, companyId, 1)}>Cover All</Button>
          </div>
        </div>
      )}
    </Modal>
  );

  function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
    return (
      <div className="flex justify-between bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`font-bold ${tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-rose-500' : ''}`}>{value}</span>
      </div>
    );
  }
}
