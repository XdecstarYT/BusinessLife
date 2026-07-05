/**
 * The exchange trading floor: a central big board showing the real national
 * stock index trend, ringed by ticker booths for the day's biggest real
 * movers (green up, red down, bar height scaled to gain magnitude), with a
 * trading floor crowd that visibly speeds up when the market gets volatile.
 * Every number on this floor comes straight from `Country.economy` and the
 * live company list — nothing here is decorative filler.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

interface FloorMover {
  name: string;
  price: number;
  gainPct: number; // -1..1+
}

interface ExchangeFloorSceneProps {
  indexValue: number;
  indexChangePct: number;
  movers: FloorMover[];
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

function bigBoardTexture(indexValue: number, changePct: number): THREE.CanvasTexture {
  return makeTexture(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#080b12';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = changePct >= 0 ? '#34d399' : '#f43f5e';
    ctx.font = '700 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(indexValue.toFixed(0), w / 2, h * 0.52);
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText(`${changePct >= 0 ? '▲ +' : '▼ '}${(changePct * 100).toFixed(1)}%`, w / 2, h * 0.82);
  });
}

function tickerTexture(name: string, price: number, gainPct: number): THREE.CanvasTexture {
  return makeTexture(320, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, 14), w / 2, h * 0.36);
    ctx.fillStyle = gainPct >= 0 ? '#34d399' : '#f43f5e';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText(`$${price.toFixed(2)} ${gainPct >= 0 ? '▲' : '▼'}${Math.abs(gainPct * 100).toFixed(1)}%`, w / 2, h * 0.74);
  });
}

function makeTrader(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.34, 4, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  body.position.y = 0.34;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8c9a0 }));
  head.position.y = 0.58;
  g.add(head);
  return g;
}

export function ExchangeFloorScene({ indexValue, indexChangePct, movers }: ExchangeFloorSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, makeLabel }) => {
      scene.fog = new THREE.Fog(0x0b1220, 9, 34);
      scene.background = new THREE.Color(0x0b1220);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1);
      key.position.set(4, 9, 5);
      scene.add(key);

      const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshStandardMaterial({ color: 0x151b26, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      // Big board, front and center.
      const boardMat = new THREE.MeshStandardMaterial({
        map: bigBoardTexture(indexValue, indexChangePct),
        emissive: 0xffffff,
        emissiveMap: bigBoardTexture(indexValue, indexChangePct),
        emissiveIntensity: 0.9,
      });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.35), boardMat);
      board.position.set(0, 2.6, -3.4);
      scene.add(board);
      const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.55, 0.15), new THREE.MeshStandardMaterial({ color: 0x232a38, metalness: 0.4, roughness: 0.5 }));
      boardFrame.position.set(0, 2.6, -3.5);
      scene.add(boardFrame);

      // Ticker booths ringed around the floor, one per mover.
      const n = Math.max(1, movers.length);
      const radius = 4.4;
      movers.forEach((m, i) => {
        const angle = (i / n) * Math.PI * 1.5 - Math.PI * 0.75;
        const x = Math.sin(angle) * radius;
        const z = -Math.cos(angle) * radius * 0.6 - 1;
        const barH = 0.4 + Math.min(1.6, Math.abs(m.gainPct) * 6);
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, barH, 0.5),
          new THREE.MeshStandardMaterial({ color: m.gainPct >= 0 ? 0x34d399 : 0xf43f5e, emissive: m.gainPct >= 0 ? 0x34d399 : 0xf43f5e, emissiveIntensity: 0.25 }),
        );
        bar.position.set(x, barH / 2, z);
        scene.add(bar);
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(0.85, 0.34),
          new THREE.MeshStandardMaterial({ map: tickerTexture(m.name, m.price, m.gainPct), emissive: 0xffffff, emissiveMap: tickerTexture(m.name, m.price, m.gainPct), emissiveIntensity: 0.8 }),
        );
        screen.position.set(x, barH + 0.35, z);
        screen.lookAt(0, barH + 0.35, 0);
        scene.add(screen);
      });

      // Trading floor crowd — speed reacts to overall volatility.
      const avgAbsGain = movers.length ? movers.reduce((s, m) => s + Math.abs(m.gainPct), 0) / movers.length : 0;
      const traders = [0x8b5cf6, 0xf59e0b, 0x10b981, 0xef4444, 0x38bdf8].map((c, i) => {
        const t = makeTrader(c);
        t.userData.angle = (i / 5) * Math.PI * 2;
        t.userData.radius = 1.6 + (i % 2) * 0.5;
        t.userData.speed = 0.25 + avgAbsGain * 3 + i * 0.03;
        scene.add(t);
        return t;
      });

      const indexLabel = makeLabel(`${indexChangePct >= 0 ? 'Bull' : 'Bear'} market · vol ${(avgAbsGain * 100).toFixed(1)}%`, 0.45);
      indexLabel.position.set(0, 3.6, -3.4);
      scene.add(indexLabel);

      camera.position.set(0, 5.6, 8.5);
      camera.lookAt(0, 1.4, -1);

      return (t) => {
        camera.position.x = Math.sin(t * 0.06) * 1.6;
        camera.lookAt(0, 1.4, -1);
        for (const tr of traders) {
          tr.userData.angle += tr.userData.speed * 0.016;
          const a = tr.userData.angle, r = tr.userData.radius;
          tr.position.set(Math.cos(a) * r, Math.abs(Math.sin(t * 6 + a)) * 0.03, Math.sin(a) * r + 0.5);
          tr.rotation.y = -a + Math.PI / 2;
        }
        (boardMat as THREE.MeshStandardMaterial).emissiveIntensity = 0.75 + Math.sin(t * 1.5) * 0.15;
      };
    },
    [indexValue, indexChangePct, movers.map((m) => `${m.name}:${m.price}:${m.gainPct}`).join(',')],
  );

  return <div ref={ref} className="w-full h-56 rounded-2xl overflow-hidden bg-slate-950" />;
}
