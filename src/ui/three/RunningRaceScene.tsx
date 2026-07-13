/**
 * A real, player-controlled 3D running race: hold the action button to sprint (drains a stamina
 * meter), release to conserve it — the actual skill of the sport, since sprinting flat-out the
 * whole way gasses you out before the line. WASD/joystick nudges you between lanes for a bit of
 * agency, but the core loop is pacing. Races AI competitors visually for real stakes/excitement,
 * but since no one can meaningfully "play" a literal 9.58-second 100m sprint with any skill
 * expression, the scene measures how well you paced the run (finishing pace relative to an
 * expected real-time budget for the event's tier) and maps that performance onto a realistic
 * finish time for the actual event — which is what gets handed to sim/athletics.ts's
 * resolveRace() to rank against its own field of generated competitor times. This scene's visible
 * AI pack is for feel/excitement only, not the authoritative result.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

export type RaceTier = 'sprint' | 'middle' | 'distance';

export interface RunningRaceResult {
  finalTimeSeconds: number;
  visualPlace: number;
  fieldSize: number;
}

export interface RunningHud {
  distanceFrac: number; // 0..1 progress along the track
  stamina: number; // 0..1
  place: number;
  fieldSize: number;
  elapsedSeconds: number;
  phase: 'countdown' | 'racing' | 'finished';
}

interface RunningRaceSceneProps {
  eventName: string;
  tier: RaceTier;
  worldRecordSeconds: number;
  fieldSize: number;
  onHud: (hud: RunningHud) => void;
  onRaceEnd: (result: RunningRaceResult) => void;
}

const TRACK_LEN_BY_TIER: Record<RaceTier, number> = { sprint: 50, middle: 78, distance: 115 };
const EXPECTED_SECONDS_BY_TIER: Record<RaceTier, number> = { sprint: 7, middle: 12, distance: 18 };
// Balanced so smart bursts (sprint, then let stamina recover, repeat) beat both never sprinting
// and spamming sprint until you gas out — base pace alone falls short of "expected" pace, naive
// sprint-the-whole-way outruns it but not by much once the gassed-out penalty eats in, and
// bursting rhythmically comes out clearly ahead. See the file header for the scoring model.
const BASE_SPEED = 6.0;
const SPRINT_MULT = 1.8;
const LANE_WIDTH = 1.6;

function makeRunner(color: number): THREE.Group {
  const g = new THREE.Group();
  const jersey = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac85, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 10), jersey);
  body.position.y = 0.55;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
  head.position.y = 1.0;
  g.add(head);
  return g;
}

function trackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#a8492f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const x = (canvas.width / 6) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

export function RunningRaceScene({ eventName, tier, worldRecordSeconds, fieldSize, onHud, onRaceEnd }: RunningRaceSceneProps) {
  void eventName;
  const ref = useRef<HTMLDivElement>(null);
  const actionRef = useRef({ held: false });
  const laneInputRef = useRef(0);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const [phase, setPhase] = useState<'countdown' | 'racing' | 'finished'>('countdown');

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') actionRef.current.held = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') laneInputRef.current = -1;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') laneInputRef.current = 1;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') actionRef.current.held = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyD' || e.code === 'ArrowRight') laneInputRef.current = 0;
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
    let dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > r) dx = (dx / dist) * r;
    setJoyKnobStyle(dx, 0);
    laneInputRef.current = THREE.MathUtils.clamp(dx / r, -1, 1);
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
      laneInputRef.current = 0;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, []);

  const onSprintDown = () => { actionRef.current.held = true; };
  const onSprintUp = () => { actionRef.current.held = false; };

  useThreeScene(
    ref,
    ({ scene, camera, quality }) => {
      const desktop = quality === 'desktop';
      const trackLen = TRACK_LEN_BY_TIER[tier];
      const lanes = Math.max(4, Math.min(8, fieldSize));
      const trackWidth = lanes * LANE_WIDTH;

      scene.background = new THREE.Color(0x1e293b);
      scene.fog = new THREE.Fog(0x1e293b, 40, 90);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const sun = new THREE.DirectionalLight(0xfff4e0, desktop ? 1.2 : 1.0);
      sun.position.set(8, 20, 10);
      scene.add(sun);

      const track = new THREE.Mesh(new THREE.PlaneGeometry(trackWidth, trackLen + 20), new THREE.MeshStandardMaterial({ map: trackTexture(), roughness: 0.9 }));
      track.rotation.x = -Math.PI / 2;
      track.position.set(0, 0, trackLen / 2);
      scene.add(track);

      const finishBanner = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x334155, emissiveIntensity: 0.4 }));
      finishBanner.position.set(0, 2.2, trackLen);
      scene.add(finishBanner);

      const laneX = (i: number) => (i - (lanes - 1) / 2) * LANE_WIDTH;
      const humanLane = Math.floor(lanes / 2);
      const runners = Array.from({ length: lanes }, (_, i) => {
        const isHuman = i === humanLane;
        const mesh = makeRunner(isHuman ? 0x2563eb : 0x64748b);
        mesh.position.set(laneX(i), 0, 0);
        scene.add(mesh);
        return {
          mesh, isHuman,
          z: 0,
          laneOffset: laneX(i),
          targetSeconds: EXPECTED_SECONDS_BY_TIER[tier] * (0.92 + Math.random() * 0.22),
        };
      });
      const human = runners[humanLane];

      let stamina = 1;
      let elapsed = 0;
      let countdown = 1.4;
      let localPhase: RunningHud['phase'] = 'countdown';
      let matchEnded = false;
      let hudAccum = 0;

      camera.position.set(0, 4, -3);

      let lastT = 0;
      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;
        if (matchEnded) return;

        if (localPhase === 'countdown') {
          countdown -= dt;
          if (countdown <= 0) { localPhase = 'racing'; setPhase('racing'); }
        } else if (localPhase === 'racing') {
          elapsed += dt;

          // human runner
          const sprinting = actionRef.current.held && stamina > 0.03;
          const speed = BASE_SPEED * (sprinting ? SPRINT_MULT : 1) * (stamina < 0.05 ? 0.6 : 1);
          human.z = Math.min(trackLen, human.z + speed * dt);
          stamina = sprinting ? Math.max(0, stamina - dt * 0.28) : Math.min(1, stamina + dt * 0.22);
          human.laneOffset = THREE.MathUtils.clamp(human.laneOffset + laneInputRef.current * 2.2 * dt, laneX(0), laneX(lanes - 1));

          // AI pack: paced toward their own target finish time with light rng wobble
          for (const r of runners) {
            if (r.isHuman) continue;
            const targetSpeed = trackLen / r.targetSeconds;
            r.z = Math.min(trackLen, r.z + targetSpeed * (0.92 + Math.random() * 0.16) * dt);
          }

          if (human.z >= trackLen) {
            localPhase = 'finished';
            setPhase('finished');
          }
        }

        if (localPhase === 'finished' && !matchEnded) {
          matchEnded = true;
          const place = 1 + runners.filter((r) => !r.isHuman && r.z >= human.z).length;
          const expected = EXPECTED_SECONDS_BY_TIER[tier];
          const performanceRatio = THREE.MathUtils.clamp(expected / Math.max(0.5, elapsed), 0.55, 1.25);
          const wrMultiplier = THREE.MathUtils.clamp(1.32 - performanceRatio * 0.22, 1.02, 1.4);
          const finalTimeSeconds = worldRecordSeconds * wrMultiplier;
          onRaceEnd({ finalTimeSeconds, visualPlace: place, fieldSize: lanes });
        }

        for (const r of runners) r.mesh.position.set(r.laneOffset, 0, r.z);

        const camZ = human.z - 4;
        camera.position.lerp(new THREE.Vector3(human.laneOffset * 0.4, 3.8, camZ), 0.08);
        camera.lookAt(human.laneOffset, 1, human.z + 6);

        hudAccum += dt;
        if (hudAccum > 0.1 || localPhase === 'finished') {
          hudAccum = 0;
          const place = 1 + runners.filter((r) => !r.isHuman && r.z > human.z).length;
          onHud({ distanceFrac: human.z / trackLen, stamina, place, fieldSize: lanes, elapsedSeconds: elapsed, phase: localPhase });
        }
      };
    },
    [tier, worldRecordSeconds, fieldSize],
    { controls: 'none' },
  );

  return (
    <div className="relative w-full h-full bg-slate-900 select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <div ref={ref} className="absolute inset-0" />
      {phase === 'racing' && (
        <>
          <div
            ref={joyBaseRef}
            onPointerDown={onJoyStart}
            className="absolute left-5 bottom-5 w-24 h-16 rounded-full bg-white/10 border border-white/20 touch-none"
            style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          >
            <div ref={joyKnobRef} className="absolute w-10 h-10 rounded-full bg-white/70" style={{ left: 'calc(50% - 20px)', top: 'calc(50% - 20px)' }} />
          </div>
          <button
            onPointerDown={onSprintDown}
            onPointerUp={onSprintUp}
            onPointerLeave={onSprintUp}
            className="absolute right-6 bottom-6 w-20 h-20 rounded-full bg-sky-400/90 border-4 border-white/60 text-white font-black active:scale-95 transition-transform"
            style={{ touchAction: 'none' }}
          >
            SPRINT
          </button>
        </>
      )}
      {phase === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-4xl font-black bg-black/40 px-8 py-4 rounded-2xl">On your marks…</div>
        </div>
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/30 px-3 py-1 rounded-full">
        Hold SPRINT to push the pace — but it drains your stamina, so pace yourself
      </div>
    </div>
  );
}
