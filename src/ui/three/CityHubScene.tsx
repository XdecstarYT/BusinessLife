/**
 * The Explore hub: a walkable 3D plaza that stands in for "the city," and
 * the primary way to reach every major system — HQ, Bank, Parliament,
 * Exchange, Studio storefront, Home, Career office, Park, Docks and the
 * Newsstand. Every one of them is driven by real simulation state passed
 * in as props (tier/dormant/accent), not decoration: a bankrupt HQ is dark
 * and boarded, a thriving one gets a construction crane, Parliament only
 * flies a flag if you hold office, the Exchange's ticker ring glows green
 * or red with the real market trend.
 *
 * Movement is a virtual joystick (touch) or WASD/arrows (desktop) driving the
 * player capsule in world space; a fixed-offset chase camera trails behind.
 * A continuous day/night cycle and a few looping ambient pedestrians/cars
 * keep the plaza feeling alive. Walking up to a building surfaces an
 * "Enter" prompt that hands off to the real screen for that system, and
 * some buildings also offer a quick action you can take right there
 * without leaving the plaza — this is a navigation-and-action layer over
 * the existing simulation, not a separate one.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';
import { makeTexture, windowGridTexture } from './textures';
import { loadModel } from './modelLoader';

export type HubBuildingId = 'hq' | 'bank' | 'parliament' | 'exchange' | 'studio' | 'home' | 'office' | 'park' | 'docks' | 'newsstand' | 'courthouse' | 'restaurant' | 'hospital' | 'casino';
export type HubArchetype = 'tower' | 'bank' | 'capitol' | 'exchange' | 'storefront' | 'house' | 'office' | 'park' | 'dock' | 'kiosk' | 'courthouse' | 'restaurant' | 'hospital' | 'casinofront';
export type HubSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface HubBuilding {
  id: string; // the 10 fixed system ids, or a company id for the IPO skyline ring
  label: string;
  sublabel: string;
  archetype: HubArchetype;
  tier: 0 | 1 | 2 | 3; // drives lighting/size/extra props — reflects real sim state
  accent: string; // hex, used for glow/trim/banner color
  dormant?: boolean; // nothing built here yet — smaller, unlit, inviting rather than reactive
  constructing?: boolean; // fresh IPO, one year from breaking ground to opening — scaffolding + crane, not a real building yet
  kind?: 'system' | 'company'; // system buildings sit on the inner ring; companies fill the outer skyline
  quickAction?: { label: string; icon: string }; // an action offered right here, without leaving the plaza
}

interface CityHubSceneProps {
  buildings: HubBuilding[];
  season: HubSeason;
  onEnter: (id: string) => void;
  onQuickAction?: (id: string) => void;
}

const ENTER_RADIUS = 2.3;
const EXIT_RADIUS = 2.8;
const MOVE_SPEED = 5;
const DRIVE_SPEED = 12; // V8.2: hop in a car and cover the grid roughly 2.4× faster than on foot

// V8.1: the city is laid out as a real street grid rather than concentric rings. Every building
// (system + company) sits on the centre of a block; roads run between the blocks. A building's
// HEIGHT still comes from its tier/level (see the build* archetypes), so a thriving empire visibly
// towers over a fledgling one across the skyline.
const CITY_BLOCK = 6.2; // world spacing between block centres (building + surrounding road)
const ROAD_W = 2.6; // world width of a road running between blocks
const CITY_MARGIN = 4; // grass/verge past the outermost road before the perimeter railway

const SEASON_FOLIAGE: Record<HubSeason, { leaf: string; ground: string }> = {
  spring: { leaf: '#5fae5a', ground: '#3f8f52' },
  summer: { leaf: '#3f8f52', ground: '#37793f' },
  autumn: { leaf: '#c9822f', ground: '#7a6a3a' },
  winter: { leaf: '#8a9a95', ground: '#6b7d78' },
};

// --------------------------------------------------------------------------- textures

/** Top-down city map baked into the ground plane: grass verges, a grid of asphalt roads with
 * dashed centre lines, pale sidewalks bordering each block, and a concrete pad under every block.
 * `cols`/`rows` match the 3D building grid so roads always fall between the blocks. */
function cityGridTexture(cols: number, rows: number, ground: string): THREE.CanvasTexture {
  const RES = 1024;
  return makeTexture(RES, RES, (ctx, w, h) => {
    // grass base
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);
    const cellW = w / cols;
    const cellH = h / rows;
    const roadW = (ROAD_W / CITY_BLOCK) * cellW;
    const sideW = roadW * 0.28;
    // block pads (concrete) inset from the roads
    ctx.fillStyle = '#8f9298';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(c * cellW + roadW / 2, r * cellH + roadW / 2, cellW - roadW, cellH - roadW);
      }
    }
    // sidewalks (lighter border just inside each road)
    ctx.fillStyle = '#b9bcc2';
    for (let i = 0; i <= cols; i++) {
      const x = i * cellW;
      ctx.fillRect(x - roadW / 2 - sideW, 0, sideW, h);
      ctx.fillRect(x + roadW / 2, 0, sideW, h);
    }
    for (let i = 0; i <= rows; i++) {
      const y = i * cellH;
      ctx.fillRect(0, y - roadW / 2 - sideW, w, sideW);
      ctx.fillRect(0, y + roadW / 2, w, sideW);
    }
    // asphalt roads on every grid line (including the perimeter)
    ctx.fillStyle = '#33373e';
    for (let i = 0; i <= cols; i++) ctx.fillRect(i * cellW - roadW / 2, 0, roadW, h);
    for (let i = 0; i <= rows; i++) ctx.fillRect(0, i * cellH - roadW / 2, w, roadW);
    // dashed yellow centre lines
    ctx.strokeStyle = '#e8c94a';
    ctx.lineWidth = Math.max(2, roadW * 0.06);
    ctx.setLineDash([16, 14]);
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, h); ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * cellH); ctx.lineTo(w, i * cellH); ctx.stroke();
    }
    ctx.setLineDash([]);
  });
}

function signTexture(text: string): THREE.CanvasTexture {
  return makeTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(10,16,28,0.8)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 16), w / 2, h / 2 + 1);
  });
}

// --------------------------------------------------------------------------- shared props

/** A small clustered canopy (several overlapping icosahedrons over a trunk) instead of a single
 * cone — reads as a real, roughly-spherical tree crown rather than a traffic-cone silhouette. */
function makeTree(foliage: string, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05 * scale, 0.08 * scale, 0.5 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9 }),
  );
  trunk.position.y = 0.25 * scale;
  g.add(trunk);
  const canopyMat = new THREE.MeshStandardMaterial({ color: foliage, roughness: 0.85 });
  const clusters: [number, number, number, number][] = [
    [0, 0.62, 0, 0.34],
    [0.18, 0.5, 0.12, 0.22],
    [-0.16, 0.48, -0.14, 0.24],
    [0.05, 0.78, -0.08, 0.2],
  ];
  for (const [dx, dy, dz, r] of clusters) {
    const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(r * scale, 1), canopyMat);
    lump.position.set(dx * scale, dy * scale, dz * scale);
    lump.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    g.add(lump);
  }
  return g;
}

// --------------------------------------------------------------------------- building archetypes

function buildTower(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const h = dormant ? 2.2 : 3 + tier * 1.7;
  const w = 1.8, d = 1.8;
  const bodyMat = new THREE.MeshStandardMaterial({ color: dormant ? 0x3a3f47 : 0x2a3242, metalness: 0.4, roughness: 0.5 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  tower.position.y = h / 2;
  group.add(tower);
  const windows = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.94, h * 0.9),
    new THREE.MeshStandardMaterial({ map: windowGridTexture(dormant ? 0 : 0.25 + tier * 0.22), emissive: 0xffffff, emissiveMap: windowGridTexture(dormant ? 0 : 0.25 + tier * 0.22), emissiveIntensity: 0.9, roughness: 0.6 }),
  );
  windows.position.set(0, h / 2, d / 2 + 0.01);
  group.add(windows);
  // Cornice ring at the parapet, then the accent-colored roof cap set back from it — a stepped
  // roofline instead of one flat slab reads as a real building top, not a box lid.
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 0.08, d * 1.1), new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.6 }));
  cornice.position.y = h + 0.04;
  group.add(cornice);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.15, d * 0.94), new THREE.MeshStandardMaterial({ color: accent, metalness: 0.6, roughness: 0.3 }));
  roof.position.y = h + 0.15;
  group.add(roof);
  // Recessed entrance: a darker step + doorway at street level so the tower plants into the
  // ground instead of just floating a flat wall.
  const step = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 0.8 }));
  step.position.set(0, 0.04, d / 2 + 0.14);
  group.add(step);
  const entrance = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.32, 0.55), new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 0.4, metalness: 0.3 }));
  entrance.position.set(0, 0.28, d / 2 + 0.011);
  group.add(entrance);
  if (dormant) {
    for (let i = 0; i < 3; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.22, 0.06), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 }));
      plank.rotation.z = i % 2 === 0 ? 0.05 : -0.05;
      plank.position.set(0, 0.3 + i * 0.32, d / 2 + 0.05);
      group.add(plank);
    }
  } else if (tier >= 3) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0xffb020 }));
    mast.position.set(w * 0.9, h + 1.2, 0);
    group.add(mast);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0xffb020 }));
    boom.position.set(w * 0.9 + 0.6, h + 2.35, 0);
    group.add(boom);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    beacon.position.set(0, h + 0.2, 0);
    beacon.userData.blink = true;
    group.add(beacon);
  }
}

function buildBank(group: THREE.Group, tier: number, accent: string): void {
  const scale = 0.85 + tier * 0.18;
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 1.6 * scale, 1.8 * scale), new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.5 }));
  base.position.y = (1.6 * scale) / 2;
  group.add(base);
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(1.5 * scale, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.5 }));
  pediment.rotation.y = Math.PI / 4;
  pediment.position.y = 1.6 * scale + 0.35;
  group.add(pediment);
  const colCount = 3 + Math.min(2, tier);
  for (let i = 0; i < colCount; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.5 * scale, 12), new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.3 }));
    col.position.set((i - (colCount - 1) / 2) * (0.55 * scale), (1.5 * scale) / 2, 1.05 * scale);
    group.add(col);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.55 * scale, 0.9 * scale), new THREE.MeshStandardMaterial({ color: accent, metalness: 0.7, roughness: 0.25 }));
  door.position.set(0, 0.5 * scale, 1.06 * scale);
  group.add(door);
  // Steps up to the portico — grounds the building instead of it just touching a flat plane.
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c4, roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry((2 * scale) - i * 0.18, 0.08, 0.28 - i * 0.05), stepMat);
    step.position.set(0, 0.04 + i * 0.08, 1.15 * scale + i * 0.12);
    group.add(step);
  }
}

function buildCapitol(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const scale = 0.9 + tier * 0.16;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3 * scale, 1.5 * scale, 1.1 * scale, 20), new THREE.MeshStandardMaterial({ color: dormant ? 0x6b7078 : 0xdfe0d8, roughness: 0.5 }));
  base.position.y = (1.1 * scale) / 2;
  group.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1 * scale, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: dormant ? 0x565b62 : 0xc7cad0, metalness: 0.3, roughness: 0.35 }));
  dome.position.y = 1.1 * scale;
  group.add(dome);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1 * scale, 10), new THREE.MeshStandardMaterial({ color: 0xf0efe8 }));
    col.position.set(Math.cos(a) * 1.4 * scale, (1 * scale) / 2, Math.sin(a) * 1.4 * scale);
    group.add(col);
  }
  if (!dormant) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0xcfcfcf }));
    pole.position.y = 1.1 * scale + 1.6;
    group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshStandardMaterial({ color: accent, side: THREE.DoubleSide }));
    flag.position.set(0.28, 1.1 * scale + 2.1, 0);
    flag.userData.flag = true;
    group.add(flag);
  }
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * scale, 1.85 * scale, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xc9cac2, roughness: 0.75 }));
  plinth.position.y = 0.06;
  group.add(plinth);
}

function buildExchange(group: THREE.Group, tier: number, accent: string): void {
  const h = 3.4;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.5), new THREE.MeshStandardMaterial({ color: 0x232a38, metalness: 0.5, roughness: 0.4 }));
  tower.position.y = h / 2;
  group.add(tower);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshStandardMaterial({ map: signTexture(tier >= 2 ? '▲ UP' : 'DOWN ▼'), emissive: 0xffffff, emissiveMap: signTexture(tier >= 2 ? '▲ UP' : 'DOWN ▼'), emissiveIntensity: 0.7 }));
  board.position.set(0, h * 0.62, 0.76);
  group.add(board);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 10, 32), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.6 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h + 0.1;
  ring.userData.spin = true;
  group.add(ring);
}

function buildStorefront(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const scale = 0.9 + Math.min(tier, 3) * 0.12;
  const box = new THREE.Mesh(new THREE.BoxGeometry(2 * scale, 1.5, 1.4 * scale), new THREE.MeshStandardMaterial({ color: 0x232733, roughness: 0.5 }));
  box.position.y = 0.75;
  group.add(box);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: dormant ? 0x141821 : accent, transmission: dormant ? 0 : 0.55, roughness: 0.1, metalness: 0.1, opacity: dormant ? 0.9 : 1, transparent: true });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.9 * scale, 1.05), glassMat);
  glass.position.set(0, 0.85, 0.71 * scale);
  group.add(glass);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.1 * scale, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: accent }));
  awning.position.set(0, 1.55, 0.9 * scale);
  awning.rotation.x = -0.15;
  group.add(awning);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.5 }));
  doorFrame.position.set(0, 0.55, 0.74 * scale);
  group.add(doorFrame);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 0.07, 0.22), new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.8 }));
  step.position.set(0, 0.035, 0.85 * scale);
  group.add(step);
  if (!dormant) {
    const prop = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6 }));
    prop.position.set(0, 0.5, 0.9);
    group.add(prop);
  }
}

function buildHouse(group: THREE.Group, tier: number, foliage: string): void {
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.4), new THREE.MeshStandardMaterial({ color: 0xd9c9a8, roughness: 0.7 }));
  body.position.y = 0.55;
  group.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.75, 4), new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 0.8 }));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.5;
  group.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), new THREE.MeshStandardMaterial({ color: 0x8a6a58, roughness: 0.85 }));
  chimney.position.set(-0.55, 1.65, -0.3);
  group.add(chimney);
  // A small porch overhang above the door, held up on two thin posts — reads as an entrance,
  // not just a colored rectangle stuck on the wall.
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 0.8 }));
  porchRoof.position.set(0, 0.92, 0.9);
  group.add(porchRoof);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cf, roughness: 0.6 });
  for (const dx of [-0.26, 0.26] as const) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), postMat);
    post.position.set(dx, 0.63, 1.05);
    group.add(post);
  }
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.24), new THREE.MeshStandardMaterial({ color: 0xb9b0a0, roughness: 0.8 }));
  step.position.set(0, 0.03, 0.86);
  group.add(step);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.7), new THREE.MeshStandardMaterial({ color: 0x4a3324 }));
  door.position.set(0, 0.35, 0.71);
  group.add(door);
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffdf91, emissive: 0xffdf91, emissiveIntensity: tier > 0 ? 0.5 + tier * 0.15 : 0.05 });
  for (const dx of [-0.5, 0.5] as const) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), winMat);
    win.position.set(dx, 0.75, 0.71);
    group.add(win);
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0x5c7a5e, roughness: 0.8 });
    for (const sx of [-0.22, 0.22]) {
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.02), shutterMat);
      shutter.position.set(dx + sx, 0.75, 0.72);
      group.add(shutter);
    }
  }
  const tree = makeTree(foliage, 1.15);
  tree.position.set(1.3, 0, -0.6);
  group.add(tree);
}

function buildOffice(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const floors = dormant ? 2 : 3 + tier;
  const w = 2.1, d = 1.4, floorH = 0.55;
  const h = floors * floorH;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: dormant ? 0x3a3f47 : 0x394456, roughness: 0.6 }));
  body.position.y = h / 2;
  group.add(body);
  for (let f = 0; f < floors; f++) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.92, floorH * 0.62),
      new THREE.MeshStandardMaterial({ color: 0xbcd6f2, emissive: 0xbcd6f2, emissiveIntensity: dormant ? 0.05 : 0.35 + tier * 0.1, roughness: 0.3 }),
    );
    strip.position.set(0, floorH * (f + 0.5), d / 2 + 0.01);
    group.add(strip);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshStandardMaterial({ map: signTexture('CAREER'), emissive: 0xffffff, emissiveMap: signTexture('CAREER'), emissiveIntensity: 0.8 }));
  sign.position.set(0, h + 0.22, 0);
  group.add(sign);
  // Rooftop plant — an AC unit and a vent stack — the kind of clutter that keeps a flat-roofed
  // block from reading as a bare box from the label-view angle above.
  const acUnit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0x555b63, roughness: 0.6 }));
  acUnit.position.set(w * 0.25, h + 0.06, 0);
  group.add(acUnit);
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x3a3f47 }));
  vent.position.set(-w * 0.28, h + 0.1, -d * 0.15);
  group.add(vent);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.06), new THREE.MeshStandardMaterial({ color: 0x11151d, roughness: 0.4 }));
  doorFrame.position.set(0, 0.5, d / 2 + 0.03);
  group.add(doorFrame);
  if (!dormant && tier >= 2) {
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: accent }));
    awning.position.set(0, 0.5, d / 2 + 0.25);
    group.add(awning);
  }
}

function buildPark(group: THREE.Group, tier: number, foliage: string, dormant: boolean): void {
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshStandardMaterial({ color: foliage, roughness: 0.9 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.01;
  group.add(lawn);
  const treeCount = dormant ? 1 : 2 + tier;
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2;
    const r = 0.7 + (i % 2) * 0.3;
    const tree = makeTree(foliage, 0.85);
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    group.add(tree);
  }
  // A proper bench — seat, backrest and two legs — instead of a single floating plank.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.75 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.22), benchMat);
  seat.position.set(0, 0.2, 0.9);
  group.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.04), benchMat);
  back.position.set(0, 0.33, 0.79);
  group.add(back);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f22, roughness: 0.6 });
  for (const dx of [-0.24, 0.24]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.2), legMat);
    leg.position.set(dx, 0.1, 0.9);
    group.add(leg);
  }
  if (!dormant) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xfff2c8, emissiveIntensity: 0.4 + tier * 0.2 }));
    lamp.position.set(-0.8, 0.9, -0.4);
    group.add(lamp);
  }
}

function buildDock(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1), new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 0.9 }));
  pier.position.y = 0.06;
  group.add(pier);
  // Deck planking seams + edge bollards, so the pier reads as built structure, not a flat slab.
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x3f3327, roughness: 0.95 });
  for (let i = -3; i <= 3; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.002, 0.98), plankMat);
    seam.position.set(i * 0.3, 0.121, 0);
    group.add(seam);
  }
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x2a2f22, roughness: 0.7 });
  for (const [dx, dz] of [[-1, 0.42], [1, 0.42], [-1, -0.42], [1, -0.42]] as const) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.14, 8), bollardMat);
    bollard.position.set(dx, 0.19, dz);
    group.add(bollard);
  }
  const warehouse = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1 + tier * 0.3, 0.9), new THREE.MeshStandardMaterial({ color: dormant ? 0x3a3f47 : 0x3f4a52, roughness: 0.7 }));
  warehouse.position.set(-0.3, (1 + tier * 0.3) / 2 + 0.12, -0.3);
  group.add(warehouse);
  const boat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.32), new THREE.MeshStandardMaterial({ color: dormant ? 0x555 : accent, roughness: 0.5 }));
  boat.position.set(0.7, 0.18, 0.55);
  group.add(boat);
  if (!dormant && tier >= 1) {
    const crane = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0xd9a441 }));
    crane.position.set(-0.7, 0.8, -0.5);
    group.add(crane);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xd9a441 }));
    arm.position.set(-0.2, 1.45, -0.5);
    group.add(arm);
  }
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x888 }));
  flagPole.position.set(0.9, 0.5, -0.2);
  group.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshStandardMaterial({ color: accent, side: THREE.DoubleSide }));
  flag.position.set(1.05, 0.82, -0.2);
  flag.userData.flag = true;
  group.add(flag);
  // A stack of shipping containers beside the warehouse ties this into the wider supply-train
  // theme circling the plaza (see the rail yard ring below) without needing its own screen.
  if (!dormant) {
    const containerColors = [0xd8483f, 0x3a6fd8, 0xe0a83f];
    for (let i = 0; i < 3; i++) {
      const container = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.22, 0.24),
        new THREE.MeshStandardMaterial({ color: containerColors[i % containerColors.length], roughness: 0.6, metalness: 0.2 }),
      );
      container.position.set(-0.85 + i * 0.02, 0.12 + i * 0.23, 0.55 - i * 0.03);
      container.rotation.y = 0.06 * i;
      group.add(container);
    }
  }
}

function buildKiosk(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const booth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.85, 10), new THREE.MeshStandardMaterial({ color: dormant ? 0x3a3f47 : 0x2a3242, roughness: 0.6 }));
  booth.position.y = 0.42;
  group.add(booth);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 10), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }));
  roof.position.y = 1.05;
  group.add(roof);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), new THREE.MeshStandardMaterial({ map: signTexture('NEWS'), emissive: 0xffffff, emissiveMap: signTexture('NEWS'), emissiveIntensity: dormant ? 0.1 : 0.7 + tier * 0.1 }));
  board.position.set(0, 0.55, 0.58);
  group.add(board);
}

// V57: four more system buildings — Legal, Culinary, Medical and Casino all previously had zero
// presence in the primary walkable hub despite being full life-path systems.

function buildCourthouse(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const scale = 0.9 + tier * 0.15;
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2 * scale, 1.5 * scale, 1.7 * scale), new THREE.MeshStandardMaterial({ color: dormant ? 0x6b6f76 : 0xe8e4d8, roughness: 0.55 }));
  base.position.y = (1.5 * scale) / 2;
  group.add(base);
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(1.4 * scale, 0.6, 3), new THREE.MeshStandardMaterial({ color: dormant ? 0x565a60 : 0xd9d4c4, roughness: 0.5 }));
  pediment.rotation.y = Math.PI;
  pediment.position.y = 1.5 * scale + 0.3;
  group.add(pediment);
  const colCount = 4 + Math.min(2, tier);
  for (let i = 0; i < colCount; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4 * scale, 10), new THREE.MeshStandardMaterial({ color: 0xf2efe4, roughness: 0.3 }));
    col.position.set((i - (colCount - 1) / 2) * (0.42 * scale), (1.4 * scale) / 2, 0.95 * scale);
    group.add(col);
  }
  if (!dormant) {
    // A pair of scale-pans hung from a beam — the archetype's one unmistakable "this is a
    // courthouse" cue, distinct from the Bank's plain door-and-columns silhouette.
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), new THREE.MeshStandardMaterial({ color: accent, metalness: 0.6, roughness: 0.3 }));
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, 1.5 * scale + 0.65, 0.95 * scale);
    group.add(beam);
    for (const dx of [-0.3, 0.3]) {
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 12), new THREE.MeshStandardMaterial({ color: accent, metalness: 0.6, roughness: 0.3 }));
      pan.position.set(dx, 1.5 * scale + 0.4, 0.95 * scale);
      group.add(pan);
    }
  }
  const stepMat = new THREE.MeshStandardMaterial({ color: 0xd0cbb8, roughness: 0.75 });
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry((1.9 * scale) - i * 0.16, 0.08, 0.26 - i * 0.05), stepMat);
    step.position.set(0, 0.04 + i * 0.08, 1.05 * scale + i * 0.12);
    group.add(step);
  }
}

function buildRestaurant(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const scale = 0.9 + Math.min(tier, 3) * 0.14;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.9 * scale, 1.3, 1.5 * scale), new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.7 }));
  box.position.y = 0.65;
  group.add(box);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1 * scale, 0.18, 1.7 * scale), new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.8 }));
  roof.position.y = 1.39;
  group.add(roof);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2 * scale, 0.08, 0.55), new THREE.MeshStandardMaterial({ color: dormant ? 0x4a4a4a : accent, roughness: 0.6 }));
  awning.position.set(0, 1.1, 0.9 * scale);
  awning.rotation.x = -0.2;
  group.add(awning);
  const windowMat = new THREE.MeshStandardMaterial({ color: dormant ? 0x1a1a1a : 0xffd98a, emissive: dormant ? 0x000000 : 0xffb347, emissiveIntensity: dormant ? 0 : 0.6, roughness: 0.4 });
  const window1 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.6), windowMat);
  window1.position.set(-0.5 * scale, 0.75, 0.76 * scale);
  group.add(window1);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.5 }));
  door.position.set(0.4 * scale, 0.45, 0.76 * scale);
  group.add(door);
  if (!dormant) {
    // Two little outdoor bistro tables with parasols — the visual "restaurant with real
    // customers" cue, sized/lit by the same accent color the sim assigns.
    for (const dx of [-0.85, 0.85]) {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }));
      table.position.set(dx * scale, 0.18, 1.15 * scale);
      group.add(table);
      const parasol = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 10), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }));
      parasol.position.set(dx * scale, 0.75, 1.15 * scale);
      group.add(parasol);
    }
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshStandardMaterial({ map: signTexture(dormant ? 'CLOSED' : 'DINING'), emissive: 0xffffff, emissiveMap: signTexture(dormant ? 'CLOSED' : 'DINING'), emissiveIntensity: dormant ? 0.1 : 0.75 }));
  sign.position.set(0, 1.55, 0.6 * scale);
  group.add(sign);
}

function buildHospital(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const scale = 0.9 + tier * 0.16;
  const floors = 1 + Math.min(tier, 3);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.7 * scale, 0.9 * floors, 1.5 * scale), new THREE.MeshStandardMaterial({ color: dormant ? 0x6b6f76 : 0xf3f5f7, roughness: 0.55 }));
  tower.position.y = (0.9 * floors) / 2;
  group.add(tower);
  // A real red cross, not just a colored panel — the archetype's single unmistakable cue.
  const crossMat = new THREE.MeshStandardMaterial({ color: dormant ? 0x555555 : 0xe11d48, emissive: dormant ? 0x000000 : 0xe11d48, emissiveIntensity: dormant ? 0 : 0.7 });
  const crossY = 0.9 * floors + 0.2;
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.05), crossMat);
  crossH.position.set(0, crossY, 0.76 * scale);
  group.add(crossH);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.05), crossMat);
  crossV.position.set(0, crossY, 0.76 * scale);
  group.add(crossV);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.1 * scale, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }));
  canopy.position.set(0, 0.85, 0.9 * scale);
  group.add(canopy);
  const support = new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.4 });
  for (const dx of [-0.45, 0.45]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), support);
    pole.position.set(dx * scale, 0.42, 1.15 * scale);
    group.add(pole);
  }
  if (!dormant) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    beacon.position.set(0, 0.9 * floors + 0.05, 0);
    beacon.userData.blink = true;
    group.add(beacon);
  }
}

function buildCasinoFront(group: THREE.Group, tier: number, accent: string, dormant: boolean): void {
  const scale = 0.95 + tier * 0.14;
  const box = new THREE.Mesh(new THREE.BoxGeometry(2 * scale, 1.6, 1.6 * scale), new THREE.MeshStandardMaterial({ color: 0x1a0f24, roughness: 0.6, metalness: 0.15 }));
  box.position.y = 0.8;
  group.add(box);
  const marqueeMat = new THREE.MeshStandardMaterial({ color: dormant ? 0x2a2a2a : accent, emissive: dormant ? 0x000000 : accent, emissiveIntensity: dormant ? 0 : 0.85 });
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(2.1 * scale, 0.5, 0.15), marqueeMat);
  marquee.position.set(0, 1.75, 0.85 * scale);
  group.add(marquee);
  // A ring of small bulb-like spheres along the marquee edge, blinking in the animation loop —
  // reads as neon signage rather than a flat glowing panel.
  if (!dormant) {
    const bulbCount = 10;
    for (let i = 0; i < bulbCount; i++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }));
      bulb.position.set((i - (bulbCount - 1) / 2) * (2 * scale) / bulbCount, 2.02, 0.85 * scale);
      bulb.userData.blink = i % 2 === 0;
      group.add(bulb);
    }
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.35), new THREE.MeshStandardMaterial({ map: signTexture(dormant ? 'DARK' : 'JACKPOT'), emissive: 0xffffff, emissiveMap: signTexture(dormant ? 'DARK' : 'JACKPOT'), emissiveIntensity: dormant ? 0.1 : 0.8 }));
  sign.position.set(0, 1.0, 0.82 * scale);
  group.add(sign);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: 0x0d0712, roughness: 0.3, metalness: 0.4 }));
  door.position.set(0, 0.5, 0.81 * scale);
  group.add(door);
}

/** A freshly-IPO'd company's first year: scaffolding cage, safety netting, a translucent ghost
 * of the future tower (tinted by the company's real accent color), a crane and a "COMING SOON"
 * sign. Swapped out for the real tier-driven building the moment isBuildingUnderConstruction()
 * (see src/sim/market.ts) turns false. */
function buildConstructionSite(group: THREE.Group, tier: number, accent: string): void {
  const w = 1.8, d = 1.8;
  const h = 1.4 + tier * 0.6;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.1, d * 1.05), new THREE.MeshStandardMaterial({ color: 0x555a52, roughness: 0.9 }));
  slab.position.y = 0.05;
  group.add(slab);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6, metalness: 0.3 });
  const corners: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
  for (const [cx, cz] of corners) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 6), poleMat);
    pole.position.set(cx, h / 2, cz);
    group.add(pole);
  }
  const braceLevels = Math.max(1, Math.round(h / 0.7));
  for (let lvl = 1; lvl <= braceLevels; lvl++) {
    const y = (lvl / (braceLevels + 1)) * h;
    const braceZ1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.03), poleMat);
    braceZ1.position.set(0, y, -d / 2);
    group.add(braceZ1);
    const braceZ2 = braceZ1.clone();
    braceZ2.position.z = d / 2;
    group.add(braceZ2);
    const braceX1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, d), poleMat);
    braceX1.position.set(-w / 2, y, 0);
    group.add(braceX1);
    const braceX2 = braceX1.clone();
    braceX2.position.x = w / 2;
    group.add(braceX2);
  }
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.02, h, d * 1.02),
    new THREE.MeshStandardMaterial({ color: 0x1c8a5c, transparent: true, opacity: 0.32, side: THREE.DoubleSide, roughness: 1 }),
  );
  net.position.y = h / 2;
  group.add(net);
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.7, h * 0.6, d * 0.7),
    new THREE.MeshStandardMaterial({ color: accent, transparent: true, opacity: 0.5, roughness: 0.6 }),
  );
  ghost.position.y = h * 0.3;
  group.add(ghost);
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xffb020 });
  const mastH = h + 2;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, mastH, 8), craneMat);
  mast.position.set(w * 0.9, mastH / 2, 0);
  group.add(mast);
  // Jib assembly hangs off its own pivot at the mast top so the animation loop
  // can slowly slew it back and forth like a crane actually working the site.
  const slew = new THREE.Group();
  slew.position.set(w * 0.9, mastH, 0);
  slew.userData.craneSlew = Math.random() * Math.PI * 2; // phase offset per site
  const jib = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.06), craneMat);
  jib.position.set(0.7, 0, 0);
  slew.add(jib);
  const counterJib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), craneMat);
  counterJib.position.set(-0.32, 0, 0);
  slew.add(counterJib);
  const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.12), new THREE.MeshStandardMaterial({ color: 0x555a63 }));
  counterweight.position.set(-0.5, -0.06, 0);
  slew.add(counterweight);
  const hookCable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  hookCable.position.set(1.1, -0.45, 0);
  slew.add(hookCable);
  const hookLoad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 }));
  hookLoad.position.set(1.1, -0.95, 0);
  slew.add(hookLoad);
  group.add(slew);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  beacon.position.set(w * 0.9, mastH + 0.15, 0);
  beacon.userData.blink = true;
  group.add(beacon);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.35),
    new THREE.MeshStandardMaterial({ map: signTexture('COMING SOON'), emissive: 0xffffff, emissiveMap: signTexture('COMING SOON'), emissiveIntensity: 0.7 }),
  );
  sign.position.set(0, 0.5, d / 2 + 0.15);
  group.add(sign);
}

function buildBuilding(group: THREE.Group, b: HubBuilding, foliage: string): void {
  if (b.constructing) { buildConstructionSite(group, b.tier, b.accent); return; }
  switch (b.archetype) {
    case 'tower': buildTower(group, b.tier, b.accent, !!b.dormant); return;
    case 'bank': buildBank(group, b.tier, b.accent); return;
    case 'capitol': buildCapitol(group, b.tier, b.accent, !!b.dormant); return;
    case 'exchange': buildExchange(group, b.tier, b.accent); return;
    case 'storefront': buildStorefront(group, b.tier, b.accent, !!b.dormant); return;
    case 'house': buildHouse(group, b.tier, foliage); return;
    case 'office': buildOffice(group, b.tier, b.accent, !!b.dormant); return;
    case 'park': buildPark(group, b.tier, foliage, !!b.dormant); return;
    case 'dock': buildDock(group, b.tier, b.accent, !!b.dormant); return;
    case 'kiosk': buildKiosk(group, b.tier, b.accent, !!b.dormant); return;
    case 'courthouse': buildCourthouse(group, b.tier, b.accent, !!b.dormant); return;
    case 'restaurant': buildRestaurant(group, b.tier, b.accent, !!b.dormant); return;
    case 'hospital': buildHospital(group, b.tier, b.accent, !!b.dormant); return;
    case 'casinofront': buildCasinoFront(group, b.tier, b.accent, !!b.dormant); return;
  }
}

// --------------------------------------------------------------------------- ambient life

function makeCar(color: number): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.2), bodyMat);
  chassis.position.y = 0.1;
  g.add(chassis);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.18), new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.3, metalness: 0.2 }));
  cabin.position.set(-0.02, 0.235, 0);
  g.add(cabin);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd6ff, roughness: 0.05, transmission: 0.5, transparent: true, opacity: 0.85 });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.16), glassMat);
  windshield.position.set(0.09, 0.24, 0);
  g.add(windshield);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.85 });
  const wheelGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12);
  for (const [dx, dz] of [[0.14, 0.11], [0.14, -0.11], [-0.14, 0.11], [-0.14, -0.11]] as const) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(dx, 0.05, dz);
    g.add(wheel);
  }
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff6d8, emissiveIntensity: 0.7 });
  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff2b2b, emissiveIntensity: 0.8 });
  for (const dz of [0.075, -0.075]) {
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), headlightMat);
    headlight.position.set(0.22, 0.1, dz);
    g.add(headlight);
    const taillight = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), taillightMat);
    taillight.position.set(-0.22, 0.1, dz);
    g.add(taillight);
  }
  // Exposed so the day/night loop can flare the headlights after dark.
  g.userData.headMat = headlightMat;
  g.userData.tailMat = taillightMat;
  return g;
}

const WHEEL_GAUGE_GEO = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10);
const WHEEL_GAUGE_MAT = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.7, metalness: 0.4 });

function addTrainWheels(g: THREE.Group, length: number): void {
  for (const dx of [-length * 0.32, length * 0.32]) {
    for (const dz of [0.16, -0.16]) {
      const wheel = new THREE.Mesh(WHEEL_GAUGE_GEO, WHEEL_GAUGE_MAT);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(dx, 0.1, dz);
      g.add(wheel);
    }
  }
}

/** The freight-train locomotive that loops the rail yard ring — a boxy body, a raised cab up
 * front, and a headlight exposed to userData so the day/night loop can flare it after dark. */
function makeTrainLoco(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a2f2f, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.36), bodyMat);
  body.position.y = 0.26;
  g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.34), new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.5 }));
  cab.position.set(0.24, 0.53, 0);
  g.add(cab);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0x2a2f22, roughness: 0.6 }));
  stack.position.set(-0.28, 0.54, 0);
  g.add(stack);
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff6d8, emissiveIntensity: 0.7 });
  const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), headlightMat);
  headlight.position.set(0.46, 0.32, 0);
  g.add(headlight);
  addTrainWheels(g, 0.9);
  g.userData.headMat = headlightMat;
  return g;
}

/** A cargo car behind the locomotive — a plain freight box in one of a few liveries so the
 * convoy reads as a real train rather than repeated identical units. */
function makeTrainCar(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 0.34), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 }));
  body.position.y = 0.27;
  g.add(body);
  addTrainWheels(g, 0.8);
  return g;
}

/** A grain-silo cluster standing trackside in the rail yard ring — pure decoration reinforcing
 * the "supply train" theme circling the city, not an enterable building. */
function makeTrackSilo(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb8bdc4, roughness: 0.5, metalness: 0.3 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6b7078, roughness: 0.55 });
  const silos: [number, number, number][] = [[-0.5, 1.6, 0.42], [0.15, 1.9, 0.46], [0.85, 1.5, 0.4]];
  for (const [dx, h, r] of silos) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), bodyMat);
    body.position.set(dx, h / 2, 0);
    g.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, r * 0.9, 14), capMat);
    cap.position.set(dx, h + (r * 0.9) / 2, 0);
    g.add(cap);
  }
  return g;
}

/** A trackside freight warehouse with a loading dock and a small crane — the other half of the
 * rail-yard flavor pair, mirroring the silo cluster on the opposite side of the loop. */
function makeTrackWarehouse(accent: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.1), new THREE.MeshStandardMaterial({ color: 0x3f4a52, roughness: 0.7 }));
  body.position.y = 0.65;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 1.2), new THREE.MeshStandardMaterial({ color: 0x2a2f22, roughness: 0.7 }));
  roof.position.y = 1.35;
  g.add(roof);
  const dock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.5), new THREE.MeshStandardMaterial({ color: 0x555a52, roughness: 0.8 }));
  dock.position.set(0, 0.14, 0.75);
  g.add(dock);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x1c2230, roughness: 0.8 });
  for (const dx of [-0.6, 0.6]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.9), doorMat);
    door.position.set(dx, 0.5, 0.556);
    g.add(door);
  }
  const craneMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4, metalness: 0.4 });
  const crane = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 8), craneMat);
  crane.position.set(-1.35, 0.85, -0.3);
  g.add(crane);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.06), craneMat);
  arm.position.set(-0.85, 1.65, -0.3);
  g.add(arm);
  return g;
}

/** Articulated pedestrian: legs and arms hang from pivot groups at the hip and
 * shoulder, so the animation loop can swing them through a real counter-phase
 * walk cycle (left arm forward with right leg) instead of sliding a static
 * capsule around the plaza. Pivots are exposed via userData.limbs. */
function makePedestrian(shirtColor: number, pantsColor = 0x2b3140): THREE.Group {
  const g = new THREE.Group();
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.75 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.6 });

  const limbs: Record<string, THREE.Group> = {};
  const makeLimb = (name: string, x: number, y: number, radius: number, length: number, mat: THREE.Material) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 6), mat);
    limb.position.y = -(length / 2 + radius * 0.5);
    pivot.add(limb);
    g.add(pivot);
    limbs[name] = pivot;
  };
  makeLimb('legL', -0.045, 0.3, 0.033, 0.2, pantsMat);
  makeLimb('legR', 0.045, 0.3, 0.033, 0.2, pantsMat);
  makeLimb('armL', -0.115, 0.5, 0.026, 0.17, shirtMat);
  makeLimb('armR', 0.115, 0.5, 0.026, 0.17, shirtMat);
  g.userData.limbs = limbs;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.16, 4, 8), shirtMat);
  torso.position.y = 0.42;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.65 }));
  head.position.y = 0.62;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.85 }),
  );
  hair.position.y = 0.65;
  g.add(hair);
  return g;
}

/** A soft drifting cloud: a few squashed icosahedron lumps sharing one material. */
function makeCloud(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, roughness: 1, fog: false });
  const lumps = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < lumps; i++) {
    const r = 0.8 + Math.random() * 0.9;
    const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    lump.scale.y = 0.45;
    lump.position.set(i * 1.1 - lumps * 0.5, Math.random() * 0.3, Math.random() * 0.8 - 0.4);
    g.add(lump);
  }
  return g;
}

/** A tiny bird: dot of a body with two flapping wing planes (pivot in userData). */
function makeBird(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat);
  body.scale.z = 1.6;
  g.add(body);
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1] as const) {
    const pivot = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), new THREE.MeshStandardMaterial({ color: 0x2c313a, side: THREE.DoubleSide, roughness: 0.9 }));
    wing.position.x = side * 0.12;
    pivot.add(wing);
    g.add(pivot);
    wings.push(pivot);
  }
  g.userData.wings = wings;
  return g;
}

// --------------------------------------------------------------------------- component

export function CityHubScene({ buildings, season, onEnter, onQuickAction }: CityHubSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ x: 0, z: 0 });
  const nearbyRef = useRef<string | null>(null);
  const drivingRef = useRef(false);
  const [driving, setDriving] = useState(false);
  const [nearby, setNearby] = useState<string | null>(null);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number } | null>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);

  const foliage = SEASON_FOLIAGE[season];

  // Keyboard movement (desktop + reliable for automated verification).
  useEffect(() => {
    const keys = new Set<string>();
    const apply = () => {
      let x = 0, z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      inputRef.current = { x, z };
    };
    const onDown = (e: KeyboardEvent) => { keys.add(e.code); apply(); };
    const onUp = (e: KeyboardEvent) => { keys.delete(e.code); apply(); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  const updateJoy = (clientX: number, clientY: number) => {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const r = rect.width / 2;
    let dx = clientX - cx, dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > r) { dx = (dx / dist) * r; dy = (dy / dist) * r; }
    setJoyKnob({ x: dx, y: dy });
    inputRef.current = { x: dx / r, z: dy / r };
  };
  const endJoy = () => {
    joyPointerId.current = null;
    setJoyKnob(null);
    inputRef.current = { x: 0, z: 0 };
  };
  // iOS Safari's setPointerCapture support for touch-originated pointers has been
  // historically unreliable — capture silently no-ops and the base div simply stops
  // receiving events the moment a finger drags past its small hit area, freezing
  // movement mid-walk. Track the drag with window-level listeners instead (the same
  // pattern the orbit-drag controls use) so capture is a nice-to-have, not required.
  const onJoyStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    joyPointerId.current = e.pointerId;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not supported — window listeners still cover it */ }
    updateJoy(e.clientX, e.clientY);
  };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (joyPointerId.current !== e.pointerId) return;
      updateJoy(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      if (joyPointerId.current !== e.pointerId) return;
      endJoy();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  useThreeScene(
    ref,
    ({ scene, camera, makeLabel, quality }) => {
      const castsShadows = quality === 'desktop';

      // V8.1: lay the city out as a street grid. System buildings (the core life systems) fill the
      // central blocks; company buildings spiral outward from there. One central block is left open
      // for a plaza + fountain. A building's height still tracks its tier, so the skyline reads the
      // player's real progress.
      const systemBuildings = buildings.filter((b) => b.kind !== 'company');
      const companyBuildings = buildings.filter((b) => b.kind === 'company');
      const ordered = [...systemBuildings, ...companyBuildings];
      const n = ordered.length;
      const cols = Math.max(3, Math.ceil(Math.sqrt(n + 1)));
      const rows = Math.max(3, Math.ceil((n + 1) / cols));

      // All grid cells, sorted by distance from the centre so buildings fill inside-out and the
      // very centre cell can be reserved for the plaza.
      const cells: { r: number; c: number; dist: number }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells.push({ r, c, dist: Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2) });
        }
      }
      cells.sort((a, b) => a.dist - b.dist);
      const cellToWorld = (r: number, c: number) => ({
        x: (c - (cols - 1) / 2) * CITY_BLOCK,
        z: (r - (rows - 1) / 2) * CITY_BLOCK,
      });
      const plazaCell = cells[0];
      const plazaPos = cellToWorld(plazaCell.r, plazaCell.c);
      const buildingCells = cells.slice(1, 1 + n);
      // map each building to its cell
      const placement = new Map<HubBuilding, { x: number; z: number; row: number }>();
      ordered.forEach((b, i) => {
        const cell = buildingCells[i];
        if (!cell) return;
        const { x, z } = cellToWorld(cell.r, cell.c);
        placement.set(b, { x, z, row: cell.r });
      });

      const cityHalfX = (cols * CITY_BLOCK) / 2;
      const cityHalfZ = (rows * CITY_BLOCK) / 2;
      const walkHalfX = cityHalfX - 1.0;
      const walkHalfZ = cityHalfZ - 1.0;
      // Reused name: the circumscribing radius that encloses the whole rectangular grid (corners
      // included) — fog / shadow camera / starfield / clouds / the perimeter railway all scale
      // against it, so the railway rings the city instead of cutting through its corners.
      const dynamicPlazaRadius = Math.hypot(cityHalfX, cityHalfZ) + CITY_MARGIN;

      scene.fog = new THREE.Fog(0x0b1220, 14, Math.max(40, dynamicPlazaRadius * 3));
      scene.background = new THREE.Color(0x0b1220);

      const hemi = new THREE.HemisphereLight(0x99b3d9, 0x2a2f22, 0.6);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(6, 10, 4);
      if (castsShadows) {
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -dynamicPlazaRadius - 2;
        sun.shadow.camera.right = dynamicPlazaRadius + 2;
        sun.shadow.camera.top = dynamicPlazaRadius + 2;
        sun.shadow.camera.bottom = -dynamicPlazaRadius - 2;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 30;
        sun.shadow.bias = -0.0015;
      }
      scene.add(sun);
      const fill = new THREE.AmbientLight(0xffffff, 0.25);
      scene.add(fill);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(cols * CITY_BLOCK, rows * CITY_BLOCK),
        new THREE.MeshStandardMaterial({ map: cityGridTexture(cols, rows, foliage.ground), roughness: 0.95 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = castsShadows;
      scene.add(ground);
      // A wider grass apron under the grid so the map doesn't end at a hard edge.
      const apron = new THREE.Mesh(
        new THREE.PlaneGeometry(dynamicPlazaRadius * 3, dynamicPlazaRadius * 3),
        new THREE.MeshStandardMaterial({ color: foliage.ground, roughness: 1 }),
      );
      apron.rotation.x = -Math.PI / 2;
      apron.position.y = -0.02;
      scene.add(apron);

      // Buildings: one per grid block, height driven by tier, each with a floating name label.
      const buildingMeshes: { id: string; group: THREE.Group; pos: { x: number; z: number } }[] = [];
      buildings.forEach((b) => {
        const place = placement.get(b);
        if (!place) return;
        const { x, z, row } = place;
        const group = new THREE.Group();
        buildBuilding(group, b, foliage.leaf);
        if (castsShadows) {
          group.traverse((obj) => {
            if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; }
          });
        }
        group.position.set(x, 0, z);
        // Alternate rows face opposite directions so buildings line both sides of each avenue.
        group.rotation.y = row % 2 === 0 ? 0 : Math.PI;
        scene.add(group);
        const labelY = b.constructing ? 2.4 + b.tier * 0.4 : b.kind === 'company' ? 3.6 + b.tier * 0.9 : 3.6;
        const label = makeLabel(b.label, 0.5);
        label.position.set(x, labelY, z);
        scene.add(label);
        buildingMeshes.push({ id: b.id, group, pos: { x, z } });

        // Real-model pipeline proof of concept: if a real office_tower.glb ever gets dropped
        // into public/models/, the HQ tower swaps to it automatically. Nothing ships there
        // today, so loadModel resolves null and the procedural tower above stays exactly as
        // built — this is a fallback path, not a placeholder that needs removing later.
        if (b.archetype === 'tower' && !b.constructing) {
          loadModel('/models/office_tower.glb').then((model) => {
            if (!model) return;
            while (group.children.length) group.remove(group.children[0]);
            group.add(model.clone(true));
          });
        }
      });

      // Street coordinates: the road lines sit on the block boundaries.
      const streetXs: number[] = [];
      for (let i = 0; i <= cols; i++) streetXs.push((i - cols / 2) * CITY_BLOCK);
      const streetZs: number[] = [];
      for (let i = 0; i <= rows; i++) streetZs.push((i - rows / 2) * CITY_BLOCK);

      // Lamp posts at every street intersection.
      const lamps: THREE.Mesh[] = [];
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x1c2027 });
      for (const sx of streetXs) {
        for (const sz of streetZs) {
          const lamp = new THREE.Group();
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.4, 8), lampMat);
          pole.position.y = 0.7;
          lamp.add(pole);
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xfff2c8, emissiveIntensity: 0.2 }));
          bulb.position.y = 1.42;
          lamp.add(bulb);
          lamp.position.set(sx, 0, sz);
          lamps.push(bulb);
          scene.add(lamp);
        }
      }

      // Zebra crossings striped across a few of the interior avenues.
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.85 });
      const stripeGeo = new THREE.PlaneGeometry(0.18, ROAD_W * 0.8);
      const addCrossing = (px: number, pz: number, vertical: boolean) => {
        const crossing = new THREE.Group();
        for (let s = -2; s <= 2; s++) {
          const stripe = new THREE.Mesh(stripeGeo, stripeMat);
          stripe.rotation.x = -Math.PI / 2;
          if (vertical) stripe.rotation.z = Math.PI / 2;
          stripe.position.set(vertical ? 0 : s * 0.34, 0.012, vertical ? s * 0.34 : 0);
          crossing.add(stripe);
        }
        crossing.position.set(px, 0, pz);
        scene.add(crossing);
      };
      for (let i = 1; i < cols; i++) addCrossing(streetXs[i], streetZs[Math.floor(rows / 2)], false);
      for (let i = 1; i < rows; i++) addCrossing(streetXs[Math.floor(cols / 2)], streetZs[i], true);

      // Street trees dotted along the sidewalks at a subset of intersections.
      for (let i = 0; i < streetXs.length; i++) {
        for (let j = 0; j < streetZs.length; j++) {
          if ((i + j) % 2 !== 0) continue; // thin them out so it doesn't crowd
          if (i === 0 || j === 0 || i === streetXs.length - 1 || j === streetZs.length - 1) continue;
          const tree = makeTree(foliage.leaf, 0.7 + ((i + j) % 3) * 0.18);
          tree.position.set(streetXs[i] + CITY_BLOCK * 0.28, 0, streetZs[j] + CITY_BLOCK * 0.28);
          scene.add(tree);
        }
      }

      // Rail yard ring: a gravel apron just past the plaza's edge carrying a looping freight
      // track, two trackside supply buildings (silo cluster + warehouse), and a train that
      // circles it continuously — the outdoor half of the "supply train" theme (the indoor half
      // lives in the ambient Supply Chain Visualizer on each company's detail screen).
      const trainRadius = dynamicPlazaRadius + 1.8;
      const yardOuter = dynamicPlazaRadius + 3.4;
      const yardGround = new THREE.Mesh(
        new THREE.RingGeometry(dynamicPlazaRadius, yardOuter, 64),
        new THREE.MeshStandardMaterial({ color: 0x453f34, roughness: 0.95 }),
      );
      yardGround.rotation.x = -Math.PI / 2;
      yardGround.receiveShadow = castsShadows;
      scene.add(yardGround);

      const railMat = new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.6, roughness: 0.4 });
      for (const railOffset of [-0.09, 0.09]) {
        const rail = new THREE.Mesh(new THREE.TorusGeometry(trainRadius + railOffset, 0.02, 8, 96), railMat);
        rail.rotation.x = -Math.PI / 2;
        rail.position.y = 0.02;
        rail.castShadow = castsShadows;
        scene.add(rail);
      }
      const tieMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 });
      const tieGeo = new THREE.BoxGeometry(0.5, 0.04, 0.16);
      const tieCount = 56;
      for (let i = 0; i < tieCount; i++) {
        const a = (i / tieCount) * Math.PI * 2;
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(Math.cos(a) * trainRadius, 0.01, Math.sin(a) * trainRadius);
        tie.rotation.y = -a;
        scene.add(tie);
      }

      const silo = makeTrackSilo();
      silo.position.set(Math.cos(0.35 * Math.PI) * yardOuter * 0.94, 0, Math.sin(0.35 * Math.PI) * yardOuter * 0.94);
      silo.lookAt(0, 0, 0);
      const warehouseAccent = systemBuildings.find((b) => b.archetype === 'dock')?.accent ?? '#d9a441';
      const trackWarehouse = makeTrackWarehouse(warehouseAccent);
      trackWarehouse.position.set(Math.cos(1.25 * Math.PI) * yardOuter * 0.92, 0, Math.sin(1.25 * Math.PI) * yardOuter * 0.92);
      trackWarehouse.lookAt(0, 0, 0);
      for (const yardProp of [silo, trackWarehouse]) {
        if (castsShadows) {
          yardProp.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; } });
        }
        scene.add(yardProp);
      }

      const trainColors = [0x3a5a7a, 0xb5651d, 0x4a7a4a];
      const train = [makeTrainLoco(), ...trainColors.map((c) => makeTrainCar(c))];
      const trainSpacing = (2 * Math.PI * trainRadius) / 40; // even gaps regardless of yard size
      train.forEach((unit) => {
        if (castsShadows) {
          unit.traverse((obj) => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; } });
        }
        scene.add(unit);
      });

      // Drifting clouds and circling birds — sky-level life for the bigger map.
      const clouds: THREE.Group[] = [];
      for (let i = 0; i < 5; i++) {
        const cloud = makeCloud();
        cloud.position.set((Math.random() - 0.5) * dynamicPlazaRadius * 2, 12 + Math.random() * 4, (Math.random() - 0.5) * dynamicPlazaRadius * 2);
        cloud.userData.speed = 0.25 + Math.random() * 0.2;
        clouds.push(cloud);
        scene.add(cloud);
      }
      const birds: THREE.Group[] = [];
      for (let i = 0; i < 4; i++) {
        const bird = makeBird();
        bird.userData.angle = (i / 4) * Math.PI * 2;
        bird.userData.radius = 5 + i * 1.6;
        bird.userData.height = 7.5 + (i % 2) * 1.5;
        bird.userData.speed = 0.5 + i * 0.08;
        birds.push(bird);
        scene.add(bird);
      }
      // Central plaza fountain, sitting on the reserved open block.
      const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.4 }));
      fountainBase.position.set(plazaPos.x, 0.15, plazaPos.z);
      fountainBase.castShadow = castsShadows;
      fountainBase.receiveShadow = castsShadows;
      scene.add(fountainBase);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x3fa6c9, metalness: 0.3, roughness: 0.1, emissive: 0x1c4a5c, emissiveIntensity: 0.3 }));
      water.position.set(plazaPos.x, 0.33, plazaPos.z);
      scene.add(water);
      const spray = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xbfe8f2, transparent: true, opacity: 0.55 }));
      spray.position.set(plazaPos.x, 0.75, plazaPos.z);
      scene.add(spray);

      // Ambient traffic: cars drive along the grid streets. Each is assigned a fixed avenue (a
      // vertical street at some x, or a horizontal one at some z) and a direction, wrapping from
      // one edge to the other — real grid traffic rather than a single ring road.
      type CarNav = { axis: 'x' | 'z'; line: number; dir: 1 | -1; t: number };
      const cars = [0xd4442a, 0x3a6fd8, 0xe8e2d6, 0x2b8a5c, 0x8a5cb8].map((c, i) => {
        const car = makeCar(c);
        const vertical = i % 2 === 0;
        const nav: CarNav = vertical
          ? { axis: 'z', line: streetXs[1 + (i % Math.max(1, cols - 1))], dir: i % 4 < 2 ? 1 : -1, t: (i / 5) * cityHalfZ }
          : { axis: 'x', line: streetZs[1 + (i % Math.max(1, rows - 1))], dir: i % 4 < 2 ? 1 : -1, t: (i / 5) * cityHalfX };
        car.userData.nav = nav;
        car.userData.speed = 3.2 + i * 0.5;
        scene.add(car);
        return car;
      });

      // Ambient pedestrians stroll the sidewalks along the grid streets, offset to one side.
      const peds = [0x8b5cf6, 0xf59e0b, 0x10b981, 0xef4444, 0x38bdf8, 0xf472b6].map((c, i) => {
        const ped = makePedestrian(c);
        const vertical = i % 2 === 1;
        const nav: CarNav = vertical
          ? { axis: 'z', line: streetXs[1 + (i % Math.max(1, cols - 1))] + ROAD_W * 0.4, dir: i % 3 === 0 ? -1 : 1, t: (i / 6) * cityHalfZ }
          : { axis: 'x', line: streetZs[1 + (i % Math.max(1, rows - 1))] + ROAD_W * 0.4, dir: i % 3 === 0 ? -1 : 1, t: (i / 6) * cityHalfX };
        ped.userData.nav = nav;
        ped.userData.speed = 1.1 + (i % 3) * 0.35;
        scene.add(ped);
        return ped;
      });

      // Player avatar. `player` is the shared transform anchor (position + heading); its two
      // children — an on-foot avatar and a car — swap visibility when the player toggles Drive
      // (V8.2), so movement, camera-chase and proximity logic all stay identical either way.
      const player = new THREE.Group();

      const avatar = new THREE.Group();
      const playerBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 12), new THREE.MeshStandardMaterial({ color: 0x337dff, roughness: 0.5 }));
      playerBody.position.y = 0.5;
      avatar.add(playerBody);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 0.68, 0.28);
      avatar.add(nose);
      if (castsShadows) { playerBody.castShadow = true; nose.castShadow = true; }
      player.add(avatar);

      // Car: a compact coupe pointing +Z (matching the avatar's forward), built from simple
      // primitives so it stays cheap on mobile. Hidden until Drive is toggled on.
      const car = new THREE.Group();
      const carPaint = new THREE.MeshStandardMaterial({ color: 0xd9433a, roughness: 0.35, metalness: 0.5 });
      const carChassis = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.34, 1.7), carPaint);
      carChassis.position.y = 0.34;
      car.add(carChassis);
      const carCabin = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.86), new THREE.MeshStandardMaterial({ color: 0x1b2735, roughness: 0.25, metalness: 0.3 }));
      carCabin.position.set(0, 0.62, -0.02);
      car.add(carCabin);
      const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff0b0, emissiveIntensity: 0.6 });
      for (const sx of [-0.28, 0.28]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), headlightMat);
        hl.position.set(sx, 0.36, 0.86);
        car.add(hl);
      }
      const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 14);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.7 });
      const carWheels: THREE.Mesh[] = [];
      for (const wx of [-0.46, 0.46]) {
        for (const wz of [0.55, -0.55]) {
          const w = new THREE.Mesh(wheelGeo, wheelMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.18, wz);
          if (castsShadows) w.castShadow = true;
          car.add(w);
          carWheels.push(w);
        }
      }
      if (castsShadows) { carChassis.castShadow = true; carCabin.castShadow = true; }
      car.visible = false;
      player.add(car);

      scene.add(player);

      // Night starfield: fades in as the sun sets, scaled to the plaza so it always sits
      // comfortably outside the skyline ring regardless of how many companies are listed.
      const starCount = 260;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = dynamicPlazaRadius * 1.7 + Math.random() * dynamicPlazaRadius * 0.9;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1) * 0.55;
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.7 + 5;
        starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0, fog: false });
      scene.add(new THREE.Points(starGeo, starMat));

      camera.position.set(0, 5.2, 8);
      camera.lookAt(0, 1, 0);

      const skyDay = new THREE.Color(0x8fc4e8);
      const skyDusk = new THREE.Color(0xe08a4f);
      const skyNight = new THREE.Color(0x050914);
      const skyScratch = new THREE.Color();

      let heading = 0;
      let lastT = 0;
      let trainAngle = 0;
      const trainSpeed = 0.09; // rad/sec around the rail-yard ring
      const dayCycle = 70; // seconds for a full day/night loop

      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;

        // --- movement ---
        const drivingNow = drivingRef.current;
        if (avatar.visible === drivingNow) { avatar.visible = !drivingNow; car.visible = drivingNow; }
        const speed = drivingNow ? DRIVE_SPEED : MOVE_SPEED;
        const { x, z } = inputRef.current;
        const mag = Math.hypot(x, z);
        if (mag > 0.05) {
          const nx = x / Math.max(mag, 1);
          const nz = z / Math.max(mag, 1);
          const moved = speed * dt * Math.min(mag, 1);
          player.position.x += nx * moved;
          player.position.z += nz * moved;
          // Rectangular walk bounds matching the grid footprint.
          player.position.x = THREE.MathUtils.clamp(player.position.x, -walkHalfX, walkHalfX);
          player.position.z = THREE.MathUtils.clamp(player.position.z, -walkHalfZ, walkHalfZ);
          const targetHeading = Math.atan2(nx, nz);
          let diff = targetHeading - heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          // Cars turn more deliberately than a person spins on the spot.
          heading += diff * (drivingNow ? 0.14 : 0.25);
          player.rotation.y = heading;
          playerBody.position.y = 0.5 + Math.sin(t * 10) * 0.02;
          if (drivingNow) for (const w of carWheels) w.rotation.x += moved * 1.6;
        }

        // --- proximity / enter prompt ---
        let closest: string | null = null;
        let closestDist = Infinity;
        for (const bm of buildingMeshes) {
          const d = Math.hypot(player.position.x - bm.pos.x, player.position.z - bm.pos.z);
          if (d < closestDist) { closestDist = d; closest = bm.id; }
        }
        const threshold = nearbyRef.current ? EXIT_RADIUS : ENTER_RADIUS;
        const next = closest && closestDist < threshold ? closest : null;
        if (next !== nearbyRef.current) {
          nearbyRef.current = next;
          setNearby(next);
        }

        // --- camera chase (fixed relative offset, no rotation math needed) ---
        // Pull back and up a touch when driving so the faster car keeps more road in view.
        const camBack = drivingNow ? 9.5 : 7.5;
        const camHigh = drivingNow ? 6.2 : 5.2;
        camera.position.x += (player.position.x - camera.position.x) * 0.06;
        camera.position.z += (player.position.z + camBack - camera.position.z) * 0.06;
        camera.position.y += (camHigh - camera.position.y) * 0.06;
        camera.lookAt(player.position.x, 1, player.position.z);

        // --- day / night ---
        const phase = (((t + dayCycle * 0.25) % dayCycle) / dayCycle) * Math.PI * 2;
        const sunY = Math.sin(phase);
        sun.position.set(Math.cos(phase) * 10, Math.max(1, sunY * 10), 5);
        const isNight = sunY < 0.08;
        sun.intensity = Math.max(0.08, sunY) * 1.3;
        hemi.intensity = 0.25 + Math.max(0, sunY) * 0.45;
        // Three-stop sky (day → dusk → night) instead of a flat two-color lerp: sunset briefly
        // reads as a real amber horizon instead of blue fading straight to black.
        if (sunY >= 0.05) {
          skyScratch.copy(skyDay).lerp(skyDusk, THREE.MathUtils.clamp(1 - (sunY - 0.05) / 0.55, 0, 1));
        } else {
          skyScratch.copy(skyDusk).lerp(skyNight, THREE.MathUtils.clamp(1 - (sunY + 0.3) / 0.35, 0, 1));
        }
        (scene.fog as THREE.Fog).color = skyScratch;
        (scene.background as THREE.Color).copy(skyScratch);
        for (const bulb of lamps) (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 1.4 : 0.15;
        starMat.opacity = THREE.MathUtils.clamp(1 - Math.max(0, sunY) * 3.5, 0, 0.85);

        // --- ambient traffic & pedestrians: driving/strolling the grid streets ---
        for (const car of cars) {
          const nav = car.userData.nav as CarNav;
          nav.t += car.userData.speed * nav.dir * dt;
          const half = nav.axis === 'z' ? cityHalfZ : cityHalfX;
          if (nav.t > half) nav.t = -half;
          if (nav.t < -half) nav.t = half;
          if (nav.axis === 'z') { car.position.set(nav.line, 0.05, nav.t); car.rotation.y = nav.dir > 0 ? 0 : Math.PI; }
          else { car.position.set(nav.t, 0.05, nav.line); car.rotation.y = nav.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
          // headlights flare after dark, taillights glow a touch hotter too
          (car.userData.headMat as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 2.4 : 0.4;
          (car.userData.tailMat as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 1.6 : 0.6;
        }
        // The freight train: each unit trails the one ahead by a fixed angular gap around the
        // rail-yard ring, all riding the same leading angle so the convoy stays rigid.
        trainAngle += trainSpeed * dt;
        train.forEach((unit, i) => {
          const a = trainAngle - (i * trainSpacing) / trainRadius;
          unit.position.set(Math.cos(a) * trainRadius, 0.02, Math.sin(a) * trainRadius);
          unit.rotation.y = -a + Math.PI / 2;
        });
        (train[0].userData.headMat as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 2.4 : 0.4;
        for (const ped of peds) {
          const nav = ped.userData.nav as CarNav;
          nav.t += ped.userData.speed * nav.dir * dt;
          const half = nav.axis === 'z' ? cityHalfZ : cityHalfX;
          if (nav.t > half) nav.t = -half;
          if (nav.t < -half) nav.t = half;
          if (nav.axis === 'z') { ped.position.set(nav.line, 0, nav.t); ped.rotation.y = nav.dir > 0 ? 0 : Math.PI; }
          else { ped.position.set(nav.t, 0, nav.line); ped.rotation.y = nav.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
          // counter-phase limb swing: left arm forward with right leg, scaled by stride speed
          const stride = t * 5.5 + nav.t * 2;
          const swing = Math.sin(stride) * 0.55;
          const limbs = ped.userData.limbs as Record<string, THREE.Group>;
          limbs.legL.rotation.x = swing;
          limbs.legR.rotation.x = -swing;
          limbs.armL.rotation.x = -swing * 0.7;
          limbs.armR.rotation.x = swing * 0.7;
        }

        // --- sky life: drifting clouds, circling birds with flapping wings ---
        for (const cloud of clouds) {
          cloud.position.x += cloud.userData.speed * dt;
          if (cloud.position.x > dynamicPlazaRadius * 1.6) cloud.position.x = -dynamicPlazaRadius * 1.6;
        }
        for (const bird of birds) {
          bird.userData.angle += bird.userData.speed * dt;
          const a = bird.userData.angle;
          bird.position.set(Math.cos(a) * bird.userData.radius, bird.userData.height + Math.sin(t * 1.5 + a) * 0.4, Math.sin(a) * bird.userData.radius);
          bird.rotation.y = -a;
          const wings = bird.userData.wings as THREE.Group[];
          const flap = Math.sin(t * 9 + a * 4) * 0.6;
          wings[0].rotation.z = flap;
          wings[1].rotation.z = -flap;
        }

        // --- building flourishes: spinning exchange ring, blinking beacons, waving flags,
        //     construction cranes slowly slewing over their sites ---
        for (const bm of buildingMeshes) {
          bm.group.traverse((obj) => {
            if (obj.userData.spin) obj.rotation.z += 0.01;
            if (obj.userData.blink) (obj as THREE.Mesh).visible = Math.sin(t * 4) > 0;
            if (obj.userData.flag) obj.rotation.y = Math.sin(t * 3) * 0.3;
            if (obj.userData.craneSlew !== undefined) obj.rotation.y = Math.sin(t * 0.22 + obj.userData.craneSlew) * 1.1;
          });
        }
      };
    },
    [buildings.map((b) => `${b.id}:${b.tier}:${b.accent}:${b.dormant}:${b.constructing}:${b.kind}`).join(','), season],
    { controls: 'none' },
  );

  const nearbyBuilding = buildings.find((b) => b.id === nearby);

  return (
    <div
      className="relative w-full h-[480px] rounded-2xl overflow-hidden bg-slate-950 select-none"
      style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <div ref={ref} className="absolute inset-0" />

      {/* Virtual joystick — move/up tracked on window (see onJoyStart), so a
          drag that leaves this small circle keeps working even where
          setPointerCapture support is flaky. */}
      <div
        ref={joyBaseRef}
        onPointerDown={onJoyStart}
        className="absolute left-5 bottom-5 w-24 h-24 rounded-full bg-white/10 border border-white/20 touch-none"
        style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        <div
          className="absolute w-10 h-10 rounded-full bg-white/70"
          style={{
            left: `calc(50% - 20px + ${joyKnob?.x ?? 0}px)`,
            top: `calc(50% - 20px + ${joyKnob?.y ?? 0}px)`,
            transition: joyKnob ? 'none' : 'left 0.15s, top 0.15s',
          }}
        />
      </div>

      {/* Enter-building prompt, plus a quick action right here if one's on offer */}
      {nearbyBuilding && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-8 flex flex-col items-center gap-2 anim-in">
          {nearbyBuilding.quickAction && onQuickAction && (
            <button
              onClick={() => onQuickAction(nearbyBuilding.id)}
              className="bg-white/95 dark:bg-ink-800/95 text-slate-800 dark:text-white font-semibold text-sm px-4 py-2 rounded-full shadow-lg"
            >
              {nearbyBuilding.quickAction.icon} {nearbyBuilding.quickAction.label}
            </button>
          )}
          <button
            onClick={() => onEnter(nearbyBuilding.id)}
            className="bg-brand-500 text-white font-bold px-5 py-2.5 rounded-full shadow-lg"
          >
            Enter {nearbyBuilding.label} →
          </button>
        </div>
      )}

      {/* Drive / walk toggle — mirrors the joystick on the opposite corner */}
      <button
        onClick={() => { const next = !drivingRef.current; drivingRef.current = next; setDriving(next); }}
        className="absolute right-5 bottom-5 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-white/15 border border-white/25 text-white active:scale-95 transition-transform"
        style={{ touchAction: 'manipulation' }}
        aria-pressed={driving}
      >
        <span className="text-2xl leading-none">{driving ? '🚶' : '🚗'}</span>
        <span className="text-[9px] font-semibold mt-0.5">{driving ? 'Walk' : 'Drive'}</span>
      </button>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/30 px-3 py-1 rounded-full">
        {driving ? 'Cruise the grid — tap 🚶 to get out and walk' : 'Drag the stick or use WASD / arrow keys — tap 🚗 to drive'}
      </div>
    </div>
  );
}
