/**
 * A real, player-controlled 3D ground combat mission: hostiles advance toward your position from
 * the far end of a battlefield, and you sweep a horizontal reticle (WASD/joystick) to line up
 * shots and tap FIRE to engage them before they close the distance. Aim precisely and you clear
 * the wave clean; fire wild or freeze up and hostiles reach you, costing health. This is the
 * playable counterpart to the Military career's yearly combat-mission resolution (military.ts) —
 * a strong run here feeds real bonuses back into the sim (combat skill, medal odds, fewer/less
 * severe injuries), same relationship as the Athlete scenes have to resolveMatch/resolveRace.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';
import type { WarTerrain } from '../../data/military';

const TERRAIN_PALETTE: Record<WarTerrain, { bg: number; fog: number; groundBase: string; groundSpeck: string; cover: number; sun: number }> = {
  desert: { bg: 0x8a6a3c, fog: 0x9c7c4e, groundBase: '#b89a5f', groundSpeck: 'rgba(70,50,15,0.12)', cover: 0x8a6f42, sun: 0xfff2d0 },
  urban: { bg: 0x2b2416, fog: 0x4a4530, groundBase: '#5c5340', groundSpeck: 'rgba(0,0,0,0.08)', cover: 0x4b463a, sun: 0xfff0d0 },
  jungle: { bg: 0x203318, fog: 0x2e4a22, groundBase: '#3c5230', groundSpeck: 'rgba(10,30,5,0.18)', cover: 0x2c4520, sun: 0xd9ffcf },
  arctic: { bg: 0xc9dbe8, fog: 0xd8e6ef, groundBase: '#e4edf2', groundSpeck: 'rgba(120,140,155,0.15)', cover: 0xb9c9d4, sun: 0xffffff },
};

export interface GroundCombatResult {
  hostilesEliminated: number;
  hostilesTotal: number;
  damageTaken: number; // 0..100
  survived: boolean;
}

export interface GroundCombatHud {
  health: number; // 0..100
  hostilesRemaining: number;
  hostilesTotal: number;
  elapsedSeconds: number;
  phase: 'briefing' | 'active' | 'complete';
}

interface GroundCombatSceneProps {
  missionName: string;
  enemyName: string;
  hostilesTotal: number;
  terrain?: WarTerrain;
  onHud: (hud: GroundCombatHud) => void;
  onMissionEnd: (result: GroundCombatResult) => void;
}

const BATTLEFIELD_LEN = 55;
const SPREAD = 3.4; // world-x range hostiles can spawn across
const HOSTILE_SPEED = 3.6;
const FIRE_COOLDOWN = 0.42;
const AIM_TOLERANCE = 0.16; // in -1..1 aim-space
const MISSION_TIME_LIMIT = 55;

function makeSoldier(color: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const uniform = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5c, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, height, 4, 10), uniform);
  body.position.y = height / 2 + 0.24;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = height + 0.5;
  g.add(head);
  return g;
}

function groundTexture(baseColor: string, speckColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = speckColor;
  for (let i = 0; i < 400; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 12);
  return tex;
}

interface Hostile {
  mesh: THREE.Group;
  x: number; // world x, spawn position (fixed per hostile)
  z: number; // world z, closes toward 0
  alive: boolean;
  resolved: boolean; // eliminated or breached
  speed: number;
}

export function GroundCombatScene({ missionName, enemyName, hostilesTotal, terrain = 'urban', onHud, onMissionEnd }: GroundCombatSceneProps) {
  void missionName;
  const palette = TERRAIN_PALETTE[terrain];
  const ref = useRef<HTMLDivElement>(null);
  const aimRef = useRef(0); // -1..1
  const fireRequestedRef = useRef(false);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const [phase, setPhase] = useState<GroundCombatHud['phase']>('briefing');

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') fireRequestedRef.current = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') aimRef.current = -1;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') aimRef.current = 1;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyD' || e.code === 'ArrowRight') aimRef.current = 0;
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
    const dist = Math.hypot(dx, clientY - cy);
    if (dist > r) dx = (dx / dist) * r;
    setJoyKnobStyle(dx, 0);
    aimRef.current = THREE.MathUtils.clamp(dx / r, -1, 1);
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
      aimRef.current = 0;
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
      scene.background = new THREE.Color(palette.bg);
      scene.fog = new THREE.Fog(palette.fog, 25, 65);
      scene.add(new THREE.AmbientLight(0xffe8c0, 0.55));
      const sun = new THREE.DirectionalLight(palette.sun, desktop ? 1.1 : 0.9);
      sun.position.set(10, 22, -5);
      scene.add(sun);

      const ground = new THREE.Mesh(new THREE.PlaneGeometry(SPREAD * 3.2, BATTLEFIELD_LEN + 10), new THREE.MeshStandardMaterial({ map: groundTexture(palette.groundBase, palette.groundSpeck), roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, 0, BATTLEFIELD_LEN / 2);
      scene.add(ground);

      // Scattered cover blocks purely for atmosphere.
      const coverMat = new THREE.MeshStandardMaterial({ color: palette.cover, roughness: 0.95 });
      for (let i = 0; i < 10; i++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2 + Math.random(), 0.8 + Math.random() * 0.6, 1), coverMat);
        box.position.set((Math.random() - 0.5) * SPREAD * 3, 0.4, 8 + Math.random() * (BATTLEFIELD_LEN - 12));
        scene.add(box);
      }

      const player = makeSoldier(0x2563eb, 0.9);
      player.position.set(0, 0, 0);
      scene.add(player);

      const hostileMat = 0xb91c1c;
      const hostiles: Hostile[] = Array.from({ length: hostilesTotal }, (_, i) => {
        const mesh = makeSoldier(hostileMat, 0.85);
        const x = (Math.random() * 2 - 1) * SPREAD;
        const z = BATTLEFIELD_LEN - i * (BATTLEFIELD_LEN / hostilesTotal) * 0.85 - Math.random() * 4;
        mesh.position.set(x, 0, z);
        scene.add(mesh);
        return { mesh, x, z, alive: true, resolved: false, speed: HOSTILE_SPEED * (0.85 + Math.random() * 0.3) };
      });

      let health = 100;
      let elapsed = 0;
      let fireCooldown = 0;
      let eliminated = 0;
      let briefingTimer = 1.6;
      let localPhase: GroundCombatHud['phase'] = 'briefing';
      let missionEnded = false;
      let hudAccum = 0;

      camera.position.set(0, 2.2, -3.5);

      let lastT = 0;
      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;
        if (missionEnded) return;
        if (localPhase === 'briefing') {
          briefingTimer -= dt;
          if (briefingTimer <= 0) { localPhase = 'active'; setPhase('active'); }
        }

        if (localPhase === 'active') {
          elapsed += dt;
          fireCooldown = Math.max(0, fireCooldown - dt);

          for (const h of hostiles) {
            if (h.resolved) continue;
            h.z = Math.max(-1, h.z - h.speed * dt);
            h.mesh.position.set(h.x, 0, h.z);
            if (h.z <= 0.5) {
              h.resolved = true;
              h.alive = false;
              h.mesh.visible = false;
              health = Math.max(0, health - THREE.MathUtils.randFloat(12, 22));
            }
          }

          if (fireRequestedRef.current && fireCooldown <= 0) {
            fireRequestedRef.current = false;
            fireCooldown = FIRE_COOLDOWN;
            let best: Hostile | null = null;
            let bestDelta = Infinity;
            for (const h of hostiles) {
              if (h.resolved || !h.alive) continue;
              const screenX = THREE.MathUtils.clamp(h.x / SPREAD, -1, 1);
              const delta = Math.abs(screenX - aimRef.current);
              if (delta < AIM_TOLERANCE && delta < bestDelta) { best = h; bestDelta = delta; }
            }
            if (best) {
              best.resolved = true;
              best.alive = false;
              best.mesh.visible = false;
              eliminated++;
            }
          }

          const allResolved = hostiles.every((h) => h.resolved);
          if (allResolved || elapsed >= MISSION_TIME_LIMIT || health <= 0) {
            localPhase = 'complete';
            setPhase('complete');
          }
        }

        if (localPhase === 'complete' && !missionEnded) {
          missionEnded = true;
          onMissionEnd({ hostilesEliminated: eliminated, hostilesTotal, damageTaken: 100 - health, survived: health > 0 });
        }

        camera.position.lerp(new THREE.Vector3(aimRef.current * 0.6, 2.2, -3.5), 0.06);
        camera.lookAt(aimRef.current * SPREAD * 0.9, 1, 14);

        hudAccum += dt;
        if (hudAccum > 0.1 || localPhase === 'complete') {
          hudAccum = 0;
          onHud({ health, hostilesRemaining: hostiles.filter((h) => !h.resolved).length, hostilesTotal, elapsedSeconds: elapsed, phase: localPhase });
        }
      };
    },
    [hostilesTotal, terrain],
    { controls: 'none' },
  );

  return (
    <div className="relative w-full h-full bg-slate-900 select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <div ref={ref} className="absolute inset-0" />
      {phase === 'active' && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-rose-400/80 rounded-full pointer-events-none" />
          <div
            ref={joyBaseRef}
            onPointerDown={onJoyStart}
            className="absolute left-5 bottom-5 w-24 h-16 rounded-full bg-white/10 border border-white/20 touch-none"
            style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          >
            <div ref={joyKnobRef} className="absolute w-10 h-10 rounded-full bg-white/70" style={{ left: 'calc(50% - 20px)', top: 'calc(50% - 20px)' }} />
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
            <div className="text-2xl font-black mb-1">Engaging {enemyName} forces</div>
            <div className="text-sm text-white/70">Aim with the stick, tap FIRE when a hostile is centered.</div>
          </div>
        </div>
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/30 px-3 py-1 rounded-full">
        Line up the reticle on a hostile before they close the distance
      </div>
    </div>
  );
}
