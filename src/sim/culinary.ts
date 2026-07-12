/**
 * Culinary Empire: line cook → sous chef → head chef, then an optional leap to opening your own
 * restaurant and chasing Michelin stars. Self-contained leaf module (like medical.ts/legal.ts),
 * not routed through actions.ts. Static catalog in data/culinary.ts. Unlike the medical/legal
 * tracks, there's no "school" stage — you start cooking on day one — and the late-career branch
 * is restaurant ownership (passive tiered income + stars) rather than a rank/judge ladder.
 */
import type { CulinaryCareer, GameState } from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import { SK } from '../data/skills';
import {
  CUISINE_BY_ID, CUISINES, HEAD_CHEF_MIN_YEARS, KITCHEN_RANK_TITLES, MICHELIN_STAR_REQUIREMENTS,
  OPEN_RESTAURANT_BASE_COST, RESTAURANT_NAMES, RESTAURANT_TIER_TITLES, SOUS_CHEF_MIN_YEARS,
} from '../data/culinary';

export interface CulinaryActionResult {
  ok: boolean;
  message: string;
}

function withRng(state: GameState): RNG {
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  return rng;
}
function commit(state: GameState, rng: RNG): void {
  state.rngState = rng.state;
}
function onCooldown(state: GameState, key: string): boolean {
  return state.player.actionCooldowns[key] === state.year;
}
function setCooldown(state: GameState, key: string): void {
  state.player.actionCooldowns[key] = state.year;
}
function requireAge(state: GameState, minAge: number, activity: string): CulinaryActionResult | null {
  if (state.player.age >= minAge) return null;
  return { ok: false, message: `You're too young for that — ${activity} opens up at age ${minAge}.` };
}
function awardAchievement(state: GameState, key: string): void {
  if (!state.achievements.includes(key)) state.achievements.push(key);
}
function isActive(c: CulinaryCareer | null): c is CulinaryCareer {
  return !!c && c.active;
}

/** No school gate here — cooking is learned on the job, so this starts the career immediately. */
export function startCookingCareer(state: GameState, cuisineId: string): CulinaryActionResult {
  const ageGate = requireAge(state, 16, 'kitchen work');
  if (ageGate) return ageGate;
  const p = state.player;
  if (isActive(p.culinaryCareer)) return { ok: false, message: 'You are already working a kitchen.' };
  if (p.inJailYears > 0) return { ok: false, message: 'Not while incarcerated.' };
  const cuisine = CUISINE_BY_ID[cuisineId];
  if (!cuisine) return { ok: false, message: 'Unknown cuisine.' };
  const rng = withRng(state);
  p.culinaryCareer = {
    active: true, stage: 'line_cook', cuisineId, workplaceName: rng.pick(RESTAURANT_NAMES), yearsOfService: 0,
    skill: 8, reputation: 15, dishesServed: 0, healthCodeViolations: 0, michelinStars: 0, rank: 0, restaurantClosed: false,
  };
  commit(state, rng);
  log(state, `You picked up a line cook job at ${p.culinaryCareer.workplaceName}, learning ${cuisine.name.toLowerCase()}.`, 'info');
  return { ok: true, message: `Started as a line cook at ${p.culinaryCareer.workplaceName}.` };
}

/** Cook a service this year — the core skill-building, reputation-risking loop while employed.
 * `bonusChance` (0..0.3) is the real payoff from a sharp Kitchen Service minigame round — see
 * runKitchenService below — layered on top of the normal skill-driven odds, not a separate roll. */
export function cookService(state: GameState, bonusChance = 0): CulinaryActionResult {
  const c = state.player.culinaryCareer;
  if (!isActive(c) || (c.stage !== 'line_cook' && c.stage !== 'sous_chef' && c.stage !== 'head_chef')) {
    return { ok: false, message: 'You need to be working a kitchen.' };
  }
  if (onCooldown(state, 'culinary_cook_service')) return { ok: false, message: 'Already worked a full service this year.' };
  setCooldown(state, 'culinary_cook_service');
  const p = state.player;
  const cuisine = c.cuisineId ? CUISINE_BY_ID[c.cuisineId] : CUISINES[0];
  const rng = withRng(state);
  const successChance = clamp(0.55 + c.skill * 0.005 - cuisine.difficulty * 0.003 + (p.skills[SK.cooking] ?? 0) * 0.002 + bonusChance, 0.2, 0.99);
  if (rng.chance(successChance)) {
    c.dishesServed++;
    c.skill = clamp100(c.skill + rng.range(1, 3));
    c.reputation = clamp100(c.reputation + rng.range(1, 3));
    p.skills[SK.cooking] = clamp100((p.skills[SK.cooking] ?? 0) + rng.range(1, 3));
    p.happiness = clamp100(p.happiness + 2);
    if (c.dishesServed >= 500) awardAchievement(state, 'culinary_veteran');
    if (c.dishesServed >= 2500) awardAchievement(state, 'kitchen_legend');
    commit(state, rng);
    log(state, `A brutal ${cuisine.name.toLowerCase()} service, and you nailed it.`, 'good');
    return { ok: true, message: 'Service went well.' };
  }
  c.reputation = clamp100(c.reputation - rng.range(3, 8));
  p.happiness = clamp100(p.happiness - 4);
  const violationChance = clamp(cuisine.violationBaseRisk * (1 - c.skill / 150), 0.005, 0.4);
  if (rng.chance(violationChance)) {
    c.healthCodeViolations++;
    const fine = Math.round(2_000 + cuisine.difficulty * 200 * rng.range(0.5, 1.5));
    p.money = Math.max(0, p.money - fine);
    c.reputation = clamp100(c.reputation - 10);
    commit(state, rng);
    log(state, `⚠️ A health inspector wasn't impressed — fined $${fine.toLocaleString()}.`, 'bad');
    return { ok: false, message: `Health code violation — fined $${fine.toLocaleString()}.` };
  }
  commit(state, rng);
  log(state, `A rough service. The pass sent more than a few dishes back.`, 'bad');
  return { ok: false, message: 'Rough service.' };
}

/** V57: resolve a Kitchen Service minigame round (see ui/three/KitchenServiceScene.tsx) — a
 * 0..1 accuracy score converts into up to +30% success chance for this year's cookService,
 * so playing it well is a genuine shortcut, not just a score for its own sake. */
export function runKitchenService(state: GameState, score: number): CulinaryActionResult {
  const bonus = clamp(score, 0, 1) * 0.3;
  const result = cookService(state, bonus);
  if (score >= 0.95) awardAchievement(state, 'perfect_service');
  return result;
}

export function seekKitchenPromotion(state: GameState): CulinaryActionResult {
  const c = state.player.culinaryCareer;
  if (!isActive(c)) return { ok: false, message: 'You need to be working a kitchen.' };
  if (c.stage === 'line_cook' && c.yearsOfService < SOUS_CHEF_MIN_YEARS) {
    return { ok: false, message: `You need ${SOUS_CHEF_MIN_YEARS - c.yearsOfService} more year(s) on the line.` };
  }
  if (c.stage === 'sous_chef' && c.yearsOfService < HEAD_CHEF_MIN_YEARS) {
    return { ok: false, message: `You need ${HEAD_CHEF_MIN_YEARS - c.yearsOfService} more year(s) as sous chef.` };
  }
  if (c.stage !== 'line_cook' && c.stage !== 'sous_chef') return { ok: false, message: 'You are already a head chef.' };
  if (onCooldown(state, 'culinary_promotion')) return { ok: false, message: 'Already sought promotion this year.' };
  setCooldown(state, 'culinary_promotion');
  const rng = withRng(state);
  const chance = clamp(0.3 + c.reputation * 0.006 + c.skill * 0.003, 0.1, 0.9);
  if (rng.chance(chance)) {
    c.stage = c.stage === 'line_cook' ? 'sous_chef' : 'head_chef';
    c.yearsOfService = 0;
    c.rank = KITCHEN_RANK_TITLES.indexOf(c.stage === 'sous_chef' ? 'Sous Chef' : 'Head Chef');
    commit(state, rng);
    if (c.stage === 'head_chef') awardAchievement(state, 'head_chef');
    log(state, `Promoted to ${c.stage === 'sous_chef' ? 'Sous Chef' : 'Head Chef'}.`, 'good');
    return { ok: true, message: `Promoted to ${c.stage === 'sous_chef' ? 'Sous Chef' : 'Head Chef'}.` };
  }
  commit(state, rng);
  log(state, `Passed over for promotion this cycle.`, 'bad');
  return { ok: false, message: 'Passed over.' };
}

/** Head chefs only: leave employment behind to open your own place, funded out of pocket. */
export function openRestaurant(state: GameState): CulinaryActionResult {
  const c = state.player.culinaryCareer;
  if (!isActive(c) || c.stage !== 'head_chef') return { ok: false, message: 'You need to be a head chef first.' };
  const cuisine = c.cuisineId ? CUISINE_BY_ID[c.cuisineId] : CUISINES[0];
  const cost = Math.round(OPEN_RESTAURANT_BASE_COST * (0.6 + cuisine.difficulty * 0.01));
  const p = state.player;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()} in savings.` };
  const rng = withRng(state);
  p.money -= cost;
  c.stage = 'restaurant_owner';
  c.workplaceName = rng.pick(RESTAURANT_NAMES);
  c.yearsOfService = 0;
  c.rank = 0;
  commit(state, rng);
  awardAchievement(state, 'restaurant_owner');
  log(state, `You opened ${c.workplaceName}, your own restaurant, for $${cost.toLocaleString()}.`, 'milestone');
  return { ok: true, message: `Opened ${c.workplaceName}.` };
}

/** Invest to grow the restaurant to the next tier — the ownership-track equivalent of a promotion. */
export function growRestaurant(state: GameState): CulinaryActionResult {
  const c = state.player.culinaryCareer;
  if (!isActive(c) || c.stage !== 'restaurant_owner') return { ok: false, message: 'You need to own a restaurant.' };
  if (c.restaurantClosed) return { ok: false, message: 'Your restaurant is closed.' };
  if (c.rank >= RESTAURANT_TIER_TITLES.length - 1) return { ok: false, message: 'Your restaurant has reached its peak.' };
  const cost = Math.round(OPEN_RESTAURANT_BASE_COST * 0.8 * (c.rank + 1));
  const p = state.player;
  if (p.money < cost) return { ok: false, message: `Needs $${cost.toLocaleString()} to expand.` };
  if (onCooldown(state, 'culinary_grow')) return { ok: false, message: 'Already invested in growth this year.' };
  setCooldown(state, 'culinary_grow');
  const rng = withRng(state);
  const chance = clamp(0.35 + c.reputation * 0.005, 0.15, 0.85);
  p.money -= cost;
  if (rng.chance(chance)) {
    c.rank++;
    commit(state, rng);
    if (c.rank === 3) awardAchievement(state, 'landmark_restaurant');
    log(state, `${c.workplaceName} is now a ${RESTAURANT_TIER_TITLES[c.rank]}.`, 'good');
    return { ok: true, message: `Now a ${RESTAURANT_TIER_TITLES[c.rank]}.` };
  }
  commit(state, rng);
  log(state, `The expansion didn't land the way you hoped — the investment is sunk regardless.`, 'bad');
  return { ok: false, message: 'Expansion fell short.' };
}

/** Chase the next Michelin star — restaurant-owner only, gated by real reputation/skill/tier. */
export function pursueMichelinStar(state: GameState): CulinaryActionResult {
  const c = state.player.culinaryCareer;
  if (!isActive(c) || c.stage !== 'restaurant_owner') return { ok: false, message: 'You need to own a restaurant.' };
  if (c.restaurantClosed) return { ok: false, message: 'Your restaurant is closed.' };
  if (c.michelinStars >= 3) return { ok: false, message: 'You already hold the maximum three stars.' };
  const req = MICHELIN_STAR_REQUIREMENTS[c.michelinStars];
  if (c.reputation < req.reputation || c.skill < req.skill || c.rank < req.minTier) {
    return { ok: false, message: `Not ready yet — needs ${req.reputation} reputation, ${req.skill} skill, and ${RESTAURANT_TIER_TITLES[req.minTier]} status.` };
  }
  if (onCooldown(state, 'culinary_michelin')) return { ok: false, message: 'The inspectors already visited this year.' };
  setCooldown(state, 'culinary_michelin');
  const rng = withRng(state);
  const chance = clamp(0.15 + (c.reputation - req.reputation) * 0.01 + (c.skill - req.skill) * 0.01, 0.05, 0.6);
  if (rng.chance(chance)) {
    c.michelinStars++;
    commit(state, rng);
    awardAchievement(state, c.michelinStars === 1 ? 'first_michelin_star' : c.michelinStars === 3 ? 'three_michelin_stars' : 'second_michelin_star');
    log(state, `⭐ ${c.workplaceName} was awarded its ${c.michelinStars === 1 ? 'first' : c.michelinStars === 2 ? 'second' : 'third'} Michelin star!`, 'milestone');
    return { ok: true, message: `Earned Michelin star #${c.michelinStars}.` };
  }
  commit(state, rng);
  log(state, `The inspectors came and went without a star this time.`, 'bad');
  return { ok: false, message: 'No star this cycle.' };
}

export function retireFromCooking(state: GameState): CulinaryActionResult {
  const c = state.player.culinaryCareer;
  if (!isActive(c)) return { ok: false, message: 'You are not working in food.' };
  c.active = false;
  c.stage = 'retired';
  state.player.happiness = clamp100(state.player.happiness + 5);
  if (c.dishesServed >= 2500) awardAchievement(state, 'kitchen_legend');
  log(state, `You retired from the kitchen after serving ${c.dishesServed.toLocaleString()} dishes.`, 'good');
  return { ok: true, message: 'Retired from cooking.' };
}

// ---------------------------------------------------------------------------
// Yearly tick — employed salary, restaurant passive income + violation risk
// ---------------------------------------------------------------------------

export function tickCulinaryCareer(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const c = state.player.culinaryCareer;
  if (!isActive(c)) return headlines;
  const p = state.player;
  if (p.inJailYears > 0) return headlines;

  const cuisine = c.cuisineId ? CUISINE_BY_ID[c.cuisineId] : CUISINES[0];
  if (c.stage === 'line_cook' || c.stage === 'sous_chef' || c.stage === 'head_chef') {
    const rankMult = 1 + c.rank * 0.5;
    p.money += Math.round(cuisine.baseSalary * rankMult * (0.7 + c.skill * 0.006));
    c.yearsOfService++;
  } else if (c.stage === 'restaurant_owner' && !c.restaurantClosed) {
    const tierMult = 1 + c.rank * 0.8 + c.michelinStars * 0.6;
    const profit = Math.round(cuisine.baseSalary * 1.5 * tierMult * (0.6 + c.skill * 0.006) * rng.range(0.7, 1.3));
    p.money += profit;
    c.yearsOfService++;
    c.reputation = clamp(c.reputation - 1, 0, 100);
    // Ambient health-inspection risk while running the place, distinct from the interactive
    // cookService risk above — an owner's exposure is ongoing, not tied to one service.
    if (rng.chance(cuisine.violationBaseRisk * 0.5 * (1 - c.skill / 200))) {
      c.healthCodeViolations++;
      c.reputation = clamp(c.reputation - 8, 0, 100);
      if (c.healthCodeViolations >= 4) {
        c.restaurantClosed = true;
        headlines.push(`${p.name}'s restaurant ${c.workplaceName} was shut down after repeated health code violations`);
      } else {
        headlines.push(`${p.name}'s restaurant ${c.workplaceName} failed a health inspection`);
      }
    }
  }
  return headlines;
}
