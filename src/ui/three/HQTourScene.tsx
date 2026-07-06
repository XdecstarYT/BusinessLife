/** Ambient 3D corporate HQ visualization: a windowed building that grows with HQ tier, standing
 * on a paved courtyard, with proportioned employee figures wandering the grounds, colored by
 * morale — the same literal-space treatment as the City hub, not a stack of bare boxes. */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';
import { makeTexture, windowGridTexture } from './textures';

interface HQTourSceneProps {
  hqTier: number; // 0..3
  employees: number;
  morale: number; // 0..100
  culture: 'traditional' | 'flexible' | 'remote' | 'startup';
}

const CULTURE_TINT: Record<HQTourSceneProps['culture'], number> = {
  traditional: 0x8a95a5,
  flexible: 0x5b8def,
  remote: 0x9b6bd6,
  startup: 0xf5a623,
};

function courtyardTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1a2436';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    const grid = 16;
    for (let i = 0; i <= grid; i++) {
      const p = (i / grid) * w;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }
    ctx.fillStyle = '#243349';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.34, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** A small proportioned figure — legs, torso, arms, head — instead of a plain capsule "dot". */
function makeEmployee(color: THREE.Color): THREE.Group {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 8), new THREE.MeshStandardMaterial({ color: 0x232733, roughness: 0.75 }));
  legs.position.y = 0.14;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.14, 4, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  torso.position.y = 0.34;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.65 }));
  head.position.y = 0.48;
  g.add(head);
  return g;
}

export function HQTourScene({ hqTier, employees, morale, culture }: HQTourSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, addStars, quality }) => {
      const castsShadows = quality === 'desktop';
      scene.background = null;
      scene.fog = new THREE.Fog(0x0b1220, 12, 45);
      addStars(180);

      const ambient = new THREE.AmbientLight(0xffffff, 0.55);
      scene.add(ambient);
      const sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.set(6, 10, 4);
      if (castsShadows) {
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -10;
        sun.shadow.camera.right = 10;
        sun.shadow.camera.top = 10;
        sun.shadow.camera.bottom = -10;
        sun.shadow.bias = -0.0015;
      }
      scene.add(sun);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(9, 48),
        new THREE.MeshStandardMaterial({ map: courtyardTexture(), roughness: 0.9 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = castsShadows;
      scene.add(ground);

      // Building: a stack of floors, more/taller/wider with higher HQ tier, each with a real
      // windowed facade and a cornice cap instead of a plain colored box.
      const floors = hqTier + 1;
      const tint = CULTURE_TINT[culture];
      const buildingGroup = new THREE.Group();
      const footprint = 1.4 + hqTier * 0.35;
      const litRatio = 0.3 + (morale / 100) * 0.4;
      for (let i = 0; i < floors; i++) {
        const height = 0.9;
        const shrink = 1 - i * 0.04;
        const w = footprint * shrink;
        const floorMesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, height, w),
          new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5, metalness: 0.15 }),
        );
        floorMesh.position.y = height * i + height / 2;
        floorMesh.castShadow = castsShadows;
        floorMesh.receiveShadow = castsShadows;
        buildingGroup.add(floorMesh);
        // Windowed facades on all four sides so it reads as an occupied building, not a block.
        const windowTex = windowGridTexture(litRatio);
        const facadeRadius = w / 2 + 0.01;
        for (const rot of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          const facade = new THREE.Mesh(
            new THREE.PlaneGeometry(w * 0.92, height * 0.82),
            new THREE.MeshStandardMaterial({ map: windowTex, emissive: 0xffffff, emissiveMap: windowTex, emissiveIntensity: 0.8, roughness: 0.6 }),
          );
          facade.position.set(Math.sin(rot) * facadeRadius, height * i + height / 2, Math.cos(rot) * facadeRadius);
          facade.rotation.y = rot;
          buildingGroup.add(facade);
        }
        const cornice = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.05, w * 1.04), new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.6 }));
        cornice.position.y = height * i + height;
        buildingGroup.add(cornice);
      }
      // Rooftop cap + a small antenna to break up the flat top silhouette.
      const roofCap = new THREE.Mesh(new THREE.BoxGeometry(footprint * 0.5, 0.12, footprint * 0.5), new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.5 }));
      roofCap.position.y = floors * 0.9 + 0.06;
      buildingGroup.add(roofCap);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xcfcfcf }));
      antenna.position.y = floors * 0.9 + 0.42;
      buildingGroup.add(antenna);
      // Entrance canopy at street level.
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(footprint * 0.7, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: tint, metalness: 0.3, roughness: 0.4 }));
      canopy.position.set(0, 0.7, footprint / 2 + 0.3);
      buildingGroup.add(canopy);
      if (castsShadows) {
        buildingGroup.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; } });
      }
      scene.add(buildingGroup);

      // Employees: proportioned figures wandering the courtyard, colored by morale.
      const count = Math.max(4, Math.min(28, Math.round(employees / 60)));
      const moraleColor = new THREE.Color().setHSL(Math.max(0, Math.min(120, morale * 1.2)) / 360, 0.6, 0.5);
      const people: { mesh: THREE.Group; radius: number; speed: number; offset: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const mesh = makeEmployee(moraleColor);
        if (castsShadows) mesh.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.castShadow = true; });
        const radius = footprint * 0.9 + Math.random() * 3.5;
        const offset = Math.random() * Math.PI * 2;
        const y = 0;
        mesh.position.set(Math.cos(offset) * radius, y, Math.sin(offset) * radius);
        scene.add(mesh);
        people.push({ mesh, radius, speed: 0.15 + Math.random() * 0.25, offset, y });
      }

      camera.position.set(6, 5.5, 6);
      camera.lookAt(0, floors * 0.5, 0);

      return (t) => {
        const camRadius = 8;
        camera.position.x = Math.cos(t * 0.12) * camRadius;
        camera.position.z = Math.sin(t * 0.12) * camRadius;
        camera.position.y = 5 + Math.sin(t * 0.2) * 0.5;
        camera.lookAt(0, floors * 0.45, 0);
        for (const p of people) {
          const angle = p.offset + t * p.speed;
          p.mesh.position.x = Math.cos(angle) * p.radius;
          p.mesh.position.z = Math.sin(angle) * p.radius;
          p.mesh.rotation.y = -angle + Math.PI / 2;
          p.mesh.position.y = p.y + Math.abs(Math.sin(t * 4 + p.offset)) * 0.02;
        }
      };
    },
    [hqTier, employees, morale, culture],
  );

  return <div ref={ref} className="w-full h-52 rounded-2xl overflow-hidden bg-slate-950" />;
}
