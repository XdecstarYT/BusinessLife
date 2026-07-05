/* Headless simulation smoke test: generate a world, exercise actions, and
   advance ~80 years, asserting invariants and catching exceptions. */
import { generateWorld } from '../src/sim/world';
import { advanceDay, advanceWeek, advanceYear, netWorth, continueAsHeir } from '../src/sim/engine';
import { resolveChoice } from '../src/sim/events';
import { RNG } from '../src/sim/rng';
import * as A from '../src/sim/actions';
import { buyShares, marketCap, buyOnMargin, placeLimitOrder, cancelLimitOrder, toggleDrip } from '../src/sim/market';
import { datingPool, propose, haveChild, nameSuccessor, namePoliticalHeir, namePrimaryHeir, adoptChild, dynastyScore } from '../src/sim/family';
import * as F from '../src/sim/family';
import { buyLuxuryAsset, sellLuxuryAsset, investInCelebrityBrand, divestCelebrityStake } from '../src/sim/lifestyle';
import * as P from '../src/sim/products';
import { publicOpinionBreakdown } from '../src/sim/politics';
import { INDUSTRIES } from '../src/data/industries';
import { LAW_BY_ID } from '../src/data/laws';

// --- V6: scenario presets + difficulty + legacy bonus sanity check (no full sim) ---
{
  const boomWorld = generateWorld({ playerName: 'Boom Test', gender: 'female', seedText: 'boom-check', scenario: 'boom', difficulty: 'ironman', legacyBonus: 50_000 });
  const home = boomWorld.countries.find((c) => c.isPlayerHome)!;
  console.log('Scenario/difficulty check: regime =', home.economy.regime, '· difficulty =', boomWorld.difficulty, '· starting money >= 50000:', boomWorld.player.money >= 50_000);
}

/** Resolve any pending yearly choice events by auto-picking the first choice. */
function resolvePending() {
  for (const ev of state.pendingEvents) {
    const rng = new RNG(state.seed);
    rng.state = state.rngState;
    resolveChoice(state, ev, ev.choices[0], rng);
    state.rngState = rng.state;
    events++;
  }
  state.pendingEvents = [];
}

let state = generateWorld({ playerName: 'Test Tycoon', gender: 'male', seedText: 'smoke-seed-3' });

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
let dailyFlavorCount = 0;

// Exercise the new lifestyle actions once, early.
for (const kind of ['book_club', 'therapy', 'adopt_pet', 'road_trip', 'volunteer', 'seminar', 'spa_day', 'blog'] as const) {
  A.doActivity(state, kind);
}

for (let y = 0; y < 82 && state.player.alive; y++) {
  try {
    if (y === 0) {
      // Years 0-1: advance day-by-day to thoroughly exercise the daily tick + year rollover.
      for (let d = 0; d < 365 && state.player.alive; d++) {
        const res = advanceDay(state);
        state = res.state;
        dailyFlavorCount += res.headlines.length;
      }
    } else if (y === 1 || y === 2) {
      // Years 2-3: advance week-by-week until the calendar rolls into the next year.
      let rolled = false;
      for (let w = 0; w < 53 && state.player.alive && !rolled; w++) {
        const res = advanceWeek(state);
        state = res.state;
        dailyFlavorCount += res.headlines.length;
        if (res.rolledIntoNewYear) rolled = true;
      }
    } else {
      state = advanceYear(state);
    }
    resolvePending();

    // Periodically buy a stock and run for office.
    if (y === 5) {
      const pub = Object.values(state.companies).find((c) => c.isPublic && c.status === 'active');
      if (pub) buyShares(state, pub.id, 100_000);
    }
    if (y === 10 && state.player.money > 50_000) {
      A.launchCampaign(state, 'councillor', 10_000, ['tax_cuts', 'jobs']);
    }
    if (y === 11 && state.player.campaign) {
      A.campaignAction(state, 'debate');
      A.holdPressConference(state);
      A.seekCelebrityEndorsement(state);
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
    // --- V4: financial instruments ---
    if (y === 8) {
      A.buyBond(state, state.player.countryId, 20_000, 5);
      A.buyLifeInsurance(state, 200);
      const co = state.player.companies[0];
      if (co) A.toggleCompanyInsurance(state, co);
      const other = state.countries.find((c) => c.id !== state.player.countryId);
      if (other) A.openForexPosition(state, other.id, 10_000, false);
    }
    if (y === 9 && state.player.bonds.length) A.sellBondEarly(state, state.player.bonds[0].id);
    if (y === 9 && state.player.forexPositions.length) A.closeForexPosition(state, state.player.forexPositions[0].id);
    // --- V4: diplomacy (only meaningful if the player ends up leading their country) ---
    if (y === 45) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      const other = state.countries.find((c) => c.id !== home.id)!;
      if (home.leaderId === 'player') {
        A.sendForeignAid(state, other.id);
        A.signTradeAgreement(state, other.id);
        A.imposeSanctions(state, other.id);
        A.liftSanctions(state, other.id);
      }
    }
    // --- V4: crime & underworld ---
    if (y === 12) A.joinCrimeFamily(state);
    if (y === 13 && state.player.crimeFamilyId) A.heist(state);
    if (y === 14 && state.player.crimeFamilyId) {
      const target = Object.values(state.companies).find((c) => c.status === 'active' && !c.playerOwned && c.countryId === state.player.countryId);
      if (target) A.protectionRacket(state, target.id);
    }
    if (y === 15 && state.player.crimeFamilyId) A.goStraight(state);
    if (state.player.inJailYears > 0 && y % 2 === 0) A.bribeJudge(state);
    // --- V4: relationships ---
    if (y === 16) F.seekMentor(state);
    if (y === 17) F.networking(state);
    if (y === 18 && !state.player.rivalId) {
      const candidates = F.relationshipCandidates(state);
      if (candidates.length) F.declareRival(state, candidates[0].id);
    }
    if (y === 19 && state.player.rivalId) F.endRivalry(state);
    // --- V4: real estate depth ---
    if (y === 21 && state.player.properties.length) {
      const prop = state.player.properties[0];
      A.renovateProperty(state, prop.id);
      A.toggleRentalStatus(state, prop.id);
      A.togglePropertyInsurance(state, prop.id);
    }
    // --- V4: business mechanics ---
    if (y === 22 && state.player.companies.length) {
      const co = state.player.companies[0];
      A.hireBrandAmbassador(state, co);
      A.runTrainingProgram(state, co);
      A.diversifySupplyChain(state, co);
      A.qualityAudit(state, co);
      A.proactiveRecall(state, co);
    }
    // --- V5: corporate culture & HQ tiers ---
    if (y === 26 && state.player.companies.length) {
      const co = state.player.companies[0];
      A.upgradeHQ(state, co);
      A.setCompanyCulture(state, co, 'startup');
      A.runGraduateProgram(state, co);
      A.runLeadershipProgram(state, co);
      A.fileTrademark(state, co);
    }
    // --- V5: political dynasty extension ---
    if (y === 27 && state.player.children.length && (state.player.partyId || state.player.office)) {
      const adultChild = state.player.children.map((id) => state.npcs[id]).find((c) => c && c.age >= 18);
      if (adultChild) namePoliticalHeir(state, adultChild.id);
    }
    // --- V5: government & economy tools (only meaningful when leading the country) ---
    if (y === 45) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') {
        A.setBudgetAllocation(state, 'Health', 25);
        A.setTaxRate(state, 'income', 32);
        A.launchInfrastructureProject(state, 'roads');
        A.hireAdvisor(state, 'economy');
        const advisor = state.player.advisors.find((a) => a.specialty === 'economy');
        if (advisor) A.advisorRecommendation(state, advisor);
        A.fundIntelligenceAgency(state, 50_000);
        A.counterEspionage(state);
        const other = state.countries.find((c) => c.id !== home.id);
        if (other) A.gatherIntelligence(state, other.id);
      }
    }
    // --- V6: corporate structure depth ---
    if (y === 28 && state.player.companies.length) {
      const co = state.player.companies[0];
      A.hireExecutive(state, co, 'cfo');
      A.hireExecutive(state, co, 'coo');
      A.hireExecutive(state, co, 'cmo');
      A.issueCorporateBond(state, co, 100_000, 5);
      A.spinOffCompany(state, co);
      const pub = Object.values(state.companies).find((c) => c.isPublic && c.playerOwned && c.status === 'active');
      if (pub) A.buybackShares(state, pub.id, Math.min(pub.cash, 20_000));
    }
    // --- V6: markets depth ---
    if (y === 29) {
      const pub = Object.values(state.companies).find((c) => c.isPublic && c.status === 'active');
      if (pub) {
        buyOnMargin(state, pub.id, 20_000);
        placeLimitOrder(state, pub.id, 'buy', pub.sharePrice * 0.9, 5_000);
        toggleDrip(state);
        if (state.player.limitOrders.length) cancelLimitOrder(state, state.player.limitOrders[0].id);
      }
    }
    // --- V6: government depth ---
    if (y === 31) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') {
        const cands = A.cabinetCandidates(state);
        if (cands.length) A.nominateChiefJustice(state, cands[0].id);
        const lawId = Object.keys(LAW_BY_ID).find((id) => !home.lawsInForce.includes(id));
        if (lawId) A.callReferendum(state, lawId);
        A.hireLobbyingFirm(state);
        A.foundAlliance(state, 'Test Pact');
        const other = state.countries.find((c) => c.id !== home.id);
        if (other && !home.atWarWith.includes(other.id)) A.declareWar(state, other.id, 'blockade');
      }
    }
    // --- V6: crime depth ---
    if (y === 32) {
      if (state.player.crimeFamilyId) A.contestTerritory(state);
      if (state.player.dirtyMoney > 0 && state.player.companies.length) A.launderMoney(state, state.player.companies[0], state.player.dirtyMoney);
      if (!state.player.crimeFamilyId && state.player.criminalRecord > 0) A.enterWitnessProtection(state);
    }
    // --- V6: family depth ---
    if (y === 33) {
      adoptChild(state);
      const heirCandidate = state.player.spouseId ?? state.player.children[0] ?? state.player.grandchildren[0];
      if (heirCandidate) namePrimaryHeir(state, heirCandidate);
    }
    // --- V6: world depth ---
    if (y === 34) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') {
        A.setImmigrationQuota(state, 75);
        A.launchInfrastructureProject(state, 'space_program');
      }
    }
    // --- V7: corporate/economic depth ---
    if (y === 36 && state.player.companies.length) {
      const co = state.player.companies[0];
      A.runRecruitmentDrive(state, co);
      A.franchiseCompany(state, co);
      A.launchLoyaltyProgram(state, co);
      const startupTarget = Object.values(state.companies).find(
        (c) => c.status === 'active' && !c.playerOwned && !c.isPublic && c.revenue < 3_000_000 && c.countryId === state.player.countryId,
      );
      if (startupTarget && state.player.money > 60_000) A.investInStartup(state, startupTarget.id, 50_000);
    }
    // --- V7: governance depth ---
    if (y === 37) {
      const pub = Object.values(state.companies).find((c) => c.isPublic && c.playerOwned && c.status === 'active');
      if (pub) {
        A.proposeBoardResolution(state, pub.id, 'increase_dividend');
        A.bidOnGovernmentContract(state, pub.id);
        A.applyForGrant(state, pub.id);
      }
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') {
        const corruptOfficial = Object.values(home.cabinet).map((id) => state.npcs[id]).find((n) => n && n.alive);
        if (corruptOfficial) A.investigateOfficial(state, corruptOfficial.id);
      }
    }
    // --- V7: science, health & energy depth ---
    if (y === 38) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player' && state.player.money > 100_000) {
        A.fundUniversityResearch(state, 40_000);
        A.investInHealthcare(state, 40_000);
        A.setEnergyMix(state, 60);
      }
      const healthCo = state.player.companies.map((id) => state.companies[id]).find((c) => {
        const ind = INDUSTRIES.find((i) => i.id === c.industryId);
        return ind && ind.tags.includes('health') && ind.techIntensity >= 0.5;
      });
      if (healthCo) A.runClinicalTrial(state, healthCo.id);
    }
    // --- V7: media, reputation & crisis depth ---
    if (y === 39) {
      const mediaCo = state.player.companies.map((id) => state.companies[id]).find((c) => {
        const ind = INDUSTRIES.find((i) => i.id === c.industryId);
        return ind && ind.tags.includes('media');
      });
      if (mediaCo) A.runFavorableCoverage(state, mediaCo.id);
      A.hirePRAgency(state);
    }
    // --- V7: diplomacy depth ---
    if (y === 41) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') A.attendSummit(state);
    }
    // --- V8: billionaire lifestyle & celebrity economy ---
    if (y === 42 && state.player.money > 5_000_000) {
      buyLuxuryAsset(state, 'racehorse');
      buyLuxuryAsset(state, 'artwork');
      const celeb = Object.values(state.npcs).find((n) => n.alive && n.role === 'celebrity' && n.countryId === state.player.countryId);
      if (celeb) investInCelebrityBrand(state, celeb.id, 50_000);
    }
    if (y === 43) {
      if (state.player.luxuryAssets.length) sellLuxuryAsset(state, state.player.luxuryAssets[0].id);
      if (state.player.celebrityStakes.length) divestCelebrityStake(state, state.player.celebrityStakes[0].npcId);
    }
    // --- V8: government depth (cabinet meetings, budget speech, protests, opinion dashboard) ---
    if (y === 44) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') {
        A.holdCabinetMeeting(state);
        A.deliverBudgetSpeech(state);
        if (home.unrest >= 30) A.respondToProtests(state, 'concede');
        publicOpinionBreakdown(home);
      }
    }
    // --- V8: corporate depth (retail security, investor conference, innovation race) ---
    if (y === 45 && state.player.companies.length) {
      const co = state.player.companies[0];
      A.investInRetailSecurity(state, co);
      A.holdInvestorConference(state, co);
      A.raceForInnovation(state, co);
    }
    // --- V8: world & economy depth (mega projects, debt market, cyber defense) ---
    if (y === 46) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') {
        A.launchInfrastructureProject(state, 'bridge');
        A.issueGovernmentBonds(state, 5);
        A.fundNationalCyberDefense(state, 100_000);
      }
    }
    // --- V11: crypto, banking, foundation, casino, memoir ---
    if (y === 47 && state.player.money > 50_000) {
      A.buyCrypto(state, 10_000);
      A.depositSavings(state, 10_000);
      A.openTermDeposit(state, 5_000, 3);
      A.playCasino(state, 'blackjack', 1_000);
      if (state.player.money > 300_000) A.foundCharityFoundation(state, 'Smoke Test Foundation');
      A.writeMemoir(state, 'Smoke: A Life');
    }
    if (y === 48 && state.player.cryptoUnits > 0) A.sellCrypto(state, state.player.cryptoUnits / 2);
    // --- V11: moonshot, CEO, global games, retirement ---
    if (y === 49 && state.player.companies.length) {
      const co = state.player.companies[0];
      A.startMoonshot(state, co);
      A.hireCEO(state, co);
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.leaderId === 'player') A.bidToHostGlobalGames(state);
    }
    if (y === 50 && state.player.age >= 60 && !state.player.retired) A.retire(state);
    // --- V12: the Studio (product design & commerce) ---
    if (y === 24 && state.player.companies.length) {
      const co = state.companies[state.player.companies[0]];
      if (co) co.cash = Math.max(co.cash, 2_000_000); // fund the pipeline for the exercise
      const created = P.createProduct(state, state.player.companies[0], 'smartphone', 'Smoke Phone');
      if (created.ok && created.productId) {
        const pid = created.productId;
        P.generateConcept(state, pid, 'minimalist eco-friendly smartphone');
        P.researchProductTech(state, 'green_materials');
        P.setProductMaterials(state, pid, 'aluminum', 'glass');
        P.updateProductForm(state, pid, { slimness: 0.8, finish: 'metallic' });
        P.setProductPackaging(state, pid, 'eco');
        P.buildPrototype(state, pid);
        P.runProductTests(state, pid);
        P.refineDesign(state, pid);
        P.fileProductPatent(state, pid);
        P.setProductPrice(state, pid, 750);
        P.setProductMarketing(state, pid, 100_000);
        P.setProductManufacturing(state, pid, 'regional');
        P.startProduction(state, pid);
        P.holdLaunchEvent(state, pid, 'convention_keynote');
      }
    }
    if (y === 30) {
      const launched = Object.values(state.products).find((pr) => pr.stage === 'launched');
      if (launched) P.upgradeGeneration(state, launched.id);
      P.setStorefront(state, { theme: 'noir' });
    }
    // --- V6: continue as heir when a succession offer appears ---
    if (state.pendingSuccession && state.pendingSuccession.candidates.length) {
      state = continueAsHeir(state, state.pendingSuccession.candidates[0].npcId);
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
console.log('  world event active at end:', state.worldEvent ? state.worldEvent.type : 'none');
console.log('  generation:', state.generation);
console.log('  daily flavor events fired (day/week ticks):', dailyFlavorCount);
console.log('  calendarDay at end:', state.calendarDay);
console.log('  crime rank:', state.player.crimeRank, 'in family:', !!state.player.crimeFamilyId);
console.log('  mentor:', state.player.mentorId ? state.npcs[state.player.mentorId]?.name ?? 'unknown' : 'none');
console.log('  rival:', state.player.rivalId ? state.npcs[state.player.rivalId]?.name ?? 'unknown' : 'none');
console.log('  bonds:', state.player.bonds.length, 'forex positions:', state.player.forexPositions.length, 'life insurance:', !!state.player.lifeInsurance);
console.log('  companies at HQ tier > 0:', Object.values(state.companies).filter((c) => c.hqTier > 0).length);
console.log('  political heir:', state.player.politicalHeirId ? state.npcs[state.player.politicalHeirId]?.name : 'none', '· dynasty score:', dynastyScore(state));
console.log('  advisors hired:', state.player.advisors.length);
console.log('  trademarks filed:', Object.values(state.companies).reduce((s, c) => s + c.trademarks, 0));
console.log('  companies acquired via NPC mergers:', Object.values(state.companies).filter((c) => c.status === 'acquired').length);
console.log('  executives hired (total across companies):', Object.values(state.companies).reduce((s, c) => s + c.executives.length, 0));
console.log('  companies with outstanding bonds:', Object.values(state.companies).filter((c) => c.bondDebt > 0).length);
console.log('  margin debt:', state.player.marginDebt, 'drip:', state.player.drip, 'limit orders:', state.player.limitOrders.length);
console.log('  alliances founded:', state.alliances.length);
console.log('  war strategies recorded:', Object.keys(state.countries.find((c) => c.isPlayerHome)?.warStrategies ?? {}).length);
console.log('  grandchildren:', state.player.grandchildren.length, 'primary heir:', state.player.primaryHeirId ? 'set' : 'none');
console.log('  dirty money remaining:', state.player.dirtyMoney, 'turf control:', state.player.turfControl, 'witness protection:', state.player.inWitnessProtection);
console.log('  active challenge:', state.player.challenge?.description ?? 'none');
console.log('  year recap present:', !!state.yearRecap);
console.log('  franchise locations:', Object.values(state.companies).reduce((s, c) => s + c.franchiseCount, 0));
console.log('  loyalty programs running:', Object.values(state.companies).filter((c) => c.loyaltyProgram).length);
console.log('  think tank funded:', state.player.thinkTankFunded, 'PR agency hired:', state.player.prAgencyHired);
console.log('  luxury assets:', state.player.luxuryAssets.length, 'celebrity stakes:', state.player.celebrityStakes.length);
console.log('  world history entries:', state.worldHistory.length);
console.log('  companies with security invested:', Object.values(state.companies).filter((c) => c.securityInvested).length);
console.log('  home unrest:', Math.round(state.countries.find((c) => c.id === state.player.countryId)?.unrest ?? 0));
console.log('  home cyber defense:', Math.round(state.countries.find((c) => c.id === state.player.countryId)?.cyberDefense ?? 0));
console.log('  opposition leader assigned:', !!state.countries.find((c) => c.id === state.player.countryId)?.oppositionLeaderId);
console.log('  crypto price:', Math.round(state.cryptoPrice), 'units held:', state.player.cryptoUnits.toFixed(4));
console.log('  savings:', state.player.savingsBalance, 'term deposits:', state.player.termDeposits.length);
console.log('  foundation:', state.player.foundation ? `${state.player.foundation.name} ($${Math.round(state.player.foundation.totalGiven)} given)` : 'none');
console.log('  retired:', state.player.retired, 'pension:', state.player.pensionIncome);
console.log('  memoir:', state.player.memoir?.title ?? 'none / expired');
console.log('  CEOs hired:', Object.values(state.companies).filter((c) => c.ceoName).length, 'moonshots active:', Object.values(state.companies).filter((c) => c.moonshot).length);
const allProducts = Object.values(state.products);
console.log('  products designed:', allProducts.length, '· launched:', allProducts.filter((p) => p.stage === 'launched').length);
console.log('  product units sold:', allProducts.reduce((s, p) => s + p.unitsSoldTotal, 0).toLocaleString(), '· product profit:', Math.round(allProducts.reduce((s, p) => s + p.profitTotal, 0)).toLocaleString());
console.log('  product tech unlocked:', state.productTech.join(', ') || 'none', '· storefront theme:', state.storefront.theme);
console.log('  errors:', errors);

// Invariant checks
const bad: string[] = [];
if (Number.isNaN(nw)) bad.push('net worth is NaN');
if (Number.isNaN(state.player.money)) bad.push('money is NaN');
if (Number.isNaN(state.calendarDay) || state.calendarDay < 0 || state.calendarDay > 364) bad.push(`calendarDay out of range: ${state.calendarDay}`);
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
