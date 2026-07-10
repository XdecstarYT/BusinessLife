/**
 * The casino floor: a real walkable room (WASD/arrows or a virtual joystick — the exact movement
 * pattern CityHubScene uses for the Explore plaza), not an ambient diorama you just orbit around.
 * Every named slot machine cabinet, the roulette wheel, the card tables, the coin stand and the
 * sports book kiosk are real, distinct 3D objects laid out in an enclosed room (patterned carpet,
 * a back wall, flanking columns, two hanging chandeliers). Walking up to one reports it via
 * `onNearbyChange` so the caller can surface a "Play" prompt and bet panel as its own overlay —
 * this component owns movement and rendering only, not game selection UI. The roulette wheel
 * genuinely resolves to the real winning number from a completed spin (not a perpetual arbitrary
 * spin), and a chip marks wherever the player's current bet selection actually sits on the felt.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

export interface CasinoMachineView {
  id: string;
  name: string;
  color: number;
  jackpot: number;
  minBet: number;
  locked: boolean;
}

export interface RouletteSpinVisual {
  landedNumber: number;
  token: number; // increments per spin so the same number twice in a row still re-triggers the animation
}

export interface RouletteBetVisual {
  kind: string;
  number?: number;
}

interface CasinoSceneProps {
  machines: CasinoMachineView[];
  tables: { id: string; name: string; color: number }[];
  onNearbyChange: (id: string | null) => void;
  paused: boolean; // freeze walking while a bet panel is open, so WASD doesn't fight panel inputs
  rouletteSpin: RouletteSpinVisual | null;
  rouletteBet: RouletteBetVisual | null;
}

const WALK_BOUND = 7.6;
const ENTER_RADIUS = 1.25;
const EXIT_RADIUS = 1.7;
const MOVE_SPEED = 3.6;
export const SPORTSBOOK_ID = 'sportsbook';

function makeTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cabinetScreenTexture(name: string, jackpot: number, locked: boolean): THREE.CanvasTexture {
  return makeTexture(320, 200, (ctx, w, h) => {
    ctx.fillStyle = '#0c0814';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = locked ? '#64748b' : '#facc15';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, w / 2, h * 0.32, w - 20);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(locked ? 'VIP LOCKED' : 'JACKPOT', w / 2, h * 0.58);
    ctx.fillStyle = locked ? '#94a3b8' : '#34d399';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText(locked ? '???' : `$${Math.round(jackpot).toLocaleString()}`, w / 2, h * 0.85);
  });
}

// A fresh texture per call (not module-level cached): useThreeScene's unmount cleanup calls
// .dispose() on every texture it finds in the scene, which frees the GPU resource. A cached
// module-level texture would still pass that stale, disposed object back in on the next mount
// (e.g. navigating away from Casino and back), rendering a blank reel window — every other scene
// in this codebase creates its textures fresh inside `setup()` for exactly this reason.
function reelWindowTexture(): THREE.CanvasTexture {
  return makeTexture(240, 90, (ctx, w, h) => {
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(0, 0, w, h);
    const symbols = ['🍒', '★', '7'];
    const cw = w / 3;
    symbols.forEach((s, i) => {
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 2;
      ctx.strokeRect(i * cw + 3, 3, cw - 6, h - 6);
      ctx.fillStyle = i === 2 ? '#b91c1c' : '#1c1c1c';
      ctx.font = '700 40px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s, i * cw + cw / 2, h / 2 + 2);
    });
  });
}

function carpetTexture(): THREE.CanvasTexture {
  const tex = makeTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1c0f24';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3a2049';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w / 2, h); ctx.lineTo(0, h / 2); ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2); ctx.fill();
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

function rouletteWheelTexture(): THREE.CanvasTexture {
  return makeTexture(256, 256, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = w / 2;
    const segments = 37;
    for (let i = 0; i < segments; i++) {
      const color = i === 0 ? '#16a34a' : i % 2 === 0 ? '#111827' : '#dc2626';
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#d4af37';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
  });
}

function feltLayoutTexture(): THREE.CanvasTexture {
  return makeTexture(256, 256, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.fillStyle = '#0f5c33';
    ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, w / 2 - 6, 0, Math.PI * 2); ctx.stroke();
    const nums = 37;
    const r = w / 2 - 22;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < nums; i++) {
      const a = (i / nums) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      ctx.fillStyle = i === 0 ? '#22c55e' : i % 2 === 0 ? '#1c1c1c' : '#dc2626';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5f0e6';
      ctx.fillText(String(i), x, y);
    }
  });
}

function coinFaceTexture(label: string, color: number): THREE.CanvasTexture {
  return makeTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7c5e0a';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3a2c05';
    ctx.font = '700 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 + 2);
  });
}

function sportsbookScreenTexture(): THREE.CanvasTexture {
  return makeTexture(320, 220, (ctx, w, h) => {
    ctx.fillStyle = '#0a1a12';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4ade80';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPORTS BOOK', w / 2, h * 0.3);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('Live moneyline odds', w / 2, h * 0.5);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Walk up to see the board', w / 2, h * 0.68);
  });
}

function makeChipStack(colors: number[], count: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const chip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.018, 16),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.35, metalness: 0.1 }),
    );
    chip.position.y = i * 0.019;
    g.add(chip);
  }
  return g;
}

const CHIP_COLORS = [0xdc2626, 0xf5f0e6, 0x1d4ed8, 0x16a34a, 0x1c1c1c];

/** Same angular convention feltLayoutTexture uses to place each number — not a pixel-exact UV
 * mapping onto the cylinder cap (that's fiddly to derive and not worth it for a decorative
 * table), but close enough that the bet chip and the resolved ball both read as "on the right
 * number" at a glance. */
function angleForNumber(n: number): number {
  return (n / 37) * Math.PI * 2 - Math.PI / 2;
}

const OUTSIDE_BET_ANGLE: Record<string, number> = {
  red: 0.15 * Math.PI, black: -0.15 * Math.PI, odd: 0.55 * Math.PI, even: -0.55 * Math.PI, low: 0.85 * Math.PI, high: -0.85 * Math.PI,
};

function chipSpotForBet(bet: RouletteBetVisual | null): { x: number; z: number } | null {
  if (!bet) return null;
  if (bet.kind === 'straight') {
    if (bet.number === undefined) return null;
    const a = angleForNumber(bet.number);
    return { x: Math.cos(a) * 0.6, z: Math.sin(a) * 0.6 };
  }
  const a = OUTSIDE_BET_ANGLE[bet.kind];
  if (a === undefined) return null;
  return { x: Math.cos(a) * 0.68, z: Math.sin(a) * 0.68 };
}

function makeSlotCabinet(m: CasinoMachineView): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.4, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.6), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  const tex = cabinetScreenTexture(m.name, m.jackpot, m.locked);
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.34), screenMat);
  screen.position.set(0, 1.08, 0.305);
  g.add(screen);
  const reelMat = new THREE.MeshStandardMaterial({ map: reelWindowTexture(), roughness: 0.5 });
  const reel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), reelMat);
  reel.position.set(0, 0.78, 0.305);
  g.add(reel);
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x9aa1ac, metalness: 0.6, roughness: 0.3 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.22), trayMat);
  tray.position.set(0, 0.14, 0.34);
  g.add(tray);
  const topper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: m.color, emissive: m.color, emissiveIntensity: 0.45 }));
  topper.position.y = 1.5;
  g.add(topper);
  const armMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c4, metalness: 0.8, roughness: 0.25 });
  const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), armMat);
  armBase.rotation.z = Math.PI * 0.12;
  armBase.position.set(0.37, 1.15, 0);
  g.add(armBase);
  const armKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }));
  armKnob.position.set(0.43, 1.38, 0);
  g.add(armKnob);
  g.userData.screenMat = screenMat;
  g.userData.arm = armBase;
  return g;
}

function makeRouletteTable(chipCount: number): THREE.Group {
  const g = new THREE.Group();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.55 });
  const feltMat = new THREE.MeshStandardMaterial({ map: feltLayoutTexture(), roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.75, 32), [sideMat, feltMat, sideMat]);
  base.position.y = 0.375;
  g.add(base);
  const wheelTex = rouletteWheelTexture();
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.35, metalness: 0.7 });
  const topMat = new THREE.MeshStandardMaterial({ map: wheelTex, roughness: 0.3, metalness: 0.15, emissive: 0xffffff, emissiveMap: wheelTex, emissiveIntensity: 0.18 });
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 32), [rimMat, topMat, topMat]);
  wheel.position.y = 0.78;
  g.add(wheel);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.08 }));
  ball.position.set(0.32, 0.85, 0);
  g.add(ball);
  const chips = makeChipStack(CHIP_COLORS, chipCount);
  chips.position.set(0.58, 0.78, 0.4);
  g.add(chips);
  // The player's own bet marker — hidden until a bet type is actually selected.
  const betChip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 20), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.3 }));
  betChip.position.set(0, 0.79, 0);
  betChip.visible = false;
  g.add(betChip);
  g.userData.wheel = wheel;
  g.userData.ball = ball;
  g.userData.ballAngle = 0;
  g.userData.betChip = betChip;
  g.userData.spinPhase = 'idle';
  g.userData.lastToken = -1;
  g.userData.restAngle = 0;
  return g;
}

function makeCardTable(color: number, chipCount: number): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.6 }));
  base.position.y = 0.35;
  g.add(base);
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  felt.position.y = 0.72;
  g.add(felt);
  const cardMat = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.5 });
  for (const dx of [-0.14, 0.1]) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.22), cardMat);
    card.position.set(dx, 0.76, 0.05);
    card.rotation.y = dx * 0.6;
    g.add(card);
  }
  const chips = makeChipStack(CHIP_COLORS, chipCount);
  chips.position.set(-0.4, 0.75, -0.15);
  g.add(chips);
  return g;
}

function makeCoinStand(color: number): THREE.Group {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.65 }));
  stand.position.y = 0.35;
  g.add(stand);
  const edgeMat = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.3 });
  const headsMat = new THREE.MeshStandardMaterial({ map: coinFaceTexture('H', color), metalness: 0.4, roughness: 0.35 });
  const tailsMat = new THREE.MeshStandardMaterial({ map: coinFaceTexture('T', color), metalness: 0.4, roughness: 0.35 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 28), [edgeMat, headsMat, tailsMat]);
  coin.rotation.x = Math.PI / 2;
  coin.position.y = 0.9;
  g.add(coin);
  g.userData.coin = coin;
  return g;
}

function makeSportsbookKiosk(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x1c2027, metalness: 0.5, roughness: 0.4 }));
  post.position.y = 0.8;
  g.add(post);
  const screenMat = new THREE.MeshStandardMaterial({ map: sportsbookScreenTexture(), emissive: 0xffffff, emissiveIntensity: 0.6 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.78), screenMat);
  screen.position.set(0, 1.5, 0.07);
  g.add(screen);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.86, 0.06), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.4 }));
  frame.position.set(0, 1.5, 0);
  g.add(frame);
  return g;
}

function makeChandelier(withLight: boolean): THREE.Group {
  const g = new THREE.Group();
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x3a3226, metalness: 0.6, roughness: 0.4 });
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 6), chainMat);
  chain.position.y = 4.85;
  g.add(chain);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0x2b2418, metalness: 0.7, roughness: 0.3 }));
  canopy.position.y = 4.2;
  g.add(canopy);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe9a8, emissiveIntensity: 1.6 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), bulbMat);
    bulb.position.set(Math.cos(a) * 0.42, 4.05, Math.sin(a) * 0.42);
    g.add(bulb);
  }
  if (withLight) {
    const glow = new THREE.PointLight(0xffdca0, 1.1, 11);
    glow.position.y = 4.1;
    g.add(glow);
  }
  return g;
}

function makeColumn(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 4, 16), new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.5, metalness: 0.2 }));
  shaft.position.y = 2;
  g.add(shaft);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.3 });
  const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.22, 16), goldMat);
  capital.position.y = 4.05;
  g.add(capital);
  const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 16), goldMat);
  footing.position.y = 0.07;
  g.add(footing);
  return g;
}

export function CasinoScene({ machines, tables, onNearbyChange, paused, rouletteSpin, rouletteBet }: CasinoSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ x: 0, z: 0 });
  const nearbyRef = useRef<string | null>(null);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number } | null>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Keyboard movement (desktop + reliable for automated verification).
  useEffect(() => {
    const keys = new Set<string>();
    const apply = () => {
      if (pausedRef.current) { inputRef.current = { x: 0, z: 0 }; return; }
      let x = 0, z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      inputRef.current = { x, z };
    };
    const onDown = (e: KeyboardEvent) => { keys.add(e.code); apply(); };
    const onUp = (e: KeyboardEvent) => { keys.delete(e.code); apply(); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  const updateJoy = (clientX: number, clientY: number) => {
    if (pausedRef.current) return;
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const r = rect.width / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > r) { dx = (dx / dist) * r; dy = (dy / dist) * r; }
    setJoyKnob({ x: dx, y: dy });
    inputRef.current = { x: dx / r, z: dy / r };
  };
  const endJoy = () => {
    joyPointerId.current = null;
    setJoyKnob(null);
    inputRef.current = { x: 0, z: 0 };
  };
  const onJoyStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pausedRef.current) return;
    joyPointerId.current = e.pointerId;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not supported — window listeners still cover it */ }
    updateJoy(e.clientX, e.clientY);
  };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (joyPointerId.current !== e.pointerId) return;
      updateJoy(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      if (joyPointerId.current !== e.pointerId) return;
      endJoy();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Freeze in-flight movement the instant a bet panel opens.
  useEffect(() => {
    if (paused) { inputRef.current = { x: 0, z: 0 }; setJoyKnob(null); }
  }, [paused]);

  useThreeScene(
    ref,
    ({ scene, camera, addStars, quality }) => {
      const desktop = quality === 'desktop';
      scene.fog = new THREE.Fog(0x120a1a, 9, 28);
      scene.background = new THREE.Color(0x120a1a);
      addStars(desktop ? 150 : 60);
      scene.add(new THREE.AmbientLight(0x6644aa, desktop ? 0.32 : 0.4));
      const warm = new THREE.PointLight(0xffb347, 1.3, 15);
      warm.position.set(0, 4, 2);
      scene.add(warm);
      if (desktop) {
        const magenta = new THREE.PointLight(0xd946ef, 0.7, 12);
        magenta.position.set(-4, 3, -3);
        scene.add(magenta);
        const cyan = new THREE.PointLight(0x22d3ee, 0.6, 12);
        cyan.position.set(4, 3, -3);
        scene.add(cyan);
      }

      const floor = new THREE.Mesh(new THREE.CircleGeometry(9, desktop ? 48 : 28), new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9, 5, desktop ? 48 : 28, 1, true, -Math.PI * 0.95, Math.PI * 1.9),
        new THREE.MeshStandardMaterial({ color: 0x2a1533, roughness: 0.9, side: THREE.BackSide }),
      );
      wall.position.y = 2.5;
      scene.add(wall);

      if (desktop) {
        for (const x of [-6.5, 6.5]) {
          const col = makeColumn();
          col.position.set(x, 0, -3.5);
          scene.add(col);
        }
      }
      const chandelierPositions = desktop ? [-2.8, 2.8] : [0];
      chandelierPositions.forEach((x, i) => {
        const chandelier = makeChandelier(i === 0);
        chandelier.position.set(x, 0, 0.5);
        scene.add(chandelier);
      });

      // Slot machines, arced along the back wall.
      const interactive: { id: string; pos: { x: number; z: number } }[] = [];
      const cabinets = machines.map((m, i) => {
        const cab = makeSlotCabinet(m);
        const n = machines.length;
        const angle = (i / (n - 1) - 0.5) * Math.PI * 0.85;
        const radius = 4.6;
        const x = Math.sin(angle) * radius, z = -Math.cos(angle) * radius - 1;
        cab.position.set(x, 0, z);
        cab.lookAt(0, 0.75, 4);
        cab.userData.id = m.id;
        scene.add(cab);
        interactive.push({ id: m.id, pos: { x, z } });
        return cab;
      });

      // Table games, front and center — spaced wide enough that walking up to one doesn't also
      // trigger its neighbor's catchment zone.
      const chipCount = desktop ? 6 : 3;
      const tableGroups = tables.map((t, i) => {
        const grp = t.id === 'roulette' ? makeRouletteTable(chipCount) : t.id === 'heads_or_tails' ? makeCoinStand(t.color) : makeCardTable(t.color, chipCount);
        const x = (i - (tables.length - 1) / 2) * 2.5, z = 2.6;
        grp.position.set(x, 0, z);
        grp.userData.id = t.id;
        scene.add(grp);
        interactive.push({ id: t.id, pos: { x, z } });
        return grp;
      });

      // Sports book kiosk, off to the side.
      const sportsbook = makeSportsbookKiosk();
      sportsbook.position.set(-6.8, 0, 1.5);
      sportsbook.lookAt(0, 1.5, 1.5);
      scene.add(sportsbook);
      interactive.push({ id: SPORTSBOOK_ID, pos: { x: -6.8, z: 1.5 } });

      // Player avatar.
      const player = new THREE.Group();
      const playerBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 12), new THREE.MeshStandardMaterial({ color: 0x337dff, roughness: 0.5 }));
      playerBody.position.y = 0.5;
      player.add(playerBody);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 0.68, 0.28);
      player.add(nose);
      player.position.set(0, 0, 6);
      scene.add(player);

      camera.position.set(0, 3.6, 10.5);
      camera.lookAt(0, 1, 6);

      let heading = 0;
      let lastT = 0;

      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;

        const { x, z } = inputRef.current;
        const mag = Math.hypot(x, z);
        if (mag > 0.05) {
          const nx = x / Math.max(mag, 1);
          const nz = z / Math.max(mag, 1);
          player.position.x += nx * MOVE_SPEED * dt * Math.min(mag, 1);
          player.position.z += nz * MOVE_SPEED * dt * Math.min(mag, 1);
          const dist = Math.hypot(player.position.x, player.position.z);
          if (dist > WALK_BOUND) {
            player.position.x = (player.position.x / dist) * WALK_BOUND;
            player.position.z = (player.position.z / dist) * WALK_BOUND;
          }
          const targetHeading = Math.atan2(nx, nz);
          let diff = targetHeading - heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          heading += diff * 0.25;
          player.rotation.y = heading;
          playerBody.position.y = 0.5 + Math.sin(t * 10) * 0.02;
        }

        // Proximity, with hysteresis so the prompt doesn't flicker right at the boundary.
        let closest: string | null = null;
        let closestDist = Infinity;
        for (const it of interactive) {
          const d = Math.hypot(player.position.x - it.pos.x, player.position.z - it.pos.z);
          if (d < closestDist) { closestDist = d; closest = it.id; }
        }
        const threshold = nearbyRef.current ? EXIT_RADIUS : ENTER_RADIUS;
        const next = closest && closestDist < threshold ? closest : null;
        if (next !== nearbyRef.current) {
          nearbyRef.current = next;
          onNearbyChange(next);
        }

        camera.position.x += (player.position.x - camera.position.x) * 0.07;
        camera.position.z += (player.position.z + 4.5 - camera.position.z) * 0.07;
        camera.position.y = 3.6;
        camera.lookAt(player.position.x, 1, player.position.z);

        for (const cab of cabinets) {
          const near = cab.userData.id === nearbyRef.current;
          const bob = near ? Math.sin(t * 4) * 0.04 : 0;
          cab.position.y = bob;
          const mat = cab.userData.screenMat as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = near ? 1.1 + Math.sin(t * 5) * 0.25 : 0.7;
          if (cab.userData.arm) {
            (cab.userData.arm as THREE.Mesh).rotation.z = Math.PI * 0.12 + (near ? Math.sin(t * 6) * 0.15 : 0);
          }
        }
        for (const grp of tableGroups) {
          const near = grp.userData.id === nearbyRef.current;
          if (grp.userData.wheel) {
            const wheel = grp.userData.wheel as THREE.Mesh;
            const ball = grp.userData.ball as THREE.Mesh;
            if (rouletteSpin && rouletteSpin.token !== grp.userData.lastToken) {
              grp.userData.lastToken = rouletteSpin.token;
              grp.userData.spinPhase = 'spinning';
              grp.userData.phaseStart = t;
              grp.userData.restAngle = angleForNumber(rouletteSpin.landedNumber);
            }
            if (grp.userData.spinPhase === 'spinning') {
              const elapsed = t - grp.userData.phaseStart;
              const duration = 2.2;
              if (elapsed < duration) {
                const decel = 1 - elapsed / duration;
                wheel.rotation.y += 5 * decel * dt;
                grp.userData.ballAngle -= 6 * decel * dt;
              } else {
                grp.userData.spinPhase = 'resolved';
                grp.userData.ballAngle = grp.userData.restAngle;
              }
            } else if (grp.userData.spinPhase === 'idle') {
              const spin = near ? 3.4 : 0.15;
              wheel.rotation.y += spin * dt;
              grp.userData.ballAngle -= (near ? 4.2 : 0.05) * dt;
            }
            const ba = grp.userData.ballAngle as number;
            ball.position.set(Math.cos(ba) * 0.32, 0.85, Math.sin(ba) * 0.32);

            const chip = grp.userData.betChip as THREE.Mesh;
            const spot = near ? chipSpotForBet(rouletteBet) : null;
            chip.visible = !!spot;
            if (spot) chip.position.set(spot.x, 0.79, spot.z);
          } else if (grp.userData.coin) {
            (grp.userData.coin as THREE.Mesh).rotation.y += near ? 0.35 : 0.02;
          } else {
            grp.rotation.y = near ? Math.sin(t * 2) * 0.05 : 0;
          }
        }
      };
    },
    [
      machines.map((m) => `${m.id}:${m.jackpot.toFixed(0)}:${m.locked}`).join(','),
      tables.map((t) => t.id).join(','),
      rouletteSpin?.token,
      rouletteBet?.kind,
      rouletteBet?.number,
    ],
    { controls: 'none' },
  );

  return (
    <div className="relative w-full h-full bg-slate-950 select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
      <div ref={ref} className="absolute inset-0" />
      {!paused && (
        <>
          <div
            ref={joyBaseRef}
            onPointerDown={onJoyStart}
            className="absolute left-5 bottom-5 w-24 h-24 rounded-full bg-white/10 border border-white/20 touch-none"
            style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          >
            <div
              className="absolute w-10 h-10 rounded-full bg-white/70"
              style={{
                left: `calc(50% - 20px + ${joyKnob?.x ?? 0}px)`,
                top: `calc(50% - 20px + ${joyKnob?.y ?? 0}px)`,
                transition: joyKnob ? 'none' : 'left 0.15s, top 0.15s',
              }}
            />
          </div>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/30 px-3 py-1 rounded-full">
            Drag the stick or use WASD / arrow keys to walk
          </div>
        </>
      )}
    </div>
  );
}
