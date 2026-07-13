/**
 * Aviation Career hub: flight school → first officer → airline captain. The signature action is
 * flying a real route, which takes over the screen with the playable 3D FlightScene minigame
 * (fullscreen, landscape-locked on mobile) exactly like Athlete.tsx's match/race engines — the
 * flight's performance score feeds sim/aviation.ts's runFlight().
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  addTypeRating, earnLicense, enrollFlightSchool, retireFromAviation, runFlight, selectAircraft, seekCaptainPromotion,
} from '../../sim/aviation';
import {
  AIRCRAFT, AIRCRAFT_BY_ID, CAPTAIN_RANK_TITLES, PILOT_LICENSES, PILOT_LICENSE_BY_ID, ROUTES, licenseRank,
} from '../../data/aviation';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';
import type { FlightHud, FlightResult } from '../three/FlightScene';

const FlightScene = lazy(() => import('../three/FlightScene').then((m) => ({ default: m.FlightScene })));
const SceneFallback = <div className="absolute inset-0 grid place-items-center bg-sky-400 text-white font-semibold">Preparing the flight deck…</div>;

export function Aviation() {
  const { state, run, toast } = useGame();
  const [routeId, setRouteId] = useState('short_hop');
  const [flying, setFlying] = useState(false);
  const [hud, setHud] = useState<FlightHud | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches);
  const fsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = () => setIsPortrait(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  useEffect(() => {
    if (!flying) return;
    setFullscreen(true);
    const el = fsRef.current;
    Promise.resolve(el?.requestFullscreen?.())
      .then(() => (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation?.lock?.('landscape'))
      .catch(() => {});
  }, [flying]);

  const exitFlight = () => {
    setFullscreen(false);
    try { (screen as unknown as { orientation?: { unlock?: () => void } }).orientation?.unlock?.(); } catch { /* unsupported */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setFlying(false);
    setHud(null);
  };

  if (!state) return null;
  const p = state.player;
  const c = p.aviation;

  // ---- Fullscreen playable flight ----
  if (flying && c) {
    const ac = c.aircraftId ? AIRCRAFT_BY_ID[c.aircraftId] : AIRCRAFT_BY_ID.cessna172;
    return (
      <div ref={fsRef} className="fixed inset-0 z-[90] bg-black">
        <div className="absolute inset-0">
          <Suspense fallback={SceneFallback}>
            <FlightScene
              aircraftName={ac.name}
              difficulty={ac.difficulty}
              onHud={setHud}
              onComplete={(result: FlightResult) => {
                const r = run(runFlight, routeId, result.score);
                toast(`${Math.round(result.score * 100)}% flight — ${result.ringsHit}/${result.ringsTotal} rings. ${r.message}`, r.ok ? 'ok' : 'err');
                exitFlight();
              }}
            />
          </Suspense>
        </div>
        <button
          onClick={exitFlight}
          className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] right-[calc(0.5rem+env(safe-area-inset-right))] bg-black/60 hover:bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur transition-colors z-10"
        >
          ✕ Abort
        </button>
        {fullscreen && isPortrait && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none px-8 z-10">
            <div className="text-center text-white">
              <div className="text-4xl mb-2 animate-pulse">🔄</div>
              <div className="text-sm font-semibold">Rotate your device for the best view</div>
            </div>
          </div>
        )}
        {hud && (
          <div className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-xs font-bold px-4 py-1.5 rounded-full z-10">
            ✈️ {hud.ringsHit}/{hud.ringsTotal} rings · {Math.round(hud.altitude)}ft · {hud.phase}
          </div>
        )}
      </div>
    );
  }

  // ---- Not started ----
  if (!c || !c.active) {
    return (
      <div>
        <SectionHeader title="✈️ Aviation Career" />
        {c?.stage === 'retired' && (
          <Card className="p-4 mb-4">
            <div className="text-xs text-slate-400 uppercase font-bold">Retired Pilot</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {c.flightsCompleted} flights · {Math.floor(c.hoursLogged)} hours logged
            </div>
          </Card>
        )}
        {c?.licenseSuspended && <Card className="p-4 mb-4"><Badge tone="bad">License Suspended</Badge></Card>}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Start in a Cessna trainer and log the hours toward your Private, Commercial, and Airline
          Transport licenses — each one unlocks bigger aircraft and a shot at the left seat. Fly your
          routes yourself in a real 3D cockpit: thread the waypoint rings and grease the landing to
          fly clean. Three safety incidents, though, and you're grounded for good.
        </p>
        <Button className="w-full" size="lg" onClick={() => run(enrollFlightSchool)}>
          🛩️ Enroll in Flight School
        </Button>
      </div>
    );
  }

  const nextLicIdx = licenseRank(c.licenseId) + 1;
  const nextLicense = nextLicIdx < PILOT_LICENSES.length ? PILOT_LICENSES[nextLicIdx] : null;
  const heldLicense = c.licenseId ? PILOT_LICENSE_BY_ID[c.licenseId] : null;
  const currentAircraft = c.aircraftId ? AIRCRAFT_BY_ID[c.aircraftId] : AIRCRAFT_BY_ID.cessna172;
  const canFly = c.stage !== 'flight_school' || (c.licenseId === 'ppl');
  const stageLabel = c.stage === 'flight_school' ? '🎓 Student Pilot' : c.stage === 'first_officer' ? '🧑‍✈️ First Officer' : `👨‍✈️ ${CAPTAIN_RANK_TITLES[c.rank]}`;

  return (
    <div>
      <SectionHeader title={stageLabel} />
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">
              {c.airlineName ? c.airlineName : 'Flight Training'} · {currentAircraft.icon} {currentAircraft.name}
            </div>
            <div className="font-extrabold text-lg">{heldLicense ? heldLicense.short : 'No License Yet'}</div>
          </div>
          {c.incidents > 0 && <Badge tone="bad">⚠️ {c.incidents}/3</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Piloting Skill" value={c.skill} />
          <StatBar label="Safety Rating" value={c.safetyRating} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {Math.floor(c.hoursLogged)} hours logged · {c.flightsCompleted} flights flown
        </div>
      </Card>

      {/* Flying */}
      {canFly && (
        <>
          <SectionHeader title="Fly a Route" />
          <PillRow>
            {ROUTES.map((r) => (
              <Pill key={r.id} label={`${r.name} · ${r.hours}h`} active={routeId === r.id} onClick={() => setRouteId(r.id)} />
            ))}
          </PillRow>
          <Card className="p-4 mt-2">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Flying the {currentAircraft.icon} {currentAircraft.name} — difficulty {currentAircraft.difficulty}/100. A sharp flight
              logs hours, pays block time, and keeps your safety record clean.
            </div>
            <Button className="w-full" size="lg" onClick={() => setFlying(true)}>🕹️ Fly the Route in 3D</Button>
          </Card>
        </>
      )}

      {/* Licenses */}
      <SectionHeader title="Licenses & Ratings" />
      {nextLicense ? (
        <Card className="p-4 mb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-sm">{nextLicense.name} ({nextLicense.short})</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {nextLicense.description} · needs {nextLicense.hoursRequired}h · {money(nextLicense.cost)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                You have {Math.floor(c.hoursLogged)}h {c.hoursLogged >= nextLicense.hoursRequired ? '✅' : `(need ${Math.ceil(nextLicense.hoursRequired - c.hoursLogged)} more)`}
              </div>
            </div>
            <Button size="sm" disabled={c.hoursLogged < nextLicense.hoursRequired} onClick={() => run(earnLicense)}>Test</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 mb-2"><div className="text-sm text-slate-500 dark:text-slate-400">You hold the highest license there is — ATPL. ✈️</div></Card>
      )}

      {/* Type ratings */}
      <SectionHeader title="Aircraft" />
      <div className="space-y-2">
        {AIRCRAFT.map((ac) => {
          const held = c.typeRatings.includes(ac.id);
          const licenseOk = licenseRank(c.licenseId) >= licenseRank(ac.minLicense);
          const isCurrent = c.aircraftId === ac.id;
          return (
            <Card key={ac.id} className={`p-3 flex items-center gap-3 ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}>
              <span className="text-2xl shrink-0">{ac.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{ac.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {ac.seats} seats · needs {PILOT_LICENSE_BY_ID[ac.minLicense].short}{ac.typeRatingCost > 0 ? ` · rating ${money(ac.typeRatingCost)}` : ' · included'}
                </div>
              </div>
              {held ? (
                isCurrent ? <Badge tone="brand">Flying</Badge> : <Button size="sm" variant="soft" onClick={() => run(selectAircraft, ac.id)}>Fly</Button>
              ) : (
                <Button size="sm" disabled={!licenseOk} onClick={() => run(addTypeRating, ac.id)}>Rate</Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Captain promotion */}
      {c.stage === 'captain' && c.rank < CAPTAIN_RANK_TITLES.length - 1 && (
        <>
          <SectionHeader title="Advancement" />
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
                Bid for the next captain rank — {CAPTAIN_RANK_TITLES[c.rank + 1]}. Driven by your skill and safety record.
              </div>
              <Button size="sm" onClick={() => run(seekCaptainPromotion)}>📈 Bid</Button>
            </div>
          </Card>
        </>
      )}

      <SectionHeader title="Exit" />
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">Hang up your wings for good.</div>
          <Button size="sm" variant="danger" onClick={() => run(retireFromAviation)}>🚪 Retire</Button>
        </div>
      </Card>
    </div>
  );
}
