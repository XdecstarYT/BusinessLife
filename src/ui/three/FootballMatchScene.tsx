/**
 * A real, player-controlled 3D football match. Structured around alternating possessions rather
 * than continuous flowing play (the honest shape of the sport): every down the human's team has
 * the ball is fully interactive — call Run or Pass, then control the ball carrier in real time
 * (WASD/joystick to move, the action button doubles as a powered throw aimed at whichever
 * receiver you're facing) — while the opposing team's possessions are resolved as a quick
 * statistical drive (a banner, not a cutscene) so the human is never stuck watching an AI-only
 * possession play out. Reuses the exact movement/charge-button input pattern from
 * SoccerMatchScene. Offense is modeled with the human ball carrier plus 2 AI receivers running
 * fixed routes against 4 AI defenders (2 rushers, 2 coverage) — a skill-position-only
 * simplification (no modeled offensive/defensive line, no punts/field-goal attempts/extra points)
 * that keeps a genuinely playable down-to-down loop tractable. `durationSeconds` is spent only
 * while the human's own downs are live, so AI possessions never eat into session length. Reports
 * HUD updates and a final result back to the caller for sim/athletics.ts's resolveMatch().
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

export interface FootballMatchResult {
  homeScore: number;
  awayScore: number;
  playerTouchdowns: number;
  playerPassingYards: number;
  playerRushingYards: number;
}

export type FootballPhase = 'presnap' | 'live' | 'dead' | 'ai_drive' | 'fulltime';

export interface FootballHud {
  homeScore: number;
  awayScore: number;
  down: number;
  yardsToGo: number;
  fieldPos: number; // 0..100, yards from the human team's own goal line
  possession: 'home' | 'away';
  clockLabel: string;
  phase: FootballPhase;
  lastPlayResult: string | null;
}

interface FootballMatchSceneProps {
  homeName: string;
  awayName: string;
  homeColor: number;
  awayColor: number;
  homePrestige: number;
  awayPrestige: number;
  durationSeconds: number;
  onHud: (hud: FootballHud) => void;
  onMatchEnd: (result: FootballMatchResult) => void;
}

const HALF_W = 13;
const FIELD_LEN = 100;
const MOVE_SPEED = 6.6;
const SPRINT_MULT = 1.35;
const TACKLE_RADIUS = 1.0;
const THROW_AIR_SPEED = 22;
const CATCH_RADIUS = 1.6;
const CHARGE_MS = 700;

type Team = 'home' | 'away';

interface Entity {
  mesh: THREE.Group;
  pos: THREE.Vector2; // (x, z)
  heading: number;
  speed: number;
}

interface Receiver extends Entity {
  routeStartX: number;
  routeKind: 'slant' | 'go';
}

function makePlayer(color: number): THREE.Group {
  const g = new THREE.Group();
  const jersey = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac85, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 10), jersey);
  body.position.y = 0.62;
  g.add(body);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3, metalness: 0.3 }));
  helmet.position.y = 1.15;
  g.add(helmet);
  void skin;
  return g;
}

function fieldTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2f7d3a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1e5a28';
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.08);
  ctx.fillRect(0, canvas.height * 0.92, canvas.width, canvas.height * 0.08);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  for (let yard = 0; yard <= 100; yard += 10) {
    const y = canvas.height * 0.08 + (yard / 100) * canvas.height * 0.84;
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(canvas.width - 10, y); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Maps a 0..100 yard field position to world Z. FIELD_LEN is fixed at 100, so this is the
 * identity function today — world Z and yards are numerically interchangeable throughout this
 * file — but every yard-position computation still routes through it so that stays true even if
 * FIELD_LEN ever changes. */
function yardToZ(yard: number): number {
  return (yard / 100) * FIELD_LEN;
}

export function FootballMatchScene({ homeName, awayName, homeColor, awayColor, homePrestige, awayPrestige, durationSeconds, onHud, onMatchEnd }: FootballMatchSceneProps) {
  void homeName; void awayName;
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ x: 0, z: 0 });
  const actionRef = useRef({ held: false, holdStart: 0 });
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const chargeRingRef = useRef<HTMLDivElement>(null);
  const playCallRef = useRef<'run' | 'pass' | null>(null);
  const [showPlayCallUI, setShowPlayCallUI] = useState(false);

  useEffect(() => {
    const keys = new Set<string>();
    const apply = () => {
      let x = 0, z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      inputRef.current = { x, z };
    };
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.code); apply();
      if (e.code === 'Space' && !actionRef.current.held) actionRef.current = { held: true, holdStart: performance.now() };
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(e.code); apply();
      if (e.code === 'Space') actionRef.current.held = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const setJoyKnobStyle = (dx: number | null, dy: number | null) => {
    const el = joyKnobRef.current;
    if (!el) return;
    if (dx === null || dy === null) { el.style.left = 'calc(50% - 20px)'; el.style.top = 'calc(50% - 20px)'; el.style.transition = 'left 0.15s, top 0.15s'; return; }
    el.style.left = `calc(50% - 20px + ${dx}px)`;
    el.style.top = `calc(50% - 20px + ${dy}px)`;
    el.style.transition = 'none';
  };
  const updateJoy = (clientX: number, clientY: number) => {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const r = rect.width / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > r) { dx = (dx / dist) * r; dy = (dy / dist) * r; }
    setJoyKnobStyle(dx, dy);
    inputRef.current = { x: dx / r, z: dy / r };
  };
  const onJoyStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    joyPointerId.current = e.pointerId;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* window listeners still cover it */ }
    updateJoy(e.clientX, e.clientY);
  };
  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (joyPointerId.current === e.pointerId) updateJoy(e.clientX, e.clientY); };
    const onUp = (e: PointerEvent) => {
      if (joyPointerId.current !== e.pointerId) return;
      joyPointerId.current = null;
      setJoyKnobStyle(null, null);
      inputRef.current = { x: 0, z: 0 };
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, []);

  const onActionDown = () => { actionRef.current = { held: true, holdStart: performance.now() }; };
  const onActionUp = () => { actionRef.current.held = false; };
  const callPlay = (kind: 'run' | 'pass') => { playCallRef.current = kind; setShowPlayCallUI(false); };

  useThreeScene(
    ref,
    ({ scene, camera, quality }) => {
      const desktop = quality === 'desktop';
      scene.background = new THREE.Color(0x1a2e1f);
      scene.fog = new THREE.Fog(0x1a2e1f, 35, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xfff4e0, desktop ? 1.2 : 1.0);
      sun.position.set(10, 24, 10);
      scene.add(sun);

      const field = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 + 4, FIELD_LEN * 1.3), new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 0.95 }));
      field.rotation.x = -Math.PI / 2;
      field.position.z = FIELD_LEN / 2;
      scene.add(field);

      const qb = makePlayer(homeColor);
      scene.add(qb);
      const carrier: Entity = { mesh: qb, pos: new THREE.Vector2(0, yardToZ(20)), heading: 0, speed: MOVE_SPEED };

      const receivers: Receiver[] = [
        { mesh: makePlayer(homeColor), pos: new THREE.Vector2(-5, yardToZ(20)), heading: 0, speed: MOVE_SPEED * 0.95, routeStartX: -5, routeKind: 'slant' },
        { mesh: makePlayer(homeColor), pos: new THREE.Vector2(5, yardToZ(20)), heading: 0, speed: MOVE_SPEED * 0.95, routeStartX: 5, routeKind: 'go' },
      ];
      for (const r of receivers) scene.add(r.mesh);

      const defenders: Entity[] = Array.from({ length: 4 }, (_, i) => {
        const mesh = makePlayer(awayColor);
        scene.add(mesh);
        return { mesh, pos: new THREE.Vector2((i - 1.5) * 4, yardToZ(20) + 3), heading: Math.PI, speed: MOVE_SPEED * 0.85 };
      });

      const ballMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.24, 4, 8), new THREE.MeshStandardMaterial({ color: 0x7c3f1d, roughness: 0.5 }));
      scene.add(ballMesh);

      let homeScore = 0, awayScore = 0;
      let possession: Team = 'home';
      let losYard = 20;
      let down = 1;
      let yardsToGo = 10;
      let phase: FootballPhase = 'presnap';
      let playCall: 'run' | 'pass' | null = null;
      let playTime = 0;
      let deadTimer = 0;
      let aiTimer = 0;
      let budgetLeft = durationSeconds;
      let lastResult: string | null = null;
      let matchEnded = false;
      let playerTouchdowns = 0, playerPassingYards = 0, playerRushingYards = 0;
      let throwState: { toward: Receiver; startPos: THREE.Vector2; targetPos: THREE.Vector2; elapsed: number; duration: number } | null = null;
      let kickWasHeld = false;
      let hudAccum = 0;
      let lastUiPhase: FootballPhase | null = null;

      const rngNormal = (mean: number, std: number) => {
        let sum = 0; for (let i = 0; i < 6; i++) sum += Math.random();
        return mean + ((sum - 3) / 3) * std * 1.732;
      };

      const setupDown = () => {
        const losZ = yardToZ(losYard);
        carrier.pos.set(0, losZ - 1.5);
        carrier.heading = 0;
        receivers[0].pos.set(-5, losZ);
        receivers[1].pos.set(5, losZ);
        for (let i = 0; i < defenders.length; i++) defenders[i].pos.set((i - 1.5) * 4, losZ + 3.5);
        playTime = 0;
        throwState = null;
        phase = 'presnap';
        playCallRef.current = null;
      };

      const endMatchIfNeeded = () => {
        if (budgetLeft <= 0 && phase !== 'fulltime' && !matchEnded) {
          phase = 'fulltime';
          matchEnded = true;
          onMatchEnd({ homeScore, awayScore, playerTouchdowns, playerPassingYards, playerRushingYards });
        }
      };

      const resolvePlay = (yardsGained: number, resultText: string, isPass: boolean, touchdown = false) => {
        lastResult = resultText;
        if (isPass) playerPassingYards += Math.max(0, yardsGained);
        else playerRushingYards += Math.max(0, yardsGained);
        if (touchdown) {
          homeScore += 6;
          playerTouchdowns += 1;
          losYard = 20; down = 1; yardsToGo = 10; possession = 'away';
          phase = 'ai_drive'; aiTimer = 1.8;
        } else {
          losYard = Math.min(99, Math.max(1, losYard + yardsGained));
          if (yardsGained >= yardsToGo) { down = 1; yardsToGo = 10; }
          else { down += 1; yardsToGo -= Math.max(0, yardsGained); }
          if (down > 4) {
            lastResult = `${resultText} — turnover on downs`;
            losYard = 20; down = 1; yardsToGo = 10; possession = 'away';
            phase = 'ai_drive'; aiTimer = 1.8;
          } else {
            phase = 'dead'; deadTimer = 1.1;
          }
        }
      };

      const runAiDrive = () => {
        const diff = (awayPrestige - homePrestige) / 100;
        const roll = Math.random() + diff * 0.3;
        if (roll > 0.72) { awayScore += 6; lastResult = 'Opponent scored a touchdown.'; }
        else if (roll > 0.5) { awayScore += 3; lastResult = 'Opponent kicked a field goal.'; }
        else if (roll > 0.2) { lastResult = 'Opponent punted.'; }
        else { lastResult = 'Opponent turned the ball over — your ball!'; }
        possession = 'home';
        losYard = 20; down = 1; yardsToGo = 10;
        setupDown();
        phase = 'dead'; deadTimer = 1.2;
      };

      camera.position.set(0, 6, yardToZ(15));
      let lastT = 0;
      setupDown();

      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;
        if (matchEnded) return;

        if (phase === 'presnap') {
          if (playCallRef.current) {
            playCall = playCallRef.current;
            phase = 'live';
            playTime = 0;
          }
        } else if (phase === 'live') {
          budgetLeft -= dt;
          playTime += dt;
          endMatchIfNeeded();
        } else if (phase === 'dead') {
          deadTimer -= dt;
          if (deadTimer <= 0) setupDown();
        } else if (phase === 'ai_drive') {
          aiTimer -= dt;
          if (aiTimer <= 0) runAiDrive();
        }
        endMatchIfNeeded();

        const live = phase === 'live';

        // --- human movement (RB/QB) ---
        if (live && !throwState) {
          const { x, z } = inputRef.current;
          const mag = Math.hypot(x, z);
          const sprinting = actionRef.current.held && playCall === 'run';
          if (mag > 0.05) {
            const nx = x / Math.max(mag, 1), nz = z / Math.max(mag, 1);
            const spd = carrier.speed * (sprinting ? SPRINT_MULT : 1) * Math.min(mag, 1);
            carrier.pos.x = THREE.MathUtils.clamp(carrier.pos.x + nx * spd * dt, -HALF_W + 0.3, HALF_W - 0.3);
            carrier.pos.y += nz * spd * dt;
            const targetHeading = Math.atan2(nx, nz);
            let diff = targetHeading - carrier.heading;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            carrier.heading += diff * 0.28;
          }
        }

        // --- receivers run their routes while a pass play is live ---
        if (live && playCall === 'pass') {
          for (const r of receivers) {
            const forward = Math.min(playTime, 3) * r.speed;
            if (r.routeKind === 'go') {
              r.pos.set(r.routeStartX, carrier.pos.y - 1.5 + forward);
            } else {
              const lateral = Math.min(playTime / 1.2, 1) * (r.routeStartX > 0 ? -1 : 1) * 4;
              r.pos.set(r.routeStartX + lateral, carrier.pos.y - 1.5 + Math.min(forward, 6));
            }
          }
        }

        // --- defenders: rushers chase the ball carrier, coverage tracks receivers ---
        if (live) {
          defenders.forEach((d, i) => {
            const isRusher = i < 2;
            const target = isRusher || playCall !== 'pass' ? carrier.pos : receivers[i - 2]?.pos ?? carrier.pos;
            const toTarget = new THREE.Vector2(target.x - d.pos.x, target.y - d.pos.y);
            const dist = toTarget.length();
            if (dist > 0.2) {
              toTarget.normalize();
              d.pos.x += toTarget.x * d.speed * dt;
              d.pos.y += toTarget.y * d.speed * dt;
              d.heading = Math.atan2(toTarget.x, toTarget.y);
            }
          });
        }

        // --- tackle / sack check (only while the carrier still has the ball, no throw in flight) ---
        if (live && !throwState) {
          for (const d of defenders) {
            if (d.pos.distanceTo(carrier.pos) < TACKLE_RADIUS && Math.random() < dt * 2.0) {
              const gained = Math.round(carrier.pos.y - losYard); // world Z is numerically yards here (see yardToZ)
              const label = playCall === 'pass' ? `Sacked for ${gained >= 0 ? '+' : ''}${gained} yards` : `Tackled for ${gained >= 0 ? '+' : ''}${gained} yards`;
              resolvePlay(gained, label, false);
              break;
            }
          }
        }

        // --- run play: reaching the endzone scores; going out of bounds sideways just gets clamped ---
        if (live && phase === 'live' && !throwState) {
          const yardNow = (carrier.pos.y / FIELD_LEN) * 100;
          if (yardNow >= 100) {
            const gained = Math.round(carrier.pos.y - losYard); // world Z is numerically yards here (see yardToZ)
            resolvePlay(gained, playCall === 'pass' ? 'Scrambled in for a touchdown!' : 'Touchdown run!', false, true);
          }
        }

        // --- human throw (pass plays only) ---
        if (live && playCall === 'pass' && !throwState) {
          const held = actionRef.current.held;
          if (held && chargeRingRef.current) {
            const charge = Math.min(1, (performance.now() - actionRef.current.holdStart) / CHARGE_MS);
            chargeRingRef.current.style.background = `conic-gradient(rgba(255,255,255,0.6) ${charge * 360}deg, transparent 0deg)`;
          }
          if (!held && kickWasHeld) {
            const facing = new THREE.Vector2(Math.sin(carrier.heading), Math.cos(carrier.heading));
            let best: Receiver | null = null, bestDot = -Infinity;
            for (const r of receivers) {
              const toR = new THREE.Vector2(r.pos.x - carrier.pos.x, r.pos.y - carrier.pos.y).normalize();
              const dot = toR.dot(facing);
              if (dot > bestDot) { bestDot = dot; best = r; }
            }
            if (best) {
              const distance = carrier.pos.distanceTo(best.pos);
              throwState = { toward: best, startPos: carrier.pos.clone(), targetPos: best.pos.clone(), elapsed: 0, duration: Math.max(0.35, distance / THROW_AIR_SPEED) };
            }
            if (chargeRingRef.current) chargeRingRef.current.style.background = 'transparent';
          }
          kickWasHeld = held;
        } else {
          kickWasHeld = false;
        }

        // --- ball-in-flight resolution ---
        if (throwState) {
          throwState.elapsed += dt;
          const f = Math.min(1, throwState.elapsed / throwState.duration);
          const flightPos = throwState.startPos.clone().lerp(throwState.toward.pos, f);
          ballMesh.position.set(flightPos.x, 1.2 + Math.sin(f * Math.PI) * 1.5, flightPos.y);
          if (f >= 1) {
            let intercepted = false;
            for (const d of defenders) {
              if (d.pos.distanceTo(throwState.toward.pos) < CATCH_RADIUS * 0.8 && Math.random() < 0.4) { intercepted = true; break; }
            }
            if (intercepted) {
              resolvePlay(0, 'Intercepted!', true);
              possession = 'away';
              losYard = 20; down = 1; yardsToGo = 10;
              phase = 'ai_drive'; aiTimer = 1.6;
            } else {
              // Yards after catch: a short rng-driven burst rather than a full separate live
              // phase — keeps the down-to-down loop snappy. World Z and yards are numerically
              // interchangeable here (see yardToZ), so this arithmetic is plain yards throughout.
              const yac = Math.max(0, rngNormal(2.5, 2));
              const catchSpotYards = throwState.toward.pos.y + yac;
              const gained = Math.round(catchSpotYards - losYard);
              const touchdown = catchSpotYards >= FIELD_LEN;
              resolvePlay(gained, touchdown ? 'Touchdown pass!' : `Completed pass for ${gained >= 0 ? '+' : ''}${gained} yards`, true, touchdown);
            }
            throwState = null;
          }
        } else if (live) {
          ballMesh.position.set(carrier.pos.x, 0.9, carrier.pos.y + 0.3);
        }

        // --- apply to meshes ---
        carrier.mesh.position.set(carrier.pos.x, 0, carrier.pos.y);
        carrier.mesh.rotation.y = carrier.heading;
        for (const r of receivers) r.mesh.position.set(r.pos.x, 0, r.pos.y);
        for (const d of defenders) { d.mesh.position.set(d.pos.x, 0, d.pos.y); d.mesh.rotation.y = d.heading; }

        // --- chase camera ---
        const forward = new THREE.Vector3(Math.sin(carrier.heading), 0, Math.cos(carrier.heading));
        const desired = new THREE.Vector3(carrier.pos.x - forward.x * 6, 5.2, carrier.pos.y - forward.z * 6 - 1);
        camera.position.lerp(desired, 0.07);
        camera.lookAt(carrier.pos.x + forward.x * 4, 1, carrier.pos.y + forward.z * 4 + 3);

        // --- presnap UI toggle (edge-triggered, not per-frame state churn) ---
        if (phase !== lastUiPhase) {
          lastUiPhase = phase;
          setShowPlayCallUI(phase === 'presnap' && possession === 'home');
        }

        // --- HUD ---
        hudAccum += dt;
        if (hudAccum > 0.12 || phase === 'fulltime') {
          hudAccum = 0;
          const minutesLeft = Math.max(0, budgetLeft);
          onHud({
            homeScore, awayScore, down, yardsToGo, fieldPos: losYard, possession,
            clockLabel: phase === 'fulltime' ? 'FINAL' : `${Math.ceil(minutesLeft)}s left`,
            phase, lastPlayResult: lastResult,
          });
        }
      };
    },
    [homeColor, awayColor, homePrestige, awayPrestige, durationSeconds],
    { controls: 'none' },
  );

  return (
    <div className="relative w-full h-full bg-emerald-950 select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <div ref={ref} className="absolute inset-0" />
      {!showPlayCallUI && (
        <>
          <div
            ref={joyBaseRef}
            onPointerDown={onJoyStart}
            className="absolute left-5 bottom-5 w-24 h-24 rounded-full bg-white/10 border border-white/20 touch-none"
            style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          >
            <div ref={joyKnobRef} className="absolute w-10 h-10 rounded-full bg-white/70" style={{ left: 'calc(50% - 20px)', top: 'calc(50% - 20px)' }} />
          </div>
          <button
            onPointerDown={onActionDown}
            onPointerUp={onActionUp}
            onPointerLeave={onActionUp}
            className="absolute right-6 bottom-6 w-20 h-20 rounded-full bg-amber-400/90 border-4 border-white/60 text-white font-black active:scale-95 transition-transform"
            style={{ touchAction: 'none' }}
          >
            <div ref={chargeRingRef} className="absolute inset-0 rounded-full" />
            <span className="relative text-xs">THROW</span>
          </button>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/30 px-3 py-1 rounded-full">
            WASD/joystick to move — hold THROW and release toward a receiver on pass plays
          </div>
        </>
      )}
      {showPlayCallUI && (
        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/50">
          <button onClick={() => callPlay('run')} className="px-6 py-4 rounded-2xl bg-emerald-500 text-white font-black text-lg active:scale-95">🏃 RUN</button>
          <button onClick={() => callPlay('pass')} className="px-6 py-4 rounded-2xl bg-amber-500 text-white font-black text-lg active:scale-95">🏈 PASS</button>
        </div>
      )}
    </div>
  );
}
