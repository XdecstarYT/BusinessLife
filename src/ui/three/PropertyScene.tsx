/**
 * A procedural massing model for a single owned or listed property — not a literal architectural
 * rendering (there's no real building-asset pipeline behind this, see public/models/README.md),
 * but a real, kind-specific 3D shape that scales with the listing's actual price tier and tints
 * toward grimy/neglected as its actual `condition` stat drops, so what you see always tracks the
 * real sim state rather than being decorative filler.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';
import type { PropertyAsset } from '../../sim/types';

interface PropertySceneProps {
  kind: PropertyAsset['kind'];
  value: number;
  condition: number; // 0..100; land is always treated as pristine
}

// Rough per-kind reference price so the same value produces a believably-scaled model whether
// it's a base listing or a top luxury tier of that same kind (see PROPERTY_TIERS in actions.ts).
const REFERENCE_VALUE: Record<PropertyAsset['kind'], number> = {
  apartment: 220_000, house: 480_000, mansion: 2_800_000, commercial: 3_500_000, land: 900_000, island: 45_000_000, penthouse: 6_500_000,
};

function conditionColor(condition: number, base: THREE.Color): THREE.Color {
  const grime = new THREE.Color(0x4b4437);
  const t = THREE.MathUtils.clamp((80 - condition) / 80, 0, 1) * 0.55;
  return base.clone().lerp(grime, t);
}

function windowTexture(rows: number, cols: number, lit: number): THREE.CanvasTexture {
  const w = 128, h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2b3140';
  ctx.fillRect(0, 0, w, h);
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = Math.random() < lit ? '#ffd98a' : '#141821';
      ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function PropertyScene({ kind, value, condition }: PropertySceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cond = kind === 'land' ? 100 : condition;

  useThreeScene(
    ref,
    ({ scene, camera, addStars }) => {
      scene.fog = new THREE.Fog(0x87ceeb, 14, 34);
      scene.background = new THREE.Color(0x87ceeb);
      scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3a3226, 0.7));
      const sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
      sun.position.set(6, 10, 4);
      sun.castShadow = true;
      scene.add(sun);

      const scale = THREE.MathUtils.clamp(Math.cbrt(value / REFERENCE_VALUE[kind]), 0.7, 2.3);

      const groundColor = kind === 'island' ? 0x1f6fb2 : 0x5a8f4f;
      const ground = new THREE.Mesh(new THREE.CircleGeometry(10, 40), new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.95 }));
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      const group = new THREE.Group();
      scene.add(group);

      if (kind === 'land') {
        const plot = new THREE.Mesh(new THREE.BoxGeometry(3.6 * scale, 0.06, 3.6 * scale), new THREE.MeshStandardMaterial({ color: conditionColor(cond, new THREE.Color(0x7a5230)), roughness: 1 }));
        plot.position.y = 0.03;
        group.add(plot);
        const postMat = new THREE.MeshStandardMaterial({ color: 0x8b6b3d, roughness: 0.9 });
        for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), postMat);
          post.position.set(dx * scale, 0.5, dz * scale);
          group.add(post);
        }
      } else if (kind === 'house' || kind === 'mansion') {
        const wide = kind === 'mansion';
        const w = (wide ? 2.6 : 1.7) * scale, d = (wide ? 2.0 : 1.4) * scale, h = (wide ? 1.5 : 1.1) * scale;
        const wallColor = conditionColor(cond, new THREE.Color(0xe7dcc8));
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.8, map: windowTexture(2, wide ? 6 : 3, 0.4) }));
        body.position.y = h / 2;
        body.castShadow = true;
        group.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x7a3b32, roughness: 0.7 }));
        roof.rotation.y = Math.PI / 4;
        roof.position.y = h + h * 0.3;
        group.add(roof);
        if (wide) {
          for (const dx of [-1, 1]) {
            const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, h * 0.95, 10), new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.5 }));
            column.position.set(dx * w * 0.32, h * 0.48, d / 2 + 0.1);
            group.add(column);
          }
        }
      } else if (kind === 'apartment' || kind === 'penthouse' || kind === 'commercial') {
        const floors = kind === 'penthouse' ? Math.round(10 + scale * 6) : kind === 'commercial' ? Math.round(6 + scale * 4) : Math.round(5 + scale * 3);
        const w = 1.4 * (kind === 'commercial' ? 1.3 : 1), d = 1.1 * (kind === 'commercial' ? 1.3 : 1);
        const h = floors * 0.32;
        const glassy = kind === 'commercial';
        const bodyColor = conditionColor(cond, new THREE.Color(glassy ? 0x86a8c9 : 0xd7d2c4));
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({ color: bodyColor, roughness: glassy ? 0.2 : 0.75, metalness: glassy ? 0.4 : 0, map: windowTexture(floors, 5, glassy ? 0.6 : 0.35) }),
        );
        body.position.y = h / 2;
        body.castShadow = true;
        group.add(body);
        if (kind === 'penthouse') {
          const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.3, d * 0.7), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.4, roughness: 0.3 }));
          crown.position.y = h + 0.15;
          group.add(crown);
        }
      } else if (kind === 'island') {
        const sand = new THREE.Mesh(new THREE.CylinderGeometry(2.4 * scale, 2.8 * scale, 0.4, 30), new THREE.MeshStandardMaterial({ color: 0xe8d3a0, roughness: 1 }));
        sand.position.y = 0.2;
        group.add(sand);
        const villa = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.5 * scale, 0.7 * scale), new THREE.MeshStandardMaterial({ color: conditionColor(cond, new THREE.Color(0xf5efe0)), roughness: 0.7 }));
        villa.position.y = 0.4 + 0.25 * scale;
        group.add(villa);
        for (const [dx, dz] of [[-1.4, 0.6], [1.2, -0.9], [0.4, 1.3]]) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2b }));
          trunk.position.set(dx * scale * 0.6, 0.4 + 0.55, dz * scale * 0.6);
          trunk.rotation.z = 0.15;
          group.add(trunk);
          const fronds = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0x2f7d32 }));
          fronds.position.set(dx * scale * 0.6, 1.05, dz * scale * 0.6);
          group.add(fronds);
        }
      }

      addStars(80);
      camera.position.set(4.5, 3.2, 5.5);
      camera.lookAt(0, 1, 0);

      return (t) => {
        group.rotation.y = t * 0.15;
      };
    },
    [kind, Math.round(value / 1000), Math.round(cond)],
  );

  return <div ref={ref} className="w-full h-56 rounded-2xl overflow-hidden bg-sky-200" />;
}
