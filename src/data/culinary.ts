/**
 * Static catalog for the Culinary Empire career (line cook → sous chef → head chef → restaurant
 * owner). Dynamic per-life state lives on Player.culinaryCareer — structurally parallel to
 * data/medical.ts / data/legal.ts, but skips a "school" stage (you start cooking on day one)
 * and branches into restaurant ownership + Michelin stars instead of a rank/judge ladder.
 */
export interface CuisineDef {
  id: string;
  name: string;
  icon: string;
  difficulty: number; // 0..100, gates service-quality odds and health-violation base risk
  baseSalary: number; // as an employed cook, before rank/tier multipliers
  violationBaseRisk: number; // 0..1, yearly chance of a health-code violation absent skill mitigation
}

export const CUISINES: CuisineDef[] = [
  { id: 'diner', name: 'Diner Classics', icon: '🍳', difficulty: 15, baseSalary: 32_000, violationBaseRisk: 0.03 },
  { id: 'mexican', name: 'Mexican', icon: '🌮', difficulty: 25, baseSalary: 36_000, violationBaseRisk: 0.03 },
  { id: 'italian', name: 'Italian', icon: '🍝', difficulty: 30, baseSalary: 40_000, violationBaseRisk: 0.025 },
  { id: 'bbq', name: 'Barbecue', icon: '🍖', difficulty: 35, baseSalary: 38_000, violationBaseRisk: 0.03 },
  { id: 'indian', name: 'Indian', icon: '🍛', difficulty: 40, baseSalary: 42_000, violationBaseRisk: 0.025 },
  { id: 'french', name: 'French', icon: '🥐', difficulty: 55, baseSalary: 48_000, violationBaseRisk: 0.02 },
  { id: 'japanese', name: 'Japanese', icon: '🍣', difficulty: 60, baseSalary: 50_000, violationBaseRisk: 0.02 },
  { id: 'patisserie', name: 'Pâtisserie', icon: '🍰', difficulty: 65, baseSalary: 45_000, violationBaseRisk: 0.015 },
  { id: 'fusion', name: 'Modern Fusion', icon: '🍱', difficulty: 75, baseSalary: 55_000, violationBaseRisk: 0.02 },
  { id: 'molecular', name: 'Molecular Gastronomy', icon: '🧪', difficulty: 90, baseSalary: 65_000, violationBaseRisk: 0.015 },
];

export const CUISINE_BY_ID: Record<string, CuisineDef> = Object.fromEntries(CUISINES.map((c) => [c.id, c]));

export const RESTAURANT_NAMES = ['The Gilded Fork', 'Ember & Salt', 'Casa Luna', 'The Copper Pot', 'Marrow', 'Nightjar Kitchen'];

/** Employed-cook rank titles, index = CulinaryCareer.rank while stage is line_cook/sous_chef/head_chef. */
export const KITCHEN_RANK_TITLES = ['Line Cook', 'Sous Chef', 'Head Chef'];
export const SOUS_CHEF_MIN_YEARS = 3;
export const HEAD_CHEF_MIN_YEARS = 3;

/** Restaurant growth-tier titles, index = CulinaryCareer.rank while stage === 'restaurant_owner'. */
export const RESTAURANT_TIER_TITLES = ['Hole-in-the-Wall', 'Local Favorite', 'Destination Dining', 'Landmark Restaurant'];

export const OPEN_RESTAURANT_BASE_COST = 150_000;

/** Reputation + skill thresholds required to be considered for each successive Michelin star. */
export const MICHELIN_STAR_REQUIREMENTS = [
  { reputation: 70, skill: 65, minTier: 0 },
  { reputation: 85, skill: 80, minTier: 1 },
  { reputation: 95, skill: 92, minTier: 2 },
];
