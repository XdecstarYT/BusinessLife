/**
 * Minimal reusable hook for mounting an ambient, auto-animating three.js scene into a
 * container div. Handles renderer/resize/cleanup boilerplate so individual scenes
 * (HQ tour, supply chain, election map, trade network) only describe their own geometry.
 *
 * The rendering pipeline aims for a believable, filmic look rather than the flat, washed-out
 * default three.js output: ACES filmic tone mapping + correct sRGB output, a procedural studio
 * environment map so PBR materials get real reflections instead of looking chalky, soft shadows,
 * and a light bloom pass so every emissive accent (windows, screens, beacons) actually glows.
 * Shadows and bloom are desktop-only (`handle.quality === 'desktop'`) — phone GPUs, especially at
 * devicePixelRatio 3 on iPhone, choke on shadow maps and multi-pass post-processing stacked on
 * top of several dynamic lights, so touch devices get the tone-mapped/environment-lit look
 * without the two most expensive pieces.
 *
 * Interaction comes free: dragging rotates the whole scene around Y (applied to the scene
 * root, so per-scene camera animation still works on top), and the mouse wheel / pinch
 * zooms via camera.zoom. Scenes opt into a subtle starfield backdrop via `handle.addStars()`.
 */
import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type ThreeQualityTier = 'mobile' | 'desktop';

export interface ThreeSceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** 'desktop' gets shadows + bloom; 'mobile' (touch devices) skips both for frame rate. */
  quality: ThreeQualityTier;
  /** Adds a dim starfield sphere around the scene for depth. */
  addStars: (count?: number) => void;
  /** Creates a small floating text label as a sprite; caller positions and adds it. */
  makeLabel: (text: string, scale?: number) => THREE.Sprite;
  /** V57: marks an object (and its subtree) as a tap/click target for `options.onPick`. A tap
   * that hits nothing registered, or moves/holds too long to read as a tap rather than a
   * drag-to-rotate gesture, is silently ignored. */
  registerClickable: (obj: THREE.Object3D, id: string) => void;
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

export interface ThreeSceneOptions {
  /** 'orbit' (default) attaches drag-to-rotate + wheel/pinch zoom. 'none' skips them so the
   * scene can implement its own input (e.g. a walkable hub driving a player character). */
  controls?: 'orbit' | 'none';
  /** V57: called with the id passed to `handle.registerClickable` for whatever registered
   * object a tap hits (nearest hit wins). Coexists with drag-to-rotate: a pointer that moves
   * more than a few pixels or is held past a quarter-second reads as a drag/long-press, not
   * a tap, so rotating the scene never misfires an interaction. */
  onPick?: (id: string) => void;
}

export function useThreeScene(
  containerRef: RefObject<HTMLDivElement | null>,
  setup: (handle: ThreeSceneHandle) => ThreeFrameFn | void,
  deps: React.DependencyList,
  options?: ThreeSceneOptions,
): void {
  const orbitControls = options?.controls !== 'none';
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }
    // Phone GPUs (especially at devicePixelRatio 3 on iPhone) choke on a full-res
    // canvas with several dynamic lights and physical materials; cap lower on
    // touch devices so mobile stays smooth instead of dropping frames.
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const quality: ThreeQualityTier = isTouchDevice ? 'mobile' : 'desktop';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchDevice ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    if (quality === 'desktop') {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    const el = renderer.domElement;
    container.appendChild(el);

    // A procedural studio environment (three.js's standard stand-in for an HDRI) so metal,
    // glass and other PBR materials pick up believable reflections instead of looking flat —
    // this is a one-time cost at mount, not a per-frame one, so it's cheap on every device.
    // Every scene's direct lights were hand-tuned against flat (non-IBL) lighting, so the
    // environment's contribution is dialed down to a supporting role rather than stacking
    // full-strength on top and blowing out ground planes and pale materials.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    // V8.0 graphics pass: a touch more IBL so metal/glass across every scene picks up richer
    // reflections. Kept a small step (0.4 → 0.46) so it enriches PBR surfaces without blowing
    // out the pale ground planes each scene's direct lights were tuned against.
    scene.environmentIntensity = 0.46;
    pmrem.dispose();

    // Bloom + a final output pass (correct tone mapping/color space through the composer)
    // is the single highest-impact, lowest-effort move for "does this look expensive" — every
    // emissive accent in these scenes (windows, screens, beacons, seals) actually glows instead
    // of just being a flat bright color. Desktop only: two extra full-screen passes per frame is
    // real GPU cost, and phones already have shadows/lights to worry about.
    //
    // EffectComposer's default render target has no MSAA of its own — the renderer's
    // `antialias: true` only smooths edges when drawing straight to the canvas, and once a
    // composer is in the loop every frame goes through an off-screen target instead. Without
    // this, desktop (the tier that actually gets the composer) would silently lose the
    // antialiasing mobile still has, undoing rather than improving on the plain-renderer look.
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (quality === 'desktop') {
      const msaaTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, msaaTarget);
      composer.addPass(new RenderPass(scene, camera));
      // Ambient occlusion: darkens the crevices where geometry meets geometry (a building base
      // against the ground, a seat against its neighbor) — the single biggest cue that grounds
      // objects in a real space instead of having them float, cheap-looking, over a flat plane.
      const aoPass = new GTAOPass(scene, camera, 1, 1);
      aoPass.blendIntensity = 0.7;
      composer.addPass(aoPass);
      // V8.0 graphics pass: a slightly stronger but higher-threshold bloom — only genuinely bright
      // emissives (windows, screens, beacons, the globe's markers) bloom, and they bloom a little
      // harder, for a cleaner, more cinematic glow than the previous wash.
      bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 0.85);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      composer?.setSize(w, h);
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

    // V57: tap-to-interact registry, independent of the drag-to-rotate/zoom listeners below so
    // scenes can offer both at once (drag to look around, tap a specific object to act on it).
    const pickables = new Map<THREE.Object3D, string>();
    const registerClickable = (obj: THREE.Object3D, id: string) => { pickables.set(obj, id); };
    const raycaster = new THREE.Raycaster();
    let pickDownX = 0;
    let pickDownY = 0;
    let pickDownT = 0;
    const onPickDown = (e: PointerEvent) => { pickDownX = e.clientX; pickDownY = e.clientY; pickDownT = performance.now(); };
    const onPickUp = (e: PointerEvent) => {
      if (!options?.onPick) return;
      const dx = e.clientX - pickDownX;
      const dy = e.clientY - pickDownY;
      if (Math.hypot(dx, dy) > 6 || performance.now() - pickDownT > 400) return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(Array.from(pickables.keys()), true);
      for (const hit of hits) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !pickables.has(o)) o = o.parent;
        if (o) { options.onPick(pickables.get(o)!); break; }
      }
    };
    if (options?.onPick) {
      el.addEventListener('pointerdown', onPickDown);
      el.addEventListener('pointerup', onPickUp);
    }

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
    if (orbitControls) {
      el.style.touchAction = 'pan-y';
      el.style.cursor = 'grab';
      el.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd);
    } else {
      el.style.touchAction = 'none';
    }

    const onFrame = setup({ scene, camera, renderer, quality, addStars, makeLabel, registerClickable });

    let raf = 0;
    let contextLost = false;
    const clock = new THREE.Clock();
    const loop = () => {
      if (!contextLost) {
        onFrame?.(clock.getElapsedTime());
        if (composer) composer.render();
        else renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    // iOS Safari aggressively reclaims WebGL contexts under memory pressure (backgrounding
    // the tab, too many contexts alive at once). Without handling this the canvas just
    // freezes on a stale frame or goes black — the "3D is broken" symptom. We can't cheaply
    // rebuild all scene geometry, so we pause rendering and let the browser's automatic
    // context restore (three.js re-uploads GPU resources on the next render call) resume it.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    el.addEventListener('webglcontextlost', onContextLost, false);
    el.addEventListener('webglcontextrestored', onContextRestored, false);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('webglcontextlost', onContextLost);
      el.removeEventListener('webglcontextrestored', onContextRestored);
      if (options?.onPick) {
        el.removeEventListener('pointerdown', onPickDown);
        el.removeEventListener('pointerup', onPickUp);
      }
      ro.disconnect();
      if (orbitControls) {
        el.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
      }
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
      envTexture.dispose();
      scene.environment = null;
      composer?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
