/** Ambient 3D supply chain visualization: goods flow as particles from source through
 * factory, warehouse and port to store and consumer. Flow density/speed reflects
 * revenue scale; resilience controls how steady (vs. glitchy/stalling) the flow looks. */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

interface SupplyChainSceneProps {
  supplyChainResilience: number; // 0..100
  revenue: number;
}

const STAGES = [
  { label: 'Source', geo: () => new THREE.IcosahedronGeometry(0.35, 0), color: 0x7c9c4a },
  { label: 'Factory', geo: () => new THREE.BoxGeometry(0.6, 0.6, 0.6), color: 0xd88a3f },
  { label: 'Warehouse', geo: () => new THREE.CylinderGeometry(0.35, 0.35, 0.6, 12), color: 0x5b8def },
  { label: 'Port', geo: () => new THREE.TorusGeometry(0.32, 0.14, 8, 20), color: 0x3fb0d8 },
  { label: 'Store', geo: () => new THREE.ConeGeometry(0.35, 0.6, 12), color: 0xe0567a },
  { label: 'Consumer', geo: () => new THREE.SphereGeometry(0.3, 16, 16), color: 0xf5d76e },
];

export function SupplyChainScene({ supplyChainResilience, revenue }: SupplyChainSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, makeLabel }) => {
      scene.fog = new THREE.Fog(0x0b1220, 8, 18);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1);
      sun.position.set(4, 6, 5);
      scene.add(sun);

      const spacing = 1.7;
      const startX = -((STAGES.length - 1) * spacing) / 2;
      const nodePositions: THREE.Vector3[] = [];
      STAGES.forEach((stage, i) => {
        const mesh = new THREE.Mesh(stage.geo(), new THREE.MeshStandardMaterial({ color: stage.color, roughness: 0.4 }));
        const pos = new THREE.Vector3(startX + i * spacing, 0, 0);
        mesh.position.copy(pos);
        scene.add(mesh);
        nodePositions.push(pos);

        const label = makeLabel(stage.label, 0.42);
        label.position.set(pos.x, -0.75, pos.z);
        scene.add(label);

        // connecting rail
        if (i > 0) {
          const prev = nodePositions[i - 1];
          const railGeo = new THREE.BufferGeometry().setFromPoints([prev, pos]);
          const rail = new THREE.Line(railGeo, new THREE.LineBasicMaterial({ color: 0x334155 }));
          scene.add(rail);
        }
      });

      // Flow particles: density scales with revenue (capped), speed/steadiness with resilience.
      const particleCount = Math.max(6, Math.min(24, Math.round(Math.log10(Math.max(1000, revenue)) * 4)));
      const speed = 0.25 + (supplyChainResilience / 100) * 0.5;
      const jitter = 1 - supplyChainResilience / 100;
      const particleGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const particles: { mesh: THREE.Mesh; phase: number }[] = [];
      for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(particleGeo, particleMat);
        scene.add(mesh);
        particles.push({ mesh, phase: (i / particleCount) * (STAGES.length - 1) });
      }

      camera.position.set(0, 2.6, 5.5);
      camera.lookAt(0, 0, 0);

      return (t) => {
        for (const p of particles) {
          const stall = jitter > 0.5 && Math.sin(t * 0.6 + p.phase * 3) < -0.85 ? 0 : 1;
          const progress = ((p.phase + t * speed * stall) % (STAGES.length - 1) + (STAGES.length - 1)) % (STAGES.length - 1);
          const idx = Math.floor(progress);
          const frac = progress - idx;
          const a = nodePositions[idx];
          const b = nodePositions[Math.min(idx + 1, STAGES.length - 1)];
          p.mesh.position.lerpVectors(a, b, frac);
          p.mesh.position.y = 0.15 + Math.sin(t * 3 + p.phase * 5) * jitter * 0.08;
        }
        camera.position.x = Math.sin(t * 0.08) * 1.2;
        camera.lookAt(0, 0, 0);
      };
    },
    [supplyChainResilience, revenue],
  );

  return <div ref={ref} className="w-full h-44 rounded-2xl overflow-hidden bg-slate-950" />;
}
