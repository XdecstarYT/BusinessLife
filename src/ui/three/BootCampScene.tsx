/**
 * A real, player-controlled 3D obstacle course: the gate every VOLUNTEER must clear before
 * enlistInMilitary() is allowed to run (drafted service members skip this entirely — see
 * sim/military.ts's tickDraft). Four obstacles test different inputs: a hurdle (well-timed jump
 * tap), a wall (hold the action button to climb), a crawl tunnel (hold crouch or take a bonk),
 * and a balance beam (steer to stay centered or fumble off). Passing requires clearing at least
 * three of the four cleanly and not running yourself into the ground on stamina. Mirrors
 * RunningRaceScene's pacing-meter + joystick control scheme for a consistent feel.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

export interface BootCampResult {
  passed: boolean;
  timeSeconds: number;
  staminaRemaining: number;
  fumbles: number;
}

export interface BootCampHud {
  distanceFrac: number; // 0..1 progress along the course
  stamina: number; // 0..1
  elapsedSeconds: number;
  currentObstacle: 'run' | 'hurdle' | 'wall' | 'crawl' | 'beam' | 'finish';
  phase: 'briefing' | 'active' | 'finished';
}

interface BootCampSceneProps {
  branchName: string;
  onHud: (hud: BootCampHud) => void;
  onCourseEnd: (result: BootCampResult) => void;
}

const COURSE_LEN = 70;
const HURDLE_Z = 14;
const HURDLE_WINDOW: [number, number] = [10, 16];
const WALL_START = 25;
const WALL_END = 29;
const CRAWL_START = 38;
const CRAWL_END = 44;
const BEAM_START = 52;
const BEAM_END = 60;
const BASE_SPEED = 5.2;
const SPRINT_MULT = 1.7;
const WALL_CLIMB_TIME = 1.3;
const WALL_TIME_CAP = 6;
const TIME_LIMIT = 50;

function makeRecruit(): THREE.Group {
  const g = new THREE.Group();
  const fatigues = new THREE.MeshStandardMaterial({ color: 0x4d5a3a, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac85, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), fatigues);
  body.position.y = 0.56;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = 1.02;
  g.add(head);
  return g;
}

function groundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6b5c3f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${60 + Math.random() * 40},${50 + Math.random() * 35},${25 + Math.random() * 25},0.4)`;
    const w = 2 + Math.random() * 6;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, w, w);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 8);
  return tex;
}

export function BootCampScene({ branchName, onHud, onCourseEnd }: BootCampSceneProps) {
  void branchName;
  const ref = useRef<HTMLDivElement>(null);
  const actionRef = useRef({ held: false });
  const jumpRef = useRef(false);
  const crouchRef = useRef(false);
  const laneInputRef = useRef(0);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const [phase, setPhase] = useState<'briefing' | 'active' | 'finished'>('briefing');

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { if (!e.repeat) jumpRef.current = true; actionRef.current.held = true; }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') crouchRef.current = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') laneInputRef.current = -1;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') laneInputRef.current = 1;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') actionRef.current.held = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') crouchRef.current = false;
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
    const dist = Math.hypot(dx, clientY - cy);
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

  const onActionDown = () => { actionRef.current.held = true; jumpRef.current = true; };
  const onActionUp = () => { actionRef.current.held = false; };
  const onCrouchDown = () => { crouchRef.current = true; };
  const onCrouchUp = () => { crouchRef.current = false; };

  useThreeScene(
    ref,
    ({ scene, camera, quality }) => {
      const desktop = quality === 'desktop';
      scene.background = new THREE.Color(0x8a9a6b);
      scene.fog = new THREE.Fog(0x8a9a6b, 35, 85);
      scene.add(new THREE.AmbientLight(0xffffff, 0.65));
      const sun = new THREE.DirectionalLight(0xfff4d8, desktop ? 1.2 : 1.0);
      sun.position.set(10, 22, 8);
      scene.add(sun);

      const courseWidth = 6;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(courseWidth, COURSE_LEN + 20), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, 0, COURSE_LEN / 2);
      scene.add(ground);

      // Hurdle
      const hurdleMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
      const hurdle = new THREE.Mesh(new THREE.BoxGeometry(courseWidth * 0.7, 0.7, 0.18), hurdleMat);
      hurdle.position.set(0, 0.35, HURDLE_Z);
      scene.add(hurdle);

      // Wall
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(courseWidth * 0.7, 2.4, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.85 }),
      );
      wall.position.set(0, 1.2, (WALL_START + WALL_END) / 2);
      scene.add(wall);

      // Crawl tunnel (low netting + side poles)
      const crawlCenter = (CRAWL_START + CRAWL_END) / 2;
      const netting = new THREE.Mesh(
        new THREE.BoxGeometry(courseWidth * 0.75, 0.08, CRAWL_END - CRAWL_START),
        new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9, transparent: true, opacity: 0.75 }),
      );
      netting.position.set(0, 1.0, crawlCenter);
      scene.add(netting);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), new THREE.MeshStandardMaterial({ color: 0x57534e }));
          pole.position.set(side * courseWidth * 0.36, 0.5, CRAWL_START + i * ((CRAWL_END - CRAWL_START) / 3));
          scene.add(pole);
        }
      }

      // Balance beam over a shallow pit
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(courseWidth, BEAM_END - BEAM_START + 2), new THREE.MeshStandardMaterial({ color: 0x1c1917 }));
      pit.rotation.x = -Math.PI / 2;
      pit.position.set(0, -0.4, (BEAM_START + BEAM_END) / 2);
      scene.add(pit);
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.2, BEAM_END - BEAM_START),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 }),
      );
      beam.position.set(0, 0.15, (BEAM_START + BEAM_END) / 2);
      scene.add(beam);

      const finishBanner = new THREE.Mesh(new THREE.BoxGeometry(courseWidth, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x334155, emissiveIntensity: 0.4 }));
      finishBanner.position.set(0, 2.2, COURSE_LEN);
      scene.add(finishBanner);

      const player = makeRecruit();
      scene.add(player);

      let z = 0;
      let lateral = 0;
      let stamina = 1;
      let elapsed = 0;
      let briefingTimer = 1.6;
      let localPhase: BootCampHud['phase'] = 'briefing';
      let courseEnded = false;
      let hudAccum = 0;

      let hurdleCleared = false;
      let hurdleFumbled = false;
      let wallClimbProgress = 0;
      let wallTimeInZone = 0;
      let wallFumbled = false;
      let wallDone = false;
      let crawlBonked = false;
      let beamBadTime = 0;
      let beamFumbled = false;

      camera.position.set(0, 4, -3);

      let lastT = 0;
      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;
        if (courseEnded) return;

        if (localPhase === 'briefing') {
          briefingTimer -= dt;
          if (briefingTimer <= 0) { localPhase = 'active'; setPhase('active'); }
        } else if (localPhase === 'active') {
          elapsed += dt;
          const jumpAttempt = jumpRef.current;
          jumpRef.current = false;

          lateral = THREE.MathUtils.clamp(lateral + laneInputRef.current * 2.4 * dt, -1, 1);
          if (laneInputRef.current === 0) lateral *= Math.max(0, 1 - dt * 1.2);

          const inWall = z >= WALL_START && z <= WALL_END && !wallDone;
          const inCrawl = z >= CRAWL_START && z <= CRAWL_END;
          const inBeam = z >= BEAM_START && z <= BEAM_END;

          if (inWall) {
            wallTimeInZone += dt;
            if (actionRef.current.held) wallClimbProgress = Math.min(1, wallClimbProgress + dt / WALL_CLIMB_TIME);
            else wallClimbProgress = Math.max(0, wallClimbProgress - dt / (WALL_CLIMB_TIME * 1.5));
            if (wallClimbProgress >= 1) {
              wallDone = true;
            } else if (wallTimeInZone >= WALL_TIME_CAP) {
              wallDone = true;
              wallFumbled = true;
            }
          } else {
            let moveSpeed: number;
            if (inCrawl) {
              if (!crouchRef.current) crawlBonked = true;
              moveSpeed = BASE_SPEED * (crouchRef.current ? 0.55 : 0.85);
            } else {
              const sprinting = actionRef.current.held && stamina > 0.03;
              moveSpeed = BASE_SPEED * (sprinting ? SPRINT_MULT : 1) * (stamina < 0.05 ? 0.6 : 1);
            }
            stamina = actionRef.current.held ? Math.max(0, stamina - dt * 0.22) : Math.min(1, stamina + dt * 0.18);
            z = Math.min(COURSE_LEN, z + moveSpeed * dt);
          }

          if (inBeam) {
            if (Math.abs(lateral) > 0.55) beamBadTime += dt;
            if (beamBadTime > 1.0) beamFumbled = true;
          }

          if (!hurdleCleared) {
            if (z >= HURDLE_WINDOW[0] && z <= HURDLE_WINDOW[1]) {
              if (jumpAttempt) hurdleCleared = true;
            } else if (z > HURDLE_WINDOW[1]) {
              hurdleCleared = true;
              hurdleFumbled = true;
            }
          }

          if (z >= COURSE_LEN) {
            localPhase = 'finished';
            setPhase('finished');
          }
        }

        if (localPhase === 'finished' && !courseEnded) {
          courseEnded = true;
          const fumbles = [hurdleFumbled, wallFumbled, crawlBonked, beamFumbled].filter(Boolean).length;
          const passed = fumbles <= 1 && stamina > 0.15;
          onCourseEnd({ passed, timeSeconds: elapsed, staminaRemaining: stamina, fumbles });
        } else if (elapsed >= TIME_LIMIT && localPhase === 'active' && !courseEnded) {
          courseEnded = true;
          localPhase = 'finished';
          setPhase('finished');
          const fumbles = [hurdleFumbled, wallFumbled, crawlBonked, beamFumbled].filter(Boolean).length + 1;
          onCourseEnd({ passed: false, timeSeconds: elapsed, staminaRemaining: stamina, fumbles });
        }

        player.position.set(lateral * 1.3, crawlCrouchOffset(z, CRAWL_START, CRAWL_END, crouchRef.current), z);

        const camZ = z - 4.5;
        camera.position.lerp(new THREE.Vector3(lateral * 0.5, 3.9, camZ), 0.08);
        camera.lookAt(lateral * 0.5, 1, z + 6);

        hudAccum += dt;
        if (hudAccum > 0.1 || localPhase === 'finished') {
          hudAccum = 0;
          const currentObstacle: BootCampHud['currentObstacle'] =
            z >= COURSE_LEN ? 'finish'
            : z >= BEAM_START && z <= BEAM_END ? 'beam'
            : z >= CRAWL_START && z <= CRAWL_END ? 'crawl'
            : z >= WALL_START && z <= WALL_END && !wallDone ? 'wall'
            : z >= HURDLE_WINDOW[0] && z <= HURDLE_WINDOW[1] && !hurdleCleared ? 'hurdle'
            : 'run';
          onHud({ distanceFrac: z / COURSE_LEN, stamina, elapsedSeconds: elapsed, currentObstacle, phase: localPhase });
        }
      };
    },
    [],
    { controls: 'none' },
  );

  return (
    <div className="relative w-full h-full bg-slate-900 select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <div ref={ref} className="absolute inset-0" />
      {phase === 'active' && (
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
            onPointerDown={onCrouchDown}
            onPointerUp={onCrouchUp}
            onPointerLeave={onCrouchUp}
            className="absolute right-28 bottom-8 w-14 h-14 rounded-full bg-amber-500/90 border-4 border-white/60 text-white text-[10px] font-black active:scale-95 transition-transform"
            style={{ touchAction: 'none' }}
          >
            DUCK
          </button>
          <button
            onPointerDown={onActionDown}
            onPointerUp={onActionUp}
            onPointerLeave={onActionUp}
            className="absolute right-6 bottom-6 w-20 h-20 rounded-full bg-emerald-500/90 border-4 border-white/60 text-white font-black active:scale-95 transition-transform"
            style={{ touchAction: 'none' }}
          >
            GO!
          </button>
        </>
      )}
      {phase === 'briefing' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-2xl font-black bg-black/40 px-8 py-4 rounded-2xl text-center">
            Obstacle course ahead —<br /><span className="text-base font-semibold">hold GO! to sprint, tap it to jump the hurdle,<br />hold it through the wall to climb, hold DUCK through the crawl.</span>
          </div>
        </div>
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/30 px-3 py-1 rounded-full">
        Hold GO! to sprint · tap GO! to jump · hold DUCK to crawl · steer to hold the beam
      </div>
    </div>
  );
}

function crawlCrouchOffset(z: number, crawlStart: number, crawlEnd: number, crouching: boolean): number {
  return z >= crawlStart && z <= crawlEnd && crouching ? -0.22 : 0;
}
