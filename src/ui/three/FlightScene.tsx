/**
 * A real, player-controlled 3D flight leg: take off, thread a course of waypoint rings strung
 * through the sky, then descend into a landing box on the far runway. You steer a two-axis
 * joystick (or WASD) to pitch/bank the aircraft; the plane flies forward on its own at a steady
 * cruise, so the skill is precise 3D navigation — lining the nose up with the next ring and
 * settling gently into the landing zone rather than barrelling through it.
 *
 * The scene reports a 0..1 performance score = 0.75 * (rings hit / total) + 0.25 * landing quality,
 * handed to sim/aviation.ts's runFlight() to resolve the year's leg (hours logged, block pay, and
 * the safety-incident roll). Same "playable minigame feeds a real sim bonus" pattern as
 * RunningRaceScene / KitchenServiceScene / CourtroomScene.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

export interface FlightResult {
  score: number; // 0..1 overall performance
  ringsHit: number;
  ringsTotal: number;
  landingQuality: number; // 0..1
}

export interface FlightHud {
  phase: 'takeoff' | 'cruise' | 'landing' | 'done';
  ringsHit: number;
  ringsTotal: number;
  altitude: number;
  speed: number;
  distanceFrac: number;
}

interface FlightSceneProps {
  aircraftName: string;
  difficulty: number; // 0..100, scales course length and ring tightness
  onHud: (hud: FlightHud) => void;
  onComplete: (result: FlightResult) => void;
}

function makeAircraft(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x5150d6, roughness: 0.4, metalness: 0.3, emissive: 0x2c2b81, emissiveIntensity: 0.3 });
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.7, 6, 12), bodyMat);
  fuselage.rotation.z = Math.PI / 2;
  g.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 12), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.5;
  g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 3.6), accentMat);
  g.add(wing);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 1.4), accentMat);
  tailWing.position.set(-1.2, 0, 0);
  g.add(tailWing);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.06), accentMat);
  tailFin.position.set(-1.2, 0.3, 0);
  g.add(tailFin);
  // face the aircraft down +Z (its flight direction) — model built along +X, so yaw it 90°.
  g.rotation.y = -Math.PI / 2;
  return g;
}

export function FlightScene({ aircraftName, difficulty, onHud, onComplete }: FlightSceneProps) {
  void aircraftName;
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ x: 0, y: 0 }); // -1..1 steering
  const throttleRef = useRef(false);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const [phase, setPhase] = useState<FlightHud['phase']>('takeoff');

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') inputRef.current.y = -1;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') inputRef.current.y = 1;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputRef.current.x = -1;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') inputRef.current.x = 1;
      if (e.code === 'Space') throttleRef.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'ArrowDown') inputRef.current.y = 0;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyD' || e.code === 'ArrowRight') inputRef.current.x = 0;
      if (e.code === 'Space') throttleRef.current = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const setJoyKnob = (dx: number | null, dy: number | null) => {
    const el = joyKnobRef.current;
    if (!el) return;
    if (dx === null || dy === null) { el.style.left = 'calc(50% - 22px)'; el.style.top = 'calc(50% - 22px)'; el.style.transition = 'left 0.15s, top 0.15s'; return; }
    el.style.left = `calc(50% - 22px + ${dx}px)`;
    el.style.top = `calc(50% - 22px + ${dy}px)`;
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
    setJoyKnob(dx, dy);
    inputRef.current.x = THREE.MathUtils.clamp(dx / r, -1, 1);
    inputRef.current.y = THREE.MathUtils.clamp(dy / r, -1, 1);
  };
  const onJoyStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    joyPointerId.current = e.pointerId;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* window listeners cover it */ }
    updateJoy(e.clientX, e.clientY);
  };
  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (joyPointerId.current === e.pointerId) updateJoy(e.clientX, e.clientY); };
    const onUp = (e: PointerEvent) => {
      if (joyPointerId.current !== e.pointerId) return;
      joyPointerId.current = null;
      setJoyKnob(null, null);
      inputRef.current.x = 0; inputRef.current.y = 0;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, []);

  useThreeScene(
    ref,
    ({ scene, camera, quality }) => {
      const desktop = quality === 'desktop';
      const ringCount = Math.round(5 + difficulty / 20); // 5..9 rings
      const courseLen = 60 + difficulty * 0.8;

      scene.background = new THREE.Color(0x7db6e8);
      scene.fog = new THREE.Fog(0x9cc4e8, 60, 220);
      scene.add(new THREE.AmbientLight(0xbcd8f0, 0.7));
      const sun = new THREE.DirectionalLight(0xfff4e0, desktop ? 1.4 : 1.1);
      sun.position.set(20, 40, -10);
      scene.add(sun);

      // Ground + two runways (start and destination)
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(400, courseLen + 200),
        new THREE.MeshStandardMaterial({ color: 0x3f7a3f, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, -0.01, courseLen / 2);
      scene.add(ground);
      const runwayMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 });
      const startRunway = new THREE.Mesh(new THREE.PlaneGeometry(8, 40), runwayMat);
      startRunway.rotation.x = -Math.PI / 2;
      startRunway.position.set(0, 0, 0);
      scene.add(startRunway);
      const endRunway = new THREE.Mesh(new THREE.PlaneGeometry(10, 50), runwayMat.clone());
      endRunway.rotation.x = -Math.PI / 2;
      endRunway.position.set(0, 0, courseLen + 10);
      scene.add(endRunway);
      // landing box marker (glowing)
      const landZone = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 18),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.5, transparent: true, opacity: 0.5 }),
      );
      landZone.rotation.x = -Math.PI / 2;
      landZone.position.set(0, 0.05, courseLen + 8);
      scene.add(landZone);

      // A few clouds for depth
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
      for (let i = 0; i < (desktop ? 14 : 7); i++) {
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 3, 8, 6), cloudMat);
        cloud.position.set((Math.random() - 0.5) * 120, 12 + Math.random() * 20, Math.random() * courseLen);
        cloud.scale.y = 0.5;
        scene.add(cloud);
      }

      // Waypoint rings strung along the course at varying heights/offsets
      const rings: { mesh: THREE.Mesh; pos: THREE.Vector3; hit: boolean }[] = [];
      for (let i = 0; i < ringCount; i++) {
        const t = (i + 1) / (ringCount + 1);
        const z = t * courseLen;
        const x = Math.sin(i * 1.3) * (6 + difficulty * 0.08);
        const y = 8 + Math.sin(i * 0.9) * 4;
        const mat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.5 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.28, 10, 24), mat);
        ring.position.set(x, y, z);
        scene.add(ring);
        rings.push({ mesh: ring, pos: ring.position.clone(), hit: false });
      }

      const plane = makeAircraft();
      plane.position.set(0, 1.2, -12);
      scene.add(plane);

      const state = {
        pos: new THREE.Vector3(0, 1.2, -12),
        vel: new THREE.Vector3(0, 0, 0),
        speed: 0,
        localPhase: 'takeoff' as FlightHud['phase'],
        ringsHit: 0,
        landingQuality: 0,
        ended: false,
        hudAccum: 0,
      };

      camera.position.set(0, 4, -22);

      let lastT = 0;
      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;
        if (state.ended) return;

        rings.forEach((r, i) => { if (!r.hit) r.mesh.rotation.z = t * 0.6 + i; });

        const input = inputRef.current;
        if (state.localPhase === 'takeoff') {
          // accelerate down the runway; rotate (climb) automatically past takeoff speed
          state.speed = Math.min(16, state.speed + 9 * dt);
          state.pos.z += state.speed * dt;
          if (state.speed > 9) {
            state.pos.y += (state.speed - 9) * 0.5 * dt;
            plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, 0.18, 0.05);
          }
          if (state.pos.y > 6) { state.localPhase = 'cruise'; setPhase('cruise'); }
        } else if (state.localPhase === 'cruise') {
          state.speed = Math.min(20, state.speed + 3 * dt);
          // steering: joystick x banks/turns, y pitches up/down
          state.pos.x += input.x * 9 * dt;
          state.pos.y = THREE.MathUtils.clamp(state.pos.y - input.y * 9 * dt, 3, 26);
          state.pos.z += state.speed * dt;
          state.pos.x = THREE.MathUtils.clamp(state.pos.x, -30, 30);
          plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, input.x * 0.5, 0.1); // roll
          plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, -input.y * 0.3, 0.1); // pitch

          // ring collision
          for (const r of rings) {
            if (r.hit) continue;
            if (Math.abs(state.pos.z - r.pos.z) < 1.6) {
              const planar = Math.hypot(state.pos.x - r.pos.x, state.pos.y - r.pos.y);
              if (planar < 2.2) {
                r.hit = true;
                state.ringsHit++;
                (r.mesh.material as THREE.MeshStandardMaterial).color.set(0x22c55e);
                (r.mesh.material as THREE.MeshStandardMaterial).emissive.set(0x16a34a);
              }
            }
          }

          if (state.pos.z > courseLen - 14) { state.localPhase = 'landing'; setPhase('landing'); }
        } else if (state.localPhase === 'landing') {
          state.pos.x += input.x * 7 * dt;
          state.pos.y = THREE.MathUtils.clamp(state.pos.y - input.y * 7 * dt, 0, 20);
          state.speed = Math.max(10, state.speed - 2 * dt);
          state.pos.z += state.speed * dt;
          state.pos.x = THREE.MathUtils.clamp(state.pos.x, -12, 12);
          plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, input.x * 0.4, 0.1);

          // touchdown: when we reach the landing zone z, grade on how centered + how low + how gentle
          if (state.pos.z >= courseLen + 6) {
            const lateral = Math.abs(state.pos.x); // 0 good .. 12 bad
            const height = state.pos.y; // want near 0
            const centered = THREE.MathUtils.clamp(1 - lateral / 9, 0, 1);
            const gentle = THREE.MathUtils.clamp(1 - height / 8, 0, 1);
            state.landingQuality = centered * 0.5 + gentle * 0.5;
            state.localPhase = 'done';
            setPhase('done');
          }
        }

        if (state.localPhase === 'done' && !state.ended) {
          state.ended = true;
          const ringFrac = rings.length ? state.ringsHit / rings.length : 0;
          const score = THREE.MathUtils.clamp(ringFrac * 0.75 + state.landingQuality * 0.25, 0, 1);
          onComplete({ score, ringsHit: state.ringsHit, ringsTotal: rings.length, landingQuality: state.landingQuality });
        }

        plane.position.copy(state.pos);

        // chase camera behind and slightly above the plane
        const camTarget = new THREE.Vector3(state.pos.x * 0.5, state.pos.y + 4, state.pos.z - 14);
        camera.position.lerp(camTarget, 0.08);
        camera.lookAt(state.pos.x, state.pos.y, state.pos.z + 8);

        state.hudAccum += dt;
        if (state.hudAccum > 0.1 || state.localPhase === 'done') {
          state.hudAccum = 0;
          onHud({
            phase: state.localPhase,
            ringsHit: state.ringsHit,
            ringsTotal: rings.length,
            altitude: state.pos.y,
            speed: state.speed,
            distanceFrac: THREE.MathUtils.clamp(state.pos.z / (courseLen + 8), 0, 1),
          });
        }
      };
    },
    [difficulty],
    { controls: 'none' },
  );

  return (
    <div className="relative w-full h-full bg-sky-400 select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <div ref={ref} className="absolute inset-0" />
      {(phase === 'cruise' || phase === 'landing') && (
        <div
          ref={joyBaseRef}
          onPointerDown={onJoyStart}
          className="absolute left-5 bottom-5 w-28 h-28 rounded-full bg-white/10 border border-white/25 touch-none"
          style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          <div ref={joyKnobRef} className="absolute w-11 h-11 rounded-full bg-white/70" style={{ left: 'calc(50% - 22px)', top: 'calc(50% - 22px)' }} />
        </div>
      )}
      {phase === 'takeoff' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-white text-3xl font-black bg-black/40 px-8 py-4 rounded-2xl">Taking off…</div>
        </div>
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/85 bg-black/30 px-3 py-1 rounded-full text-center">
        {phase === 'landing' ? 'Line up with the green box and settle in low & centered' : 'Steer through the gold rings'}
      </div>
    </div>
  );
}
