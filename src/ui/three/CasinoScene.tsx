/**
 * The casino floor: every named slot machine cabinet real and distinct (its own color, its own
 * screen showing its own name and live jackpot pool, a reel window, a coin tray), a real
 * red/black/green roulette wheel with a numbered felt layout and an orbiting ball, a spinning
 * coin stand for heads-or-tails, and felt card tables with chip stacks — laid out as one enclosed
 * room (patterned carpet, a back wall, flanking columns, two hanging chandeliers) so the floor
 * reads as a real place, not a menu floating in a void. Selecting a game in the panel below
 * highlights its cabinet/table here (glow + a spin-up) so the two stay visibly connected. Ambient
 * only (orbit-drag/zoom via useThreeScene, no walking) — sized by its parent container, so the
 * caller controls whether it's a small preview or a fullscreen takeover.
 */
import { useRef } from 'react';
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

interface CasinoSceneProps {
  machines: CasinoMachineView[];
  tables: { id: string; name: string; color: number }[];
  selectedId: string | null;
}

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
  // Reel window below the jackpot screen — the three-symbol strip that reads "slot machine" at a glance.
  const reelMat = new THREE.MeshStandardMaterial({ map: reelWindowTexture(), roughness: 0.5 });
  const reel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), reelMat);
  reel.position.set(0, 0.78, 0.305);
  g.add(reel);
  // Coin tray at the base.
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x9aa1ac, metalness: 0.6, roughness: 0.3 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.22), trayMat);
  tray.position.set(0, 0.14, 0.34);
  g.add(tray);
  const topper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: m.color, emissive: m.color, emissiveIntensity: 0.45 }));
  topper.position.y = 1.5;
  g.add(topper);
  // A classic side lever — cosmetic, but it's the single detail that reads "slot machine" at a glance.
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
  g.userData.baseY = 0;
  return g;
}

function makeRouletteTable(): THREE.Group {
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
  const chips = makeChipStack(CHIP_COLORS, 6);
  chips.position.set(0.58, 0.78, 0.4);
  g.add(chips);
  g.userData.wheel = wheel;
  g.userData.ball = ball;
  g.userData.ballAngle = 0;
  return g;
}

function makeCardTable(color: number): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.6 }));
  base.position.y = 0.35;
  g.add(base);
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  felt.position.y = 0.72;
  g.add(felt);
  // Two face-down cards resting on the felt — cheap detail that reads as a card table.
  const cardMat = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, roughness: 0.5 });
  for (const dx of [-0.14, 0.1]) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.22), cardMat);
    card.position.set(dx, 0.76, 0.05);
    card.rotation.y = dx * 0.6;
    g.add(card);
  }
  const chips = makeChipStack(CHIP_COLORS, 5);
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

function makeChandelier(): THREE.Group {
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
  const glow = new THREE.PointLight(0xffdca0, 1.1, 11);
  glow.position.y = 4.1;
  g.add(glow);
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

export function CasinoScene({ machines, tables, selectedId }: CasinoSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, addStars }) => {
      scene.fog = new THREE.Fog(0x120a1a, 9, 28);
      scene.background = new THREE.Color(0x120a1a);
      addStars(150);
      scene.add(new THREE.AmbientLight(0x6644aa, 0.32));
      const warm = new THREE.PointLight(0xffb347, 1.3, 15);
      warm.position.set(0, 4, 2);
      scene.add(warm);
      const magenta = new THREE.PointLight(0xd946ef, 0.7, 12);
      magenta.position.set(-4, 3, -3);
      scene.add(magenta);
      const cyan = new THREE.PointLight(0x22d3ee, 0.6, 12);
      cyan.position.set(4, 3, -3);
      scene.add(cyan);

      const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      // Enclosing back wall, flanking columns, and hanging chandeliers so the floor reads as a
      // real room, not a fog-shrouded void — the single biggest cue that this is a place you
      // could walk into.
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9, 5, 48, 1, true, -Math.PI * 0.95, Math.PI * 1.9),
        new THREE.MeshStandardMaterial({ color: 0x2a1533, roughness: 0.9, side: THREE.BackSide }),
      );
      wall.position.y = 2.5;
      scene.add(wall);

      for (const x of [-6.5, 6.5]) {
        const col = makeColumn();
        col.position.set(x, 0, -3.5);
        scene.add(col);
      }
      for (const x of [-2.8, 2.8]) {
        const chandelier = makeChandelier();
        chandelier.position.set(x, 0, 0.5);
        scene.add(chandelier);
      }

      // Slot machines, arced along the back wall.
      const cabinets = machines.map((m, i) => {
        const cab = makeSlotCabinet(m);
        const n = machines.length;
        const angle = (i / (n - 1) - 0.5) * Math.PI * 0.85;
        const radius = 4.6;
        cab.position.set(Math.sin(angle) * radius, 0, -Math.cos(angle) * radius - 1);
        cab.lookAt(0, 0.75, 2);
        cab.userData.id = m.id;
        cab.userData.baseY = cab.position.y;
        scene.add(cab);
        return cab;
      });

      // Table games, front and center.
      const tableGroups = tables.map((t, i) => {
        const grp = t.id === 'roulette' ? makeRouletteTable() : t.id === 'heads_or_tails' ? makeCoinStand(t.color) : makeCardTable(t.color);
        grp.position.set((i - (tables.length - 1) / 2) * 1.8, 0, 2.2);
        grp.userData.id = t.id;
        grp.userData.baseY = grp.position.y;
        scene.add(grp);
        return grp;
      });

      camera.position.set(0, 4.2, 7.5);
      camera.lookAt(0, 1, -0.5);

      return (t) => {
        camera.position.x = Math.sin(t * 0.05) * 1.2;
        camera.lookAt(0, 1, -0.5);
        for (const cab of cabinets) {
          const selected = cab.userData.id === selectedId;
          const bob = selected ? Math.sin(t * 4) * 0.04 : 0;
          cab.position.y = cab.userData.baseY + bob;
          const mat = cab.userData.screenMat as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = selected ? 1.1 + Math.sin(t * 5) * 0.25 : 0.7;
          if (cab.userData.arm) {
            const arm = cab.userData.arm as THREE.Mesh;
            arm.rotation.z = Math.PI * 0.12 + (selected ? Math.sin(t * 6) * 0.15 : 0);
          }
        }
        for (const grp of tableGroups) {
          const selected = grp.userData.id === selectedId;
          if (grp.userData.wheel) {
            const spin = selected ? 3.4 : 0.15;
            (grp.userData.wheel as THREE.Mesh).rotation.y += spin * 0.02;
            grp.userData.ballAngle -= (selected ? 4.2 : 0.05) * 0.016;
            const ba = grp.userData.ballAngle as number;
            (grp.userData.ball as THREE.Mesh).position.set(Math.cos(ba) * 0.32, 0.85, Math.sin(ba) * 0.32);
          } else if (grp.userData.coin) {
            (grp.userData.coin as THREE.Mesh).rotation.y += selected ? 0.35 : 0.02;
          } else {
            grp.rotation.y = selected ? Math.sin(t * 2) * 0.05 : 0;
          }
        }
      };
    },
    [machines.map((m) => `${m.id}:${m.jackpot.toFixed(0)}:${m.locked}`).join(','), tables.map((t) => t.id).join(','), selectedId],
  );

  return <div ref={ref} className="w-full h-full bg-slate-950" />;
}
