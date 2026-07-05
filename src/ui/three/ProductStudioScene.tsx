/**
 * The Studio viewport: a futuristic innovation-lab environment (reflective glass
 * floor, holographic rings, drifting ambient particles, robotic arm silhouette)
 * with a procedurally built product on a rotating pedestal.
 *
 * Products are built to read like real industrial design, not primitives:
 * rounded-extruded unibodies, canvas-drawn screens / keyboards / watch faces /
 * bottle labels, physically-based materials with clearcoat and glass
 * transmission, image-based environment reflections, ACES tone mapping and a
 * soft contact shadow. Every category gets its own model, and every named part
 * of every model resolves its material through the per-part customization
 * system (PRODUCT_PARTS + Product.partOverrides), so any piece can carry its
 * own color, material and finish. The whole mesh rebuilds live as you design.
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useThreeScene } from './useThreeScene';
import type { Product, ProductFinish, ProductMaterialId, StudioLighting } from '../../sim/types';
import { PRODUCT_CATEGORY_BY_ID, PRODUCT_MATERIAL_BY_ID, PRODUCT_PARTS } from '../../data/productData';

interface ProductStudioSceneProps {
  product: Product;
  tall?: boolean;
}

const LIGHTING_PRESETS: Record<StudioLighting, { ambient: number; key: number; keyColor: number; rim: number; rimColor: number; fill: number; fillColor: number; fogColor: number; exposure: number }> = {
  studio: { ambient: 0.4, key: 1.6, keyColor: 0xffffff, rim: 0.9, rimColor: 0x88b4ff, fill: 0.5, fillColor: 0xffe9c9, fogColor: 0x0b1220, exposure: 1.15 },
  sunset: { ambient: 0.32, key: 1.5, keyColor: 0xffb066, rim: 0.8, rimColor: 0xff5e8a, fill: 0.35, fillColor: 0x7a5cff, fogColor: 0x180f1e, exposure: 1.05 },
  showroom: { ambient: 0.55, key: 1.9, keyColor: 0xfff6e8, rim: 1.0, rimColor: 0xffffff, fill: 0.6, fillColor: 0xdde8ff, fogColor: 0x11151d, exposure: 1.25 },
  noir: { ambient: 0.16, key: 1.3, keyColor: 0x9db8ff, rim: 1.2, rimColor: 0x38f2d4, fill: 0.2, fillColor: 0x27314a, fogColor: 0x05070d, exposure: 0.95 },
};

// ---------------------------------------------------------------------------
// Canvas textures — screens, keyboards, watch faces, labels, logos, shadows.
// All deterministic (no randomness) so rebuilds are visually stable.
// ---------------------------------------------------------------------------

function makeTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const APP_ICON_COLORS = ['#4f8ef7', '#34c77b', '#f7b23b', '#ee5f6e', '#9a6cf5', '#31c4d8', '#f2803b', '#5a6acf'];

function phoneScreenTexture(accent: string): THREE.CanvasTexture {
  return makeTexture(256, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
    g.addColorStop(0, accent);
    g.addColorStop(0.55, '#141a2c');
    g.addColorStop(1, '#05070d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // status bar
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('9:41', 16, 26);
    ctx.fillRect(w - 40, 14, 24, 11);
    ctx.fillRect(w - 15, 17, 3, 5);
    // app grid
    const cols = 4, size = 38, gapX = (w - cols * size) / (cols + 1);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < cols; col++) {
        const x = gapX + col * (size + gapX);
        const y = 60 + row * (size + 22);
        ctx.fillStyle = APP_ICON_COLORS[(row * cols + col) % APP_ICON_COLORS.length];
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 10);
        ctx.fill();
      }
    }
    // dock
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(10, h - 66, w - 20, 56, 16);
    ctx.fill();
    for (let col = 0; col < cols; col++) {
      const x = gapX + col * (size + gapX);
      ctx.fillStyle = APP_ICON_COLORS[(col + 3) % APP_ICON_COLORS.length];
      ctx.beginPath();
      ctx.roundRect(x, h - 57, size, size, 10);
      ctx.fill();
    }
  });
}

function laptopScreenTexture(accent: string, name: string): THREE.CanvasTexture {
  return makeTexture(512, 320, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, '#0a0f1c');
    g.addColorStop(0.6, '#17203a');
    g.addColorStop(1, accent);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // aurora sweep
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(-20, h * 0.8);
    ctx.bezierCurveTo(w * 0.3, h * 0.35, w * 0.6, h * 0.9, w + 20, h * 0.3);
    ctx.stroke();
    // menu bar
    ctx.fillStyle = 'rgba(8,12,22,0.75)';
    ctx.fillRect(0, 0, w, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(name.slice(0, 22), 12, 15);
    ctx.fillText('9:41', w - 40, 15);
    // floating window
    ctx.fillStyle = 'rgba(15,22,38,0.92)';
    ctx.beginPath();
    ctx.roundRect(w * 0.12, h * 0.24, w * 0.5, h * 0.44, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(w * 0.12, h * 0.24, w * 0.5, 18);
    for (const [i, c] of ['#ee5f6e', '#f7b23b', '#34c77b'].entries()) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(w * 0.12 + 14 + i * 14, h * 0.24 + 9, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // dock
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath();
    ctx.roundRect(w * 0.28, h - 34, w * 0.44, 26, 10);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = APP_ICON_COLORS[i];
      ctx.beginPath();
      ctx.roundRect(w * 0.3 + i * 36, h - 30, 18, 18, 5);
      ctx.fill();
    }
  });
}

/** Full laptop top deck: keyboard well, keys and trackpad, tinted to the body color. */
function deckTexture(bodyColor: string): THREE.CanvasTexture {
  return makeTexture(512, 360, (ctx, w, h) => {
    ctx.fillStyle = bodyColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.roundRect(w * 0.06, 14, w * 0.88, h * 0.5, 8);
    ctx.fill();
    const rows = 5, cols = 13;
    const kw = (w * 0.84) / cols, kh = (h * 0.44) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === rows - 1 && c > 2 && c < 10) continue; // spacebar span
        ctx.fillStyle = 'rgba(22,26,34,0.95)';
        ctx.beginPath();
        ctx.roundRect(w * 0.08 + c * kw, 22 + r * kh, kw - 4, kh - 5, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(w * 0.08 + c * kw, 22 + r * kh, kw - 4, 2);
      }
    }
    ctx.fillStyle = 'rgba(22,26,34,0.95)';
    ctx.beginPath();
    ctx.roundRect(w * 0.08 + 3 * kw, 22 + 4 * kh, 7 * kw - 4, kh - 5, 3);
    ctx.fill();
    // trackpad
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.roundRect(w * 0.34, h * 0.62, w * 0.32, h * 0.32, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
  });
}

function watchFaceTexture(accent: string): THREE.CanvasTexture {
  return makeTexture(256, 256, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = w * 0.47;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, '#161c28');
    g.addColorStop(1, '#04060b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // tick marks
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const major = i % 5 === 0;
      ctx.strokeStyle = major ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = major ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * (major ? 0.84 : 0.9), cy + Math.sin(a) * r * (major ? 0.84 : 0.9));
      ctx.lineTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96);
      ctx.stroke();
    }
    // complication
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.45, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('72', cx, cy + r * 0.5);
    // hands at 10:09 — the classic showroom time
    const hand = (angle: number, len: number, width: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * r * len, cy + Math.sin(angle) * r * len);
      ctx.stroke();
    };
    hand(-Math.PI / 2 - (2 / 12) * Math.PI * 2 + 0.1, 0.5, 6, '#e8edf5');
    hand(-Math.PI / 2 + (9 / 60) * Math.PI * 2, 0.78, 4, '#e8edf5');
    hand(-Math.PI / 2 + (31 / 60) * Math.PI * 2, 0.85, 2, accent);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Wraparound product label for bottles / jars — name, rules and a barcode. */
function labelTexture(name: string, tagline: string): THREE.CanvasTexture {
  return makeTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4f0e6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1d2430';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#1d2430';
    ctx.textAlign = 'center';
    ctx.font = '700 44px Georgia, serif';
    ctx.fillText(name.slice(0, 16).toUpperCase(), w / 2, h * 0.42);
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillStyle = '#4a5568';
    ctx.fillText(tagline.slice(0, 38), w / 2, h * 0.6);
    ctx.fillRect(w / 2 - 90, h * 0.68, 180, 2);
    // barcode
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = '#1d2430';
      ctx.fillRect(w / 2 - 56 + i * 4, h * 0.76, i % 3 === 0 ? 3 : 1.5, 30);
    }
  });
}

/** Transparent brand wordmark, used as a subtle engraving on product bodies. */
function wordmarkTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 44px system-ui, sans-serif';
  ctx.font = font;
  const tw = Math.ceil(ctx.measureText(text).width) + 16;
  canvas.width = Math.max(64, tw);
  canvas.height = 64;
  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** ECG-style readout for medical devices. */
function vitalsTexture(accent: string): THREE.CanvasTexture {
  return makeTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#04070c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(60,220,140,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let x = 0;
    ctx.moveTo(0, h * 0.45);
    while (x < w) {
      ctx.lineTo(x + 26, h * 0.45);
      ctx.lineTo(x + 34, h * 0.2);
      ctx.lineTo(x + 42, h * 0.72);
      ctx.lineTo(x + 50, h * 0.45);
      x += 86;
      ctx.lineTo(x, h * 0.45);
    }
    ctx.stroke();
    ctx.fillStyle = '#3cdc8c';
    ctx.font = '700 52px system-ui, sans-serif';
    ctx.fillText('72', w - 120, 66);
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('BPM', w - 120, 90);
    ctx.fillStyle = accent;
    ctx.font = '700 34px system-ui, sans-serif';
    ctx.fillText('98%', w - 120, h - 44);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('SpO₂', w - 120, h - 22);
  });
}

/** Soft radial contact shadow under the product. */
function shadowTexture(): THREE.CanvasTexture {
  return makeTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// ---------------------------------------------------------------------------
// Geometry + material helpers
// ---------------------------------------------------------------------------

/** Rounded-corner box via extrusion with a bevel — reads like machined unibody, not a primitive. */
function roundedBoxGeo(w: number, h: number, d: number, radius: number): THREE.ExtrudeGeometry {
  const r = Math.max(0.005, Math.min(radius, w / 2 - 0.004, h / 2 - 0.004));
  const x = -w / 2, y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const bevel = Math.min(d * 0.28, r * 0.7);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.translate(0, 0, -Math.max(0.002, d - bevel * 2) / 2);
  return geo;
}

/** Rounded box lying flat: footprint w×d in the XZ plane, thickness t upward. */
function flatRoundedGeo(w: number, d: number, t: number, radius: number): THREE.ExtrudeGeometry {
  const geo = roundedBoxGeo(w, d, t, radius);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function productMaterial(matId: string, finish: string, colorOverride?: string): THREE.MeshPhysicalMaterial {
  const def = PRODUCT_MATERIAL_BY_ID[matId];
  const mat = new THREE.MeshPhysicalMaterial({
    color: colorOverride ?? def.color,
    metalness: def.metalness,
    roughness: def.roughness,
    envMapIntensity: 1.0,
  });
  if (matId === 'glass') {
    mat.transmission = 0.85;
    mat.thickness = 0.4;
    mat.ior = 1.5;
    mat.roughness = Math.min(mat.roughness, 0.12);
  }
  if (finish === 'gloss') {
    mat.clearcoat = 1;
    mat.clearcoatRoughness = 0.06;
    mat.roughness = Math.max(0.05, mat.roughness * 0.45);
  } else if (finish === 'matte') {
    mat.roughness = Math.min(0.95, mat.roughness + 0.28);
    mat.envMapIntensity = 0.5;
  } else if (finish === 'metallic') {
    mat.metalness = Math.min(1, mat.metalness + 0.4);
    mat.roughness = Math.max(0.08, mat.roughness * 0.55);
    mat.envMapIntensity = 1.4;
  } else if (finish === 'brushed') {
    mat.metalness = Math.min(1, mat.metalness + 0.25);
    mat.roughness = 0.42;
  }
  return mat;
}

function screenMaterial(tex: THREE.CanvasTexture, tint = '#ffffff'): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(tint),
    emissiveMap: tex,
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.1,
  });
}

function emissiveDot(color: THREE.ColorRepresentation, r: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(r, 10, 10),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 }),
  );
}

function wordmarkPlane(text: string, height: number): THREE.Mesh {
  const tex = wordmarkTexture(text);
  const aspect = (tex.image as HTMLCanvasElement).width / 64;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(aspect * height, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false }),
  );
}

// ---------------------------------------------------------------------------
// Per-category product builders — every mesh resolves its material per part
// ---------------------------------------------------------------------------

/** Bespoke defaults for a part when the player has not overridden it. */
interface PartDefault {
  materialId?: ProductMaterialId;
  color?: string;
  finish?: ProductFinish;
  /** Fully custom material (screens, rubber, tinted glass) used when untouched. */
  custom?: () => THREE.Material;
}

interface BuildCtx {
  group: THREE.Group;
  product: Product;
  s: number;      // size multiplier
  slim: number;   // thickness multiplier from slimness slider
  curve: number;  // curvature 0..1
  accentAmt: number;
  brand: string;
  /** Resolve a part's material: player override → bespoke default → body/accent base. */
  mat: (partId: string, dflt?: PartDefault) => THREE.Material;
  /** Resolve a part's display color (for emissive details like LEDs and lights). */
  pc: (partId: string, fallback: string) => string;
}

function makeBuildCtx(group: THREE.Group, product: Product): BuildCtx {
  const f = product.form;
  const parts = PRODUCT_PARTS[product.category] ?? [];
  const overrides = product.partOverrides ?? {};
  const mat = (partId: string, dflt?: PartDefault): THREE.Material => {
    const o = overrides[partId];
    const hasOverride = !!(o && (o.color || o.materialId || o.finish));
    if (!hasOverride && dflt?.custom) return dflt.custom();
    const base = parts.find((x) => x.id === partId)?.base ?? 'body';
    const matId = o?.materialId ?? dflt?.materialId ?? (base === 'body' ? product.materials[0] : product.materials[1]);
    const finish = o?.finish ?? dflt?.finish ?? f.finish;
    const color = o?.color ?? dflt?.color ?? (base === 'body' ? f.bodyColor : f.accentColor);
    return productMaterial(matId, finish, color);
  };
  const pc = (partId: string, fallback: string): string => overrides[partId]?.color ?? fallback;
  return {
    group,
    product,
    s: f.size,
    slim: 1 - f.slimness * 0.55,
    curve: f.curvature,
    accentAmt: f.accent,
    brand: product.name.split(' ')[0] || product.name,
    mat,
    pc,
  };
}

const RUBBER = () => new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.92 });
const DARK_GLASS = () => new THREE.MeshPhysicalMaterial({ color: 0x101826, metalness: 0.5, roughness: 0.04, clearcoat: 1 });

function buildSlab(c: BuildCtx): void {
  const isTablet = c.product.category === 'tablet';
  const s = c.s;
  const w = (isTablet ? 1.5 : 0.92) * s, h = (isTablet ? 2.0 : 1.86) * s, d = (isTablet ? 0.095 : 0.13) * s * c.slim;
  const r = w * (0.07 + c.curve * 0.12);
  c.group.add(new THREE.Mesh(roundedBoxGeo(w, h, d, r), c.mat('body')));
  // display with a drawn home screen
  const screen = new THREE.Mesh(
    roundedBoxGeo(w * 0.93, h * 0.95, 0.012, r * 0.85),
    c.mat('screen', { custom: () => screenMaterial(phoneScreenTexture(c.product.form.accentColor), c.pc('screen', '#ffffff')) }),
  );
  screen.position.z = d / 2 + 0.004;
  c.group.add(screen);
  // rear camera island: plate + lenses + flash
  const plate = new THREE.Mesh(roundedBoxGeo(w * 0.38, w * 0.38, 0.035, w * 0.09), c.mat('camera'));
  plate.position.set(-w * 0.24, h * 0.32, -d / 2 - 0.014);
  c.group.add(plate);
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x0a1018, metalness: 0.4, roughness: 0.05, clearcoat: 1 });
  const lensCount = isTablet ? 1 : 3;
  const lensPos: Array<[number, number]> = [[-0.09, 0.09], [-0.09, -0.03], [0.03, 0.03]];
  for (let i = 0; i < lensCount; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.055, w * 0.012, 10, 24), productMaterial('chrome', 'metallic'));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.045, w * 0.045, 0.02, 20), lensGlass);
    lens.rotation.x = Math.PI / 2;
    const [lx, ly] = lensPos[i];
    for (const m of [ring, lens]) {
      m.position.set(-w * 0.24 + lx * w, h * 0.32 + ly * w, -d / 2 - 0.035);
      c.group.add(m);
    }
  }
  const flash = emissiveDot(0xfff2cc, w * 0.02);
  flash.position.set(-w * 0.24 + 0.03 * w, h * 0.32 + 0.1 * w, -d / 2 - 0.03);
  c.group.add(flash);
  // side buttons
  for (const [by, bh] of [[h * 0.22, 0.16 * s], [h * 0.05, 0.1 * s]] as const) {
    const btn = new THREE.Mesh(roundedBoxGeo(0.02 * s, bh, d * 0.5, 0.008), c.mat('buttons'));
    btn.rotation.y = Math.PI / 2;
    btn.position.set(w / 2 + 0.008, by, 0);
    c.group.add(btn);
  }
  // rear wordmark
  const mark = wordmarkPlane(c.brand, h * 0.05);
  mark.rotation.y = Math.PI;
  mark.position.set(0, -h * 0.1, -d / 2 - 0.006);
  c.group.add(mark);
}

function buildClamshell(c: BuildCtx): void {
  const s = c.s;
  const w = 1.95 * s, dpt = 1.35 * s, t = 0.085 * s * c.slim;
  const r = w * (0.03 + c.curve * 0.04);
  const base = new THREE.Mesh(flatRoundedGeo(w, dpt, t, r), c.mat('chassis'));
  base.position.y = t / 2;
  c.group.add(base);
  // keyboard + trackpad deck
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.96, dpt * 0.92),
    c.mat('keyboard', { custom: () => new THREE.MeshStandardMaterial({ map: deckTexture(c.pc('keyboard', c.product.form.bodyColor)), roughness: 0.6, metalness: 0.3 }) }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = t + 0.003;
  c.group.add(deck);
  // lid, opened ~110°
  const lid = new THREE.Group();
  lid.position.set(0, t, -dpt / 2 + 0.02);
  lid.rotation.x = -Math.PI / 2 + 1.92;
  const lidH = 1.3 * s;
  const lidMesh = new THREE.Mesh(roundedBoxGeo(w, lidH, t * 0.75, r), c.mat('chassis'));
  lidMesh.position.y = lidH / 2;
  lid.add(lidMesh);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.92, lidH * 0.88),
    c.mat('display', { custom: () => screenMaterial(laptopScreenTexture(c.product.form.accentColor, c.product.name), c.pc('display', '#ffffff')) }),
  );
  display.position.set(0, lidH / 2, t * 0.75 / 2 + 0.003);
  lid.add(display);
  const mark = wordmarkPlane(c.brand, lidH * 0.08);
  mark.rotation.y = Math.PI;
  mark.position.set(0, lidH / 2, -t * 0.75 / 2 - 0.004);
  lid.add(mark);
  c.group.add(lid);
  // hinge bar
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(t * 0.55, t * 0.55, w * 0.94, 14), c.mat('hinge'));
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, t, -dpt / 2 + 0.02);
  c.group.add(hinge);
  // rubber feet
  for (const [fx, fz] of [[-0.44, -0.4], [0.44, -0.4], [-0.44, 0.4], [0.44, 0.4]] as const) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.045 * s, 0.02, 10), RUBBER());
    foot.position.set(fx * w, -0.01, fz * dpt);
    c.group.add(foot);
  }
}

function buildWatch(c: BuildCtx): void {
  const s = c.s;
  const caseW = 0.95 * s, caseH = 1.08 * s, caseD = 0.26 * s * c.slim;
  const r = caseW * (0.2 + c.curve * 0.28); // curvature morphs square → round case
  c.group.add(new THREE.Mesh(roundedBoxGeo(caseW, caseH, caseD, r), c.mat('case')));
  const face = new THREE.Mesh(
    roundedBoxGeo(caseW * 0.86, caseH * 0.88, 0.012, r * 0.9),
    c.mat('face', { custom: () => screenMaterial(watchFaceTexture(c.product.form.accentColor), c.pc('face', '#ffffff')) }),
  );
  face.position.z = caseD / 2 + 0.004;
  c.group.add(face);
  // crystal dome
  const crystal = new THREE.Mesh(new THREE.SphereGeometry(caseW * 0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), productMaterial('glass', 'gloss'));
  crystal.scale.set(1, 1.1, 0.32);
  crystal.rotation.x = Math.PI / 2;
  crystal.position.z = caseD / 2 - 0.02;
  c.group.add(crystal);
  // crown + side button
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * s, 0.055 * s, 0.09 * s, 14), c.mat('crown'));
  crown.rotation.z = Math.PI / 2;
  crown.position.set(caseW / 2 + 0.04 * s, caseH * 0.16, 0);
  c.group.add(crown);
  const sideBtn = new THREE.Mesh(roundedBoxGeo(0.05 * s, 0.22 * s, 0.05 * s, 0.02 * s), c.mat('crown'));
  sideBtn.rotation.y = Math.PI / 2;
  sideBtn.position.set(caseW / 2 + 0.015 * s, -caseH * 0.12, 0);
  c.group.add(sideBtn);
  // strap: two curved bands
  for (const dir of [1, -1] as const) {
    const strap = new THREE.Mesh(roundedBoxGeo(caseW * 0.62, caseH * 0.85, caseD * 0.4, caseW * 0.12), c.mat('strap'));
    strap.position.set(0, dir * (caseH * 0.85), -caseD * 0.16);
    strap.rotation.x = -dir * 0.5;
    c.group.add(strap);
  }
}

function buildHeadphones(c: BuildCtx): void {
  const s = c.s;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.85 * s, 0.06 * s, 14, 40, Math.PI), c.mat('headband'));
  c.group.add(band);
  const pad = new THREE.Mesh(new THREE.TorusGeometry(0.85 * s, 0.075 * s, 12, 24, Math.PI * 0.5), c.mat('cushions', { custom: RUBBER }));
  pad.rotation.z = Math.PI * 0.25;
  c.group.add(pad);
  for (const dir of [1, -1] as const) {
    const cup = new THREE.Group();
    cup.position.set(dir * 0.85 * s, -0.1 * s, 0);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34 * s, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2), c.mat('cups'));
    shell.rotation.z = dir * Math.PI / 2;
    shell.scale.set(0.75, 1, 1);
    cup.add(shell);
    const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.26 * s, 0.085 * s, 12, 26), c.mat('cushions', { custom: RUBBER }));
    cushion.rotation.y = Math.PI / 2;
    cushion.position.x = -dir * 0.06 * s;
    cup.add(cushion);
    const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * s, 0.022 * s, 0.34 * s, 8), c.mat('yokes'));
    yoke.position.set(dir * 0.02 * s, 0.36 * s, 0);
    cup.add(yoke);
    const dot = wordmarkPlane(c.brand.slice(0, 1), 0.22 * s);
    dot.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    dot.position.x = dir * 0.28 * s;
    cup.add(dot);
    c.group.add(cup);
  }
}

function buildRing(c: BuildCtx): void {
  const s = c.s;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.52 * s, 0.075 * s * (0.7 + c.curve * 0.5), 18, 48), c.mat('band'));
  c.group.add(band);
  // gem on a prong setting
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: c.pc('gem', c.product.form.accentColor), metalness: 0.1, roughness: 0.02,
    transmission: 0.7, thickness: 0.4, ior: 2.2, envMapIntensity: 2.2,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17 * s, 0), gemMat);
  gem.position.y = 0.62 * s;
  gem.rotation.y = Math.PI / 4;
  c.group.add(gem);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.02 * s, 0.16 * s, 8), c.mat('setting'));
    prong.position.set(Math.cos(a) * 0.09 * s, 0.56 * s, Math.sin(a) * 0.09 * s);
    c.group.add(prong);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.13 * s, 0.1 * s, 16), c.mat('setting'));
  collar.position.y = 0.5 * s;
  c.group.add(collar);
}

function buildConsole(c: BuildCtx): void {
  const s = c.s;
  const w = 0.72 * s, h = 1.7 * s, d = 0.36 * s * c.slim;
  const r = w * (0.08 + c.curve * 0.1);
  c.group.add(new THREE.Mesh(roundedBoxGeo(w, h, d, r), c.mat('shell')));
  // center light strip
  const stripColor = c.pc('lightstrip', c.product.form.accentColor);
  const strip = new THREE.Mesh(roundedBoxGeo(0.03 * s, h * 0.86, 0.01, 0.01), new THREE.MeshStandardMaterial({ color: stripColor, emissive: stripColor, emissiveIntensity: 1.6 }));
  strip.position.z = d / 2 + 0.005;
  c.group.add(strip);
  // side vent lines
  for (let i = 0; i < 6; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.01, h * 0.4, d * 0.55), c.mat('vents'));
    vent.position.set(-w / 2 - 0.004, h * 0.12, 0);
    vent.position.y = h * 0.28 - i * 0.1 * s;
    c.group.add(vent);
  }
  // disc slot + power dot
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.015, h * 0.3, 0.012), new THREE.MeshStandardMaterial({ color: 0x0a0d12 }));
  slot.position.set(w * 0.28, -h * 0.05, d / 2 + 0.004);
  c.group.add(slot);
  const power = emissiveDot(stripColor, 0.018 * s);
  power.position.set(w * 0.28, -h * 0.34, d / 2 + 0.004);
  c.group.add(power);
  // stand
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * s, 0.4 * s, 0.045 * s, 28), c.mat('stand'));
  stand.position.y = -h / 2 - 0.02;
  c.group.add(stand);
}

function buildSpeaker(c: BuildCtx): void {
  const s = c.s;
  const wrapMat = c.mat('wrap') as THREE.MeshPhysicalMaterial;
  if ('roughness' in wrapMat) wrapMat.roughness = Math.max(wrapMat.roughness, 0.75); // fabric wrap reads matte
  const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.52 * s, 0.56 * s, 1.15 * s, 40), wrapMat);
  c.group.add(bodyMesh);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.52 * s, 0.52 * s, 0.06 * s, 40), c.mat('top'));
  top.position.y = 0.6 * s;
  c.group.add(top);
  const ledColor = c.pc('led', c.product.form.accentColor);
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.4 * s, 0.014 * s, 10, 48), new THREE.MeshStandardMaterial({ color: ledColor, emissive: ledColor, emissiveIntensity: 1.8 }));
  led.rotation.x = Math.PI / 2;
  led.position.y = 0.635 * s;
  c.group.add(led);
  const mark = wordmarkPlane(c.brand, 0.1 * s);
  mark.position.set(0, -0.42 * s, 0.56 * s);
  c.group.add(mark);
}

function buildAppliance(c: BuildCtx): void {
  const s = c.s;
  const w = 1.15 * s, h = 1.35 * s, d = 0.85 * s * c.slim;
  const r = w * (0.05 + c.curve * 0.08);
  c.group.add(new THREE.Mesh(roundedBoxGeo(w, h, d, r), c.mat('shell')));
  // brew head + platform (espresso-machine silhouette)
  const head = new THREE.Mesh(roundedBoxGeo(w * 0.5, h * 0.28, d * 0.5, r * 0.6), c.mat('head'));
  head.position.set(0, h * 0.12, d * 0.45);
  c.group.add(head);
  const tray = new THREE.Mesh(flatRoundedGeo(w * 0.6, d * 0.5, 0.04 * s, 0.04), c.mat('tray'));
  tray.position.set(0, -h / 2 + 0.05 * s, d * 0.35);
  c.group.add(tray);
  // control screen + dial
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.34, h * 0.14), screenMaterial(vitalsTexture(c.product.form.accentColor)));
  panel.position.set(0, h * 0.34, d / 2 + 0.004);
  c.group.add(panel);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * s, 0.075 * s, 0.05 * s, 24), c.mat('dial', { materialId: 'chrome', finish: 'metallic', color: '#dfe5ea' }));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(w * 0.3, h * 0.34, d / 2 + 0.02);
  c.group.add(dial);
  const mark = wordmarkPlane(c.brand, h * 0.05);
  mark.position.set(0, -h * 0.28, d / 2 + 0.006);
  c.group.add(mark);
}

function buildBottle(c: BuildCtx): void {
  const s = c.s;
  // smooth bottle profile: base → body → shoulder → neck
  const profile: Array<[number, number]> = [
    [0.02, 0], [0.3, 0], [0.34, 0.04], [0.35, 0.5], [0.35, 0.95],
    [0.32, 1.12], [0.2, 1.28], [0.13, 1.38], [0.12, 1.52], [0.12, 1.62],
  ];
  const pts = profile.map(([px, py]) => new THREE.Vector2(px * s * (0.8 + c.curve * 0.4), py * s * 1.15));
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), c.mat('vessel'));
  c.group.add(bottle);
  // wraparound printed label
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.355 * s * (0.8 + c.curve * 0.4), 0.355 * s * (0.8 + c.curve * 0.4), 0.5 * s, 48, 1, true),
    c.mat('label', { custom: () => new THREE.MeshStandardMaterial({ map: labelTexture(c.product.name, c.product.tagline), roughness: 0.8, color: c.pc('label', '#ffffff') }) }),
  );
  label.position.y = 0.72 * s;
  c.group.add(label);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.135 * s, 0.135 * s, 0.14 * s, 28), c.mat('cap'));
  cap.position.y = 1.9 * s;
  c.group.add(cap);
}

function buildPerfume(c: BuildCtx): void {
  const s = c.s;
  const w = 0.85 * s, h = 1.0 * s, d = 0.38 * s * c.slim;
  const flacon = new THREE.Mesh(
    roundedBoxGeo(w, h, d, w * (0.08 + c.curve * 0.2)),
    c.mat('flacon', {
      custom: () => {
        const glass = productMaterial('glass', 'gloss');
        glass.color = new THREE.Color(c.pc('flacon', c.product.form.bodyColor));
        glass.transmission = 0.9;
        return glass;
      },
    }),
  );
  c.group.add(flacon);
  // liquid inside
  const liquid = new THREE.Mesh(
    roundedBoxGeo(w * 0.82, h * 0.68, d * 0.6, w * 0.07),
    c.mat('liquid', { custom: () => new THREE.MeshPhysicalMaterial({ color: c.pc('liquid', c.product.form.accentColor), transmission: 0.5, roughness: 0.1, thickness: 0.3 }) }),
  );
  liquid.position.y = -h * 0.12;
  c.group.add(liquid);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.11 * s, 0.12 * s, 20), c.mat('cap'));
  neck.position.y = h / 2 + 0.06 * s;
  c.group.add(neck);
  const capSphere = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 24, 18), c.mat('cap'));
  capSphere.position.y = h / 2 + 0.26 * s;
  c.group.add(capSphere);
  const mark = wordmarkPlane(c.product.name.slice(0, 12), h * 0.09);
  mark.position.set(0, h * 0.22, d / 2 + 0.005);
  c.group.add(mark);
}

function buildHandbag(c: BuildCtx): void {
  const s = c.s;
  const w = 1.3 * s, h = 0.9 * s, d = 0.42 * s * c.slim;
  const r = w * (0.06 + c.curve * 0.1);
  c.group.add(new THREE.Mesh(roundedBoxGeo(w, h, d, r), c.mat('body')));
  // front flap
  const flap = new THREE.Mesh(roundedBoxGeo(w * 0.98, h * 0.55, 0.03 * s, r), c.mat('flap'));
  flap.position.set(0, h * 0.22, d / 2 + 0.012);
  c.group.add(flap);
  // clasp
  const clasp = new THREE.Mesh(roundedBoxGeo(0.14 * s, 0.1 * s, 0.03 * s, 0.03 * s), c.mat('hardware'));
  clasp.position.set(0, -h * 0.02, d / 2 + 0.035);
  c.group.add(clasp);
  // handle arc
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42 * s, 0.035 * s, 12, 32, Math.PI), c.mat('handle'));
  handle.position.y = h / 2;
  c.group.add(handle);
  // stitching hint: thin darker outline on flap edge
  const stitch = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.008, 0.032 * s), c.mat('hardware'));
  stitch.position.set(0, -h * 0.05, d / 2 + 0.012);
  c.group.add(stitch);
  const mark = wordmarkPlane(c.brand, h * 0.08);
  mark.position.set(0, h * 0.32, d / 2 + 0.032);
  c.group.add(mark);
}

function buildSeat(c: BuildCtx): void {
  const s = c.s;
  const cushion = new THREE.Mesh(flatRoundedGeo(1.35 * s, 1.25 * s, 0.24 * s, 0.14 * s), c.mat('cushion'));
  c.group.add(cushion);
  const back = new THREE.Mesh(roundedBoxGeo(1.35 * s, 1.15 * s, 0.16 * s, 0.12 * s), c.mat('backrest'));
  back.position.set(0, 0.62 * s, -0.56 * s);
  back.rotation.x = -0.12 - c.curve * 0.22;
  c.group.add(back);
  // lumbar pillow
  const pillow = new THREE.Mesh(roundedBoxGeo(1.1 * s, 0.4 * s, 0.14 * s, 0.14 * s), c.mat('pillow'));
  pillow.position.set(0, 0.34 * s, -0.44 * s);
  pillow.rotation.x = back.rotation.x;
  c.group.add(pillow);
  // armrests when accent is dialed up
  if (c.accentAmt > 0.4) {
    for (const dir of [1, -1] as const) {
      const arm = new THREE.Mesh(roundedBoxGeo(0.14 * s, 0.5 * s, 0.9 * s, 0.06 * s), c.mat('backrest'));
      arm.rotation.y = Math.PI / 2;
      arm.position.set(dir * 0.68 * s, 0.22 * s, 0);
      c.group.add(arm);
    }
  }
  // splayed tapered legs with floor pads
  for (const [lx, lz] of [[-0.52, -0.48], [0.52, -0.48], [-0.52, 0.48], [0.52, 0.48]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.05 * s, 0.8 * s, 12), c.mat('legs'));
    leg.position.set(lx * s * 1.15, -0.48 * s, lz * s * 1.15);
    leg.rotation.set(lz * 0.14, 0, -lx * 0.14);
    c.group.add(leg);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.02, 10), RUBBER());
    pad.position.set(lx * s * 1.21, -0.87 * s, lz * s * 1.21);
    c.group.add(pad);
  }
}

function buildVehicle(c: BuildCtx): void {
  const s = c.s;
  const L = 2.9 * s, W = 1.2 * s;
  const roofY = (0.72 + c.curve * 0.14) * s;
  const wheelR = 0.26 * s;
  // lower body: bumper → hood → beltline → trunk, with cut wheel arches,
  // extruded across the width. The greenhouse sits on top as separate glass.
  const belt = 0.47 * s;
  const shape = new THREE.Shape();
  shape.moveTo(-L / 2, 0.16 * s);
  shape.lineTo(-L / 2 + 0.05 * s, 0.32 * s);                       // front bumper
  shape.quadraticCurveTo(-L * 0.3, 0.45 * s, -L * 0.12, belt);     // hood
  shape.lineTo(L * 0.44, belt + 0.01 * s);                         // beltline
  shape.quadraticCurveTo(L / 2, belt, L / 2, 0.32 * s);            // trunk
  shape.lineTo(L / 2, 0.12 * s);
  shape.lineTo(L * 0.36, 0.12 * s);
  shape.absarc(L * 0.28, 0.12 * s, wheelR * 1.18, 0, Math.PI, true);   // rear arch
  shape.lineTo(-L * 0.2, 0.12 * s);
  shape.absarc(-L * 0.28, 0.12 * s, wheelR * 1.18, 0, Math.PI, true);  // front arch
  shape.lineTo(-L / 2, 0.12 * s);
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: W - 0.14 * s, bevelEnabled: true, bevelThickness: 0.07 * s, bevelSize: 0.06 * s, bevelSegments: 3, curveSegments: 14 });
  bodyGeo.translate(0, 0, -(W - 0.14 * s) / 2);
  c.group.add(new THREE.Mesh(bodyGeo, c.mat('paint')));
  // greenhouse: tinted glass canopy above the beltline (windshield → roof → rear glass)
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-L * 0.1, belt - 0.02 * s);
  glassShape.lineTo(-L * 0.02, roofY);
  glassShape.quadraticCurveTo(L * 0.12, roofY + 0.04 * s, L * 0.26, roofY - 0.02 * s);
  glassShape.lineTo(L * 0.4, belt - 0.02 * s);
  glassShape.closePath();
  const glassGeo = new THREE.ExtrudeGeometry(glassShape, { depth: W - 0.3 * s, bevelEnabled: true, bevelThickness: 0.03 * s, bevelSize: 0.03 * s, bevelSegments: 2, curveSegments: 10 });
  glassGeo.translate(0, 0, -(W - 0.3 * s) / 2);
  c.group.add(new THREE.Mesh(glassGeo, c.mat('glass', { custom: DARK_GLASS })));
  // wheels: tire + rim + spokes
  for (const [wx, wz] of [[-L * 0.28, W / 2], [-L * 0.28, -W / 2], [L * 0.28, W / 2], [L * 0.28, -W / 2]] as const) {
    const wheel = new THREE.Group();
    wheel.position.set(wx, 0.12 * s, wz);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(wheelR * 0.78, wheelR * 0.3, 14, 28), c.mat('tires', { custom: RUBBER }));
    wheel.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, 0.06 * s, 20), c.mat('rims'));
    rim.rotation.x = Math.PI / 2;
    wheel.add(rim);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(wheelR * 0.16, wheelR * 1.05, 0.05 * s), c.mat('rims'));
      spoke.rotation.z = (i / 5) * Math.PI * 2;
      wheel.add(spoke);
    }
    c.group.add(wheel);
  }
  // lights, grille, mirrors
  const headColor = c.pc('lights', '#cfe4ff');
  for (const dz of [1, -1] as const) {
    const head = new THREE.Mesh(roundedBoxGeo(0.16 * s, 0.06 * s, 0.05 * s, 0.02 * s), new THREE.MeshStandardMaterial({ color: 0xf3f8ff, emissive: headColor, emissiveIntensity: 1.5 }));
    head.rotation.y = Math.PI / 2;
    head.position.set(-L / 2 - 0.055 * s, 0.34 * s, dz * W * 0.3);
    c.group.add(head);
    const tail = new THREE.Mesh(roundedBoxGeo(0.14 * s, 0.05 * s, 0.05 * s, 0.02 * s), new THREE.MeshStandardMaterial({ color: 0xc22030, emissive: 0xff2038, emissiveIntensity: 1.2 }));
    tail.rotation.y = Math.PI / 2;
    tail.position.set(L / 2 + 0.055 * s, 0.35 * s, dz * W * 0.3);
    c.group.add(tail);
    const mirror = new THREE.Mesh(roundedBoxGeo(0.1 * s, 0.06 * s, 0.04 * s, 0.02 * s), c.mat('paint'));
    mirror.position.set(-L * 0.05, 0.52 * s, dz * (W / 2 + 0.05 * s));
    c.group.add(mirror);
  }
  const grille = new THREE.Mesh(roundedBoxGeo(0.4 * s, 0.1 * s, 0.03 * s, 0.03 * s), c.mat('grille', { custom: () => new THREE.MeshStandardMaterial({ color: 0x101318, metalness: 0.6, roughness: 0.4 }) }));
  grille.rotation.y = Math.PI / 2;
  grille.position.set(-L / 2 - 0.055 * s, 0.22 * s, 0);
  c.group.add(grille);
}

function buildSneaker(c: BuildCtx): void {
  const s = c.s;
  // sole: flat rounded outline with a slight heel wedge
  const sole = new THREE.Mesh(flatRoundedGeo(1.9 * s, 0.72 * s, 0.18 * s, 0.3 * s), c.mat('sole'));
  sole.position.y = -0.32 * s;
  c.group.add(sole);
  const wedge = new THREE.Mesh(flatRoundedGeo(0.8 * s, 0.7 * s, 0.1 * s, 0.28 * s), c.mat('sole'));
  wedge.position.set(0.5 * s, -0.22 * s, 0);
  c.group.add(wedge);
  // upper: toe box + midfoot + heel counter
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.34 * s, 22, 16), c.mat('upper'));
  toe.scale.set(1.25, 0.72, 1);
  toe.position.set(-0.62 * s, -0.12 * s, 0);
  c.group.add(toe);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2), c.mat('upper'));
  mid.scale.set(1.5, 0.95 + c.curve * 0.3, 0.78);
  mid.position.set(-0.05 * s, -0.24 * s, 0);
  c.group.add(mid);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.34 * s, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), c.mat('upper'));
  heel.scale.set(0.95, 1.35, 0.8);
  heel.position.set(0.62 * s, -0.24 * s, 0);
  c.group.add(heel);
  // laces across the instep
  for (let i = 0; i < 4; i++) {
    const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * s, 0.022 * s, 0.34 * s, 8), c.mat('laces'));
    lace.rotation.z = Math.PI / 2 + 0.35;
    lace.rotation.y = 0.15;
    lace.position.set(-0.38 * s + i * 0.17 * s, 0.02 * s + i * 0.07 * s, 0);
    c.group.add(lace);
  }
  // side swoosh stripe
  const stripe = new THREE.Mesh(roundedBoxGeo(0.75 * s, 0.07 * s, 0.02 * s, 0.03 * s), c.mat('stripe'));
  stripe.rotation.z = 0.28;
  stripe.position.set(0.12 * s, -0.18 * s, 0.31 * s);
  c.group.add(stripe);
  // heel pull tab
  const tab = new THREE.Mesh(roundedBoxGeo(0.06 * s, 0.16 * s, 0.02 * s, 0.02 * s), c.mat('stripe'));
  tab.position.set(0.86 * s, 0.28 * s, 0);
  c.group.add(tab);
}

function buildApparel(c: BuildCtx): void {
  const s = c.s;
  // dress form: shoulders → waist → hem, with a stand — reads as fashion on display
  const pts: THREE.Vector2[] = [];
  const profile: Array<[number, number]> = [
    [0.16, 0], [0.5, 0.06], [0.52, 0.2], [0.42, 0.7], [0.36, 0.95],
    [0.44, 1.25], [0.5, 1.5], [0.42, 1.62], [0.14, 1.7],
  ];
  for (const [px, py] of profile) pts.push(new THREE.Vector2(px * s * (0.85 + c.curve * 0.3), py * s));
  const form = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), c.mat('garment'));
  form.position.y = -0.85 * s;
  c.group.add(form);
  // collar + buttons
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15 * s, 0.035 * s, 10, 24), c.mat('collar'));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.86 * s;
  c.group.add(collar);
  for (let i = 0; i < 3; i++) {
    const btn = emissiveDot(c.pc('buttons', c.product.form.accentColor), 0.025 * s);
    btn.position.set(0, 0.55 * s - i * 0.3 * s, 0.46 * s - i * 0.015 * s);
    c.group.add(btn);
  }
  // stand pole + base
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 0.5 * s, 10), productMaterial('chrome', 'metallic'));
  pole.position.y = -1.1 * s;
  c.group.add(pole);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.34 * s, 0.04 * s, 24), productMaterial('chrome', 'metallic'));
  foot.position.y = -1.33 * s;
  c.group.add(foot);
}

function buildMedical(c: BuildCtx): void {
  const s = c.s;
  const w = 1.35 * s, h = 1.0 * s, d = 0.5 * s * c.slim;
  c.group.add(new THREE.Mesh(
    roundedBoxGeo(w, h, d, w * (0.06 + c.curve * 0.08)),
    c.mat('shell', { color: '#e9edf2' }),
  ));
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.72, h * 0.56),
    c.mat('screen', { custom: () => screenMaterial(vitalsTexture(c.product.form.accentColor), c.pc('screen', '#ffffff')) }),
  );
  display.position.set(-w * 0.08, h * 0.08, d / 2 + 0.004);
  c.group.add(display);
  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.045 * s, 0.03, 14), c.mat('buttons'));
    btn.rotation.x = Math.PI / 2;
    btn.position.set(w * 0.36, h * 0.26 - i * 0.2 * s, d / 2 + 0.012);
    c.group.add(btn);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.24 * s, 0.035 * s, 10, 24, Math.PI), c.mat('handle'));
  handle.position.y = h / 2;
  c.group.add(handle);
  const cross = wordmarkPlane('+', h * 0.2);
  cross.position.set(w * 0.34, -h * 0.3, d / 2 + 0.005);
  c.group.add(cross);
}

function buildIndustrial(c: BuildCtx): void {
  const s = c.s;
  const base = new THREE.Mesh(flatRoundedGeo(1.6 * s, 1.1 * s, 0.22 * s, 0.06 * s), c.mat('base'));
  base.position.y = -0.6 * s;
  c.group.add(base);
  // robotic arm: base → shoulder → forearm → claw
  const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.3 * s, 20), c.mat('joints'));
  pivot.position.y = -0.35 * s;
  c.group.add(pivot);
  const upper = new THREE.Mesh(roundedBoxGeo(0.16 * s, 0.9 * s, 0.16 * s, 0.05 * s), c.mat('arm'));
  upper.position.set(0.1 * s, 0.1 * s, 0);
  upper.rotation.z = -0.35;
  c.group.add(upper);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 16, 12), c.mat('joints'));
  joint.position.set(0.26 * s, 0.5 * s, 0);
  c.group.add(joint);
  const fore = new THREE.Mesh(roundedBoxGeo(0.12 * s, 0.72 * s, 0.12 * s, 0.04 * s), c.mat('arm'));
  fore.position.set(0.55 * s, 0.62 * s, 0);
  fore.rotation.z = -1.25;
  c.group.add(fore);
  for (const dz of [0.05, -0.05] as const) {
    const finger = new THREE.Mesh(roundedBoxGeo(0.04 * s, 0.2 * s, 0.03 * s, 0.012 * s), c.mat('claw'));
    finger.position.set(0.92 * s, 0.52 * s, dz * s);
    finger.rotation.z = -0.5;
    c.group.add(finger);
  }
  const beacon = emissiveDot(0xffb020, 0.04 * s);
  beacon.position.set(-0.6 * s, -0.44 * s, 0.4 * s);
  c.group.add(beacon);
}

function buildToy(c: BuildCtx): void {
  const s = c.s;
  // friendly robot buddy
  const torso = new THREE.Mesh(roundedBoxGeo(0.8 * s, 0.85 * s, 0.55 * s, 0.16 * s), c.mat('body'));
  c.group.add(torso);
  const head = new THREE.Mesh(roundedBoxGeo(0.6 * s, 0.5 * s, 0.5 * s, 0.16 * s), c.mat('body'));
  head.position.y = 0.75 * s;
  c.group.add(head);
  for (const dx of [0.14, -0.14] as const) {
    const eye = emissiveDot(c.pc('eyes', c.product.form.accentColor), 0.06 * s);
    eye.position.set(dx * s, 0.78 * s, 0.26 * s);
    c.group.add(eye);
  }
  const antennaRod = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.2 * s, 8), c.mat('antenna'));
  antennaRod.position.y = 1.1 * s;
  c.group.add(antennaRod);
  const antennaTip = emissiveDot(c.pc('antenna', c.product.form.accentColor), 0.04 * s);
  antennaTip.position.y = 1.22 * s;
  c.group.add(antennaTip);
  for (const dir of [1, -1] as const) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07 * s, 0.4 * s, 6, 12), c.mat('limbs'));
    arm.position.set(dir * 0.52 * s, 0.05 * s, 0);
    arm.rotation.z = dir * 0.3;
    c.group.add(arm);
    const foot = new THREE.Mesh(flatRoundedGeo(0.28 * s, 0.36 * s, 0.14 * s, 0.08 * s), c.mat('limbs'));
    foot.position.set(dir * 0.22 * s, -0.62 * s, 0.04 * s);
    c.group.add(foot);
  }
  // belly dial
  const dial = new THREE.Mesh(new THREE.TorusGeometry(0.14 * s, 0.03 * s, 10, 24), c.mat('limbs'));
  dial.position.set(0, -0.02 * s, 0.29 * s);
  c.group.add(dial);
}

// --- V13: eight new category models ----------------------------------------

function buildDrone(c: BuildCtx): void {
  const s = c.s;
  // center pod
  const pod = new THREE.Mesh(roundedBoxGeo(0.62 * s, 0.42 * s, 0.24 * s * c.slim, 0.1 * s), c.mat('frame'));
  pod.rotation.x = -Math.PI / 2;
  c.group.add(pod);
  // four arms + motor pods + rotor discs
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const arm = new THREE.Mesh(roundedBoxGeo(0.5 * s, 0.06 * s, 0.05 * s, 0.02 * s), c.mat('frame'));
    arm.rotation.y = Math.atan2(dz, dx);
    arm.position.set(dx * 0.42 * s, 0.02 * s, dz * 0.42 * s);
    c.group.add(arm);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.08 * s, 0.1 * s, 16), c.mat('rotors'));
    motor.position.set(dx * 0.62 * s, 0.06 * s, dz * 0.62 * s);
    c.group.add(motor);
    // rotor: translucent spin disc + two blades
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.006, 28), new THREE.MeshBasicMaterial({ color: 0xaebdd4, transparent: true, opacity: 0.14 }));
    disc.position.set(dx * 0.62 * s, 0.12 * s, dz * 0.62 * s);
    c.group.add(disc);
    for (const a of [0, Math.PI / 2] as const) {
      const blade = new THREE.Mesh(roundedBoxGeo(0.56 * s, 0.05 * s, 0.008, 0.02 * s), c.mat('rotors'));
      blade.rotation.x = -Math.PI / 2;
      blade.rotation.z = a + (dx * dz > 0 ? 0.4 : -0.4);
      blade.position.set(dx * 0.62 * s, 0.12 * s, dz * 0.62 * s);
      c.group.add(blade);
    }
    // nav lights: green starboard, red port
    const nav = emissiveDot(dz > 0 ? c.pc('led', '#3ddc74') : '#ff4d4d', 0.022 * s);
    nav.position.set(dx * 0.62 * s, -0.01 * s, dz * 0.62 * s);
    c.group.add(nav);
    // landing skid
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.02 * s, 0.16 * s, 8), c.mat('frame'));
    skid.position.set(dx * 0.4 * s, -0.14 * s, dz * 0.4 * s);
    c.group.add(skid);
  }
  // camera gimbal under the nose
  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 18, 14), c.mat('gimbal'));
  gimbal.position.set(0.24 * s, -0.14 * s, 0);
  c.group.add(gimbal);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.05 * s, 16), DARK_GLASS());
  lens.rotation.z = Math.PI / 2;
  lens.position.set(0.34 * s, -0.14 * s, 0);
  c.group.add(lens);
}

function buildCamera(c: BuildCtx): void {
  const s = c.s;
  const w = 1.3 * s, h = 0.85 * s, d = 0.5 * s * c.slim;
  c.group.add(new THREE.Mesh(roundedBoxGeo(w, h, d, w * (0.04 + c.curve * 0.06)), c.mat('body')));
  // grip bulge
  const grip = new THREE.Mesh(roundedBoxGeo(0.3 * s, h * 0.95, d * 1.15, 0.1 * s), c.mat('grip', { custom: RUBBER }));
  grip.position.set(-w * 0.42, 0, 0.02 * s);
  c.group.add(grip);
  // lens barrel with rings + front element
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.34 * s, 0.5 * s, 32), c.mat('lens'));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.1 * s, 0, d / 2 + 0.25 * s);
  c.group.add(barrel);
  for (const zOff of [0.12, 0.3] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.335 * s, 0.02 * s, 10, 32), c.mat('grip', { custom: RUBBER }));
    ring.position.set(0.1 * s, 0, d / 2 + zOff * s);
    c.group.add(ring);
  }
  const element = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.26 * s, 0.02, 28), DARK_GLASS());
  element.rotation.x = Math.PI / 2;
  element.position.set(0.1 * s, 0, d / 2 + 0.5 * s);
  c.group.add(element);
  // viewfinder hump + top dials + shutter
  const hump = new THREE.Mesh(roundedBoxGeo(0.42 * s, 0.18 * s, d * 0.7, 0.05 * s), c.mat('body'));
  hump.position.set(0.1 * s, h / 2 + 0.08 * s, 0);
  c.group.add(hump);
  for (const dx of [0.42, 0.62] as const) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 0.05 * s, 20), c.mat('dials'));
    dial.position.set(dx * s * 0.7, h / 2 + 0.03 * s, 0);
    c.group.add(dial);
  }
  const shutter = emissiveDot(c.pc('dials', c.product.form.accentColor), 0.03 * s);
  shutter.position.set(-w * 0.38, h / 2 + 0.03 * s, 0.08 * s);
  c.group.add(shutter);
  const mark = wordmarkPlane(c.brand, h * 0.12);
  mark.position.set(0.35 * s, h * 0.22, d / 2 + 0.004);
  c.group.add(mark);
}

function buildTV(c: BuildCtx): void {
  const s = c.s;
  const w = 2.5 * s, h = 1.45 * s, d = 0.07 * s * c.slim;
  // bezel frame with the screen inset
  c.group.add(new THREE.Mesh(roundedBoxGeo(w, h, d, 0.02 * s + c.curve * 0.02 * s), c.mat('bezel')));
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.97, h * 0.95),
    c.mat('panel', { custom: () => screenMaterial(laptopScreenTexture(c.product.form.accentColor, c.product.name), c.pc('panel', '#ffffff')) }),
  );
  panel.position.z = d / 2 + 0.003;
  c.group.add(panel);
  // center pedestal
  const neck = new THREE.Mesh(roundedBoxGeo(0.14 * s, 0.3 * s, 0.06 * s, 0.02 * s), c.mat('stand'));
  neck.position.y = -h / 2 - 0.14 * s;
  c.group.add(neck);
  const foot = new THREE.Mesh(flatRoundedGeo(0.9 * s, 0.42 * s, 0.035 * s, 0.1 * s), c.mat('stand'));
  foot.position.y = -h / 2 - 0.3 * s;
  c.group.add(foot);
  // soundbar
  const bar = new THREE.Mesh(roundedBoxGeo(w * 0.62, 0.09 * s, 0.09 * s, 0.04 * s), c.mat('speaker', { custom: RUBBER }));
  bar.position.y = -h / 2 - 0.08 * s;
  bar.position.z = 0.1 * s;
  c.group.add(bar);
  const mark = wordmarkPlane(c.brand, h * 0.05);
  mark.position.set(0, -h / 2 + 0.05 * s, d / 2 + 0.005);
  c.group.add(mark);
}

function buildBicycle(c: BuildCtx): void {
  const s = c.s;
  const wheelR = 0.5 * s;
  const frameMat = c.mat('frame');
  const tube = (x1: number, y1: number, x2: number, y2: number, r = 0.035) => {
    const from = new THREE.Vector3(x1 * s, y1 * s, 0);
    const to = new THREE.Vector3(x2 * s, y2 * s, 0);
    const len = from.distanceTo(to);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * s, r * s, len, 12), frameMat);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    c.group.add(m);
  };
  // wheels
  for (const wx of [-0.85, 0.85] as const) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.045 * s, 12, 40), c.mat('wheels', { custom: RUBBER }));
    tire.position.set(wx * s, 0, 0);
    c.group.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.08 * s, 12), c.mat('wheels'));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(wx * s, 0, 0);
    c.group.add(hub);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, wheelR * 1.9, 6), c.mat('wheels'));
      spoke.rotation.z = a;
      spoke.position.set(wx * s, 0, 0);
      c.group.add(spoke);
    }
  }
  // diamond frame (curvature relaxes the geometry)
  const seatX = -0.18 - c.curve * 0.06;
  tube(-0.85, 0, seatX, 0.72); // seat tube
  tube(seatX, 0.72, 0.62, 0.6); // top tube
  tube(0.62, 0.6, 0.85, 0);    // fork
  tube(-0.85, 0, 0.05, 0.02, 0.028);  // chainstay
  tube(0.05, 0.02, 0.62, 0.6); // down tube
  tube(0.05, 0.02, seatX, 0.72, 0.028);
  // crank + chainring
  const chainring = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.02 * s, 24), c.mat('frame'));
  chainring.rotation.x = Math.PI / 2;
  chainring.position.set(0.05 * s, 0.02 * s, 0.03 * s);
  c.group.add(chainring);
  for (const dz of [0.06, -0.06] as const) {
    const pedal = new THREE.Mesh(roundedBoxGeo(0.14 * s, 0.03 * s, 0.06 * s, 0.01 * s), c.mat('handlebar', { custom: RUBBER }));
    pedal.position.set(0.05 * s + (dz > 0 ? 0.1 : -0.1) * s, 0.02 * s + (dz > 0 ? -0.12 : 0.12) * s, dz * s * 1.6);
    c.group.add(pedal);
  }
  // saddle + seatpost
  tube(seatX, 0.72, seatX - 0.02, 0.86, 0.022);
  const saddle = new THREE.Mesh(flatRoundedGeo(0.34 * s, 0.14 * s, 0.05 * s, 0.05 * s), c.mat('saddle', { custom: RUBBER }));
  saddle.position.set((seatX - 0.03) * s, 0.9 * s, 0);
  c.group.add(saddle);
  // handlebar
  tube(0.62, 0.6, 0.58, 0.82, 0.024);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * s, 0.022 * s, 0.5 * s, 12), c.mat('handlebar'));
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0.58 * s, 0.82 * s, 0);
  c.group.add(bar);
  for (const dz of [0.22, -0.22] as const) {
    const gripEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.026 * s, 0.026 * s, 0.1 * s, 10), c.mat('saddle', { custom: RUBBER }));
    gripEnd.rotation.x = Math.PI / 2;
    gripEnd.position.set(0.58 * s, 0.82 * s, dz * s);
    c.group.add(gripEnd);
  }
}

function buildEyewear(c: BuildCtx): void {
  const s = c.s;
  const lensR = 0.34 * s;
  for (const dx of [1, -1] as const) {
    // rims + tinted lenses
    const rim = new THREE.Mesh(new THREE.TorusGeometry(lensR, 0.035 * s * (0.6 + c.curve * 0.6), 12, 36), c.mat('frame'));
    rim.position.set(dx * 0.42 * s, 0, 0);
    rim.scale.y = 0.85;
    c.group.add(rim);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(lensR * 0.94, lensR * 0.94, 0.015, 28), c.mat('lenses', { custom: DARK_GLASS }));
    lens.rotation.x = Math.PI / 2;
    lens.scale.y = 0.85;
    lens.position.set(dx * 0.42 * s, 0, 0);
    c.group.add(lens);
    // temples folding back
    const temple = new THREE.Mesh(roundedBoxGeo(0.05 * s, 0.045 * s, 0.85 * s, 0.02 * s), c.mat('temples'));
    temple.position.set(dx * 0.76 * s, 0.08 * s, -0.42 * s);
    c.group.add(temple);
    const hinge = emissiveDot(c.pc('hinges', c.product.form.accentColor), 0.022 * s);
    hinge.position.set(dx * 0.76 * s, 0.08 * s, 0);
    c.group.add(hinge);
  }
  // bridge
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.09 * s, 0.025 * s, 10, 20, Math.PI), c.mat('frame'));
  bridge.position.set(0, 0.05 * s, 0);
  c.group.add(bridge);
}

function buildGuitar(c: BuildCtx): void {
  const s = c.s;
  // double-cutaway electric body, extruded
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.75 * s);
  shape.bezierCurveTo(0.55 * s, -0.75 * s, 0.62 * s, -0.2 * s, 0.4 * s, 0.02 * s);
  shape.bezierCurveTo(0.3 * s, 0.14 * s, 0.42 * s, 0.22 * s, 0.28 * s, 0.32 * s);
  shape.lineTo(0.14 * s, 0.28 * s);
  shape.lineTo(-0.14 * s, 0.28 * s);
  shape.bezierCurveTo(-0.42 * s, 0.22 * s, -0.3 * s, 0.14 * s, -0.4 * s, 0.02 * s);
  shape.bezierCurveTo(-0.62 * s, -0.2 * s, -0.55 * s, -0.75 * s, 0, -0.75 * s);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.12 * s, bevelEnabled: true, bevelThickness: 0.02 * s, bevelSize: 0.02 * s, bevelSegments: 2, curveSegments: 16 });
  bodyGeo.translate(0, 0, -0.06 * s);
  c.group.add(new THREE.Mesh(bodyGeo, c.mat('body')));
  // pickguard
  const pg = new THREE.Mesh(flatRoundedGeo(0.42 * s, 0.5 * s, 0.008, 0.12 * s), c.mat('pickguard'));
  pg.rotation.x = Math.PI / 2;
  pg.position.set(0.1 * s, -0.3 * s, 0.085 * s);
  c.group.add(pg);
  // neck + fretboard + headstock
  const neck = new THREE.Mesh(roundedBoxGeo(0.11 * s, 1.15 * s, 0.05 * s, 0.02 * s), c.mat('neck'));
  neck.position.set(0, 0.85 * s, 0.02 * s);
  c.group.add(neck);
  const head = new THREE.Mesh(roundedBoxGeo(0.16 * s, 0.3 * s, 0.04 * s, 0.03 * s), c.mat('neck'));
  head.position.set(0, 1.55 * s, 0.02 * s);
  c.group.add(head);
  for (let i = 0; i < 6; i++) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.05 * s, 8), c.mat('hardware'));
    peg.rotation.z = Math.PI / 2;
    peg.position.set((i % 2 === 0 ? -0.1 : 0.1) * s, (1.44 + Math.floor(i / 2) * 0.09) * s, 0.02 * s);
    c.group.add(peg);
  }
  // pickups + bridge + knobs
  for (const py of [-0.18, -0.44] as const) {
    const pickup = new THREE.Mesh(roundedBoxGeo(0.26 * s, 0.07 * s, 0.03 * s, 0.02 * s), c.mat('hardware'));
    pickup.position.set(0, py * s, 0.085 * s);
    c.group.add(pickup);
  }
  const bridge = new THREE.Mesh(roundedBoxGeo(0.28 * s, 0.05 * s, 0.035 * s, 0.015 * s), c.mat('hardware'));
  bridge.position.set(0, -0.58 * s, 0.085 * s);
  c.group.add(bridge);
  for (const [kx, ky] of [[0.26, -0.5], [0.34, -0.38]] as const) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.03 * s, 16), c.mat('hardware'));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(kx * s, ky * s, 0.085 * s);
    c.group.add(knob);
  }
  // strings
  for (let i = 0; i < 6; i++) {
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004 * s, 0.004 * s, 2.1 * s, 4), productMaterial('chrome', 'metallic'));
    string.position.set((-0.045 + i * 0.018) * s, 0.42 * s, 0.095 * s);
    c.group.add(string);
  }
}

function buildKettle(c: BuildCtx): void {
  const s = c.s;
  // rounded kettle body via lathe
  const profile: Array<[number, number]> = [
    [0.04, 0], [0.42, 0.02], [0.5, 0.18], [0.52, 0.5], [0.44, 0.82], [0.3, 0.98], [0.24, 1.02],
  ];
  const pts = profile.map(([px, py]) => new THREE.Vector2(px * s * (0.85 + c.curve * 0.3), py * s));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 44), c.mat('body'));
  body.position.y = -0.5 * s;
  c.group.add(body);
  // lid + knob
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.28 * s, 0.06 * s, 28), c.mat('lid'));
  lid.position.y = 0.54 * s;
  c.group.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 16, 12), c.mat('lid'));
  knob.position.y = 0.62 * s;
  c.group.add(knob);
  // spout: angled tapered cylinder
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.09 * s, 0.55 * s, 16), c.mat('spout'));
  spout.rotation.z = -0.8;
  spout.position.set(0.52 * s, 0.22 * s, 0);
  c.group.add(spout);
  // handle arc
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3 * s, 0.04 * s, 12, 28, Math.PI * 0.9), c.mat('handle', { custom: RUBBER }));
  handle.rotation.z = 0.25;
  handle.position.set(-0.42 * s, 0.28 * s, 0);
  c.group.add(handle);
  // power base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.54 * s, 0.05 * s, 36), c.mat('handle', { custom: RUBBER }));
  base.position.y = -0.54 * s;
  c.group.add(base);
  const led = emissiveDot(c.pc('spout', c.product.form.accentColor), 0.025 * s);
  led.position.set(0.3 * s, -0.42 * s, 0.35 * s);
  c.group.add(led);
}

function buildDrill(c: BuildCtx): void {
  const s = c.s;
  // motor housing: horizontal capsule-ish body
  const housing = new THREE.Mesh(roundedBoxGeo(1.1 * s, 0.36 * s, 0.3 * s * c.slim, 0.12 * s), c.mat('body'));
  housing.position.y = 0.3 * s;
  c.group.add(housing);
  // torque ring + chuck at the front
  const torque = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.14 * s, 24), c.mat('chuck'));
  torque.rotation.z = Math.PI / 2;
  torque.position.set(-0.62 * s, 0.3 * s, 0);
  c.group.add(torque);
  const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.13 * s, 0.22 * s, 20), c.mat('chuck'));
  chuck.rotation.z = Math.PI / 2;
  chuck.position.set(-0.8 * s, 0.3 * s, 0);
  c.group.add(chuck);
  const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.012 * s, 0.3 * s, 8), productMaterial('steel', 'metallic'));
  bit.rotation.z = Math.PI / 2;
  bit.position.set(-1.02 * s, 0.3 * s, 0);
  c.group.add(bit);
  // pistol grip, slightly raked
  const grip = new THREE.Mesh(roundedBoxGeo(0.26 * s, 0.7 * s, 0.26 * s * c.slim, 0.08 * s), c.mat('grip', { custom: RUBBER }));
  grip.rotation.z = 0.15;
  grip.position.set(0.18 * s, -0.12 * s, 0);
  c.group.add(grip);
  // trigger
  const trigger = new THREE.Mesh(roundedBoxGeo(0.06 * s, 0.14 * s, 0.1 * s, 0.02 * s), c.mat('chuck'));
  trigger.position.set(0.0 * s, 0.08 * s, 0);
  c.group.add(trigger);
  // battery pack
  const battery = new THREE.Mesh(roundedBoxGeo(0.44 * s, 0.2 * s, 0.34 * s, 0.05 * s), c.mat('battery'));
  battery.rotation.x = -Math.PI / 2;
  battery.position.set(0.24 * s, -0.52 * s, 0);
  c.group.add(battery);
  const charge = emissiveDot(c.pc('battery', '#3ddc74'), 0.025 * s);
  charge.position.set(0.42 * s, -0.44 * s, 0.12 * s);
  c.group.add(charge);
  // side vents
  for (let i = 0; i < 3; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.015 * s, 0.32 * s), c.mat('chuck'));
    vent.position.set(0.2 * s + i * 0.12 * s, 0.38 * s, 0);
    c.group.add(vent);
  }
  const mark = wordmarkPlane(c.brand, 0.09 * s);
  mark.position.set(-0.1 * s, 0.3 * s, 0.16 * s);
  c.group.add(mark);
}

/** Builds the category-specific product model into `group`. */
function buildProductMesh(group: THREE.Group, product: Product): void {
  const cat = PRODUCT_CATEGORY_BY_ID[product.category];
  const ctx = makeBuildCtx(group, product);
  switch (product.category) {
    case 'wearable': buildWatch(ctx); return;
    case 'audio': buildHeadphones(ctx); return;
    case 'jewelry': buildRing(ctx); return;
    case 'gaming': buildConsole(ctx); return;
    case 'smart_home': buildSpeaker(ctx); return;
    case 'appliance': buildAppliance(ctx); return;
    case 'food_beverage': buildBottle(ctx); return;
    case 'cosmetics': buildPerfume(ctx); return;
    case 'luxury': buildHandbag(ctx); return;
    case 'fashion': buildApparel(ctx); return;
    case 'medical': buildMedical(ctx); return;
    case 'industrial': buildIndustrial(ctx); return;
    case 'toys': buildToy(ctx); return;
    case 'drone': buildDrone(ctx); return;
    case 'camera': buildCamera(ctx); return;
    case 'tv': buildTV(ctx); return;
    case 'bicycle': buildBicycle(ctx); return;
    case 'eyewear': buildEyewear(ctx); return;
    case 'instrument': buildGuitar(ctx); return;
    case 'kitchenware': buildKettle(ctx); return;
    case 'powertool': buildDrill(ctx); return;
    default: break;
  }
  switch (cat.archetype) {
    case 'slab': buildSlab(ctx); break;
    case 'clamshell': buildClamshell(ctx); break;
    case 'tower': buildConsole(ctx); break;
    case 'vessel': buildBottle(ctx); break;
    case 'seat': buildSeat(ctx); break;
    case 'vehicle': buildVehicle(ctx); break;
    case 'shoe': buildSneaker(ctx); break;
    case 'round': buildWatch(ctx); break;
    default: buildToy(ctx); break;
  }
}

/** Disposes a subtree's geometries/materials/textures without touching the renderer. */
function disposeSubtree(root: THREE.Object3D): void {
  const disposeMaterial = (m: THREE.Material) => {
    const tex = m as Partial<THREE.MeshStandardMaterial>;
    tex.map?.dispose();
    tex.emissiveMap?.dispose();
    tex.roughnessMap?.dispose();
    tex.normalMap?.dispose();
    tex.alphaMap?.dispose();
    m.dispose();
  };
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      obj.geometry?.dispose();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach(disposeMaterial);
      else if (mat) disposeMaterial(mat);
    } else if (obj instanceof THREE.Sprite) {
      obj.material.map?.dispose();
      obj.material.dispose();
    }
  });
}

/** Everything that changes the product's mesh (not just lighting mood). */
function meshSignature(p: Product): string {
  return [
    p.category, p.name, p.tagline, p.generation,
    p.materials[0], p.materials[1],
    p.form.size, p.form.slimness, p.form.curvature, p.form.accent,
    p.form.bodyColor, p.form.accentColor, p.form.finish,
    JSON.stringify(p.partOverrides ?? {}),
  ].join('|');
}

export function ProductStudioScene({ product, tall }: ProductStudioSceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The designer's sliders/color pickers fire on every drag tick. Rebuilding the
  // whole WebGL context + PMREM environment bake on each tick was catastrophically
  // slow on phones — so the outer effect below only ever depends on product.id
  // (mount once per product), and everything that changes while editing (mesh,
  // label, lighting mood) is updated live in the per-frame callback instead.
  const productRef = useRef(product);
  productRef.current = product;

  useThreeScene(
    ref,
    ({ scene, camera, renderer, addStars, makeLabel }) => {
      let preset = LIGHTING_PRESETS[productRef.current.form.lighting] ?? LIGHTING_PRESETS.studio;

      // Filmic tone mapping + image-based lighting so metals, glass and
      // clearcoat paint pick up believable reflections.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = preset.exposure;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      scene.environmentIntensity = 0.55;

      scene.fog = new THREE.Fog(preset.fogColor, 9, 30);
      addStars(220);

      // --- Innovation-lab environment -------------------------------------
      const ambient = new THREE.AmbientLight(0xffffff, preset.ambient);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(preset.keyColor, preset.key);
      key.position.set(4, 7, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(preset.rimColor, preset.rim);
      rim.position.set(-5, 3, -4);
      scene.add(rim);
      const fill = new THREE.PointLight(preset.fillColor, preset.fill * 8, 20);
      fill.position.set(0, 1.5, 4);
      scene.add(fill);

      // Reflective "glass" floor + soft under-glow
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(8, 64),
        new THREE.MeshStandardMaterial({ color: 0x10141c, metalness: 0.9, roughness: 0.25 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.31;
      scene.add(floor);

      // Holographic concentric rings
      const ringMats: THREE.MeshBasicMaterial[] = [];
      for (let i = 0; i < 3; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: preset.rimColor, transparent: true, opacity: 0.16 - i * 0.04, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.2 + i * 1.4, 2.26 + i * 1.4, 80), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -1.29;
        scene.add(ring);
        ringMats.push(mat);
      }

      // Pedestal
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.7, 0.28, 48),
        new THREE.MeshStandardMaterial({ color: 0x1d2430, metalness: 0.7, roughness: 0.3 }),
      );
      pedestal.position.y = -1.16;
      scene.add(pedestal);
      const pedestalGlow = new THREE.Mesh(
        new THREE.TorusGeometry(1.62, 0.025, 12, 60),
        new THREE.MeshBasicMaterial({ color: preset.rimColor, transparent: true, opacity: 0.8 }),
      );
      pedestalGlow.rotation.x = Math.PI / 2;
      pedestalGlow.position.y = -1.05;
      scene.add(pedestalGlow);

      // Robotic gantry arm silhouette at the edge of the lab
      const armMat = new THREE.MeshStandardMaterial({ color: 0x2a3242, metalness: 0.75, roughness: 0.4 });
      const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 18), armMat);
      armBase.position.set(-4.2, -1.05, -2.4);
      scene.add(armBase);
      const armLower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.0, 0.16), armMat);
      armLower.position.set(-4.2, 0, -2.4);
      armLower.rotation.z = 0.25;
      scene.add(armLower);
      const armUpper = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.13, 0.13), armMat);
      armUpper.position.set(-3.4, 0.95, -2.4);
      armUpper.rotation.z = -0.2;
      scene.add(armUpper);
      const armLight = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), new THREE.MeshBasicMaterial({ color: 0x38f2d4 }));
      armLight.position.set(-2.65, 0.8, -2.4);
      scene.add(armLight);

      // Ambient drifting particles
      const pCount = 90;
      const pPos = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 12;
        pPos[i * 3 + 1] = Math.random() * 5 - 1;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const particleMat = new THREE.PointsMaterial({ color: preset.rimColor, size: 0.05, transparent: true, opacity: 0.55, fog: false });
      const particles = new THREE.Points(pGeo, particleMat);
      scene.add(particles);

      // --- The product itself, rebuilt live as the designer edits it ------
      const spinner = new THREE.Group();
      scene.add(spinner);
      let productGroup: THREE.Group | null = null;
      const rebuildProduct = (p: Product) => {
        if (productGroup) {
          spinner.remove(productGroup);
          disposeSubtree(productGroup);
        }
        productGroup = new THREE.Group();
        buildProductMesh(productGroup, p);
        // Normalize height so every archetype sits nicely on the pedestal.
        const bounds = new THREE.Box3().setFromObject(productGroup);
        const center = bounds.getCenter(new THREE.Vector3());
        productGroup.position.sub(center);
        productGroup.position.y += -1.0 - bounds.min.y + center.y + 0.02;
        spinner.add(productGroup);
      };
      rebuildProduct(product);

      // Soft contact shadow grounding the product on the pedestal
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(3.1, 3.1),
        new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -1.015;
      scene.add(shadow);

      let label: THREE.Sprite | null = null;
      const rebuildLabel = (p: Product) => {
        if (label) {
          scene.remove(label);
          label.material.map?.dispose();
          label.material.dispose();
        }
        label = makeLabel(`${p.name}${p.generation > 1 ? ` · Gen ${p.generation}` : ''}`, 0.6);
        label.position.set(0, 1.9, 0);
        scene.add(label);
      };
      rebuildLabel(product);

      camera.position.set(0, 1.4, 5.4);
      camera.lookAt(0, 0, 0);

      let sig = meshSignature(product);
      let lightingKey = product.form.lighting;

      return (t) => {
        const p = productRef.current;
        const nextSig = meshSignature(p);
        if (nextSig !== sig) {
          sig = nextSig;
          rebuildProduct(p);
          rebuildLabel(p);
        }
        if (p.form.lighting !== lightingKey) {
          lightingKey = p.form.lighting;
          preset = LIGHTING_PRESETS[lightingKey] ?? LIGHTING_PRESETS.studio;
          renderer.toneMappingExposure = preset.exposure;
          scene.fog = new THREE.Fog(preset.fogColor, 9, 30);
          ambient.intensity = preset.ambient;
          key.color.set(preset.keyColor);
          key.intensity = preset.key;
          rim.color.set(preset.rimColor);
          rim.intensity = preset.rim;
          fill.color.set(preset.fillColor);
          fill.intensity = preset.fill * 8;
          for (const m of ringMats) m.color.set(preset.rimColor);
          (pedestalGlow.material as THREE.MeshBasicMaterial).color.set(preset.rimColor);
          particleMat.color.set(preset.rimColor);
        }

        spinner.rotation.y = t * 0.35;
        pedestalGlow.material.opacity = 0.55 + Math.sin(t * 2) * 0.25;
        armLight.position.y = 0.8 + Math.sin(t * 1.4) * 0.06;
        const pos = pGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pCount; i++) {
          let y = pos.getY(i) + 0.0035;
          if (y > 4) y = -1;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        camera.position.x = Math.sin(t * 0.07) * 0.6;
        camera.lookAt(0, 0, 0);
      };
    },
    [product.id],
  );

  return <div ref={ref} className={`w-full ${tall ? 'h-80' : 'h-60'} rounded-2xl overflow-hidden bg-slate-950`} />;
}
