/** Assets screen: property market, owned property, loans, bonds, forex, insurance. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  buyBond,
  buyLifeInsurance,
  buyProperty,
  cancelLifeInsurance,
  closeForexPosition,
  depositSavings,
  openForexPosition,
  openTermDeposit,
  propertyListings,
  refinanceMortgage,
  refinancePersonalLoan,
  renovateProperty,
  sellBondEarly,
  sellProperty,
  setMaintenanceLevel,
  takeLoan,
  toggleRentalStatus,
  togglePropertyInsurance,
  withdrawSavings,
} from '../../sim/actions';
import { buyLuxuryAsset, divestCelebrityStake, investInCelebrityBrand, LUXURY_CATALOG, sellLuxuryAsset } from '../../sim/lifestyle';
import { Badge, Button, Card, Field, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money, moneyFull, pct } from '../format';
import type { MaintenanceLevel, PropertyAsset } from '../../sim/types';

export function Assets() {
  const { state, run } = useGame();
  const [tab, setTab] = useState<'owned' | 'buy' | 'loans' | 'bonds' | 'forex' | 'insurance' | 'lifestyle' | 'celebrities' | 'banking'>('owned');
  const [bankAmt, setBankAmt] = useState(5_000);
  const [tdYears, setTdYears] = useState(3);
  const [loanAmt, setLoanAmt] = useState(50_000);
  const [loanYears, setLoanYears] = useState(10);
  const [bondAmt, setBondAmt] = useState(20_000);
  const [bondYears, setBondYears] = useState(5);
  const [bondCountry, setBondCountry] = useState('');
  const [fxAmt, setFxAmt] = useState(10_000);
  const [fxCountry, setFxCountry] = useState('');
  const [premium, setPremium] = useState(200);
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
        <Pill label={`Bonds (${p.bonds.length})`} active={tab === 'bonds'} onClick={() => setTab('bonds')} />
        <Pill label={`Forex (${p.forexPositions.length})`} active={tab === 'forex'} onClick={() => setTab('forex')} />
        <Pill label="Insurance" active={tab === 'insurance'} onClick={() => setTab('insurance')} />
        <Pill label={`Lifestyle (${p.luxuryAssets.length})`} active={tab === 'lifestyle'} onClick={() => setTab('lifestyle')} />
        <Pill label={`Celebrities (${p.celebrityStakes.length})`} active={tab === 'celebrities'} onClick={() => setTab('celebrities')} />
        <Pill label="🏦 Banking" active={tab === 'banking'} onClick={() => setTab('banking')} />
      </PillRow>

      {tab === 'banking' && (
        <div className="mt-4 space-y-3">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="font-bold">Savings Account</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Earns the policy rate minus 1% ({pct(Math.max(0, home.economy.interestRate - 0.01))}/yr), fully liquid.</div>
              </div>
              <div className="font-extrabold text-emerald-500">{money(p.savingsBalance)}</div>
            </div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Amount: {moneyFull(bankAmt)}</label>
            <input type="range" min={500} max={Math.max(500, Math.round(Math.max(p.money, p.savingsBalance)))} step={500} value={bankAmt} onChange={(e) => setBankAmt(Number(e.target.value))} className="w-full mt-1 mb-3" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="soft" onClick={() => run(depositSavings, bankAmt)}>Deposit</Button>
              <Button variant="soft" onClick={() => run(withdrawSavings, Math.min(p.savingsBalance, bankAmt))}>Withdraw</Button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-bold mb-1">Term Deposits</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Lock money away at a fixed rate — longer terms pay a small premium. Interest compounds annually until maturity.</p>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Term: {tdYears} years ({pct(home.economy.interestRate + 0.005 + tdYears * 0.002)}/yr)</label>
            <input type="range" min={1} max={10} value={tdYears} onChange={(e) => setTdYears(Number(e.target.value))} className="w-full mt-1 mb-3" />
            <Button className="w-full" variant="soft" onClick={() => run(openTermDeposit, bankAmt, tdYears)}>Open Term Deposit ({moneyFull(bankAmt)})</Button>
          </Card>

          {p.termDeposits.map((td) => (
            <Card key={td.id} className="p-4 flex justify-between items-center">
              <div>
                <div className="font-bold">Term Deposit</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{pct(td.rate)} fixed · matures in {td.yearsLeft} yr</div>
              </div>
              <Badge tone="good">{money(td.principal)}</Badge>
            </Card>
          ))}
        </div>
      )}

      {tab === 'owned' && (
        <div className="mt-4 space-y-3">
          {p.properties.length === 0 && (
            <Card className="p-6 text-center text-slate-500 dark:text-slate-400">No property yet. Real estate builds passive rental income and appreciates with the housing market.</Card>
          )}
          {p.properties.map((prop) => (
            <PropertyCard
              key={prop.id}
              prop={prop}
              onSell={() => run(sellProperty, prop.id)}
              onRenovate={() => run(renovateProperty, prop.id)}
              onToggleRental={() => run(toggleRentalStatus, prop.id)}
              onToggleInsurance={() => run(togglePropertyInsurance, prop.id)}
              onRefinance={() => run(refinanceMortgage, prop.id)}
              onMaintenance={(level) => run(setMaintenanceLevel, prop.id, level)}
              year={state.year}
            />
          ))}
        </div>
      )}

      {tab === 'buy' && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-400 px-1">Housing index: {Math.round(home.economy.housingIndex)} · mortgage rate ≈ {pct(home.economy.interestRate + 0.02)}</p>
          {listings.map((l, i) => (
            <Card key={i} className="p-4">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-bold truncate" title={l.name}>{l.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">
                    {l.kind} · {l.rentalYield > 0 ? `${pct(l.rentalYield)} rental yield` : 'no rental income'}
                  </div>
                </div>
                <div className="font-extrabold text-brand-500 shrink-0">{money(l.value)}</div>
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
              <div className="text-right shrink-0">
                <Badge tone="bad">{money(l.principal)}</Badge>
                <button className="block text-xs text-brand-500 font-semibold mt-1" onClick={() => run(refinancePersonalLoan, l.id)}>Refinance</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'bonds' && (
        <div className="mt-4 space-y-3">
          <Card className="p-5">
            <div className="font-bold mb-3">Buy a Government Bond</div>
            <p className="text-xs text-slate-400 mb-3">Fixed annual coupon, principal returned at maturity. Safer than stocks, lower return.</p>
            <Field label="Country">
              <select
                value={bondCountry || home.id}
                onChange={(e) => setBondCountry(e.target.value)}
                className="w-full rounded-2xl bg-slate-100 dark:bg-ink-800 border border-transparent px-4 py-3 text-slate-900 dark:text-white"
              >
                {state.countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.flag} {c.name} — {pct(c.economy.interestRate + 0.01)}</option>
                ))}
              </select>
            </Field>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-3 block">Amount: {moneyFull(bondAmt)}</label>
            <input type="range" min={1_000} max={Math.max(1000, Math.round(p.money))} value={bondAmt} onChange={(e) => setBondAmt(Number(e.target.value))} className="w-full mt-1 mb-3" />
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Term: {bondYears} years</label>
            <input type="range" min={1} max={20} value={bondYears} onChange={(e) => setBondYears(Number(e.target.value))} className="w-full mt-1 mb-3" />
            <Button className="w-full" onClick={() => run(buyBond, bondCountry || home.id, bondAmt, bondYears)}>Buy Bond</Button>
          </Card>
          {p.bonds.map((b) => {
            const country = state.countries.find((c) => c.id === b.countryId);
            return (
              <Card key={b.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold">{country?.flag} {country?.name} Bond</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{pct(b.rate)} coupon · {b.yearsLeft} yrs left</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{money(b.principal)}</div>
                  <button className="text-xs text-rose-500 font-semibold" onClick={() => run(sellBondEarly, b.id)}>Redeem early</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'forex' && (
        <div className="mt-4 space-y-3">
          <Card className="p-5">
            <div className="font-bold mb-3">Speculate on a Currency</div>
            <p className="text-xs text-slate-400 mb-3">Go long if you think a currency will strengthen, short if you think it will weaken.</p>
            <Field label="Currency">
              <select
                value={fxCountry || state.countries[0].id}
                onChange={(e) => setFxCountry(e.target.value)}
                className="w-full rounded-2xl bg-slate-100 dark:bg-ink-800 border border-transparent px-4 py-3 text-slate-900 dark:text-white"
              >
                {state.countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.flag} {c.currency}</option>
                ))}
              </select>
            </Field>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-3 block">Amount: {moneyFull(fxAmt)}</label>
            <input type="range" min={1_000} max={Math.max(1000, Math.round(p.money))} value={fxAmt} onChange={(e) => setFxAmt(Number(e.target.value))} className="w-full mt-1 mb-3" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="soft" onClick={() => run(openForexPosition, fxCountry || state.countries[0].id, fxAmt, false)}>Go Long</Button>
              <Button variant="soft" onClick={() => run(openForexPosition, fxCountry || state.countries[0].id, fxAmt, true)}>Go Short</Button>
            </div>
          </Card>
          {p.forexPositions.map((f) => {
            const country = state.countries.find((c) => c.id === f.countryId);
            const currentRate = country?.economy.exchangeRate ?? f.entryRate;
            const ratio = currentRate / f.entryRate;
            const pl = (f.short ? f.notional * (2 - ratio) : f.notional * ratio) - f.notional;
            return (
              <Card key={f.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {country?.flag} {country?.currency}
                    <Badge tone={f.short ? 'warn' : 'brand'}>{f.short ? 'SHORT' : 'LONG'}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{money(f.notional)} notional</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-bold ${pl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{pl >= 0 ? '+' : ''}{money(pl)}</div>
                  <button className="text-xs text-brand-500 font-semibold" onClick={() => run(closeForexPosition, f.id)}>Close</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'insurance' && (
        <div className="mt-4 space-y-3">
          {p.lifeInsurance ? (
            <Card className="p-5">
              <div className="font-bold mb-1">Active Policy</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {money(p.lifeInsurance.monthlyPremium)}/month · {money(p.lifeInsurance.payout)} payout to your family
              </div>
              <Button variant="danger" size="sm" onClick={() => run(cancelLifeInsurance)}>Cancel Policy</Button>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="font-bold mb-3">Life Insurance</div>
              <p className="text-xs text-slate-400 mb-3">Pays your spouse and children a lump sum when you die.</p>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Monthly premium: {moneyFull(premium)}</label>
              <input type="range" min={50} max={5_000} step={50} value={premium} onChange={(e) => setPremium(Number(e.target.value))} className="w-full mt-1 mb-2" />
              <div className="text-xs text-slate-400 mb-3">Payout: {money(premium * 240)}</div>
              <Button className="w-full" onClick={() => run(buyLifeInsurance, premium)}>Take Out Policy</Button>
            </Card>
          )}
          <Card className="p-4 text-xs text-slate-500 dark:text-slate-400">
            Company insurance is managed per-business from the Business tab's strategy panel.
          </Card>
        </div>
      )}

      {tab === 'lifestyle' && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-400 px-1">Vanity assets: real upkeep every year, prestige and happiness up front, and a shot at flavor payouts for racehorses and sports teams.</p>
          {p.luxuryAssets.map((asset) => (
            <Card key={asset.id} className="p-4 flex justify-between items-center">
              <div className="min-w-0">
                <div className="font-bold truncate">{asset.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {money(asset.value)} · upkeep {money(asset.upkeepPerYear)}/yr
                </div>
              </div>
              <Button size="sm" variant="danger" onClick={() => run(sellLuxuryAsset, asset.id)}>Sell</Button>
            </Card>
          ))}
          <Card className="p-5">
            <div className="font-bold mb-3">Acquire</div>
            <div className="space-y-2">
              {LUXURY_CATALOG.map((entry) => (
                <div key={entry.kind} className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-sm">{entry.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">≈ {money(entry.baseCost)}</div>
                  </div>
                  <Button size="sm" variant="soft" onClick={() => run(buyLuxuryAsset, entry.kind)}>Buy</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'celebrities' && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-400 px-1">Invest in a celebrity's brand for an ongoing royalty tied to their fame and fortune.</p>
          {p.celebrityStakes.map((stake) => {
            const npc = state.npcs[stake.npcId];
            return (
              <Card key={stake.npcId} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold">{npc?.name ?? 'Unknown'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{(stake.stakePct * 100).toFixed(1)}% stake · invested {money(stake.invested)}</div>
                </div>
                <Button size="sm" variant="danger" onClick={() => run(divestCelebrityStake, stake.npcId)}>Cash Out</Button>
              </Card>
            );
          })}
          {Object.values(state.npcs)
            .filter((n) => n.alive && n.role === 'celebrity' && n.countryId === p.countryId && !p.celebrityStakes.some((s) => s.npcId === n.id))
            .slice(0, 8)
            .map((n) => (
              <Card key={n.id} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-bold">{n.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Est. wealth {money(n.wealth)}</div>
                </div>
                <Button size="sm" variant="soft" onClick={() => run(investInCelebrityBrand, n.id, 50_000)}>Invest $50k</Button>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}

const MAINTENANCE_LEVELS: { id: MaintenanceLevel; label: string }[] = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'standard', label: 'Standard' },
  { id: 'premium', label: 'Premium' },
];

function PropertyCard({
  prop,
  onSell,
  onRenovate,
  onToggleRental,
  onToggleInsurance,
  onRefinance,
  onMaintenance,
  year,
}: {
  prop: PropertyAsset;
  onSell: () => void;
  onRenovate: () => void;
  onToggleRental: () => void;
  onToggleInsurance: () => void;
  onRefinance: () => void;
  onMaintenance: (level: MaintenanceLevel) => void;
  year: number;
}) {
  const appreciation = prop.value / prop.purchasePrice - 1;
  const isLand = prop.kind === 'land';
  const age = year - prop.yearBuilt;
  const atRisk = !isLand && prop.condition < 35;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="font-bold truncate" title={prop.name}>{prop.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">
            {prop.kind} · bought at {money(prop.purchasePrice)}
            {!isLand && ` · built ${prop.yearBuilt} (${age} yr${age !== 1 ? 's' : ''} old)`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-extrabold">{money(prop.value)}</div>
          <div className={`text-xs font-semibold ${appreciation >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {appreciation >= 0 ? '+' : ''}{pct(appreciation)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {prop.mortgage > 0 && <Badge tone="warn">Mortgage {money(prop.mortgage)}</Badge>}
        {prop.rentalYield > 0 && <Badge tone="good">Rented</Badge>}
        {prop.insured && <Badge tone="brand">Insured</Badge>}
        {atRisk && <Badge tone="bad">⚠️ Structural risk</Badge>}
        {prop.lastRenovatedYear && <Badge>Renovated {prop.lastRenovatedYear}</Badge>}
      </div>
      {!isLand && (
        <div className="mt-3 space-y-1.5">
          <StatBar label="Condition" value={prop.condition} />
          <StatBar label="Energy efficiency" value={prop.energyEfficiency} />
        </div>
      )}
      {atRisk && (
        <p className="text-[11px] text-rose-500 mt-2">
          Badly neglected — real risk of a structural failure each year until you renovate{prop.insured ? ' (insurance would soften the loss)' : ' and you are uninsured'}.
        </p>
      )}
      {!isLand && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Maintenance spend</div>
          <PillRow>
            {MAINTENANCE_LEVELS.map((m) => (
              <Pill key={m.id} label={m.label} active={prop.maintenanceLevel === m.id} onClick={() => onMaintenance(m.id)} />
            ))}
          </PillRow>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button size="sm" variant="soft" onClick={onRenovate}>🔨 Renovate</Button>
        {prop.kind !== 'land' && (
          <Button size="sm" variant="soft" onClick={onToggleRental}>{prop.rentalYield > 0 ? 'Move In' : 'Rent Out'}</Button>
        )}
        <Button size="sm" variant={prop.insured ? 'primary' : 'soft'} onClick={onToggleInsurance}>
          {prop.insured ? 'Insured' : 'Insure'}
        </Button>
        {prop.mortgage > 0 && <Button size="sm" variant="soft" onClick={onRefinance}>💳 Refinance</Button>}
        <Button size="sm" variant="danger" onClick={onSell}>Sell</Button>
      </div>
    </Card>
  );
}
