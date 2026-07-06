/** Small canvas-texture helpers shared across the literal-space 3D scenes (City hub, HQ tour). */
import * as THREE from 'three';

export function makeTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Deterministic window grid: a fixed on/off pattern, so a "lit ratio" reliably reads the same way. */
export function windowGridTexture(litRatio: number): THREE.CanvasTexture {
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
