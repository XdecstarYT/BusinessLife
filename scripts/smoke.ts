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
import { playerCrimeFamily } from '../src/sim/crime';
import { spinSlotMachine, playTableGame, spinRoulette, playCoinFlip, sportsMatches, placeSportsBet } from '../src/sim/casino';
import { SLOT_MACHINES } from '../src/data/casino';
import { INDUSTRIES } from '../src/data/industries';
import { LAW_BY_ID } from '../src/data/laws';
import { SK } from '../src/data/skills';

// --- V6: scenario presets + difficulty + legacy bonus sanity check (no full sim) ---
{
  const boomWorld = generateWorld({ playerName: 'Boom Test', gender: 'female', seedText: 'boom-check', scenario: 'boom', difficulty: 'ironman', legacyBonus: 50_000 });
  const home = boomWorld.countries.find((c) => c.isPlayerHome)!;
  console.log('Scenario/difficulty check: regime =', home.economy.regime, '· difficulty =', boomWorld.difficulty, '· starting money >= 50000:', boomWorld.player.money >= 50_000);
}

// --- Leaderboard "born into royalty" perk: starting stats/money should be far above normal, and
// the achievement + a flavor life-log entry should be present.
{
  const normalWorld = generateWorld({ playerName: 'Commoner Test', gender: 'male', seedText: 'royal-check-normal' });
  const royalWorld = generateWorld({ playerName: 'Royal Test', gender: 'male', seedText: 'royal-check-royal', bornRoyal: true });
  console.log(
    'Royalty check: normal money =', Math.round(normalWorld.player.money),
    '· royal money =', Math.round(royalWorld.player.money),
    '· royal reputation =', royalWorld.player.reputation,
    '· achievement present =', royalWorld.achievements.includes('born_royal'),
    '· royal money > normal:', royalWorld.player.money > normalWorld.player.money,
  );
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

// V33: adopt pets, play, and gamble on the lottery/scratchers.
A.adoptPet(state, 'dog');
A.adoptPet(state, 'cat');
if (state.player.pets[0]) A.playWithPet(state, state.player.pets[0].id);
for (let i = 0; i < 25; i++) A.buyLotteryTicket(state);
for (let i = 0; i < 35; i++) A.buyScratchCard(state);
console.log(
  'V33 setup: pets =', state.player.pets.length,
  '· bucket goals =', state.bucketList.length,
  '· lottery tickets used =', state.player.lotteryTicketsThisYear, '(cap 20)',
  '· scratch cards used =', state.player.scratchCardsThisYear, '(cap 30)',
);

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

    // --- V16: career & work-life realism ---
    if (y === 4 && !state.player.job) {
      const openings = A.jobOpenings(state);
      const qualifying = openings.find((o) => state.player.smarts >= o.requiredSmarts);
      if (qualifying) A.takeJob(state, qualifying, true);
      if (state.player.job) {
        A.setWorkStyle(state, 'overtime');
        const first = state.player.job.coworkers[0];
        if (first) A.networkWithCoworker(state, first.id);
      }
    }
    if (y === 7 && state.player.job) {
      A.applyForPromotion(state);
      const peer = state.player.job.coworkers.find((c) => c.role === 'peer');
      if (peer) A.reportToHR(state, peer.id);
      A.setWorkStyle(state, 'flexible');
    }
    if (y === 7) {
      for (const gigId of ['coding', 'rideshare', 'design_work']) A.takeFreelanceGig(state, gigId);
    }

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
      // A second property, deliberately run on minimal upkeep, to exercise
      // condition decay, structural risk and the renovation recovery path.
      const neglected = listings.find((l) => l.kind !== 'land') ?? listings[1];
      if (neglected) A.buyProperty(state, neglected, false);
    }
    if (y === 22 && state.player.properties.length > 1) {
      A.setMaintenanceLevel(state, state.player.properties[1].id, 'minimal');
    }
    // --- V19: education depth (enroll then drop out partway through) ---
    if (y === 23 && !state.player.studying) A.enroll(state, 4);
    if (y === 25 && state.player.studying) A.dropOutOfSchool(state);
    // --- V19: mental health (lifestyle actions already tick p.stress; explicit therapy check) ---
    if (y === 23) A.doActivity(state, 'therapy');
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
    if (y === 31 && state.player.companies.length) {
      const myCo = state.companies[state.player.companies[0]];
      const rival = myCo && Object.values(state.companies).find(
        (c) => c.status === 'active' && !c.playerOwned && c.industryId === myCo.industryId,
      );
      if (myCo && rival) {
        if (myCo.patents > 0) A.filePatentLawsuit(state, myCo.id, rival.id);
        if (!myCo.jointVenturePartnerId) A.proposeJointVenture(state, myCo.id, rival.id, Math.min(myCo.cash * 0.3, 100_000));
      }
    }
    if (y === 32) {
      const home = state.countries.find((c) => c.id === state.player.countryId)!;
      if (home.system === 'parliamentary' && home.leaderId && home.leaderId !== 'player' && state.player.partyId) {
        A.callNoConfidenceVote(state);
      }
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
    if (y === 14 && state.player.crimeFamilyId) {
      const mine = playerCrimeFamily(state);
      const rival = mine && state.crimeFamilies.find((f) => f.countryId === state.player.countryId && f.id !== mine.id && !f.disbanded);
      if (rival) A.proposeCrimeAlliance(state, rival.id);
    }
    if (y === 14 && state.player.crimeFamilyId) {
      const mine = playerCrimeFamily(state);
      const rival = mine && state.crimeFamilies.find((f) => f.countryId === state.player.countryId && f.id !== mine.id && !f.disbanded && !mine.alliedWith.includes(f.id));
      if (rival) A.declareCrimeWar(state, rival.id);
    }
    if (y === 15 && state.player.crimeFamilyId) A.goStraight(state);
    if (state.player.inJailYears > 0 && y % 2 === 0) A.bribeJudge(state);
    if (state.player.inJailYears > 0 && y % 2 === 1) A.requestParole(state);
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
      playTableGame(state, 'blackjack', 1_000);
      playTableGame(state, 'poker', 500);
      spinSlotMachine(state, 'lucky_sevens', 100);
      if (state.player.money + state.player.savingsBalance >= 2_000_000) spinSlotMachine(state, 'diamond_royale', 5_000);
      spinRoulette(state, { kind: 'red' }, 200);
      spinRoulette(state, { kind: 'straight', number: 17 }, 50);
      playCoinFlip(state, 'heads', 100);
      const slate = sportsMatches(state);
      if (slate.length) {
        placeSportsBet(state, slate[0].id, 'home', 300);
        placeSportsBet(state, slate[1].id, 'away', 150);
      }
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
        // --- V13: per-part customization, colorways, components, research, warranty ---
        P.applyColorway(state, pid, 'midnight');
        P.setPartOverride(state, pid, 'camera', { color: '#e8b84a', materialId: 'titanium' });
        P.setPartOverride(state, pid, 'buttons', { finish: 'gloss' });
        P.setPartOverride(state, pid, 'screen', { color: '#8ab4ff' });
        P.setPartOverride(state, pid, 'logo', { color: '#ffffff' });
        P.clearPartOverride(state, pid, 'logo');
        P.setComponentTier(state, pid, 'chip', 'premium');
        P.setComponentTier(state, pid, 'battery', 'budget');
        P.setComponentTier(state, pid, 'battery', 'premium');
        P.setComponentTier(state, pid, 'display_panel', 'premium');
        P.runFocusGroup(state, pid, 'early_adopters');
        P.runFocusGroup(state, pid, 'value');
        P.runFocusGroup(state, pid, 'luxury_buyers');
        P.runFocusGroup(state, pid, 'eco');
        P.runFocusGroup(state, pid, 'families');
        P.setTargetSegment(state, pid, 'early_adopters');
        P.setWarranty(state, pid, 2);
        // --- V13: player-engineered components ---
        const eng = P.engineerPart(state, state.player.companies[0], 'battery', 'Bat62', 300_000);
        if (eng.ok && eng.productId) {
          const battId = eng.productId;
          P.revisePart(state, battId, 75_000);
          P.setPartForSale(state, battId, true);
          P.setComponentTier(state, pid, 'battery', battId);
        }
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
    // --- V13: a second product in a new category + recall handling ---
    if (y === 32 && state.player.companies.length) {
      const co = state.companies[state.player.companies[0]];
      if (co) co.cash = Math.max(co.cash, 2_000_000);
      const created = P.createProduct(state, state.player.companies[0], 'drone', 'Smoke Drone');
      if (created.ok && created.productId) {
        const pid = created.productId;
        P.generateConcept(state, pid, 'futuristic carbon racing drone');
        P.setPartOverride(state, pid, 'rotors', { color: '#ff6a3d' });
        P.setComponentTier(state, pid, 'motor', 'premium');
        P.buildPrototype(state, pid);
        P.runProductTests(state, pid);
        P.startProduction(state, pid);
        P.holdLaunchEvent(state, pid, 'livestream');
      }
    }
    // Any festering defect gets a recall once the company can afford it.
    for (const pr of Object.values(state.products)) {
      if (pr.activeDefect) P.issueRecall(state, pr.id);
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
console.log(
  '  crime families: active',
  state.crimeFamilies.filter((f) => !f.disbanded).length,
  '· disbanded',
  state.crimeFamilies.filter((f) => f.disbanded).length,
  '· at war',
  state.crimeFamilies.filter((f) => f.atWarWith.length > 0).length,
  '· allied',
  state.crimeFamilies.filter((f) => f.alliedWith.length > 0).length,
);
console.log(
  '  casino: wagered', Math.round(state.player.casinoTotalWagered), '· biggest win', Math.round(state.player.casinoBiggestWin),
  '· jackpots tracked', Object.keys(state.casinoJackpots).length, 'of', SLOT_MACHINES.length,
);
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
const allParts = Object.values(state.customParts ?? {});
console.log('  custom parts engineered:', allParts.length, '· units sold:', allParts.reduce((s, p) => s + p.unitsSoldTotal, 0).toLocaleString(), '· revenue:', Math.round(allParts.reduce((s, p) => s + p.revenueTotal, 0)).toLocaleString());
console.log('  properties:', state.player.properties.map((pr) => `${pr.kind} cond=${Math.round(pr.condition)} eff=${Math.round(pr.energyEfficiency)} maint=${pr.maintenanceLevel} val=$${Math.round(pr.value).toLocaleString()}`).join(' | ') || 'none');
console.log('  education:', state.player.education.map((e) => `${e.degree}/${e.field}`).join(', ') || 'none', '· management skill (graduation bonus):', Math.round(state.player.skills[SK.management] ?? 0));
console.log('  stress:', Math.round(state.player.stress), '· burnout until:', state.player.burnoutUntilYear ?? 'n/a', '· investigation heat:', Math.round(state.player.investigationHeat), '· years served this sentence:', state.player.yearsServedThisSentence);
const jvActive = Object.values(state.companies).filter((c) => c.jointVenturePartnerId).length;
console.log('  joint ventures active:', jvActive, '· total lawsuits across all companies:', Object.values(state.companies).reduce((s, c) => s + c.lawsuits, 0));
console.log('  pets alive at end:', state.player.pets.length, '· bucket goals done:', state.bucketList.filter((g) => g.done).length, 'of', state.bucketList.length);
console.log('  errors:', errors);

// Invariant checks
const bad: string[] = [];
if (Number.isNaN(nw)) bad.push('net worth is NaN');
if (Number.isNaN(state.player.money)) bad.push('money is NaN');
if (Number.isNaN(state.player.stress) || state.player.stress < 0 || state.player.stress > 100) bad.push(`stress out of range: ${state.player.stress}`);
if (Number.isNaN(state.player.investigationHeat) || state.player.investigationHeat < 0 || state.player.investigationHeat > 100) bad.push(`investigationHeat out of range: ${state.player.investigationHeat}`);
if (Number.isNaN(state.calendarDay) || state.calendarDay < 0 || state.calendarDay > 364) bad.push(`calendarDay out of range: ${state.calendarDay}`);
for (const c of state.countries) {
  if (Number.isNaN(c.economy.gdp)) bad.push(`${c.name} gdp NaN`);
  if (Number.isNaN(c.economy.stockIndex)) bad.push(`${c.name} stockIndex NaN`);
}
for (const c of Object.values(state.companies)) {
  if (Number.isNaN(c.revenue) || Number.isNaN(c.sharePrice)) bad.push(`company ${c.name} NaN`);
}
for (const pr of state.player.properties) {
  if (Number.isNaN(pr.value) || Number.isNaN(pr.condition) || Number.isNaN(pr.energyEfficiency)) bad.push(`property ${pr.name} NaN`);
  if (pr.condition < 0 || pr.condition > 100) bad.push(`property ${pr.name} condition out of range: ${pr.condition}`);
  if (pr.energyEfficiency < 0 || pr.energyEfficiency > 100) bad.push(`property ${pr.name} efficiency out of range: ${pr.energyEfficiency}`);
}
if (bad.length) {
  console.error('\nINVARIANT FAILURES:', bad.slice(0, 10));
  process.exit(1);
}
if (errors > 0) process.exit(1);
console.log('\n✅ Smoke test passed — no errors, no NaNs.');
