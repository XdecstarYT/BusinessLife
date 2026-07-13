/**
 * World Domination screen: the endgame. A live 3D globe (GlobeScene) with a glowing marker per
 * foreign nation, plus an overlay to launch the campaign and project economic / political / soft
 * power at whichever nation you've selected on the globe, then consolidate control once influence
 * is high enough. Win by controlling every nation.
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  CONTROL_THRESHOLD, canLaunchDomination, consolidateControl, launchDomination, projectPower,
} from '../../sim/domination';
import { netWorth } from '../../sim/engine';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';
import type { GlobeMarker } from '../three/GlobeScene';

const GlobeScene = lazy(() => import('../three/GlobeScene').then((m) => ({ default: m.GlobeScene })));
const SceneFallback = <div className="w-full h-full grid place-items-center bg-[#05070f] text-white/70 text-sm">Spinning up the globe…</div>;

// Deterministic pseudo-geo coords per country id so a nation always sits in the same spot.
function hashCoord(id: string): { lat: number; lon: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const lat = ((h % 120) - 60); // -60..60
  const lon = (((h >> 8) % 340) - 170); // -170..170
  return { lat, lon };
}

export function Domination() {
  const { state, run, toast } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doctrine, setDoctrine] = useState<'economic' | 'political' | 'soft'>('economic');

  const dom = state?.domination ?? null;

  const markers = useMemo<GlobeMarker[]>(() => {
    if (!state || !dom) return [];
    return dom.targets.map((t) => {
      const country = state.countries.find((c) => c.id === t.countryId);
      const { lat, lon } = hashCoord(t.countryId);
      return {
        countryId: t.countryId,
        name: country?.name ?? t.countryId,
        flag: country?.flag ?? '🏳️',
        influence: t.influence,
        controlled: t.controlled,
        lat, lon,
      };
    });
  }, [state, dom]);

  if (!state) return null;
  const p = state.player;

  // ---- Not launched yet ----
  if (!dom || !dom.active) {
    const eligible = canLaunchDomination(state);
    const home = state.countries.find((c) => c.isPlayerHome);
    return (
      <div>
        <SectionHeader title="🌍 World Domination" />
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          The ultimate endgame. When you're powerful enough, open a campaign to bring every nation
          on Earth under your control — projecting economic, political, and soft power across a live
          3D globe until the whole world answers to you.
        </p>
        <Card className="p-4 mb-4">
          <div className="text-xs font-bold uppercase text-slate-400 mb-2">Entry Requirements (any one)</div>
          <ul className="text-sm space-y-1">
            <li className={netWorth(state) >= 1_000_000_000 ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}>
              {netWorth(state) >= 1_000_000_000 ? '✅' : '•'} Be a billionaire — net worth {money(netWorth(state))}
            </li>
            <li className={home?.leaderId === 'player' ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}>
              {home?.leaderId === 'player' ? '✅' : '•'} Be your country's head of state
            </li>
            <li className={p.influence >= 70 ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}>
              {p.influence >= 70 ? '✅' : '•'} Reach 70 influence — you have {Math.round(p.influence)}
            </li>
          </ul>
        </Card>
        {eligible ? (
          <>
            <SectionHeader title="Choose Your Doctrine" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 px-1">Your doctrine makes one lever 50% stronger for the whole campaign.</p>
            <PillRow>
              <Pill label="💰 Economic" active={doctrine === 'economic'} onClick={() => setDoctrine('economic')} />
              <Pill label="🏛️ Political" active={doctrine === 'political'} onClick={() => setDoctrine('political')} />
              <Pill label="✨ Soft Power" active={doctrine === 'soft'} onClick={() => setDoctrine('soft')} />
            </PillRow>
            <Button className="w-full mt-3" size="lg" onClick={() => { const r = run(launchDomination, doctrine); toast(r.message, r.ok ? 'ok' : 'err'); }}>
              🌍 Launch the Campaign
            </Button>
          </>
        ) : (
          <Card className="p-4"><div className="text-sm text-slate-500 dark:text-slate-400">You're not yet powerful enough to bend nations to your will. Build wealth, take office, or grow your influence.</div></Card>
        )}
      </div>
    );
  }

  // ---- Won ----
  const controlledCount = dom.targets.filter((t) => t.controlled).length;
  const total = dom.targets.length;
  const selectedTarget = selectedId ? dom.targets.find((t) => t.countryId === selectedId) : null;
  const selectedCountry = selectedId ? state.countries.find((c) => c.id === selectedId) : null;

  return (
    <div>
      <SectionHeader title="🌍 World Domination" />

      <Card className="p-0 mb-3 overflow-hidden">
        <div className="h-72 sm:h-96 relative">
          <Suspense fallback={SceneFallback}>
            <GlobeScene markers={markers} selectedId={selectedId} onSelect={setSelectedId} />
          </Suspense>
          <div className="absolute top-2 left-2 bg-black/50 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full">
            {dom.won ? '👑 THE WORLD IS YOURS' : `${controlledCount}/${total} nations controlled`}
          </div>
          <div className="absolute bottom-2 left-2 text-[10px] text-white/60 bg-black/40 px-2 py-1 rounded-full">Drag to spin · tap a nation</div>
        </div>
      </Card>

      {dom.won && (
        <Card className="p-5 mb-3 text-center">
          <div className="text-4xl mb-2">👑🌍</div>
          <div className="font-black text-lg">Total Global Domination</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Every nation on Earth bends to your will.</div>
        </Card>
      )}

      {/* Selected nation action panel */}
      {selectedTarget && selectedCountry ? (
        <Card className="p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold">{selectedCountry.flag} {selectedCountry.name}</div>
            {selectedTarget.controlled ? <Badge tone="good">Controlled</Badge> : selectedTarget.influence >= CONTROL_THRESHOLD ? <Badge tone="brand">Ready</Badge> : <Badge tone="neutral">Contested</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <StatBar label="Your Influence" value={selectedTarget.influence} />
            <StatBar label="Hostility" value={selectedTarget.hostility} />
          </div>
          {!selectedTarget.controlled ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="soft" onClick={() => { const r = run(projectPower, selectedTarget.countryId, 'economic'); toast(r.message, r.ok ? 'ok' : 'err'); }}>💰 Economic</Button>
                <Button size="sm" variant="soft" onClick={() => { const r = run(projectPower, selectedTarget.countryId, 'political'); toast(r.message, r.ok ? 'ok' : 'err'); }}>🏛️ Political</Button>
                <Button size="sm" variant="soft" onClick={() => { const r = run(projectPower, selectedTarget.countryId, 'soft'); toast(r.message, r.ok ? 'ok' : 'err'); }}>✨ Soft</Button>
              </div>
              <Button
                className="w-full mt-2"
                disabled={selectedTarget.influence < CONTROL_THRESHOLD}
                onClick={() => { const r = run(consolidateControl, selectedTarget.countryId); toast(r.message, r.ok ? 'ok' : 'err'); }}
              >
                🚩 Consolidate Control {selectedTarget.influence < CONTROL_THRESHOLD ? `(need ${CONTROL_THRESHOLD}%)` : ''}
              </Button>
              <div className="text-[11px] text-slate-400 mt-2">
                Doctrine: {dom.doctrine} power is 50% stronger. One action per nation per year.
              </div>
            </>
          ) : (
            <div className="text-sm text-emerald-500">This nation answers to you. Keep its hostility low or it may slip free.</div>
          )}
        </Card>
      ) : (
        <Card className="p-4 mb-3"><div className="text-sm text-slate-500 dark:text-slate-400">Tap a nation on the globe to project power there.</div></Card>
      )}

      {/* Nation list (fallback / overview) */}
      <SectionHeader title="Nations" />
      <div className="space-y-2">
        {dom.targets.map((t) => {
          const c = state.countries.find((cc) => cc.id === t.countryId);
          return (
            <Card key={t.countryId} className={`p-3 flex items-center gap-3 ${selectedId === t.countryId ? 'ring-2 ring-brand-500' : ''}`} onClick={() => setSelectedId(t.countryId)}>
              <span className="text-2xl shrink-0">{c?.flag ?? '🏳️'}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{c?.name ?? t.countryId}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Influence {Math.round(t.influence)}% · hostility {Math.round(t.hostility)}</div>
              </div>
              {t.controlled ? <Badge tone="good">🚩</Badge> : t.influence >= CONTROL_THRESHOLD ? <Badge tone="brand">Ready</Badge> : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
