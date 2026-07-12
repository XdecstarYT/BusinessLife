/**
 * The courtroom: judge's bench, prosecution/defense tables, witness stand, and a jury box —
 * a literal rendering of two bits of real state, not a decorative backdrop. `verdict` tints the
 * bench light and gavel glow green/red/neutral for the outcome of the last case; `asJudge` flips
 * the camera from an advocate's-eye view at counsel table to sitting behind the bench looking out
 * over the room, once the player's own LegalCareer has reached the 'judge' stage.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

interface CourtroomSceneProps {
  verdict: 'pending' | 'won' | 'lost';
  asJudge: boolean;
}

function verdictColor(verdict: CourtroomSceneProps['verdict']): number {
  return verdict === 'won' ? 0x34d399 : verdict === 'lost' ? 0xd8483f : 0xd9a441;
}

function makeChair(seatColor: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.6 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.32), mat);
  seat.position.y = 0.42;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.05), mat);
  back.position.set(0, 0.63, -0.15);
  g.add(back);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.7 });
  for (const [dx, dz] of [[-0.14, 0.13], [0.14, 0.13], [-0.14, -0.13], [0.14, -0.13]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), legMat);
    leg.position.set(dx, 0.21, dz);
    g.add(leg);
  }
  return g;
}

export function CourtroomScene({ verdict, asJudge }: CourtroomSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useThreeScene(
    ref,
    ({ scene, camera, makeLabel, quality }) => {
      scene.fog = new THREE.Fog(0x0e1420, 9, 26);
      scene.background = new THREE.Color(0x0e1420);
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
      sun.position.set(3, 8, 5);
      if (quality === 'desktop') {
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -6; sun.shadow.camera.right = 6;
        sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
        sun.shadow.bias = -0.002;
      }
      scene.add(sun);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(9, 48),
        new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.85 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = quality === 'desktop';
      scene.add(floor);

      // Judge's bench, elevated at the back of the room.
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.55 });
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 1), woodMat);
      bench.position.set(0, 0.55, -4);
      bench.castShadow = true;
      bench.receiveShadow = true;
      scene.add(bench);
      const benchTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.15), woodMat);
      benchTop.position.set(0, 1.14, -4);
      scene.add(benchTop);
      const seal = new THREE.Mesh(
        new THREE.CircleGeometry(0.45, 24),
        new THREE.MeshStandardMaterial({ color: verdictColor(verdict), emissive: verdictColor(verdict), emissiveIntensity: 0.5, roughness: 0.4 }),
      );
      seal.position.set(0, 1.6, -4.49);
      scene.add(seal);

      // Witness stand, stage-right of the bench.
      const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.85, 12), woodMat);
      standBase.position.set(2.6, 0.42, -3);
      standBase.castShadow = true;
      scene.add(standBase);

      // Counsel tables facing the bench, prosecution left / defense right.
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x3f3327, roughness: 0.5 });
      for (const side of [-1, 1] as const) {
        const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.8), tableMat);
        table.position.set(side * 1.7, 0.45, -1);
        table.castShadow = true;
        scene.add(table);
        const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
        for (const dx of [-0.7, 0.7]) {
          const leg = new THREE.Mesh(legGeo, tableMat);
          leg.position.set(side * 1.7 + dx, 0.225, -1);
          scene.add(leg);
        }
        const chair = makeChair(side < 0 ? 0x3a5a7a : 0xb5651d);
        chair.position.set(side * 1.7, 0, -0.55);
        chair.rotation.y = Math.PI;
        scene.add(chair);
        const label = makeLabel(side < 0 ? 'Prosecution' : 'Defense', 0.32);
        label.position.set(side * 1.7, 1.05, -1);
        scene.add(label);
      }

      // Jury box: two rows of six along stage-left.
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 6; i++) {
          const chair = makeChair(0x4a4a52);
          chair.position.set(-4.2 - row * 0.6, 0, -3.2 + i * 0.5);
          chair.rotation.y = Math.PI / 2;
          scene.add(chair);
        }
      }
      const juryLabel = makeLabel('Jury', 0.32);
      juryLabel.position.set(-4.6, 1.0, -2.2);
      scene.add(juryLabel);

      // Public gallery: a few rows of simple benches facing the front.
      for (let row = 0; row < 3; row++) {
        const galleryBench = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 0.24), new THREE.MeshStandardMaterial({ color: 0x3f3327, roughness: 0.6 }));
        galleryBench.position.set(0, 0.25, 2.5 + row * 0.9);
        galleryBench.castShadow = true;
        scene.add(galleryBench);
      }

      // Gavel — a small floating prop above the bench, glow tied to the verdict color.
      const gavelMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3f, roughness: 0.5, emissive: verdictColor(verdict), emissiveIntensity: 0.3 });
      const gavelHead = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 12), gavelMat);
      gavelHead.rotation.z = Math.PI / 2;
      gavelHead.position.set(0.8, 1.5, -3.7);
      scene.add(gavelHead);
      const gavelHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), gavelMat);
      gavelHandle.position.set(0.8, 1.5, -3.7);
      gavelHandle.rotation.x = Math.PI / 5;
      scene.add(gavelHandle);

      if (asJudge) {
        camera.position.set(0, 1.9, -3.3);
        camera.lookAt(0, 1, 1.5);
      } else {
        camera.position.set(-1.7, 1.6, -0.2);
        camera.lookAt(0, 1.1, -4);
      }

      return (t) => {
        (seal.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + Math.sin(t * 1.5) * 0.15;
        gavelHead.position.y = 1.5 + Math.sin(t * 1.2) * 0.03;
        gavelHandle.position.y = gavelHead.position.y;
        if (!asJudge) {
          camera.position.x = -1.7 + Math.sin(t * 0.1) * 0.6;
          camera.lookAt(0, 1.1, -4);
        }
      };
    },
    [verdict, asJudge],
  );

  return <div ref={ref} className="w-full h-48 rounded-2xl overflow-hidden bg-slate-950" />;
}
