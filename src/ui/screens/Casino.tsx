/**
 * Casino: a real walkable 3D floor — walk up to any machine, table or the sports book kiosk to
 * open it, exactly like the Explore hub's City walk. The bet panel for whatever's open renders as
 * a fixed overlay inside the same scene box (never pushed into page scroll), and movement pauses
 * while it's open so WASD doesn't fight the panel's own inputs. Every game keeps a genuine house
 * edge — see sim/casino.ts for the actual math.
 *
 * The 3D scene is mounted exactly once, at a fixed position in the tree — fullscreen is a pure
 * CSS toggle on its wrapping div (small inline box <-> fixed full-viewport), never a second
 * mount/unmount, so entering fullscreen doesn't spin up a second WebGL context.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  placeSportsBet, playCoinFlip, playTableGame, rouletteNumberColor, spinRoulette, spinSlotMachine, sportsMatches,
  type CoinSide, type RouletteBetKind, type RouletteResult, type SportsSide, type TableGame,
} from '../../sim/casino';
import { SLOT_MACHINES, slotMachineRTP, type SlotMachineDef } from '../../data/casino';
import { Badge, Button, Card, SectionHeader } from '../components';
import { money } from '../format';
import type { CasinoMachineView, RouletteBetVisual, RouletteSpinVisual } from '../three/CasinoScene';

const CasinoScene = lazy(() => import('../three/CasinoScene').then((m) => ({ default: m.CasinoScene })));
const SceneFallback = <div className="w-full h-full bg-slate-900 animate-pulse" />;

// Must match CasinoScene's own SPORTSBOOK_ID constant — kept as a plain string (not a runtime
// import) so CasinoScene stays purely dynamically-imported and its own chunk.
const SPORTSBOOK_ID = 'sportsbook';

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [nearbyId, setNearbyId] = useState<string | null>(null);
  const [bet, setBet] = useState(100);
  const [rouletteBetKind, setRouletteBetKind] = useState<RouletteBetKind>('red');
  const [rouletteNumber, setRouletteNumber] = useState(17);
  const [coinSide, setCoinSide] = useState<CoinSide>('heads');
  const [rouletteSpin, setRouletteSpin] = useState<RouletteSpinVisual | null>(null);
  const spinTokenRef = useRef(0);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [sportsStake, setSportsStake] = useState(100);
  const [sportsSide, setSportsSide] = useState<SportsSide>('home');
  const [fullscreen, setFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches);
  const fsContainerRef = useRef<HTMLDivElement>(null);

  // Track real device orientation so the fullscreen view can show a "rotate your device" hint on
  // browsers that don't support (or deny) the Screen Orientation lock below — mainly iOS Safari,
  // which never implements orientation.lock at all.
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = () => setIsPortrait(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // The browser's own fullscreen exit (Esc key, Android back gesture, swipe-down on iOS) doesn't
  // go through our button — without this the UI would keep showing "Exit Fullscreen" while no
  // longer actually fullscreen.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const enterFullscreen = () => {
    setFullscreen(true);
    const el = fsContainerRef.current;
    // Best-effort: real Fullscreen API (hides browser chrome) + landscape lock, chained so lock
    // only fires after fullscreen actually engages. Either step can be unsupported or denied
    // (iOS Safari supports neither for arbitrary elements) — the CSS `fixed inset-0` box below
    // covers the viewport regardless, so a rejection here just means no OS-level fullscreen/lock,
    // not a broken feature; the rotate-device hint covers the "can't force landscape" case.
    Promise.resolve(el?.requestFullscreen?.())
      .then(() => (screen as any).orientation?.lock?.('landscape'))
      .catch(() => {});
  };

  const exitFullscreen = () => {
    setFullscreen(false);
    try { (screen as any).orientation?.unlock?.(); } catch { /* unsupported — ignore */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  const closePanel = () => { setOpenId(null); setOpenMatchId(null); };

  if (!state) return null;
  const p = state.player;

  // Games start at birth now, so the casino floor needs a real front door — a toast-per-bet
  // "too young" message would be a poor experience for a whole screen that's simply off-limits.
  if (p.age < 18) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="text-6xl mb-4">🔞</div>
        <h2 className="text-xl font-black mb-2">Casino — 18+ Only</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
          The casino floor opens up once you turn 18. For now, go build up your smarts and charisma — the tables will still be here.
        </p>
      </div>
    );
  }

  const liquidity = p.money + p.savingsBalance;

  const machineViews: CasinoMachineView[] = SLOT_MACHINES.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    jackpot: state.casinoJackpots[m.id] ?? m.jackpotSeed,
    minBet: m.minBet,
    locked: m.vipLiquidity > 0 && liquidity < m.vipLiquidity,
  }));

  const matches = sportsMatches(state);

  const openMachine: SlotMachineDef | undefined = SLOT_MACHINES.find((m) => m.id === openId);
  const openTable: TableDef | undefined = TABLES.find((t) => t.id === openId);
  const openMatch = matches.find((m) => m.id === openMatchId);

  const nearbyLabel = (() => {
    if (!nearbyId) return null;
    if (nearbyId === SPORTSBOOK_ID) return 'Sports Book';
    return machineViews.find((m) => m.id === nearbyId)?.name ?? TABLES.find((t) => t.id === nearbyId)?.name ?? null;
  })();

  const openMachineOrTable = (id: string) => {
    const m = SLOT_MACHINES.find((x) => x.id === id);
    if (m) {
      if (m.vipLiquidity > 0 && liquidity < m.vipLiquidity) return;
      setBet(Math.max(m.minBet, Math.min(bet, m.maxBet, Math.round(p.money))));
      setOpenId(id);
      return;
    }
    if (TABLES.some((t) => t.id === id)) {
      setBet((b) => Math.max(50, Math.min(b, Math.round(p.money) || 50)));
      setOpenId(id);
      return;
    }
    if (id === SPORTSBOOK_ID) setOpenId(SPORTSBOOK_ID);
  };

  const rouletteBetVisual: RouletteBetVisual = { kind: rouletteBetKind, number: rouletteBetKind === 'straight' ? rouletteNumber : undefined };

  // Derived, not stored: if a loss drops p.money below the last-chosen bet (e.g. betting most of
  // your cash on one spin), this keeps the slider's value/max and the Play button in sync with
  // what's actually affordable right now, instead of leaving `bet` stale until manually dragged.
  const betMax = Math.max(openMachine?.minBet ?? 50, Math.min(openMachine?.maxBet ?? 100_000, Math.round(p.money) || 50));
  const effectiveBet = Math.min(bet, betMax);
  const canAffordBet = effectiveBet > 0 && effectiveBet <= p.money;

  const playSelected = () => {
    if (openMachine) { run(spinSlotMachine, openMachine.id, effectiveBet); return; }
    if (!openTable) return;
    if (openTable.id === 'roulette') {
      const res = run(
        spinRoulette,
        rouletteBetKind === 'straight' ? { kind: 'straight', number: rouletteNumber } : { kind: rouletteBetKind },
        effectiveBet,
      ) as RouletteResult;
      if (res.ok) setRouletteSpin({ landedNumber: res.landedNumber, token: ++spinTokenRef.current });
    } else if (openTable.id === 'heads_or_tails') {
      run(playCoinFlip, coinSide, effectiveBet);
    } else {
      run(playTableGame, openTable.id, effectiveBet);
    }
  };

  const sportsStakeMax = Math.max(50, Math.round(p.money) || 50);
  const effectiveSportsStake = Math.min(sportsStake, sportsStakeMax);
  const placeSportsBetClick = () => {
    if (!openMatch) return;
    run(placeSportsBet, openMatch.id, sportsSide, effectiveSportsStake);
    setOpenMatchId(null);
  };

  const panel = (openMachine || openTable) && (
    <Card className="p-4 shadow-xl">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-bold">{openMachine?.name ?? openTable?.name}</div>
        <button onClick={closePanel} className="text-slate-400 hover:text-slate-200 text-lg leading-none px-1">✕</button>
      </div>

      {openTable?.id === 'roulette' && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Bet type</div>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {ROULETTE_OUTSIDE.map((o) => (
              <button
                key={o.kind}
                onClick={() => setRouletteBetKind(o.kind)}
                className={`text-xs font-semibold py-2 rounded-xl transition-colors ${
                  rouletteBetKind === o.kind ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRouletteBetKind('straight')}
            className={`w-full text-xs font-semibold py-2 rounded-xl transition-colors mb-2 ${
              rouletteBetKind === 'straight' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Straight Number ({rouletteNumber}) · pays 36x
          </button>
          {rouletteBetKind === 'straight' && (
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

      {openTable?.id === 'heads_or_tails' && (
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
        min={openMachine?.minBet ?? 50}
        max={betMax}
        step={Math.max(10, Math.round((openMachine?.minBet ?? 50) / 5))}
        value={effectiveBet}
        onChange={(e) => setBet(Number(e.target.value))}
        className="w-full mt-1 mb-3"
      />
      <Button className="w-full" size="lg" disabled={!canAffordBet} onClick={playSelected}>
        {openMachine ? '🎰 Spin' : openTable?.id === 'roulette' ? '🎡 Spin' : openTable?.id === 'heads_or_tails' ? '🪙 Flip' : '🃏 Play'} ({money(effectiveBet)})
      </Button>
    </Card>
  );

  const sportsPanel = openId === SPORTSBOOK_ID && (
    <Card className="p-4 shadow-xl max-h-full overflow-y-auto">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-bold">🏟️ Sports Book — This Week</div>
        <button onClick={closePanel} className="text-slate-400 hover:text-slate-200 text-lg leading-none px-1">✕</button>
      </div>

      {!openMatch && (
        <div className="space-y-2">
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() => setOpenMatchId(m.id)}
              className="w-full text-left bg-slate-100 dark:bg-ink-800 rounded-xl p-3 hover:ring-2 hover:ring-brand-500 transition-shadow"
            >
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{m.sport}</div>
              <div className="flex items-center justify-between text-sm font-bold">
                <span>{m.home}</span>
                <span className="text-slate-400 font-normal text-xs">vs</span>
                <span>{m.away}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{m.homeOdds.toFixed(2)}x</span>
                <span>{m.awayOdds.toFixed(2)}x</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {openMatch && (
        <div>
          <button onClick={() => setOpenMatchId(null)} className="text-xs text-brand-500 font-semibold mb-2">‹ Back to slate</button>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{openMatch.sport}</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setSportsSide('home')}
              className={`text-sm font-semibold py-3 rounded-xl transition-colors ${sportsSide === 'home' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'}`}
            >
              {openMatch.home}<div className="text-xs opacity-80">{openMatch.homeOdds.toFixed(2)}x</div>
            </button>
            <button
              onClick={() => setSportsSide('away')}
              className={`text-sm font-semibold py-3 rounded-xl transition-colors ${sportsSide === 'away' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'}`}
            >
              {openMatch.away}<div className="text-xs opacity-80">{openMatch.awayOdds.toFixed(2)}x</div>
            </button>
          </div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Stake: {money(effectiveSportsStake)}</label>
          <input
            type="range"
            min={50}
            max={sportsStakeMax}
            step={Math.max(10, Math.round(sportsStakeMax / 50))}
            value={effectiveSportsStake}
            onChange={(e) => setSportsStake(Number(e.target.value))}
            className="w-full mt-1 mb-3"
          />
          <Button
            className="w-full"
            size="lg"
            disabled={effectiveSportsStake <= 0 || effectiveSportsStake > p.money}
            onClick={placeSportsBetClick}
          >
            🏟️ Place Bet ({money(effectiveSportsStake)})
          </Button>
        </div>
      )}
    </Card>
  );

  const anyPanelOpen = openId !== null;

  return (
    <div>
      <SectionHeader title="🎰 Casino" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
        Walk the floor — every machine, table and the sports book kiosk are real, not decorative, each with its
        own odds. The house always keeps an edge — narrowed by skill where skill applies, never flipped — same as
        a real casino.
      </p>

      <div
        ref={fsContainerRef}
        className={fullscreen ? 'fixed inset-0 z-[90] bg-black' : 'relative w-full h-[70vh] min-h-[420px] max-h-[640px] rounded-2xl overflow-hidden'}
      >
        <div className="absolute inset-0">
          <Suspense fallback={SceneFallback}>
            <CasinoScene
              machines={machineViews}
              tables={TABLES}
              onNearbyChange={setNearbyId}
              paused={anyPanelOpen}
              rouletteSpin={rouletteSpin}
              rouletteBet={rouletteBetVisual}
            />
          </Suspense>
        </div>

        <button
          onClick={() => (fullscreen ? exitFullscreen() : enterFullscreen())}
          className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] right-[calc(0.5rem+env(safe-area-inset-right))] bg-black/60 hover:bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur transition-colors z-10"
        >
          {fullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
        </button>

        {fullscreen && isPortrait && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none px-8 z-10">
            <div className="text-center text-white">
              <div className="text-4xl mb-2 animate-pulse">🔄</div>
              <div className="text-sm font-semibold">Rotate your device for the best view</div>
            </div>
          </div>
        )}

        {/* Walk-up prompt — hidden while a panel is already open. */}
        {!anyPanelOpen && nearbyId && nearbyLabel && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-8 anim-in z-10">
            <button
              onClick={() => openMachineOrTable(nearbyId)}
              className="bg-brand-500 text-white font-bold px-5 py-2.5 rounded-full shadow-lg"
            >
              ▶ Play {nearbyLabel}
            </button>
          </div>
        )}

        {/* Bet panel — a fixed overlay inside the scene box itself (not page flow), so it stays
            put whether the box is the small default size or the fullscreen viewport. */}
        {(panel || sportsPanel) && (
          <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/90 to-transparent z-10">
            {panel || sportsPanel}
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
              const isSelected = openId === m.id;
              return (
                <Card
                  key={m.id}
                  className={`p-4 ${isSelected ? 'ring-2 ring-brand-500' : ''} ${view.locked ? 'opacity-60' : ''}`}
                  onClick={() => openMachineOrTable(m.id)}
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
              <Card key={t.id} className={`p-4 ${openId === t.id ? 'ring-2 ring-brand-500' : ''}`} onClick={() => openMachineOrTable(t.id)}>
                <div className="font-bold">{t.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.blurb}</div>
              </Card>
            ))}
          </div>

          <SectionHeader title="Sports Book" />
          <div className="space-y-2">
            <Card className={`p-4 ${openId === SPORTSBOOK_ID ? 'ring-2 ring-brand-500' : ''}`} onClick={() => openMachineOrTable(SPORTSBOOK_ID)}>
              <div className="font-bold">🏟️ This Week's Slate</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {matches.length} moneyline matches · real win odds, ~7% vig on either side.
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
