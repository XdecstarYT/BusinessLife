/**
 * Casino: the 3D floor up top (every machine and table real and clickable-by-card below), a
 * shared bet control for whichever game is selected, and lifetime stats. Slot machines and table
 * games both keep a genuine house edge — see sim/casino.ts for the actual math.
 */
import { lazy, Suspense, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { spinSlotMachine, playTableGame, type TableGame } from '../../sim/casino';
import { SLOT_MACHINES, slotMachineRTP } from '../../data/casino';
import { Badge, Button, Card, SectionHeader } from '../components';
import { money } from '../format';
import type { CasinoMachineView } from '../three/CasinoScene';

const CasinoScene = lazy(() => import('../three/CasinoScene').then((m) => ({ default: m.CasinoScene })));
const SceneFallback = <div className="w-full h-64 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

const TABLES: { id: TableGame; name: string; color: number; blurb: string }[] = [
  { id: 'blackjack', name: 'Blackjack', color: 0x16a34a, blurb: 'Beat the dealer to 21. Poker skill narrows the house edge.' },
  { id: 'roulette', name: 'Roulette', color: 0xdc2626, blurb: "Red or black — the wheel doesn't care about your skills." },
  { id: 'poker', name: 'High-Stakes Poker', color: 0x1d4ed8, blurb: 'The deepest skill lean of the table games — still a house edge at the top.' },
];

export function Casino() {
  const { state, run } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [bet, setBet] = useState(100);
  if (!state) return null;
  const p = state.player;
  const liquidity = p.money + p.savingsBalance;

  const machineViews: CasinoMachineView[] = SLOT_MACHINES.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    jackpot: state.casinoJackpots[m.id] ?? m.jackpotSeed,
    minBet: m.minBet,
    locked: m.vipLiquidity > 0 && liquidity < m.vipLiquidity,
  }));

  const selectedMachine = SLOT_MACHINES.find((m) => m.id === selected);
  const selectedTable = TABLES.find((t) => t.id === selected);

  const selectMachine = (id: string) => {
    const m = SLOT_MACHINES.find((x) => x.id === id);
    if (!m || (m.vipLiquidity > 0 && liquidity < m.vipLiquidity)) return;
    setSelected(id);
    setBet(Math.max(m.minBet, Math.min(bet, m.maxBet, Math.round(p.money))));
  };
  const selectTable = (id: string) => {
    setSelected(id);
    setBet((b) => Math.max(50, Math.min(b, Math.round(p.money) || 50)));
  };

  const canAffordBet = bet > 0 && bet <= p.money;

  return (
    <div>
      <SectionHeader title="🎰 Casino" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
        Every machine has a real name, its own odds and a live jackpot that keeps growing until someone hits it. The
        house always keeps an edge here — narrowed by skill, never flipped — same as a real casino.
      </p>
      <Suspense fallback={SceneFallback}>
        <CasinoScene machines={machineViews} tables={TABLES} selectedId={selected} />
      </Suspense>

      <div className="grid grid-cols-2 gap-3 mt-3 mb-2">
        <Card className="p-3 text-center">
          <div className="text-xs text-slate-400">Lifetime Wagered</div>
          <div className="font-extrabold">{money(p.casinoTotalWagered)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xs text-slate-400">Biggest Win</div>
          <div className="font-extrabold text-emerald-500">{money(p.casinoBiggestWin)}</div>
        </Card>
      </div>

      <SectionHeader title="Slot Machines" />
      <div className="space-y-2">
        {SLOT_MACHINES.map((m) => {
          const view = machineViews.find((v) => v.id === m.id)!;
          const isSelected = selected === m.id;
          return (
            <Card
              key={m.id}
              className={`p-4 ${isSelected ? 'ring-2 ring-brand-500' : ''} ${view.locked ? 'opacity-60' : ''}`}
              onClick={() => selectMachine(m.id)}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-2">
                    {m.name}
                    {view.locked && <Badge tone="warn">VIP</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{m.theme}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Bet {money(m.minBet)}–{money(m.maxBet)} · ~{Math.round(slotMachineRTP(m) * 100)}% return · {m.volatility} volatility
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400">Jackpot</div>
                  <div className="font-extrabold text-amber-500">{money(view.jackpot)}</div>
                </div>
              </div>
              {view.locked && <div className="text-[11px] text-amber-500 mt-2">Needs ${m.vipLiquidity.toLocaleString()}+ in cash and savings.</div>}
            </Card>
          );
        })}
      </div>

      <SectionHeader title="Table Games" />
      <div className="space-y-2">
        {TABLES.map((t) => (
          <Card key={t.id} className={`p-4 ${selected === t.id ? 'ring-2 ring-brand-500' : ''}`} onClick={() => selectTable(t.id)}>
            <div className="font-bold">{t.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t.blurb}</div>
          </Card>
        ))}
      </div>

      {(selectedMachine || selectedTable) && (
        <Card className="p-4 mt-4 sticky bottom-20 shadow-xl">
          <div className="font-bold mb-2">{selectedMachine?.name ?? selectedTable?.name}</div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bet: {money(bet)}</label>
          <input
            type="range"
            min={selectedMachine?.minBet ?? 50}
            max={Math.max(selectedMachine?.minBet ?? 50, Math.min(selectedMachine?.maxBet ?? 100_000, Math.round(p.money) || 50))}
            step={Math.max(10, Math.round((selectedMachine?.minBet ?? 50) / 5))}
            value={bet}
            onChange={(e) => setBet(Number(e.target.value))}
            className="w-full mt-1 mb-3"
          />
          <Button
            className="w-full"
            size="lg"
            disabled={!canAffordBet}
            onClick={() => {
              if (selectedMachine) run(spinSlotMachine, selectedMachine.id, bet);
              else if (selectedTable) run(playTableGame, selectedTable.id, bet);
            }}
          >
            {selectedMachine ? '🎰 Spin' : '🃏 Play'} ({money(bet)})
          </Button>
        </Card>
      )}
    </div>
  );
}
