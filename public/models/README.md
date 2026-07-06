# Real 3D models go here

This game's 3D scenes (`src/ui/three/*Scene.tsx`) are built entirely out of procedural
three.js primitives today — there are no shipped model files. `src/ui/three/modelLoader.ts`
is a working pipeline for real `.glb`/`.gltf` models when someone actually adds one:

1. Drop a `.glb` file in this folder, e.g. `public/models/office_tower.glb`.
2. In a scene, call `loadModel('/models/office_tower.glb')` (returns a `Promise<THREE.Group | null>`).
3. If it resolves to a model, swap it in; if it resolves `null` (no file / bad file), keep
   whatever procedural geometry is already there as the fallback — never leave a gap.

`CityHubScene`'s HQ tower already does this as a working example: it always builds the
procedural tower first, then tries `office_tower.glb` and swaps it in only if that file
actually exists.

Keep individual files modest (well under a few MB) — this is a mobile-first, fully offline
game, and every model here ships in the app bundle for anyone who plays it.
