/**
 * Casino: the 3D floor up top (fullscreen-able — every machine and table real, not decorative),
 * a shared bet control for whichever game is selected, and lifetime stats. Every game keeps a
 * genuine house edge — see sim/casino.ts for the actual math.
 *
 * The 3D scene is mounted exactly once, at a fixed position in the tree — fullscreen is a pure
 * CSS toggle on its wrapping div (small inline box <-> fixed full-viewport), never a second
 * mount/unmount, so entering fullscreen doesn't spin up a second WebGL context.
 */
import { lazy, Suspense, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  playCoinFlip, playTableGame, rouletteNumberColor, spinRoulette, spinSlotMachine,
  type CoinSide, type RouletteBetKind, type TableGame,
} from '../../sim/casino';
import { SLOT_MACHINES, slotMachineRTP, type SlotMachineDef } from '../../data/casino';
import { Badge, Button, Card, SectionHeader } from '../components';
import { money } from '../format';
import type { CasinoMachineView } from '../three/CasinoScene';

const CasinoScene = lazy(() => import('../three/CasinoScene').then((m) => ({ default: m.CasinoScene })));
const SceneFallback = <div className="w-full h-full bg-slate-900 animate-pulse" />;

type TableId = TableGame | 'roulette' | 'heads_or_tails';
interface TableDef { id: TableId; name: string; color: number; blurb: string }

const TABLES: TableDef[] = [
  { id: 'blackjack', name: 'Blackjack', color: 0x16a34a, blurb: 'Beat the dealer to 21. Poker skill narrows the house edge.' },
  { id: 'roulette', name: 'Roulette', color: 0xdc2626, blurb: 'Real European wheel — 37 pockets, straight numbers or outside bets.' },
  { id: 'poker', name: 'High-Stakes Poker', color: 0x1d4ed8, blurb: 'The deepest skill lean of the table games — still a house edge at the top.' },
  { id: 'heads_or_tails', name: 'Heads or Tails', color: 0xeab308, blurb: 'A genuinely fair 50/50 coin — the lowest-drama bet in the house.' },
];

const ROULETTE_OUTSIDE: { kind: RouletteBetKind; label: string }[] = [
  { kind: 'red', label: 'Red' },
  { kind: 'black', label: 'Black' },
  { kind: 'odd', label: 'Odd' },
  { kind: 'even', label: 'Even' },
  { kind: 'low', label: '1–18' },
  { kind: 'high', label: '19–36' },
];

export function Casino() {
  const { state, run } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [bet, setBet] = useState(100);
  const [rouletteBet, setRouletteBet] = useState<RouletteBetKind>('red');
  const [rouletteNumber, setRouletteNumber] = useState(17);
  const [coinSide, setCoinSide] = useState<CoinSide>('heads');
  const [fullscreen, setFullscreen] = useState(false);
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

  const selectedMachine: SlotMachineDef | undefined = SLOT_MACHINES.find((m) => m.id === selected);
  const selectedTable: TableDef | undefined = TABLES.find((t) => t.id === selected);

  const selectMachine = (id: string) => {
    const m = SLOT_MACHINES.find((x) => x.id === id);
    if (!m || (m.vipLiquidity > 0 && liquidity < m.vipLiquidity)) return;
    setSelected(id);
    setBet(Math.max(m.minBet, Math.min(bet, m.maxBet, Math.round(p.money))));
  };
  const selectTable = (id: TableId) => {
    setSelected(id);
    setBet((b) => Math.max(50, Math.min(b, Math.round(p.money) || 50)));
  };

  // Derived, not stored: if a loss drops p.money below the last-chosen bet (e.g. betting most of
  // your cash on one spin), this keeps the slider's value/max and the Play button in sync with
  // what's actually affordable right now, instead of leaving `bet` stale until manually dragged.
  const betMax = Math.max(selectedMachine?.minBet ?? 50, Math.min(selectedMachine?.maxBet ?? 100_000, Math.round(p.money) || 50));
  const effectiveBet = Math.min(bet, betMax);
  const canAffordBet = effectiveBet > 0 && effectiveBet <= p.money;

  const playSelected = () => {
    if (selectedMachine) { run(spinSlotMachine, selectedMachine.id, effectiveBet); return; }
    if (!selectedTable) return;
    if (selectedTable.id === 'roulette') {
      run(spinRoulette, rouletteBet === 'straight' ? { kind: 'straight', number: rouletteNumber } : { kind: rouletteBet }, effectiveBet);
    } else if (selectedTable.id === 'heads_or_tails') {
      run(playCoinFlip, coinSide, effectiveBet);
    } else {
      run(playTableGame, selectedTable.id, effectiveBet);
    }
  };

  const betPanel = (selectedMachine || selectedTable) && (
    <Card className="p-4 shadow-xl">
      <div className="font-bold mb-2">{selectedMachine?.name ?? selectedTable?.name}</div>

      {selectedTable?.id === 'roulette' && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Bet type</div>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {ROULETTE_OUTSIDE.map((o) => (
              <button
                key={o.kind}
                onClick={() => setRouletteBet(o.kind)}
                className={`text-xs font-semibold py-2 rounded-xl transition-colors ${
                  rouletteBet === o.kind ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRouletteBet('straight')}
            className={`w-full text-xs font-semibold py-2 rounded-xl transition-colors mb-2 ${
              rouletteBet === 'straight' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Straight Number ({rouletteNumber}) · pays 36x
          </button>
          {rouletteBet === 'straight' && (
            <>
              <input
                type="range"
                min={0}
                max={36}
                value={rouletteNumber}
                onChange={(e) => setRouletteNumber(Number(e.target.value))}
                className="w-full mb-1"
              />
              <div className={`text-center text-xs font-bold mb-2 ${rouletteNumberColor(rouletteNumber) === 'red' ? 'text-rose-500' : rouletteNumberColor(rouletteNumber) === 'black' ? 'text-slate-400' : 'text-emerald-500'}`}>
                {rouletteNumber} · {rouletteNumberColor(rouletteNumber)}
              </div>
            </>
          )}
        </div>
      )}

      {selectedTable?.id === 'heads_or_tails' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => setCoinSide('heads')}
            className={`text-sm font-semibold py-3 rounded-xl transition-colors ${coinSide === 'heads' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'}`}
          >
            🪙 Heads
          </button>
          <button
            onClick={() => setCoinSide('tails')}
            className={`text-sm font-semibold py-3 rounded-xl transition-colors ${coinSide === 'tails' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'}`}
          >
            🪙 Tails
          </button>
        </div>
      )}

      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bet: {money(effectiveBet)}</label>
      <input
        type="range"
        min={selectedMachine?.minBet ?? 50}
        max={betMax}
        step={Math.max(10, Math.round((selectedMachine?.minBet ?? 50) / 5))}
        value={effectiveBet}
        onChange={(e) => setBet(Number(e.target.value))}
        className="w-full mt-1 mb-3"
      />
      <Button className="w-full" size="lg" disabled={!canAffordBet} onClick={playSelected}>
        {selectedMachine ? '🎰 Spin' : selectedTable?.id === 'roulette' ? '🎡 Spin' : selectedTable?.id === 'heads_or_tails' ? '🪙 Flip' : '🃏 Play'} ({money(effectiveBet)})
      </Button>
    </Card>
  );

  return (
    <div>
      <SectionHeader title="🎰 Casino" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
        Every machine and table is real, not decorative — its own odds, its own math. The house always keeps an
        edge here — narrowed by skill where skill applies, never flipped — same as a real casino.
      </p>

      <div className={fullscreen ? 'fixed inset-0 z-[90] bg-black flex flex-col' : 'relative w-full h-64 rounded-2xl overflow-hidden'}>
        <div className={fullscreen ? 'flex-1 min-h-0' : 'w-full h-full'}>
          <Suspense fallback={SceneFallback}>
            <CasinoScene machines={machineViews} tables={TABLES} selectedId={selected} />
          </Suspense>
        </div>
        <button
          onClick={() => setFullscreen((f) => !f)}
          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur transition-colors"
        >
          {fullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
        </button>
        {fullscreen && betPanel && (
          <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/90 to-transparent">
            {betPanel}
          </div>
        )}
      </div>

      {!fullscreen && (
        <>
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

          {betPanel && <div className="mt-4 sticky bottom-20">{betPanel}</div>}
        </>
      )}
    </div>
  );
}
