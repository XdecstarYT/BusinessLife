# BusinessLife — Business & Politics Life Simulator

A deep, replayable life-simulation game about **business, politics and economics**, inspired by
BitLife, Democracy 4, Capitalism Lab and Victoria 3 — but designed to be easy to pick up and play on
your phone. Start at birth, grow up, take decisions, and advance time at your own pace: **Day**,
**Week**, or a full **Year**, letting a living world simulate forward around you. Build a business
empire, get rich on the markets, climb the political ladder to run the country — or all three.

Everything runs **entirely in your browser** by default, and every save is plain JSON you can export
and re-import — no account required to play. The simulation itself is fully offline; the two optional
online features (a global Leaderboard and real cloud-backed accounts, see Highlights below) are backed
by Supabase and degrade to a friendly "offline" state instead of affecting anything else if you have no
connection or choose not to sign in.

## Highlights

- **V8.3 — 300 new features.** A big content batch across every catalog the simulation draws
  from. **92 new industries** join the business catalog (now 515 strong), spanning fusion power,
  green hydrogen, eVTOL aircraft, esports leagues, data-center REITs, quant hedge funds, lab-grown
  meat and more — each with its own distinct economics. **70 new laws** are available in the
  legislature, covering a four-day work week, a digital services tax, right-to-repair, AI safety
  audits, universal healthcare, high-speed rail and dozens of other real policy levers with proper
  bloc support and industry effects. **70 new daily flavor moments** make fast-forwarding feel even
  more alive, and **50 new yearly life events** add fresh dilemmas — from running a marathon to
  leading a corporate turnaround to blowing the whistle on fraud. Woven through those events are
  **20 new achievements** (Angel Backer, Turnaround Artist, Marathoner, Whistleblower, Comeback Kid
  and more), each earnable by making the right call when the moment comes.

- **V8.2 — 3D becomes your home base.** The walkable 3D City stops being a screen you visit and
  becomes the place you *live*: new games and loaded saves now **spawn you directly in the City**
  (unless a decision is waiting, which still surfaces first), and a one-tap toggle on the Explore
  screen switches your home base between the City and the classic Life feed at any time — the choice
  persists across sessions. You can now **drive the grid**: a Drive/Walk button (🚗/🚶) drops you
  into a compact coupe that covers the streets at roughly **2.4× walking speed**, with a camera that
  pulls back to keep more road in view, spinning wheels, and cars that turn more deliberately than a
  person spins on the spot — all sharing the same joystick / WASD controls. And the buildings now do
  **real work**: walk up to the courthouse to **take a case**, the restaurant to **cook a service**,
  the hospital to **treat a patient**, or home to **work out** — each firing the same career
  simulation the dedicated screens use, right there in the city, whenever your career makes the
  action available.

- **V8.1 — The 3D City is now a real street grid.** The walkable Explore hub, which used to arrange
  its buildings on concentric rings around a plaza, is now laid out as a proper **city grid**:
  square blocks separated by a network of asphalt avenues with dashed centre lines, pale sidewalks,
  zebra crossings at the intersections, and a street lamp on every corner. Every building sits on
  its own block, and its **height still rises with its level/tier** — so a thriving empire visibly
  towers over a fledgling one across the skyline. The core life systems fill the central blocks and
  companies spiral outward; a central block is left open for the plaza and fountain. Ambient traffic
  now **drives the avenues** and pedestrians **stroll the sidewalks** (both wrapping along real grid
  streets rather than circling a ring road), with a freight railway looping the city's perimeter.

- **V8.0 — Massive expansion: a new playable career, a world-conquest endgame, and a 3D overhaul.**
  The biggest single update in a while, spanning four fronts. **Aviation** is a brand-new playable
  life path in the mould of the Athlete career: enroll in flight school, log hours toward your PPL,
  CPL and ATPL licenses, earn type ratings on six aircraft from a Cessna 172 up to an A380
  superjumbo, and climb from first officer to Chief Pilot — flying your routes yourself in a real
  playable 3D cockpit (`FlightScene`) where you take off, thread a course of waypoint rings through
  the sky, and grease the landing, with your performance feeding the sim (block hours, pay, and a
  three-strike safety-incident system that grounds you for good). **World Domination** is a true
  endgame meta-layer, unlocked once you're a billionaire, a head of state, or hugely influential:
  a live, interactive **3D globe** (`GlobeScene`) ringed with a glowing beacon per nation, where
  you project economic, political and soft power under a chosen doctrine to build influence against
  each nation's hostility, consolidate control, and win by bringing every country on Earth under
  your rule — and conquered nations pay **yearly tribute** into your fortune, wiring world power
  straight back into the economic empire. Under the hood, a **graphics pass on the shared 3D
  pipeline** (richer image-based lighting for metal/glass reflections, and a cleaner,
  higher-threshold bloom) lifts the look of every existing scene at once. Ten new achievements
  across the two systems.

- **V61 — The in-game Update Log switches to Major.Minor version numbers.** Instead of a flat
  per-session counter, `data/changelog.ts` entries are now versioned like `V1.0`, `V1.1`, `V2.0`
  — a minor update (content batch, polish, one extension to an existing system) bumps the decimal
  by 0.1, and a major update (a brand-new life path, a new core system, a fundamental UI/engine
  change) rounds up to the next whole number, decimal reset to 0. The existing 15 entries were
  renumbered under the new scheme, starting from `V1.0` at Drug Empire; every future entry follows
  the same rule from here on.

- **V60 — An in-game Update Log.** A new player-facing changelog (`data/changelog.ts`), condensed
  into scannable patch notes rather than developer prose, covering everything since V47 (Drug
  Empire) through the current version. Reachable two ways: a "🆕 What's New" button on the main
  menu opens it in a modal before you've even started a life, and an "Update Log" entry in the
  in-game Activities sheet's **You** group opens the same content as a full screen. Every future
  version adds one entry here, the same way it already adds one to this README's Highlights.

- **V59 — 200 new content features across the simulation.** 60 new industries spread across 12
  sectors (from craft marketplaces and vertical air taxis to direct air capture startups), each
  with its own startup cost, margin, volatility and skill tie-in; 50 new laws spanning Taxation,
  Labor, Environment, Business, Tech/Media, Social, Migration, Justice, Defense/Foreign,
  Infrastructure, Governance, Consumer, Trade and Agriculture, each with real effects on the
  economy and party-bloc support; 50 new daily flavor events for the fast-forward day/week
  advancement; and 40 new yearly event templates (life, career, business, market, politics,
  crime, world, media, family, health) with genuine choices, skill checks and branching outcomes
  — none of it special-cased by the engine, all of it drawn from the same catalogues every
  existing screen already reads from.

- **V58 — Complete UI overhaul: minimal, editorial, easy to navigate.** The entire visual
  language changed. The BitLife-green gradients, glow shadows, and rainbow icon tiles are gone,
  replaced by a monochrome surface with one sharp accent color (a single indigo, `--color-brand-*`
  in `index.css`) and a true-neutral gray/near-black scale for dark mode — flat cards, hairline
  borders, restrained typography, generous whitespace, in both light and dark themes. Because the
  whole app draws from the same CSS custom properties and the same shared primitives
  (`Card`/`Button`/`Pill`/`ListRow`/`CircleTile`/etc. in `components.tsx`), this cascaded to
  essentially every one of the ~30 screens without hand-editing each one. Navigation was
  restructured, not just restyled: on wider viewports (`lg:` and up) a persistent left sidebar
  lists every screen — pinned tabs plus all grouped activities, with its own search — so nothing
  is ever more than one click away and the old "open a sheet to find a screen" pattern disappears
  entirely on desktop. On narrower viewports the classic bottom tab bar and searchable, grouped
  Activities sheet remain, now with a localStorage-backed **Recents** section pinned above the
  groups so getting back to whatever you were just doing takes one tap instead of a search.

- **V57 — 3D becomes a core part of the game, not a backdrop.** A shared tap-to-interact
  facility landed in the 3D pipeline itself (`registerClickable`/`onPick` in the reusable scene
  hook — real raycasting that coexists with drag-to-rotate, distinguishing a tap from a rotate
  gesture) and now powers real gameplay in three previously-ambient scenes: the **HQ Tour**
  grows four clickable department kiosks (Marketing, R&D, Operations, Workforce) that pull the
  matching company lever directly from the 3D view; the **Political Chamber**'s cabinet podiums
  open a minister investigation or the appointment flow, and tapping a party's benches sends a
  quick donation; the **Exchange Floor**'s ticker booths jump straight into trading that stock.
  The walkable **City Hub** — the game's primary navigation surface — gained four new buildings
  (Courthouse, Restaurant, Hospital, Casino) so Legal, Culinary, Medical and Casino all now have
  real physical presence in the plaza, bringing it to fourteen system buildings plus the public
  company skyline. And two life-path systems got genuine 3D minigames: a **Kitchen Service**
  reaction game (tap the lit station — Prep, Grill, Plate — before it goes cold) and an upgraded
  **Courtroom Trial** (tap the witness stand or counsel tables as each lights up) — both feed a
  real accuracy score into a bonus success chance for that year's cook-service or case roll, so
  playing them well is a genuine shortcut, not just a score for its own sake. Two new
  achievements for a flawless round of either.

- **V56 — The biggest politics and business expansion yet.** Six substantial new systems, three
  per domain. In politics: a real multi-seat **Supreme Court** (up to nine justices with their own
  ideology and tenure) replaces the old single-Chief-Justice flavor field — nominate justices
  through a genuine confirmation vote, petition the bench to strike down a specific law, and watch
  judicial review itself skew toward whichever laws clash with the court's makeup as justices age,
  retire, and die over the years. Head-of-state campaigns can now name a **running mate**, whose
  own standing feeds a real bonus into the race and who's sworn in as VP (quietly building
  influence) on a win. Alliances finally have teeth: a **mutual-defense** clause automatically
  drags allied nations into a war the moment one member enters it, and bilateral **trade
  agreements** are now persistent pacts with an ongoing GDP and relations tailwind instead of a
  one-off nudge. In business: a **Credit Rating Agency** grades every company AAA through D from
  real leverage, profitability and cash runway, and that rating now prices new debt and corporate
  bonds. Sustained market dominance draws real **antitrust** scrutiny — settle for a fine or fight
  in court and risk a forced divestiture. And public companies can now face **shareholder
  activism**: an investor campaign demanding a dividend hike, buyback, CEO change or spin-off,
  which the player can concede to or resist in a contested proxy fight. Eight new achievements
  round it out.

- **V55 — The biggest expansion yet: Rival Empires, the Prestige Vault, and two new life
  paths.** Corporate rivals are no longer interchangeable — each grudge-holding competitor now
  gets assigned one of five **rival strategies** (Aggressive Expander, Price Warrior, Tech
  Innovator, Brand Builder, Talent Raider) based on how they actually run their company, shown as
  a badge on the Business screen, and it biases which sabotage attacks they favor plus unlocks
  five new strategy-flavored rival-clash events. A brand-new permanent meta-progression system,
  the **Prestige Vault**, converts each life's Legacy Score (plus bonuses for major achievements
  like Billionaire or holding office) into permanent Prestige Points banked across every future
  save; spend them once in a new perk shop for lasting starting-life bonuses — sharper stats,
  family savings, extra skill aptitudes, or a one-time **Guardian Angel** that survives an
  otherwise-fatal health scare. Two full new life paths join Medicine and Academia: a **Legal
  Career** (law school, joining a firm, taking cases, publishing law review articles, climbing to
  Named Partner, and — for the elite few — appointment to the bench as a judge) with its own
  ambient 3D **Courtroom** scene, and a **Culinary Empire** (starting as a line cook at 16,
  working up to Head Chef, then opening and growing your own restaurant and chasing Michelin
  stars across ten cuisines). Rounded out with six new daily flavor events and seventeen new
  achievements spanning all of the above.

- **V54 — Real manufacturing capacity vs. demand.** Physical-goods companies (retail,
  auto, consumer, industrial, food, agriculture, construction, defense, luxury, mining, energy,
  and other production-tagged industries — software, finance, and services are untouched) can no
  longer just will their revenue up to whatever the growth formula wants: a new
  **Manufacturing Capacity** stat, computed from real factories (V50's Corporate Empire) relative
  to the company's current scale, actually gates how much of a year's demand growth converts into
  revenue. Run hot without building capacity and the shortfall banks as a **demand backlog** — real
  unmet demand, shown in dollars, that decays as frustrated customers buy elsewhere, with a
  "customers are waiting on backorders" warning once it bites for two years running, and a
  reputation hit if it drags on for three or more. Build or automate factories and spare capacity
  first fulfills that year's growth, then chips away at any backlog — a factory investment finally
  showing up as recovered sales, not just a cash dividend. Two new achievements (Supply Chain
  Master, Back on Track) track keeping comfortably ahead of demand and recovering from a serious
  shortfall. Fully additive: non-physical industries and old saves behave exactly as before.

- **V53 — Supply-train buildings.** The "supply train" idea now has a real physical presence in
  both 3D scenes that touch supply chains. The ambient **Supply Chain Visualizer** (each company's
  detail screen) swaps its abstract primitives for small building silhouettes at every stage — a
  silo cluster, a smoking factory, a loading-dock warehouse, a port crane, a storefront, a house —
  and the flowing particles are now boxy little freight wagons riding the resilience-colored rail
  instead of glowing orbs. The walkable **City Hub** gains a rail-yard ring circling just past the
  plaza's edge: a gravel apron, a looping double rail on wooden ties, a trackside grain-silo cluster
  and freight warehouse with its own loading crane, and a four-car freight train (locomotive plus
  three liveried cargo cars) that continuously loops the track, headlight flaring after dark like
  the ambient traffic. The Docks building also picked up a stack of shipping containers to tie the
  theme together.

- **V52 — Better 3D, mandatory deployment, more hustles, and a deeper BitLife look.** Two of the
  weakest 3D scenes got a full quality pass: **Supply Chain** now casts real shadows off a grounded
  plane, glows from emissive pedestals under each stage, and routes goods through tube-geometry pipes
  colored live by supply-chain resilience (red → amber → green); **Election Map** swapped its flat bar
  chart for tapered spire monuments with glowing base rings around a central podium whose orb reflects
  your overall vote share. **Military deployment is no longer optional** — once you're deployed with a
  playable mission (ground, air, or armor), the year can't end via +1 Day/Week/Year until you fly it;
  the store gates all three time-advance actions and routes you straight to the Military screen with a
  clear warning, while the underlying yearly risk resolution still runs automatically for support
  roles and headless saves so nothing soft-locks. **Four new side hustles** round out the ways to make
  money outside a formal career or company: monetize your following, sign a multi-year sponsorship
  deal (a recurring income stream alongside memoirs), hold a garage sale, or busk for tips — plus a
  new Content Mogul achievement. And the UI leans further into its BitLife roots: stat bars now show a
  **reactive face** that swaps emoji by value (😭→😄 for Happiness, 💀→💪 for Health) instead of one
  static icon, and every activity-list row gets a colored icon badge in a deterministic per-item hue
  instead of a bare flat emoji.

- **V51 — The Dynamic World Engine: the world remembers you, adapts to you, and outlasts you.**
  Rival companies now hold a real, visible **grudge** (surfaced right on their card in Business →
  Rivals) driven by your actual history with them — a failed hostile takeover, a price war, a
  patent suit, corporate espionage, or a mob shakedown all leave a mark. A grudging rival is both
  more likely to retaliate and specifically the one who does, with headlines and personalized
  events (`{company}` resolves to the actual rival) calling out the beef by name — and you can
  buy peace or provoke it further from inside those events. **World Momentum** is a new
  self-relative score comparing your recent net-worth trajectory to your own longer-run trend —
  a real hot streak makes life more eventful (and riskier), a cold streak eases off — with its own
  edge-triggered headlines and callback events when the tide turns. **Industry Legacy** makes
  your economic footprint permanent: dominate an industry with real market share and patents and
  it keeps trending in your favor for years after you've sold up and moved on, gutting one leaves
  it depressed just as long. Three new achievements (Arch Nemesis, Momentum Rider, Industry
  Legend) track all of it.
- **V50 — The biggest business expansion yet: a Corporate Empire layer on top of every
  company.** **Friendly Acquisitions** let you buy out any private rival outright at a fair-value
  premium — no board vote, no contest, distinct from the existing hostile-takeover bid which stays
  reserved for public companies. An in-house **Venture Capital Arm** (once a company reaches
  Campus-tier HQ) turns company cash into a real startup portfolio: back small private rivals for
  a minority stake, watch them rise or fail alongside the rest of the simulated economy, and exit
  for a payout — or get auto-cashed-out if a portfolio company is later acquired or wiped out in
  bankruptcy. **International Expansion** opens foreign offices abroad that ramp up over several
  years into a genuine second revenue stream, riding that country's own GDP growth. **Manufacturing**
  adds physical factories — domestic or, once an office is open there, foreign — with upgradeable
  automation (5 levels) that raises their ongoing output dividend. And structured **Advertising
  Campaigns** across 5 channels (TV, Social, Influencer, Billboards, Guerrilla) commit a real
  multi-year budget for a brand payoff, with a genuine chance of going viral or backfiring into a
  PR disaster depending on the channel. All five systems are additive to the existing financial
  model — they layer new revenue/cost streams on top of tickCompany() rather than touching its
  tuning — and come with 9 new achievements, from Acquisition King to Mega Corp.
- **V49 — A massive expansion: 5 new mega features.** **Entertainment Career** lets you chase
  fame as an actor or musician — train your craft, audition for roles or pitch albums at
  budget tiers gated by fame (Indie through Franchise Tentpole), sign an agent who takes a cut,
  go on tour, court controversy for a risky publicity spike, and win real awards (Best Picture,
  Album of the Year, Lifetime Achievement) at a yearly ceremony. **Medical Career** takes you
  through med school, a residency match into one of 10 specialties (General Practice through
  Surgery, each with its own difficulty and malpractice risk), and a full attending career
  treating patients, publishing research, and climbing from Attending Physician to Medical
  Director — a bad outcome risks a real malpractice suit, and three strikes costs you your
  license. **Cult/Movement Founder** lets you found your own following: recruit believers, hold
  gatherings, collect donations, and expand a compound — or embezzle the collection plate
  straight into dirty money, at the cost of rising suspicion that can end in an authorities raid.
  **Space Program** puts you through astronaut training at a national or private agency, flying
  orbital, station, lunar, and Mars missions that carry genuine fatality risk — a failed mission
  ends the game for real, the same permadeath pattern established by V46's combat deaths.
  **Prison Life** deepens incarceration itself: join a cellblock gang, fight for yard respect,
  smuggle and trade contraband, start a riot, bribe a guard, or snitch for time off — all folded
  directly into the existing "In Prison" card rather than a separate screen, since jail is a
  state you're in, not a career you navigate to. 39 new achievements track all five arcs.
- **V48 — A major UI upgrade and a business expansion: a new Defense sector and 4 new product
  categories.** The Life screen — which had grown into one enormous scroll as system after system
  landed on it — is now a real dashboard: a sticky **Story / Activities / Underworld / Legacy**
  tab bar groups bucket list & social media, lifestyle activities & pets & lottery, crime family &
  Drug Empire & Casino, and legacy & Mind & Body into focused views instead of one endless feed.
  The Activities sheet (every other screen) now has a live **search box** that filters across all
  groups instantly, and the vice-heavy screens (Athlete, Military, Drug Empire, Casino) got pulled
  into their own **Play** category instead of being mixed in with core navigation. On the business
  side, a brand-new **Defense & Aerospace** industry sector arrives with 16 named businesses —
  from a Small Arms Manufacturer and Ammunition Plant up through a Naval Shipyard, Submarine
  Manufacturer, and Fighter Jet Manufacturer — a natural fit alongside the Military Service career.
  The Studio also gains **4 new product categories** you can design and launch: Pet Tech &
  Accessories, Baby & Kids Gear, Outdoor & Camping Gear, and Office & Stationery, each with their
  own parts, materials, and component supply chain, fully playable in the 3D design viewport.
- **V47 — Drug Empire: a full narcotics operation, independent of the mafia.** Start slinging on
  the corner and build a real business across 8 named products (weed through fentanyl, each with
  its own wholesale cost, street price, addictiveness, and overdose risk) gated by street
  reputation. Three independently upgradeable facility tracks — a Stash House for capacity, a
  Grow House that produces free weed every year, and a Meth Lab that produces free meth and
  unlocks sourcing the hardest tier — turn a one-man hustle into a real operation. Hire a street
  crew to move product passively while you're doing other things, fight rival dealers for turf,
  cut a batch to stretch your supply at real risk, and bribe a cop when the heat gets too high.
  It's real independent of joining a CrimeFamily (see below) but synergizes with one if you're in
  it. Every sale is genuine risk: undercover buy-busts and stings can end in real prison time, a
  bad batch can overdose a customer and blow up your reputation overnight, and a raid can gut your
  stash, your facilities, and your crew in one year — dirty proceeds land in the same
  launder-before-you-spend pipeline as heists and rackets. 11 new achievements track the whole
  arc, from your first sale to walking away a made narco baron.
- **V46 — Suicide, the wartime draft, real permadeath in combat, boot camp, a third war engine,
  and battlefield terrain.** A somber but real BitLife-standard feature: a confirm-gated
  **Suicide** button under Mind & Body that ends the life immediately, with its own honest cause
  of death on the game-over screen. War now reaches out and grabs you even if you never enlist —
  while your country is at war, especially under a National Service Act, you have a real yearly
  chance of being **drafted**, sent straight into uniform without a choice (and without boot
  camp — you don't get one when you're conscripted). Combat is now genuinely lethal: getting
  overrun in a playable mission carries a real death chance that scales against your combat
  skill, not just an injury, and that death is reported immediately — the game ends right then,
  not on the next Age Up. Volunteers, by contrast, have to earn their spot: enlisting now routes
  through a real playable 3D **Boot Camp obstacle course** — clear a hurdle, climb a wall, crawl
  under netting, and hold your balance on a beam — and washing out sends you back to try again
  instead of guaranteeing a spot. The Military career also gets a third playable **war engine**,
  **Armor Combat** — traverse a tank turret and fire on advancing enemy vehicles with a slow,
  weighty main-gun reload — alongside real **war terrain**: Ground, Air, and Armor missions now
  render desert, urban, jungle, or arctic battlefields depending on which theater you're actually
  deployed to.
- **V45 — Two playable 3D combat engines: Ground Combat and Air Combat.** Deployed soldiers with a
  combat specialty no longer just resolve missions on a menu — they fight them. Infantry, armor,
  artillery, special forces, combat medics, snipers and more drop into a real 3D **Ground Combat**
  mission: aim a reticle across three lanes with a draggable joystick or A/D keys, fire on hostiles
  closing in on your position before they overrun you, and take real damage for every enemy left
  unengaged. Pilots and naval aviators instead fly a full 3D **Air Combat** dogfight: a two-axis
  joystick (or WASD) tracks incoming bogeys against an open sky, with the same fire-and-survive
  loop. Both engines feed their outcome — hostiles eliminated, damage taken, survival — straight
  into the existing military sim: accuracy drives combat-skill growth, a clean sweep has a real
  chance at heroism and a medal, and a bad mission can mean a wound, a permanent disability rating,
  or worse. Built on the same shared three.js pipeline as the game's other playable sports scenes,
  with full mobile joystick support, landscape-lock fullscreen, and a live in-mission HUD.
- **V44 — Military Service: a whole new career, enlist to discharge.** A brand-new life path with
  ~150 new pieces of content: pick from 6 branches (Army, Navy, Air Force, Marines, Coast Guard,
  Space Force) and 20 specialties from Infantry to Special Forces to Cyber Operations, climb a
  9-rank enlisted ladder with real pay at each grade, and train across 12 real programs (Ranger
  School, Officer Candidate School, SERE, and more). Deployment ties directly into the game's real
  geopolitical war system — you can only deploy while your country is actually at war, and against
  whichever nation that really is. Once deployed, missions are resolved with genuine risk: 12 injury
  types (some permanent, driving a VA disability rating), a real death chance, and a stack of 20
  medals and decorations up to the Medal of Honor. And there's a real moral choice every deployed
  year — **Act Heroically** risks yourself for reputation, karma and a shot at a medal; **Cross the
  Line** trades your discipline and karma for a payout, with mounting court-martial risk that can end
  in a dishonorable discharge. Discharge (honorable, medical, general, or dishonorable) pays a real
  veteran's pension based on years served and disability rating. 20 new achievements track the arc,
  from first enlistment to Medal of Honor to Fallen Hero.
- **V43 — juice: every action feels like it landed.** A whole pass of moment-to-moment feedback on
  top of existing systems, not new content: achievements now unlock with a genuine **gold "Achievement
  Unlocked" toast** and a confetti burst the instant they happen — 130+ of them were unlockable
  silently before, discoverable only by digging into the Stats screen. The Year in Review modal now
  **counts your net worth up** from where the year started instead of snapping to the final number,
  and bursts confetti of its own on a genuinely big year. The AGE button gets a satisfying tap ripple,
  and your bank balance in the header **flashes green or red** for a beat whenever it moves. Small,
  but it's the difference between a spreadsheet updating and a game reacting to you.
- **V35-39 — Athlete Career: real playable 3D soccer, football and running.** A whole new life
  path alongside Career/Business/Politics: pick soccer, (American) football or running, train up a
  full attribute set, sign with one of 22 named teams across 3 leagues (or chase a calendar of
  running meets up to the Games), earn contracts and endorsement deals, and manage real injuries,
  fitness, form and morale across a full career arc through retirement (and a Hall of Fame ribbon
  for the best of them). The matches and races aren't simulated for you — they're genuinely
  **playable, real-time 3D minigames**: a 4-a-side soccer match with WASD/joystick movement and a
  charge-and-release pass/shoot button against AI teammates and opponents; a down-by-down football
  drive where you call Run or Pass and then execute it yourself, throwing to receivers running real
  routes against a real pass rush; and a running race where pacing — when to burn your stamina
  sprinting versus conserving it — is the actual skill, not button-mashing. Every match/race result
  feeds real career stats, league standings, and money back into the life sim.
- **V41 — the athlete world evolves on its own.** The soccer/football league world is no longer a
  static backdrop: every year, regardless of whether you've ever picked up a ball this life, all 22
  teams' results are simulated, team **prestige** drifts toward how they actually performed (a big
  season nudges it up, a bad one drags it down), and a transfer window occasionally swings a team's
  fortunes with a marquee signing or a lost star player. Soccer's two tiers now **promote and
  relegate** at each season's end based on real final standings — and if your own team goes up or
  down, your career follows it, with a fresh schedule against the new tier's opponents. All of it
  generates real headlines in a new **Sports** category on the News screen, so the league feels alive
  even when you're not the one playing in it.
- **V42 — the wider world was already alive, now you can actually see it.** Every one of the 12
  countries' economies has always cycled through real boom/recession/depression regimes on its own,
  and NPC companies have always merged, IPO'd and gone bankrupt without your involvement — but almost
  none of it ever reached the News feed unless it happened to your home country or your own company.
  Now a foreign nation tipping into recession, roaring into a boom, or getting hit by a climate
  disaster or a debt crisis shows up as a flagged **Economy** headline the moment it happens, and an
  NPC-only company going under generates a real bankruptcy headline too — so the rest of the world
  visibly keeps moving, growing and occasionally collapsing, whether or not you're watching it.
- **V34 — real accounts, a life that starts at birth, and a bigger, more BitLife life.** Sign up with
  email + password (Supabase Auth) to back your life up to the cloud — up to 5 named cloud saves per
  account, managed from a new account panel on the main menu — entirely optional; local play needs no
  account at all. New games now start at **age 0** instead of 18: a newborn's stats begin near zero and
  build up through a guaranteed skeleton of childhood milestones (first steps, first words,
  kindergarten, losing teeth, starting school) plus dozens of new age-gated childhood flavor events and
  daily vignettes, while grown-up-only actions (founding a company, marrying, the casino floor, taking
  out a loan, joining a crime family, and more) are cleanly locked until the right age. The Activities
  sheet was rebuilt as a proper BitLife-style grouped list — navy header, gray category dividers,
  icon + bold title + subtitle rows — and six new activities/actions arrived: the **Zoo** and **Movie
  Theater** (all-ages lifestyle outings), **Nightlife** (18+ clubbing with real upside/downside
  outcomes), a **Fertility Clinic** (a real, sometimes-unsuccessful single-parent path to a child, no
  spouse required), a personal **lawsuit** system (sue anyone in your relationship register for a real
  settlement or a real loss), and a **legal Identity** panel to change your name or gender marker.
- **V33 — the fun-and-addictive update: ribbons, bucket lists, pets, and the lottery.** Every
  completed life now ends with a **ribbon** — one of 24 BitLife-style life-summary awards (Legend,
  Kingpin, Centenarian, Saint, Jailbird, Best Friend…) picked by priority from how you actually
  lived — and the collection persists across lives in a Ribbon Cabinet on the main menu, with
  unearned ribbons shown as ??? mystery slots. Every new life rolls a six-goal **bucket list**
  (from a 14-goal pool with random difficulty tiers) checked yearly with real cash/happiness
  payouts, an achievement for clearing the whole list, and a dedicated ribbon. **Pets** are now a
  real system: adopt up to four (dog, cat, parrot, horse, snake, goldfish), play yearly to build
  bond, pay upkeep and surprise vet bills — companionship boosts happiness in proportion to bond,
  loyal pets occasionally come through with heroics or found treasure, and when they die the grief
  scales with how close you were. And the **lottery**: instant-result tickets and scratch cards
  with realistic terrible odds, yearly purchase caps against spam, and a $2M jackpot that feeds a
  Jackpot Winner achievement and ribbon.
- **V32 — the BitLife look.** The app chrome now mirrors the BitLife layout it was always inspired
  by: a flat signature-green header banner (identity left, bank balance right), a persistent
  😊❤️🧠😎 Happiness/Health/Smarts/Charisma stat strip pinned above the tab bar, and a five-slot
  bottom bar whose center is the big raised circular **+AGE** button that advances the year from
  anywhere (Job · Assets · AGE · Relations · Activities, with the Activities sheet holding every
  other screen two taps away). The Life screen was rebuilt as the classic chronological life-log
  feed — plain text entries grouped under bold "Age N" headers, newest chapter first — with
  day/week time controls in a compact age ribbon. The whole brand palette swapped from blue to
  BitLife green in one token change.
- **V31 — design-system overhaul + a bigger, livelier city.** The whole UI moved to a layered
  design language in one pass by overhauling the shared primitives every screen is built from:
  two-level ambient/contact elevation on cards with hover lift, gradient primary/danger buttons with
  glow shadows and press-scale feedback, spring bottom-sheet modals with grab handles and close
  buttons, one-shot sheen sweeps on stat bars, accent-tick section headers, a glass top bar and
  bottom nav with a springy floating active-tab indicator, per-screen entrance transitions, tabular
  numerals everywhere, and `prefers-reduced-motion` support. The 3D city grew ~27% in radius (with a
  faster walk speed to match) and got a realism pass: articulated pedestrians with counter-phase
  arm/leg walk cycles, construction cranes that slowly slew over their sites with a swinging load,
  car headlights that flare after dark, drifting clouds, circling birds with flapping wings, zebra
  crossings at the compass points, a tree green-belt between the plaza and the skyline, and a second
  lamp ring — plus the skyline cap raised to 32 public companies.
- **V30 — the city is alive: every public company gets a real skyline building.** Explore's plaza now
  renders a second, outer skyline ring beyond the ten fixed system buildings — one procedurally-built
  tower per publicly-listed company in your home country (banded and capped so the ring stays readable
  even with hundreds of companies in the world), tinted by sector and sized by the company's real
  `hqTier`. IPO a company (yours or an NPC's — public companies now IPO on their own over time, not just
  when the player triggers it) and it spends its first year behind scaffolding, a crane and a "COMING
  SOON" sign before the real tower opens; upgrade the HQ afterward and the building updates live. The
  plaza itself got a pass too: a three-stop day → dusk → night sky gradient and a fading starfield.
  Alongside the city work: stock splits and NPC share buybacks in the market, a build-to-suit action that
  turns vacant land into a house/apartment block/commercial property, and continued verification that the
  existing spin-off, buyback and hostile-takeover systems already cover the deep-business-and-stocks ask.
- **V29 content pass — ~400 new features, all data-driven.** 108 new industries across every one of the
  12 sectors (347 total), 70 new laws across 17 categories (185 total), 92 new daily flavor events (139
  total), 105 new yearly event templates across all ten categories (257 total), and 20 new milestone
  achievements (casino high-rollers, crypto/savings/bond/forex thresholds, franchise and loyalty-program
  empires, crime-family kingpins, election landslides, and more) wired into the same generic
  threshold-check the existing achievement system already used — no new engine logic required, since the
  whole point of this codebase's data/engine split is that content is just rows in an array.
- **✨ The Studio: a full Product Design & Commerce pillar** — walk into an innovation lab (a live 3D
  environment with a reflective glass floor, holographic rings, ambient particles and a robotic assembly
  arm) and take products from a spark of an idea to global launch. Design in a real-time parametric 3D
  viewport (form sliders, body/accent colors, four finishes, four lighting moods — drag to rotate,
  pinch to zoom) where every category renders as a **photoreal-style product model** — phones with live
  home screens and camera islands, laptops with drawn keyboards, watches with ticking dials, headphones,
  cars with tinted greenhouses and wheel arches, labeled bottles, sneakers, handbags and more — lit by
  image-based reflections, ACES tone mapping and physically-based materials (clearcoat paint, real glass
  transmission); choose from **20 product categories** (smartphones to automotive to jewelry) and
  **16 engineering materials** (aluminum to gold to recycled composites) that genuinely drive cost,
  durability, luxury, weight and sustainability; brief the in-game **AI design assistant**
  ("luxury futuristic coffee machine…") to draft a full editable concept; run a **12-node product R&D
  tree** (advanced alloys, AI integration, robotic assembly, self-healing coatings…); prototype, lab-test
  against nine criteria, iterate, and **patent** your inventions; pick one of **8 manufacturing
  strategies** (handmade to mass production) with real capacity/defect/perception tradeoffs; design
  packaging, build product brand power, set pricing/marketing/channels; stage a cinematic **launch
  event** (livestream to flagship theater) whose hype shapes demand; then compete in a yearly market sim
  where ratings, reviews, returns and lifecycle decay all feed an **analytics dashboard** — and profits
  flow straight into the owning company. Ship successor **generations**, retire icons to the portfolio,
  and curate your own themed **storefront**. **28 total categories** now, including drones, cameras,
  TVs, bicycles, eyewear, musical instruments, kitchenware and power tools — each with its own bespoke
  3D model (quadcopter rotors and gimbal, an SLR with a real lens barrel, a diamond bike frame with
  spoked wheels, an electric guitar with strings and pickups…).
- **Every piece of every product is individually customizable** — a dedicated Part Customizer lets you
  give any named part (a phone's camera island, a car's rims, a watch's strap, a guitar's pickguard) its
  own color, material and finish independently of the rest of the product, with one-tap curated
  **colorways** for a cohesive look in a single click, and a reset to fall back to the base design.
- **Component sourcing & your own engineered parts** — every product has a real bill of materials
  (processor, battery, sensors, motor, optics…); source each slot at a Budget/Standard/Premium tier with
  honest cost/quality/defect tradeoffs, or open the **Parts** workshop to engineer your own component
  from scratch — name it whatever you like ("Bat62", "Core9"), fund a research investment that sets its
  engineering grade, install it in your own products, revise it in later versions, and list it for sale
  on the **global component market** where other manufacturers license it for real recurring revenue.
  A random global component shortage occasionally squeezes an entire category's costs.
- **Market research & audience targeting** — run focus groups with five distinct customer segments
  (Value Seekers, Families, Early Adopters, Eco-Conscious, Luxury Buyers), see a revealed fit score for
  each, and aim your marketing at the segment that loves the product to shift real yearly demand.
- **Warranty, consumer trust & recalls** — choose 0–3 years of warranty coverage that costs a slice of
  unit economics but builds trust and cuts returns; field defects surface on their own over a product's
  life, and you can ride one out or issue a voluntary recall that costs real money but rebuilds trust
  before lawsuits and bad headlines pile up.
- **🧭 Explore: a walkable 3D hub layered over the real simulation** — leave the menus and walk your
  city block in third-person (drag a virtual joystick, or WASD/arrows on desktop) around a plaza with
  six buildings that are computed fresh from live game state every time you visit, not decoration: your
  HQ is a boarded vacant lot until you found a company, then a lit tower that gains a construction crane
  once it's thriving — or goes dark the moment it's bankrupt; Parliament only raises a flag if you hold
  office, sized by your real approval; the Exchange's ticker ring glows green or red with the actual
  market move this year; your Studio storefront lights up once a product goes public; your home's
  windows glow warmer the happier and healthier you are; the Bank scales with your real net worth. A
  continuous day/night cycle sweeps the sky, streetlamps switch on at dusk, trees shift with the season,
  and a few ambient pedestrians and cars loop the plaza for atmosphere. Walk up to any building and an
  Enter prompt hands off straight to that system's real screen.
- **Daily / Weekly / Yearly time control** — advance a single day, a week, or a full year. Day/week
  ticks are lightweight (a small chance of a flavor moment, tiny stat drift) so you can fast-forward
  without interruption; the full economy/company/politics simulation still resolves exactly once a
  year, whether you jump straight there or accumulate days/weeks into it.
- **Deterministic living world** — 12 fictional nations, dozens of states, ~150 cities, 400+ notable
  NPCs and 170+ companies, all generated from a seed so the same seed reproduces the same world exactly.
- **347 industries** across 12 sectors, each with distinct economics (margins, cyclicality, capital and
  labour intensity, tech and regulation sensitivity, commodity exposure).
- **Full company simulation** — revenue emerges from the business cycle x your pricing, marketing, R&D,
  wages, automation, cyber-defense and brand x the laws in force x competition. IPO, pay dividends,
  patent your R&D, get taken over, unionise, face lawsuits and cyberattacks, or go bankrupt.
- **Simulated stock exchange** — every listed company has fundamentals, analyst expectations, earnings
  surprises, P/E ratios, dividends, short interest and institutional ownership. Buy, sell, and short-sell.
- **Macro-economy** — business-cycle regimes (boom to depression), a Taylor-rule central bank, inflation,
  unemployment, housing and equity indices, FX, government debt and shared commodity markets.
- **Buildings age and decay for real** — every property you own gets a construction year and a
  condition and energy-efficiency rating that actually matter: pick minimal, standard or premium
  maintenance spend and watch condition drift accordingly, with premium upkeep able to slowly repair a
  building over time. Neglect a property and it visibly deteriorates, its resale value slides, tenants
  pay less rent, and once condition is badly degraded it risks a real structural-failure incident each
  year — insurance (now with a real ongoing premium) softens the loss, going without risks losing it
  outright. Renovate a condemned building back to like-new condition and a real value/efficiency jump,
  including its own achievement for a proper rescue.
- **Your career is a real workplace, not a stat screen** — apply for a job and clear an actual
  interview gate (driven by smarts, skills, charisma, reputation, and a reference-check penalty if
  you were recently fired), optionally negotiating a starting salary at the risk of losing the offer.
  Every job comes with generated coworkers — a manager and one or two peers, each with a personality
  (friendly, mentoring, competitive, political, toxic) that drives ambient stress, rapport drift, and a
  chance of a real toxic incident each year. Network with a coworker to build rapport, or report one to
  HR (a real, sometimes-backfiring investigation — unjustified reports can cost you rapport and
  performance). Climb a six-rank ladder (intern to executive) by pushing for promotion once you've put
  in enough time and performance at your current rank, with salary rescaled by rank, not a repeatedly
  re-prefixed job title. Pick a work style — standard, overtime (more pay, more stress), or flexible
  (less pay, less stress) — and watch stress and reliability feed back into performance and even your
  happiness and health once they run too high. Random workplace events (restructuring, a new manager,
  budget cuts, relocation, automation, an accident, a scandal) land some years with real mechanical
  consequences, not just flavor text. Lose your job and it leaves a mark — future interviews get
  harder for a few years, and drawn-out unemployment slowly erodes your skills despite a small,
  decaying safety-net benefit. Alongside the corporate ladder runs a parallel **freelance & gig
  economy** — design work, consulting, coding, writing, rideshare, influencer deals, trades — each gig
  paying out (or falling through) based on a skill check and your freelance reputation, which compounds
  with good reviews and stings with bad ones.
- **A society that thinks, shocks, talks and evolves** — every relationship NPC (coworkers, mentor,
  rival, spouse, children) carries a real personality (empathy, aggression, discipline, loyalty,
  curiosity, social confidence) and a day-to-day mind state (mood, stress, financial pressure) that
  drifts every year and drives how they actually react to you — a mentor's lessons land harder when
  they're not burned out, a rival's grudge escalates or cools based on their traits and your history
  together, not a coin flip. A capped memory log on every notable NPC records what you actually did to
  them (reported to HR, called a truce, took them on as a protégé) instead of the game forgetting the
  instant the dialog closes. The world economy can now throw four new global shocks — semiconductor
  shortages, food crises, shipping disruptions, currency crashes — on top of the original six, each with
  real ripple effects into unemployment, unrest, government approval, migration and city crime, not just
  the stock ticker; recent history genuinely dampens the odds of the same shock repeating right away (a
  real "we just went through this" fatigue, and a nod to post-crisis regulation after a banking
  collapse). Build a following on social media — five post styles trading reach for backlash risk, real
  virality and "cancelled" mechanics, and misinformation storylines that can spiral or blow over
  depending on how you handle them. And industries themselves rise and fall across decades: tech-driven
  sectors trend up, heavily-regulated low-tech ones trend down, visible as a real 📈/📉 signal when you're
  choosing where to found your next company — while your own children and grandchildren are born into
  whatever cultural era the world has drifted into by then, tech booms and crises alike leaving a mark on
  the next generation's politics. (Honest scope: this isn't a full agent-based simulation running rich
  decision trees for every one of the world's 400+ background NPCs — that stays lightweight, as it always
  was, for the sake of a game that runs smoothly on a phone. The deep mind model is reserved for the NPCs
  you actually have a relationship with, where it's felt.)
- **Deep politics** — join or found a party, campaign for eight tiers of office (councillor to head of
  state) with rallies/ads/fundraising/consultants/polling, negotiate coalitions, appoint a cabinet, and
  pass or repeal **185 laws** whose effects continuously reshape the economy. As head of state, conduct
  real foreign policy: declare war, sign peace treaties, impose or lift sanctions, send foreign aid, and
  sign trade agreements — on top of the elections, coups, sanctions and wars that unfold on their own.
- **War has real weight, win or lose** — militaries now have a Readiness score, separate from raw
  military power, that drifts toward whatever your Defense budget share can actually sustain (neglect
  it and it erodes; fund it and it builds). Once a war starts, an outmatched readiness gap means faster
  casualties and a harder-fought peace; war exhaustion accumulates the longer a conflict grinds on,
  dragging down approval and pushing both sides toward the table, then recovers once you're at peace
  with everyone. A signed armistice costs a real reconstruction toll to infrastructure. Invest directly
  in military readiness from the Treasury & National Security panel.
- **Mind, school and the law now bite back** — every degree grants smarts *and* a real skill in the
  field you studied (a CS degree builds programming, a law degree builds law), scholarships knock down
  tuition for sharper students, and dropping out costs happiness and reputation in proportion to how far
  you'd gotten. A general-life Stress meter (distinct from job-specific stress) responds to burnout,
  money trouble and a rocky marriage, and can tip into a real multi-year Burnout debuff past 80 — therapy
  and rest bring it back down. Crime now carries a lasting Investigation Heat meter that climbs
  independently of any single job's own risk roll, so a string of "successful" crimes can still catch up
  with you in a later arrest; time served now gates a genuine Request Parole option. (Honest scope: no
  literal school timetable, teacher NPCs, exams or detention system, no six-way Stress/Anxiety/Depression/
  Confidence/Motivation/Burnout meter bank — just Stress plus a binary Burnout state — and no generative
  AI interrogation or courtroom simulation. What's real: subject-driven degree payoffs, a player-wide
  mental-health mechanic that feeds job performance, and an arrest/parole pipeline with teeth.)
- **3D is now a main way you play, not a side visualization** — the walkable City hub gets its own
  primary tab, and has grown from 6 buildings to 10: a Career office (push for a promotion right there),
  a Park (family, and a free moment to meditate), the Docks (foreign relations) and a Newsstand (skims
  the day's real headline) join HQ, Bank, Parliament, Exchange, Studio and Home — several offering a
  quick action you can take without leaving the plaza. Politics and the stock market each get a
  dedicated 3D scene of their own: a legislative Chamber with a real hemicycle of seat blocks sized and
  colored by actual party seat counts and ideology (your own party outlined gold, cabinet podiums lit
  when filled), and an Exchange Trading Floor with a big board tracking the real national index and
  ticker booths for the day's biggest real movers. Every 3D scene now renders through a filmic
  (ACES) tone-mapped pipeline with a procedural studio environment map for real reflections on
  metal and glass, plus soft shadows and a bloom pass on desktop so lit windows, screens and seals
  actually glow instead of just being a flat bright color (phones get the tone-mapped, reflection-lit
  look without the two most expensive pieces, to protect frame rate). The geometry itself got a real
  pass too — trees are now clustered, rounded canopies instead of a single traffic-cone shape, cars
  have actual wheels/glass/head-and-taillights instead of two stacked boxes, pedestrians and traders
  have proportioned legs/torso/arms/hair instead of a capsule-and-sphere blob, and buildings pick up
  real architectural detail (entrance steps, cornices, porches, rooftop clutter, dock pilings and
  bollards) instead of reading as a bare box, and the HQ Tour scene got the same windowed-facade,
  courtyard and proportioned-figure treatment as the City hub. The render pipeline also picked up
  real ambient occlusion (contact shadows where geometry meets geometry) and proper multisampled
  antialiasing on the composer path, so desktop's shadow/bloom pass no longer trades away the edge
  smoothing plain rendering had. There's also a real (optional) pipeline for dropping in actual
  `.glb`/`.gltf` model files — see `public/models/README.md` — that falls back to the procedural
  geometry above whenever a model isn't present, which is the case everywhere today. (Honest scope:
  still a stylized, procedurally-built diorama, not a full open-world engine with physics or
  pathfinding — but every shape, color and light on screen is driven by real simulation state, not
  decoration.)
- **The world and your rivals react back** — a real, player-vs-named-rival price war: undercut a
  specific competitor's price and they may cut right back at you, shifting real market share both ways.
  Everyone in your inner circle (spouse, mentor, rival) now shows a real mood, disposition and their most
  recent memory of you, not just a name and a number. National news now covers your own life when it's
  genuinely newsworthy — a conviction, a release, or burning out under the pressure — alongside the
  economy and world events it already tracked.
- **Power can be taken, not just won — and it can be lost overnight** — in a parliamentary system,
  force a formal no-confidence motion against the sitting government with real seat weight and
  political capital (a big enough bloc walks straight into power); the same fate can just as easily
  befall you as leader if approval collapses, unrest spikes, and your own party can't protect you.
  Anyone with real political standing now carries genuine scandal risk tied to how dirty their life
  actually is — notoriety, convictions, laundered money, law-enforcement heat — that a retained PR
  agency measurably softens, and a severe uncontained scandal can force a resignation outright.
- **Patents and partnerships now have real teeth** — sue a named competitor for patent infringement
  and either collect a real settlement or eat the legal costs and a brand hit for a suit that didn't
  stick; pool capital with a named partner company in a multi-year joint venture for an ongoing
  synergy boost and a payout at the end weighted by both companies' actual strength — a genuine bet,
  not a guaranteed win.
- **Family, dynasty & wills** — date, marry (with an optional prenup), divorce, have or adopt children who
  age up as real NPCs and eventually have grandchildren of their own, name a successor to inherit a company
  or a political heir to inherit your party and popularity, draft a will naming a primary heir for a bigger
  share of your estate, and track a Dynasty Score.
- **Continue your dynasty** — when you die, if you have a surviving spouse, child, or grandchild, choose to
  keep playing as them (inheriting per your will) instead of ending the story, incrementing a generation
  counter that feeds your next Legacy Score — or end the story there for good.
- **Relationships** — find a mentor for a small yearly edge, network into new friends and allies, or
  declare a rival and feud with them through dedicated events.
- **Corporate warfare** — patents and trademarks that pay off and dent rivals, a cyber-defense lever, a
  diversified supply chain, corporate espionage, shareholder revolts, hostile takeovers in both directions,
  and NPC-vs-NPC competitor mergers, plus proactive business initiatives (brand deals, tiered staff training
  from apprenticeship to executive leadership, quality audits, preemptive recalls).
- **Corporate culture, headquarters & the C-suite** — upgrade from a Basic Office to a Megacomplex for
  morale, brand and management bonuses, pick a culture (Traditional, Flexible, Remote-First, Startup) with
  real tradeoffs, and hire a CFO/COO/CMO (each liable to be poached by a rival) alongside issuing corporate
  bonds, running stock buybacks, and spinning off a division into its own traded entity.
- **Boardroom & public-sector deals** — put shareholder resolutions (dividend hikes, executive pay,
  blocking an activist) to a vote weighted by your stake and the company's standing, bid on government
  contracts, and apply for R&D grants — all alongside running competitive recruitment drives (harder when
  the national labor market is tight), taking a VC-style equity stake in a small private startup, franchising
  a strong brand into royalty-paying locations, and launching a customer loyalty program.
- **Science, health & energy policy** — as head of state, fund university research and national healthcare
  directly, and set the national energy grid's renewable share; pharma and biotech companies with enough
  R&D intensity can run clinical trials for a shot at a new patent.
- **Media ownership & reputation management** — own a media company to build political influence over time
  and cash it in for a favorable profile piece, or retain a permanent PR agency that softens the sting of
  bad press.
- **The underworld** — join a crime family and climb five ranks through heists and protection rackets,
  contest rival turf for a bigger cut, launder illicit proceeds through a front business, bribe a judge or
  attempt a prison escape if you're caught, pay your way out and go straight, or enter witness protection to
  wipe your record at a steep cost.
- **Financial markets, bonds, crypto, and forex** — beyond stocks: buy government bonds for fixed income,
  speculate long or short on foreign currencies, trade on margin, enable dividend reinvestment (DRIP), set
  standing limit orders, ride NovaCoin — a single, wildly volatile cryptocurrency amplified by tech booms
  and banking crises — insure your businesses and properties, take out life insurance, and watch a live
  scrolling stock ticker of the day's biggest movers.
- **Personal banking & retirement** — park cash in a savings account earning the policy rate, lock in
  fixed-rate term deposits for one to ten years, and once you turn 60, formally retire on a pension
  scaled to your final salary.
- **Charity foundation & memoirs** — endow a personal charitable foundation that grants 5% of its corpus
  every year (building karma and reputation for life), publish a memoir whose 5-year royalties scale with
  your fame and infamy, and hit the casino for blackjack, roulette or slots (your poker skill helps).
- **Chairman mode & moonshots** — hire a professional CEO to run a company day-to-day while you sit as
  chairman (they can be poached or quit if the money runs out), and commit big money to multi-year
  moonshot R&D projects that either break through — patents, quality, brand, a revenue jump — or burn out.
- **The Global Games & industry awards** — as head of state, bid to host the Global Games (five years of
  buildup costs, a triumphant payoff), while every year the sim crowns the home nation's fastest-growing
  firm Company of the Year — including yours.
- **Head-of-state tools** — allocate the budget across six cabinet portfolios, set direct tax rates, launch
  multi-year infrastructure and mega projects (roads, rail, airports, power, internet, a national space
  program, bridges, tunnels, a bullet train network, a stadium, a dam), set
  an immigration quota, read a trend-based economic forecast, hire up to three AI advisors whose advice can
  be wrong, fund an intelligence agency, nominate a Chief Justice (a low-integrity court can strike down laws
  on its own), call a referendum to bypass the legislature, retain a lobbying firm, found or join an
  international alliance, choose blockade or invasion when you declare war, launch an anti-corruption probe
  into your own officials, attend international summits to warm relations with every nation you aren't
  at war with in one sitting, issue government bonds and fund national cyber defense from the treasury,
  hold cabinet meetings and deliver a live budget speech, and manage live protests and strikes by
  conceding, cracking down, or ignoring them — all while an AI opposition leader builds a public
  profile critiquing your record.
- **Elections with real stakes** — pick manifesto promises at campaign launch and get judged on keeping them
  at re-election time, hold press conferences and campaign debates, court celebrity endorsements, weather
  ballot-fraud allegations from opponents, watch an animated election-night results reveal, and track
  government approval by city.
- **A changing climate** — climate risk rises over time (faster or slower depending on the laws in force),
  triggering natural disasters that hit property values and business confidence, with agriculture bearing
  the brunt and insurers absorbing some of the cost.
- **Global world events** — a pandemic, a global trade war, a tech boom, an oil crisis, a banking
  collapse, or an AI disruption wave can sweep the world economy, each with its own winners and losers
  by industry, its own news coverage, and its own event templates — plus milder, more frequent named
  weather events (droughts, floods, heatwaves, cyclones, snowstorms) layered on top of the rarer,
  severe climate disasters.
- **Billionaire lifestyle & celebrity economy** — buy a private jet, superyacht, private island, sports
  team, champion racehorse or famous artwork (each with real upkeep, and racehorses/sports teams that
  occasionally throw off prize money), and take an equity-like royalty stake in a celebrity's career.
- **50+ lifestyle activities** — from the gym and vacations to book clubs, therapy, adopting a pet, art
  collecting, wine tasting, poker nights, volunteering, blogging and learning a language.
- **Living news network & world history** — richer news coverage (editorials, investigative journalism,
  interviews, election-watch coverage) alongside a sparse world-history chronicle of major milestones
  (wars, peace treaties, alliances, coups, elections, dynasty transitions) spanning every generation you play.
- **Public opinion & an AI opposition leader** — a Public Opinion dashboard segments approval by ideology,
  class, age and region using the same left/right/business/worker blocs that drive the legislature vote,
  while a rival politician builds a public profile critiquing your government the whole time you're in power.
- **Deeper corporate & national levers** — rivals occasionally sabotage your companies (misinformation,
  poaching, undercutting, nuisance lawsuits) that an AI business consultant helps you read and react to;
  hold investor conferences, race rivals for a breakthrough patent, and invest in retail loss-prevention
  to stop shrinkage; as head of state, hold cabinet meetings, deliver a live budget speech, manage live
  protests and strikes, issue government bonds, fund national cyber defense, and break ground on mega
  projects (bridges, tunnels, bullet trains, stadiums, dams) alongside the existing infrastructure slate.
- **Thousands of scenarios** — a data-driven event engine resolves placeholders ({company}, {npc},
  {amount}, ...) against live state, with skill-checked, probabilistic outcomes across **150+ event
  templates**, plus **42 lightweight daily flavor events** for time-skipping and honors/awards events
  (knighthoods, hall-of-fame induction, civic medals), so a compact template set produces an enormous
  variety of situations.
- **Small everyday actions** — rename a company, refinance a mortgage or personal loan, gift money or
  invest in a child's education, sponsor a local sports team, host a campaign fundraiser gala, donate to
  a political party, issue a public apology to shed notoriety, or take a career sabbatical.
- **Meta progression** — a Legacy Score computed at game over from your wealth, dynasty, office and
  achievements (with a New Game+ bonus into your next life), a life timeline of every milestone you hit,
  102+ achievements, a Year in Review recap after every year, random mid-game challenges with cash rewards,
  a Casual/Standard/Iron Man difficulty choice, and four starting-economy scenarios (Modern, Boom, Recession,
  Crisis) to change the game you're playing from turn one.
- **Dynamic news** synthesised from what actually happened that year, plus a personal life log and an
  animated election-night results reveal with a city-by-city vote breakdown.
- **Interactive 3D visualizations** (three.js, lazy-loaded so they never cost you bytes until you open
  them) — tour your company's headquarters as it grows from a Basic Office to a Megacomplex with employees
  wandering the campus, watch a live supply-chain flow from source to consumer, see the election-night
  city breakdown as a growing bar chart, and view your nation's air/shipping network as animated routes
  whose traffic scales with diplomatic relations (severed instantly for any nation you're at war with).
  Every scene supports drag-to-rotate and scroll/pinch zoom, with floating name labels on cities, nations
  and supply-chain stages, all under a starfield backdrop.
- **Light and dark mode**, a mobile-first UI (with wider desktop breakpoints and safe-area support for
  notched devices) of circular icon tiles, pill chips, featured cards and canvas charts, with a bottom
  tab bar, a "More" sheet so every screen is reachable from anywhere, and a light first-launch tutorial.
- **Unlimited saves** in IndexedDB (localStorage fallback), autosave every year, and JSON export/import.

## Play

```bash
npm install
npm run dev      # start the dev server, open the printed URL
```

Build for production (static files, host anywhere):

```bash
npm run build
npm run preview
```

## How to play

You begin at **18** with a little cash and some random aptitudes. Each screen lets you act; the clock
only moves when you tell it to, using the three buttons on the Life hub:

- **+1 Day** — a quick, non-blocking tick. Small chance of a flavor moment (found $20, coffee with a
  friend, a parking ticket, ...); tiny health/happiness drift. Never interrupts you with a modal.
- **+1 Week** — seven days at once, for faster fast-forwarding.
- **Year →** — resolves the full simulation for the rest of the current year: the economy, every
  company, the stock market, politics, NPC lives, and any "big" choice-driven events, which do pause
  the game until you decide. Whether you jump straight to a new year or accumulate days/weeks into one,
  the yearly simulation is authoritative and runs exactly once per year.

- **Career** — study for degrees (15 options), take jobs from a live market, and grow skills (120 of them
  across 10 categories). Performance drives raises, promotions and layoffs.
- **Business** — found companies in any of 347 industries, then tune strategy (marketing, R&D, pricing,
  wages, automation, cyber-defense, dividends), invest or draw capital, IPO, or sell. Upgrade your HQ tier,
  pick a corporate culture, and hire a CFO/COO/CMO. Run one-off initiatives (brand deals, tiered training
  programs, supply-chain diversification, quality audits, trademark filings, proactive recalls), issue
  corporate bonds, run stock buybacks, spin off a division, and insure the business. Switch to the
  **Rivals** tab to spy on competitors, shake them down if you're in the crime family, or launch a hostile
  takeover of a public company — NPC rivals merge and consolidate on their own.
- **Markets** — trade the stock exchange of your home nation with a live scrolling ticker of top movers;
  go long or short, trade on margin, collect and optionally reinvest dividends (DRIP), and set standing
  limit orders that fire on their own.
- **Assets** — buy property (cash or mortgage) for rental income and appreciation, renovate it, insure it,
  or move in yourself; take personal loans; buy government bonds; speculate long or short on foreign
  currencies; take out life insurance for your family; and once you're rich enough, buy into the billionaire
  lifestyle (private jets, yachts, islands, sports teams, racehorses, art) or take a royalty stake in a
  celebrity's brand. Every property kind (apartment through private island) now lists a standard tier plus
  one or two genuinely more expensive luxury tiers — a Billionaire's Compound runs 5x a base mansion — and
  any listing or owned property can be viewed as a real, condition-aware 3D massing model (procedural, not a
  literal architectural rendering — see public/models/README.md for why). Renovation now requires the
  property to actually need it (condition below 88), closing a same-turn spam exploit that used to make
  repeated renovation free money.
- **Politics** — join/found a party, run for office with a manifesto of promises tracked through your term,
  campaign (rallies, ads, debates, press conferences, celebrity endorsements, consultants, polling),
  negotiate coalitions, appoint a cabinet if you lead the country, and legislate — or call a referendum to
  put a law directly to the public. Election night reveals an animated results tally. As head of state, use
  the World screen to declare war (blockade or invasion) and make peace, sanction or aid other nations, sign
  trade deals, found or join an alliance, allocate the budget, set tax rates, set the immigration quota,
  launch infrastructure projects (including a national space program), hire AI advisors, retain a lobbying
  firm, nominate a Chief Justice, and run an intelligence agency.
- **Family** — date and marry (with an optional prenup), have or adopt children who grow into real NPCs and
  eventually have grandchildren, name a business successor or a political heir, draft a will naming a
  primary heir, track a Dynasty Score, and manage your mentor/rival/friend relationships.
- **World** — a macro dashboard, every nation's economy and government (including climate risk and
  unrest), diplomacy actions, commodities, national debt/cyber-defense tools, and any active global event
  (pandemic, trade war, tech boom, oil crisis, banking collapse, or AI disruption).
- **News / Stats** — the dynamic wire (now with editorials, investigative pieces, interviews and election
  coverage) plus a World History chronicle tab, your net-worth curve, 102+ achievements, a life timeline,
  and save tools.
- **Underworld** — join a crime family and climb its ranks through heists and protection rackets, contest
  rival turf, launder illicit proceeds through a front business, bribe a judge or attempt a prison escape if
  caught, pay your way out and go straight, or enter witness protection to wipe your record.
- **Crime Syndicate Engine** — every country now runs 2-3 real, named crime families with their own boss,
  strength, turf and heat, simulated year over year whether or not you ever join one: they skirmish over
  territory, form alliances, declare wars on each other, and get dismantled by law-enforcement crackdowns tied
  to that country's judicial integrity. Join one and its turf war becomes yours to fight — propose an alliance
  or declare war on a specific named rival family, and if your family gets crushed or wiped out you lose your
  standing with it (this is a family-level strength/turf/heat state machine, not a simulation of individual
  soldiers or a literal open-world crime map).
- **Casino — a real walkable 3D floor, not an orbit-camera diorama** — walk your own avatar around an
  enclosed room (patterned carpet, flanking columns, two hanging chandeliers) with WASD/arrow keys or a
  virtual joystick, exactly the same walking-camera system as the Explore city hub. Walk up to any of six
  named, distinct slot machines (each its own theme, stakes, volatility, a reel-window symbol strip and
  coin tray, and a real progressive jackpot pool that grows every spin and resets when someone finally hits
  it), blackjack, high-stakes poker, a fair 50/50 heads-or-tails coin toss, or the sports book kiosk, and a
  "▶ Play" prompt surfaces automatically — the bet panel then opens as a fixed overlay inside the same
  scene box (never pushed into page scroll), pausing movement while it's open. **Roulette is genuine 3D
  betting**: the wheel and ball spin down and land on the real winning number from the actual spin result
  (37 pockets, straight-number or red/black/odd/even/high/low outside bets, real payouts), and a bright chip
  marker shows exactly where your current bet sits on the felt. **New: a Sports Book** — a fresh weekly
  slate of 5 matches across football, basketball, soccer and boxing, each team with a real win probability
  and moneyline odds priced with a genuine ~7% vig shaved off both sides (not a coin flip dressed up — the
  book keeps its edge on the bet either way). Every game keeps a genuine house edge: skill narrows it (poker
  skill on the card tables) but can never flip it into the player's favor, the same principle a real casino
  runs on. A VIP room (Diamond Royale) unlocks once you're liquid enough. Fullscreen requests real landscape
  orientation on browsers that support it (with a rotate-your-device hint where they don't, mainly iOS
  Safari), filling the viewport with the same walkable scene and overlay UI; the room itself is deliberately
  lighter on phones — fewer real-time lights and decorative meshes — since a phone GPU pays full price for
  every light with no shadow map to hide behind.
- **Lifestyle** — 20+ quick activities on the Life hub, from the gym and charity to book clubs, therapy,
  adopting a pet, art collecting, wine tasting, poker nights, blogging and learning a language.
- **🏆 Global Leaderboard — the one online feature in the game.** Two public, no-login rankings backed by
  a real Supabase Postgres backend: a live **Net Worth** board you can resubmit any time your run is
  going, and a **Legacy Score** board that only updates when a completed life actually beats your
  device's previous best (submitted right from the death screen). Each device holds exactly one row per
  board — a locally-generated ID, not a real account — so resubmitting updates your own entry instead of
  spamming new ones; this is an honest honor-system board with no server authority over the client-side
  sim, not a certified ranking. Every leaderboard call is timeout-bounded and fails soft: no connection
  (or the board being genuinely empty) just shows a clear, distinct state and a Retry button — it never
  touches the rest of the offline game. **Reach #1 on either board and you bank a "Royal Bloodline" perk**
  for your next life — a real starting advantage on the new-game screen, not just a title: several million
  in inherited wealth, an elite upbringing's boost to smarts and charisma, and starting reputation,
  popularity and influence an 18-year-old couldn't otherwise have. The perk is banked the moment you're
  seen at #1 (checked on the Leaderboard screen and right after a Legacy submission) and stays available
  until you actually spend it starting a new life, so a later drop in rank doesn't take it away.

Life ends when you do — from old age, illness, or misfortune — with a Legacy Score summarizing your wealth,
dynasty, office and achievements. If a spouse, child, or grandchild survives you, choose to continue playing
as them (inheriting per your will) instead of ending the story — otherwise your estate (companies with a
named successor, political heir, cash, and property) passes to your spouse, children and grandchildren.

## Architecture

The simulation is a **pure, UI-free core** (`src/sim`) driven entirely by **data** (`src/data`), wrapped
by a thin **Zustand store** (`src/store`) and a **React UI** (`src/ui`). The entire game is one
serialisable `GameState` object plus the RNG stream state, which is what makes saves, export/import and
deterministic replay trivial.

```
src/
  sim/                 Pure simulation core (no React, worker-friendly)
    rng.ts             Seeded deterministic RNG (mulberry32)
    types.ts           All game types; GameState is the single source of truth
    world.ts           World generation from country seeds + the player
    economy.ts         Macro cycle, rates, inflation, assets, commodities, demographics
    business.ts        Company simulation, valuation, HQ tiers/culture, NPC merger consolidation, NPC IPOs
    market.ts          Stock exchange, trading, shorting, dividends, splits, buybacks, IPO construction lifecycle
    politics.ts        Office ladder, elections, legislation, cabinet, coalitions, geopolitics, NPC lives,
                       budget allocation, infrastructure projects, manifesto promise tracking
    family.ts          Dating, marriage, children, succession planning (business + political), estate
                       distribution, dynasty score
    worldEvents.ts      Global events (pandemic, trade war, tech boom) layered on the economy
    dailyEvents.ts     Matching/resolution for lightweight daily flavor events
    events.ts          Event matching, placeholder resolution, effect application
    news.ts            Dynamic headline generation
    actions.ts         The player "verbs" the UI calls between years
    engine.ts          advanceYear()/advanceDay()/advanceWeek(): orchestrate simulated time
  data/                Data-driven content (the game is authored here)
    industries.ts      347 industries across 12 sectors
    laws.ts            185 laws with economic effects and bloc support
    events.ts          Event templates -> thousands of scenarios
    dailyEvents.ts     22 lightweight flavor events for day/week advancement
    skills.ts          120 skills; countries.ts, names.ts, ...
  store/
    gameStore.ts       Zustand store wrapping engine + actions
    persistence.ts     IndexedDB saves (localStorage fallback), export/import
  net/                 The one online surface: Supabase-backed global leaderboard
    supabaseClient.ts  Supabase client (publishable key — safe to ship, RLS-gated)
    leaderboard.ts     Timeout-bounded, fail-soft reads/writes against leaderboard_entries
  ui/                  Mobile-first React UI (light + dark, desktop breakpoints, safe-area aware)
    components.tsx     Cards, pills, circular tiles, stat bars, canvas charts
    AppShell.tsx       Top bar + bottom tab navigation + "More" sheet
    ElectionResultModal.tsx  Animated election-night results reveal
    SuccessionModal.tsx      Choose to continue as an heir, or end the story, on death
    YearRecapModal.tsx       "Year in Review" net-worth and headline recap after each Year advance
    TutorialOverlay.tsx      Light first-launch walkthrough (shown once per browser)
    three/             Ambient three.js visualizations (lazy-loaded, code-split from the main bundle):
                       HQTourScene, SupplyChainScene, ElectionMapScene, TradeNetworkScene
    screens/           Life, Career, Business, Market, Assets, Politics, Family, World, News, Stats, Leaderboard
```

### Modding

All gameplay content lives in `src/data` as plain arrays/objects. Add an industry, law or event by adding
a row — the engine never hard-codes individual content, so mods and expansions are just data.

## Tech

React + TypeScript (strict) · Vite · Tailwind CSS v4 · Zustand · IndexedDB · HTML Canvas charts ·
three.js (lazy-loaded, code-split) for ambient 3D visualizations · Supabase (Postgres + RLS) for the
one online feature, the global Leaderboard — everything else needs no network at all.

## Development

```bash
npm run typecheck   # tsc --build, strict, zero errors
npm run smoke       # headless: generate a world and simulate ~80 years, asserting no NaNs/errors
npm run build       # type-check + production bundle
```

The simulation core is deliberately decoupled from React, so it can be exercised (and unit-tested)
headlessly — see `scripts/smoke.ts`.
