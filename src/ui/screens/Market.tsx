/** Stock market: browse listed companies, trade, short, view portfolio. */
import { lazy, Suspense, useMemo, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { buyOnMargin, buyShares, cancelLimitOrder, coverShort, marketCap, peRatio, placeLimitOrder, sellShares, shortShares, portfolioValue, toggleDrip } from '../../sim/market';
import { buyCrypto, sellCrypto } from '../../sim/actions';
import { Badge, Button, Card, LineChart, Modal, Pill, PillRow, SectionHeader } from '../components';
import { money, moneyFull, num, signedPct } from '../format';
import { INDUSTRY_BY_ID } from '../../data/industries';
import type { Company } from '../../sim/types';

const ExchangeFloorScene = lazy(() => import('../three/ExchangeFloorScene').then((m) => ({ default: m.ExchangeFloorScene })));
const FloorFallback = <div className="w-full h-56 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

export function Market() {
  const { state } = useGame();
  const [tab, setTab] = useState<'market' | 'portfolio' | 'crypto'>('market');
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

      <div className="mb-4">
        <Suspense fallback={FloorFallback}>
          <ExchangeFloorScene
            indexValue={home.economy.stockIndex}
            indexChangePct={idxHistory.length >= 2 ? idxHistory[idxHistory.length - 1] / idxHistory[idxHistory.length - 2] - 1 : 0}
            movers={[...listed]
              .sort((a, b) => Math.abs(yearGain(b)) - Math.abs(yearGain(a)))
              .slice(0, 6)
              .map((c) => ({ name: c.name, price: c.sharePrice, gainPct: yearGain(c) }))}
            onSelectMover={(name) => {
              const c = listed.find((x) => x.name === name);
              if (c) setSelected(c.id);
            }}
          />
        </Suspense>
        <div className="text-xs text-slate-400 mt-1">Tap a ticker booth to trade that stock.</div>
      </div>

      <LiveTicker companies={listed} />

      <PillRow>
        <Pill label="Market" active={tab === 'market'} onClick={() => setTab('market')} />
        <Pill label={`Portfolio (${p.portfolio.length})`} active={tab === 'portfolio'} onClick={() => setTab('portfolio')} />
        <Pill label="🪙 Crypto" active={tab === 'crypto'} onClick={() => setTab('crypto')} />
      </PillRow>

      {tab === 'crypto' && <CryptoView />}

      {tab === 'market' && (
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
      )}
      {tab === 'portfolio' && <PortfolioView onSelect={(id) => setSelected(id)} />}

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

/** A scrolling stock ticker strip: top movers, looping continuously. */
function LiveTicker({ companies }: { companies: Company[] }) {
  const movers = [...companies]
    .sort((a, b) => Math.abs(yearGain(b)) - Math.abs(yearGain(a)))
    .slice(0, 14);
  if (movers.length === 0) return null;
  const strip = (key: string) => (
    <div key={key} className="flex items-center gap-5 shrink-0 pr-5">
      {movers.map((c) => {
        const gain = yearGain(c);
        return (
          <span key={`${key}-${c.id}`} className="text-xs font-semibold whitespace-nowrap">
            <span className="text-slate-600 dark:text-slate-300">{c.name}</span>{' '}
            <span className={gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
              {money(c.sharePrice)} {gain >= 0 ? '▲' : '▼'} {Math.abs(gain * 100).toFixed(1)}%
            </span>
          </span>
        );
      })}
    </div>
  );
  return (
    <div className="mb-4 overflow-hidden rounded-xl bg-slate-100 dark:bg-ink-800 py-2">
      <style>{`
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-track { animation: ticker-scroll 30s linear infinite; }
      `}</style>
      <div className="flex ticker-track w-max">
        {strip('a')}
        {strip('b')}
      </div>
    </div>
  );
}

function StockRow({ c, onClick }: { c: Company; onClick: () => void }) {
  const gain = yearGain(c);
  const ind = INDUSTRY_BY_ID[c.industryId];
  return (
    <Card className="p-3 flex items-center gap-3" onClick={onClick}>
      <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-black text-sm shrink-0">
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
  const { state, trade } = useGame();
  if (!state) return null;
  const p = state.player;
  const value = portfolioValue(state);
  const dripToggle = (
    <Card className="p-4 mb-3 flex items-center justify-between">
      <div>
        <div className="font-semibold text-sm">Dividend Reinvestment (DRIP)</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Auto-buy more shares with dividends instead of taking cash.</div>
      </div>
      <Button size="sm" variant={p.drip ? 'primary' : 'soft'} onClick={() => trade(toggleDrip)}>{p.drip ? 'On' : 'Off'}</Button>
    </Card>
  );
  if (p.portfolio.length === 0) {
    return (
      <div className="mt-4">
        {dripToggle}
        <Card className="p-6 text-center text-slate-500 dark:text-slate-400">No holdings yet. Buy shares from the Market tab.</Card>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <Card className="p-4 mb-3 text-center">
        <div className="text-xs text-slate-400">Portfolio Value</div>
        <div className="text-2xl font-black text-emerald-500">{money(value)}</div>
        {p.marginDebt > 0 && <div className="text-xs text-rose-500 font-semibold mt-1">Margin debt: {money(p.marginDebt)}</div>}
      </Card>
      {dripToggle}
      <div className="space-y-2">
        {p.portfolio.map((h) => {
          const c = state.companies[h.companyId];
          if (!c) return null;
          const isShort = h.shares < 0;
          const mv = c.sharePrice * Math.abs(h.shares);
          const pl = isShort ? (h.costBasis - c.sharePrice) * -h.shares : (c.sharePrice - h.costBasis) * h.shares;
          return (
            <Card key={h.companyId} className="p-3 flex items-center justify-between gap-2" onClick={() => onSelect(h.companyId)}>
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-2 min-w-0">
                  <span className="truncate" title={c.name}>{c.name}</span>
                  {isShort && <Badge tone="warn">SHORT</Badge>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
  const [limitPrice, setLimitPrice] = useState(0);
  const [limitAmount, setLimitAmount] = useState(0);
  if (!state) return null;
  const c = state.companies[companyId];
  if (!c) return null;
  const p = state.player;
  const ind = INDUSTRY_BY_ID[c.industryId];
  const pe = peRatio(c);
  const holding = p.portfolio.find((h) => h.companyId === companyId);
  const gain = yearGain(c);
  const myOrders = p.limitOrders.filter((o) => o.companyId === companyId);

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
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" onClick={() => trade(buyShares, companyId, spend)}>Buy</Button>
        <Button size="sm" variant="soft" onClick={() => trade(shortShares, companyId, spend)}>Short</Button>
        <Button size="sm" variant="soft" onClick={() => trade(buyOnMargin, companyId, spend)}>Margin Buy</Button>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Place a limit order</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            placeholder="Target price"
            value={limitPrice || ''}
            onChange={(e) => setLimitPrice(Number(e.target.value))}
            className="rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-ink-800 border border-transparent focus:border-brand-400 outline-none"
          />
          <input
            type="number"
            placeholder="Amount ($)"
            value={limitAmount || ''}
            onChange={(e) => setLimitAmount(Number(e.target.value))}
            className="rounded-xl px-3 py-2 text-sm bg-slate-100 dark:bg-ink-800 border border-transparent focus:border-brand-400 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="soft" onClick={() => trade(placeLimitOrder, companyId, 'buy', limitPrice, limitAmount)}>
            Buy if ≤ price
          </Button>
          <Button size="sm" variant="soft" onClick={() => trade(placeLimitOrder, companyId, 'sell', limitPrice, limitAmount)}>
            Sell if ≥ price
          </Button>
        </div>
        {myOrders.length > 0 && (
          <div className="mt-2 space-y-1">
            {myOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-xs bg-slate-100 dark:bg-ink-800 rounded-lg px-2 py-1.5">
                <span>{o.kind === 'buy' ? 'Buy' : 'Sell'} @ {money(o.targetPrice)} · {money(o.amount)}</span>
                <button className="text-rose-500 font-semibold" onClick={() => trade(cancelLimitOrder, o.id)}>Cancel</button>
              </div>
            ))}
          </div>
        )}
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

function CryptoView() {
  const { state, run } = useGame();
  const [amount, setAmount] = useState(1_000);
  if (!state) return null;
  const p = state.player;
  const holdingsValue = p.cryptoUnits * state.cryptoPrice;
  const hist = state.cryptoHistory.length ? state.cryptoHistory : [state.cryptoPrice];
  const yearMove = hist.length >= 2 ? hist[hist.length - 1] / hist[hist.length - 2] - 1 : 0;

  return (
    <div className="mt-4 space-y-3">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">🪙 NovaCoin</span>
          <div className="text-right">
            <div className="font-extrabold">{money(state.cryptoPrice)}</div>
            <div className={`text-xs font-semibold ${yearMove >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{signedPct(yearMove, 1)} /yr</div>
          </div>
        </div>
        <div className="h-16">
          <LineChart data={hist} height={64} color="#f59e0b" />
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Extremely volatile — swings of ±35-45% a year are normal, amplified by tech booms and banking crises.</p>
      </Card>

      <Card className="p-4">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-slate-500 dark:text-slate-400">Your holdings</span>
          <span className="font-bold">{p.cryptoUnits.toFixed(4)} units · {money(holdingsValue)}</span>
        </div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Amount: {moneyFull(amount)}</label>
        <input
          type="range"
          min={100}
          max={Math.max(100, Math.round(Math.max(p.money, holdingsValue)))}
          step={100}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full mt-1 mb-3"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={() => run(buyCrypto, amount)}>Buy</Button>
          <Button variant="soft" onClick={() => run(sellCrypto, Math.min(p.cryptoUnits, amount / state.cryptoPrice))}>Sell</Button>
        </div>
      </Card>
    </div>
  );
}
