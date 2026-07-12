/**
 * Static catalog for the Entertainment career (actor/musician fame path). Dynamic per-life state
 * lives on Player.entertainmentCareer — mirrors the static-data-vs-dynamic-state split used by
 * data/military.ts / sim/military.ts.
 */

export interface AwardDef {
  id: string;
  name: string;
  icon: string;
  track: 'actor' | 'musician' | 'both';
  prestige: number; // 0..100, fame gain on winning
}

export const AWARDS: AwardDef[] = [
  { id: 'best_picture', name: 'Best Picture', icon: '🏆', track: 'actor', prestige: 95 },
  { id: 'best_actor', name: 'Best Lead Performance', icon: '🎭', track: 'actor', prestige: 90 },
  { id: 'breakout_star', name: 'Breakout Star', icon: '⭐', track: 'actor', prestige: 55 },
  { id: 'critics_choice', name: "Critics' Choice", icon: '📰', track: 'actor', prestige: 60 },
  { id: 'album_of_year', name: 'Album of the Year', icon: '💿', track: 'musician', prestige: 92 },
  { id: 'song_of_year', name: 'Song of the Year', icon: '🎵', track: 'musician', prestige: 80 },
  { id: 'best_new_artist', name: 'Best New Artist', icon: '🌟', track: 'musician', prestige: 50 },
  { id: 'tour_of_year', name: 'Tour of the Year', icon: '🎤', track: 'musician', prestige: 65 },
  { id: 'lifetime_achievement', name: 'Lifetime Achievement', icon: '👑', track: 'both', prestige: 100 },
  { id: 'peoples_choice', name: "People's Choice", icon: '💖', track: 'both', prestige: 45 },
];

export const AWARD_BY_ID: Record<string, AwardDef> = Object.fromEntries(AWARDS.map((a) => [a.id, a]));

export const FILM_TITLE_WORDS = {
  adjectives: ['Midnight', 'Silent', 'Broken', 'Golden', 'Last', 'Endless', 'Hidden', 'Wild', 'Fading', 'Crimson', 'Distant', 'Reckless'],
  nouns: ['Horizon', 'Echoes', 'Kingdom', 'Shadows', 'Legacy', 'Storm', 'Rebellion', 'Memory', 'Ascension', 'Reckoning', 'Vow', 'Descent'],
};

export const ALBUM_TITLE_WORDS = {
  adjectives: ['Neon', 'Velvet', 'Restless', 'Electric', 'Lonely', 'Wildfire', 'Paper', 'Static', 'Amber', 'Runaway'],
  nouns: ['Nights', 'Static', 'Bloom', 'Gravity', 'Tides', 'Faultlines', 'Mirrors', 'Afterglow', 'Season', 'Currents'],
};

export const STUDIO_NAMES = ['Beacon Pictures', 'Northlight Films', 'Vantage Studios', 'Meridian Motion', 'Silverline Entertainment'];
export const LABEL_NAMES = ['Halcyon Records', 'Static Sound', 'Bluewave Music', 'Foundry Records', 'Echo Chamber Label'];

export const AGENT_SIGN_COST = 15_000;
export const AGENT_CUT = 0.15;

export const PROJECT_BUDGET_TIERS = [
  { tier: 1, label: 'Indie', budget: 200_000, minFame: 0 },
  { tier: 2, label: 'Studio', budget: 2_000_000, minFame: 25 },
  { tier: 3, label: 'Blockbuster', budget: 20_000_000, minFame: 55 },
  { tier: 4, label: 'Franchise Tentpole', budget: 120_000_000, minFame: 80 },
];
