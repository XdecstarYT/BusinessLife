/**
 * Athlete career catalogue: attributes, positions, leagues/teams, running events, injury
 * types and training programs for the soccer/football/running career path. Same "content is
 * data" pattern as skills/industries — the sim and 3D layers only reference ids defined here.
 */
import type { AthleteSport } from '../sim/types';

// ---------------------------------------------------------------------------
// Attributes (per sport, 0..100 each)
// ---------------------------------------------------------------------------

export interface AthleteAttrDef {
  id: string;
  name: string;
  sport: AthleteSport;
}

function attrId(sport: string, name: string): string {
  return `attr_${sport}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

const SOCCER_ATTR_NAMES = ['Pace', 'Shooting', 'Passing', 'Dribbling', 'Defending', 'Physical', 'Goalkeeping'];
const FOOTBALL_ATTR_NAMES = ['Speed', 'Strength', 'Agility', 'Throw Power', 'Throw Accuracy', 'Catching', 'Blocking', 'Tackling', 'Awareness'];
const RUNNING_ATTR_NAMES = ['Speed', 'Acceleration', 'Endurance', 'Technique', 'Mental Toughness'];

export const SOCCER_ATTRS: AthleteAttrDef[] = SOCCER_ATTR_NAMES.map((name) => ({ id: attrId('soccer', name), name, sport: 'soccer' }));
export const FOOTBALL_ATTRS: AthleteAttrDef[] = FOOTBALL_ATTR_NAMES.map((name) => ({ id: attrId('football', name), name, sport: 'football' }));
export const RUNNING_ATTRS: AthleteAttrDef[] = RUNNING_ATTR_NAMES.map((name) => ({ id: attrId('running', name), name, sport: 'running' }));

export const ATTRS_BY_SPORT: Record<AthleteSport, AthleteAttrDef[]> = {
  soccer: SOCCER_ATTRS,
  football: FOOTBALL_ATTRS,
  running: RUNNING_ATTRS,
};

/** Shorthand ids, mirroring data/skills.ts's `SK` object. */
export const AA = {
  soccer: {
    pace: attrId('soccer', 'Pace'),
    shooting: attrId('soccer', 'Shooting'),
    passing: attrId('soccer', 'Passing'),
    dribbling: attrId('soccer', 'Dribbling'),
    defending: attrId('soccer', 'Defending'),
    physical: attrId('soccer', 'Physical'),
    goalkeeping: attrId('soccer', 'Goalkeeping'),
  },
  football: {
    speed: attrId('football', 'Speed'),
    strength: attrId('football', 'Strength'),
    agility: attrId('football', 'Agility'),
    throwPower: attrId('football', 'Throw Power'),
    throwAccuracy: attrId('football', 'Throw Accuracy'),
    catching: attrId('football', 'Catching'),
    blocking: attrId('football', 'Blocking'),
    tackling: attrId('football', 'Tackling'),
    awareness: attrId('football', 'Awareness'),
  },
  running: {
    speed: attrId('running', 'Speed'),
    acceleration: attrId('running', 'Acceleration'),
    endurance: attrId('running', 'Endurance'),
    technique: attrId('running', 'Technique'),
    mentalToughness: attrId('running', 'Mental Toughness'),
  },
};

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export interface PositionDef {
  id: string;
  name: string;
  sport: AthleteSport;
  primaryAttrs: string[]; // weighted most heavily in overallRating
}

export const SOCCER_POSITIONS: PositionDef[] = [
  { id: 'GK', name: 'Goalkeeper', sport: 'soccer', primaryAttrs: [AA.soccer.goalkeeping, AA.soccer.physical] },
  { id: 'CB', name: 'Center Back', sport: 'soccer', primaryAttrs: [AA.soccer.defending, AA.soccer.physical] },
  { id: 'FB', name: 'Fullback', sport: 'soccer', primaryAttrs: [AA.soccer.defending, AA.soccer.pace] },
  { id: 'DM', name: 'Defensive Midfielder', sport: 'soccer', primaryAttrs: [AA.soccer.defending, AA.soccer.passing] },
  { id: 'CM', name: 'Central Midfielder', sport: 'soccer', primaryAttrs: [AA.soccer.passing, AA.soccer.dribbling] },
  { id: 'AM', name: 'Attacking Midfielder', sport: 'soccer', primaryAttrs: [AA.soccer.dribbling, AA.soccer.passing] },
  { id: 'W', name: 'Winger', sport: 'soccer', primaryAttrs: [AA.soccer.pace, AA.soccer.dribbling] },
  { id: 'ST', name: 'Striker', sport: 'soccer', primaryAttrs: [AA.soccer.shooting, AA.soccer.pace] },
];

export const FOOTBALL_POSITIONS: PositionDef[] = [
  { id: 'QB', name: 'Quarterback', sport: 'football', primaryAttrs: [AA.football.throwAccuracy, AA.football.throwPower, AA.football.awareness] },
  { id: 'RB', name: 'Running Back', sport: 'football', primaryAttrs: [AA.football.speed, AA.football.agility] },
  { id: 'WR', name: 'Wide Receiver', sport: 'football', primaryAttrs: [AA.football.speed, AA.football.catching] },
  { id: 'TE', name: 'Tight End', sport: 'football', primaryAttrs: [AA.football.catching, AA.football.blocking] },
  { id: 'OL', name: 'Offensive Line', sport: 'football', primaryAttrs: [AA.football.strength, AA.football.blocking] },
  { id: 'DL', name: 'Defensive Line', sport: 'football', primaryAttrs: [AA.football.strength, AA.football.tackling] },
  { id: 'LB', name: 'Linebacker', sport: 'football', primaryAttrs: [AA.football.tackling, AA.football.awareness] },
  { id: 'CB', name: 'Cornerback', sport: 'football', primaryAttrs: [AA.football.speed, AA.football.agility] },
  { id: 'S', name: 'Safety', sport: 'football', primaryAttrs: [AA.football.awareness, AA.football.tackling] },
  { id: 'K', name: 'Kicker', sport: 'football', primaryAttrs: [AA.football.throwPower, AA.football.throwAccuracy] },
];

export const POSITIONS_BY_SPORT: Record<'soccer' | 'football', PositionDef[]> = {
  soccer: SOCCER_POSITIONS,
  football: FOOTBALL_POSITIONS,
};

// ---------------------------------------------------------------------------
// Running events
// ---------------------------------------------------------------------------

export interface RunningEventDef {
  id: string;
  name: string;
  distanceMeters: number;
  worldRecordSeconds: number; // real-world approximate elite benchmark, used to scale sim pacing
  type: 'sprint' | 'middle' | 'distance';
}

export const RUNNING_EVENTS: RunningEventDef[] = [
  { id: '100m', name: '100 meters', distanceMeters: 100, worldRecordSeconds: 9.58, type: 'sprint' },
  { id: '200m', name: '200 meters', distanceMeters: 200, worldRecordSeconds: 19.19, type: 'sprint' },
  { id: '400m', name: '400 meters', distanceMeters: 400, worldRecordSeconds: 43.03, type: 'sprint' },
  { id: '800m', name: '800 meters', distanceMeters: 800, worldRecordSeconds: 100.91, type: 'middle' },
  { id: '1500m', name: '1500 meters', distanceMeters: 1500, worldRecordSeconds: 206, type: 'middle' },
  { id: '5000m', name: '5000 meters', distanceMeters: 5000, worldRecordSeconds: 755, type: 'distance' },
  { id: '10000m', name: '10,000 meters', distanceMeters: 10000, worldRecordSeconds: 1577, type: 'distance' },
  { id: 'marathon', name: 'Marathon', distanceMeters: 42195, worldRecordSeconds: 7207, type: 'distance' },
];
export const RUNNING_EVENT_BY_ID: Record<string, RunningEventDef> = Object.fromEntries(RUNNING_EVENTS.map((e) => [e.id, e]));

// ---------------------------------------------------------------------------
// Leagues & teams (soccer + football)
// ---------------------------------------------------------------------------

export interface AthleteLeagueDef {
  id: string;
  sport: 'soccer' | 'football';
  name: string;
  tier: number; // 1 = top flight
  promotesTo?: string;
  relegatesTo?: string;
}

export interface AthleteTeamDef {
  id: string;
  sport: 'soccer' | 'football';
  leagueId: string;
  name: string;
  city: string;
  colorPrimary: number;
  colorSecondary: number;
  prestige: number; // 0..100, sets AI roster strength and wage budget
}

export const ATHLETE_LEAGUES: AthleteLeagueDef[] = [
  { id: 'soccer_premier', sport: 'soccer', name: 'Metro Premier League', tier: 1, relegatesTo: 'soccer_championship' },
  { id: 'soccer_championship', sport: 'soccer', name: 'Metro Championship', tier: 2, promotesTo: 'soccer_premier' },
  { id: 'football_national', sport: 'football', name: 'National Gridiron League', tier: 1 },
];

export const ATHLETE_TEAMS: AthleteTeamDef[] = [
  // Soccer — Premier (tier 1)
  { id: 's_ironclad', sport: 'soccer', leagueId: 'soccer_premier', name: 'Ironclad FC', city: 'Cleargate', colorPrimary: 0x1d4ed8, colorSecondary: 0xf8fafc, prestige: 92 },
  { id: 's_harborside', sport: 'soccer', leagueId: 'soccer_premier', name: 'Harborside United', city: 'Veldova Bay', colorPrimary: 0x059669, colorSecondary: 0xffffff, prestige: 85 },
  { id: 's_redbrook', sport: 'soccer', leagueId: 'soccer_premier', name: 'Redbrook Athletic', city: 'Redbrook', colorPrimary: 0xdc2626, colorSecondary: 0x111827, prestige: 80 },
  { id: 's_kingsford', sport: 'soccer', leagueId: 'soccer_premier', name: 'Kingsford Royals', city: 'Kingsford', colorPrimary: 0x7c3aed, colorSecondary: 0xfbbf24, prestige: 78 },
  { id: 's_northgate', sport: 'soccer', leagueId: 'soccer_premier', name: 'Northgate City', city: 'Northgate', colorPrimary: 0x0891b2, colorSecondary: 0x111827, prestige: 74 },
  { id: 's_summit', sport: 'soccer', leagueId: 'soccer_premier', name: 'Summit Wanderers', city: 'Summit Hills', colorPrimary: 0xea580c, colorSecondary: 0xffffff, prestige: 70 },
  { id: 's_ashford', sport: 'soccer', leagueId: 'soccer_premier', name: 'Ashford Rovers', city: 'Ashford', colorPrimary: 0x334155, colorSecondary: 0xfacc15, prestige: 66 },
  { id: 's_millbrook', sport: 'soccer', leagueId: 'soccer_premier', name: 'Millbrook Town', city: 'Millbrook', colorPrimary: 0x16a34a, colorSecondary: 0x111827, prestige: 62 },
  // Soccer — Championship (tier 2)
  { id: 's_dunmore', sport: 'soccer', leagueId: 'soccer_championship', name: 'Dunmore FC', city: 'Dunmore', colorPrimary: 0x9333ea, colorSecondary: 0xffffff, prestige: 55 },
  { id: 's_west_end', sport: 'soccer', leagueId: 'soccer_championship', name: 'West End Albion', city: 'West End', colorPrimary: 0x1e40af, colorSecondary: 0xfacc15, prestige: 52 },
  { id: 's_stonebridge', sport: 'soccer', leagueId: 'soccer_championship', name: 'Stonebridge United', city: 'Stonebridge', colorPrimary: 0xb91c1c, colorSecondary: 0xffffff, prestige: 50 },
  { id: 's_fairhaven', sport: 'soccer', leagueId: 'soccer_championship', name: 'Fairhaven City', city: 'Fairhaven', colorPrimary: 0x0d9488, colorSecondary: 0x111827, prestige: 47 },
  { id: 's_glenmoor', sport: 'soccer', leagueId: 'soccer_championship', name: 'Glenmoor Athletic', city: 'Glenmoor', colorPrimary: 0x92400e, colorSecondary: 0xfef3c7, prestige: 44 },
  { id: 's_riverside', sport: 'soccer', leagueId: 'soccer_championship', name: 'Riverside Rangers', city: 'Riverside', colorPrimary: 0x475569, colorSecondary: 0xffffff, prestige: 40 },
  // Football — National (tier 1)
  { id: 'f_titans', sport: 'football', leagueId: 'football_national', name: 'Cleargate Titans', city: 'Cleargate', colorPrimary: 0x1e3a8a, colorSecondary: 0xfacc15, prestige: 90 },
  { id: 'f_marauders', sport: 'football', leagueId: 'football_national', name: 'Redbrook Marauders', city: 'Redbrook', colorPrimary: 0x991b1b, colorSecondary: 0x111827, prestige: 84 },
  { id: 'f_stormhawks', sport: 'football', leagueId: 'football_national', name: 'Northgate Stormhawks', city: 'Northgate', colorPrimary: 0x0e7490, colorSecondary: 0xf8fafc, prestige: 79 },
  { id: 'f_ironwolves', sport: 'football', leagueId: 'football_national', name: 'Ironclad Wolves', city: 'Cleargate', colorPrimary: 0x27272a, colorSecondary: 0xf87171, prestige: 75 },
  { id: 'f_grenadiers', sport: 'football', leagueId: 'football_national', name: 'Kingsford Grenadiers', city: 'Kingsford', colorPrimary: 0x581c87, colorSecondary: 0xfbbf24, prestige: 71 },
  { id: 'f_riptide', sport: 'football', leagueId: 'football_national', name: 'Harborside Riptide', city: 'Veldova Bay', colorPrimary: 0x065f46, colorSecondary: 0xffffff, prestige: 67 },
  { id: 'f_outlaws', sport: 'football', leagueId: 'football_national', name: 'Summit Outlaws', city: 'Summit Hills', colorPrimary: 0xb45309, colorSecondary: 0x111827, prestige: 62 },
  { id: 'f_sentinels', sport: 'football', leagueId: 'football_national', name: 'Ashford Sentinels', city: 'Ashford', colorPrimary: 0x1f2937, colorSecondary: 0x38bdf8, prestige: 58 },
];

export const TEAM_BY_ID: Record<string, AthleteTeamDef> = Object.fromEntries(ATHLETE_TEAMS.map((t) => [t.id, t]));
export const LEAGUE_BY_ID: Record<string, AthleteLeagueDef> = Object.fromEntries(ATHLETE_LEAGUES.map((l) => [l.id, l]));

export function teamsInLeague(leagueId: string): AthleteTeamDef[] {
  return ATHLETE_TEAMS.filter((t) => t.leagueId === leagueId);
}

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

export interface InjuryTypeDef {
  id: string;
  name: string;
  minSeverity: number;
  maxSeverity: number;
  minWeeks: number;
  maxWeeks: number;
  sports: AthleteSport[];
}

export const INJURY_TYPES: InjuryTypeDef[] = [
  { id: 'hamstring_strain', name: 'Hamstring Strain', minSeverity: 2, maxSeverity: 5, minWeeks: 1, maxWeeks: 4, sports: ['soccer', 'football', 'running'] },
  { id: 'ankle_sprain', name: 'Ankle Sprain', minSeverity: 2, maxSeverity: 6, minWeeks: 1, maxWeeks: 6, sports: ['soccer', 'football', 'running'] },
  { id: 'knee_sprain', name: 'Knee Sprain', minSeverity: 3, maxSeverity: 7, minWeeks: 2, maxWeeks: 8, sports: ['soccer', 'football', 'running'] },
  { id: 'acl_tear', name: 'ACL Tear', minSeverity: 8, maxSeverity: 10, minWeeks: 30, maxWeeks: 52, sports: ['soccer', 'football'] },
  { id: 'concussion', name: 'Concussion', minSeverity: 4, maxSeverity: 8, minWeeks: 1, maxWeeks: 6, sports: ['soccer', 'football'] },
  { id: 'shoulder_dislocation', name: 'Shoulder Dislocation', minSeverity: 4, maxSeverity: 7, minWeeks: 3, maxWeeks: 10, sports: ['football'] },
  { id: 'fractured_bone', name: 'Fractured Bone', minSeverity: 5, maxSeverity: 9, minWeeks: 6, maxWeeks: 16, sports: ['soccer', 'football', 'running'] },
  { id: 'stress_fracture', name: 'Stress Fracture', minSeverity: 3, maxSeverity: 6, minWeeks: 4, maxWeeks: 12, sports: ['running'] },
  { id: 'achilles_tear', name: 'Achilles Tendon Tear', minSeverity: 7, maxSeverity: 10, minWeeks: 20, maxWeeks: 40, sports: ['soccer', 'football', 'running'] },
  { id: 'groin_strain', name: 'Groin Strain', minSeverity: 2, maxSeverity: 5, minWeeks: 1, maxWeeks: 5, sports: ['soccer', 'football'] },
  { id: 'shin_splints', name: 'Shin Splints', minSeverity: 1, maxSeverity: 4, minWeeks: 1, maxWeeks: 3, sports: ['running'] },
  { id: 'plantar_fasciitis', name: 'Plantar Fasciitis', minSeverity: 2, maxSeverity: 5, minWeeks: 2, maxWeeks: 6, sports: ['running'] },
  { id: 'muscle_pull', name: 'Muscle Pull', minSeverity: 1, maxSeverity: 4, minWeeks: 1, maxWeeks: 3, sports: ['soccer', 'football', 'running'] },
  { id: 'meniscus_tear', name: 'Meniscus Tear', minSeverity: 5, maxSeverity: 8, minWeeks: 6, maxWeeks: 14, sports: ['soccer', 'football', 'running'] },
  { id: 'wrist_fracture', name: 'Wrist Fracture', minSeverity: 3, maxSeverity: 6, minWeeks: 4, maxWeeks: 8, sports: ['football'] },
];
export const INJURY_BY_ID: Record<string, InjuryTypeDef> = Object.fromEntries(INJURY_TYPES.map((i) => [i.id, i]));

// ---------------------------------------------------------------------------
// Training programs
// ---------------------------------------------------------------------------

export interface TrainingProgramDef {
  id: string;
  name: string;
  sport: AthleteSport;
  attrId: string; // which attribute this program builds
  cost: number; // yearly cost
  gain: number; // base attribute points gained per year at full effort
  injuryRiskPct: number; // added to yearly injury-roll chance
}

function trainingPrograms(sport: AthleteSport, attrs: string[], names: string[]): TrainingProgramDef[] {
  return attrs.map((attrId, i) => ({
    id: `train_${sport}_${i}`,
    name: names[i],
    sport,
    attrId,
    cost: 800 + i * 150,
    gain: 6,
    injuryRiskPct: 1.5,
  }));
}

export const TRAINING_PROGRAMS: TrainingProgramDef[] = [
  ...trainingPrograms('soccer', Object.values(AA.soccer), ['Sprint Drills', 'Finishing Clinic', 'Vision & Passing', 'Ball Mastery', '1v1 Defending', 'Strength & Conditioning', 'Shot-Stopping Camp']),
  ...trainingPrograms('football', Object.values(AA.football), ['Speed Camp', 'Weight Room', 'Agility Ladder', 'Arm Strength Program', 'Precision Passing', 'Hands Drills', 'Blocking Sled Work', 'Tackling Technique', 'Film Study']),
  ...trainingPrograms('running', Object.values(AA.running), ['Sprint Mechanics', 'Explosive Starts', 'Endurance Base Building', 'Running Form Clinic', 'Mental Performance Coaching']),
];
export const TRAINING_BY_SPORT: Record<AthleteSport, TrainingProgramDef[]> = {
  soccer: TRAINING_PROGRAMS.filter((t) => t.sport === 'soccer'),
  football: TRAINING_PROGRAMS.filter((t) => t.sport === 'football'),
  running: TRAINING_PROGRAMS.filter((t) => t.sport === 'running'),
};
export const TRAINING_BY_ID: Record<string, TrainingProgramDef> = Object.fromEntries(TRAINING_PROGRAMS.map((t) => [t.id, t]));

// ---------------------------------------------------------------------------
// Endorsement brands
// ---------------------------------------------------------------------------

export interface EndorsementBrandDef {
  id: string;
  name: string;
  category: string;
  minOverall: number; // minimum overallRating to qualify
  baseValue: number; // annual value scales up from here with rating/fame
}

export const ENDORSEMENT_BRANDS: EndorsementBrandDef[] = [
  { id: 'end_apex_gear', name: 'Apex Sportswear', category: 'Apparel', minOverall: 55, baseValue: 40_000 },
  { id: 'end_voltcharge', name: 'VoltCharge Energy', category: 'Beverage', minOverall: 60, baseValue: 60_000 },
  { id: 'end_swiftfoot', name: 'SwiftFoot Cleats', category: 'Footwear', minOverall: 62, baseValue: 75_000 },
  { id: 'end_pulseband', name: 'PulseBand Wearables', category: 'Tech', minOverall: 58, baseValue: 50_000 },
  { id: 'end_ironline', name: 'IronLine Nutrition', category: 'Supplements', minOverall: 50, baseValue: 30_000 },
  { id: 'end_summit_auto', name: 'Summit Motors', category: 'Automotive', minOverall: 75, baseValue: 200_000 },
  { id: 'end_crestbank', name: 'Crestbank Financial', category: 'Finance', minOverall: 80, baseValue: 350_000 },
  { id: 'end_horizon_watch', name: 'Horizon Timepieces', category: 'Luxury', minOverall: 85, baseValue: 500_000 },
  { id: 'end_nova_telecom', name: 'Nova Telecom', category: 'Telecom', minOverall: 65, baseValue: 90_000 },
  { id: 'end_peakstream', name: 'PeakStream+', category: 'Media', minOverall: 70, baseValue: 120_000 },
];

// ---------------------------------------------------------------------------
// Running meets / championships (the running "calendar", played instead of a league season)
// ---------------------------------------------------------------------------

export interface RunningMeetDef {
  id: string;
  name: string;
  tier: 'local' | 'national' | 'international' | 'championship';
  prestige: number; // 0..100
  fieldSize: number; // AI competitors in the race
}

export const RUNNING_MEETS: RunningMeetDef[] = [
  { id: 'meet_local_open', name: 'Cleargate Open', tier: 'local', prestige: 20, fieldSize: 6 },
  { id: 'meet_regional', name: 'Veldova Regional Championships', tier: 'local', prestige: 35, fieldSize: 7 },
  { id: 'meet_national', name: 'National Athletics Championships', tier: 'national', prestige: 60, fieldSize: 8 },
  { id: 'meet_diamond', name: 'Grand Prix Circuit Meet', tier: 'international', prestige: 80, fieldSize: 8 },
  { id: 'meet_worlds', name: 'World Athletics Championships', tier: 'championship', prestige: 95, fieldSize: 8 },
  { id: 'meet_olympics', name: 'The Games', tier: 'championship', prestige: 100, fieldSize: 8 },
];
export const RUNNING_MEET_BY_ID: Record<string, RunningMeetDef> = Object.fromEntries(RUNNING_MEETS.map((m) => [m.id, m]));
