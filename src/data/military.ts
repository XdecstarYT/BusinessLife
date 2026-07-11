/**
 * Military Service career catalogue: branches, enlisted rank ladders, specialties (MOS/rating),
 * training programs, medals/decorations, bases/theaters and injury types. Same "content is data"
 * pattern as skills/industries/athletics — the sim layer only references ids defined here.
 */
import type { MilitaryBranch } from '../sim/types';

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export interface MilitaryBranchDef {
  id: MilitaryBranch;
  name: string;
  icon: string;
  description: string;
  basePayMultiplier: number; // small flavor differentiator on top of rank pay
}

export const MILITARY_BRANCHES: MilitaryBranchDef[] = [
  { id: 'army', name: 'Army', icon: '🎖️', description: 'The largest branch — boots on the ground, armor, artillery and infantry.', basePayMultiplier: 1 },
  { id: 'navy', name: 'Navy', icon: '⚓', description: 'Blue-water fleets, submarines and naval aviation.', basePayMultiplier: 1.05 },
  { id: 'air_force', name: 'Air Force', icon: '✈️', description: 'Airpower, pilots, and the world\'s most advanced logistics network.', basePayMultiplier: 1.1 },
  { id: 'marines', name: 'Marine Corps', icon: '🪖', description: 'The tip of the spear — expeditionary, amphibious, first to fight.', basePayMultiplier: 1 },
  { id: 'coast_guard', name: 'Coast Guard', icon: '🚤', description: 'Search and rescue, maritime law enforcement, coastal defense.', basePayMultiplier: 0.95 },
  { id: 'space_force', name: 'Space Force', icon: '🛰️', description: 'Satellites, orbital assets, and the newest and smallest branch.', basePayMultiplier: 1.15 },
];

export const BRANCH_BY_ID: Record<string, MilitaryBranchDef> = Object.fromEntries(MILITARY_BRANCHES.map((b) => [b.id, b]));

// ---------------------------------------------------------------------------
// Enlisted rank ladders (per branch) — real-world-flavored titles, 9 grades each
// ---------------------------------------------------------------------------

export interface MilitaryRankDef {
  id: string;
  name: string;
  payGrade: string; // e.g. 'E-1'
  minYears: number; // typical years of service before eligible for this rank
  salary: number; // annual base pay at this rank
}

function ranks(branch: MilitaryBranch, names: string[]): MilitaryRankDef[] {
  const years = [0, 0.5, 2, 4, 7, 10, 14, 18, 22];
  const salaries = [24000, 27000, 31000, 36000, 44000, 54000, 66000, 80000, 96000];
  return names.map((name, i) => ({
    id: `${branch}_r${i}`,
    name,
    payGrade: `E-${i + 1}`,
    minYears: years[i],
    salary: salaries[i],
  }));
}

export const RANKS_BY_BRANCH: Record<MilitaryBranch, MilitaryRankDef[]> = {
  army: ranks('army', ['Private', 'Private First Class', 'Corporal', 'Sergeant', 'Staff Sergeant', 'Sergeant First Class', 'Master Sergeant', 'Sergeant Major', 'Command Sergeant Major']),
  marines: ranks('marines', ['Private', 'Private First Class', 'Lance Corporal', 'Corporal', 'Sergeant', 'Staff Sergeant', 'Gunnery Sergeant', 'Master Sergeant', 'Sergeant Major']),
  navy: ranks('navy', ['Seaman Recruit', 'Seaman Apprentice', 'Seaman', 'Petty Officer 3rd Class', 'Petty Officer 2nd Class', 'Petty Officer 1st Class', 'Chief Petty Officer', 'Senior Chief Petty Officer', 'Master Chief Petty Officer']),
  coast_guard: ranks('coast_guard', ['Seaman Recruit', 'Seaman Apprentice', 'Seaman', 'Petty Officer 3rd Class', 'Petty Officer 2nd Class', 'Petty Officer 1st Class', 'Chief Petty Officer', 'Senior Chief Petty Officer', 'Master Chief Petty Officer']),
  air_force: ranks('air_force', ['Airman Basic', 'Airman', 'Airman First Class', 'Senior Airman', 'Staff Sergeant', 'Technical Sergeant', 'Master Sergeant', 'Senior Master Sergeant', 'Chief Master Sergeant']),
  space_force: ranks('space_force', ['Specialist 1', 'Specialist 2', 'Specialist 3', 'Specialist 4', 'Sergeant', 'Technical Sergeant', 'Master Sergeant', 'Senior Master Sergeant', 'Chief Master Sergeant']),
};

export function rankAt(branch: MilitaryBranch, index: number): MilitaryRankDef {
  const list = RANKS_BY_BRANCH[branch];
  return list[Math.min(index, list.length - 1)];
}

// ---------------------------------------------------------------------------
// Specialties (MOS / rating) — combat roles carry higher risk and reward
// ---------------------------------------------------------------------------

export interface MilitarySpecialtyDef {
  id: string;
  name: string;
  combatRole: boolean;
  salaryBonus: number; // flat annual bonus on top of rank pay
  description: string;
}

export const MILITARY_SPECIALTIES: MilitarySpecialtyDef[] = [
  { id: 'infantry', name: 'Infantry', combatRole: true, salaryBonus: 2000, description: 'Close combat, on foot, first through the door.' },
  { id: 'armor', name: 'Armor Crewman', combatRole: true, salaryBonus: 2500, description: 'Tanks and armored vehicles.' },
  { id: 'artillery', name: 'Field Artillery', combatRole: true, salaryBonus: 2200, description: 'Indirect fire support.' },
  { id: 'special_forces', name: 'Special Forces', combatRole: true, salaryBonus: 8000, description: 'Elite direct-action and unconventional warfare.' },
  { id: 'combat_engineer', name: 'Combat Engineer', combatRole: true, salaryBonus: 2400, description: 'Demolitions, breaching, fortification under fire.' },
  { id: 'eod', name: 'Explosive Ordnance Disposal', combatRole: true, salaryBonus: 6000, description: 'Disarming bombs and unexploded ordnance.' },
  { id: 'combat_medic', name: 'Combat Medic', combatRole: true, salaryBonus: 3000, description: 'Frontline trauma care under fire.' },
  { id: 'pilot', name: 'Pilot', combatRole: true, salaryBonus: 9000, description: 'Fixed-wing or rotary-wing aviation.' },
  { id: 'naval_aviation', name: 'Naval Aviation', combatRole: true, salaryBonus: 9500, description: 'Carrier-launched strike and support aircraft.' },
  { id: 'submarine_warfare', name: 'Submarine Warfare', combatRole: true, salaryBonus: 5500, description: 'Silent-service undersea operations.' },
  { id: 'military_police', name: 'Military Police', combatRole: true, salaryBonus: 2000, description: 'Law enforcement, convoy security, detainee operations.' },
  { id: 'sniper', name: 'Sniper', combatRole: true, salaryBonus: 4000, description: 'Long-range precision engagement and reconnaissance.' },
  { id: 'intelligence', name: 'Intelligence Analyst', combatRole: false, salaryBonus: 3500, description: 'Signals and human intelligence analysis.' },
  { id: 'cyber_ops', name: 'Cyber Operations', combatRole: false, salaryBonus: 5000, description: 'Network defense and offensive cyber missions.' },
  { id: 'logistics', name: 'Logistics', combatRole: false, salaryBonus: 1000, description: 'Supply chain, fuel, ammunition, transport.' },
  { id: 'mechanic', name: 'Vehicle Mechanic', combatRole: false, salaryBonus: 1500, description: 'Keeping the fleet running.' },
  { id: 'communications', name: 'Communications Specialist', combatRole: false, salaryBonus: 1800, description: 'Radios, satellite links, secure networks.' },
  { id: 'culinary', name: 'Culinary Specialist', combatRole: false, salaryBonus: 500, description: 'Feeding the unit, wherever it is stationed.' },
  { id: 'public_affairs', name: 'Public Affairs', combatRole: false, salaryBonus: 1200, description: 'Media relations and unit communications.' },
  { id: 'legal', name: 'Legal Specialist', combatRole: false, salaryBonus: 2000, description: 'Military justice and administrative law.' },
];

export const SPECIALTY_BY_ID: Record<string, MilitarySpecialtyDef> = Object.fromEntries(MILITARY_SPECIALTIES.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// Training programs
// ---------------------------------------------------------------------------

export interface MilitaryTrainingDef {
  id: string;
  name: string;
  description: string;
  combatSkillGain: number;
  leadershipGain: number;
  fitnessGain: number;
  disciplineGain: number;
  minRankIndex: number; // some courses require seniority
}

export const MILITARY_TRAINING_PROGRAMS: MilitaryTrainingDef[] = [
  { id: 'basic_combat', name: 'Basic Combat Training', description: 'Fundamentals of soldiering, refreshed.', combatSkillGain: 6, leadershipGain: 1, fitnessGain: 5, disciplineGain: 4, minRankIndex: 0 },
  { id: 'airborne', name: 'Airborne School', description: 'Static-line parachute qualification.', combatSkillGain: 5, leadershipGain: 2, fitnessGain: 6, disciplineGain: 2, minRankIndex: 0 },
  { id: 'ranger', name: 'Ranger School', description: 'Small-unit tactics under extreme fatigue.', combatSkillGain: 10, leadershipGain: 6, fitnessGain: 8, disciplineGain: 5, minRankIndex: 2 },
  { id: 'ocs', name: 'Officer Candidate School', description: 'Leadership and command fundamentals.', combatSkillGain: 2, leadershipGain: 12, fitnessGain: 3, disciplineGain: 4, minRankIndex: 3 },
  { id: 'combat_lifesaver', name: 'Combat Lifesaver Course', description: 'Battlefield first aid every unit needs.', combatSkillGain: 3, leadershipGain: 1, fitnessGain: 1, disciplineGain: 2, minRankIndex: 0 },
  { id: 'marksmanship', name: 'Advanced Marksmanship', description: 'Precision weapons handling.', combatSkillGain: 8, leadershipGain: 0, fitnessGain: 1, disciplineGain: 2, minRankIndex: 0 },
  { id: 'leadership_dev', name: 'Leadership Development Course', description: 'NCO leadership fundamentals.', combatSkillGain: 1, leadershipGain: 9, fitnessGain: 1, disciplineGain: 3, minRankIndex: 2 },
  { id: 'fitness_bootcamp', name: 'Physical Fitness Bootcamp', description: 'Punishing conditioning block.', combatSkillGain: 1, leadershipGain: 0, fitnessGain: 10, disciplineGain: 3, minRankIndex: 0 },
  { id: 'language_immersion', name: 'Language Immersion', description: 'Foreign-language and cultural training.', combatSkillGain: 0, leadershipGain: 2, fitnessGain: 0, disciplineGain: 1, minRankIndex: 0 },
  { id: 'cyber_cert', name: 'Cyber Warfare Certification', description: 'Offensive and defensive network operations.', combatSkillGain: 4, leadershipGain: 1, fitnessGain: 0, disciplineGain: 1, minRankIndex: 1 },
  { id: 'sere', name: 'SERE School', description: 'Survival, Evasion, Resistance, Escape.', combatSkillGain: 7, leadershipGain: 3, fitnessGain: 5, disciplineGain: 6, minRankIndex: 1 },
  { id: 'advanced_tactics', name: 'Advanced Combat Tactics', description: 'Small-unit maneuver and fire coordination.', combatSkillGain: 9, leadershipGain: 4, fitnessGain: 3, disciplineGain: 3, minRankIndex: 2 },
];

// ---------------------------------------------------------------------------
// Medals & decorations — tier 1 (common) to tier 5 (extraordinary)
// ---------------------------------------------------------------------------

export interface MilitaryMedalDef {
  id: string;
  name: string;
  tier: number; // 1..5
  reputationGain: number;
  karmaGain: number;
  requiresHeroism: boolean; // only awardable off a heroic-act roll, not routine service
}

export const MILITARY_MEDALS: MilitaryMedalDef[] = [
  { id: 'good_conduct', name: 'Good Conduct Medal', tier: 1, reputationGain: 1, karmaGain: 1, requiresHeroism: false },
  { id: 'national_defense', name: 'National Defense Service Medal', tier: 1, reputationGain: 1, karmaGain: 0, requiresHeroism: false },
  { id: 'combat_action_ribbon', name: 'Combat Action Ribbon', tier: 2, reputationGain: 2, karmaGain: 0, requiresHeroism: false },
  { id: 'army_commendation', name: 'Army Commendation Medal', tier: 2, reputationGain: 2, karmaGain: 1, requiresHeroism: false },
  { id: 'navy_achievement', name: 'Navy Achievement Medal', tier: 2, reputationGain: 2, karmaGain: 1, requiresHeroism: false },
  { id: 'meritorious_service', name: 'Meritorious Service Medal', tier: 3, reputationGain: 3, karmaGain: 1, requiresHeroism: false },
  { id: 'air_medal', name: 'Air Medal', tier: 3, reputationGain: 3, karmaGain: 1, requiresHeroism: false },
  { id: 'purple_heart', name: 'Purple Heart', tier: 3, reputationGain: 4, karmaGain: 2, requiresHeroism: false },
  { id: 'bronze_star', name: 'Bronze Star', tier: 4, reputationGain: 5, karmaGain: 3, requiresHeroism: true },
  { id: 'legion_of_merit', name: 'Legion of Merit', tier: 4, reputationGain: 5, karmaGain: 2, requiresHeroism: false },
  { id: 'silver_star', name: 'Silver Star', tier: 4, reputationGain: 7, karmaGain: 4, requiresHeroism: true },
  { id: 'distinguished_flying_cross', name: 'Distinguished Flying Cross', tier: 4, reputationGain: 6, karmaGain: 3, requiresHeroism: true },
  { id: 'navy_cross', name: 'Navy Cross', tier: 5, reputationGain: 9, karmaGain: 5, requiresHeroism: true },
  { id: 'distinguished_service_cross', name: 'Distinguished Service Cross', tier: 5, reputationGain: 9, karmaGain: 5, requiresHeroism: true },
  { id: 'medal_of_honor', name: 'Medal of Honor', tier: 5, reputationGain: 15, karmaGain: 8, requiresHeroism: true },
  { id: 'presidential_unit_citation', name: 'Presidential Unit Citation', tier: 3, reputationGain: 3, karmaGain: 1, requiresHeroism: false },
  { id: 'pow_medal', name: 'Prisoner of War Medal', tier: 3, reputationGain: 4, karmaGain: 2, requiresHeroism: false },
  { id: 'expeditionary_medal', name: 'Armed Forces Expeditionary Medal', tier: 2, reputationGain: 2, karmaGain: 0, requiresHeroism: false },
  { id: 'humanitarian_service', name: 'Humanitarian Service Medal', tier: 2, reputationGain: 2, karmaGain: 2, requiresHeroism: false },
  { id: 'valorous_unit_award', name: 'Valorous Unit Award', tier: 3, reputationGain: 3, karmaGain: 1, requiresHeroism: false },
];

export const MEDAL_BY_ID: Record<string, MilitaryMedalDef> = Object.fromEntries(MILITARY_MEDALS.map((m) => [m.id, m]));

// ---------------------------------------------------------------------------
// Bases & deployment theaters
// ---------------------------------------------------------------------------

export type WarTerrain = 'desert' | 'urban' | 'jungle' | 'arctic';

export interface MilitaryBaseDef {
  id: string;
  name: string;
  homeland: boolean; // true = domestic garrison duty, false = forward-deployed theater
  terrain: WarTerrain; // sets the battlefield dressing in Ground/Air Combat scenes for this base
}

export const MILITARY_BASES: MilitaryBaseDef[] = [
  { id: 'fort_meridian', name: 'Fort Meridian', homeland: true, terrain: 'urban' },
  { id: 'camp_ironwood', name: 'Camp Ironwood', homeland: true, terrain: 'jungle' },
  { id: 'naval_station_blackwater', name: 'Naval Station Blackwater', homeland: true, terrain: 'urban' },
  { id: 'lakeview_air_base', name: 'Lakeview Air Force Base', homeland: true, terrain: 'urban' },
  { id: 'fob_talon', name: 'Forward Operating Base Talon', homeland: false, terrain: 'desert' },
  { id: 'fob_sable', name: 'Forward Operating Base Sable', homeland: false, terrain: 'urban' },
  { id: 'combat_outpost_reef', name: 'Combat Outpost Reef', homeland: false, terrain: 'jungle' },
  { id: 'carrier_strike_group', name: 'Carrier Strike Group Nine', homeland: false, terrain: 'desert' },
  { id: 'highland_garrison', name: 'Highland Garrison', homeland: false, terrain: 'arctic' },
  { id: 'coastal_defense_wing', name: 'Coastal Defense Wing', homeland: true, terrain: 'urban' },
];

// ---------------------------------------------------------------------------
// Injury types
// ---------------------------------------------------------------------------

export interface MilitaryInjuryDef {
  id: string;
  name: string;
  minSeverity: number;
  maxSeverity: number;
  permanentChance: number; // 0..1
}

export const MILITARY_INJURY_TYPES: MilitaryInjuryDef[] = [
  { id: 'gunshot_wound', name: 'Gunshot Wound', minSeverity: 4, maxSeverity: 9, permanentChance: 0.3 },
  { id: 'shrapnel_wound', name: 'Shrapnel Wound', minSeverity: 3, maxSeverity: 7, permanentChance: 0.2 },
  { id: 'traumatic_brain_injury', name: 'Traumatic Brain Injury', minSeverity: 5, maxSeverity: 10, permanentChance: 0.5 },
  { id: 'hearing_loss', name: 'Blast-Induced Hearing Loss', minSeverity: 2, maxSeverity: 5, permanentChance: 0.6 },
  { id: 'amputation', name: 'Traumatic Amputation', minSeverity: 8, maxSeverity: 10, permanentChance: 1 },
  { id: 'burns', name: 'Severe Burns', minSeverity: 4, maxSeverity: 9, permanentChance: 0.4 },
  { id: 'spinal_injury', name: 'Spinal Injury', minSeverity: 6, maxSeverity: 10, permanentChance: 0.5 },
  { id: 'broken_bones', name: 'Multiple Fractures', minSeverity: 2, maxSeverity: 6, permanentChance: 0.05 },
  { id: 'concussion', name: 'Concussion', minSeverity: 1, maxSeverity: 4, permanentChance: 0.05 },
  { id: 'frostbite', name: 'Severe Frostbite', minSeverity: 3, maxSeverity: 7, permanentChance: 0.25 },
  { id: 'heat_stroke', name: 'Heat Stroke', minSeverity: 2, maxSeverity: 6, permanentChance: 0.05 },
  { id: 'chemical_exposure', name: 'Chemical Exposure', minSeverity: 3, maxSeverity: 8, permanentChance: 0.35 },
];
