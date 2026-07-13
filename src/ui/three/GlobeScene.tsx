/**
 * The World Domination globe: a slowly-spinning 3D Earth ringed with one glowing marker per
 * foreign nation, each colored by how much influence you hold there (grey → amber → your accent
 * → green once controlled). Tap a marker to select that nation (drives the overlay action panel
 * in Domination.tsx). Uses the shared useThreeScene pipeline's registerClickable/onPick facility,
 * so drag-to-rotate and tap-to-select coexist. Ambient, not a takeover — it renders inline in the
 * screen like the other hub scenes, not fullscreen.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';

export interface GlobeMarker {
  countryId: string;
  name: string;
  flag: string;
  influence: number; // 0..100
  controlled: boolean;
  // stable pseudo-geo position derived from the country id, so a nation always sits in the same spot
  lat: number;
  lon: number;
}

interface GlobeSceneProps {
  markers: GlobeMarker[];
  selectedId: string | null;
  onSelect: (countryId: string) => void;
}

function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function markerColor(influence: number, controlled: boolean): THREE.Color {
  if (controlled) return new THREE.Color(0x22c55e);
  if (influence >= 80) return new THREE.Color(0x5150d6);
  if (influence >= 45) return new THREE.Color(0xf59e0b);
  return new THREE.Color(0x94a3b8);
}

export function GlobeScene({ markers, selectedId, onSelect }: GlobeSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useThreeScene(
    ref,
    ({ scene, camera, addStars, registerClickable }) => {
      scene.background = new THREE.Color(0x05070f);
      addStars(400);
      scene.add(new THREE.AmbientLight(0x9db4d6, 0.5));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
      sun.position.set(6, 4, 8);
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0x5150d6, 0.8);
      rim.position.set(-8, -2, -6);
      scene.add(rim);

      const globe = new THREE.Group();
      scene.add(globe);

      const R = 2.4;
      // Earth-ish sphere: deep ocean base with a subtle emissive so the dark side isn't pure black.
      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(R, 48, 48),
        new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.85, metalness: 0.1, emissive: 0x0a1626, emissiveIntensity: 0.5 }),
      );
      globe.add(earth);
      // faint wireframe "graticule" over the ocean for a mappy feel
      const grid = new THREE.Mesh(
        new THREE.SphereGeometry(R + 0.005, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0x2b4a6f, wireframe: true, transparent: true, opacity: 0.25 }),
      );
      globe.add(grid);
      // glowing atmosphere shell
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.06, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x5b8bd0, transparent: true, opacity: 0.12, side: THREE.BackSide }),
      );
      globe.add(atmo);

      // Markers + their vertical beacon beams
      const markerMeshes: { id: string; dot: THREE.Mesh; beam: THREE.Mesh; ring: THREE.Mesh }[] = [];
      for (const m of markers) {
        const pos = latLonToVec3(m.lat, m.lon, R + 0.02);
        const color = markerColor(m.influence, m.controlled);
        const group = new THREE.Group();

        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 12, 12),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 }),
        );
        dot.position.copy(pos);
        group.add(dot);

        // beacon beam scaled by influence so a strong hold visibly towers
        const beamLen = 0.2 + (m.influence / 100) * 1.3;
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.05, beamLen, 8),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
        );
        const outward = pos.clone().normalize();
        beam.position.copy(pos.clone().add(outward.clone().multiplyScalar(beamLen / 2)));
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
        group.add(beam);

        // selection ring (shown for the selected marker)
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.22, 0.03, 8, 20),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
        );
        ring.position.copy(pos);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
        ring.visible = m.countryId === selectedId;
        group.add(ring);

        globe.add(group);
        registerClickable(dot, m.countryId);
        markerMeshes.push({ id: m.countryId, dot, beam, ring });
      }

      camera.position.set(0, 1.4, 7);
      camera.lookAt(0, 0, 0);

      return (t) => {
        globe.rotation.y = t * 0.12;
        // pulse the selected ring + its dot
        for (const mm of markerMeshes) {
          const selected = mm.id === selectedId;
          mm.ring.visible = selected;
          if (selected) {
            const s = 1 + Math.sin(t * 6) * 0.15;
            mm.ring.scale.setScalar(s);
          }
        }
      };
    },
    [markers, selectedId],
    { onPick: (id) => onSelectRef.current(id) },
  );

  return <div ref={ref} className="w-full h-full" />;
}
