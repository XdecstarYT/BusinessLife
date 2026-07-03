/* Headless simulation smoke test: generate a world, exercise actions, and
   advance ~80 years, asserting invariants and catching exceptions. */
import { generateWorld } from '../src/sim/world';
import { advanceYear, netWorth } from '../src/sim/engine';
import { resolveChoice } from '../src/sim/events';
import { RNG } from '../src/sim/rng';
import * as A from '../src/sim/actions';
import { buyShares, marketCap } from '../src/sim/market';
import { datingPool, propose, haveChild, nameSuccessor } from '../src/sim/family';
import { INDUSTRIES } from '../src/data/industries';

let state = generateWorld({ playerName: 'Test Tycoon', gender: 'male', seedText: 'smoke-seed-1' });

console.log('World generated:');
console.log('  countries:', state.countries.length);
console.log('  companies:', Object.keys(state.companies).length);
console.log('  npcs:', Object.keys(state.npcs).length);
console.log('  industries:', state.industries.length);
console.log('  public cos:', Object.values(state.companies).filter((c) => c.isPublic).length);

// Give the player capital to exercise expensive actions.
state.player.money = 5_000_000;
A.enroll(state, 1);
const cheapInd = INDUSTRIES.filter((i) => i.startupCost < 200_000)[0];
A.startCompany(state, cheapInd.id, 'Test Co', 150_000);
A.joinParty(state, state.countries[0].parties[0]?.id ?? 'x');

let errors = 0;
let events = 0;

for (let y = 0; y < 82 && state.player.alive; y++) {
  try {
    state = advanceYear(state);
    // Auto-resolve any events by picking the first choice.
    for (const ev of state.pendingEvents) {
      const rng = new RNG(state.seed);
      rng.state = state.rngState;
      resolveChoice(state, ev, ev.choices[0], rng);
      state.rngState = rng.state;
      events++;
    }
    state.pendingEvents = [];

    // Periodically buy a stock and run for office.
    if (y === 5) {
      const pub = Object.values(state.companies).find((c) => c.isPublic && c.status === 'active');
      if (pub) buyShares(state, pub.id, 100_000);
    }
    if (y === 10 && state.player.money > 50_000) {
      A.launchCampaign(state, 'councillor', 10_000);
    }
    if (y === 20) {
      const listings = A.propertyListings(state);
      A.buyProperty(state, listings[0], true);
    }
    if (y === 3 && !state.player.spouseId) {
      const candidates = datingPool(state);
      let tries = 0;
      while (!state.player.spouseId && tries < candidates.length) {
        propose(state, candidates[tries]);
        tries++;
      }
    }
    if (y === 6 && state.player.spouseId) haveChild(state);
    if (y === 25 && state.player.children.length && state.player.companies.length) {
      const adultChild = state.player.children.map((id) => state.npcs[id]).find((c) => c && c.age >= 18);
      const co = state.player.companies[0];
      if (adultChild && co) nameSuccessor(state, co, adultChild.id);
    }
    if (y === 30) {
      const rival = Object.values(state.companies).find(
        (c) => c.status === 'active' && !c.playerOwned && c.countryId === state.player.countryId,
      );
      if (rival) A.spyOnCompany(state, rival.id);
    }
    if (y === 35) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') {
        const cands = A.cabinetCandidates(state);
        if (cands.length) A.appointMinister(state, 'Finance', cands[0].id);
      } else if (state.player.partyId) {
        const other = home.parties.find((p) => p.id !== state.player.partyId);
        if (other) A.negotiateCoalition(state, other.id);
      }
    }
    if (y === 40) {
      const rivalPublic = Object.values(state.companies).find(
        (c) => c.status === 'active' && c.isPublic && !c.playerOwned && c.countryId === state.player.countryId,
      );
      if (rivalPublic) {
        A.attemptHostileTakeover(state, rivalPublic.id, marketCap(rivalPublic) * 0.9);
      }
    }
  } catch (e) {
    errors++;
    console.error(`ERROR in year ${state.year}:`, (e as Error).message);
    if (errors > 3) break;
  }
}

const nw = netWorth(state);
console.log('\nAfter simulation:');
console.log('  year:', state.year, 'age:', state.player.age, 'alive:', state.player.alive);
console.log('  net worth:', nw.toLocaleString());
console.log('  events resolved:', events);
console.log('  companies still active:', Object.values(state.companies).filter((c) => c.status === 'active').length);
console.log('  news items:', state.news.length);
console.log('  life log:', state.lifeLog.length);
console.log('  achievements:', state.achievements.join(', ') || 'none');
console.log('  spouse:', state.player.spouseId ? state.npcs[state.player.spouseId]?.name : 'none');
console.log('  children:', state.player.children.length, 'divorces:', state.player.divorceCount);
console.log('  successors named:', Object.values(state.companies).filter((c) => c.successorId).length);
console.log('  total patents granted:', Object.values(state.companies).reduce((s, c) => s + c.patents, 0));
console.log('  world event ever fired (pandemic possible, random):', state.worldEvent ? state.worldEvent.type : 'none active at end');
console.log('  generation:', state.generation);
console.log('  errors:', errors);

// Invariant checks
const bad: string[] = [];
if (Number.isNaN(nw)) bad.push('net worth is NaN');
if (Number.isNaN(state.player.money)) bad.push('money is NaN');
for (const c of state.countries) {
  if (Number.isNaN(c.economy.gdp)) bad.push(`${c.name} gdp NaN`);
  if (Number.isNaN(c.economy.stockIndex)) bad.push(`${c.name} stockIndex NaN`);
}
for (const c of Object.values(state.companies)) {
  if (Number.isNaN(c.revenue) || Number.isNaN(c.sharePrice)) bad.push(`company ${c.name} NaN`);
}
if (bad.length) {
  console.error('\nINVARIANT FAILURES:', bad.slice(0, 10));
  process.exit(1);
}
if (errors > 0) process.exit(1);
console.log('\n✅ Smoke test passed — no errors, no NaNs.');
