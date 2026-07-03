/**
 * Country seeds. Fictional nations with distinct economic profiles, political
 * systems and resource endowments. World generation expands each seed into a
 * full country with states, cities, parties, politicians and public companies.
 */
import type { PoliticalSystem } from '../sim/types';

export interface CountrySeed {
  id: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  population: number;
  gdpPerCapita: number; // USD-equivalent
  system: PoliticalSystem;
  leaderTitle: string;
  ideologyLean: number; // -100..100, average of the electorate
  stability: number;
  corruption: number;
  pressFreedom: number;
  militaryPower: number;
  climateRisk: number;
  resources: string[];
  isPlayerHome?: boolean;
}

export const COUNTRY_SEEDS: CountrySeed[] = [
  {
    id: 'veldova', name: 'Veldova', flag: '🟦', currency: 'Veldovan Dollar', currencySymbol: '$',
    population: 52_000_000, gdpPerCapita: 48_000, system: 'parliamentary', leaderTitle: 'Prime Minister',
    ideologyLean: 5, stability: 78, corruption: 28, pressFreedom: 82, militaryPower: 55, climateRisk: 40,
    resources: ['commodity_grain', 'commodity_metals', 'services'], isPlayerHome: true,
  },
  {
    id: 'arkadia', name: 'Arkadia', flag: '🟥', currency: 'Arkadian Crown', currencySymbol: '₭',
    population: 145_000_000, gdpPerCapita: 62_000, system: 'presidential', leaderTitle: 'President',
    ideologyLean: 12, stability: 72, corruption: 35, pressFreedom: 70, militaryPower: 95, climateRisk: 45,
    resources: ['commodity_oil', 'tech', 'defense'],
  },
  {
    id: 'norvenia', name: 'Norvenia', flag: '⬜', currency: 'Norvenian Krone', currencySymbol: 'kr',
    population: 9_500_000, gdpPerCapita: 71_000, system: 'parliamentary', leaderTitle: 'Prime Minister',
    ideologyLean: -18, stability: 92, corruption: 8, pressFreedom: 95, militaryPower: 30, climateRisk: 20,
    resources: ['commodity_oil', 'commodity_gas', 'green'],
  },
  {
    id: 'sorona', name: 'Sorona', flag: '🟨', currency: 'Soronese Peso', currencySymbol: '₱',
    population: 88_000_000, gdpPerCapita: 14_500, system: 'presidential', leaderTitle: 'President',
    ideologyLean: -8, stability: 55, corruption: 62, pressFreedom: 55, militaryPower: 45, climateRisk: 70,
    resources: ['agriculture', 'commodity_metals', 'tourism'],
  },
  {
    id: 'kestrovia', name: 'Kestrovia', flag: '🟪', currency: 'Kestrovian Ruble', currencySymbol: '₽',
    population: 110_000_000, gdpPerCapita: 19_000, system: 'dictatorship', leaderTitle: 'Supreme Leader',
    ideologyLean: 25, stability: 60, corruption: 78, pressFreedom: 18, militaryPower: 88, climateRisk: 35,
    resources: ['commodity_oil', 'commodity_gas', 'commodity_metals', 'defense'],
  },
  {
    id: 'jinhai', name: 'Jinhai', flag: '🟧', currency: 'Jinhai Yuan', currencySymbol: '¥',
    population: 480_000_000, gdpPerCapita: 22_000, system: 'dictatorship', leaderTitle: 'Chairman',
    ideologyLean: 10, stability: 75, corruption: 55, pressFreedom: 22, militaryPower: 92, climateRisk: 55,
    resources: ['industrial', 'tech', 'export', 'commodity_metals'],
  },
  {
    id: 'albrecht', name: 'Albrecht', flag: '🟫', currency: 'Albrechtian Mark', currencySymbol: '₼',
    population: 68_000_000, gdpPerCapita: 55_000, system: 'parliamentary', leaderTitle: 'Chancellor',
    ideologyLean: -5, stability: 85, corruption: 18, pressFreedom: 88, militaryPower: 60, climateRisk: 30,
    resources: ['industrial', 'auto', 'export'],
  },
  {
    id: 'meridiana', name: 'Meridiana', flag: '🟩', currency: 'Meridian Real', currencySymbol: 'R$',
    population: 160_000_000, gdpPerCapita: 12_000, system: 'presidential', leaderTitle: 'President',
    ideologyLean: -12, stability: 58, corruption: 60, pressFreedom: 62, militaryPower: 50, climateRisk: 65,
    resources: ['agriculture', 'commodity_grain', 'mining', 'commodity_metals'],
  },
  {
    id: 'zarahd', name: 'Zarahd', flag: '🕌', currency: 'Zarahdi Dinar', currencySymbol: 'ز',
    population: 34_000_000, gdpPerCapita: 41_000, system: 'monarchy', leaderTitle: 'Sultan',
    ideologyLean: 30, stability: 70, corruption: 50, pressFreedom: 30, militaryPower: 65, climateRisk: 75,
    resources: ['commodity_oil', 'commodity_gas', 'finance'],
  },
  {
    id: 'novaterra', name: 'Novaterra', flag: '🌐', currency: 'Novaterran Dollar', currencySymbol: 'N$',
    population: 26_000_000, gdpPerCapita: 52_000, system: 'parliamentary', leaderTitle: 'Prime Minister',
    ideologyLean: -2, stability: 88, corruption: 15, pressFreedom: 90, militaryPower: 35, climateRisk: 60,
    resources: ['mining', 'commodity_metals', 'agriculture', 'tourism'],
  },
  {
    id: 'ostrava', name: 'Ostrava', flag: '⬛', currency: 'Ostravan Zloty', currencySymbol: 'zł',
    population: 41_000_000, gdpPerCapita: 28_000, system: 'parliamentary', leaderTitle: 'Prime Minister',
    ideologyLean: 15, stability: 68, corruption: 42, pressFreedom: 60, militaryPower: 48, climateRisk: 30,
    resources: ['industrial', 'coal', 'agriculture'],
  },
  {
    id: 'ivoria', name: 'Ivoria', flag: '🌍', currency: 'Ivorian Franc', currencySymbol: '₣',
    population: 95_000_000, gdpPerCapita: 6_500, system: 'presidential', leaderTitle: 'President',
    ideologyLean: 0, stability: 45, corruption: 72, pressFreedom: 45, militaryPower: 30, climateRisk: 80,
    resources: ['mining', 'commodity_gold', 'agriculture', 'commodity_metals'],
  },
];
