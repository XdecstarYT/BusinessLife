/**
 * Optional real-model loading for the 3D scenes. Everything in `three/*Scene.tsx` is built out
 * of procedural three.js primitives (boxes, capsules, canvas textures) — there are no shipped
 * .glb/.gltf assets in this repo. This module is the pipeline for when real model files ARE
 * added: drop a `.glb` into `public/models/`, call `loadModel('/models/whatever.glb')`, and use
 * the returned group if it resolves — otherwise keep the existing procedural building/prop as a
 * fallback. Nothing in the game currently depends on a model actually being present.
 *
 * Plain (non-Draco-compressed) .glb/.gltf only for now: DRACOLoader pulls in its decoder
 * (js+wasm) as a build-time asset reference regardless of whether it's ever used, which is real
 * bytes shipped for a compression format there's no actual asset using yet. Add DRACOLoader back
 * here the day a real compressed model shows up — it's a few lines, not an architecture change.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let sharedLoader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (!sharedLoader) sharedLoader = new GLTFLoader();
  return sharedLoader;
}

const modelCache = new Map<string, Promise<THREE.Group | null>>();

/**
 * Loads a .glb/.gltf from `url` (e.g. '/models/office_tower.glb') and returns a cloneable group,
 * or `null` if the file doesn't exist / fails to parse — callers should treat `null` as "use the
 * procedural fallback," not as an error to surface to the player. Results are cached by url, so
 * multiple buildings/instances reusing the same model only pay the load cost once.
 */
export function loadModel(url: string): Promise<THREE.Group | null> {
  const cached = modelCache.get(url);
  if (cached) return cached;
  const promise = new Promise<THREE.Group | null>((resolve) => {
    getLoader().load(
      url,
      (gltf) => {
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        resolve(gltf.scene);
      },
      undefined,
      () => resolve(null), // missing file or parse failure — silent, caller falls back
    );
  });
  modelCache.set(url, promise);
  return promise;
}

/** Deep-clones a loaded model's scene graph (materials included) so the same source model can be
 * placed multiple times in a scene without instances sharing transforms. */
export function cloneModel(source: THREE.Group): THREE.Group {
  return source.clone(true);
}
