/**
 * The casino floor: every named slot machine cabinet real and distinct (its own color, its own
 * screen showing its own name and live jackpot pool), a spinning roulette wheel, and blackjack
 * / poker tables — laid out as one room so the whole floor reads as a real place, not a menu.
 * Selecting a game in the panel below highlights its cabinet here (glow + a gentle pulse) so the
 * two stay visibly connected. Ambient only (orbit-drag/zoom via useThreeScene, no walking) — the
 * actual play controls live in ordinary, always-reliable HTML below the canvas.
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

function makeSlotCabinet(m: CasinoMachineView): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.45, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.6), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  const tex = cabinetScreenTexture(m.name, m.jackpot, m.locked);
  const screenMat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.34), screenMat);
  screen.position.set(0, 1.05, 0.305);
  g.add(screen);
  const topper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: m.color, emissive: m.color, emissiveIntensity: 0.4 }));
  topper.position.y = 1.5;
  g.add(topper);
  g.userData.screenMat = screenMat;
  g.userData.baseY = 0;
  return g;
}

function makeRouletteTable(color: number): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.75, 24), new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.6 }));
  base.position.y = 0.375;
  g.add(base);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5, emissive: color, emissiveIntensity: 0.12 }));
  wheel.position.y = 0.78;
  g.add(wheel);
  g.userData.wheel = wheel;
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
  return g;
}

export function CasinoScene({ machines, tables, selectedId }: CasinoSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, addStars }) => {
      scene.fog = new THREE.Fog(0x120a1a, 8, 26);
      scene.background = new THREE.Color(0x120a1a);
      addStars(150);
      scene.add(new THREE.AmbientLight(0x6644aa, 0.35));
      const warm = new THREE.PointLight(0xffb347, 1.3, 14);
      warm.position.set(0, 4, 2);
      scene.add(warm);
      const magenta = new THREE.PointLight(0xd946ef, 0.7, 12);
      magenta.position.set(-4, 3, -3);
      scene.add(magenta);
      const cyan = new THREE.PointLight(0x22d3ee, 0.6, 12);
      cyan.position.set(4, 3, -3);
      scene.add(cyan);

      const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 40), new THREE.MeshStandardMaterial({ color: 0x1c0f24, roughness: 0.85 }));
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

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
        const grp = t.id === 'roulette' ? makeRouletteTable(t.color) : makeCardTable(t.color);
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
        }
        for (const grp of tableGroups) {
          const selected = grp.userData.id === selectedId;
          if (grp.userData.wheel) {
            grp.userData.wheel.rotation.y += selected ? 0.12 : 0.01;
          } else {
            grp.rotation.y = selected ? Math.sin(t * 2) * 0.05 : 0;
          }
        }
      };
    },
    [machines.map((m) => `${m.id}:${m.jackpot.toFixed(0)}:${m.locked}`).join(','), tables.map((t) => t.id).join(','), selectedId],
  );

  return <div ref={ref} className="w-full h-64 rounded-2xl overflow-hidden bg-slate-950" />;
}
