/**
 * Static catalog for the V50 Corporate Empire expansion: advertising channels, factory/office/
 * venture-arm economics. Dynamic per-company state lives on Company.factories/
 * internationalOffices/ventureInvestments/activeCampaign — mirrors the static-data-vs-dynamic-
 * state split used elsewhere (data/military.ts, data/drugs.ts, etc.).
 */
import type { AdChannel } from '../sim/types';

export interface AdChannelDef {
  id: AdChannel;
  name: string;
  icon: string;
  blurb: string;
  brandPower: number; // relative strength of the brand/demand boost per dollar spent
  viralChance: number; // 0..1 chance per campaign of a viral moment (bonus payoff)
  backfireChance: number; // 0..1 chance per campaign of a PR backfire (brand hit)
}

export const AD_CHANNELS: AdChannelDef[] = [
  { id: 'tv', name: 'TV & Broadcast', icon: '📺', blurb: 'Broad reach, steady and predictable.', brandPower: 1, viralChance: 0.05, backfireChance: 0.05 },
  { id: 'social', name: 'Social Media', icon: '📱', blurb: 'Cheap and fast, but the crowd can turn on you.', brandPower: 1.2, viralChance: 0.18, backfireChance: 0.15 },
  { id: 'influencer', name: 'Influencer Partnerships', icon: '⭐', blurb: 'Borrowed credibility — huge upside if it lands.', brandPower: 1.35, viralChance: 0.22, backfireChance: 0.18 },
  { id: 'billboard', name: 'Billboards & Print', icon: '🪧', blurb: 'Unglamorous but reliable, almost no downside risk.', brandPower: 0.8, viralChance: 0.02, backfireChance: 0.02 },
  { id: 'guerrilla', name: 'Guerrilla Marketing', icon: '🎪', blurb: 'Stunts and buzz — the biggest swings, good or bad.', brandPower: 1.15, viralChance: 0.25, backfireChance: 0.25 },
];

export const AD_CHANNEL_BY_ID: Record<AdChannel, AdChannelDef> = Object.fromEntries(AD_CHANNELS.map((a) => [a.id, a])) as Record<AdChannel, AdChannelDef>;

export const AD_CAMPAIGN_MIN_BUDGET = 25_000;
export const AD_CAMPAIGN_MIN_YEARS = 1;
export const AD_CAMPAIGN_MAX_YEARS = 3;

export const VENTURE_ARM_COST = 250_000;
export const VENTURE_ARM_MIN_HQ_TIER = 1;
/** A target company must be private, NPC-founded, and below this valuation to count as a
 * venture-investable "startup" rather than a full acquisition target. */
export const VENTURE_TARGET_VALUATION_CEILING = 8_000_000;
export const VENTURE_MIN_INVESTMENT = 25_000;

export const FOREIGN_OFFICE_BASE_COST = 400_000;
/** Cost scales with the destination country's GDP (in billions) relative to a $1T baseline. */
export function foreignOfficeCost(destinationGdpBillions: number): number {
  return Math.round(FOREIGN_OFFICE_BASE_COST * (0.6 + Math.sqrt(Math.max(1, destinationGdpBillions) / 1000)));
}

export const FACTORY_BASE_COST = 300_000;
export const FACTORY_CAPACITY_UNITS = 100;
/** Cost scales with the industry's capital intensity — heavy industry factories cost more. */
export function factoryCost(capitalIntensity: number): number {
  return Math.round(FACTORY_BASE_COST * (0.6 + capitalIntensity * 1.4));
}
export function automationUpgradeCost(currentLevel: number): number {
  return Math.round(120_000 * Math.pow(1.9, currentLevel));
}

export const ACQUISITION_PREMIUM = 1.25; // multiplier over fair valuation for a friendly buyout
