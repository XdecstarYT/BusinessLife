/** Ambient 3D supply chain visualization: goods flow as particles from source through
 * factory, warehouse and port to store and consumer. Flow density/speed reflects
 * revenue scale; resilience controls how steady (vs. glitchy/stalling) the flow looks, and
 * (V52) is now also visible directly in the connecting pipes' color and glow. */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

interface SupplyChainSceneProps {
  supplyChainResilience: number; // 0..100
  revenue: number;
}

const STAGES = [
  { label: 'Source', geo: () => new THREE.IcosahedronGeometry(0.35, 1), color: 0x7c9c4a, metalness: 0.1 },
  { label: 'Factory', geo: () => new THREE.BoxGeometry(0.6, 0.6, 0.6), color: 0xd88a3f, metalness: 0.6 },
  { label: 'Warehouse', geo: () => new THREE.CylinderGeometry(0.35, 0.35, 0.6, 16), color: 0x5b8def, metalness: 0.3 },
  { label: 'Port', geo: () => new THREE.TorusGeometry(0.32, 0.14, 12, 28), color: 0x3fb0d8, metalness: 0.7 },
  { label: 'Store', geo: () => new THREE.ConeGeometry(0.35, 0.6, 16), color: 0xe0567a, metalness: 0.2 },
  { label: 'Consumer', geo: () => new THREE.SphereGeometry(0.3, 24, 24), color: 0xf5d76e, metalness: 0.1 },
];

/** Green when steady, ambering toward red as resilience drops — the pipe itself now doubles as
 * a live readout of the same jitter value driving how the particles move through it. */
function resilienceColor(resilience: number): THREE.Color {
  const t = THREE.MathUtils.clamp(resilience / 100, 0, 1);
  const bad = new THREE.Color(0xd8483f);
  const mid = new THREE.Color(0xd8a63f);
  const good = new THREE.Color(0x4ad87f);
  return t < 0.5 ? bad.clone().lerp(mid, t * 2) : mid.clone().lerp(good, (t - 0.5) * 2);
}

export function SupplyChainScene({ supplyChainResilience, revenue }: SupplyChainSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, makeLabel, quality }) => {
      scene.fog = new THREE.Fog(0x0b1220, 8, 18);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.set(4, 6, 5);
      if (quality === 'desktop') {
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -5;
        sun.shadow.camera.right = 5;
        sun.shadow.camera.top = 4;
        sun.shadow.camera.bottom = -4;
        sun.shadow.bias = -0.002;
      }
      scene.add(sun);

      // A dark grounding plane so shadows/AO have something to land on instead of the nodes
      // floating over an empty void.
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(6, 48),
        new THREE.MeshStandardMaterial({ color: 0x0f1a2c, roughness: 0.85, metalness: 0.1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.62;
      ground.receiveShadow = true;
      scene.add(ground);

      const pipeColor = resilienceColor(supplyChainResilience);

      const spacing = 1.7;
      const startX = -((STAGES.length - 1) * spacing) / 2;
      const nodePositions: THREE.Vector3[] = [];
      const pulseMats: THREE.MeshStandardMaterial[] = [];
      STAGES.forEach((stage, i) => {
        const mat = new THREE.MeshStandardMaterial({ color: stage.color, roughness: 0.35, metalness: stage.metalness });
        const mesh = new THREE.Mesh(stage.geo(), mat);
        const pos = new THREE.Vector3(startX + i * spacing, 0, 0);
        mesh.position.copy(pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        nodePositions.push(pos);

        // A small emissive pedestal under each node — grounds it visually and gives the
        // glow-on-activity a dedicated surface instead of tinting the node mesh itself.
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x1a2740, emissive: stage.color, emissiveIntensity: 0.25, roughness: 0.5 });
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.1, 20), pedMat);
        pedestal.position.set(pos.x, -0.56, pos.z);
        pedestal.receiveShadow = true;
        scene.add(pedestal);
        pulseMats.push(pedMat);

        const label = makeLabel(stage.label, 0.42);
        label.position.set(pos.x, -0.85, pos.z);
        scene.add(label);

        // Connecting pipe: a real tube (casts/receives light) instead of a flat unlit line,
        // colored by supply-chain resilience so the health of the chain reads at a glance.
        if (i > 0) {
          const prev = nodePositions[i - 1];
          const mid = new THREE.Vector3().lerpVectors(prev, pos, 0.5);
          const curve = new THREE.CatmullRomCurve3([prev, mid.clone().setY(mid.y - 0.08), pos]);
          const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.045, 8, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b, emissive: pipeColor, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.4,
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          tube.castShadow = true;
          scene.add(tube);
        }
      });

      // Flow particles: density scales with revenue (capped), speed/steadiness with resilience.
      const particleCount = Math.max(6, Math.min(24, Math.round(Math.log10(Math.max(1000, revenue)) * 4)));
      const speed = 0.25 + (supplyChainResilience / 100) * 0.5;
      const jitter = 1 - supplyChainResilience / 100;
      const particleGeo = new THREE.SphereGeometry(0.09, 12, 12);
      const particleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.2 });
      const particles: { mesh: THREE.Mesh; phase: number }[] = [];
      for (let i = 0; i < particleCount; i++) {
        const mesh = new THREE.Mesh(particleGeo, particleMat);
        mesh.castShadow = true;
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
        for (let i = 0; i < pulseMats.length; i++) {
          pulseMats[i].emissiveIntensity = 0.2 + (Math.sin(t * 2 + i) * 0.5 + 0.5) * 0.25;
        }
        camera.position.x = Math.sin(t * 0.08) * 1.2;
        camera.lookAt(0, 0, 0);
      };
    },
    [supplyChainResilience, revenue],
  );

  return <div ref={ref} className="w-full h-44 rounded-2xl overflow-hidden bg-slate-950" />;
}
