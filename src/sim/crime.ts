/**
 * Crime Syndicate Engine: real, named organized-crime families competing with each other for
 * turf in every country — not just an abstract "rival crew" backdrop to the player's own
 * crimeRank/turfControl stats. Families skirmish over territory, form alliances, go to war, and
 * face law-enforcement crackdowns on their own yearly clock, with or without the player ever
 * joining one — the same architecture as parties in politics.ts or companies in business.ts.
 */
import type { Country, CrimeFamily, GameState, NPC } from './types';
import { clamp, clamp100 } from './types';
import type { RNG } from './rng';

const FAMILY_SUFFIXES = ['Family', 'Syndicate', 'Outfit', 'Crew', 'Organization'];

export function generateCrimeFamilies(rng: RNG, country: Country, makeNPC: (role: 'criminal') => NPC): { families: CrimeFamily[]; npcs: NPC[] } {
  const count = rng.int(2, 3);
  const families: CrimeFamily[] = [];
  const npcs: NPC[] = [];
  for (let i = 0; i < count; i++) {
    const boss = makeNPC('criminal');
    npcs.push(boss);
    const surname = boss.name.split(' ').pop() ?? 'Unknown';
    families.push({
      id: `crime_${country.id}_${i}`,
      name: `The ${surname} ${rng.pick(FAMILY_SUFFIXES)}`,
      countryId: country.id,
      bossId: boss.id,
      strength: rng.range(25, 65),
      turf: rng.range(10, 35),
      heat: rng.range(5, 25),
      alliedWith: [],
      atWarWith: [],
      disbanded: false,
    });
  }
  return { families, npcs };
}

/** Finds the CrimeFamily the player belongs to, if any — derived from `crimeFamilyId` (the boss
 * NPC id) rather than a separate player-side pointer, so the two stay trivially in sync. */
export function playerCrimeFamily(state: GameState): CrimeFamily | null {
  const p = state.player;
  if (!p.crimeFamilyId) return null;
  return state.crimeFamilies.find((f) => f.bossId === p.crimeFamilyId && f.countryId === p.countryId && !f.disbanded) ?? null;
}

/** Yearly tick: turf skirmishes between non-allied families, alliance formation among weaker
 * families against a dominant one, war declarations, heat decay, and law-enforcement crackdowns.
 * Returns headlines for the ones worth telling the world about. */
export function tickCrimeFamilies(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  for (const country of state.countries) {
    const families = state.crimeFamilies.filter((f) => f.countryId === country.id && !f.disbanded);
    if (families.length === 0) continue;

    for (const family of families) {
      // Heat cools off on its own unless the family is actively at war (staying visible).
      family.heat = clamp100(family.heat - (family.atWarWith.length > 0 ? 2 : 6));

      // Law-enforcement crackdown risk scales with heat and the country's own capability to act
      // on it; a successful crackdown bleeds strength/turf and can wipe the family out outright.
      const crackdownChance = clamp((family.heat - 40) * 0.006 * (0.4 + country.judicialIntegrity / 150), 0, 0.35);
      if (family.heat > 40 && rng.chance(crackdownChance)) {
        const severity = rng.range(0.3, 0.7);
        family.strength = clamp100(family.strength * (1 - severity));
        family.turf = clamp100(family.turf * (1 - severity));
        family.heat = clamp100(family.heat - 25);
        if (family.strength < 8 || family.turf < 5) {
          family.disbanded = true;
          headlines.push(`${family.name} dismantled in a major law-enforcement crackdown`);
          if (state.player.crimeFamilyId === family.bossId) {
            state.player.crimeFamilyId = null;
            state.player.crimeRank = 0;
            state.player.turfControl = 0;
          }
        } else {
          headlines.push(`${family.name} reeling after a law-enforcement crackdown`);
        }
        continue;
      }

      // Alliance formation: a weaker family looks to team up against the strongest rival nearby.
      if (family.alliedWith.length === 0 && rng.chance(0.06)) {
        const potential = families.filter(
          (f) => f.id !== family.id && !family.atWarWith.includes(f.id) && !f.atWarWith.includes(family.id) && f.strength <= family.strength * 1.3,
        );
        if (potential.length) {
          const partner = rng.pick(potential);
          family.alliedWith.push(partner.id);
          partner.alliedWith.push(family.id);
        }
      }

      // War declarations: a dominant, low-heat family (crackdown risk still manageable) presses
      // its advantage against a real, weaker, non-allied rival rather than an abstract backdrop.
      if (family.atWarWith.length === 0 && family.heat < 70 && rng.chance(0.05)) {
        const targets = families.filter(
          (f) => f.id !== family.id && !family.alliedWith.includes(f.id) && !f.atWarWith.includes(family.id) && f.strength < family.strength * 0.85,
        );
        if (targets.length) {
          const target = rng.pick(targets);
          family.atWarWith.push(target.id);
          target.atWarWith.push(family.id);
          headlines.push(`Turf war breaks out between ${family.name} and ${target.name}`);
        }
      }
    }

    // Resolve wars: each side's (own + allies') combined strength decides who bleeds turf this
    // year. A family reduced to nothing is wiped out and its turf reverts to contested ground.
    for (const family of families) {
      for (const enemyId of [...family.atWarWith]) {
        if (family.id > enemyId) continue; // resolve each pair exactly once
        const enemy = families.find((f) => f.id === enemyId);
        if (!enemy) continue;
        const alliesOf = (f: CrimeFamily) => f.alliedWith.map((id) => families.find((x) => x.id === id)).filter((x): x is CrimeFamily => !!x);
        const sideStrength = family.strength + alliesOf(family).reduce((s, f) => s + f.strength * 0.4, 0);
        const enemyStrength = enemy.strength + alliesOf(enemy).reduce((s, f) => s + f.strength * 0.4, 0);
        const edge = (sideStrength - enemyStrength) / Math.max(1, sideStrength + enemyStrength);
        const swing = rng.range(3, 9) * (0.5 + Math.abs(edge));
        if (rng.chance(0.5 + edge * 0.5)) {
          family.turf = clamp100(family.turf + swing);
          enemy.turf = clamp100(enemy.turf - swing);
          enemy.strength = clamp100(enemy.strength - swing * 0.3);
        } else {
          enemy.turf = clamp100(enemy.turf + swing);
          family.turf = clamp100(family.turf - swing);
          family.strength = clamp100(family.strength - swing * 0.3);
        }
        family.heat = clamp100(family.heat + 8);
        enemy.heat = clamp100(enemy.heat + 8);
        // Wars burn out once one side is clearly beaten or after enough attrition either way.
        if (enemy.turf < 4 || family.turf < 4 || rng.chance(0.3)) {
          family.atWarWith = family.atWarWith.filter((id) => id !== enemy.id);
          enemy.atWarWith = enemy.atWarWith.filter((id) => id !== family.id);
        }
        if (enemy.strength < 6 && enemy.turf < 4) {
          enemy.disbanded = true;
          headlines.push(`${enemy.name} wiped out by ${family.name} in a turf war`);
          if (state.player.crimeFamilyId === enemy.bossId) {
            state.player.crimeFamilyId = null;
            state.player.crimeRank = 0;
            state.player.turfControl = 0;
          }
        } else if (family.strength < 6 && family.turf < 4) {
          family.disbanded = true;
          headlines.push(`${family.name} wiped out by ${enemy.name} in a turf war`);
          if (state.player.crimeFamilyId === family.bossId) {
            state.player.crimeFamilyId = null;
            state.player.crimeRank = 0;
            state.player.turfControl = 0;
          }
        }
      }
    }
  }
  return headlines;
}
