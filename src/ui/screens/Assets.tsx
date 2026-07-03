/** Assets screen: property market, owned property, personal loans. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { buyProperty, propertyListings, sellProperty, takeLoan } from '../../sim/actions';
import { Badge, Button, Card, Pill, PillRow, SectionHeader } from '../components';
import { money, moneyFull, pct } from '../format';
import type { PropertyAsset } from '../../sim/types';

export function Assets() {
  const { state, run } = useGame();
  const [tab, setTab] = useState<'owned' | 'buy' | 'loans'>('owned');
  const [loanAmt, setLoanAmt] = useState(50_000);
  const [loanYears, setLoanYears] = useState(10);
  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const listings = propertyListings(state);
  const totalPropValue = p.properties.reduce((s, x) => s + x.value - x.mortgage, 0);
  const totalDebt = p.loans.reduce((s, l) => s + l.principal, 0);

  return (
    <div>
      <SectionHeader title="Assets" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4 text-center">
          <div className="text-xs text-slate-400">Property Equity</div>
          <div className="font-extrabold text-emerald-500">{money(totalPropValue)}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs text-slate-400">Debt</div>
          <div className="font-extrabold text-rose-500">{money(totalDebt)}</div>
        </Card>
      </div>

      <PillRow>
        <Pill label={`Owned (${p.properties.length})`} active={tab === 'owned'} onClick={() => setTab('owned')} />
        <Pill label="Buy Property" active={tab === 'buy'} onClick={() => setTab('buy')} />
        <Pill label={`Loans (${p.loans.length})`} active={tab === 'loans'} onClick={() => setTab('loans')} />
      </PillRow>

      {tab === 'owned' && (
        <div className="mt-4 space-y-3">
          {p.properties.length === 0 && (
            <Card className="p-6 text-center text-slate-500 dark:text-slate-400">No property yet. Real estate builds passive rental income and appreciates with the housing market.</Card>
          )}
          {p.properties.map((prop) => (
            <PropertyCard key={prop.id} prop={prop} onSell={() => run(sellProperty, prop.id)} />
          ))}
        </div>
      )}

      {tab === 'buy' && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-400 px-1">Housing index: {Math.round(home.economy.housingIndex)} · mortgage rate ≈ {pct(home.economy.interestRate + 0.02)}</p>
          {listings.map((l, i) => (
            <Card key={i} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{l.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {l.kind} · {l.rentalYield > 0 ? `${pct(l.rentalYield)} rental yield` : 'no rental income'}
                  </div>
                </div>
                <div className="font-extrabold text-brand-500">{money(l.value)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button size="sm" variant="soft" onClick={() => run(buyProperty, l, false)}>Buy Cash</Button>
                <Button size="sm" onClick={() => run(buyProperty, l, true)}>Mortgage (20%)</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'loans' && (
        <div className="mt-4 space-y-3">
          <Card className="p-5">
            <div className="font-bold mb-3">Take a Personal Loan</div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Amount: {moneyFull(loanAmt)}</label>
            <input type="range" min={10_000} max={2_000_000} step={10_000} value={loanAmt} onChange={(e) => setLoanAmt(Number(e.target.value))} className="w-full mt-1 mb-3" />
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Term: {loanYears} years</label>
            <input type="range" min={3} max={30} value={loanYears} onChange={(e) => setLoanYears(Number(e.target.value))} className="w-full mt-1 mb-3" />
            <Button className="w-full" onClick={() => run(takeLoan, loanAmt, loanYears)}>Apply for Loan</Button>
          </Card>
          {p.loans.map((l) => (
            <Card key={l.id} className="p-4 flex justify-between items-center">
              <div>
                <div className="font-bold">{l.purpose}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {pct(l.rate)} · {l.yearsLeft} yrs left
                </div>
              </div>
              <Badge tone="bad">{money(l.principal)}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyCard({ prop, onSell }: { prop: PropertyAsset; onSell: () => void }) {
  const appreciation = prop.value / prop.purchasePrice - 1;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold">{prop.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
            {prop.kind} · bought at {money(prop.purchasePrice)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-extrabold">{money(prop.value)}</div>
          <div className={`text-xs font-semibold ${appreciation >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {appreciation >= 0 ? '+' : ''}{pct(appreciation)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-2">
          {prop.mortgage > 0 && <Badge tone="warn">Mortgage {money(prop.mortgage)}</Badge>}
          {prop.rentalYield > 0 && <Badge tone="good">Rented</Badge>}
        </div>
        <Button size="sm" variant="danger" onClick={onSell}>Sell</Button>
      </div>
    </Card>
  );
}
