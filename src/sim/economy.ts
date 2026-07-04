/**
 * Macroeconomic simulation. Each country has a business-cycle regime, a
 * policy interest rate that follows a Taylor-style rule, inflation dynamics,
 * unemployment via Okun's law, housing and equity indices, commodity prices,
 * and fiscal balances. Laws in force apply continuous modifiers.
 */
import type { Country, Economy, EconomicRegime, GameState, LawEffects } from './types';
import { clamp, clamp100 } from './types';
import { LAW_BY_ID } from '../data/laws';
import type { RNG } from './rng';
import type { CountrySeed } from '../data/countries';
import type { Scenario } from './world';

interface ScenarioPreset {
  regime: EconomicRegime;
  gdpGrowth: [number, number];
  inflation: [number, number];
  unemployment: [number, number];
  confidence: [number, number];
  govDebtToGdp: [number, number];
  stockIndex: number;
}

const SCENARIO_PRESETS: Record<Scenario, ScenarioPreset> = {
  modern: {
    regime: 'expansion',
    gdpGrowth: [0.015, 0.035],
    inflation: [0.015, 0.03],
    unemployment: [0.04, 0.08],
    confidence: [50, 70],
    govDebtToGdp: [0.3, 0.9],
    stockIndex: 100,
  },
  boom: {
    regime: 'boom',
    gdpGrowth: [0.04, 0.07],
    inflation: [0.02, 0.045],
    unemployment: [0.02, 0.045],
    confidence: [70, 90],
    govDebtToGdp: [0.2, 0.6],
    stockIndex: 115,
  },
  recession: {
    regime: 'recession',
    gdpGrowth: [-0.02, 0],
    inflation: [0.01, 0.025],
    unemployment: [0.08, 0.14],
    confidence: [25, 45],
    govDebtToGdp: [0.6, 1.2],
    stockIndex: 75,
  },
  crisis: {
    regime: 'depression',
    gdpGrowth: [-0.06, -0.02],
    inflation: [0.03, 0.08],
    unemployment: [0.12, 0.22],
    confidence: [10, 30],
    govDebtToGdp: [0.9, 1.6],
    stockIndex: 50,
  },
};

export const COMMODITIES = ['oil', 'gas', 'gold', 'grain', 'metals'] as const;

export function initEconomy(seed: CountrySeed, rng: RNG, scenario: Scenario = 'modern'): Economy {
  const gdp = (seed.population * seed.gdpPerCapita) / 1e9; // billions
  const preset = SCENARIO_PRESETS[scenario];
  return {
    gdp,
    gdpGrowth: rng.range(...preset.gdpGrowth),
    inflation: rng.range(...preset.inflation),
    interestRate: rng.range(0.02, 0.045),
    unemployment: rng.range(...preset.unemployment),
    consumerConfidence: rng.range(...preset.confidence),
    businessConfidence: rng.range(...preset.confidence),
    housingIndex: 100,
    stockIndex: preset.stockIndex,
    exchangeRate: 1,
    govDebtToGdp: rng.range(...preset.govDebtToGdp),
    budgetBalance: rng.range(-0.04, 0.01),
    taxRates: {
      income: rng.range(0.3, 0.45),
      corporate: rng.range(0.2, 0.3),
      sales: rng.range(0.08, 0.15),
      capitalGains: rng.range(0.15, 0.25),
    },
    minimumWage: seed.gdpPerCapita * rng.range(0.35, 0.5),
    regime: preset.regime,
    yearsInRegime: rng.int(1, 4),
    commodities: Object.fromEntries(COMMODITIES.map((c) => [c, 100])),
    history: [],
  };
}

/** Sum the LawEffects of every law in force for a country. */
export function aggregateLawEffects(country: Country): Required<Pick<LawEffects, never>> & LawEffects {
  const total: LawEffects = {};
  for (const lawId of country.lawsInForce) {
    const def = LAW_BY_ID[lawId];
    if (!def) continue;
    for (const [k, v] of Object.entries(def.effects)) {
      if (k === 'industryTagModifiers') {
        total.industryTagModifiers = total.industryTagModifiers ?? {};
        for (const [tag, mod] of Object.entries(v as Record<string, number>)) {
          total.industryTagModifiers[tag] = (total.industryTagModifiers[tag] ?? 0) + mod;
        }
      } else if (typeof v === 'number') {
        (total as Record<string, number>)[k] = ((total as Record<string, unknown>)[k] as number ?? 0) + v;
      }
    }
  }
  return total;
}

/** Industry revenue multiplier from laws, for a given set of industry tags. */
export function lawIndustryModifier(effects: LawEffects, tags: string[]): number {
  if (!effects.industryTagModifiers) return 1;
  let mod = 0;
  for (const tag of tags) mod += effects.industryTagModifiers[tag] ?? 0;
  return clamp(1 + mod, 0.4, 1.8);
}

const REGIME_TRANSITIONS: Record<EconomicRegime, { growth: [number, number]; next: [EconomicRegime, number][] }> = {
  boom: { growth: [0.04, 0.07], next: [['boom', 0.35], ['expansion', 0.4], ['stagnation', 0.15], ['recession', 0.1]] },
  expansion: { growth: [0.02, 0.045], next: [['boom', 0.15], ['expansion', 0.55], ['stagnation', 0.2], ['recession', 0.1]] },
  stagnation: { growth: [-0.005, 0.015], next: [['expansion', 0.35], ['stagnation', 0.4], ['recession', 0.2], ['boom', 0.05]] },
  recession: { growth: [-0.04, -0.005], next: [['recession', 0.3], ['stagnation', 0.3], ['expansion', 0.3], ['depression', 0.1]] },
  depression: { growth: [-0.09, -0.03], next: [['depression', 0.35], ['recession', 0.35], ['stagnation', 0.3]] },
};

export interface EconomyTickResult {
  regimeChanged: boolean;
  crisis: string | null; // headline-worthy shock this year
}

export function tickEconomy(state: GameState, country: Country, rng: RNG): EconomyTickResult {
  const e = country.economy;
  const law = aggregateLawEffects(country);
  let crisis: string | null = null;
  const difficultyCrisisMult = state.difficulty === 'casual' ? 0.6 : state.difficulty === 'ironman' ? 1.4 : 1;

  // --- Regime transitions -------------------------------------------------
  const spec = REGIME_TRANSITIONS[e.regime];
  const prevRegime = e.regime;
  // Longer regimes get likelier to roll over; low stability raises recession risk.
  let rolled = rng.weighted(spec.next, (t) => t[1] * (t[0] === e.regime ? Math.max(0.3, 1 - e.yearsInRegime * 0.12) : 1))[0];
  if (country.stability < 40 && rng.chance(0.15)) rolled = 'recession';
  if (rolled !== e.regime) {
    e.regime = rolled;
    e.yearsInRegime = 0;
  }
  e.yearsInRegime++;

  // --- Growth --------------------------------------------------------------
  const [gLo, gHi] = REGIME_TRANSITIONS[e.regime].growth;
  let growth = rng.range(gLo, gHi);
  growth += (law.gdpGrowth ?? 0);
  growth += (e.businessConfidence - 55) * 0.0004 + (e.consumerConfidence - 55) * 0.0003;
  growth -= Math.max(0, e.interestRate - 0.05) * 0.25; // tight money bites
  growth -= Math.max(0, e.govDebtToGdp - 1.2) * 0.01; // debt overhang
  if (country.atWarWith.length > 0) growth -= 0.02;
  e.gdpGrowth = growth;
  e.gdp *= 1 + growth;

  // --- Inflation & policy rate ----------------------------------------------
  let inflation = e.inflation * 0.6 + 0.02 * 0.4; // anchor to ~2%
  inflation += growth > 0.04 ? 0.008 : growth < 0 ? -0.006 : 0;
  inflation += (law.inflation ?? 0);
  inflation += rng.range(-0.006, 0.006);
  // Commodity shock pass-through
  const oilShock = (e.commodities.oil - 100) / 100;
  inflation += oilShock * 0.01;
  if (e.govDebtToGdp > 1.5 && rng.chance(0.1 * difficultyCrisisMult)) {
    inflation += rng.range(0.03, 0.1);
    crisis = 'debt';
  }
  e.inflation = clamp(inflation, -0.02, 0.4);

  // Taylor-style rule with smoothing
  const target = 0.02 + 1.5 * (e.inflation - 0.02) + 0.5 * -Math.min(0, growth);
  e.interestRate = clamp(e.interestRate * 0.6 + target * 0.4, 0, 0.25);

  // --- Labour market ---------------------------------------------------------
  let unemployment = e.unemployment - (growth - 0.02) * 0.4;
  unemployment += (law.unemployment ?? 0);
  e.unemployment = clamp(unemployment + rng.range(-0.004, 0.004), 0.02, 0.35);

  // --- Confidence -------------------------------------------------------------
  e.businessConfidence = clamp100(
    e.businessConfidence * 0.6 + (55 + growth * 500 - (e.interestRate - 0.03) * 200 + (law.businessConfidence ?? 0)) * 0.4 + rng.range(-4, 4),
  );
  e.consumerConfidence = clamp100(
    e.consumerConfidence * 0.6 + (55 + growth * 400 - (e.unemployment - 0.05) * 250 - Math.max(0, e.inflation - 0.03) * 300 + (law.consumerConfidence ?? 0)) * 0.4 + rng.range(-4, 4),
  );

  // --- Asset prices -----------------------------------------------------------
  const housingDrift = growth * 1.6 - (e.interestRate - 0.03) * 1.4 + rng.range(-0.05, 0.07);
  e.housingIndex = Math.max(20, e.housingIndex * (1 + housingDrift));
  if (housingDrift < -0.12) crisis = crisis ?? 'housing';

  const equityDrift = growth * 2.2 + (e.businessConfidence - 55) * 0.004 - (e.interestRate - 0.03) * 1.8 + rng.normal(0, 0.12);
  e.stockIndex = Math.max(10, e.stockIndex * (1 + equityDrift));
  if (equityDrift < -0.2) crisis = crisis ?? 'crash';

  // --- Fiscal -------------------------------------------------------------------
  let balance = e.budgetBalance * 0.5 + (growth - 0.02) * 0.3 - 0.01;
  balance += (law.budgetBalance ?? 0);
  e.budgetBalance = clamp(balance + rng.range(-0.005, 0.005), -0.2, 0.1);
  e.govDebtToGdp = clamp(e.govDebtToGdp - e.budgetBalance - growth * e.govDebtToGdp, 0, 4);

  // Law-driven structural tax changes are applied once at enactment; the
  // aggregate here nudges toward the legislated level so repeals also work.
  const adj = country.taxAdjustments;
  const targetIncome = clamp(0.38 + (law.taxIncome ?? 0) + (adj.income ?? 0), 0.05, 0.7);
  const targetCorp = clamp(0.25 + (law.taxCorporate ?? 0) + (adj.corporate ?? 0), 0.05, 0.6);
  const targetSales = clamp(0.11 + (law.taxSales ?? 0) + (adj.sales ?? 0), 0, 0.35);
  const targetCg = clamp(0.2 + (law.taxCapitalGains ?? 0) + (adj.capitalGains ?? 0), 0, 0.5);
  e.taxRates.income += (targetIncome - e.taxRates.income) * 0.5;
  e.taxRates.corporate += (targetCorp - e.taxRates.corporate) * 0.5;
  e.taxRates.sales += (targetSales - e.taxRates.sales) * 0.5;
  e.taxRates.capitalGains += (targetCg - e.taxRates.capitalGains) * 0.5;
  // Immigration policy: a larger labor supply softens minimum-wage growth a touch.
  const immigrationWageDamp = 1 - (country.immigrationQuota - 50) / 500;
  const wageTarget = e.minimumWage * (1 + (law.minimumWagePct ?? 0) * 0.2 + e.inflation) * immigrationWageDamp;
  e.minimumWage = e.minimumWage * 0.5 + wageTarget * 0.5;

  // --- FX ------------------------------------------------------------------------
  const fxDrift = (e.interestRate - 0.03) * 0.5 - (e.inflation - 0.02) * 1.2 + growth * 0.5 + rng.range(-0.04, 0.04);
  e.exchangeRate = clamp(e.exchangeRate * (1 + fxDrift), 0.05, 20);

  // --- Country social indicators ---------------------------------------------------
  country.stability = clamp100(country.stability + (law.stability ?? 0) * 0.5 + (growth > 0 ? 0.5 : -1.5) + rng.range(-1.5, 1.5));
  country.corruption = clamp100(country.corruption + (law.corruption ?? 0) * 0.5 + rng.range(-1, 1));
  country.pressFreedom = clamp100(country.pressFreedom + (law.pressFreedom ?? 0) * 0.5 + rng.range(-1, 1));
  country.healthcare = clamp100(country.healthcare + (law.healthcare ?? 0) * 0.4 + rng.range(-0.5, 0.5));
  country.education = clamp100(country.education + (law.education ?? 0) * 0.4 + rng.range(-0.5, 0.5));
  country.infrastructure = clamp100(country.infrastructure + (law.infrastructure ?? 0) * 0.4 + rng.range(-0.5, 0.5));
  country.militaryPower = clamp100(country.militaryPower + (law.militaryPower ?? 0) * 0.4 + rng.range(-0.5, 0.5));
  country.climateRisk = clamp100(country.climateRisk + (law.climateRisk ?? 0) * 0.3 + 0.3 + rng.range(-0.3, 0.3));

  // --- Demographics ------------------------------------------------------------------
  const immigrationMult = 0.4 + (country.immigrationQuota / 100) * 1.2;
  const naturalGrowth = (country.birthRate - country.deathRate + country.migrationRate * immigrationMult) / 1000;
  country.population = Math.round(country.population * (1 + naturalGrowth));
  for (const city of country.cities) {
    city.population = Math.round(city.population * (1 + naturalGrowth + rng.range(-0.005, 0.01)));
    const lawCrime = (law.crime ?? 0);
    city.crime = clamp100(city.crime + lawCrime * 0.5 + (e.unemployment - 0.06) * 20 + rng.range(-2, 2));
  }

  // Natural disasters scale with climate risk: they hit GDP, stability, property values and
  // business confidence together — insurers absorb some of the cost via higher claims.
  if (rng.chance((country.climateRisk / 100) * 0.12 * difficultyCrisisMult)) {
    crisis = crisis ?? 'disaster';
    e.gdp *= rng.range(0.985, 0.998);
    country.stability = clamp100(country.stability - rng.range(1, 4));
    e.housingIndex = Math.max(20, e.housingIndex * rng.range(0.88, 0.97));
    e.businessConfidence = clamp100(e.businessConfidence - rng.range(3, 8));
  }

  e.history.push({
    year: state.year,
    gdp: e.gdp,
    gdpGrowth: e.gdpGrowth,
    inflation: e.inflation,
    interestRate: e.interestRate,
    unemployment: e.unemployment,
    stockIndex: e.stockIndex,
    housingIndex: e.housingIndex,
  });
  if (e.history.length > 120) e.history.shift();

  return { regimeChanged: prevRegime !== e.regime, crisis };
}

/** A simple trend-extrapolation forecast for next year, derived from recent history. */
export function economicForecast(e: Economy): { gdpGrowth: number; inflation: number; unemployment: number } {
  const hist = e.history;
  if (hist.length < 2) return { gdpGrowth: e.gdpGrowth, inflation: e.inflation, unemployment: e.unemployment };
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  const growthTrend = last.gdpGrowth - prev.gdpGrowth;
  const inflationTrend = last.inflation - prev.inflation;
  const unemploymentTrend = last.unemployment - prev.unemployment;
  return {
    gdpGrowth: e.gdpGrowth + growthTrend * 0.5,
    inflation: Math.max(0, e.inflation + inflationTrend * 0.5),
    unemployment: Math.max(0.01, e.unemployment + unemploymentTrend * 0.5),
  };
}

/** World commodity prices are shared: tick once per year on the first country. */
export function tickCommodities(state: GameState, rng: RNG): void {
  const world = state.countries[0].economy.commodities;
  for (const c of COMMODITIES) {
    let drift = rng.normal(0, 0.14);
    // Wars anywhere push oil/gas/gold up
    const warOn = state.countries.some((k) => k.atWarWith.length > 0);
    if (warOn && (c === 'oil' || c === 'gas' || c === 'gold')) drift += 0.1;
    world[c] = clamp(world[c] * (1 + drift), 25, 600);
  }
  // Propagate identical world prices to all countries.
  for (const country of state.countries) {
    country.economy.commodities = { ...world };
  }
}
