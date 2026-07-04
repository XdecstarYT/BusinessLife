/** Ambient 3D trade network: home nation hub in the center, other nations arranged in a
 * ring, with planes and ships animating along routes whose traffic density reflects
 * relations — severed (war) routes are shown static and red instead of animated. */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

interface TradeRoute {
  name: string;
  relations: number; // -100..100
  atWar: boolean;
}

interface TradeNetworkSceneProps {
  homeName: string;
  routes: TradeRoute[];
}

export function TradeNetworkScene({ homeName, routes }: TradeNetworkSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera }) => {
      scene.fog = new THREE.Fog(0x0b1220, 10, 24);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1);
      sun.position.set(6, 10, 4);
      scene.add(sun);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(8, 48),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 1 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.3;
      scene.add(floor);

      const hub = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x5b8def, emissive: 0x1d3a7a, emissiveIntensity: 0.6 }),
      );
      scene.add(hub);

      const shown = routes.slice(0, 8);
      const n = Math.max(1, shown.length);
      const radius = 5.5;
      const movers: { mesh: THREE.Mesh; kind: 'plane' | 'ship'; target: THREE.Vector3; speed: number; phase: number }[] = [];

      shown.forEach((route, i) => {
        const angle = (i / n) * Math.PI * 2;
        const target = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        const nodeColor = route.atWar ? 0xe11d48 : 0x34d399;
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({ color: nodeColor }));
        node.position.copy(target);
        scene.add(node);

        const routeColor = route.atWar ? 0x7f1d1d : 0x334155;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), target]);
        scene.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: routeColor })));

        if (!route.atWar) {
          const trafficDensity = Math.max(0.15, (route.relations + 100) / 200);
          if (trafficDensity > 0.2) {
            const plane = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 6), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
            scene.add(plane);
            movers.push({ mesh: plane, kind: 'plane', target, speed: 0.35 + trafficDensity * 0.5, phase: Math.random() });
          }
          if (trafficDensity > 0.35) {
            const ship = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
            scene.add(ship);
            movers.push({ mesh: ship, kind: 'ship', target, speed: 0.12 + trafficDensity * 0.2, phase: Math.random() });
          }
        }
      });

      camera.position.set(0, 7, 9);
      camera.lookAt(0, 0, 0);

      return (t) => {
        for (const m of movers) {
          const progress = (t * m.speed + m.phase) % 1;
          const arcHeight = m.kind === 'plane' ? 1.4 : 0.15;
          const forward = progress < 0.5;
          const localT = forward ? progress * 2 : (progress - 0.5) * 2;
          const from = forward ? new THREE.Vector3(0, 0, 0) : m.target;
          const to = forward ? m.target : new THREE.Vector3(0, 0, 0);
          m.mesh.position.lerpVectors(from, to, localT);
          m.mesh.position.y = Math.sin(localT * Math.PI) * arcHeight;
          m.mesh.lookAt(to);
        }
        camera.position.x = Math.sin(t * 0.06) * 9;
        camera.position.z = Math.cos(t * 0.06) * 9;
        camera.lookAt(0, 0, 0);
        hub.rotation.y = t * 0.3;
      };
    },
    [homeName, routes],
  );

  return <div ref={ref} className="w-full h-52 rounded-2xl overflow-hidden bg-slate-950" />;
}
