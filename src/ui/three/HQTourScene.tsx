/** Ambient 3D corporate HQ visualization: a building that grows with HQ tier, with
 * animated employee "dots" wandering the campus, colored by morale. */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

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

export function HQTourScene({ hqTier, employees, morale, culture }: HQTourSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera }) => {
      scene.background = null;
      scene.fog = new THREE.Fog(0x0b1220, 12, 30);

      const ambient = new THREE.AmbientLight(0xffffff, 0.55);
      scene.add(ambient);
      const sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.set(6, 10, 4);
      scene.add(sun);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(9, 48),
        new THREE.MeshStandardMaterial({ color: 0x141d2e, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      // Building: a stack of floors, more/taller/wider with higher HQ tier.
      const floors = hqTier + 1;
      const tint = CULTURE_TINT[culture];
      const buildingGroup = new THREE.Group();
      const footprint = 1.4 + hqTier * 0.35;
      for (let i = 0; i < floors; i++) {
        const height = 0.9;
        const shrink = 1 - i * 0.04;
        const floorMesh = new THREE.Mesh(
          new THREE.BoxGeometry(footprint * shrink, height, footprint * shrink),
          new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5, metalness: 0.15 }),
        );
        floorMesh.position.y = height * i + height / 2;
        buildingGroup.add(floorMesh);
        const glow = new THREE.Mesh(
          new THREE.BoxGeometry(footprint * shrink * 1.001, height * 0.15, footprint * shrink * 1.001),
          new THREE.MeshBasicMaterial({ color: 0xfff2c2, transparent: true, opacity: 0.5 }),
        );
        glow.position.y = height * i + height * 0.85;
        buildingGroup.add(glow);
      }
      scene.add(buildingGroup);

      // Employees: small capsules wandering the campus, colored by morale.
      const count = Math.max(4, Math.min(28, Math.round(employees / 60)));
      const moraleColor = new THREE.Color().setHSL(Math.max(0, Math.min(120, morale * 1.2)) / 360, 0.65, 0.55);
      const people: { mesh: THREE.Mesh; radius: number; speed: number; offset: number; y: number }[] = [];
      const peopleGeo = new THREE.CapsuleGeometry(0.08, 0.18, 4, 6);
      const peopleMat = new THREE.MeshStandardMaterial({ color: moraleColor });
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(peopleGeo, peopleMat);
        const radius = footprint * 0.9 + Math.random() * 3.5;
        const offset = Math.random() * Math.PI * 2;
        const y = 0.15;
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
          p.mesh.position.y = p.y + Math.sin(t * 2 + p.offset) * 0.03;
        }
      };
    },
    [hqTier, employees, morale, culture],
  );

  return <div ref={ref} className="w-full h-52 rounded-2xl overflow-hidden bg-slate-950" />;
}
