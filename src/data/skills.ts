/**
 * Skill catalogue: 10 categories x 12 skills = 120 skills.
 * Skills gate event outcomes, job promotions, business performance and
 * political effectiveness. Each industry names a primary skill.
 */
export interface SkillDef {
  id: string;
  name: string;
  category: string;
}

const CATALOG: Record<string, string[]> = {
  Business: [
    'Management', 'Negotiation', 'Accounting', 'Marketing', 'Sales', 'Operations',
    'Strategy', 'Recruiting', 'Supply Chains', 'Branding', 'Customer Service', 'Fundraising',
  ],
  Finance: [
    'Investing', 'Trading', 'Valuation', 'Risk Management', 'Banking', 'Venture Capital',
    'Real Estate', 'Derivatives', 'Forex', 'Auditing', 'Tax Planning', 'Corporate Finance',
  ],
  Politics: [
    'Public Speaking', 'Campaigning', 'Coalition Building', 'Policy Design', 'Diplomacy', 'Debate',
    'Lobbying', 'Spin Control', 'Grassroots Organizing', 'Legislative Procedure', 'Statecraft', 'Intelligence',
  ],
  Technology: [
    'Programming', 'Data Science', 'AI Engineering', 'Cybersecurity', 'Product Design', 'Systems Architecture',
    'Robotics', 'Biotech Methods', 'Aerospace Engineering', 'Cryptography', 'Networking', 'Hardware Design',
  ],
  Social: [
    'Charm', 'Networking People', 'Persuasion', 'Empathy', 'Leadership', 'Mentoring',
    'Conflict Resolution', 'Etiquette', 'Storytelling', 'Humor', 'Reading People', 'Reputation Building',
  ],
  Media: [
    'Journalism', 'Broadcasting', 'Social Media', 'Public Relations', 'Film Production', 'Writing',
    'Photography', 'Editing', 'Interviewing', 'Documentary Making', 'Podcasting', 'Crisis Communication',
  ],
  Trades: [
    'Construction', 'Engineering', 'Farming', 'Mining Operations', 'Logistics', 'Manufacturing',
    'Electrical Work', 'Mechanics', 'Welding', 'Surveying', 'Quality Control', 'Safety Compliance',
  ],
  Knowledge: [
    'Economics', 'Law', 'Medicine', 'History', 'Statistics', 'Psychology',
    'Political Science', 'Foreign Languages', 'Geography', 'Philosophy', 'Research', 'Teaching',
  ],
  Lifestyle: [
    'Fitness', 'Cooking', 'Golf', 'Chess', 'Poker', 'Sailing',
    'Wine Tasting', 'Art Collecting', 'Meditation', 'Fashion Sense', 'Travel Planning', 'Gardening',
  ],
  Shadow: [
    'Street Smarts', 'Smuggling', 'Forgery', 'Money Laundering', 'Hacking', 'Surveillance',
    'Bribery', 'Extortion', 'Counterfeiting', 'Safecracking', 'Con Artistry', 'Evasion',
  ],
};

function toId(category: string, name: string): string {
  return `${category.toLowerCase()}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

export const SKILLS: SkillDef[] = Object.entries(CATALOG).flatMap(([category, names]) =>
  names.map((name) => ({ id: toId(category, name), name, category })),
);

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** Convenience ids used throughout data files (kept in one place to avoid typos). */
export const SK = {
  management: toId('Business', 'Management'),
  negotiation: toId('Business', 'Negotiation'),
  marketing: toId('Business', 'Marketing'),
  sales: toId('Business', 'Sales'),
  operations: toId('Business', 'Operations'),
  strategy: toId('Business', 'Strategy'),
  accounting: toId('Business', 'Accounting'),
  fundraising: toId('Business', 'Fundraising'),
  investing: toId('Finance', 'Investing'),
  trading: toId('Finance', 'Trading'),
  banking: toId('Finance', 'Banking'),
  realEstate: toId('Finance', 'Real Estate'),
  ventureCapital: toId('Finance', 'Venture Capital'),
  riskManagement: toId('Finance', 'Risk Management'),
  publicSpeaking: toId('Politics', 'Public Speaking'),
  campaigning: toId('Politics', 'Campaigning'),
  coalition: toId('Politics', 'Coalition Building'),
  policy: toId('Politics', 'Policy Design'),
  diplomacy: toId('Politics', 'Diplomacy'),
  debate: toId('Politics', 'Debate'),
  lobbying: toId('Politics', 'Lobbying'),
  spin: toId('Politics', 'Spin Control'),
  statecraft: toId('Politics', 'Statecraft'),
  programming: toId('Technology', 'Programming'),
  ai: toId('Technology', 'AI Engineering'),
  cybersecurity: toId('Technology', 'Cybersecurity'),
  robotics: toId('Technology', 'Robotics'),
  biotech: toId('Technology', 'Biotech Methods'),
  aerospace: toId('Technology', 'Aerospace Engineering'),
  charm: toId('Social', 'Charm'),
  leadership: toId('Social', 'Leadership'),
  persuasion: toId('Social', 'Persuasion'),
  journalism: toId('Media', 'Journalism'),
  socialMedia: toId('Media', 'Social Media'),
  pr: toId('Media', 'Public Relations'),
  film: toId('Media', 'Film Production'),
  construction: toId('Trades', 'Construction'),
  engineering: toId('Trades', 'Engineering'),
  farming: toId('Trades', 'Farming'),
  mining: toId('Trades', 'Mining Operations'),
  logistics: toId('Trades', 'Logistics'),
  manufacturing: toId('Trades', 'Manufacturing'),
  economics: toId('Knowledge', 'Economics'),
  law: toId('Knowledge', 'Law'),
  medicine: toId('Knowledge', 'Medicine'),
  research: toId('Knowledge', 'Research'),
  teaching: toId('Knowledge', 'Teaching'),
  foreignLanguages: toId('Knowledge', 'Foreign Languages'),
  poker: toId('Lifestyle', 'Poker'),
  fitness: toId('Lifestyle', 'Fitness'),
  cooking: toId('Lifestyle', 'Cooking'),
  golf: toId('Lifestyle', 'Golf'),
  chess: toId('Lifestyle', 'Chess'),
  sailing: toId('Lifestyle', 'Sailing'),
  wineTasting: toId('Lifestyle', 'Wine Tasting'),
  artCollecting: toId('Lifestyle', 'Art Collecting'),
  writing: toId('Media', 'Writing'),
  streetSmarts: toId('Shadow', 'Street Smarts'),
  moneyLaundering: toId('Shadow', 'Money Laundering'),
  bribery: toId('Shadow', 'Bribery'),
  hacking: toId('Shadow', 'Hacking'),
  evasion: toId('Shadow', 'Evasion'),
} as const;
