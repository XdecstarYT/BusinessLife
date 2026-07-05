/**
 * Minimal reusable hook for mounting an ambient, auto-animating three.js scene into a
 * container div. Handles renderer/resize/cleanup boilerplate so individual scenes
 * (HQ tour, supply chain, election map, trade network) only describe their own geometry.
 *
 * Interaction comes free: dragging rotates the whole scene around Y (applied to the scene
 * root, so per-scene camera animation still works on top), and the mouse wheel / pinch
 * zooms via camera.zoom. Scenes opt into a subtle starfield backdrop via `handle.addStars()`.
 */
import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';

export interface ThreeSceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Adds a dim starfield sphere around the scene for depth. */
  addStars: (count?: number) => void;
  /** Creates a small floating text label as a sprite; caller positions and adds it. */
  makeLabel: (text: string, scale?: number) => THREE.Sprite;
}

function makeTextSprite(text: string, scale: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 26px system-ui, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  const h = 40;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = 'rgba(10, 16, 28, 0.55)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 10);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 12, h / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set((w / h) * scale, scale, 1);
  return sprite;
}

/** onFrame receives elapsed seconds; return it from `setup` to animate every frame. */
export type ThreeFrameFn = (elapsedSeconds: number) => void;

export function useThreeScene(
  containerRef: RefObject<HTMLDivElement | null>,
  setup: (handle: ThreeSceneHandle) => ThreeFrameFn | void,
  deps: React.DependencyList,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const addStars = (count = 300) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // Random points on a large sphere shell, kept above the horizon-ish
        const r = 30 + Math.random() * 20;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.6 - 2;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x64748b, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.7, fog: false }));
      scene.add(stars);
    };

    const makeLabel = (text: string, scale = 0.7) => makeTextSprite(text, scale);

    // Drag-to-rotate (whole scene) + wheel/pinch zoom (camera.zoom). Scene-level
    // rotation composes cleanly with each scene's own camera orbit animation.
    let dragging = false;
    let lastX = 0;
    let pinchDist = 0;
    const onPointerDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      scene.rotation.y += (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
    };
    const onPointerUp = () => { dragging = false; };
    const applyZoom = (delta: number) => {
      camera.zoom = Math.min(3, Math.max(0.5, camera.zoom * (1 - delta)));
      camera.updateProjectionMatrix();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(Math.sign(e.deltaY) * 0.08);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinchDist > 0) applyZoom((pinchDist - d) * 0.004);
      pinchDist = d;
    };
    const onTouchEnd = () => { pinchDist = 0; };
    const el = renderer.domElement;
    el.style.touchAction = 'pan-y';
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    const onFrame = setup({ scene, camera, renderer, addStars, makeLabel });

    let raf = 0;
    const clock = new THREE.Clock();
    const loop = () => {
      onFrame?.(clock.getElapsedTime());
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      const disposeMaterial = (m: THREE.Material) => {
        const tex = m as Partial<THREE.MeshStandardMaterial>;
        tex.map?.dispose();
        tex.emissiveMap?.dispose();
        tex.roughnessMap?.dispose();
        tex.normalMap?.dispose();
        tex.alphaMap?.dispose();
        m.dispose();
      };
      scene.traverse((obj) => {
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
      (scene.environment as THREE.Texture | null)?.dispose();
      scene.environment = null;
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
