/**
 * A real, player-controlled 3D soccer match: WASD/joystick movement (the same input pattern
 * CasinoScene/CityHubScene use), a single charge-and-release action button that doubles as a
 * quick pass (tap) or a powered shot (hold) while carrying the ball, or a sprint boost while not,
 * rolling ball physics with real goal detection, and AI teammates + opponents that chase, mark,
 * press, pass and shoot on their own. Played 4-a-side (1 keeper + 3 outfield per team) rather
 * than a full 11-a-side XI — an intentional arcade-soccer simplification (in the spirit of
 * futsal/street football) that keeps the pitch readable and the AI tractable while still being
 * genuinely, skillfully playable. The match clock compresses a realistic 90 minutes into
 * `durationSeconds` of real time; the scene reports HUD updates and a final result (score, the
 * human player's own goals/assists) back to the caller, which turns that into a career stat line
 * via sim/athletics.ts's resolveMatch().
 */
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

export interface SoccerMatchResult {
  homeScore: number;
  awayScore: number;
  playerGoals: number;
  playerAssists: number;
}

export interface SoccerHud {
  homeScore: number;
  awayScore: number;
  minuteLabel: string;
  phase: 'kickoff' | 'playing' | 'halftime' | 'fulltime';
  hasBall: boolean;
  stamina: number; // 0..1
}

interface SoccerMatchSceneProps {
  homeName: string;
  awayName: string;
  homeColor: number;
  awayColor: number;
  durationSeconds: number;
  onHud: (hud: SoccerHud) => void;
  onMatchEnd: (result: SoccerMatchResult) => void;
}

const HALF_L = 22; // pitch runs along Z from -HALF_L to +HALF_L
const HALF_W = 13; // pitch runs along X from -HALF_W to +HALF_W
const GOAL_HALF_W = 3.2;
const CAPTURE_RADIUS = 1.05;
const TACKLE_RADIUS = 0.9;
const MOVE_SPEED = 6.2;
const SPRINT_MULT = 1.4;
const MIN_KICK = 7;
const MAX_KICK = 17;
const PASS_SPEED = 9;
const CHARGE_MS = 900;

type Team = 'home' | 'away';
type Role = 'GK' | 'FIELD';

interface FieldPlayer {
  mesh: THREE.Group;
  team: Team;
  role: Role;
  isHuman: boolean;
  pos: THREE.Vector2;
  heading: number;
  baseX: number;
  baseZ: number;
  speed: number;
  decisionTimer: number;
}

interface Touch {
  isHuman: boolean;
  team: Team;
}

function makePlayer(color: number, isGK: boolean): THREE.Group {
  const g = new THREE.Group();
  const jersey = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac85, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 10), jersey);
  body.position.y = 0.58;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skin);
  head.position.y = 1.08;
  g.add(head);
  if (isGK) {
    const glove = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), glove);
      hand.position.set(side * 0.32, 0.55, 0.1);
      g.add(hand);
    }
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.7, 0.24);
  g.add(nose);
  return g;
}

function makeGoal(z: number, facing: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.2 });
  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 10);
  for (const x of [-GOAL_HALF_W, GOAL_HALF_W]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, 1.1, z);
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, GOAL_HALF_W * 2, 10), postMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 2.18, z);
  g.add(bar);
  const netMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HALF_W * 2, 2.2), netMat);
  net.position.set(0, 1.1, z + facing * 0.9);
  g.add(net);
  const sideNetL = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), netMat);
  sideNetL.rotation.y = Math.PI / 2;
  sideNetL.position.set(-GOAL_HALF_W, 1.1, z + facing * 0.45);
  g.add(sideNetL);
  const sideNetR = sideNetL.clone();
  sideNetR.position.x = GOAL_HALF_W;
  g.add(sideNetR);
  return g;
}

function pitchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const stripes = 12;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2f9e44' : '#37b24d';
    ctx.fillRect(0, (canvas.height / stripes) * i, canvas.width, canvas.height / stripes);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  ctx.beginPath(); ctx.moveTo(20, canvas.height / 2); ctx.lineTo(canvas.width - 20, canvas.height / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(canvas.width / 2 - 140, 20, 280, 130);
  ctx.strokeRect(canvas.width / 2 - 140, canvas.height - 150, 280, 130);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function SoccerMatchScene({ homeName, awayName, homeColor, awayColor, durationSeconds, onHud, onMatchEnd }: SoccerMatchSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ x: 0, z: 0 });
  const actionRef = useRef({ held: false, holdStart: 0 });
  const joyKnobRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const chargeRingRef = useRef<HTMLDivElement>(null);

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

  useThreeScene(
    ref,
    ({ scene, camera, quality }) => {
      const desktop = quality === 'desktop';
      scene.background = new THREE.Color(0x0b3d1a);
      scene.fog = new THREE.Fog(0x0b3d1a, 30, 70);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xfff4e0, desktop ? 1.2 : 1.0);
      sun.position.set(10, 22, 8);
      scene.add(sun);

      const pitch = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 + 4, HALF_L * 2 + 4), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
      pitch.rotation.x = -Math.PI / 2;
      scene.add(pitch);

      if (desktop) {
        const standMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
        for (const z of [-HALF_L - 4, HALF_L + 4]) {
          const stand = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 6, 3, 2), standMat);
          stand.position.set(0, 1.5, z);
          scene.add(stand);
        }
      }

      scene.add(makeGoal(-HALF_L, 1));
      scene.add(makeGoal(HALF_L, -1));

      const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
      ballMesh.position.set(0, 0.24, 0);
      scene.add(ballMesh);

      const homeFormation: { x: number; z: number; role: Role }[] = [
        { x: 0, z: -HALF_L + 1.2, role: 'GK' }, { x: -3.5, z: -6, role: 'FIELD' }, { x: 0, z: -3, role: 'FIELD' }, { x: 3.5, z: -6, role: 'FIELD' },
      ];
      const awayFormation: { x: number; z: number; role: Role }[] = [
        { x: 0, z: HALF_L - 1.2, role: 'GK' }, { x: -3.5, z: 6, role: 'FIELD' }, { x: 0, z: 3, role: 'FIELD' }, { x: 3.5, z: 6, role: 'FIELD' },
      ];

      const players: FieldPlayer[] = [];
      homeFormation.forEach((f, i) => {
        const mesh = makePlayer(homeColor, f.role === 'GK');
        mesh.position.set(f.x, 0, f.z);
        scene.add(mesh);
        players.push({ mesh, team: 'home', role: f.role, isHuman: i === 1, pos: new THREE.Vector2(f.x, f.z), heading: 0, baseX: f.x, baseZ: f.z, speed: i === 1 ? MOVE_SPEED : MOVE_SPEED * 0.86, decisionTimer: 0.6 + i * 0.2 });
      });
      awayFormation.forEach((f) => {
        const mesh = makePlayer(awayColor, f.role === 'GK');
        mesh.position.set(f.x, 0, f.z);
        scene.add(mesh);
        players.push({ mesh, team: 'away', role: f.role, isHuman: false, pos: new THREE.Vector2(f.x, f.z), heading: Math.PI, baseX: f.x, baseZ: f.z, speed: MOVE_SPEED * 0.88, decisionTimer: 0.9 });
      });
      const human = players[1];
      const humanIdx = 1;

      const ballPos = new THREE.Vector2(0, 0);
      const ballVel = new THREE.Vector2(0, 0);
      let ownerIndex: number | null = null;
      const touchHistory: Touch[] = [];
      const recordTouch = (p: FieldPlayer) => {
        touchHistory.unshift({ isHuman: p.isHuman, team: p.team });
        if (touchHistory.length > 2) touchHistory.length = 2;
      };

      let homeScore = 0, awayScore = 0;
      let phase: SoccerHud['phase'] = 'kickoff';
      let elapsed = 0;
      let phaseTimer = 1.2;
      let stamina = 1;
      let hudAccum = 0;
      let matchEnded = false;
      let halftimeTriggered = false;
      let kickWasHeld = false;
      let playerGoals = 0, playerAssists = 0;

      const resetKickoff = () => {
        ballPos.set(0, 0); ballVel.set(0, 0); ownerIndex = null; touchHistory.length = 0;
        for (const p of players) p.pos.set(p.baseX, p.baseZ);
        phase = 'kickoff'; phaseTimer = 1.1;
      };

      const scoreGoal = (attackingTeam: Team) => {
        if (attackingTeam === 'home') homeScore++; else awayScore++;
        const scorer = touchHistory[0];
        const assister = touchHistory[1];
        if (scorer?.isHuman && scorer.team === attackingTeam) playerGoals++;
        else if (assister?.isHuman && assister.team === attackingTeam && scorer && !scorer.isHuman) playerAssists++;
        resetKickoff();
      };

      // Vector2 stores world (x, z) as (x, y) — .y is world Z throughout this file.
      const clampToPitch = (v: THREE.Vector2) => {
        v.x = THREE.MathUtils.clamp(v.x, -HALF_W + 0.3, HALF_W - 0.3);
        v.y = THREE.MathUtils.clamp(v.y, -HALF_L + 0.3, HALF_L - 0.3);
      };
      const mostAdvancedTeammate = (from: FieldPlayer): FieldPlayer | null => {
        const dir = from.team === 'home' ? 1 : -1;
        let best: FieldPlayer | null = null, bestAdv = -Infinity;
        for (const p of players) {
          if (p.team !== from.team || p === from || p.role === 'GK') continue;
          const adv = p.pos.y * dir; // Vector2.y stores our world Z
          if (adv > bestAdv) { bestAdv = adv; best = p; }
        }
        return best;
      };

      camera.position.set(0, 5.5, -8);
      let lastT = 0;

      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;
        if (matchEnded) return;

        // --- clock / phase ---
        if (phase === 'kickoff') {
          phaseTimer -= dt;
          if (phaseTimer <= 0) phase = 'playing';
        } else if (phase === 'halftime') {
          phaseTimer -= dt;
          if (phaseTimer <= 0) phase = 'playing';
        } else if (phase === 'playing') {
          elapsed += dt;
          const halfDuration = durationSeconds / 2;
          if (elapsed >= durationSeconds) {
            phase = 'fulltime';
          } else if (elapsed >= halfDuration && !halftimeTriggered) {
            halftimeTriggered = true;
            resetKickoff();
            phase = 'halftime';
            phaseTimer = 1.6;
          }
        }
        if (phase === 'fulltime' && !matchEnded) {
          matchEnded = true;
          onMatchEnd({ homeScore, awayScore, playerGoals, playerAssists });
        }
        const active = phase === 'playing';

        // --- human movement (action button sprints while not carrying) ---
        {
          const { x, z } = inputRef.current;
          const mag = Math.hypot(x, z);
          const carryingBall = ownerIndex === humanIdx;
          const sprinting = actionRef.current.held && !carryingBall && stamina > 0.05;
          if (active && mag > 0.05) {
            const nx = x / Math.max(mag, 1), nz = z / Math.max(mag, 1);
            const spd = human.speed * (sprinting ? SPRINT_MULT : 1) * Math.min(mag, 1);
            human.pos.x += nx * spd * dt;
            human.pos.y += nz * spd * dt;
            clampToPitch(human.pos);
            const targetHeading = Math.atan2(nx, nz);
            let diff = targetHeading - human.heading;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            human.heading += diff * 0.28;
          }
          stamina = sprinting ? Math.max(0, stamina - dt * 0.22) : Math.min(1, stamina + dt * 0.12);
        }

        // --- AI players ---
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          if (p.isHuman || !active) continue;
          if (p.role === 'GK') {
            const carrying = ownerIndex === i;
            if (carrying) {
              p.decisionTimer -= dt;
              if (p.decisionTimer <= 0) {
                const teammate = mostAdvancedTeammate(p);
                const dir = p.team === 'home' ? 1 : -1;
                const aim = teammate ? new THREE.Vector2(teammate.pos.x - p.pos.x, teammate.pos.y - p.pos.y).normalize() : new THREE.Vector2(0, dir);
                ballVel.copy(aim.multiplyScalar(PASS_SPEED * 1.1));
                ownerIndex = null;
                recordTouch(p);
                p.decisionTimer = 1.0;
              }
            } else {
              const ownGoalZ = p.team === 'home' ? -HALF_L + 1.2 : HALF_L - 1.2;
              const targetX = THREE.MathUtils.clamp(ballPos.x * 0.6, -GOAL_HALF_W + 0.4, GOAL_HALF_W - 0.4);
              p.pos.x += (targetX - p.pos.x) * Math.min(1, dt * 3);
              p.pos.y += (ownGoalZ - p.pos.y) * Math.min(1, dt * 3);
            }
            continue;
          }
          const carrying = ownerIndex === i;
          if (carrying) {
            p.decisionTimer -= dt;
            const dir = p.team === 'home' ? 1 : -1;
            p.pos.y += dir * p.speed * 0.55 * dt;
            clampToPitch(p.pos);
            if (p.decisionTimer <= 0) {
              const goalZ = p.team === 'home' ? HALF_L : -HALF_L;
              const distToGoal = Math.abs(goalZ - p.pos.y);
              const teammate = mostAdvancedTeammate(p);
              if (distToGoal < 11 && Math.random() < 0.5) {
                const targetX = (Math.random() - 0.5) * GOAL_HALF_W * 1.6;
                const aim = new THREE.Vector2(targetX - p.pos.x, goalZ - p.pos.y).normalize();
                ballVel.copy(aim.multiplyScalar(MIN_KICK + Math.random() * (MAX_KICK - MIN_KICK)));
              } else if (teammate && Math.random() < 0.75) {
                const aim = new THREE.Vector2(teammate.pos.x - p.pos.x, teammate.pos.y - p.pos.y).normalize();
                ballVel.copy(aim.multiplyScalar(PASS_SPEED));
              } else {
                ballVel.set(0, dir).multiplyScalar(MIN_KICK);
              }
              ownerIndex = null;
              recordTouch(p);
              p.decisionTimer = 0.7 + Math.random() * 0.6;
            }
          } else {
            const teammates = players.filter((q) => q.team === p.team && q.role !== 'GK');
            const closestOnTeam = teammates.every((q) => q === p || p.pos.distanceTo(ballPos) <= q.pos.distanceTo(ballPos));
            const ballOwner = ownerIndex !== null ? players[ownerIndex] : null;
            const oppositionHasBall = !!ballOwner && ballOwner.team !== p.team;
            const closestDefender = oppositionHasBall && teammates.every((q) => q === p || p.pos.distanceTo(ballOwner!.pos) <= q.pos.distanceTo(ballOwner!.pos));
            let targetX: number, targetZ: number;
            if (ownerIndex === null && closestOnTeam) { targetX = ballPos.x; targetZ = ballPos.y; }
            else if (oppositionHasBall && closestDefender) { targetX = ballOwner!.pos.x; targetZ = ballOwner!.pos.y; }
            else { targetX = p.baseX + (ballPos.x - p.baseX) * 0.25; targetZ = p.baseZ + (ballPos.y - p.baseZ) * 0.2; }
            const toTarget = new THREE.Vector2(targetX - p.pos.x, targetZ - p.pos.y);
            const d = toTarget.length();
            if (d > 0.15) {
              toTarget.normalize();
              p.pos.x += toTarget.x * p.speed * dt;
              p.pos.y += toTarget.y * p.speed * dt;
              clampToPitch(p.pos);
              p.heading = Math.atan2(toTarget.x, toTarget.y);
            }
          }
        }

        // --- tackling: an opposing outfield player near the carrier can dispossess ---
        if (active && ownerIndex !== null) {
          const carrier = players[ownerIndex];
          for (const p of players) {
            if (p === carrier || p.team === carrier.team || p.role === 'GK') continue;
            if (p.pos.distanceTo(carrier.pos) < TACKLE_RADIUS && Math.random() < dt * 1.6) {
              ownerIndex = players.indexOf(p);
              recordTouch(p);
              break;
            }
          }
        }

        // --- human kick / pass / shoot ---
        if (active && ownerIndex === humanIdx) {
          const held = actionRef.current.held;
          if (held && chargeRingRef.current) {
            const charge = Math.min(1, (performance.now() - actionRef.current.holdStart) / CHARGE_MS);
            chargeRingRef.current.style.background = `conic-gradient(rgba(255,255,255,0.6) ${charge * 360}deg, transparent 0deg)`;
          }
          if (!held && kickWasHeld) {
            const charge = Math.min(1, (performance.now() - actionRef.current.holdStart) / CHARGE_MS);
            const power = MIN_KICK + charge * (MAX_KICK - MIN_KICK);
            const dir = new THREE.Vector2(Math.sin(human.heading), Math.cos(human.heading));
            ballVel.copy(dir.multiplyScalar(power));
            ownerIndex = null;
            recordTouch(human);
            if (chargeRingRef.current) chargeRingRef.current.style.background = 'transparent';
          }
          kickWasHeld = held;
        } else {
          kickWasHeld = false;
        }

        // --- ball physics ---
        if (ownerIndex !== null) {
          const carrier = players[ownerIndex];
          ballPos.set(carrier.pos.x + Math.sin(carrier.heading) * 0.45, carrier.pos.y + Math.cos(carrier.heading) * 0.45);
          ballVel.set(0, 0);
        } else if (active) {
          ballPos.addScaledVector(ballVel, dt);
          ballVel.multiplyScalar(Math.pow(0.55, dt));
          if (Math.abs(ballPos.x) > HALF_W) { ballPos.x = THREE.MathUtils.clamp(ballPos.x, -HALF_W, HALF_W); ballVel.x *= -0.6; }
          if (ballPos.y > HALF_L) {
            if (Math.abs(ballPos.x) < GOAL_HALF_W) scoreGoal('home');
            else { ballPos.y = HALF_L; ballVel.y *= -0.6; }
          } else if (ballPos.y < -HALF_L) {
            if (Math.abs(ballPos.x) < GOAL_HALF_W) scoreGoal('away');
            else { ballPos.y = -HALF_L; ballVel.y *= -0.6; }
          }
        }

        // --- possession pickup on a loose ball ---
        if (active && ownerIndex === null) {
          let best: number | null = null, bestD = CAPTURE_RADIUS;
          for (let i = 0; i < players.length; i++) {
            const d = players[i].pos.distanceTo(ballPos);
            if (d < bestD) { bestD = d; best = i; }
          }
          if (best !== null) { ownerIndex = best; recordTouch(players[best]); }
        }

        // --- apply to meshes ---
        for (const p of players) {
          p.mesh.position.set(p.pos.x, 0, p.pos.y);
          p.mesh.rotation.y = p.heading;
        }
        ballMesh.position.set(ballPos.x, 0.24, ballPos.y);

        // --- chase camera behind the human ---
        const forward = new THREE.Vector3(Math.sin(human.heading), 0, Math.cos(human.heading));
        const desired = new THREE.Vector3(human.pos.x - forward.x * 7, 5.5, human.pos.y - forward.z * 7);
        camera.position.lerp(desired, 0.07);
        camera.lookAt(human.pos.x + forward.x * 4, 1, human.pos.y + forward.z * 4);

        // --- HUD (throttled) ---
        hudAccum += dt;
        if (hudAccum > 0.12) {
          hudAccum = 0;
          const minute = Math.min(90, Math.floor((elapsed / durationSeconds) * 90));
          onHud({
            homeScore, awayScore,
            minuteLabel: phase === 'fulltime' ? 'FT' : phase === 'halftime' ? 'HT' : `${minute}'`,
            phase, hasBall: ownerIndex === humanIdx, stamina,
          });
        }
      };
    },
    [homeName, awayName, homeColor, awayColor, durationSeconds],
    { controls: 'none' },
  );

  return (
    <div className="relative w-full h-full bg-emerald-950 select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <div ref={ref} className="absolute inset-0" />
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
        className="absolute right-6 bottom-6 w-20 h-20 rounded-full bg-emerald-400/90 border-4 border-white/60 text-white font-black active:scale-95 transition-transform"
        style={{ touchAction: 'none' }}
      >
        <div ref={chargeRingRef} className="absolute inset-0 rounded-full" />
        <span className="relative">KICK</span>
      </button>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/30 px-3 py-1 rounded-full">
        Tap KICK to pass, hold to charge a shot (sprint while off the ball) — WASD/joystick to move
      </div>
    </div>
  );
}
