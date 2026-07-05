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

export type HubBuildingId = 'hq' | 'bank' | 'parliament' | 'exchange' | 'studio' | 'home' | 'office' | 'park' | 'docks' | 'newsstand';
export type HubArchetype = 'tower' | 'bank' | 'capitol' | 'exchange' | 'storefront' | 'house' | 'office' | 'park' | 'dock' | 'kiosk';
export type HubSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface HubBuilding {
  id: HubBuildingId;
  label: string;
  sublabel: string;
  archetype: HubArchetype;
  tier: 0 | 1 | 2 | 3; // drives lighting/size/extra props — reflects real sim state
  accent: string; // hex, used for glow/trim/banner color
  dormant?: boolean; // nothing built here yet — smaller, unlit, inviting rather than reactive
  quickAction?: { label: string; icon: string }; // an action offered right here, without leaving the plaza
}

interface CityHubSceneProps {
  buildings: HubBuilding[];
  season: HubSeason;
  onEnter: (id: HubBuildingId) => void;
  onQuickAction?: (id: HubBuildingId) => void;
}

const PLAZA_RADIUS = 11;
const RING_RADIUS = 8;
const WALK_BOUND = 9.9;
const ENTER_RADIUS = 2.3;
const EXIT_RADIUS = 2.8;
const MOVE_SPEED = 4.2;

const SEASON_FOLIAGE: Record<HubSeason, { leaf: string; ground: string }> = {
  spring: { leaf: '#5fae5a', ground: '#3f8f52' },
  summer: { leaf: '#3f8f52', ground: '#37793f' },
  autumn: { leaf: '#c9822f', ground: '#7a6a3a' },
  winter: { leaf: '#8a9a95', ground: '#6b7d78' },
};

// --------------------------------------------------------------------------- textures

function makeTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Deterministic window grid: a fixed on/off pattern, so a tier reliably reads the same way. */
function windowGridTexture(litRatio: number): THREE.CanvasTexture {
  return makeTexture(96, 192, (ctx, w, h) => {
    ctx.fillStyle = '#161c28';
    ctx.fillRect(0, 0, w, h);
    const cols = 4, rows = 9;
    const cw = w / cols, ch = h / rows;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        i++;
        const lit = ((i * 7) % 11) / 11 < litRatio;
        ctx.fillStyle = lit ? '#ffdf91' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(c * cw + cw * 0.18, r * ch + ch * 0.22, cw * 0.64, ch * 0.56);
      }
    }
  });
}

function plazaGroundTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.fillStyle = '#2f5138';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a9a92';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#83837a';
    ctx.lineWidth = 3;
    for (let r = 30; r < w * 0.3; r += 34) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // outer road ring
    ctx.strokeStyle = '#3a3f47';
    ctx.lineWidth = 42;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = '#e8c94a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.44, 0, Math.PI * 2);
    ctx.stroke();
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
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.15, d * 1.05), new THREE.MeshStandardMaterial({ color: accent, metalness: 0.6, roughness: 0.3 }));
  roof.position.y = h + 0.08;
  group.add(roof);
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
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.7), new THREE.MeshStandardMaterial({ color: 0x4a3324 }));
  door.position.set(0, 0.35, 0.71);
  group.add(door);
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffdf91, emissive: 0xffdf91, emissiveIntensity: tier > 0 ? 0.5 + tier * 0.15 : 0.05 });
  for (const dx of [-0.5, 0.5] as const) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), winMat);
    win.position.set(dx, 0.75, 0.71);
    group.add(win);
  }
  const tree = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10), new THREE.MeshStandardMaterial({ color: foliage, roughness: 0.8 }));
  tree.position.set(1.3, 0.9, -0.6);
  group.add(tree);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x5a3d28 }));
  trunk.position.set(1.3, 0.25, -0.6);
  group.add(trunk);
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
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x5a3d28 }));
    trunk.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshStandardMaterial({ color: foliage === '#8a9a95' ? '#c7d2ce' : foliage, roughness: 0.8 }));
    crown.position.set(Math.cos(a) * r, 0.55, Math.sin(a) * r);
    group.add(crown);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.22), new THREE.MeshStandardMaterial({ color: 0x8a6a45 }));
  bench.position.set(0, 0.18, 0.9);
  group.add(bench);
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

function buildBuilding(group: THREE.Group, b: HubBuilding, foliage: string): void {
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
  }
}

// --------------------------------------------------------------------------- ambient life

function makeCar(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.22), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
  body.position.y = 0.12;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.19), new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.3 }));
  cabin.position.set(-0.02, 0.24, 0);
  g.add(cabin);
  return g;
}

function makePedestrian(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  body.position.y = 0.28;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8c9a0 }));
  head.position.y = 0.48;
  g.add(head);
  return g;
}

// --------------------------------------------------------------------------- component

export function CityHubScene({ buildings, season, onEnter, onQuickAction }: CityHubSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ x: 0, z: 0 });
  const nearbyRef = useRef<HubBuildingId | null>(null);
  const [nearby, setNearby] = useState<HubBuildingId | null>(null);
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
    ({ scene, camera, makeLabel }) => {
      scene.fog = new THREE.Fog(0x0b1220, 14, 40);
      scene.background = new THREE.Color(0x0b1220);

      const hemi = new THREE.HemisphereLight(0x99b3d9, 0x2a2f22, 0.6);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(6, 10, 4);
      scene.add(sun);
      const fill = new THREE.AmbientLight(0xffffff, 0.25);
      scene.add(fill);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(PLAZA_RADIUS, 48),
        new THREE.MeshStandardMaterial({ map: plazaGroundTexture(), roughness: 0.95 }),
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      // Buildings, ring around the plaza, each with a floating name label.
      const buildingMeshes: { id: HubBuildingId; group: THREE.Group; pos: { x: number; z: number } }[] = [];
      buildings.forEach((b, i) => {
        const angle = (i / buildings.length) * Math.PI * 2;
        const x = Math.cos(angle) * RING_RADIUS, z = Math.sin(angle) * RING_RADIUS;
        const group = new THREE.Group();
        buildBuilding(group, b, foliage.leaf);
        group.position.set(x, 0, z);
        group.lookAt(0, 0, 0);
        scene.add(group);
        const label = makeLabel(b.label, 0.5);
        label.position.set(x, 3.6, z);
        scene.add(label);
        buildingMeshes.push({ id: b.id, group, pos: { x, z } });
      });

      // Plaza props: lamp posts, a fountain, a couple of trees.
      const lamps: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x1c2027 }));
        pole.position.y = 0.7;
        lamp.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xfff2c8, emissiveIntensity: 0.2 }));
        bulb.position.y = 1.42;
        lamp.add(bulb);
        lamp.position.set(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4);
        lamps.push(bulb);
        scene.add(lamp);
      }
      const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.3, 24), new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.4 }));
      fountainBase.position.y = 0.15;
      scene.add(fountainBase);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x3fa6c9, metalness: 0.3, roughness: 0.1, emissive: 0x1c4a5c, emissiveIntensity: 0.3 }));
      water.position.y = 0.33;
      scene.add(water);
      const spray = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xbfe8f2, transparent: true, opacity: 0.55 }));
      spray.position.y = 0.75;
      scene.add(spray);

      // Ambient traffic: a few cars looping the outer road.
      const cars = [0xd4442a, 0x3a6fd8, 0xe8e2d6].map((c, i) => {
        const car = makeCar(c);
        car.userData.angle = (i / 3) * Math.PI * 2;
        car.userData.speed = 0.18 + i * 0.03;
        scene.add(car);
        return car;
      });

      // Ambient pedestrians: a few looping a small circle in the plaza.
      const peds = [0x8b5cf6, 0xf59e0b, 0x10b981, 0xef4444].map((c, i) => {
        const ped = makePedestrian(c);
        ped.userData.angle = (i / 4) * Math.PI * 2;
        ped.userData.speed = 0.28 + i * 0.05;
        ped.userData.radius = 2.6 + (i % 2) * 0.8;
        scene.add(ped);
        return ped;
      });

      // Player avatar.
      const player = new THREE.Group();
      const playerBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 12), new THREE.MeshStandardMaterial({ color: 0x337dff, roughness: 0.5 }));
      playerBody.position.y = 0.5;
      player.add(playerBody);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 0.68, 0.28);
      player.add(nose);
      scene.add(player);

      camera.position.set(0, 5.2, 8);
      camera.lookAt(0, 1, 0);

      let heading = 0;
      let lastT = 0;
      const dayCycle = 70; // seconds for a full day/night loop

      return (t) => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)) || 0.016;
        lastT = t;

        // --- movement ---
        const { x, z } = inputRef.current;
        const mag = Math.hypot(x, z);
        if (mag > 0.05) {
          const nx = x / Math.max(mag, 1);
          const nz = z / Math.max(mag, 1);
          player.position.x += nx * MOVE_SPEED * dt * Math.min(mag, 1);
          player.position.z += nz * MOVE_SPEED * dt * Math.min(mag, 1);
          const dist = Math.hypot(player.position.x, player.position.z);
          if (dist > WALK_BOUND) {
            player.position.x = (player.position.x / dist) * WALK_BOUND;
            player.position.z = (player.position.z / dist) * WALK_BOUND;
          }
          const targetHeading = Math.atan2(nx, nz);
          let diff = targetHeading - heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          heading += diff * 0.25;
          player.rotation.y = heading;
          playerBody.position.y = 0.5 + Math.sin(t * 10) * 0.02;
        }

        // --- proximity / enter prompt ---
        let closest: HubBuildingId | null = null;
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
        camera.position.x += (player.position.x - camera.position.x) * 0.06;
        camera.position.z += (player.position.z + 7.5 - camera.position.z) * 0.06;
        camera.position.y = 5.2;
        camera.lookAt(player.position.x, 1, player.position.z);

        // --- day / night ---
        const phase = (((t + dayCycle * 0.25) % dayCycle) / dayCycle) * Math.PI * 2;
        const sunY = Math.sin(phase);
        sun.position.set(Math.cos(phase) * 10, Math.max(1, sunY * 10), 5);
        const isNight = sunY < 0.08;
        sun.intensity = Math.max(0.08, sunY) * 1.3;
        hemi.intensity = 0.25 + Math.max(0, sunY) * 0.45;
        const skyDay = new THREE.Color(0x8fc4e8), skyNight = new THREE.Color(0x050914);
        const skyT = Math.max(0, Math.min(1, (sunY + 0.25) / 1.1));
        const sky = skyDay.clone().lerp(skyNight, 1 - skyT);
        (scene.fog as THREE.Fog).color = sky;
        (scene.background as THREE.Color).copy(sky);
        for (const bulb of lamps) (bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = isNight ? 1.4 : 0.15;

        // --- ambient traffic & pedestrians ---
        for (const car of cars) {
          car.userData.angle += car.userData.speed * dt;
          const a = car.userData.angle;
          car.position.set(Math.cos(a) * 9.7, 0.05, Math.sin(a) * 9.7);
          car.rotation.y = -a + Math.PI / 2;
        }
        for (const ped of peds) {
          ped.userData.angle += ped.userData.speed * dt;
          const a = ped.userData.angle;
          const r = ped.userData.radius;
          ped.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
          ped.rotation.y = -a + Math.PI / 2;
          ped.position.y = Math.abs(Math.sin(t * 6 + a)) * 0.03;
        }

        // --- building flourishes: spinning exchange ring, blinking crane beacon, waving flag ---
        for (const bm of buildingMeshes) {
          bm.group.traverse((obj) => {
            if (obj.userData.spin) obj.rotation.z += 0.01;
            if (obj.userData.blink) (obj as THREE.Mesh).visible = Math.sin(t * 4) > 0;
            if (obj.userData.flag) obj.rotation.y = Math.sin(t * 3) * 0.3;
          });
        }
      };
    },
    [buildings.map((b) => `${b.id}:${b.tier}:${b.accent}:${b.dormant}`).join(','), season],
    { controls: 'none' },
  );

  const nearbyBuilding = buildings.find((b) => b.id === nearby);

  return (
    <div
      className="relative w-full h-[420px] rounded-2xl overflow-hidden bg-slate-950 select-none"
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

      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/30 px-3 py-1 rounded-full">
        Drag the stick or use WASD / arrow keys to walk
      </div>
    </div>
  );
}
