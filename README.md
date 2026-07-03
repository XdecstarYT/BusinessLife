# BusinessLife 💼

A feature-rich, BitLife-style **business tycoon life simulator** that runs entirely in your browser. Dark, mobile-first UI with a floating pill navigation, serif display headings, and card-based layout.

**Play it:** just open `index.html` in any modern browser. No build step, no dependencies, no server. Progress auto-saves to `localStorage`.

## The Game

You start at 18 with one of three origin stories — **Bootstrapper** ($5K), **Loan Taker** ($100K cash + $100K debt), or **Trust Fund** ($500K) — in one of 10 countries with different tax rates and costs of living. Every month is a turn; advance one month or a whole year at a time (spacebar advances a month). Build an empire before your health, happiness, or creditors catch up with you.

## Features

### 🏢 Deep business simulation
- **16 industries** to found companies in — coffee shops, SaaS, fintech, biotech, game studios, crypto exchanges, logistics, fashion labels and more — each with its own margins, volatility, capital requirements, growth ceilings, and key skill
- **Run the company**: set monthly marketing & R&D budgets, pricing strategy (budget/standard/premium), and dividend payout policy
- **Hire and fire** across 7 roles (associates, engineers, marketers, salespeople, executives) — each employee has a skill level and salary; morale, efficiency, brand, and quality all evolve monthly
- **Grow**: expand locations/capacity (with market saturation ceilings), acquire competitors, raise venture rounds (Seed → Series D) that dilute your equity, and eventually **IPO** or sell the whole company
- Businesses can hit crises, draw emergency credit, and go bankrupt

### 📈 Markets & investing
- Simulated **stock market** (8 tickers) and **crypto market** (4 coins) with drift, beta, and sentiment — prices move monthly with sparkline history
- **Rental real estate** with tenants, vacancies, yields, upkeep, and appreciation
- A **macro economic cycle** (expansion → boom → recession → recovery) that moves interest rates, valuations, demand, and asset prices
- Personal loans with dynamic credit limits, capital gains & dividend taxes

### 🧬 Life simulation
- **Vitals**: health, happiness, energy, stress, reputation, fame — all drift and interact
- **Education**: community college through MBA/PhD, gating the corporate career ladder
- **Careers**: 19 jobs across 5 tracks with promotions, performance, and firings
- **Relationships**: partners, marriage, divorce settlements, children (and their tuition), mentors, and business rivals
- **Lifestyle**: homes, cars, yachts, jets, art, watches — happiness, prestige, upkeep, appreciation/depreciation
- **10 repeatable activities** — gym, therapy, networking, courses, charity, vacations…

### 🎲 BitLife-style decision events
17+ multi-choice random events with skill-dependent outcomes: elevator pitches to angels, poaching attempts, lawsuits, supply-chain collapses, PR scandals, acquisition offers, tax audits, insider-trading temptations, burnout, romance, and rivals talking trash in interviews.

### 🏆 Meta
- 16 achievements (Founder → Billionaire → Centenarian)
- Full life log, lifetime stats, net-worth history, exits ledger
- Death and bankruptcy endings with a final verdict on your life

## Project structure

```
index.html        app shell
css/styles.css    the whole design system
js/data.js        static content: industries, jobs, assets, events data
js/util.js        RNG, formatting, DOM helpers
js/state.js       game state + save/load
js/economy.js     macro cycle, markets, real estate, loans, net worth
js/business.js    company simulation: operations, hiring, funding, exits
js/events.js      random decision events
js/engine.js      monthly/yearly tick loop, achievements, death
js/icons.js       nav SVG icons
js/ui.js          render pipeline, modals, toasts, event popups
js/screens.js     the five tabs + intro + game over
js/main.js        bootstrap
```
