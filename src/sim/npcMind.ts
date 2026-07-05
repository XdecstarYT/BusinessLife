/**
 * NPC "mind" helpers: the stable trait vector + dynamic state every NPC carries
 * (see the NPC interface in types.ts), a capped memory log, and a composite
 * disposition score used to make reactions to the player read from traits and
 * memory instead of flat dice rolls. Kept centralized so world.ts and family.ts
 * (the only two places that construct NPCs) stay in sync.
 */
import type { NPC } from './types';
import { clamp100 } from './types';
import type { RNG } from './rng';

export interface MindTraits {
  empathy: number;
  aggression: number;
  socialConfidence: number;
  discipline: number;
  loyalty: number;
  curiosity: number;
  mood: number;
  stress: number;
  fatigue: number;
  financialPressure: number;
  relationshipTension: number;
  careerSatisfaction: number;
}

/** Fresh, randomized trait/state block for a newly-created NPC. */
export function randomMindTraits(rng: RNG): MindTraits {
  return {
    empathy: rng.int(15, 90),
    aggression: rng.int(10, 85),
    socialConfidence: rng.int(20, 90),
    discipline: rng.int(20, 90),
    loyalty: rng.int(20, 90),
    curiosity: rng.int(15, 90),
    mood: rng.int(40, 70),
    stress: rng.int(15, 55),
    fatigue: rng.int(10, 45),
    financialPressure: rng.int(5, 40),
    relationshipTension: 0,
    careerSatisfaction: rng.int(35, 75),
  };
}

/** Push a new memory entry, capped so the list can't grow unbounded across a long dynasty. */
export function pushMemory(entity: { memory: string[] }, text: string): void {
  entity.memory.unshift(text);
  if (entity.memory.length > 8) entity.memory.length = 8;
}

/** A 0..100 composite "warmth" toward the player, blending their opinion with stable
 * loyalty/empathy traits — used to modulate mentor effectiveness, rivalry heat, and
 * spousal stability instead of pure randomness. */
export function npcWarmth(npc: NPC): number {
  const opinionPart = (npc.opinionOfPlayer + 100) / 2; // -100..100 -> 0..100
  return clamp100(opinionPart * 0.6 + npc.loyalty * 0.25 + npc.empathy * 0.15);
}
