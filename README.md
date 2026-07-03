# BusinessLife — Business & Politics Life Simulator

A deep, replayable life-simulation game about **business, politics and economics**, inspired by
BitLife, Democracy 4, Capitalism Lab and Victoria 3 — but designed to be easy to pick up and play on
your phone. Start at 18, take decisions, and advance time at your own pace: **Day**, **Week**, or a
full **Year**, letting a living world simulate forward around you. Build a business empire, get rich
on the markets, climb the political ladder to run the country — or all three.

Everything runs **entirely in your browser**. No backend, no accounts, fully offline, and every save is
plain JSON you can export and re-import.

## Highlights

- **Daily / Weekly / Yearly time control** — advance a single day, a week, or a full year. Day/week
  ticks are lightweight (a small chance of a flavor moment, tiny stat drift) so you can fast-forward
  without interruption; the full economy/company/politics simulation still resolves exactly once a
  year, whether you jump straight there or accumulate days/weeks into it.
- **Deterministic living world** — 12 fictional nations, dozens of states, ~150 cities, 400+ notable
  NPCs and 170+ companies, all generated from a seed so the same seed reproduces the same world exactly.
- **219 industries** across 11 sectors, each with distinct economics (margins, cyclicality, capital and
  labour intensity, tech and regulation sensitivity, commodity exposure).
- **Full company simulation** — revenue emerges from the business cycle x your pricing, marketing, R&D,
  wages, automation, cyber-defense and brand x the laws in force x competition. IPO, pay dividends,
  patent your R&D, get taken over, unionise, face lawsuits and cyberattacks, or go bankrupt.
- **Simulated stock exchange** — every listed company has fundamentals, analyst expectations, earnings
  surprises, P/E ratios, dividends, short interest and institutional ownership. Buy, sell, and short-sell.
- **Macro-economy** — business-cycle regimes (boom to depression), a Taylor-rule central bank, inflation,
  unemployment, housing and equity indices, FX, government debt and shared commodity markets.
- **Deep politics** — join or found a party, campaign for eight tiers of office (councillor to head of
  state) with rallies/ads/fundraising/consultants/polling, negotiate coalitions, appoint a cabinet, and
  pass or repeal **93 laws** whose effects continuously reshape the economy. Elections, coups, sanctions
  and wars unfold with or without you.
- **Family & dynasty** — date, marry, divorce, have children who age up as real NPCs, name a successor
  to inherit a company, and pass your estate to your family when you die so the dynasty carries on.
- **Corporate warfare** — patents that pay royalties and dent rivals, a cyber-defense lever, corporate
  espionage against competitors, shareholder revolts, and hostile takeovers in both directions.
- **Global world events** — a pandemic, a global trade war, or a tech boom can sweep the world economy,
  each with its own winners and losers by industry, its own news coverage, and its own event templates.
- **20+ lifestyle activities** — from the gym and vacations to book clubs, therapy, adopting a pet, art
  collecting, wine tasting, poker nights, volunteering, blogging and learning a language.
- **Thousands of scenarios** — a data-driven event engine resolves placeholders ({company}, {npc},
  {amount}, ...) against live state, with skill-checked, probabilistic outcomes, plus 22 lightweight
  daily flavor events for time-skipping, so a compact template set produces an enormous variety of
  situations.
- **Dynamic news** synthesised from what actually happened that year, plus a personal life log.
- **Light and dark mode**, a mobile-first UI (with wider desktop breakpoints and safe-area support for
  notched devices) of circular icon tiles, pill chips, featured cards and canvas charts, with a bottom
  tab bar and a "More" sheet so every screen is reachable from anywhere.
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

- **Career** — study for degrees, take jobs from a live market, and grow skills (120 of them across 10
  categories). Performance drives raises, promotions and layoffs.
- **Business** — found companies in any of 219 industries, then tune strategy (marketing, R&D, pricing,
  wages, automation, cyber-defense, dividends), invest or draw capital, IPO, or sell. Switch to the
  **Rivals** tab to spy on competitors or launch a hostile takeover of a public company.
- **Markets** — trade the stock exchange of your home nation; go long or short, collect dividends.
- **Assets** — buy property (cash or mortgage) for rental income and appreciation, and take loans.
- **Politics** — join/found a party, run for office, campaign (rallies, ads, consultants, polling),
  negotiate coalitions, appoint a cabinet if you lead the country, and legislate. Whoever controls the
  legislature — including you — passes laws that move the whole simulation.
- **Family** — date and marry, have children who grow into real NPCs, name a successor for each company,
  and build a multi-generation dynasty.
- **World** — a macro dashboard, every nation's economy and government, diplomacy, commodities, and any
  active global event (pandemic, trade war, or tech boom).
- **News / Stats** — the dynamic wire, your net-worth curve, achievements and save tools.
- **Lifestyle** — 20+ quick activities on the Life hub, from the gym and charity to book clubs, therapy,
  adopting a pet, art collecting, wine tasting, poker nights, blogging and learning a language.

Life ends when you do — from old age, illness, or misfortune — with a summary of everything you built,
and your estate (companies with a named successor, cash, property) passes to your spouse and children.

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
    business.ts        Company simulation and valuation
    market.ts          Stock exchange, trading, shorting, dividends
    politics.ts        Office ladder, elections, legislation, cabinet, coalitions, geopolitics, NPC lives
    family.ts          Dating, marriage, children, succession planning, estate distribution
    worldEvents.ts      Global events (pandemic, trade war, tech boom) layered on the economy
    dailyEvents.ts     Matching/resolution for lightweight daily flavor events
    events.ts          Event matching, placeholder resolution, effect application
    news.ts            Dynamic headline generation
    actions.ts         The player "verbs" the UI calls between years
    engine.ts          advanceYear()/advanceDay()/advanceWeek(): orchestrate simulated time
  data/                Data-driven content (the game is authored here)
    industries.ts      219 industries across 11 sectors
    laws.ts            93 laws with economic effects and bloc support
    events.ts          Event templates -> thousands of scenarios
    dailyEvents.ts     22 lightweight flavor events for day/week advancement
    skills.ts          120 skills; countries.ts, names.ts, ...
  store/
    gameStore.ts       Zustand store wrapping engine + actions
    persistence.ts     IndexedDB saves (localStorage fallback), export/import
  ui/                  Mobile-first React UI (light + dark, desktop breakpoints, safe-area aware)
    components.tsx     Cards, pills, circular tiles, stat bars, canvas charts
    AppShell.tsx       Top bar + bottom tab navigation + "More" sheet
    screens/           Life, Career, Business, Market, Assets, Politics, Family, World, News, Stats
```

### Modding

All gameplay content lives in `src/data` as plain arrays/objects. Add an industry, law or event by adding
a row — the engine never hard-codes individual content, so mods and expansions are just data.

## Tech

React + TypeScript (strict) · Vite · Tailwind CSS v4 · Zustand · IndexedDB · HTML Canvas charts.

## Development

```bash
npm run typecheck   # tsc --build, strict, zero errors
npm run smoke       # headless: generate a world and simulate ~80 years, asserting no NaNs/errors
npm run build       # type-check + production bundle
```

The simulation core is deliberately decoupled from React, so it can be exercised (and unit-tested)
headlessly — see `scripts/smoke.ts`.
