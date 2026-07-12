/**
 * Static catalog for the Aviation career (student pilot → first officer → airline captain).
 * Dynamic per-life state lives on Player.aviation — mirrors the static-data-vs-dynamic-state
 * split used by data/legal.ts / sim/legal.ts, which this module is structurally parallel to.
 */
export interface PilotLicenseDef {
  id: string;
  name: string;
  short: string;
  hoursRequired: number; // logged flight hours needed before you can test for it
  cost: number;
  description: string;
}

/** Ordered cheapest→hardest; index also serves as the "rank" of the highest license held. */
export const PILOT_LICENSES: PilotLicenseDef[] = [
  { id: 'ppl', name: 'Private Pilot License', short: 'PPL', hoursRequired: 40, cost: 15_000, description: 'Fly light aircraft for personal use.' },
  { id: 'cpl', name: 'Commercial Pilot License', short: 'CPL', hoursRequired: 250, cost: 55_000, description: 'Get paid to fly — the gateway to a first-officer seat.' },
  { id: 'atpl', name: 'Airline Transport Pilot License', short: 'ATPL', hoursRequired: 1500, cost: 90_000, description: 'The highest license — required to captain an airliner.' },
];
export const PILOT_LICENSE_BY_ID: Record<string, PilotLicenseDef> = Object.fromEntries(PILOT_LICENSES.map((l) => [l.id, l]));
export function licenseRank(id: string | null): number {
  if (!id) return -1;
  return PILOT_LICENSES.findIndex((l) => l.id === id);
}

export interface AircraftDef {
  id: string;
  name: string;
  icon: string;
  typeRatingCost: number;
  minLicense: string; // license id required to fly it
  seats: number; // passengers — scales pay and difficulty
  basePay: number; // per-year captain pay at rank 0 on this type
  difficulty: number; // 0..100, harder types = more demanding flights but better pay
}

export const AIRCRAFT: AircraftDef[] = [
  { id: 'cessna172', name: 'Cessna 172', icon: '🛩️', typeRatingCost: 0, minLicense: 'ppl', seats: 3, basePay: 45_000, difficulty: 15 },
  { id: 'kingair', name: 'King Air Turboprop', icon: '✈️', typeRatingCost: 20_000, minLicense: 'cpl', seats: 9, basePay: 85_000, difficulty: 30 },
  { id: 'regionaljet', name: 'Embraer Regional Jet', icon: '🛫', typeRatingCost: 40_000, minLicense: 'cpl', seats: 76, basePay: 130_000, difficulty: 45 },
  { id: 'narrowbody', name: 'A320 Narrowbody', icon: '🛬', typeRatingCost: 65_000, minLicense: 'atpl', seats: 180, basePay: 200_000, difficulty: 60 },
  { id: 'widebody', name: 'Boeing 777 Widebody', icon: '🌐', typeRatingCost: 95_000, minLicense: 'atpl', seats: 350, basePay: 310_000, difficulty: 75 },
  { id: 'superjumbo', name: 'A380 Superjumbo', icon: '🦅', typeRatingCost: 140_000, minLicense: 'atpl', seats: 550, basePay: 420_000, difficulty: 90 },
];
export const AIRCRAFT_BY_ID: Record<string, AircraftDef> = Object.fromEntries(AIRCRAFT.map((a) => [a.id, a]));

export const AIRLINE_NAMES = [
  'Meridian Air', 'Vertex Airways', 'Cirrus Atlantic', 'Solstice Airlines', 'Northwind Air',
  'Apex Skyways', 'Halcyon Air', 'Zephyr International',
];

/** Named routes flown during the minigame — flavor + a difficulty/hours multiplier per leg. */
export interface RouteDef {
  id: string;
  name: string;
  hours: number; // block hours logged for completing it
  payMult: number;
}
export const ROUTES: RouteDef[] = [
  { id: 'short_hop', name: 'Regional Short Hop', hours: 2, payMult: 1.0 },
  { id: 'domestic', name: 'Cross-Country Domestic', hours: 5, payMult: 1.15 },
  { id: 'transcon', name: 'Transcontinental Redeye', hours: 7, payMult: 1.3 },
  { id: 'oceanic', name: 'Transoceanic Long-Haul', hours: 12, payMult: 1.6 },
];
export const ROUTE_BY_ID: Record<string, RouteDef> = Object.fromEntries(ROUTES.map((r) => [r.id, r]));

export const FLIGHT_SCHOOL_COST_PER_YEAR = 25_000;
export const FIRST_OFFICER_SALARY = 78_000;
/** Rank titles while stage === 'captain' (0 = fresh captain). */
export const CAPTAIN_RANK_TITLES = ['Line Captain', 'Senior Captain', 'Fleet Captain', 'Chief Pilot'];
/** Incidents that suspend your license permanently. */
export const MAX_INCIDENTS = 3;
