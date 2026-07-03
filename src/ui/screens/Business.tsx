/** Business screen: found companies, manage strategy levers, IPO, sell. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  investInCompany,
  sellCompany,
  setCompanyLever,
  startCompany,
  takeCompanyPublic,
  withdrawFromCompany,
  type CompanyLever,
} from '../../sim/actions';
import { companyValuation } from '../../sim/business';
import { Badge, Button, Card, LineChart, Modal, Pill, PillRow, SectionHeader, StatBar, TextInput } from '../components';
import { money, moneyFull, pct } from '../format';
import { INDUSTRIES, INDUSTRY_BY_ID } from '../../data/industries';
import type { Company } from '../../sim/types';

export function Business() {
  const { state } = useGame();
  const [founding, setFounding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  if (!state) return null;
  const p = state.player;
  const companies = p.companies.map((id) => state.companies[id]).filter((c): c is Company => !!c && c.status === 'active');
  const totalRevenue = companies.reduce((s, c) => s + c.revenue, 0);
  const totalProfit = companies.reduce((s, c) => s + c.profit, 0);

  return (
    <div>
      <SectionHeader title="Business Empire" action="Found" onAction={() => setFounding(true)} />

      {companies.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniStat label="Companies" value={String(companies.length)} />
          <MiniStat label="Revenue" value={money(totalRevenue)} />
          <MiniStat label="Profit" value={money(totalProfit)} tone={totalProfit >= 0 ? 'good' : 'bad'} />
        </div>
      )}

      {companies.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="text-4xl mb-2">🏢</div>
          <p className="text-slate-500 dark:text-slate-400 mb-4">You don't own any companies yet. Found one to start building your empire — 200+ industries await.</p>
          <Button onClick={() => setFounding(true)}>Found a Company</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {companies.map((c) => {
            const ind = INDUSTRY_BY_ID[c.industryId];
            const revHist = c.history.map((h) => h.revenue);
            return (
              <Card key={c.id} className="p-4" onClick={() => setSelected(c.id)}>
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0">
                    <div className="font-extrabold truncate">{c.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{ind?.name} · {ind?.sector}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.isPublic ? <Badge tone="brand">Public</Badge> : <Badge>Private</Badge>}
                  </div>
                </div>
                <div className="h-14 -mx-1">
                  <LineChart data={revHist.length ? revHist : [c.revenue]} height={56} color={c.profit >= 0 ? '#10b981' : '#f43f5e'} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div>
                    <div className="text-[11px] text-slate-400">Revenue</div>
                    <div className="font-bold text-sm">{money(c.revenue)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Profit</div>
                    <div className={`font-bold text-sm ${c.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{money(c.profit)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Value</div>
                    <div className="font-bold text-sm">{money(c.isPublic ? c.sharePrice * c.sharesOutstanding * c.playerSharePct : companyValuation(c) * c.playerSharePct)}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <FoundModal open={founding} onClose={() => setFounding(false)} />
      {selected && <ManageModal companyId={selected} onClose={() => setSelected(null)} />}
    </div>
  );

  function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
    return (
      <Card className="p-3 text-center">
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className={`font-extrabold ${tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-rose-500' : ''}`}>{value}</div>
      </Card>
    );
  }
}

function FoundModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, run } = useGame();
  const [sector, setSector] = useState<string>('all');
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [funding, setFunding] = useState(0);
  if (!state) return null;
  const p = state.player;
  const sectors = ['all', ...new Set(INDUSTRIES.map((i) => i.sector))];
  const list = INDUSTRIES.filter((i) => (sector === 'all' ? true : i.sector === sector) && i.startupCost * 0.5 <= p.money);
  const ind = industryId ? INDUSTRY_BY_ID[industryId] : null;

  const pick = (id: string) => {
    setIndustryId(id);
    const i = INDUSTRY_BY_ID[id];
    setFunding(Math.min(p.money, Math.round(i.startupCost)));
  };

  return (
    <Modal open={open} onClose={onClose} title="Found a Company">
      {!ind ? (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Choose an industry you can afford (you have {money(p.money)}).</p>
          <PillRow>
            {sectors.map((s) => (
              <Pill key={s} label={s === 'all' ? 'All' : s} active={sector === s} onClick={() => setSector(s)} />
            ))}
          </PillRow>
          <div className="mt-3 space-y-2 max-h-[50vh] overflow-y-auto">
            {list.length === 0 && <p className="text-center text-slate-400 py-6">No affordable industries in this sector.</p>}
            {list.map((i) => (
              <button
                key={i.id}
                onClick={() => pick(i.id)}
                className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">{i.name}</span>
                  <span className="text-sm font-bold text-brand-500">{money(i.startupCost)}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {i.sector} · margin {pct(i.baseMargin, 0)} · {i.tags.slice(0, 3).join(', ')}
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setIndustryId(null)} className="text-sm text-brand-500 font-semibold mb-3">← Change industry</button>
          <div className="font-extrabold text-lg">{ind.name}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">{ind.sector} sector · typical margin {pct(ind.baseMargin, 0)}</div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Company name</label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="(auto-generated if blank)" maxLength={30} className="mb-4 mt-1" />
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Initial funding: <span className="text-brand-500 font-bold">{moneyFull(funding)}</span>
          </label>
          <input
            type="range"
            min={Math.round(ind.startupCost * 0.5)}
            max={Math.round(Math.min(p.money, ind.startupCost * 5))}
            value={funding}
            onChange={(e) => setFunding(Number(e.target.value))}
            className="w-full mt-2 mb-1"
          />
          <div className="text-xs text-slate-400 mb-4">More capital means a bigger launch, faster growth and more staff.</div>
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              const r = run(startCompany, ind.id, name, funding);
              if (r.ok) onClose();
            }}
          >
            Launch for {money(funding)}
          </Button>
        </>
      )}
    </Modal>
  );
}

function ManageModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { state, run } = useGame();
  const [amount, setAmount] = useState(0);
  if (!state) return null;
  const c = state.companies[companyId];
  if (!c) return null;
  const ind = INDUSTRY_BY_ID[c.industryId];

  const lever = (key: CompanyLever, label: string, min: number, max: number, step: number, fmt: (v: number) => string) => (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-bold text-brand-500">{fmt((c as unknown as Record<string, number>)[key])}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={(c as unknown as Record<string, number>)[key]}
        onChange={(e) => run(setCompanyLever, companyId, key, Number(e.target.value))}
        className="w-full"
      />
    </div>
  );

  return (
    <Modal open onClose={onClose} title={c.name}>
      <div className="flex items-center gap-2 mb-4">
        <Badge tone="brand">{ind?.name}</Badge>
        {c.isPublic && <Badge tone="good">Public · {money(c.sharePrice)}/sh</Badge>}
        {c.unionized && <Badge tone="warn">Unionized</Badge>}
        <Badge>{pct(c.playerSharePct, 0)} owned</Badge>
      </div>

      <div className="h-24 mb-3">
        <LineChart data={c.history.map((h) => h.revenue)} height={96} color="#337dff" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <Row label="Cash" value={money(c.cash)} />
        <Row label="Debt" value={money(c.debt)} tone={c.debt > 0 ? 'bad' : undefined} />
        <Row label="Employees" value={c.employees.toLocaleString()} />
        <Row label="Market share" value={pct(c.marketShare, 2)} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3 space-y-2">
          <StatBar label="Brand" value={c.brand} />
          <StatBar label="Quality" value={c.quality} />
        </Card>
        <Card className="p-3 space-y-2">
          <StatBar label="Morale" value={c.morale} />
          <StatBar label="Satisfaction" value={c.customerSatisfaction} />
        </Card>
      </div>

      <div className="font-bold mb-3">Strategy</div>
      <div className="space-y-4">
        {lever('marketingPct', 'Marketing budget', 0, 0.25, 0.01, (v) => pct(v, 0))}
        {lever('rdPct', 'R&D budget', 0, 0.25, 0.01, (v) => pct(v, 0))}
        {lever('priceLevel', 'Pricing', 0.7, 1.5, 0.05, (v) => (v < 0.95 ? 'Discount' : v > 1.15 ? 'Premium' : 'Market'))}
        {lever('salaryLevel', 'Wages', 0.85, 1.4, 0.05, (v) => (v < 0.95 ? 'Low' : v > 1.15 ? 'Generous' : 'Market'))}
        {lever('automation', 'Automation', 0, 100, 5, (v) => `${Math.round(v)}%`)}
        {c.isPublic && lever('dividendPayoutPct', 'Dividend payout', 0, 0.9, 0.05, (v) => pct(v, 0))}
      </div>

      <div className="font-bold mt-5 mb-2">Capital</div>
      <input
        type="range"
        min={0}
        max={Math.round(Math.max(state.player.money, c.cash * c.playerSharePct))}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-full mb-1"
      />
      <div className="text-center text-sm font-bold text-brand-500 mb-2">{moneyFull(amount)}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" size="sm" onClick={() => amount > 0 && run(investInCompany, companyId, amount)}>
          Invest In
        </Button>
        <Button variant="soft" size="sm" onClick={() => amount > 0 && run(withdrawFromCompany, companyId, amount)}>
          Withdraw
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {!c.isPublic && (
          <Button size="sm" onClick={() => { const r = run(takeCompanyPublic, companyId); if (r.ok) onClose(); }}>
            IPO 📈
          </Button>
        )}
        <Button variant="danger" size="sm" className={c.isPublic ? 'col-span-2' : ''} onClick={() => { const r = run(sellCompany, companyId); if (r.ok) onClose(); }}>
          Sell Company
        </Button>
      </div>
    </Modal>
  );

  function Row({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
    return (
      <div className="flex justify-between">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`font-bold ${tone === 'bad' ? 'text-rose-500' : ''}`}>{value}</span>
      </div>
    );
  }
}
