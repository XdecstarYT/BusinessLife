/** Ambient 3D supply chain visualization: goods flow as freight wagons from source through
 * factory, warehouse and port to store and consumer. Flow density/speed reflects revenue scale;
 * resilience controls how steady (vs. glitchy/stalling) the flow looks and tints the connecting
 * rail. (V52) Each stage now reads as a small building — silo cluster, factory, warehouse, port
 * crane, storefront, house — instead of an abstract primitive, and the flowing particles are
 * boxy little train wagons riding the rail rather than glowing orbs. */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

interface SupplyChainSceneProps {
  supplyChainResilience: number; // 0..100
  revenue: number;
}

type StageKind = 'silo' | 'factory' | 'warehouse' | 'port' | 'store' | 'house';

const STAGES: { label: string; kind: StageKind; color: number; metalness: number }[] = [
  { label: 'Source', kind: 'silo', color: 0x7c9c4a, metalness: 0.1 },
  { label: 'Factory', kind: 'factory', color: 0xd88a3f, metalness: 0.6 },
  { label: 'Warehouse', kind: 'warehouse', color: 0x5b8def, metalness: 0.3 },
  { label: 'Port', kind: 'port', color: 0x3fb0d8, metalness: 0.7 },
  { label: 'Store', kind: 'store', color: 0xe0567a, metalness: 0.2 },
  { label: 'Consumer', kind: 'house', color: 0xf5d76e, metalness: 0.1 },
];

// Every stage building sits with its base near local y = -0.3 so it keeps the same gentle
// "floating above its glowing pedestal" footprint the old primitive stand-ins had.
const BASE_Y = -0.3;

function buildSiloCluster(color: number, metalness: number): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2f, roughness: 0.5 });
  const silos: [number, number, number][] = [[-0.13, 0.55, 0.15], [0.14, 0.42, 0.12]]; // dx, height, radius
  for (const [dx, h, r] of silos) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), bodyMat);
    body.position.set(dx, BASE_Y + h / 2, 0);
    g.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, r * 1.1, 12), capMat);
    cap.position.set(dx, BASE_Y + h + (r * 1.1) / 2, 0);
    g.add(cap);
  }
  return g;
}

function buildFactory(color: number, metalness: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.4), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness }));
  body.position.y = BASE_Y + 0.21;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.44), new THREE.MeshStandardMaterial({ color: 0x2a2f22, roughness: 0.7 }));
  roof.position.y = BASE_Y + 0.45;
  g.add(roof);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.32, 8), new THREE.MeshStandardMaterial({ color: 0x555a52, roughness: 0.6 }));
  chimney.position.set(0.18, BASE_Y + 0.58, -0.1);
  g.add(chimney);
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.45, roughness: 1 }));
  smoke.position.set(0.18, BASE_Y + 0.78, -0.1);
  g.add(smoke);
  return g;
}

function buildWarehouse(color: number, metalness: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.42), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness }));
  body.position.y = BASE_Y + 0.2;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.46), new THREE.MeshStandardMaterial({ color: 0x2a2f22, roughness: 0.7 }));
  roof.position.y = BASE_Y + 0.425;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.24), new THREE.MeshStandardMaterial({ color: 0x1c2230, roughness: 0.8 }));
  door.position.set(0, BASE_Y + 0.12, 0.211);
  g.add(door);
  return g;
}

function buildPort(color: number, metalness: number): THREE.Group {
  const g = new THREE.Group();
  const dock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.8 }));
  dock.position.y = BASE_Y + 0.05;
  g.add(dock);
  const craneMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.55, 8), craneMat);
  mast.position.set(-0.1, BASE_Y + 0.375, 0);
  g.add(mast);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), craneMat);
  arm.position.set(0.05, BASE_Y + 0.6, 0);
  g.add(arm);
  const container = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), new THREE.MeshStandardMaterial({ color: 0xd8483f, roughness: 0.6 }));
  container.position.set(0.14, BASE_Y + 0.17, 0.12);
  g.add(container);
  return g;
}

function buildStore(color: number, metalness: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.36), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness }));
  body.position.y = BASE_Y + 0.17;
  g.add(body);
  const awning = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.16, 4), new THREE.MeshStandardMaterial({ color: 0x2a2f22, roughness: 0.6 }));
  awning.rotation.y = Math.PI / 4;
  awning.position.y = BASE_Y + 0.42;
  g.add(awning);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.08), new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff6d8, emissiveIntensity: 0.5 }));
  sign.position.set(0, BASE_Y + 0.2, 0.185);
  g.add(sign);
  return g;
}

function buildHouse(color: number, metalness: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.3), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness }));
  body.position.y = BASE_Y + 0.13;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0x8a5a3f, roughness: 0.7 }));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = BASE_Y + 0.36;
  g.add(roof);
  return g;
}

function buildStageModel(kind: StageKind, color: number, metalness: number): THREE.Group {
  switch (kind) {
    case 'silo': return buildSiloCluster(color, metalness);
    case 'factory': return buildFactory(color, metalness);
    case 'warehouse': return buildWarehouse(color, metalness);
    case 'port': return buildPort(color, metalness);
    case 'store': return buildStore(color, metalness);
    case 'house': return buildHouse(color, metalness);
  }
}

/** Green when steady, ambering toward red as resilience drops — the rail itself now doubles as
 * a live readout of the same jitter value driving how the wagons move along it. */
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

      const railColor = resilienceColor(supplyChainResilience);

      const spacing = 1.7;
      const startX = -((STAGES.length - 1) * spacing) / 2;
      const nodePositions: THREE.Vector3[] = [];
      const pulseMats: THREE.MeshStandardMaterial[] = [];
      STAGES.forEach((stage, i) => {
        const pos = new THREE.Vector3(startX + i * spacing, 0, 0);
        const buildingGroup = buildStageModel(stage.kind, stage.color, stage.metalness);
        buildingGroup.position.copy(pos);
        buildingGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; }
        });
        scene.add(buildingGroup);
        nodePositions.push(pos);

        // A small emissive pedestal under each node — grounds it visually and gives the
        // glow-on-activity a dedicated surface instead of tinting the building itself.
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x1a2740, emissive: stage.color, emissiveIntensity: 0.25, roughness: 0.5 });
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.1, 20), pedMat);
        pedestal.position.set(pos.x, -0.56, pos.z);
        pedestal.receiveShadow = true;
        scene.add(pedestal);
        pulseMats.push(pedMat);

        const label = makeLabel(stage.label, 0.42);
        label.position.set(pos.x, -0.85, pos.z);
        scene.add(label);

        // Connecting rail: a real tube (casts/receives light) instead of a flat unlit line,
        // colored by supply-chain resilience so the health of the chain reads at a glance.
        if (i > 0) {
          const prev = nodePositions[i - 1];
          const mid = new THREE.Vector3().lerpVectors(prev, pos, 0.5);
          const curve = new THREE.CatmullRomCurve3([prev, mid.clone().setY(mid.y - 0.08), pos]);
          const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.045, 8, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b, emissive: railColor, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.4,
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          tube.castShadow = true;
          scene.add(tube);
        }
      });

      // Freight wagons: density scales with revenue (capped), speed/steadiness with resilience.
      // Each is a boxy little train car (body + wheels) riding the rail rather than a glowing orb.
      const wagonCount = Math.max(6, Math.min(24, Math.round(Math.log10(Math.max(1000, revenue)) * 4)));
      const speed = 0.25 + (supplyChainResilience / 100) * 0.5;
      const jitter = 1 - supplyChainResilience / 100;
      const wagonBodyGeo = new THREE.BoxGeometry(0.17, 0.11, 0.1);
      const wagonMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, emissive: 0x8fa6c9, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.3 });
      const wheelGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c2230, roughness: 0.7 });
      const wagons: { group: THREE.Group; phase: number }[] = [];
      for (let i = 0; i < wagonCount; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(wagonBodyGeo, wagonMat);
        body.castShadow = true;
        g.add(body);
        for (const dz of [0.06, -0.06]) {
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(0, -0.075, dz);
          g.add(wheel);
        }
        scene.add(g);
        wagons.push({ group: g, phase: (i / wagonCount) * (STAGES.length - 1) });
      }

      camera.position.set(0, 2.6, 5.5);
      camera.lookAt(0, 0, 0);

      return (t) => {
        for (const w of wagons) {
          const stall = jitter > 0.5 && Math.sin(t * 0.6 + w.phase * 3) < -0.85 ? 0 : 1;
          const progress = ((w.phase + t * speed * stall) % (STAGES.length - 1) + (STAGES.length - 1)) % (STAGES.length - 1);
          const idx = Math.floor(progress);
          const frac = progress - idx;
          const a = nodePositions[idx];
          const b = nodePositions[Math.min(idx + 1, STAGES.length - 1)];
          w.group.position.lerpVectors(a, b, frac);
          w.group.position.y = 0.15 + Math.sin(t * 3 + w.phase * 5) * jitter * 0.08;
          const dir = b.clone().sub(a);
          if (dir.lengthSq() > 0.0001) w.group.rotation.y = Math.atan2(dir.x, dir.z);
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
