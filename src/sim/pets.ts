/**
 * Pets: adopted companions with a real lifecycle. They age every year, cost
 * upkeep, drift apart unless you play with them, boost happiness in proportion
 * to the bond you've built — and eventually die, with grief scaled by that
 * same bond. Emotional attachment, not a flat stat buff.
 */
import type { GameState, Pet, PetKind } from './types';
import { clamp100 } from './types';
import type { RNG } from './rng';

export interface PetSpec {
  kind: PetKind;
  label: string;
  icon: string;
  cost: number;
  upkeepPerYear: number;
  lifespan: number; // typical years; actual death has variance around this
}

export const PET_CATALOG: PetSpec[] = [
  { kind: 'dog', label: 'Dog', icon: '🐶', cost: 800, upkeepPerYear: 1_200, lifespan: 13 },
  { kind: 'cat', label: 'Cat', icon: '🐱', cost: 500, upkeepPerYear: 900, lifespan: 16 },
  { kind: 'parrot', label: 'Parrot', icon: '🦜', cost: 1_500, upkeepPerYear: 600, lifespan: 40 },
  { kind: 'horse', label: 'Horse', icon: '🐴', cost: 15_000, upkeepPerYear: 6_000, lifespan: 28 },
  { kind: 'snake', label: 'Snake', icon: '🐍', cost: 600, upkeepPerYear: 400, lifespan: 18 },
  { kind: 'goldfish', label: 'Goldfish', icon: '🐠', cost: 20, upkeepPerYear: 60, lifespan: 5 },
];

export const PET_SPEC_BY_KIND: Record<string, PetSpec> = Object.fromEntries(PET_CATALOG.map((p) => [p.kind, p]));

const PET_NAMES = [
  'Biscuit', 'Mochi', 'Ziggy', 'Luna', 'Pepper', 'Waffles', 'Nova', 'Peanut', 'Shadow', 'Clementine',
  'Gizmo', 'Maple', 'Rocket', 'Olive', 'Bandit', 'Sunny', 'Pickles', 'Juno', 'Chester', 'Willow',
];

let petCounter = 0;

export function createPet(kind: PetKind, rng: RNG, existingCount: number): Pet {
  petCounter = Math.max(petCounter, existingCount) + 1;
  return {
    id: `pet_${petCounter}_${Math.floor(rng.range(0, 1e6))}`,
    kind,
    name: rng.pick(PET_NAMES),
    ageYears: 0,
    health: 100,
    bond: 30,
  };
}

/** Yearly pet pass: upkeep, aging, bond drift, illness, death, and the payoff —
 * companionship happiness scaled by bond. Returns log lines. */
export function tickPets(state: GameState, rng: RNG): string[] {
  const p = state.player;
  if (!p.pets?.length) return [];
  const logs: string[] = [];
  const survivors: Pet[] = [];
  for (const pet of p.pets) {
    const spec = PET_SPEC_BY_KIND[pet.kind];
    pet.ageYears++;
    p.money -= spec.upkeepPerYear;
    // Bond fades without attention (playWithPet rebuilds it), but old friends fade slower.
    pet.bond = clamp100(pet.bond - (pet.bond >= 80 ? 1 : 3));

    // Health: fine through the prime years, decays toward the end, with random illness.
    if (pet.ageYears > spec.lifespan * 0.6) pet.health = clamp100(pet.health - rng.range(4, 10));
    if (rng.chance(0.06)) {
      const vetBill = Math.round(spec.upkeepPerYear * rng.range(0.5, 2));
      p.money -= vetBill;
      pet.health = clamp100(pet.health - rng.range(5, 15));
      logs.push(`${spec.icon} ${pet.name} got sick — the vet bill came to $${vetBill.toLocaleString()}.`);
    }

    // A loyal companion occasionally comes through for you.
    if (pet.bond >= 70 && rng.chance(0.04)) {
      if (pet.kind === 'dog') {
        p.karma = clamp100(p.karma + 2);
        logs.push(`🐶 ${pet.name} alerted the neighbors to a break-in next door. Local hero.`);
      } else {
        const find = Math.round(rng.range(100, 2_000));
        p.money += find;
        logs.push(`${spec.icon} ${pet.name} dug up something valuable — worth $${find.toLocaleString()}.`);
      }
    }

    const dies = pet.health <= 0 || pet.ageYears > spec.lifespan * rng.range(0.85, 1.25);
    if (dies) {
      const grief = Math.round(4 + (pet.bond / 100) * 14);
      p.happiness = clamp100(p.happiness - grief);
      logs.push(`🌈 ${pet.name} the ${spec.label.toLowerCase()} passed away at ${pet.ageYears}. ${pet.bond >= 70 ? 'You were inseparable.' : 'A quiet goodbye.'}`);
      continue;
    }

    // Companionship: the real reason to keep them — happiness in proportion to bond.
    p.happiness = clamp100(p.happiness + 1 + (pet.bond / 100) * 3);
    survivors.push(pet);
  }
  p.pets = survivors;
  return logs;
}
