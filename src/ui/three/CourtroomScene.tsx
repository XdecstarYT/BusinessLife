/**
 * The courtroom: judge's bench, prosecution/defense tables, witness stand, and a jury box —
 * a literal rendering of two bits of real state, not a decorative backdrop. `verdict` tints the
 * bench light and gavel glow green/red/neutral for the outcome of the last case; `asJudge` flips
 * the camera from an advocate's-eye view at counsel table to sitting behind the bench looking out
 * over the room, once the player's own LegalCareer has reached the 'judge' stage.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

type TrialPrompt = 'witness' | 'evidence' | 'objection';
const TRIAL_PROMPT_LABEL: Record<TrialPrompt, string> = { witness: 'Call Witness', evidence: 'Present Evidence', objection: 'Objection!' };
const TRIAL_ROUND_SECONDS = 15;

interface CourtroomSceneProps {
  verdict: 'pending' | 'won' | 'lost';
  asJudge: boolean;
  // V57: when set, the scene runs a real argument-building minigame instead of just sitting
  // ambient — tap the witness stand / counsel tables in time as each lights up. Final accuracy
  // is reported once via onComplete (see runTrialArgument in sim/legal.ts for what it's worth).
  interactive?: boolean;
  onComplete?: (score: number) => void;
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

export function CourtroomScene({ verdict, asJudge, interactive, onComplete }: CourtroomSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [activePrompt, setActivePrompt] = useState<TrialPrompt | null>(null);
  const [timeLeft, setTimeLeft] = useState(TRIAL_ROUND_SECONDS);
  const [hits, setHits] = useState(0);
  const [prompts, setPrompts] = useState(0);
  const [done, setDone] = useState(false);
  const activeRef = useRef<TrialPrompt | null>(null);
  const doneRef = useRef(false);
  const hitsRef = useRef(0);

  useEffect(() => {
    if (!interactive || done) return;
    const tick = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(tick);
          doneRef.current = true;
          setDone(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [interactive, done]);

  useEffect(() => {
    if (!interactive || !done) return;
    onComplete?.(prompts > 0 ? hits / prompts : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, done]);

  useEffect(() => {
    if (!interactive) return;
    let cancelled = false;
    const targets: TrialPrompt[] = ['witness', 'evidence', 'objection'];
    const spawn = () => {
      if (cancelled || doneRef.current) return;
      const s = targets[Math.floor(Math.random() * targets.length)];
      activeRef.current = s;
      setActivePrompt(s);
      setPrompts((n) => n + 1);
      const windowMs = Math.max(700, 1500 - hitsRef.current * 25);
      window.setTimeout(() => {
        if (cancelled || doneRef.current) return;
        if (activeRef.current === s) { activeRef.current = null; setActivePrompt(null); }
        window.setTimeout(spawn, 250);
      }, windowMs);
    };
    const startTimer = window.setTimeout(spawn, 500);
    return () => { cancelled = true; window.clearTimeout(startTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  const handlePromptHit = (s: TrialPrompt) => {
    if (doneRef.current || activeRef.current !== s) return;
    hitsRef.current += 1;
    setHits(hitsRef.current);
    activeRef.current = null;
    setActivePrompt(null);
  };

  useThreeScene(
    ref,
    ({ scene, camera, makeLabel, quality, registerClickable }) => {
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

      // Witness stand, stage-right of the bench. Interactive mode gets its own material instance
      // (not the shared woodMat the bench also uses) so highlighting it doesn't light up the bench too.
      const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.85, 12), interactive ? woodMat.clone() : woodMat);
      standBase.position.set(2.6, 0.42, -3);
      standBase.castShadow = true;
      scene.add(standBase);
      const promptGlow: Partial<Record<TrialPrompt, THREE.Mesh>> = {};
      if (interactive) {
        promptGlow.witness = standBase;
        registerClickable(standBase, 'witness');
      }

      // Counsel tables facing the bench, prosecution left / defense right.
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x3f3327, roughness: 0.5 });
      for (const side of [-1, 1] as const) {
        const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.8), interactive ? tableMat.clone() : tableMat);
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
        if (interactive) {
          const promptId: TrialPrompt = side < 0 ? 'objection' : 'evidence';
          promptGlow[promptId] = table;
          registerClickable(table, promptId);
        }
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
        if (interactive) {
          for (const [id, mesh] of Object.entries(promptGlow) as [TrialPrompt, THREE.Mesh][]) {
            const lit = activeRef.current === id;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.emissive.setHex(lit ? 0xffd166 : 0x000000);
            mat.emissiveIntensity = lit ? 0.9 + Math.sin(t * 6) * 0.2 : 0;
          }
        }
      };
    },
    [verdict, asJudge, interactive],
    interactive ? { controls: 'none', onPick: (id) => handlePromptHit(id as TrialPrompt) } : undefined,
  );

  return (
    <div>
      <div ref={ref} className="w-full h-48 rounded-2xl overflow-hidden bg-slate-950" />
      {interactive && (
        <div className="flex justify-between text-xs mt-2 px-1">
          <span className="text-slate-400">⏱️ {timeLeft}s left{activePrompt ? ` · ${TRIAL_PROMPT_LABEL[activePrompt]}!` : ''}</span>
          <span className="font-bold">{hits}/{prompts} hit</span>
        </div>
      )}
    </div>
  );
}
