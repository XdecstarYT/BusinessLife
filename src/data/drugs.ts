/**
 * Static catalog for the Drug Empire system: what you can deal, and what it costs to scale up an
 * operation. Dynamic per-life state (stash, facility levels, turf, heat) lives on
 * Player.drugOperation — mirrors the static-data-vs-dynamic-state split used by military.ts/
 * data/military.ts and casino.ts.
 */

export interface DrugDef {
  id: string;
  name: string;
  icon: string;
  tier: 1 | 2 | 3 | 4;
  wholesaleCost: number; // $ per unit to buy product
  streetPrice: number; // baseline $ per unit sold
  heatPerUnit: number; // operation heat generated per unit sold
  addictiveness: number; // 0..100 — drives repeat demand and overdose risk
  odRiskPerUnit: number; // base chance-per-unit contribution to an overdose incident on a sale
  producible: 'grow' | 'lab' | null; // which facility track can manufacture this in-house
  minReputation: number; // street cred required to source/move this tier at all
  description: string;
}

export const DRUGS: DrugDef[] = [
  { id: 'weed', name: 'Weed', icon: '🌿', tier: 1, wholesaleCost: 8, streetPrice: 22, heatPerUnit: 0.12, addictiveness: 12, odRiskPerUnit: 0.00005, producible: 'grow', minReputation: 0, description: 'Low risk, low reward — the standard entry point.' },
  { id: 'pills', name: 'Pills', icon: '💊', tier: 1, wholesaleCost: 12, streetPrice: 34, heatPerUnit: 0.2, addictiveness: 30, odRiskPerUnit: 0.0004, producible: null, minReputation: 0, description: 'Prescription knockoffs — steady campus/club demand.' },
  { id: 'lsd', name: 'LSD', icon: '🔮', tier: 2, wholesaleCost: 18, streetPrice: 58, heatPerUnit: 0.28, addictiveness: 18, odRiskPerUnit: 0.0003, producible: null, minReputation: 15, description: 'Niche but loyal customers, decent margins.' },
  { id: 'mdma', name: 'MDMA', icon: '💎', tier: 2, wholesaleCost: 20, streetPrice: 66, heatPerUnit: 0.32, addictiveness: 35, odRiskPerUnit: 0.0007, producible: null, minReputation: 15, description: 'Festival and club circuit staple.' },
  { id: 'coke', name: 'Cocaine', icon: '❄️', tier: 3, wholesaleCost: 48, streetPrice: 145, heatPerUnit: 0.55, addictiveness: 58, odRiskPerUnit: 0.0011, producible: null, minReputation: 35, description: 'Real money, real attention — this is where the DEA starts caring.' },
  { id: 'meth', name: 'Meth', icon: '🧪', tier: 3, wholesaleCost: 32, streetPrice: 155, heatPerUnit: 0.7, addictiveness: 78, odRiskPerUnit: 0.0018, producible: 'lab', minReputation: 35, description: 'Cheap to cook, brutal on your customers and your heat.' },
  { id: 'heroin', name: 'Heroin', icon: '🩸', tier: 4, wholesaleCost: 60, streetPrice: 265, heatPerUnit: 0.9, addictiveness: 90, odRiskPerUnit: 0.0026, producible: null, minReputation: 55, description: 'Serious weight for a serious operation. Overdoses are common.' },
  { id: 'fentanyl', name: 'Fentanyl', icon: '☠️', tier: 4, wholesaleCost: 90, streetPrice: 430, heatPerUnit: 1.2, addictiveness: 96, odRiskPerUnit: 0.0045, producible: null, minReputation: 65, description: 'The highest margin in the game, and the deadliest.' },
];

export const DRUG_BY_ID: Record<string, DrugDef> = Object.fromEntries(DRUGS.map((d) => [d.id, d]));

// Three independently upgradeable tracks, levels 0..5. Storage only adds capacity; grow/lab also
// produce free product every year on top of whatever's bought wholesale.
export const BASE_CAPACITY = 60;
export const STORAGE_CAPACITY_STEP = 90;
export const GROW_YIELD_PER_LEVEL = 28; // weed units/yr
export const LAB_YIELD_PER_LEVEL = 18; // meth units/yr

export function facilityUpgradeCost(track: 'storage' | 'grow' | 'lab', nextLevel: number): number {
  const base = track === 'storage' ? 9_000 : track === 'grow' ? 22_000 : 55_000;
  return Math.round(base * Math.pow(2.1, nextLevel - 1));
}

export function drugCapacity(op: { storageLevel: number }): number {
  return BASE_CAPACITY + op.storageLevel * STORAGE_CAPACITY_STEP;
}

export function stashTotal(stash: Record<string, number>): number {
  return Object.values(stash).reduce((a, b) => a + b, 0);
}

export const MAX_DEALERS_PER_TURF = 0.2; // dealersHired cap scales with turf: floor(turf * this)
export const DEALER_HIRE_COST = 6_000;
export const DEALER_BASELINE_UNITS = 4; // units a hired dealer moves per year on their own
