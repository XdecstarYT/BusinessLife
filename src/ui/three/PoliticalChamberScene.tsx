/**
 * The legislative chamber: a hemicycle of seat blocks, one per party, sized
 * by real seat count and colored by real ideology (blue-ish left, red-ish
 * right), with the player's own party outlined gold. Six cabinet podiums
 * line the front of the well, lit up when a portfolio is actually filled —
 * this is a literal rendering of `Country.parties`/`Country.cabinet`, not
 * a decorative backdrop.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

interface ChamberParty {
  id: string;
  name: string;
  seats: number;
  ideology: number; // -100..100
  isPlayerParty: boolean;
}

interface ChamberPortfolio {
  name: string;
  filled: boolean;
  byPlayer: boolean;
}

interface PoliticalChamberSceneProps {
  parties: ChamberParty[];
  totalSeats: number;
  isLeader: boolean;
  portfolios: ChamberPortfolio[];
}

function ideologyColor(ideology: number): THREE.Color {
  const t = (ideology + 100) / 200; // 0 = far left, 1 = far right
  return new THREE.Color(0x3b82f6).lerp(new THREE.Color(0xef4444), t);
}

export function PoliticalChamberScene({ parties, totalSeats, isLeader, portfolios }: PoliticalChamberSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, makeLabel }) => {
      scene.fog = new THREE.Fog(0x0b1220, 10, 34);
      scene.background = new THREE.Color(0x0b1220);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const spot = new THREE.SpotLight(0xfff2d8, 1.4, 30, Math.PI / 3.2, 0.4);
      spot.position.set(0, 9, 6);
      scene.add(spot);
      const fill = new THREE.DirectionalLight(0x99b3d9, 0.5);
      fill.position.set(-5, 6, -4);
      scene.add(fill);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(8, 48, Math.PI * 0.15, Math.PI * 0.7),
        new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.85 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      scene.add(floor);

      // Seats arranged in concentric hemicycle rows, one arc-segment per party sized by seat share.
      const totalRows = 4;
      const seatUnit = Math.max(1, totalSeats);
      let seatCursor = 0;
      const arcSpan = Math.PI * 0.72;
      const arcStart = Math.PI / 2 - arcSpan / 2;
      for (const party of parties) {
        const shareStart = seatCursor / seatUnit;
        seatCursor += party.seats;
        const shareEnd = seatCursor / seatUnit;
        const color = ideologyColor(party.ideology);
        const blockCount = Math.max(1, Math.round((party.seats / seatUnit) * 24));
        for (let i = 0; i < blockCount; i++) {
          const frac = shareStart + ((shareEnd - shareStart) * (i + 0.5)) / blockCount;
          const angle = arcStart + frac * arcSpan;
          const row = i % totalRows;
          const radius = 3.2 + row * 0.95;
          const x = Math.cos(angle) * radius;
          const z = -Math.sin(angle) * radius - 1;
          const seatMat = new THREE.MeshStandardMaterial({
            color,
            emissive: party.isPlayerParty ? 0xffd166 : 0x000000,
            emissiveIntensity: party.isPlayerParty ? 0.35 : 0,
            roughness: 0.5,
          });
          // A bench unit — seat pad + backrest — instead of one plain cube, so a row reads as
          // furniture people sit in, not a stack of colored blocks.
          const unit = new THREE.Group();
          const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.28), seatMat);
          cushion.position.y = 0.07;
          unit.add(cushion);
          const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.05), seatMat);
          backrest.position.set(0, 0.2, -0.12);
          unit.add(backrest);
          const deskMat = new THREE.MeshStandardMaterial({ color: 0x1c2230, roughness: 0.4, metalness: 0.2 });
          const desk = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.1), deskMat);
          desk.position.set(0, 0.16, 0.16);
          unit.add(desk);
          unit.position.set(x, 0.16 + row * 0.05, z);
          unit.lookAt(0, 0.16 + row * 0.05, 2);
          scene.add(unit);
        }
        const midAngle = arcStart + ((shareStart + shareEnd) / 2) * arcSpan;
        const label = makeLabel(`${party.name} · ${party.seats}`, 0.4);
        label.position.set(Math.cos(midAngle) * 5.6, 2.1, -Math.sin(midAngle) * 5.6 - 1);
        scene.add(label);
      }

      // Speaker's dais / seal, front and center.
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.5 }));
      dais.position.set(0, 0.25, 1.6);
      scene.add(dais);
      const seal = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshStandardMaterial({ color: isLeader ? 0xffd166 : 0x64748b, emissive: isLeader ? 0xffd166 : 0x000000, emissiveIntensity: isLeader ? 0.5 : 0, roughness: 0.35 }));
      seal.rotation.x = -Math.PI / 2;
      seal.position.set(0, 0.51, 1.6);
      scene.add(seal);

      // Six cabinet podiums along the front of the well.
      const podiums: { mesh: THREE.Mesh; filled: boolean }[] = [];
      portfolios.forEach((port, i) => {
        const n = portfolios.length;
        const x = (i - (n - 1) / 2) * 1.05;
        const z = 3.2;
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.32), new THREE.MeshStandardMaterial({ color: 0x232a38, roughness: 0.6 }));
        stand.position.set(x, 0.45, z);
        scene.add(stand);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 10),
          new THREE.MeshStandardMaterial({
            color: port.byPlayer ? 0xffd166 : port.filled ? 0x34d399 : 0x475569,
            emissive: port.filled ? (port.byPlayer ? 0xffd166 : 0x34d399) : 0x000000,
            emissiveIntensity: port.filled ? 0.8 : 0,
          }),
        );
        lamp.position.set(x, 0.95, z);
        scene.add(lamp);
        podiums.push({ mesh: lamp, filled: port.filled });
        const label = makeLabel(port.name, 0.32);
        label.position.set(x, 1.35, z);
        scene.add(label);
      });

      camera.position.set(0, 6.4, 9.5);
      camera.lookAt(0, 1, 0.5);

      return (t) => {
        camera.position.x = Math.sin(t * 0.08) * 2.2;
        camera.lookAt(0, 1, 0.5);
        for (const p of podiums) {
          if (p.filled) (p.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.2;
        }
      };
    },
    [parties.map((p) => `${p.id}:${p.seats}:${p.ideology}:${p.isPlayerParty}`).join(','), totalSeats, isLeader, portfolios.map((p) => `${p.name}:${p.filled}:${p.byPlayer}`).join(',')],
  );

  return <div ref={ref} className="w-full h-56 rounded-2xl overflow-hidden bg-slate-950" />;
}
