/**
 * Event template catalogue. Templates are matched against the live game state
 * each year and instantiated with resolved placeholders ({npc}, {company},
 * {amount}, ...) — so a modest number of templates yields thousands of
 * distinct scenarios. Adding content means adding entries here; the engine
 * never special-cases individual events.
 */
import type { EventTemplate } from '../sim/types';
import { SK } from './skills';

const E: EventTemplate[] = [];
function ev(t: EventTemplate) {
  E.push(t);
}

// ---------------------------------------------------------------------------
// LIFE & HEALTH
// ---------------------------------------------------------------------------
ev({
  id: 'life_gym_offer', category: 'health', weight: 6, text: 'A new gym opened near your place in {city}. A yearly membership costs {amount}.',
  amount: { min: 400, max: 1500 },
  choices: [
    { label: 'Join and actually go', effects: { moneyAmountMult: -1, health: 6, happiness: 2, skillXp: [SK.fitness, 8] } },
    { label: 'Join and never go', effects: { moneyAmountMult: -1, happiness: -1 } },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'life_burnout', category: 'health', weight: 5, conditions: { employed: true },
  text: 'Months of long hours are catching up with you. You feel burned out.',
  choices: [
    { label: 'Take unpaid leave', effects: { money: -3000, health: 8, happiness: 8, jobPerformance: -5 } },
    { label: 'Push through', outcomes: [
      { chance: 0.5, text: 'You gutted it out and impressed the bosses.', effects: { jobPerformance: 8, health: -6 } },
      { chance: 0.5, text: 'Your body gave out. You collapsed at work.', effects: { health: -15, happiness: -8, jobPerformance: -4 } },
    ] },
    { label: 'See a therapist', effects: { money: -2400, health: 4, happiness: 6 } },
  ],
});
ev({
  id: 'life_illness_scare', category: 'health', weight: 4, conditions: { minAge: 30 },
  text: 'A routine checkup found something that worries your doctor. Further tests cost {amount}.',
  amount: { min: 2000, max: 12000 },
  choices: [
    { label: 'Get the tests', outcomes: [
      { chance: 0.75, text: 'All clear. A huge relief.', effects: { moneyAmountMult: -1, happiness: 5 } },
      { chance: 0.25, text: 'Caught early and treated. Expensive, but you recovered.', effects: { moneyAmountMult: -3, health: -8, happiness: -4 } },
    ] },
    { label: 'Ignore it', outcomes: [
      { chance: 0.6, text: 'It turned out to be nothing.', effects: {} },
      { chance: 0.4, text: 'It got worse before you finally dealt with it.', effects: { health: -18, money: -25000, happiness: -8 } },
    ] },
  ],
});
ev({
  id: 'life_marathon', category: 'health', weight: 3, conditions: { minAge: 20, maxAge: 60 },
  text: 'A charity marathon is being organized in {city}. Entry raises money for local hospitals.',
  choices: [
    { label: 'Train and run it', skillCheck: { skillId: SK.fitness, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.5, text: 'You finished! Local media covered your effort.', effects: { health: 5, happiness: 6, popularity: 2, reputation: 1, skillXp: [SK.fitness, 10] } },
      { chance: 0.5, text: 'You pulled a hamstring at mile 18.', effects: { health: -6, happiness: -2 } },
    ] },
    { label: 'Sponsor a runner instead', effects: { money: -1000, karma: 3, reputation: 1 } },
    { label: 'Not your thing', effects: {} },
  ],
});
ev({
  id: 'life_old_friend', category: 'life', weight: 6,
  text: '{npc}, an old friend, reaches out wanting to reconnect over dinner.',
  choices: [
    { label: 'Catch up', effects: { happiness: 4, charisma: 1 } },
    { label: 'Too busy', effects: { happiness: -1, karma: -1 } },
  ],
});
ev({
  id: 'life_hobby_class', category: 'life', weight: 5,
  text: 'An evening class caught your eye. Which one?',
  choices: [
    { label: 'Poker strategy ({amount})', effects: { moneyAmountMult: -1, skillXp: [SK.poker, 15], happiness: 2 } },
    { label: 'Public speaking ({amount})', effects: { moneyAmountMult: -1, skillXp: [SK.publicSpeaking, 15], charisma: 2 } },
    { label: 'Economics ({amount})', effects: { moneyAmountMult: -1, skillXp: [SK.economics, 15], smarts: 2 } },
    { label: 'Save the money', effects: {} },
  ],
  amount: { min: 300, max: 900 },
});
ev({
  id: 'life_lottery', category: 'life', weight: 3,
  text: 'The national lottery jackpot hit a record. A ticket costs almost nothing, the dream costs less.',
  choices: [
    { label: 'Buy a ticket', outcomes: [
      { chance: 0.001, text: 'YOU WON THE JACKPOT. Life will never be the same.', effects: { money: 5_000_000, happiness: 20 } },
      { chance: 0.05, text: 'You won a minor prize.', effects: { money: 2_000, happiness: 3 } },
      { chance: 0.949, text: 'Nothing. As expected.', effects: { money: -20 } },
    ] },
    { label: 'The lottery is a tax on hope', effects: { smarts: 1 } },
  ],
});
ev({
  id: 'life_wedding_invite', category: 'family', weight: 4,
  text: '{npc} is getting married and invited you to a lavish wedding abroad. The trip would cost {amount}.',
  amount: { min: 2500, max: 8000 },
  choices: [
    { label: 'Attend', effects: { moneyAmountMult: -1, happiness: 6, charisma: 1, influence: 1 } },
    { label: 'Send a gift instead', effects: { money: -500, karma: 1 } },
    { label: 'Decline', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'life_scam_call', category: 'life', weight: 5,
  text: 'A caller claiming to be from your bank says your account is compromised and asks you to "verify" your details.',
  choices: [
    { label: 'Hang up and call the bank directly', effects: { smarts: 1, happiness: 1 } },
    { label: 'Give them your details', outcomes: [
      { chance: 0.9, text: 'It was a scam. They drained part of your account.', effects: { moneyPct: -0.1, happiness: -6 } },
      { chance: 0.1, text: 'Amazingly, it really was the bank.', effects: {} },
    ] },
  ],
});
ev({
  id: 'life_inheritance', category: 'family', weight: 2, once: true, conditions: { minAge: 30 },
  text: 'A distant relative passed away and left you {amount} in their will.',
  amount: { min: 20_000, max: 250_000 },
  choices: [
    { label: 'Accept gratefully', effects: { moneyAmountMult: 1, happiness: 3 } },
    { label: 'Donate it to charity', effects: { karma: 8, reputation: 3, popularity: 2, happiness: 4 } },
  ],
});
ev({
  id: 'life_mentor', category: 'life', weight: 3, conditions: { maxAge: 35 },
  text: '{npc}, a respected figure in {city}, offers to mentor you after seeing your drive.',
  choices: [
    { label: 'Accept the mentorship', effects: { smarts: 3, influence: 3, skillXp: [SK.strategy, 12], happiness: 2 } },
    { label: 'Go your own way', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'life_burglary', category: 'life', weight: 3,
  text: 'You came home to find your place burgled.',
  choices: [
    { label: 'File a police report and claim insurance', effects: { money: -2000, happiness: -5 } },
    { label: 'Install a security system', effects: { money: -4500, happiness: -3 } },
    { label: 'Ask around the neighborhood yourself', skillCheck: { skillId: SK.streetSmarts, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.35, text: 'You tracked down the thief and got your things back.', effects: { happiness: 3, notoriety: 2, skillXp: [SK.streetSmarts, 10] } },
      { chance: 0.65, text: 'No luck. The stuff is gone.', effects: { money: -3000, happiness: -5 } },
    ] },
  ],
});
ev({
  id: 'life_book_deal', category: 'media', weight: 2, conditions: { minReputation: 55 },
  text: 'A publisher wants your memoir. They offer a {amount} advance.',
  amount: { min: 50_000, max: 400_000 },
  choices: [
    { label: 'Write it yourself', skillCheck: { skillId: SK.journalism, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'A bestseller! Royalties keep flowing.', effects: { moneyAmountMult: 2, reputation: 6, popularity: 4, happiness: 5 } },
      { chance: 0.5, text: 'Reviews were brutal, sales modest.', effects: { moneyAmountMult: 1, reputation: -2 } },
    ] },
    { label: 'Use a ghostwriter', effects: { moneyAmountMult: 0.7, reputation: 2, popularity: 2 } },
    { label: 'Decline', effects: {} },
  ],
});
ev({
  id: 'life_midlife', category: 'life', weight: 3, once: true, conditions: { minAge: 45, maxAge: 55 },
  text: 'You wake up one morning gripped by the sense that time is running out. What do you do about it?',
  choices: [
    { label: 'Buy the sports car', effects: { money: -120_000, happiness: 8 } },
    { label: 'Recommit to your goals', effects: { happiness: 3, smarts: 2, skillXp: [SK.strategy, 10] } },
    { label: 'Take a sabbatical year', effects: { moneyPct: -0.05, happiness: 10, health: 5, jobPerformance: -10 } },
  ],
});

// ---------------------------------------------------------------------------
// CAREER
// ---------------------------------------------------------------------------
ev({
  id: 'career_promotion_shot', category: 'career', weight: 8, conditions: { employed: true },
  text: 'A senior role opened up at {employer}. Your manager hints you should go for it.',
  choices: [
    { label: 'Apply and prepare hard', skillCheck: { skillId: SK.management, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.45, text: 'You got the promotion!', effects: { jobPerformance: 10, happiness: 6, reputation: 3, skillXp: [SK.management, 10] } },
      { chance: 0.55, text: 'They hired externally. Frustrating.', effects: { happiness: -4, jobPerformance: 2 } },
    ] },
    { label: 'Stay in your lane', effects: {} },
  ],
});
ev({
  id: 'career_poached', category: 'career', weight: 5, conditions: { employed: true, minReputation: 40 },
  text: 'A rival firm tries to poach you with a 25% pay bump.',
  choices: [
    { label: 'Take the offer', effects: { happiness: 3, reputation: 1 } },
    { label: 'Use it to negotiate a raise', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'Your employer matched it to keep you.', effects: { jobPerformance: 3, happiness: 4, skillXp: [SK.negotiation, 12] } },
      { chance: 0.45, text: 'They called your bluff. Awkward.', effects: { jobPerformance: -5, happiness: -3 } },
    ] },
    { label: 'Stay loyal', effects: { jobPerformance: 2, karma: 2 } },
  ],
});
ev({
  id: 'career_office_politics', category: 'career', weight: 6, conditions: { employed: true },
  text: 'A colleague is quietly taking credit for your work in front of leadership.',
  choices: [
    { label: 'Confront them directly', skillCheck: { skillId: SK.persuasion, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'They backed down and gave you credit.', effects: { jobPerformance: 5, reputation: 2, happiness: 3 } },
      { chance: 0.5, text: 'It blew up into an ugly feud.', effects: { jobPerformance: -3, happiness: -4 } },
    ] },
    { label: 'Document everything and inform your manager', effects: { jobPerformance: 4, smarts: 1 } },
    { label: 'Let it slide', effects: { happiness: -3, karma: 1 } },
  ],
});
ev({
  id: 'career_layoffs', category: 'career', weight: 5, conditions: { employed: true, regime: ['recession', 'depression'] },
  text: 'The downturn hit {employer} hard. Layoff rumors are everywhere.',
  choices: [
    { label: 'Work visibly harder', effects: { jobPerformance: 6, health: -3, happiness: -2 } },
    { label: 'Quietly line up other options', effects: { smarts: 1, skillXp: [SK.strategy, 6] } },
    { label: 'Volunteer for redundancy and take the package', effects: { money: 30_000, loseJob: true, happiness: 2 } },
  ],
});
ev({
  id: 'career_conference', category: 'career', weight: 5, conditions: { employed: true },
  text: 'An industry conference in {city} could boost your profile. Ticket and travel: {amount}.',
  amount: { min: 1200, max: 4000 },
  choices: [
    { label: 'Attend and network hard', effects: { moneyAmountMult: -1, influence: 3, reputation: 2, skillXp: [SK.charm, 8], charisma: 1 } },
    { label: 'Attend and speak on a panel', skillCheck: { skillId: SK.publicSpeaking, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'Your talk was the highlight of the day.', effects: { moneyAmountMult: -1, reputation: 5, influence: 4, popularity: 1, skillXp: [SK.publicSpeaking, 15] } },
      { chance: 0.45, text: 'You froze mid-sentence. Ouch.', effects: { moneyAmountMult: -1, reputation: -2, happiness: -3 } },
    ] },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'career_whistleblow', category: 'career', weight: 3, conditions: { employed: true },
  text: 'You discover {employer} is falsifying safety reports. Regulators would want to know.',
  choices: [
    { label: 'Blow the whistle', outcomes: [
      { chance: 0.5, text: 'You were vindicated and publicly praised — but lost your job.', effects: { reputation: 8, karma: 10, popularity: 4, loseJob: true } },
      { chance: 0.5, text: 'You were smeared and pushed out before the truth surfaced.', effects: { reputation: -4, karma: 8, loseJob: true, happiness: -6 } },
    ] },
    { label: 'Raise it internally', effects: { jobPerformance: -2, karma: 4 } },
    { label: 'Stay quiet', effects: { karma: -6, happiness: -3 } },
    { label: 'Quietly demand a payoff', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.5, text: 'They paid for your silence.', effects: { money: 80_000, karma: -10, notoriety: 3 } },
      { chance: 0.5, text: 'They fired you and threatened legal action.', effects: { loseJob: true, reputation: -6, karma: -8 } },
    ] },
  ],
});
ev({
  id: 'career_side_hustle', category: 'career', weight: 5, conditions: { employed: true, maxMoney: 500_000 },
  text: 'You have an idea for a side hustle you could run on weekends.',
  choices: [
    { label: 'Start it small ({amount})', effects: { moneyAmountMult: -1, skillXp: [SK.sales, 10] }, outcomes: [
      { chance: 0.5, text: 'It brings in steady extra cash.', effects: { money: 12_000, happiness: 3 } },
      { chance: 0.5, text: 'It fizzled out after a few months.', effects: { happiness: -2 } },
    ] },
    { label: 'Focus on the day job', effects: { jobPerformance: 2 } },
  ],
  amount: { min: 2000, max: 8000 },
});
ev({
  id: 'career_mba', category: 'career', weight: 4, conditions: { minAge: 24, maxAge: 45, studying: false },
  text: 'An executive MBA programme is accepting applications. Two years part-time, {amount} tuition.',
  amount: { min: 40_000, max: 120_000 },
  choices: [
    { label: 'Enroll', effects: { moneyAmountMult: -1, smarts: 4, skillXp: [SK.management, 20], reputation: 3, influence: 2 } },
    { label: 'Learn on the job instead', effects: { skillXp: [SK.management, 5] } },
  ],
});

// ---------------------------------------------------------------------------
// BUSINESS
// ---------------------------------------------------------------------------
ev({
  id: 'biz_key_employee_quit', category: 'business', weight: 7, conditions: { hasBusiness: true },
  text: 'Your best manager at {company} just resigned to join a competitor.',
  choices: [
    { label: 'Counter-offer with a big raise', effects: { companyCash: -60_000, companyMorale: 4 } },
    { label: 'Let them go and promote from within', effects: { companyMorale: 3, skillXp: [SK.management, 8] } },
    { label: 'Threaten to enforce the non-compete', outcomes: [
      { chance: 0.4, text: 'They stayed, resentfully.', effects: { companyMorale: -6 } },
      { chance: 0.6, text: 'It got ugly and public.', effects: { companyBrand: -4, reputation: -2 } },
    ] },
  ],
});
ev({
  id: 'biz_viral_moment', category: 'business', weight: 5, conditions: { hasBusiness: true },
  text: 'A post about {company} unexpectedly went viral. Attention is pouring in.',
  choices: [
    { label: 'Ride the wave with a marketing push', effects: { companyCash: -40_000, companyBrand: 8 } },
    { label: 'Stay humble and thank customers', effects: { companyBrand: 4, reputation: 2, karma: 2 } },
  ],
});
ev({
  id: 'biz_supplier_crisis', category: 'business', weight: 6, conditions: { hasBusiness: true },
  text: 'Your main supplier for {company} suddenly doubled prices, blaming shipping costs.',
  choices: [
    { label: 'Negotiate hard', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'You clawed most of the increase back.', effects: { skillXp: [SK.negotiation, 12] } },
      { chance: 0.45, text: 'They wouldn\'t budge. Margins take a hit.', effects: { companyCash: -80_000 } },
    ] },
    { label: 'Find a new supplier', outcomes: [
      { chance: 0.6, text: 'The new supplier is cheaper and better.', effects: { companyQuality: 3, skillXp: [SK.operations, 10] } },
      { chance: 0.4, text: 'The transition caused quality problems.', effects: { companyQuality: -5, companyBrand: -3 } },
    ] },
    { label: 'Pass costs to customers', effects: { companyBrand: -3, companyCash: 30_000 } },
  ],
});
ev({
  id: 'biz_lawsuit', category: 'business', weight: 5, conditions: { hasBusiness: true },
  text: 'A customer is suing {company} for {amount}, alleging your product caused them harm.',
  amount: { min: 100_000, max: 2_000_000 },
  choices: [
    { label: 'Settle quietly', effects: { moneyAmountMult: 0, companyCash: -200_000, companyBrand: -1 } },
    { label: 'Fight it in court', skillCheck: { skillId: SK.law, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You won. The claim was baseless.', effects: { companyBrand: 3, reputation: 2 } },
      { chance: 0.45, text: 'You lost, with costs.', effects: { companyCash: -600_000, companyBrand: -6 } },
    ] },
  ],
});
ev({
  id: 'biz_acquisition_offer', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: '{npc} of a larger rival wants to acquire {company}. The offer is generous but they\'d gut the team.',
  choices: [
    { label: 'Hear them out (opens Sell option in Business tab)', effects: { influence: 1 } },
    { label: 'Refuse on principle', effects: { companyMorale: 6, reputation: 2, karma: 2 } },
  ],
});
ev({
  id: 'biz_union_drive', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'Employees at {company} are organizing a union.',
  choices: [
    { label: 'Recognize it and negotiate', effects: { companyMorale: 8, companyCash: -100_000, reputation: 2, karma: 3 } },
    { label: 'Run a counter-campaign', outcomes: [
      { chance: 0.5, text: 'The drive fizzled, but trust is damaged.', effects: { companyMorale: -6 } },
      { chance: 0.5, text: 'It backfired badly — walkouts and headlines.', effects: { companyMorale: -10, companyBrand: -6, reputation: -3 } },
    ] },
  ],
});
ev({
  id: 'biz_cyberattack', category: 'business', weight: 5, conditions: { hasBusiness: true },
  text: 'Hackers breached {company}\'s systems and are demanding a {amount} ransom.',
  amount: { min: 50_000, max: 500_000 },
  choices: [
    { label: 'Pay the ransom', effects: { moneyAmountMult: 0, companyCash: -250_000, karma: -2 } },
    { label: 'Refuse and rebuild', skillCheck: { skillId: SK.cybersecurity, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'Your team contained it. Security hardened.', effects: { companyQuality: 2, skillXp: [SK.cybersecurity, 12] } },
      { chance: 0.5, text: 'Customer data leaked. The press had a field day.', effects: { companyBrand: -8, companyCash: -300_000 } },
    ] },
  ],
});
ev({
  id: 'biz_influencer', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A famous influencer offers to promote {company} for {amount}.',
  amount: { min: 20_000, max: 150_000 },
  choices: [
    { label: 'Pay for the campaign', outcomes: [
      { chance: 0.6, text: 'Sales jumped noticeably.', effects: { moneyAmountMult: 0, companyCash: -60_000, companyBrand: 7 } },
      { chance: 0.4, text: 'The influencer got cancelled a week later.', effects: { moneyAmountMult: 0, companyCash: -60_000, companyBrand: -4 } },
    ] },
    { label: 'Decline', effects: {} },
  ],
});
ev({
  id: 'biz_bribe_inspector', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A government inspector hints that {amount} in cash would make {company}\'s compliance issues disappear.',
  amount: { min: 10_000, max: 80_000 },
  choices: [
    { label: 'Pay the bribe', skillCheck: { skillId: SK.bribery, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.7, text: 'The paperwork sailed through.', effects: { moneyAmountMult: -1, karma: -6, notoriety: 2, skillXp: [SK.bribery, 10] } },
      { chance: 0.3, text: 'It was a sting. You are charged with bribery.', effects: { moneyAmountMult: -1, criminalRecord: 1, reputation: -10, jailYears: 1 } },
    ] },
    { label: 'Refuse and fix the issues properly', effects: { companyCash: -120_000, karma: 4, reputation: 2 } },
    { label: 'Report the inspector', effects: { karma: 6, reputation: 3, popularity: 2 } },
  ],
});
ev({
  id: 'biz_product_recall', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A defect was found in {company}\'s flagship product. A full recall would cost {amount}.',
  amount: { min: 150_000, max: 1_500_000 },
  choices: [
    { label: 'Recall everything immediately', effects: { moneyAmountMult: 0, companyCash: -400_000, companyBrand: 4, karma: 5, companyQuality: 3 } },
    { label: 'Quietly fix new units only', outcomes: [
      { chance: 0.5, text: 'Nobody noticed.', effects: { karma: -4 } },
      { chance: 0.5, text: 'A journalist exposed the cover-up.', effects: { companyBrand: -12, reputation: -6, karma: -6 } },
    ] },
  ],
});
ev({
  id: 'biz_partnership', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: '{npc} proposes a joint venture between their firm and {company}.',
  choices: [
    { label: 'Sign the deal', outcomes: [
      { chance: 0.6, text: 'The partnership opened new markets.', effects: { companyCash: 200_000, companyBrand: 4, influence: 2 } },
      { chance: 0.4, text: 'They used the deal to poach your clients.', effects: { companyCash: -150_000, companyBrand: -3 } },
    ] },
    { label: 'Decline politely', effects: {} },
  ],
});
ev({
  id: 'biz_award', category: 'business', weight: 3, conditions: { hasBusiness: true, minReputation: 40 },
  text: '{company} has been shortlisted for a national business award.',
  choices: [
    { label: 'Attend the gala', effects: { money: -5000, companyBrand: 5, reputation: 4, influence: 3, happiness: 4 } },
    { label: 'Send a deputy', effects: { companyBrand: 2 } },
  ],
});
ev({
  id: 'biz_esg_pressure', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'Activist investors demand {company} publish an ESG plan and cut emissions.',
  choices: [
    { label: 'Embrace sustainability', effects: { companyCash: -150_000, companyBrand: 5, karma: 4 } },
    { label: 'Greenwash with a glossy report', outcomes: [
      { chance: 0.5, text: 'The pressure subsided.', effects: { companyBrand: 1, karma: -3 } },
      { chance: 0.5, text: 'You were called out publicly for greenwashing.', effects: { companyBrand: -7, reputation: -3, karma: -4 } },
    ] },
    { label: 'Tell them to focus on returns', effects: { companyBrand: -2, reputation: -1 } },
  ],
});
ev({
  id: 'biz_franchise_offer', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'Investors want to franchise the {company} concept nationwide.',
  choices: [
    { label: 'Franchise aggressively', outcomes: [
      { chance: 0.55, text: 'Franchise fees are rolling in.', effects: { companyCash: 500_000, companyBrand: 5 } },
      { chance: 0.45, text: 'Sloppy franchisees damaged the brand.', effects: { companyCash: 150_000, companyBrand: -6, companyQuality: -4 } },
    ] },
    { label: 'Keep it all company-owned', effects: { companyQuality: 2 } },
  ],
});
ev({
  id: 'biz_tax_scheme', category: 'business', weight: 3, conditions: { hasBusiness: true, minMoney: 200_000 },
  text: 'A slick advisor pitches an offshore structure that would slash {company}\'s tax bill.',
  choices: [
    { label: 'Set up the structure', skillCheck: { skillId: SK.moneyLaundering, bonusPerLevel: 0.003 }, outcomes: [
      { chance: 0.65, text: 'Perfectly legal, says your lawyer. Taxes plummet.', effects: { companyCash: 300_000, karma: -3 } },
      { chance: 0.35, text: 'The scheme was leaked in an offshore data dump.', effects: { reputation: -10, companyBrand: -8, money: -200_000, karma: -5 } },
    ] },
    { label: 'Pay your taxes', effects: { karma: 4, reputation: 1 } },
  ],
});
ev({
  id: 'biz_shareholder_revolt', category: 'business', weight: 4, conditions: { hasBusiness: true, businessPublic: true },
  text: 'Institutional shareholders of {company} are furious about weak returns and demand change.',
  choices: [
    { label: 'Promise a special dividend to calm them', effects: { companyCash: -150_000, reputation: 1 } },
    { label: 'Dilute your stake to bring in new capital', effects: { companySharePctDelta: -0.1, companyCash: 300_000 } },
    { label: 'Stand firm and defend your strategy', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'Your conviction won them over.', effects: { reputation: 3 } },
      { chance: 0.5, text: 'They voted to strip some of your board control.', effects: { companySharePctDelta: -0.15, reputation: -3 } },
    ] },
  ],
});
ev({
  id: 'biz_hostile_takeover_attempt', category: 'business', weight: 3, conditions: { hasBusiness: true, businessPublic: true },
  text: 'A rival conglomerate has launched a hostile bid for {company}, quietly buying up shares on the open market.',
  choices: [
    { label: 'Fight it off with a costly share buyback', effects: { companyCash: -500_000, reputation: 1 } },
    { label: 'Rally loyal shareholders to your side', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'Loyalists held the line. The bid collapsed.', effects: { reputation: 2 } },
      { chance: 0.4, text: 'The raiders won control. You were bought out.', effects: { loseCompany: true } },
    ] },
    { label: 'Negotiate a graceful buyout', effects: { loseCompany: true, happiness: 2 } },
  ],
});
ev({
  id: 'biz_espionage_target', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'A private investigator hints that a rival in your industry has left its R&D lab poorly secured.',
  choices: [
    { label: "That's their problem, not an invitation", effects: { karma: 2 } },
    { label: 'File it away for later (visit Business tab to act on it)', effects: { smarts: 1 } },
  ],
});

// ---------------------------------------------------------------------------
// FAMILY & DYNASTY
// ---------------------------------------------------------------------------
ev({
  id: 'fam_meet_someone', category: 'family', weight: 5, conditions: { minAge: 18, hasSpouse: false },
  text: 'You keep running into {npc} at the same coffee shop in {city}. There is definitely a spark.',
  choices: [
    { label: 'Ask them out (visit the Family tab to pursue this)', effects: { happiness: 3, charisma: 1 } },
    { label: 'Keep it professional', effects: {} },
  ],
});
ev({
  id: 'fam_inlaws', category: 'family', weight: 4, conditions: { hasSpouse: true },
  text: "Your in-laws are visiting for the holidays and have Opinions about how you're living your life.",
  choices: [
    { label: 'Host a lavish dinner to win them over', effects: { money: -3_000, happiness: 4 } },
    { label: 'Grin and bear it', effects: { happiness: -2 } },
    { label: 'Set firm boundaries', skillCheck: { skillId: SK.persuasion, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'They respected it, eventually.', effects: { happiness: 3 } },
      { chance: 0.45, text: 'It caused a rift that lingered.', effects: { happiness: -5 } },
    ] },
  ],
});
ev({
  id: 'fam_private_school', category: 'family', weight: 4, conditions: { hasChildren: true },
  text: 'A prestigious private school offers your child a place, tuition {amount} a year.',
  amount: { min: 8_000, max: 30_000 },
  choices: [
    { label: 'Enroll them', effects: { moneyAmountMult: -1, happiness: 2, karma: 1 } },
    { label: 'Public school is fine', effects: {} },
  ],
});
ev({
  id: 'fam_sibling_rivalry', category: 'family', weight: 3, conditions: { hasChildren: true },
  text: 'Your children are squabbling over your attention — and, they suspect, your will.',
  choices: [
    { label: 'Sit them down and talk it out', effects: { happiness: 2, karma: 2 } },
    { label: 'Let them work it out themselves', effects: {} },
    { label: 'Promise to split everything equally', effects: { karma: 3, happiness: 1 } },
  ],
});
ev({
  id: 'fam_spouse_career', category: 'family', weight: 4, conditions: { hasSpouse: true },
  text: 'Your spouse wants to pursue their own ambitious career move, which would mean less time for the family.',
  choices: [
    { label: 'Support them fully', effects: { happiness: 4, karma: 3 } },
    { label: 'Ask them to wait', effects: { happiness: -3 } },
  ],
});

// ---------------------------------------------------------------------------
// GLOBAL WORLD EVENTS (pandemic-specific colour)
// ---------------------------------------------------------------------------
ev({
  id: 'world_pandemic_lockdown', category: 'world', weight: 8, conditions: { duringWorldEvent: 'pandemic' }, once: false,
  text: 'Authorities in {country} are weighing new restrictions as the outbreak strains hospitals.',
  choices: [
    { label: 'Stock up on essentials', effects: { money: -1_500, health: 2 } },
    { label: 'Volunteer at a community support drive', effects: { karma: 6, reputation: 2, happiness: 3 } },
    { label: 'Carry on as normal', effects: { health: -2 } },
  ],
});
ev({
  id: 'world_pandemic_vaccine', category: 'world', weight: 3, conditions: { duringWorldEvent: 'pandemic', minMoney: 20_000 },
  text: 'Biotech firms racing for a vaccine are raising capital at a premium.',
  choices: [
    { label: 'Invest {amount}', outcomes: [
      { chance: 0.5, text: 'The vaccine succeeded and the stock soared.', effects: { moneyAmountMult: 2.5 } },
      { chance: 0.5, text: 'The trial failed. Total loss.', effects: { moneyAmountMult: -1 } },
    ] },
    { label: 'Too risky', effects: {} },
  ],
  amount: { min: 5_000, max: 100_000, pctOfMoney: 0.15 },
});

// ---------------------------------------------------------------------------
// MARKETS & INVESTING
// ---------------------------------------------------------------------------
ev({
  id: 'mkt_hot_tip', category: 'market', weight: 6, conditions: { minMoney: 10_000 },
  text: '{npc} whispers a "can\'t-miss" stock tip about a company about to announce a breakthrough.',
  choices: [
    { label: 'Invest {amount}', outcomes: [
      { chance: 0.35, text: 'The tip was gold. The stock doubled.', effects: { moneyAmountMult: 1, happiness: 5, skillXp: [SK.trading, 8] } },
      { chance: 0.45, text: 'The stock went nowhere.', effects: { moneyAmountMult: -0.3 } },
      { chance: 0.2, text: 'It was a pump-and-dump. You bought the top.', effects: { moneyAmountMult: -0.8, happiness: -5 } },
    ] },
    { label: 'Insider trading is a crime — and this smells like it', effects: { karma: 3, smarts: 1 } },
  ],
  amount: { min: 5000, max: 100_000, pctOfMoney: 0.2 },
});
ev({
  id: 'mkt_crypto_mania', category: 'market', weight: 4, conditions: { minMoney: 5_000 },
  text: 'A new cryptocurrency is up 900% this year. Everyone at the barbershop is buying.',
  choices: [
    { label: 'FOMO in with {amount}', outcomes: [
      { chance: 0.25, text: 'It kept mooning. You sold near the top.', effects: { moneyAmountMult: 3, happiness: 8 } },
      { chance: 0.75, text: 'It crashed 95% a month after you bought.', effects: { moneyAmountMult: -0.9, happiness: -6 } },
    ] },
    { label: 'When the barber is buying, it\'s time to sell', effects: { smarts: 2, skillXp: [SK.investing, 6] } },
  ],
  amount: { min: 2000, max: 50_000, pctOfMoney: 0.15 },
});
ev({
  id: 'mkt_angel_deal', category: 'market', weight: 4, conditions: { minMoney: 100_000 },
  text: 'Two young founders pitch you their startup over coffee. They need {amount} for 15% of the company.',
  amount: { min: 50_000, max: 300_000 },
  choices: [
    { label: 'Write the cheque', skillCheck: { skillId: SK.ventureCapital, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.2, text: 'Years later they IPO. Your stake is worth a fortune.', effects: { moneyAmountMult: 15, reputation: 5, happiness: 10 } },
      { chance: 0.35, text: 'A larger firm acquired them. Decent return.', effects: { moneyAmountMult: 1.5 } },
      { chance: 0.45, text: 'The startup folded within two years.', effects: { moneyAmountMult: -1, happiness: -3 } },
    ] },
    { label: 'Pass on the deal', effects: {} },
  ],
});
ev({
  id: 'mkt_property_flip', category: 'market', weight: 4, conditions: { minMoney: 80_000 },
  text: 'A rundown property near the new transit line in {city} is going cheap: {amount}.',
  amount: { min: 60_000, max: 400_000, pctOfMoney: 0.4 },
  choices: [
    { label: 'Buy, renovate, flip', skillCheck: { skillId: SK.realEstate, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'Sold at a handsome profit.', effects: { moneyAmountMult: 0.6, skillXp: [SK.realEstate, 12] } },
      { chance: 0.45, text: 'Renovation costs spiralled; you barely broke even.', effects: { moneyAmountMult: -0.15 } },
    ] },
    { label: 'Too much hassle', effects: {} },
  ],
});
ev({
  id: 'mkt_margin_call_warning', category: 'market', weight: 3, conditions: { hasStocks: true, regime: ['recession', 'depression'] },
  text: 'Markets are in freefall. Your broker suggests de-risking before things get worse.',
  choices: [
    { label: 'Sell into the panic', effects: { skillXp: [SK.riskManagement, 6] } },
    { label: 'Hold. Be greedy when others are fearful', effects: { skillXp: [SK.investing, 8] } },
    { label: 'Buy the dip aggressively', effects: { skillXp: [SK.trading, 8] } },
  ],
});
ev({
  id: 'mkt_ponzi_pitch', category: 'market', weight: 3, conditions: { minMoney: 50_000 },
  text: '{npc} runs an exclusive fund returning a suspiciously smooth 2% every single month. Minimum buy-in: {amount}.',
  amount: { min: 25_000, max: 200_000, pctOfMoney: 0.25 },
  choices: [
    { label: 'Invest', outcomes: [
      { chance: 0.3, text: 'You withdrew with profits before it collapsed. Others weren\'t so lucky.', effects: { moneyAmountMult: 0.5, karma: -2 } },
      { chance: 0.7, text: 'It was a Ponzi scheme. Your money is gone.', effects: { moneyAmountMult: -1, happiness: -8 } },
    ] },
    { label: 'Report it to regulators', effects: { karma: 6, reputation: 2 } },
    { label: 'Politely decline', effects: { smarts: 1 } },
  ],
});
ev({
  id: 'mkt_gold_rush', category: 'market', weight: 3, conditions: { minMoney: 20_000, regime: ['recession', 'depression'] },
  text: 'With markets shaky, gold is surging. A dealer offers bullion at spot price.',
  choices: [
    { label: 'Buy {amount} in gold', outcomes: [
      { chance: 0.6, text: 'Gold kept climbing through the turmoil.', effects: { moneyAmountMult: 0.3 } },
      { chance: 0.4, text: 'The panic faded and gold drifted down.', effects: { moneyAmountMult: -0.15 } },
    ] },
    { label: 'Stay in cash', effects: {} },
  ],
  amount: { min: 10_000, max: 100_000, pctOfMoney: 0.2 },
});

// ---------------------------------------------------------------------------
// POLITICS
// ---------------------------------------------------------------------------
ev({
  id: 'pol_local_issue', category: 'politics', weight: 6, conditions: { inOffice: 'any' },
  text: 'Residents of {city} are furious about potholes and broken streetlights.',
  choices: [
    { label: 'Fund an emergency repair blitz', effects: { popularity: 5, politicalCapital: -2 } },
    { label: 'Blame the previous administration', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The blame stuck.', effects: { popularity: 2 } },
      { chance: 0.5, text: 'Voters saw through it.', effects: { popularity: -4 } },
    ] },
    { label: 'Ignore it', effects: { popularity: -3 } },
  ],
});
ev({
  id: 'pol_donor_dinner', category: 'politics', weight: 6, conditions: { inParty: true },
  text: '{npc}, a wealthy donor, invites you to a private dinner. They want "a friend in government".',
  choices: [
    { label: 'Attend and charm them', skillCheck: { skillId: SK.charm, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'They pledged generous support.', effects: { money: 0, influence: 4, politicalCapital: 3, campaignMomentum: 4 } },
      { chance: 0.4, text: 'The dinner was awkward. No pledge.', effects: { influence: 1 } },
    ] },
    { label: 'Attend but promise nothing', effects: { influence: 2, karma: 2 } },
    { label: 'Decline — you know what "a friend" means', effects: { karma: 4, popularity: 1 } },
  ],
});
ev({
  id: 'pol_scandal_ally', category: 'politics', weight: 5, conditions: { inOffice: 'any' },
  text: 'Your close ally {npc} has been caught in an expenses scandal. The press wants your reaction.',
  choices: [
    { label: 'Defend them publicly', outcomes: [
      { chance: 0.4, text: 'They were cleared. Loyalty rewarded.', effects: { influence: 4, politicalCapital: 2 } },
      { chance: 0.6, text: 'More evidence emerged. You look complicit.', effects: { popularity: -7, reputation: -3 } },
    ] },
    { label: 'Cut them loose', effects: { popularity: 3, influence: -3, karma: -1 } },
    { label: 'Call for an independent inquiry', effects: { popularity: 2, karma: 2, politicalCapital: 1 } },
  ],
});
ev({
  id: 'pol_debate_challenge', category: 'politics', weight: 6, conditions: { campaigning: true },
  text: 'Your main opponent challenges you to a televised debate.',
  choices: [
    { label: 'Accept and prepare thoroughly', skillCheck: { skillId: SK.debate, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'You landed the line of the night.', effects: { campaignMomentum: 8, popularity: 4, skillXp: [SK.debate, 15] } },
      { chance: 0.45, text: 'You stumbled on a gotcha question.', effects: { campaignMomentum: -6, popularity: -2 } },
    ] },
    { label: 'Duck the debate', effects: { campaignMomentum: -3 } },
  ],
});
ev({
  id: 'pol_town_hall', category: 'politics', weight: 6, conditions: { campaigning: true },
  text: 'A rowdy town hall in {city}. A heckler keeps interrupting your stump speech.',
  choices: [
    { label: 'Disarm them with humor', skillCheck: { skillId: SK.charm, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'The clip of your comeback went viral.', effects: { campaignMomentum: 6, popularity: 3, charisma: 1 } },
      { chance: 0.4, text: 'The joke landed flat.', effects: { campaignMomentum: -2 } },
    ] },
    { label: 'Have security remove them', effects: { campaignMomentum: -4, popularity: -2 } },
    { label: 'Engage their question seriously', effects: { campaignMomentum: 3, karma: 2, skillXp: [SK.publicSpeaking, 8] } },
  ],
});
ev({
  id: 'pol_oppo_research', category: 'politics', weight: 4, conditions: { campaigning: true },
  text: 'A consultant offers dirt on your opponent — an affair, hidden offshore accounts. For {amount}, it\'s yours.',
  amount: { min: 20_000, max: 100_000 },
  choices: [
    { label: 'Buy it and leak it', outcomes: [
      { chance: 0.6, text: 'The scandal dominated the news cycle.', effects: { moneyAmountMult: -1, campaignMomentum: 8, karma: -5 } },
      { chance: 0.4, text: 'The leak was traced back to your campaign.', effects: { moneyAmountMult: -1, campaignMomentum: -8, popularity: -5, karma: -5 } },
    ] },
    { label: 'Run a clean campaign', effects: { karma: 5, popularity: 2 } },
  ],
});
ev({
  id: 'pol_lobbyist_offer', category: 'politics', weight: 5, conditions: { inOffice: 'any' },
  text: 'A lobbyist for the {industry} industry offers {amount} in "consulting fees" for your support on upcoming regulation.',
  amount: { min: 50_000, max: 400_000 },
  choices: [
    { label: 'Take the money', skillCheck: { skillId: SK.evasion, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.65, text: 'The arrangement stayed quiet.', effects: { moneyAmountMult: 1, karma: -8, influence: 2, notoriety: 2 } },
      { chance: 0.35, text: 'An investigative reporter exposed the payments.', effects: { moneyAmountMult: 1, popularity: -15, reputation: -10, karma: -8, politicalCapital: -5 } },
    ] },
    { label: 'Refuse and go public', effects: { popularity: 6, karma: 6, influence: -2 } },
    { label: 'Refuse quietly', effects: { karma: 4 } },
  ],
});
ev({
  id: 'pol_crisis_flood', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'Severe floods have hit {city}. Thousands are displaced and the cameras are rolling.',
  choices: [
    { label: 'Lead from the front — wade in, coordinate relief', effects: { popularity: 8, politicalCapital: 3, health: -2, happiness: 2 } },
    { label: 'Manage it from the office', effects: { popularity: 1 } },
    { label: 'Photo op only', outcomes: [
      { chance: 0.5, text: 'The photos played well.', effects: { popularity: 3, karma: -2 } },
      { chance: 0.5, text: '"He held the sandbag upside down." Mockery ensued.', effects: { popularity: -5, karma: -2 } },
    ] },
  ],
});
ev({
  id: 'pol_party_revolt', category: 'politics', weight: 3, conditions: { inOffice: ['head_of_state', 'party_leader'] },
  text: 'A faction of your own party is plotting to replace you, calling your leadership "electoral poison".',
  choices: [
    { label: 'Face them down in the party room', skillCheck: { skillId: SK.coalition, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'You crushed the revolt and emerged stronger.', effects: { politicalCapital: 5, influence: 4, popularity: 2 } },
      { chance: 0.45, text: 'You survived, barely. Authority dented.', effects: { politicalCapital: -3, popularity: -3 } },
    ] },
    { label: 'Buy off the ringleaders with cabinet posts', effects: { politicalCapital: -2, influence: 2, karma: -2 } },
  ],
});
ev({
  id: 'pol_foreign_summit', category: 'politics', weight: 4, conditions: { inOffice: ['head_of_state', 'minister'] },
  text: 'A high-stakes international summit. A rival nation\'s leader tries to embarrass you at the podium.',
  choices: [
    { label: 'Deliver a firm, statesmanlike rebuttal', skillCheck: { skillId: SK.diplomacy, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'Commentators called it a diplomatic masterclass.', effects: { popularity: 5, influence: 4, skillXp: [SK.diplomacy, 15] } },
      { chance: 0.4, text: 'Your response fell flat on the world stage.', effects: { popularity: -3 } },
    ] },
    { label: 'Fire back with insults', effects: { popularity: 2, influence: -3, skillXp: [SK.spin, 6] } },
    { label: 'Rise above it', effects: { karma: 3, influence: 2 } },
  ],
});
ev({
  id: 'pol_journalist_expose', category: 'politics', weight: 4, conditions: { inOffice: 'any', minNotoriety: 5 },
  text: 'Journalist {npc} is preparing an exposé on your past dealings.',
  choices: [
    { label: 'Get ahead of it — confess publicly', effects: { popularity: -4, karma: 5, reputation: 2 } },
    { label: 'Discredit the journalist', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The story died in the noise.', effects: { karma: -4, notoriety: 1 } },
      { chance: 0.5, text: 'The smear campaign became the story.', effects: { popularity: -10, karma: -6 } },
    ] },
    { label: 'Offer them an exclusive interview instead', skillCheck: { skillId: SK.charm, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'The piece came out balanced, almost flattering.', effects: { popularity: 3, influence: 2 } },
      { chance: 0.45, text: 'They used your quotes against you.', effects: { popularity: -6 } },
    ] },
  ],
});
ev({
  id: 'pol_assassination_scare', category: 'politics', weight: 2, conditions: { inOffice: ['head_of_state', 'dictator'] },
  text: 'Intelligence services uncovered a credible plot against your life.',
  choices: [
    { label: 'Increase security, carry on', effects: { health: -2, happiness: -4 } },
    { label: 'Use it to rally support', effects: { popularity: 5, politicalCapital: 2, happiness: -3 } },
    { label: 'Launch a sweeping crackdown', effects: { popularity: -5, karma: -6, influence: 3, notoriety: 4 } },
  ],
});
ev({
  id: 'pol_union_strike', category: 'politics', weight: 4, conditions: { inOffice: ['governor', 'head_of_state', 'minister', 'mayor'] },
  text: 'Public transport workers have gone on strike over pay. The capital is gridlocked.',
  choices: [
    { label: 'Negotiate a pay rise', effects: { popularity: 3, politicalCapital: -2, approvalOfGovernment: 2 } },
    { label: 'Wait them out', outcomes: [
      { chance: 0.5, text: 'The strike collapsed after two weeks.', effects: { popularity: 1, politicalCapital: 1 } },
      { chance: 0.5, text: 'Public anger turned on the government.', effects: { popularity: -6, approvalOfGovernment: -4 } },
    ] },
    { label: 'Legislate them back to work', effects: { popularity: -3, politicalCapital: -1, approvalOfGovernment: -2, influence: 2 } },
  ],
});
ev({
  id: 'pol_referendum_pressure', category: 'politics', weight: 3, conditions: { inOffice: ['head_of_state'] },
  text: 'A petition with two million signatures demands a referendum on constitutional reform.',
  choices: [
    { label: 'Grant the referendum', effects: { popularity: 4, politicalCapital: -3, karma: 3 } },
    { label: 'Refuse — parliament decides', effects: { popularity: -4, politicalCapital: 2 } },
  ],
});

// ---------------------------------------------------------------------------
// CRIME & SHADOW
// ---------------------------------------------------------------------------
ev({
  id: 'crime_smuggling_offer', category: 'crime', weight: 3, conditions: { maxMoney: 100_000, minAge: 18, maxAge: 50 },
  text: 'A shady acquaintance offers you {amount} to drive a truck across the border, no questions asked.',
  amount: { min: 15_000, max: 60_000 },
  choices: [
    { label: 'Do the run', skillCheck: { skillId: SK.evasion, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.65, text: 'Easy money. Too easy.', effects: { moneyAmountMult: 1, notoriety: 4, karma: -5, skillXp: [SK.streetSmarts, 10] } },
      { chance: 0.35, text: 'Border patrol found the hidden cargo.', effects: { criminalRecord: 1, jailYears: 2, notoriety: 3, happiness: -10 } },
    ] },
    { label: 'Walk away', effects: { karma: 2 } },
  ],
});
ev({
  id: 'crime_launder_offer', category: 'crime', weight: 3, conditions: { hasBusiness: true, minNotoriety: 3 },
  text: 'A cartel representative wants to run money through {company}. Your cut: {amount} a year.',
  amount: { min: 100_000, max: 800_000 },
  choices: [
    { label: 'Accept the arrangement', skillCheck: { skillId: SK.moneyLaundering, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'The books look clean. The money flows.', effects: { moneyAmountMult: 1, notoriety: 6, karma: -8, skillXp: [SK.moneyLaundering, 15] } },
      { chance: 0.4, text: 'Financial intelligence flagged the transactions.', effects: { criminalRecord: 1, jailYears: 3, companyBrand: -15, reputation: -15 } },
    ] },
    { label: 'Refuse', outcomes: [
      { chance: 0.8, text: 'They accepted your refusal. This time.', effects: { karma: 4 } },
      { chance: 0.2, text: 'Your warehouse burned down a week later.', effects: { companyCash: -300_000, happiness: -5, karma: 4 } },
    ] },
    { label: 'Refuse and tip off the police', effects: { karma: 8, notoriety: -2, popularity: 2, happiness: -2 } },
  ],
});
ev({
  id: 'crime_jail_life', category: 'crime', weight: 10, conditions: { inJail: true },
  text: 'Another year behind bars. How do you spend it?',
  choices: [
    { label: 'Study law in the library', effects: { skillXp: [SK.law, 15], smarts: 2 } },
    { label: 'Build connections', effects: { notoriety: 3, skillXp: [SK.streetSmarts, 12], influence: 1 } },
    { label: 'Keep your head down', effects: { health: 1, karma: 1 } },
    { label: 'Work on an appeal', skillCheck: { skillId: SK.law, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.25, text: 'Appeal granted! Early release.', effects: { happiness: 10 } },
      { chance: 0.75, text: 'Appeal denied.', effects: { money: -20_000, happiness: -3 } },
    ] },
  ],
});
ev({
  id: 'crime_blackmail_you', category: 'crime', weight: 3, conditions: { minNotoriety: 5, minMoney: 100_000 },
  text: 'An anonymous message: pay {amount} or your secrets go to the press.',
  amount: { min: 50_000, max: 300_000 },
  choices: [
    { label: 'Pay up', effects: { moneyAmountMult: -1, happiness: -5 } },
    { label: 'Hire someone to find the blackmailer', skillCheck: { skillId: SK.streetSmarts, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'Found them. The problem went away.', effects: { money: -30_000, notoriety: 3 } },
      { chance: 0.45, text: 'They got spooked and published everything.', effects: { reputation: -12, popularity: -8, happiness: -6 } },
    ] },
    { label: 'Go to the police', outcomes: [
      { chance: 0.6, text: 'The blackmailer was arrested before publishing.', effects: { karma: 3, happiness: 2 } },
      { chance: 0.4, text: 'The story leaked during the investigation.', effects: { reputation: -8, popularity: -5, karma: 3 } },
    ] },
  ],
});

// ---------------------------------------------------------------------------
// WORLD & SOCIETY (no player choice pressure; flavor + small effects)
// ---------------------------------------------------------------------------
ev({
  id: 'world_disaster_relief', category: 'world', weight: 4,
  text: 'A devastating earthquake struck a neighboring country. A telethon is raising funds.',
  choices: [
    { label: 'Donate {amount}', effects: { moneyAmountMult: -1, karma: 5, reputation: 2, popularity: 1, happiness: 2 } },
    { label: 'Donate anonymously', effects: { moneyAmountMult: -1, karma: 7, happiness: 3 } },
    { label: 'Keep your money', effects: {} },
  ],
  amount: { min: 1000, max: 50_000, pctOfMoney: 0.03 },
});
ev({
  id: 'world_tech_wave', category: 'world', weight: 3, conditions: { minAge: 18 },
  text: 'A new general-purpose AI assistant is sweeping through workplaces. Colleagues either love it or fear it.',
  choices: [
    { label: 'Master the new tools', effects: { skillXp: [SK.ai, 12], smarts: 2, jobPerformance: 4 } },
    { label: 'Dismiss it as hype', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'world_pandemic_scare', category: 'world', weight: 2, once: true,
  text: 'A novel virus is spreading overseas. Authorities urge calm while quietly buying masks.',
  choices: [
    { label: 'Stock up and stay cautious', effects: { money: -2000, health: 2 } },
    { label: 'Buy shares in vaccine makers', effects: { skillXp: [SK.investing, 8] }, outcomes: [
      { chance: 0.6, text: 'Health stocks soared.', effects: { moneyPct: 0.08 } },
      { chance: 0.4, text: 'The outbreak fizzled, so did the stocks.', effects: { moneyPct: -0.03 } },
    ] },
    { label: 'Ignore the news', effects: { happiness: 1 } },
  ],
});

// ---------------------------------------------------------------------------
// MEDIA & FAME
// ---------------------------------------------------------------------------
ev({
  id: 'media_interview_request', category: 'media', weight: 4, conditions: { minReputation: 50 },
  text: 'A prime-time show wants to profile your rise. Cameras would follow you for a week.',
  choices: [
    { label: 'Let them in', outcomes: [
      { chance: 0.6, text: 'A flattering portrait. Your profile soars.', effects: { reputation: 5, popularity: 5, influence: 3 } },
      { chance: 0.4, text: 'The edit made you look ruthless.', effects: { reputation: -4, popularity: -3 } },
    ] },
    { label: 'Decline — mystique is worth more', effects: { influence: 1 } },
  ],
});
ev({
  id: 'media_social_gaffe', category: 'media', weight: 4, conditions: { minPopularity: 30 },
  text: 'An old post of yours resurfaced online and people are calling it offensive.',
  choices: [
    { label: 'Apologize sincerely', effects: { popularity: -2, karma: 3 } },
    { label: 'Refuse to apologize', outcomes: [
      { chance: 0.5, text: 'Your base loved the defiance.', effects: { popularity: 3, influence: 1 } },
      { chance: 0.5, text: 'Sponsors and allies distanced themselves.', effects: { popularity: -6, reputation: -3 } },
    ] },
    { label: 'Claim you were hacked', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.4, text: 'Somehow, people bought it.', effects: { karma: -4 } },
      { chance: 0.6, text: 'Nobody bought it. It got worse.', effects: { popularity: -8, karma: -4 } },
    ] },
  ],
});
ev({
  id: 'media_podcast_invite', category: 'media', weight: 4, conditions: { minReputation: 35 },
  text: 'The country\'s biggest podcast invites you for a three-hour conversation.',
  choices: [
    { label: 'Go on and be candid', skillCheck: { skillId: SK.charm, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'Clips of your best lines circulated for weeks.', effects: { popularity: 6, reputation: 3, influence: 2 } },
      { chance: 0.4, text: 'You rambled into a controversy in hour two.', effects: { popularity: -5, reputation: -2 } },
    ] },
    { label: 'Decline', effects: {} },
  ],
});

// ---------------------------------------------------------------------------
// FAMILY
// ---------------------------------------------------------------------------
ev({
  id: 'family_meet_partner', category: 'family', weight: 5, conditions: { minAge: 20, maxAge: 60 },
  text: 'You hit it off with {npc} at a dinner party. There\'s a real spark.',
  choices: [
    { label: 'Pursue the relationship', effects: { happiness: 8, charisma: 1 } },
    { label: 'Stay focused on your ambitions', effects: { happiness: -2, skillXp: [SK.strategy, 4] } },
  ],
});
ev({
  id: 'family_parent_ill', category: 'family', weight: 3, conditions: { minAge: 35 },
  text: 'One of your parents has fallen seriously ill and needs long-term care costing {amount} a year.',
  amount: { min: 20_000, max: 80_000 },
  choices: [
    { label: 'Pay for the best care', effects: { moneyAmountMult: -1, karma: 6, happiness: -2 } },
    { label: 'Care for them yourself', effects: { happiness: -4, health: -3, karma: 8, jobPerformance: -6 } },
    { label: 'Let public services handle it', effects: { karma: -4, happiness: -4 } },
  ],
});
ev({
  id: 'family_kid_trouble', category: 'family', weight: 3, conditions: { minAge: 40 },
  text: 'A young relative you mentor got into trouble at university and faces expulsion.',
  choices: [
    { label: 'Pull strings with the dean', effects: { influence: -2, karma: -2, happiness: 2 } },
    { label: 'Let them face the consequences', effects: { karma: 4, happiness: -2 } },
    { label: 'Hire them a good lawyer', effects: { money: -15_000, happiness: 1 } },
  ],
});

export const EVENT_TEMPLATES: EventTemplate[] = E;
