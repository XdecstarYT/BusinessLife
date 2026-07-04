/** Ambient 3D "election map": one bar per city, arranged in a ring, growing up from the
 * floor and colored green/red by the player's local vote share. A lightweight stand-in
 * for a literal interactive electorate map, laid out procedurally since city objects
 * carry no real-world coordinates. */
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
    ({ scene, camera }) => {
      scene.fog = new THREE.Fog(0x0b1220, 8, 20);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1);
      sun.position.set(5, 8, 4);
      scene.add(sun);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(6, 48),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 1 }),
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      const n = Math.max(1, regionalBreakdown.length);
      const radius = 3.2;
      const bars: { mesh: THREE.Mesh; targetHeight: number; growth: number }[] = [];
      regionalBreakdown.forEach((r, i) => {
        const angle = (i / n) * Math.PI * 2;
        const won = r.playerSharePct >= 50;
        const color = won ? 0x34d399 : 0xf43f5e;
        const targetHeight = 0.3 + (r.playerSharePct / 100) * 2.4;
        const geo = new THREE.BoxGeometry(0.5, 1, 0.5);
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
        mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        mesh.scale.y = 0.01;
        scene.add(mesh);
        bars.push({ mesh, targetHeight, growth: 0 });
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
        camera.position.x = Math.sin(t * 0.1) * 8;
        camera.position.z = Math.cos(t * 0.1) * 8;
        camera.lookAt(0, 1, 0);
      };
    },
    [regionalBreakdown],
  );

  return <div ref={ref} className="w-full h-48 rounded-2xl overflow-hidden bg-slate-950" />;
}
