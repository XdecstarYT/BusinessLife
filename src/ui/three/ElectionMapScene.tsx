/** Ambient 3D "election map": one spire per city, arranged in a ring around a central podium,
 * growing up from the floor and colored green/red by the player's local vote share. A
 * lightweight stand-in for a literal interactive electorate map, laid out procedurally since
 * city objects carry no real-world coordinates. */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

interface ElectionMapSceneProps {
  regionalBreakdown: { cityName: string; playerSharePct: number }[];
}

export function ElectionMapScene({ regionalBreakdown }: ElectionMapSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, addStars, makeLabel, quality }) => {
      scene.fog = new THREE.Fog(0x0b1220, 8, 40);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.set(5, 8, 4);
      if (quality === 'desktop') {
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -7;
        sun.shadow.camera.right = 7;
        sun.shadow.camera.top = 7;
        sun.shadow.camera.bottom = -7;
        sun.shadow.bias = -0.002;
      }
      scene.add(sun);
      addStars();

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(6, 64),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95, metalness: 0.05 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      // Overall race podium at the center — its glow color reads the player's aggregate result
      // at a glance, tying the ring of per-city spires together into one scene.
      const overallShare = regionalBreakdown.length
        ? regionalBreakdown.reduce((s, r) => s + r.playerSharePct, 0) / regionalBreakdown.length
        : 50;
      const overallColor = overallShare >= 50 ? 0x34d399 : 0xf43f5e;
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.85, 0.35, 24),
        new THREE.MeshStandardMaterial({ color: 0x1a2740, emissive: overallColor, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.3 }),
      );
      podium.position.y = 0.17;
      podium.castShadow = true;
      podium.receiveShadow = true;
      scene.add(podium);
      const podiumOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 24, 24),
        new THREE.MeshStandardMaterial({ color: overallColor, emissive: overallColor, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.5 }),
      );
      podiumOrb.position.y = 0.75;
      podiumOrb.castShadow = true;
      scene.add(podiumOrb);

      const n = Math.max(1, regionalBreakdown.length);
      const radius = 3.2;
      const bars: { mesh: THREE.Mesh; base: THREE.Mesh; targetHeight: number; growth: number }[] = [];
      regionalBreakdown.forEach((r, i) => {
        const angle = (i / n) * Math.PI * 2;
        const won = r.playerSharePct >= 50;
        const color = won ? 0x34d399 : 0xf43f5e;
        const targetHeight = 0.3 + (r.playerSharePct / 100) * 2.4;
        const px = Math.cos(angle) * radius;
        const pz = Math.sin(angle) * radius;

        // A tapered spire (wider base, narrower top) instead of a flat box — reads as a
        // monument/obelisk rather than a bar-chart column.
        const geo = new THREE.CylinderGeometry(0.16, 0.26, 1, 8);
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25 }));
        mesh.position.set(px, 0, pz);
        mesh.scale.y = 0.01;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.38, 0.08, 16),
          new THREE.MeshStandardMaterial({ color: 0x1a2740, emissive: color, emissiveIntensity: 0.3, roughness: 0.5 }),
        );
        base.position.set(px, 0.02, pz);
        base.receiveShadow = true;
        scene.add(base);

        bars.push({ mesh, base, targetHeight, growth: 0 });

        const label = makeLabel(`${r.cityName} · ${r.playerSharePct}%`, 0.55);
        label.position.set(px, targetHeight + 0.6, pz);
        scene.add(label);
      });

      camera.position.set(0, 5, 8);
      camera.lookAt(0, 1, 0);

      return (t) => {
        for (const bar of bars) {
          bar.growth = Math.min(1, bar.growth + 0.02);
          const eased = 1 - Math.pow(1 - bar.growth, 3);
          const h = Math.max(0.01, bar.targetHeight * eased);
          bar.mesh.scale.y = h;
          bar.mesh.position.y = h / 2;
        }
        podiumOrb.position.y = 0.75 + Math.sin(t * 1.5) * 0.05;
        podiumOrb.rotation.y = t * 0.6;
        camera.position.x = Math.sin(t * 0.1) * 8;
        camera.position.z = Math.cos(t * 0.1) * 8;
        camera.lookAt(0, 1, 0);
      };
    },
    [regionalBreakdown],
  );

  return <div ref={ref} className="w-full h-48 rounded-2xl overflow-hidden bg-slate-950" />;
}
