/**
 * Static catalog for the Medical career (doctor/surgeon path). Dynamic per-life state lives on
 * Player.medicalCareer — mirrors the static-data-vs-dynamic-state split used by
 * data/military.ts / sim/military.ts.
 */
export interface MedicalSpecialtyDef {
  id: string;
  name: string;
  icon: string;
  difficulty: number; // 0..100, gates matching odds and malpractice base risk
  baseSalary: number;
  malpracticeBaseRisk: number; // 0..1, yearly chance of a suit absent skill mitigation
}

export const MEDICAL_SPECIALTIES: MedicalSpecialtyDef[] = [
  { id: 'general_practice', name: 'General Practice', icon: '🩺', difficulty: 20, baseSalary: 140_000, malpracticeBaseRisk: 0.02 },
  { id: 'pediatrics', name: 'Pediatrics', icon: '🧸', difficulty: 30, baseSalary: 150_000, malpracticeBaseRisk: 0.025 },
  { id: 'psychiatry', name: 'Psychiatry', icon: '🧠', difficulty: 35, baseSalary: 170_000, malpracticeBaseRisk: 0.02 },
  { id: 'dermatology', name: 'Dermatology', icon: '🧴', difficulty: 40, baseSalary: 220_000, malpracticeBaseRisk: 0.015 },
  { id: 'anesthesiology', name: 'Anesthesiology', icon: '💉', difficulty: 55, baseSalary: 260_000, malpracticeBaseRisk: 0.05 },
  { id: 'cardiology', name: 'Cardiology', icon: '❤️', difficulty: 60, baseSalary: 300_000, malpracticeBaseRisk: 0.045 },
  { id: 'oncology', name: 'Oncology', icon: '🎗️', difficulty: 65, baseSalary: 310_000, malpracticeBaseRisk: 0.04 },
  { id: 'neurology', name: 'Neurology', icon: '🧬', difficulty: 68, baseSalary: 290_000, malpracticeBaseRisk: 0.045 },
  { id: 'emergency_medicine', name: 'Emergency Medicine', icon: '🚑', difficulty: 62, baseSalary: 280_000, malpracticeBaseRisk: 0.06 },
  { id: 'surgery', name: 'Surgery', icon: '🔪', difficulty: 80, baseSalary: 380_000, malpracticeBaseRisk: 0.07 },
];

export const MEDICAL_SPECIALTY_BY_ID: Record<string, MedicalSpecialtyDef> = Object.fromEntries(
  MEDICAL_SPECIALTIES.map((s) => [s.id, s]),
);

export const HOSPITAL_NAMES = ['St. Aldric General', 'Mercy Regional', 'Northgate Medical Center', 'Riverbend University Hospital', 'Sacred Cross Hospital', 'Lakeside Memorial'];

export const MED_SCHOOL_COST_PER_YEAR = 55_000;
export const MED_SCHOOL_YEARS = 4;
export const RESIDENCY_YEARS = 3;

/** Rank titles by MedicalCareer.rank (0 = student/resident handled separately). */
export const MEDICAL_RANK_TITLES = ['Attending Physician', 'Senior Physician', 'Chief of Service', 'Medical Director'];
