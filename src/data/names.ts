/**
 * Name generation data: people, companies, cities, parties, news outlets.
 * Everything is combinatorial so the pools are effectively unbounded.
 */
import type { RNG } from '../sim/rng';

export const FIRST_NAMES_M = [
  'James', 'Liam', 'Noah', 'Oliver', 'Ethan', 'Lucas', 'Mason', 'Henry', 'Alexander', 'Daniel',
  'Marcus', 'Victor', 'Sebastian', 'Adrian', 'Felix', 'Hugo', 'Leon', 'Oscar', 'Theo', 'Julian',
  'Rafael', 'Diego', 'Mateo', 'Andres', 'Carlos', 'Kenji', 'Hiro', 'Takeshi', 'Wei', 'Jin',
  'Arjun', 'Ravi', 'Sanjay', 'Omar', 'Karim', 'Tariq', 'Kwame', 'Sipho', 'Dmitri', 'Nikolai',
  'Stefan', 'Lars', 'Erik', 'Magnus', 'Piotr', 'Janusz', 'Giovanni', 'Lorenzo', 'Antoine', 'Pierre',
];

export const FIRST_NAMES_F = [
  'Olivia', 'Emma', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
  'Clara', 'Elena', 'Nadia', 'Iris', 'Freya', 'Astrid', 'Ingrid', 'Camille', 'Margaux', 'Chiara',
  'Lucia', 'Valentina', 'Gabriela', 'Rosa', 'Mariana', 'Yuki', 'Sakura', 'Mei', 'Lin', 'Priya',
  'Ananya', 'Zara', 'Leila', 'Amara', 'Nia', 'Zola', 'Anya', 'Katya', 'Vera', 'Milena',
  'Hanna', 'Sofia', 'Alma', 'Ebba', 'Agnes', 'Beatrice', 'Aurora', 'Celeste', 'Danielle', 'Simone',
];

export const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor',
  'Novak', 'Kovacs', 'Petrov', 'Ivanov', 'Volkov', 'Silva', 'Santos', 'Costa', 'Rossi', 'Ferrari',
  'Moreau', 'Dubois', 'Lefevre', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Larsen', 'Nielsen',
  'Berg', 'Lindqvist', 'Tanaka', 'Sato', 'Nakamura', 'Chen', 'Wang', 'Zhang', 'Patel', 'Sharma',
  'Khan', 'Haddad', 'Mensah', 'Okafor', 'Dlamini', 'Kowalski', 'Nagy', 'Papadopoulos', 'Kim', 'Nguyen',
  'Vance', 'Sterling', 'Ashford', 'Whitmore', 'Caldwell', 'Hargrove', 'Ellington', 'Sinclair', 'Mercer', 'Blackwood',
];

const COMPANY_PREFIX = [
  'Apex', 'Nova', 'Summit', 'Vertex', 'Atlas', 'Meridian', 'Pinnacle', 'Zenith', 'Aurora', 'Titan',
  'Horizon', 'Quantum', 'Sterling', 'Crown', 'Global', 'United', 'Pacific', 'Northern', 'Continental', 'Imperial',
  'Blue Harbor', 'Ironwood', 'Silverline', 'Brightpath', 'Clearwater', 'Redstone', 'Goldleaf', 'Stonebridge', 'Fairview', 'Kingfisher',
  'Vanguard', 'Pioneer', 'Frontier', 'Cascade', 'Everest', 'Polaris', 'Orion', 'Helios', 'Nimbus', 'Solstice',
];

const COMPANY_SUFFIX_BY_SECTOR: Record<string, string[]> = {
  default: ['Group', 'Holdings', 'Corporation', 'Industries', 'Partners', 'Co.', 'International', 'Enterprises'],
  Technology: ['Systems', 'Labs', 'Technologies', 'Digital', 'Software', 'AI', 'Networks', 'Dynamics'],
  Finance: ['Capital', 'Financial', 'Trust', 'Asset Management', 'Securities', 'Bank', 'Ventures', 'Equity'],
  Retail: ['Retail', 'Stores', 'Trading Co.', 'Market', 'Outfitters', 'Emporium', 'Brands', 'Goods'],
  Energy: ['Energy', 'Power', 'Resources', 'Petroleum', 'Renewables', 'Grid', 'Fuels', 'Utilities'],
  Media: ['Media', 'Studios', 'Broadcasting', 'Press', 'Entertainment', 'Pictures', 'Publishing', 'Network'],
  Industrial: ['Manufacturing', 'Works', 'Industrial', 'Fabrication', 'Engineering', 'Machinery', 'Steel', 'Foundry'],
  Transport: ['Logistics', 'Transport', 'Freight', 'Lines', 'Shipping', 'Express', 'Carriers', 'Mobility'],
  Health: ['Health', 'Medical', 'Biosciences', 'Therapeutics', 'Care', 'Pharma', 'Clinics', 'Life Sciences'],
  Food: ['Foods', 'Kitchens', 'Provisions', 'Farms', 'Beverage Co.', 'Hospitality', 'Dining Group', 'Table'],
  Property: ['Properties', 'Realty', 'Developments', 'Estates', 'Land Co.', 'Construction', 'Builders', 'Urban'],
};

export function makeCompanyName(rng: RNG, sector: string, founderLastName?: string): string {
  const suffixes = COMPANY_SUFFIX_BY_SECTOR[sector] ?? COMPANY_SUFFIX_BY_SECTOR.default;
  const roll = rng.next();
  if (founderLastName && roll < 0.25) {
    return `${founderLastName} ${rng.pick(suffixes)}`;
  }
  if (roll < 0.6) {
    return `${rng.pick(COMPANY_PREFIX)} ${rng.pick(suffixes)}`;
  }
  // Invented brandable word
  const a = ['Ver', 'Lum', 'Nex', 'Cor', 'Zen', 'Alt', 'Omn', 'Str', 'Kin', 'Vol', 'Bry', 'Fen'];
  const b = ['ia', 'ora', 'exa', 'ion', 'ara', 'eon', 'ova', 'ix', 'ance', 'era', 'yne', 'ade'];
  return `${rng.pick(a)}${rng.pick(b)}${rng.next() < 0.4 ? ' ' + rng.pick(suffixes) : ''}`.trim();
}

export function makePersonName(rng: RNG, gender: 'male' | 'female'): string {
  const first = gender === 'male' ? rng.pick(FIRST_NAMES_M) : rng.pick(FIRST_NAMES_F);
  return `${first} ${rng.pick(LAST_NAMES)}`;
}

export const NEWS_OUTLETS = [
  'The National Ledger', 'Daily Meridian', 'The Capital Times', 'Beacon News', 'The Morning Wire',
  'Financial Observer', 'The Sentinel', 'Metro Herald', 'The Tribune', 'Public Record',
  'MarketWatch Daily', 'The Chronicle', 'Liberty Press', 'The Examiner', 'Continental Post',
];

export const PARTY_NAME_PARTS: { adjectives: string[]; nouns: string[] } = {
  adjectives: [
    'National', 'Democratic', 'Progressive', 'Liberal', 'Conservative', 'Social', 'United', 'Free',
    'Republican', 'Popular', 'Civic', 'Green', 'Labor', 'Reform', 'Patriotic', 'Independent',
  ],
  nouns: ['Party', 'Alliance', 'Union', 'Movement', 'Front', 'Coalition', 'League', 'Forum'],
};

export function makePartyName(rng: RNG): string {
  return `${rng.pick(PARTY_NAME_PARTS.adjectives)} ${rng.pick(PARTY_NAME_PARTS.nouns)}`;
}

// City name generation: prefix + suffix combinations plus standalone names.
const CITY_STEMS = [
  'Ash', 'Brook', 'Clear', 'Dun', 'East', 'Fair', 'Glen', 'Hale', 'Iron', 'Kings',
  'Lake', 'Mill', 'North', 'Oak', 'Pine', 'Queens', 'Ridge', 'Stone', 'Thorn', 'West',
  'Silver', 'Gold', 'Green', 'High', 'Low', 'New', 'Old', 'Port', 'Fort', 'Grand',
];
const CITY_ENDS = [
  'ford', 'haven', 'field', 'burg', 'ton', 'mouth', 'bridge', 'wood', 'gate', 'view',
  'crest', 'dale', 'moor', 'stead', 'port', 'shire', 'castle', 'brook', 'landing', 'harbor',
];

export function makeCityName(rng: RNG): string {
  return `${rng.pick(CITY_STEMS)}${rng.pick(CITY_ENDS)}`;
}

export function makeStateName(rng: RNG): string {
  const bases = [
    'Aravon', 'Belmara', 'Corvale', 'Delmont', 'Esteria', 'Farland', 'Grenholm', 'Halvora',
    'Ithaca', 'Jorvik', 'Kestrel', 'Lorane', 'Meridia', 'Norwick', 'Ostara', 'Pellamy',
    'Quinlan', 'Rosemont', 'Solvane', 'Tremont', 'Umbria', 'Valdora', 'Westmark', 'Yorland',
  ];
  return rng.pick(bases);
}
