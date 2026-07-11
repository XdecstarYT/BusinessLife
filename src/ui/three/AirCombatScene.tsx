/**
 * A real, player-controlled 3D air combat mission: enemy aircraft cross your forward view from
 * every direction, closing distance as they come. A 2D joystick sweeps your reticle across the
 * whole sky (unlike Ground Combat's single side-to-side aim) — line it up on a bandit and tap
 * FIRE before they pass. Miss too many and they get gun runs on you. Feeds real pilot-specialty
 * performance back into the Military career's yearly resolution (military.ts), the same
 * relationship the Athlete scenes have to resolveMatch/resolveRace.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

export interface AirCombatResult {
  hostilesEliminated: number;
  hostilesTotal: number;
  damageTaken: number; // 0..100
  survived: boolean;
}

export interface AirCombatHud {
  health: number; // 0..100
  hostilesRemaining: number;
  hostilesTotal: number;
  elapsedSeconds: number;
  phase: 'briefing' | 'active' | 'complete';
}

interface AirCombatSceneProps {
  missionName: string;
  enemyName: string;
  hostilesTotal: number;
  onHud: (hud: AirCombatHud) => void;
  onMissionEnd: (result: AirCombatResult) => void;
}

const SKY_SPREAD_X = 5.5;
const SKY_SPREAD_Y = 3;
const BOGEY_APPROACH_LEN = 60;
const BOGEY_SPEED = 5.2;
const FIRE_COOLDOWN = 0.38;
const AIM_TOLERANCE = 0.17;
const MISSION_TIME_LIMIT = 55;

function makeJet(color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 8), mat);
  fuselage.rotation.x = Math.PI / 2;
  g.add(fuselage);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.5), mat);
  wing.position.z = 0.1;
  g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.08), mat);
  tail.position.set(0, 0.15, 0.7);
  g.add(tail);
  return g;
}

function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 8; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1e3a8a');
  grad.addColorStop(0.5, '#3b82f6');
  grad.addColorStop(1, '#bfdbfe');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Bogey {
  mesh: THREE.Group;
  x: number;
  y: number;
  dist: number; // closes toward 0
  alive: boolean;
  resolved: boolean;
  speed: number;
}

export function AirCombatScene({ missionName, enemyName, hostilesTotal, onHud, onMissionEnd }: AirCombatSceneProps) {
  void missionName;
  const ref = useRef<HTMLDivElement>(null);
  const aimXRef = useRef(0);
  const aimYRef = useRef(0);
  const fireRequestedRef = useRef(false);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const [phase, setPhase] = useState<AirCombatHud['phase']>('briefing');

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') fireRequestedRef.current = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') aimXRef.current = -1;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') aimXRef.current = 1;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') aimYRef.current = 1;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') aimYRef.current = -1;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyD' || e.code === 'ArrowRight') aimXRef.current = 0;
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'ArrowDown') aimYRef.current = 0;
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
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > r) { dx = (dx / dist) * r; dy = (dy / dist) * r; }
    setJoyKnobStyle(dx, dy);
    aimXRef.current = THREE.MathUtils.clamp(dx / r, -1, 1);
    aimYRef.current = THREE.MathUtils.clamp(-dy / r, -1, 1);
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
      aimXRef.current = 0;
      aimYRef.current = 0;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, []);

  const onFire = () => { fireRequestedRef.current = true; };

  useThreeScene(
    ref,
    ({ scene, camera, quality }) => {
      const desktop = quality === 'desktop';
      scene.background = skyTexture();
      scene.fog = new THREE.Fog(0x93c5fd, 20, 70);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xfffbe8, desktop ? 1.2 : 1.0);
      sun.position.set(10, 25, -8);
      scene.add(sun);

      // A few drifting cloud puffs purely for atmosphere.
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
      const clouds: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random() * 1.5, 8, 6), cloudMat);
        c.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.3) * 10, 10 + Math.random() * 40);
        scene.add(c);
        clouds.push(c);
      }

      const player = makeJet(0x2563eb);
      player.rotation.y = Math.PI;
      player.position.set(0, 0, -2);
      scene.add(player);

      const bogeys: Bogey[] = Array.from({ length: hostilesTotal }, (_, i) => {
        const mesh = makeJet(0xb91c1c);
        const x = (Math.random() * 2 - 1) * SKY_SPREAD_X;
        const y = (Math.random() * 2 - 1) * SKY_SPREAD_Y;
        const dist = BOGEY_APPROACH_LEN - i * (BOGEY_APPROACH_LEN / hostilesTotal) * 0.8 - Math.random() * 5;
        mesh.position.set(x, y, dist);
        scene.add(mesh);
        return { mesh, x, y, dist, alive: true, resolved: false, speed: BOGEY_SPEED * (0.85 + Math.random() * 0.3) };
      });

      let health = 100;
      let elapsed = 0;
      let fireCooldown = 0;
      let eliminated = 0;
      let briefingTimer = 1.6;
      let localPhase: AirCombatHud['phase'] = 'briefing';
      let missionEnded = false;
      let hudAccum = 0;

      let lastT = 0;
      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;
        if (missionEnded) return;
        if (localPhase === 'briefing') {
          briefingTimer -= dt;
          if (briefingTimer <= 0) { localPhase = 'active'; setPhase('active'); }
        }

        for (const c of clouds) c.position.z -= dt * 1.5;

        if (localPhase === 'active') {
          elapsed += dt;
          fireCooldown = Math.max(0, fireCooldown - dt);

          for (const b of bogeys) {
            if (b.resolved) continue;
            b.dist = Math.max(-1, b.dist - b.speed * dt);
            b.mesh.position.set(b.x, b.y, b.dist);
            b.mesh.lookAt(player.position);
            if (b.dist <= 1) {
              b.resolved = true;
              b.alive = false;
              b.mesh.visible = false;
              health = Math.max(0, health - THREE.MathUtils.randFloat(14, 24));
            }
          }

          if (fireRequestedRef.current && fireCooldown <= 0) {
            fireRequestedRef.current = false;
            fireCooldown = FIRE_COOLDOWN;
            let best: Bogey | null = null;
            let bestDelta = Infinity;
            for (const b of bogeys) {
              if (b.resolved || !b.alive) continue;
              const screenX = THREE.MathUtils.clamp(b.x / SKY_SPREAD_X, -1, 1);
              const screenY = THREE.MathUtils.clamp(b.y / SKY_SPREAD_Y, -1, 1);
              const delta = Math.hypot(screenX - aimXRef.current, screenY - aimYRef.current);
              if (delta < AIM_TOLERANCE && delta < bestDelta) { best = b; bestDelta = delta; }
            }
            if (best) {
              best.resolved = true;
              best.alive = false;
              best.mesh.visible = false;
              eliminated++;
            }
          }

          const allResolved = bogeys.every((b) => b.resolved);
          if (allResolved || elapsed >= MISSION_TIME_LIMIT || health <= 0) {
            localPhase = 'complete';
            setPhase('complete');
          }
        }

        if (localPhase === 'complete' && !missionEnded) {
          missionEnded = true;
          onMissionEnd({ hostilesEliminated: eliminated, hostilesTotal, damageTaken: 100 - health, survived: health > 0 });
        }

        player.rotation.z = -aimXRef.current * 0.5;
        player.rotation.x = aimYRef.current * 0.3;
        camera.position.set(aimXRef.current * -0.4, 1.4 + aimYRef.current * -0.4, -4.5);
        camera.lookAt(aimXRef.current * SKY_SPREAD_X * 0.9, 1 + aimYRef.current * SKY_SPREAD_Y * 0.9, 16);

        hudAccum += dt;
        if (hudAccum > 0.1 || localPhase === 'complete') {
          hudAccum = 0;
          onHud({ health, hostilesRemaining: bogeys.filter((b) => !b.resolved).length, hostilesTotal, elapsedSeconds: elapsed, phase: localPhase });
        }
      };
    },
    [hostilesTotal],
    { controls: 'none' },
  );

  return (
    <div className="relative w-full h-full bg-sky-400 select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <div ref={ref} className="absolute inset-0" />
      {phase === 'active' && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 border-2 border-rose-500/90 rounded-full pointer-events-none" />
          <div
            ref={joyBaseRef}
            onPointerDown={onJoyStart}
            className="absolute left-5 bottom-5 w-24 h-24 rounded-full bg-black/15 border border-white/30 touch-none"
            style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          >
            <div ref={joyKnobRef} className="absolute w-10 h-10 rounded-full bg-white/80" style={{ left: 'calc(50% - 20px)', top: 'calc(50% - 20px)' }} />
          </div>
          <button
            onPointerDown={onFire}
            className="absolute right-6 bottom-6 w-20 h-20 rounded-full bg-rose-500/90 border-4 border-white/60 text-white font-black active:scale-95 transition-transform"
            style={{ touchAction: 'none' }}
          >
            FIRE
          </button>
        </>
      )}
      {phase === 'briefing' && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="text-white text-center bg-black/50 px-6 py-5 rounded-2xl">
            <div className="text-2xl font-black mb-1">Intercepting {enemyName} aircraft</div>
            <div className="text-sm text-white/70">Sweep the stick to aim across the whole sky, tap FIRE on a lock.</div>
          </div>
        </div>
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white bg-black/30 px-3 py-1 rounded-full">
        Aim in any direction — bandits close fast, so track and fire before they pass
      </div>
    </div>
  );
}
