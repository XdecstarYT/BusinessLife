/**
 * Career & work-life realism data: the rank ladder, coworker personalities,
 * random workplace events, and the freelance/gig economy catalogue. Kept as
 * pure data so the career sim (in sim/actions.ts and sim/engine.ts) stays
 * readable.
 */
import type { CareerRank, CoworkerPersonality, WorkStyle } from '../sim/types';
import { SK } from './skills';

export interface CareerRankDef {
  id: CareerRank;
  label: string;
  salaryMult: number; // vs. the base opening salary at intern-equivalent
  minPerformanceToPromote: number; // 0..100, performance needed to be promotion-eligible
  minYearsToPromote: number; // years in current rank before you can push for the next one
}

export const CAREER_LADDER: CareerRankDef[] = [
  { id: 'intern', label: 'Intern', salaryMult: 0.55, minPerformanceToPromote: 50, minYearsToPromote: 1 },
  { id: 'junior', label: 'Junior', salaryMult: 0.8, minPerformanceToPromote: 55, minYearsToPromote: 1 },
  { id: 'mid', label: '', salaryMult: 1.0, minPerformanceToPromote: 62, minYearsToPromote: 2 },
  { id: 'senior', label: 'Senior', salaryMult: 1.35, minPerformanceToPromote: 68, minYearsToPromote: 2 },
  { id: 'manager', label: 'Manager', salaryMult: 1.85, minPerformanceToPromote: 74, minYearsToPromote: 3 },
  { id: 'executive', label: 'Executive', salaryMult: 2.6, minPerformanceToPromote: 100, minYearsToPromote: 999 },
];

export const CAREER_RANK_BY_ID: Record<CareerRank, CareerRankDef> =
  Object.fromEntries(CAREER_LADDER.map((r) => [r.id, r])) as Record<CareerRank, CareerRankDef>;

export function rankIndex(rank: CareerRank): number {
  return CAREER_LADDER.findIndex((r) => r.id === rank);
}

/** Prefixes/suffixes the rank onto a base title, e.g. "Senior Finance Analyst". */
export function titleForRank(baseTitle: string, rank: CareerRank): string {
  const def = CAREER_RANK_BY_ID[rank];
  if (rank === 'manager') return `${baseTitle} Manager`;
  if (rank === 'executive') return `Chief ${baseTitle.split(' ')[0]} Officer`;
  return def.label ? `${def.label} ${baseTitle}` : baseTitle;
}

export interface CoworkerPersonalityDef {
  id: CoworkerPersonality;
  label: string;
  icon: string;
  blurb: string;
  rapportGainMult: number; // how easily networking builds rapport with them
  stressPerYear: number; // ongoing stress this personality inflicts just by being around
  toxicityRisk: number; // 0..1 chance/year of a negative incident if unmanaged
}

export const COWORKER_PERSONALITIES: CoworkerPersonalityDef[] = [
  { id: 'friendly', label: 'Friendly', icon: '🙂', blurb: 'Easygoing and supportive.', rapportGainMult: 1.3, stressPerYear: -1, toxicityRisk: 0.02 },
  { id: 'mentoring', label: 'Mentoring', icon: '🧭', blurb: 'Invests in your growth.', rapportGainMult: 1.2, stressPerYear: -2, toxicityRisk: 0.01 },
  { id: 'competitive', label: 'Competitive', icon: '⚔️', blurb: 'Sees every project as a contest.', rapportGainMult: 0.85, stressPerYear: 1.5, toxicityRisk: 0.06 },
  { id: 'political', label: 'Political', icon: '🎭', blurb: 'Plays the room more than the work.', rapportGainMult: 0.9, stressPerYear: 1, toxicityRisk: 0.08 },
  { id: 'toxic', label: 'Toxic', icon: '☠️', blurb: 'Undermines and takes credit.', rapportGainMult: 0.6, stressPerYear: 3.5, toxicityRisk: 0.18 },
];

export const COWORKER_PERSONALITY_BY_ID: Record<CoworkerPersonality, CoworkerPersonalityDef> =
  Object.fromEntries(COWORKER_PERSONALITIES.map((p) => [p.id, p])) as Record<CoworkerPersonality, CoworkerPersonalityDef>;

export interface WorkStyleDef {
  id: WorkStyle;
  label: string;
  icon: string;
  salaryMult: number; // applied to base salary
  stressPerYear: number;
  blurb: string;
}

export const WORK_STYLES: WorkStyleDef[] = [
  { id: 'standard', label: 'Standard Hours', icon: '🕘', salaryMult: 1.0, stressPerYear: 0, blurb: 'A normal working week.' },
  { id: 'overtime', label: 'Overtime Grind', icon: '⏰', salaryMult: 1.18, stressPerYear: 6, blurb: 'Extra pay, extra hours, extra burnout risk.' },
  { id: 'flexible', label: 'Flexible / Remote', icon: '🏡', salaryMult: 0.94, stressPerYear: -4, blurb: 'Lower pay, but far easier on you.' },
];

export const WORK_STYLE_BY_ID: Record<WorkStyle, WorkStyleDef> =
  Object.fromEntries(WORK_STYLES.map((w) => [w.id, w])) as Record<WorkStyle, WorkStyleDef>;

export interface WorkplaceEventDef {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  weight: number; // relative chance
}

/** Random workplace events rolled a few times a career; each has bespoke effects wired in engine.ts. */
export const WORKPLACE_EVENTS: WorkplaceEventDef[] = [
  { id: 'restructure', label: 'Company Restructure', icon: '🗂️', blurb: 'Teams are being reshuffled and roles redefined.', weight: 3 },
  { id: 'manager_change', label: 'New Manager', icon: '👔', blurb: 'Your manager has moved on — someone new is taking over.', weight: 3 },
  { id: 'budget_cuts', label: 'Budget Cuts', icon: '✂️', blurb: 'Finance has frozen discretionary spend, raises included.', weight: 2 },
  { id: 'relocation', label: 'Office Relocation', icon: '🏢', blurb: 'The office is moving — commute and routine disrupted.', weight: 1 },
  { id: 'automation', label: 'Automation Push', icon: '🤖', blurb: 'New tooling is automating parts of your role.', weight: 2 },
  { id: 'accident', label: 'Workplace Accident', icon: '🚑', blurb: 'A safety incident rattled the floor.', weight: 1 },
  { id: 'scandal', label: 'Viral Company Scandal', icon: '📰', blurb: 'The company is trending for all the wrong reasons.', weight: 1 },
];

export const WORKPLACE_EVENT_BY_ID: Record<string, WorkplaceEventDef> =
  Object.fromEntries(WORKPLACE_EVENTS.map((e) => [e.id, e]));

export interface FreelanceGigDef {
  id: string;
  label: string;
  icon: string;
  skillId: string | null; // relevant skill, if any, drives success odds
  basePay: number;
  blurb: string;
}

export const FREELANCE_GIGS: FreelanceGigDef[] = [
  { id: 'design_work', label: 'Freelance Design', icon: '🎨', skillId: SK.film, basePay: 1_800, blurb: 'Logo, brand or web design for a small client.' },
  { id: 'consulting', label: 'Consulting Gig', icon: '💼', skillId: SK.leadership, basePay: 4_500, blurb: 'Short-term strategy consulting for a company.' },
  { id: 'coding', label: 'Contract Development', icon: '💻', skillId: SK.programming, basePay: 3_200, blurb: 'Build or fix software for a paying client.' },
  { id: 'writing', label: 'Freelance Writing', icon: '✍️', skillId: SK.writing, basePay: 900, blurb: 'Articles, copywriting or ghostwriting.' },
  { id: 'rideshare', label: 'Rideshare Driving', icon: '🚗', skillId: null, basePay: 600, blurb: 'Drive for a ride-hailing app. Low skill, low pay, always available.' },
  { id: 'influencer', label: 'Sponsored Content', icon: '📱', skillId: SK.socialMedia, basePay: 2_600, blurb: 'A brand deal for a social post or two.' },
  { id: 'trades', label: 'Odd Jobs & Trades', icon: '🔧', skillId: SK.construction, basePay: 1_100, blurb: 'Handyman work, moving help, small repairs.' },
];

export const FREELANCE_GIG_BY_ID: Record<string, FreelanceGigDef> =
  Object.fromEntries(FREELANCE_GIGS.map((g) => [g.id, g]));
