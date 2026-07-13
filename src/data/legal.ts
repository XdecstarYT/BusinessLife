/**
 * Static catalog for the Legal career (lawyer → partner → judge path). Dynamic per-life state
 * lives on Player.legalCareer — mirrors the static-data-vs-dynamic-state split used by
 * data/medical.ts / sim/medical.ts, which this module is structurally parallel to.
 */
export interface LegalSpecialtyDef {
  id: string;
  name: string;
  icon: string;
  difficulty: number; // 0..100, gates case-win odds and bar-complaint base risk
  baseSalary: number;
  complaintBaseRisk: number; // 0..1, yearly chance of a bar complaint absent skill mitigation
}

export const LEGAL_SPECIALTIES: LegalSpecialtyDef[] = [
  { id: 'family_law', name: 'Family Law', icon: '💔', difficulty: 20, baseSalary: 90_000, complaintBaseRisk: 0.02 },
  { id: 'real_estate_law', name: 'Real Estate Law', icon: '🏠', difficulty: 25, baseSalary: 100_000, complaintBaseRisk: 0.015 },
  { id: 'immigration_law', name: 'Immigration Law', icon: '🛂', difficulty: 30, baseSalary: 95_000, complaintBaseRisk: 0.02 },
  { id: 'criminal_defense', name: 'Criminal Defense', icon: '⚖️', difficulty: 35, baseSalary: 110_000, complaintBaseRisk: 0.03 },
  { id: 'personal_injury', name: 'Personal Injury', icon: '🩹', difficulty: 40, baseSalary: 130_000, complaintBaseRisk: 0.03 },
  { id: 'intellectual_property', name: 'Intellectual Property', icon: '💡', difficulty: 55, baseSalary: 180_000, complaintBaseRisk: 0.02 },
  { id: 'tax_law', name: 'Tax Law', icon: '📊', difficulty: 60, baseSalary: 190_000, complaintBaseRisk: 0.015 },
  { id: 'corporate_law', name: 'Corporate Law', icon: '🏢', difficulty: 65, baseSalary: 220_000, complaintBaseRisk: 0.025 },
  { id: 'litigation', name: 'Litigation', icon: '📋', difficulty: 70, baseSalary: 210_000, complaintBaseRisk: 0.04 },
  { id: 'mergers_acquisitions', name: 'Mergers & Acquisitions', icon: '🤝', difficulty: 80, baseSalary: 280_000, complaintBaseRisk: 0.03 },
];

export const LEGAL_SPECIALTY_BY_ID: Record<string, LegalSpecialtyDef> = Object.fromEntries(
  LEGAL_SPECIALTIES.map((s) => [s.id, s]),
);

export const LAW_FIRM_NAMES = ['Blackstone & Hale', 'Whitfield Sterling LLP', 'Kane Marsh Attorneys', 'Ashworth Global Law', 'Prescott & Vance', 'Sterling Cross Partners'];

export const LAW_SCHOOL_COST_PER_YEAR = 45_000;
export const LAW_SCHOOL_YEARS = 3;
export const ASSOCIATE_YEARS = 3;

/** Rank titles by LegalCareer.rank while stage === 'partner' (0 = fresh partner). */
export const LEGAL_RANK_TITLES = ['Junior Partner', 'Senior Partner', 'Managing Partner', 'Named Partner'];

/** Reputation + years-as-partner thresholds to be eligible to seek a judicial appointment. */
export const JUDGESHIP_MIN_REPUTATION = 75;
export const JUDGESHIP_MIN_PARTNER_RANK = 2;
