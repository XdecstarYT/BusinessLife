/**
 * Player-facing update log. Newest entry first. This is a condensed, patch-notes version of the
 * (much more detailed) developer Highlights in README.md — written for a player checking "what's
 * new", not for someone reading the codebase. Every future version should add one entry here,
 * same as it adds one to README's Highlights.
 *
 * Versioning: Major.Minor, starting at 1.0. A minor update (content batch, polish, one extension
 * to an existing system) bumps the decimal by 0.1 (1.0 → 1.1 → 1.2…). A major update (a brand-new
 * life path, a new core system, or a fundamental UI/engine change) rounds up to the next whole
 * number, e.g. 1.1 → 2.0 — the decimal resets to 0 regardless of where it was.
 */
export interface ChangelogEntry {
  version: string;
  title: string;
  bullets: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'V8.4',
    title: '200 More Features',
    bullets: [
      '60 new industries — semiconductors, longevity biotech, air taxis, deep-space mining and more',
      '50 new laws, from a living wage and land-value tax to a space defense command',
      '50 new daily moments while fast-forwarding through life',
      '30 new yearly life events with real choices — and 10 new achievements to unlock',
    ],
  },
  {
    version: 'V8.3',
    title: '300 New Features',
    bullets: [
      '92 new industries to build a business in, from fusion power to esports leagues',
      '70 new laws to pass, across taxation, labor, environment, tech, health and more',
      '70 new day-to-day moments while fast-forwarding through the years',
      '50 new yearly life events with real choices — and 20 new achievements to earn through them',
    ],
  },
  {
    version: 'V8.2',
    title: '3D Becomes Your Home Base',
    bullets: [
      'New games and loaded saves now spawn you right in the 3D City — it is the game, not a side view',
      'Drive the grid: tap 🚗 to hop in a car and cover the streets more than twice as fast',
      'Real actions inside buildings — take a case, cook a service, treat a patient or work out, right in the city',
      'A one-tap toggle switches your home base between the City and the classic Life feed',
    ],
  },
  {
    version: 'V8.1',
    title: 'The City Becomes a Street Grid',
    bullets: [
      'The 3D City is now a real street grid — blocks, avenues, sidewalks and crossings',
      'Buildings sit on blocks and rise by their level, so the skyline shows your progress',
      'Traffic and pedestrians drive and stroll the grid; a central plaza anchors the map',
    ],
  },
  {
    version: 'V8.0',
    title: 'Massive Expansion: Aviation, World Domination & a 3D Overhaul',
    bullets: [
      'New playable career — Aviation: fly real 3D routes as a pilot, from a Cessna to a superjumbo',
      'New endgame — World Domination: conquer every nation on a live, interactive 3D globe',
      'Conquered nations pay you yearly tribute, tying world power back into your fortune',
      'A graphics pass on every 3D scene — richer reflections and cleaner, cinematic glow',
    ],
  },
  {
    version: 'V7.3',
    title: 'Semantic Versioning',
    bullets: [
      'The Update Log now uses Major.Minor version numbers instead of a flat counter',
      'Minor updates bump the decimal (7.2 → 7.3); major updates round up to the next whole number',
    ],
  },
  {
    version: 'V7.2',
    title: 'In-Game Update Log',
    bullets: [
      'A "What\'s New" button on the main menu shows the full update history',
      'An Update Log screen in the in-game Activities sheet shows the same thing mid-life',
    ],
  },
  {
    version: 'V7.1',
    title: '200 New Features',
    bullets: [
      '60 new industries to build a business in, across every sector',
      '50 new laws you can pass through the legislature',
      '50 new day-to-day flavor moments while fast-forwarding',
      '40 new yearly life events with real choices and consequences',
    ],
  },
  {
    version: 'V7.0',
    title: 'Complete UI Overhaul',
    bullets: [
      'A whole new look: clean, minimal, monochrome with a single accent color',
      'Persistent sidebar navigation on tablet and desktop — everything one click away',
      'Smarter mobile Activities sheet with a Recents section and live search',
    ],
  },
  {
    version: 'V6.0',
    title: '3D Becomes Core Gameplay',
    bullets: [
      'Tap to interact in the HQ Tour, Political Chamber, and Exchange Floor',
      'Two new 3D minigames: Kitchen Service and Courtroom Trial',
      'Four new City Hub buildings: Courthouse, Restaurant, Hospital, Casino',
    ],
  },
  {
    version: 'V5.0',
    title: 'Supreme Court, Running Mates & Corporate Governance',
    bullets: [
      'A real multi-seat Supreme Court with confirmation votes and judicial review',
      'Pick a Running Mate for your campaigns',
      'Mutual-defense alliances and persistent trade agreements',
      'Company credit ratings, antitrust regulation, and shareholder activism',
    ],
  },
  {
    version: 'V4.0',
    title: 'Rival Empires, Prestige Vault & Two New Careers',
    bullets: [
      'Rival businesses that remember what you did to them and hold a grudge',
      'The Prestige Vault: permanent perks earned across lives',
      'New Legal Career — law school to the bench, with a playable Courtroom',
      'New Culinary Empire career path',
    ],
  },
  {
    version: 'V3.3',
    title: 'Real Manufacturing Capacity',
    bullets: ['Physical-goods companies now have to keep production capacity up with real demand'],
  },
  {
    version: 'V3.2',
    title: 'Supply Chain Buildings',
    bullets: ['The supply chain now has a real physical presence in the 3D City Hub'],
  },
  {
    version: 'V3.1',
    title: 'Better 3D, Mandatory Deployment, More Hustles',
    bullets: [
      'A 3D quality pass across the weaker scenes',
      'Deployed soldiers now have to actually show up for duty',
      'More ways to make money',
      'The UI pushed further toward the BitLife look',
    ],
  },
  {
    version: 'V3.0',
    title: 'The Dynamic World Engine',
    bullets: [
      'The world now remembers your rivalries and adapts to how you’ve played',
      'Personalized callback events based on your own history',
      'Industries build up real legacy as sectors evolve around you',
    ],
  },
  {
    version: 'V2.1',
    title: 'The Corporate Empire Layer',
    bullets: ['Acquisitions, a venture arm, new offices, factories, and ad campaigns for your companies'],
  },
  {
    version: 'V2.0',
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
    version: 'V1.1',
    title: 'UI Upgrade + Defense Sector',
    bullets: [
      'The Life screen becomes a real dashboard with Story/Activities/Underworld/Legacy tabs',
      'The Activities sheet gets a live search box',
      'A new Defense & Aerospace industry sector, 16 businesses deep',
      '4 new product categories in the Studio',
    ],
  },
  {
    version: 'V1.0',
    title: 'Drug Empire',
    bullets: [
      'A full narcotics operation, independent of the mafia',
      '8 named products from weed to fentanyl, each with real risk',
      '3 upgradeable facilities, a street crew, and turf wars with rival dealers',
      'Real risk of stings, bad batches, raids, and prison time',
    ],
  },
];
