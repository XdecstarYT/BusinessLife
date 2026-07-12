/**
 * Player-facing update log. Newest entry first. This is a condensed, patch-notes version of the
 * (much more detailed) developer Highlights in README.md — written for a player checking "what's
 * new", not for someone reading the codebase. Every future version should add one entry here,
 * same as it adds one to README's Highlights.
 */
export interface ChangelogEntry {
  version: string;
  title: string;
  bullets: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'V59',
    title: '200 New Features',
    bullets: [
      '60 new industries to build a business in, across every sector',
      '50 new laws you can pass through the legislature',
      '50 new day-to-day flavor moments while fast-forwarding',
      '40 new yearly life events with real choices and consequences',
    ],
  },
  {
    version: 'V58',
    title: 'Complete UI Overhaul',
    bullets: [
      'A whole new look: clean, minimal, monochrome with a single accent color',
      'Persistent sidebar navigation on tablet and desktop — everything one click away',
      'Smarter mobile Activities sheet with a Recents section and live search',
    ],
  },
  {
    version: 'V57',
    title: '3D Becomes Core Gameplay',
    bullets: [
      'Tap to interact in the HQ Tour, Political Chamber, and Exchange Floor',
      'Two new 3D minigames: Kitchen Service and Courtroom Trial',
      'Four new City Hub buildings: Courthouse, Restaurant, Hospital, Casino',
    ],
  },
  {
    version: 'V56',
    title: 'Supreme Court, Running Mates & Corporate Governance',
    bullets: [
      'A real multi-seat Supreme Court with confirmation votes and judicial review',
      'Pick a Running Mate for your campaigns',
      'Mutual-defense alliances and persistent trade agreements',
      'Company credit ratings, antitrust regulation, and shareholder activism',
    ],
  },
  {
    version: 'V55',
    title: 'Rival Empires, Prestige Vault & Two New Careers',
    bullets: [
      'Rival businesses that remember what you did to them and hold a grudge',
      'The Prestige Vault: permanent perks earned across lives',
      'New Legal Career — law school to the bench, with a playable Courtroom',
      'New Culinary Empire career path',
    ],
  },
  {
    version: 'V54',
    title: 'Real Manufacturing Capacity',
    bullets: ['Physical-goods companies now have to keep production capacity up with real demand'],
  },
  {
    version: 'V53',
    title: 'Supply Chain Buildings',
    bullets: ['The supply chain now has a real physical presence in the 3D City Hub'],
  },
  {
    version: 'V52',
    title: 'Better 3D, Mandatory Deployment, More Hustles',
    bullets: [
      'A 3D quality pass across the weaker scenes',
      'Deployed soldiers now have to actually show up for duty',
      'More ways to make money',
      'The UI pushed further toward the BitLife look',
    ],
  },
  {
    version: 'V51',
    title: 'The Dynamic World Engine',
    bullets: [
      'The world now remembers your rivalries and adapts to how you’ve played',
      'Personalized callback events based on your own history',
      'Industries build up real legacy as sectors evolve around you',
    ],
  },
  {
    version: 'V50',
    title: 'The Corporate Empire Layer',
    bullets: ['Acquisitions, a venture arm, new offices, factories, and ad campaigns for your companies'],
  },
  {
    version: 'V49',
    title: '5 Mega Features',
    bullets: [
      'Entertainment Career — chase fame as an actor or musician',
      'Medical Career — med school through residency',
      'Cult/Movement Founder — build a following',
      'Space Program — train and fly real missions',
      'Prison Life — a deep incarceration arc',
    ],
  },
  {
    version: 'V48',
    title: 'UI Upgrade + Defense Sector',
    bullets: [
      'The Life screen becomes a real dashboard with Story/Activities/Underworld/Legacy tabs',
      'The Activities sheet gets a live search box',
      'A new Defense & Aerospace industry sector, 16 businesses deep',
      '4 new product categories in the Studio',
    ],
  },
  {
    version: 'V47',
    title: 'Drug Empire',
    bullets: [
      'A full narcotics operation, independent of the mafia',
      '8 named products from weed to fentanyl, each with real risk',
      '3 upgradeable facilities, a street crew, and turf wars with rival dealers',
      'Real risk of stings, bad batches, raids, and prison time',
    ],
  },
];
