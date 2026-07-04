/**
 * Minimal reusable hook for mounting an ambient, auto-animating three.js scene into a
 * container div. Handles renderer/resize/cleanup boilerplate so individual scenes
 * (HQ tour, supply chain, election map, trade network) only describe their own geometry.
 */
import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';

export interface ThreeSceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
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

    const onFrame = setup({ scene, camera, renderer });

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
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
