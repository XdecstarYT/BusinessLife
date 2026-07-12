/** V57: Culinary Kitchen Service — a fast reaction minigame. Three stations (Prep, Grill,
 * Plate) light up one at a time; tap the lit one before it goes cold. Final accuracy feeds a
 * real bonus into cookService's success chance (see runKitchenService in sim/culinary.ts), so
 * a sharp round genuinely helps the underlying career, not just a score for its own sake.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

type Station = 'prep' | 'grill' | 'plate';

const STATIONS: { id: Station; label: string; color: number; pos: [number, number, number] }[] = [
  { id: 'prep', label: 'Prep', color: 0x34d399, pos: [-1.2, 0, 0] },
  { id: 'grill', label: 'Grill', color: 0xf97316, pos: [0, 0, 0] },
  { id: 'plate', label: 'Plate', color: 0x38bdf8, pos: [1.2, 0, 0] },
];

const ROUND_SECONDS = 20;

interface KitchenServiceSceneProps {
  onComplete: (score: number) => void;
}

export function KitchenServiceScene({ onComplete }: KitchenServiceSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Station | null>(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [hits, setHits] = useState(0);
  const [prompts, setPrompts] = useState(0);
  const [done, setDone] = useState(false);
  const activeRef = useRef<Station | null>(null);
  const doneRef = useRef(false);
  const hitsRef = useRef(0);

  // Countdown clock.
  useEffect(() => {
    if (done) return;
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
  }, [done]);

  // Fire the completion callback exactly once, when the round ends.
  useEffect(() => {
    if (!done) return;
    onComplete(prompts > 0 ? hits / prompts : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // Prompt spawner: one station lit at a time, window shrinks slightly as the player gets hot.
  useEffect(() => {
    let cancelled = false;
    const spawn = () => {
      if (cancelled || doneRef.current) return;
      const s = STATIONS[Math.floor(Math.random() * STATIONS.length)].id;
      activeRef.current = s;
      setActive(s);
      setPrompts((n) => n + 1);
      const windowMs = Math.max(650, 1400 - hitsRef.current * 20);
      window.setTimeout(() => {
        if (cancelled || doneRef.current) return;
        if (activeRef.current === s) { activeRef.current = null; setActive(null); }
        window.setTimeout(spawn, 220);
      }, windowMs);
    };
    const startTimer = window.setTimeout(spawn, 400);
    return () => { cancelled = true; window.clearTimeout(startTimer); };
  }, []);

  const handleStationHit = (s: Station) => {
    if (doneRef.current || activeRef.current !== s) return;
    hitsRef.current += 1;
    setHits(hitsRef.current);
    activeRef.current = null;
    setActive(null);
  };

  useThreeScene(
    ref,
    ({ scene, camera, registerClickable }) => {
      scene.background = new THREE.Color(0x0b1220);
      scene.fog = new THREE.Fog(0x0b1220, 6, 20);
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const key = new THREE.DirectionalLight(0xfff2d8, 1.1);
      key.position.set(3, 6, 4);
      scene.add(key);

      const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.5 }));
      counter.position.y = 0.45;
      scene.add(counter);
      const backsplash = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.6 }));
      backsplash.position.set(0, 1.4, -0.68);
      scene.add(backsplash);

      const stationGlow = {} as Record<Station, THREE.Mesh>;
      for (const st of STATIONS) {
        const group = new THREE.Group();
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.6 }));
        top.position.y = 0.96;
        group.add(top);
        const glow = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.38, 0.05, 20),
          new THREE.MeshStandardMaterial({ color: st.color, emissive: st.color, emissiveIntensity: 0.2 }),
        );
        glow.position.y = 1.03;
        group.add(glow);
        group.position.set(...st.pos);
        scene.add(group);
        registerClickable(group, st.id);
        stationGlow[st.id] = glow;
      }

      camera.position.set(0, 3.2, 3.6);
      camera.lookAt(0, 0.8, 0);

      return () => {
        for (const st of STATIONS) {
          const isLit = activeRef.current === st.id;
          const mat = stationGlow[st.id].material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = isLit ? 1.5 : 0.2;
          stationGlow[st.id].scale.setScalar(isLit ? 1.18 : 1);
        }
      };
    },
    [],
    { controls: 'none', onPick: (id) => handleStationHit(id as Station) },
  );

  return (
    <div>
      <div ref={ref} className="w-full h-56 rounded-2xl overflow-hidden bg-slate-950" />
      <div className="flex justify-between text-xs mt-2 px-1">
        <span className="text-slate-400">⏱️ {timeLeft}s left{active ? ` · ${STATIONS.find((s) => s.id === active)?.label} is up!` : ''}</span>
        <span className="font-bold">{hits}/{prompts} hit</span>
      </div>
    </div>
  );
}
