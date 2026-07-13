/**
 * Static catalog for the Space Program (astronaut) career. Dynamic per-life state lives on
 * Player.astronaut — mirrors the static-data-vs-dynamic-state split used by data/military.ts /
 * sim/military.ts.
 */
export interface MissionDef {
  kind: 'orbital' | 'station' | 'moon' | 'mars';
  name: string;
  icon: string;
  minRank: number; // 0..4, AstronautCareer.rank required to fly this
  durationYears: number;
  baseDanger: number; // 0..1, fatality risk before training/skill mitigation
  payout: number;
  minTrainingScore: number; // 0..100
}

export const MISSIONS: MissionDef[] = [
  { kind: 'orbital', name: 'Orbital Test Flight', icon: '🛰️', minRank: 0, durationYears: 1, baseDanger: 0.02, payout: 40_000, minTrainingScore: 20 },
  { kind: 'station', name: 'Space Station Rotation', icon: '🛸', minRank: 1, durationYears: 1, baseDanger: 0.035, payout: 90_000, minTrainingScore: 40 },
  { kind: 'moon', name: 'Lunar Landing Mission', icon: '🌕', minRank: 2, durationYears: 2, baseDanger: 0.07, payout: 250_000, minTrainingScore: 65 },
  { kind: 'mars', name: 'Mars Expedition', icon: '🔴', minRank: 3, durationYears: 3, baseDanger: 0.15, payout: 800_000, minTrainingScore: 85 },
];

export const SPACE_AGENCIES = ['National Space Agency', 'Continental Space Authority', 'Private: Orbital Dynamics', 'Private: Starforge Aerospace'];

/** Rank titles by AstronautCareer.rank. */
export const ASTRONAUT_RANK_TITLES = ['Astronaut Candidate', 'Mission Pilot', 'Mission Commander', 'Veteran Astronaut', 'Chief Astronaut'];

export const ASTRONAUT_CANDIDATE_SALARY = 95_000;
export const ASTRONAUT_ACTIVE_SALARY_BASE = 130_000;
