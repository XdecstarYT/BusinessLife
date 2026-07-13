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
  id: 'fam_succession_rivalry', category: 'family', weight: 3, conditions: { hasChildren: true, hasBusiness: true },
  text: 'Word gets around about who you favor to inherit the business, and the siblings you passed over are furious.',
  choices: [
    { label: 'Reassure them with a cash gift', effects: { money: -20_000, happiness: 2, karma: 2 } },
    { label: 'Tell them succession is earned, not owed', outcomes: [
      { chance: 0.5, text: 'They respect the honesty, if not the decision.', effects: { karma: 3 } },
      { chance: 0.5, text: 'It drives a permanent wedge into the family.', effects: { happiness: -5, karma: -2 } },
    ] },
    { label: 'Ignore the drama', effects: { happiness: -2 } },
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
ev({
  id: 'world_olympics', category: 'world', weight: 4,
  text: 'The Olympics are underway this year, with {country} among the nations competing for glory.',
  choices: [
    { label: 'Attend as a spectator', effects: { money: -3_000, happiness: 6 } },
    { label: 'Sponsor an athlete through your company', effects: { companyCash: -40_000, companyBrand: 6, reputation: 2 }, },
    { label: 'Watch from home', effects: { happiness: 2 } },
  ],
});
ev({
  id: 'world_sci_breakthrough', category: 'world', weight: 4,
  text: 'Researchers announce a major breakthrough in {industry}, dominating headlines worldwide.',
  choices: [
    { label: 'Invest in the trend early', skillCheck: { skillId: SK.research, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.45, text: 'You got in ahead of the curve.', effects: { moneyPct: 0.05 } },
      { chance: 0.55, text: 'The hype faded faster than expected.', effects: { moneyPct: -0.02 } },
    ] },
    { label: 'Just enjoy the news', effects: { smarts: 1 } },
  ],
});
ev({
  id: 'world_global_summit', category: 'world', weight: 4, conditions: { inOffice: ['head_of_state', 'dictator', 'monarch'] },
  text: 'World leaders convene for an emergency summit on the global economy, and {country} has a seat at the table.',
  choices: [
    { label: 'Attend personally and negotiate', skillCheck: { skillId: SK.diplomacy, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'Your leadership at the summit was widely praised.', effects: { popularity: 6, influence: 4 } },
      { chance: 0.4, text: 'You were sidelined by bigger powers.', effects: { popularity: -2 } },
    ] },
    { label: 'Send a senior minister instead', effects: { politicalCapital: 1 } },
    { label: 'Skip it — domestic priorities first', effects: { popularity: -3, approvalOfGovernment: -2 } },
  ],
});
ev({
  id: 'world_disaster_direct', category: 'world', weight: 3,
  text: 'A severe natural disaster strikes {city} directly, and your neighborhood did not escape unscathed.',
  choices: [
    { label: 'Help with relief efforts personally', effects: { karma: 6, happiness: -2, health: -2, reputation: 2 } },
    { label: 'Donate to the recovery fund', effects: { money: -8_000, karma: 4, popularity: 1 } },
    { label: 'Focus on your own recovery', effects: { moneyPct: -0.02, happiness: -4 } },
  ],
});
ev({
  id: 'world_esports_championship', category: 'world', weight: 3,
  text: 'A major international esports championship is being held in {city} this year.',
  choices: [
    { label: 'Attend the finals', effects: { money: -500, happiness: 3 } },
    { label: 'Sponsor the event through your company', effects: { companyCash: -25_000, companyBrand: 5 } },
    { label: "Not really your scene", effects: {} },
  ],
});
ev({
  id: 'realestate_market_shift', category: 'world', weight: 4, conditions: { hasProperty: true },
  text: 'The real estate market is moving fast — {country} property values are in flux.',
  choices: [
    { label: 'Ride it out', outcomes: [
      { chance: 0.5, text: 'A boom lifted every property you own.', effects: { propertyValuePct: 0.12 } },
      { chance: 0.5, text: 'A correction hit the market hard. Insured properties fared better.', effects: { propertyValuePct: -0.15 } },
    ] },
    { label: 'Sell down your exposure now', skillCheck: { skillId: SK.realEstate, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'Good timing — you avoided the worst of the dip.', effects: { propertyValuePct: -0.03 } },
      { chance: 0.5, text: 'You sold right before a rally. Frustrating.', effects: { propertyValuePct: 0.02, happiness: -2 } },
    ] },
  ],
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
  id: 'pol_election_fraud_allegation', category: 'politics', weight: 4, conditions: { campaigning: true },
  text: 'Your opponent accuses your campaign of ballot irregularities and demands an independent recount.',
  choices: [
    { label: 'Demand the courts dismiss it', skillCheck: { skillId: SK.law, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'The judiciary threw the case out for lack of evidence.', effects: { campaignMomentum: 4, reputation: 3 } },
      { chance: 0.45, text: 'The court ordered a recount anyway, costing you momentum.', effects: { campaignMomentum: -7, popularity: -3 } },
    ] },
    { label: 'Get ahead of it with a media blitz', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'You framed it as a smear before it could stick.', effects: { campaignMomentum: 5, popularity: 2, skillXp: [SK.spin, 12] } },
      { chance: 0.4, text: 'The story kept dogging you for weeks.', effects: { campaignMomentum: -5, karma: -1 } },
    ] },
    { label: 'Welcome a full independent audit', effects: { karma: 4, campaignMomentum: -2, reputation: 2 } },
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
  id: 'pol_advocacy_pressure', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'An advocacy coalition is running ads and organizing rallies to pressure you into adopting their platform.',
  choices: [
    { label: 'Meet with them and adopt part of their platform', effects: { popularity: 4, karma: 3, influence: -1 } },
    { label: 'Publicly dismiss the pressure campaign', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You held firm without much political cost.', effects: { popularity: -1 } },
      { chance: 0.45, text: 'The pressure campaign only grew louder.', effects: { popularity: -5, politicalCapital: -3 } },
    ] },
    { label: 'Quietly ignore it', effects: { influence: 1 } },
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
  id: 'pol_leaked_emails', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'A trove of your private emails has leaked, revealing blunt internal strategy talk.',
  choices: [
    { label: 'Own it — say nothing was illegal, just candid', effects: { karma: 2, popularity: -3 } },
    { label: 'Claim the leak was doctored', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'The doctoring claim muddied the story enough to survive it.', effects: { popularity: 1, karma: -3 } },
      { chance: 0.5, text: 'Forensic analysis debunked your claim, and it became a bigger story.', effects: { popularity: -8, karma: -4, reputation: -3 } },
    ] },
    { label: 'Resign in protest of the leak itself', effects: { popularity: 4, karma: 4, happiness: -6 } },
  ],
});
ev({
  id: 'pol_conflict_of_interest', category: 'politics', weight: 4, conditions: { inOffice: 'any', hasBusiness: true },
  text: 'Reporters note that a regulation you championed happens to benefit a company you own a stake in.',
  choices: [
    { label: 'Divest your stake publicly', effects: { money: -10_000, karma: 5, reputation: 3, popularity: 2 } },
    { label: 'Insist it was a coincidence', skillCheck: { skillId: SK.law, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'An ethics review cleared you of wrongdoing.', effects: { reputation: 2 } },
      { chance: 0.5, text: 'The ethics review was scathing.', effects: { popularity: -6, reputation: -5, karma: -3 } },
    ] },
    { label: 'Refuse to comment', effects: { popularity: -3, notoriety: 2 } },
  ],
});
ev({
  id: 'pol_tax_scandal', category: 'politics', weight: 3, conditions: { inOffice: 'any', minMoney: 200_000 },
  text: 'Leaked documents suggest you routed personal income through an offshore shell to minimize tax.',
  choices: [
    { label: 'Pay the back taxes and apologize', effects: { money: -80_000, karma: 4, popularity: 1 } },
    { label: 'Argue it was fully legal tax planning', skillCheck: { skillId: SK.law, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The legal argument held up in the court of public opinion.', effects: { popularity: -1 } },
      { chance: 0.5, text: 'Voters saw it as a rich person\'s excuse.', effects: { popularity: -9, karma: -3 } },
    ] },
    { label: 'Stonewall the reporters', effects: { popularity: -4, notoriety: 2 } },
  ],
});
ev({
  id: 'pol_hot_mic_comment', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'A hot mic caught you making a dismissive comment about voters in {city} that is now everywhere online.',
  choices: [
    { label: 'Issue a full, direct apology', effects: { popularity: 1, karma: 3 } },
    { label: 'Say it was taken out of context', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'The context defense actually landed.', effects: { popularity: 0 } },
      { chance: 0.45, text: 'The full clip made things worse.', effects: { popularity: -7 } },
    ] },
    { label: 'Double down defiantly', effects: { popularity: -5, notoriety: 3, influence: 1 } },
  ],
});
ev({
  id: 'pol_affair_rumor', category: 'politics', weight: 3, conditions: { inOffice: 'any', hasSpouse: true },
  text: 'Tabloids are running unconfirmed rumors of an affair, sourced to an anonymous staffer.',
  choices: [
    { label: 'Deny it categorically', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'The denial held and the story faded.', effects: { happiness: -2 } },
      { chance: 0.45, text: 'The denial only fueled more speculation.', effects: { popularity: -6, happiness: -6 } },
    ] },
    { label: 'Address it directly with your spouse at your side', effects: { happiness: -3, popularity: 2, karma: 2 } },
    { label: 'Refuse to dignify it with a response', effects: { popularity: -2 } },
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
ev({
  id: 'crime_family_dispute', category: 'crime', weight: 4, conditions: { inCrimeFamily: true },
  text: 'Two capos in the family are feuding and both want your loyalty.',
  choices: [
    { label: 'Back the ambitious one', skillCheck: { skillId: SK.streetSmarts, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'He came out on top. You are rewarded.', effects: { money: 25_000, notoriety: 2 } },
      { chance: 0.45, text: 'He lost. You are on thin ice with the family now.', effects: { notoriety: 4, happiness: -4 } },
    ] },
    { label: 'Back the cautious one', effects: { notoriety: 1, karma: -2 } },
    { label: 'Stay neutral', skillCheck: { skillId: SK.evasion, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'You threaded the needle without picking a side.', effects: {} },
      { chance: 0.4, text: 'Neutrality just annoyed both of them.', effects: { notoriety: 2, happiness: -2 } },
    ] },
  ],
});
ev({
  id: 'crime_informant_approach', category: 'crime', weight: 3, conditions: { inCrimeFamily: true, minNotoriety: 15 },
  text: 'A federal agent quietly approaches you with an offer: turn informant and walk away clean.',
  choices: [
    { label: 'Refuse and report it to the family', effects: { notoriety: 3, karma: -3 } },
    { label: 'Consider it — buy some time', effects: { happiness: -3 } },
    { label: 'Take the deal', outcomes: [
      { chance: 0.5, text: 'Your testimony brought down the family. You walked free.', effects: { karma: 8, notoriety: -20, money: -20_000 } },
      { chance: 0.5, text: 'Word got out before the case was built. You are now a marked man.', effects: { notoriety: 15, happiness: -10, health: -5 } },
    ] },
  ],
});
ev({
  id: 'crime_stash_house_raid', category: 'crime', weight: 3, conditions: { inCrimeFamily: true },
  text: 'Police raided a stash house connected to your operation. Your name might come up.',
  choices: [
    { label: 'Lay low for a while', effects: { notoriety: -2, happiness: -2 } },
    { label: 'Lawyer up preemptively', effects: { money: -15_000, notoriety: -1 } },
    { label: 'Do nothing', outcomes: [
      { chance: 0.6, text: 'Your name never came up.', effects: {} },
      { chance: 0.4, text: 'Investigators traced it back to you.', effects: { criminalRecord: 1, jailYears: 2 } },
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
ev({
  id: 'honor_knighthood', category: 'media', weight: 2, once: true, conditions: { minReputation: 75, minAge: 40 },
  text: 'In recognition of your contributions, the state offers to bestow a knighthood upon you.',
  choices: [
    { label: 'Accept the honor', effects: { reputation: 8, popularity: 5, influence: 4, achievement: 'knighted' } },
    { label: 'Humbly decline', effects: { karma: 3 } },
  ],
});
ev({
  id: 'media_misinformation_story', category: 'media', weight: 4, conditions: { minFollowers: 5_000 },
  text: 'A fabricated story about you is spreading fast online — fake screenshots, no source, and it\'s already trending.',
  choices: [
    { label: 'Publicly fact-check it with receipts', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'The fact-check landed — most people moved on.', effects: { reputation: 2, karma: 2, socialFollowersPct: 0.01 } },
      { chance: 0.4, text: 'The fact-check got less reach than the original lie.', effects: { reputation: -4, popularity: -2 } },
    ] },
    { label: 'Ignore it and hope it blows over', outcomes: [
      { chance: 0.55, text: 'It faded within a week, like most fake stories do.', effects: {} },
      { chance: 0.45, text: 'Silence read as an admission — it kept spreading.', effects: { reputation: -6, popularity: -4, cancelledYears: 1 } },
    ] },
    { label: 'Threaten legal action against whoever started it', effects: { money: -8_000, influence: 2 }, outcomes: [
      { chance: 0.5, text: 'The threat worked — the story was quietly deleted.', effects: { reputation: 3 } },
      { chance: 0.5, text: 'It backfired — now it\'s a story about you threatening critics.', effects: { reputation: -5, notoriety: 2 } },
    ] },
  ],
});
ev({
  id: 'media_cancellation_wave', category: 'media', weight: 5, conditions: { cancelled: true },
  text: 'The backlash from your post is still going — sponsors are pulling out and old clips keep resurfacing.',
  choices: [
    { label: 'Lay low and let it pass', effects: { happiness: -3 } },
    { label: "Hire a crisis PR firm", effects: { money: -15_000 }, outcomes: [
      { chance: 0.6, text: 'The firm managed the narrative — the wave is subsiding faster.', effects: { reputation: 3, cancelledYears: -1 } },
      { chance: 0.4, text: 'Even professional spin couldn\'t slow this one down.', effects: { money: -5_000 } },
    ] },
    { label: 'Address it head-on in a long, honest post', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.5, text: 'People respected the honesty — you\'re winning some back.', effects: { reputation: 4, popularity: 2, socialFollowersPct: 0.03, cancelledYears: -1 } },
      { chance: 0.5, text: 'It read as damage control and reopened the wound.', effects: { reputation: -3, popularity: -3 } },
    ] },
  ],
});
ev({
  id: 'honor_hall_of_fame', category: 'business', weight: 2, once: true, conditions: { minMoney: 500_000_000, minReputation: 60 },
  text: 'A prestigious business hall of fame wants to induct you for your industry impact.',
  choices: [
    { label: 'Accept induction', effects: { reputation: 10, influence: 3, achievement: 'hall_of_fame' } },
    { label: 'Skip the ceremony', effects: {} },
  ],
});
ev({
  id: 'honor_civic_medal', category: 'life', weight: 3, conditions: { minAge: 30, minReputation: 20 },
  text: 'A civic organization wants to award you a medal for outstanding community contribution.',
  choices: [
    { label: 'Attend the ceremony', outcomes: [
      { chance: 0.7, text: 'A heartfelt night — the community truly appreciates you.', effects: { karma: 5, popularity: 3, happiness: 5 } },
      { chance: 0.3, text: 'An awkward, overlong ceremony, but the sentiment was nice.', effects: { karma: 2, happiness: 1 } },
    ] },
    { label: "Can't make it", effects: { karma: -1 } },
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

// ---------------------------------------------------------------------------
// MENTORS & RIVALS
// ---------------------------------------------------------------------------
ev({
  id: 'mentor_advice', category: 'life', weight: 5, conditions: { hasMentor: true },
  text: '{npc} invites you for coffee and offers some hard-won career advice.',
  choices: [
    { label: 'Listen closely', effects: { smarts: 2, skillXp: [SK.strategy, 10], happiness: 2 } },
    { label: 'Politely tune out', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'mentor_opportunity', category: 'career', weight: 3, conditions: { hasMentor: true },
  text: '{npc} pulls a string on your behalf, opening a door that would otherwise stay shut.',
  choices: [
    { label: 'Take the opportunity', effects: { influence: 4, reputation: 2, money: 5_000 } },
    { label: 'Insist on earning it yourself', effects: { karma: 3, smarts: 1 } },
  ],
});
ev({
  id: 'rival_sabotage', category: 'business', weight: 4, conditions: { hasRival: true },
  text: 'You catch wind that {npc} has been badmouthing you to mutual contacts.',
  choices: [
    { label: 'Confront them publicly', skillCheck: { skillId: SK.debate, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'You came out looking sharp; they looked petty.', effects: { reputation: 3, popularity: 1 } },
      { chance: 0.5, text: 'It turned into an ugly public spat.', effects: { reputation: -3, happiness: -3 } },
    ] },
    { label: 'Undermine them quietly in return', effects: { karma: -4, notoriety: 2 } },
    { label: 'Ignore it and focus on your own work', effects: { karma: 2, smarts: 1 } },
  ],
});
ev({
  id: 'rival_escalation', category: 'life', weight: 3, conditions: { hasRival: true },
  text: 'Your rivalry with {npc} has become the talk of the town.',
  choices: [
    { label: 'Escalate — go for the win', effects: { happiness: -2, reputation: 2, notoriety: 1 } },
    { label: 'Try to make peace', skillCheck: { skillId: SK.persuasion, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'A surprising truce. The feud is over.', effects: { happiness: 6, karma: 4 } },
      { chance: 0.5, text: 'They rebuffed your olive branch.', effects: { happiness: -3 } },
    ] },
  ],
});

// ---------------------------------------------------------------------------
// V9: 30 additional event templates
// ---------------------------------------------------------------------------
ev({
  id: 'life_lottery_ticket', category: 'life', weight: 5,
  text: 'A co-worker is organizing a lottery pool. Buy in for {amount}?',
  amount: { min: 20, max: 100 },
  choices: [
    { label: 'Buy in', outcomes: [
      { chance: 0.02, text: 'Against all odds, your numbers hit! A modest but real windfall.', effects: { moneyAmountMult: -1, money: 40_000, happiness: 10 } },
      { chance: 0.98, text: 'No luck this time.', effects: { moneyAmountMult: -1 } },
    ] },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'life_car_accident', category: 'life', weight: 4,
  text: 'A fender-bender on the way home in {city} left you shaken.',
  choices: [
    { label: 'File an insurance claim', effects: { money: -800, happiness: -3 } },
    { label: 'Settle it in cash on the spot', effects: { money: -400, happiness: -1 } },
  ],
});
ev({
  id: 'life_home_burglary', category: 'life', weight: 3, conditions: { hasProperty: true },
  text: 'One of your properties in {city} was broken into.',
  choices: [
    { label: 'File a claim and upgrade security', effects: { money: -3_000, propertyValuePct: -0.02 } },
    { label: 'Handle repairs yourself', effects: { money: -1_200, happiness: -2 } },
  ],
});
ev({
  id: 'career_layoffs_announced', category: 'career', weight: 5, conditions: { employed: true },
  text: 'Your employer just announced sweeping layoffs. Your position may be on the line.',
  choices: [
    { label: 'Make the case for why you should stay', skillCheck: { skillId: SK.persuasion, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'You survived the cuts and even picked up extra responsibility.', effects: { jobPerformance: 8, reputation: 2 } },
      { chance: 0.4, text: 'You were let go despite your best efforts.', effects: { loseJob: true, happiness: -8 } },
    ] },
    { label: 'Start looking for a new job quietly', effects: { happiness: -2, smarts: 1 } },
  ],
});
ev({
  id: 'career_mentorship_offer', category: 'career', weight: 5, conditions: { employed: true },
  text: 'A senior figure at work offers to personally mentor you.',
  choices: [
    { label: 'Accept eagerly', effects: { smarts: 2, jobPerformance: 6, happiness: 3 } },
    { label: 'Politely decline — you prefer to learn your own way', effects: { karma: 1 } },
  ],
});
ev({
  id: 'career_toxic_boss', category: 'career', weight: 4, conditions: { employed: true },
  text: 'Your boss humiliated you in front of the whole team over a minor mistake.',
  choices: [
    { label: 'Confront them privately', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'They apologized and backed off.', effects: { happiness: 4, jobPerformance: 2 } },
      { chance: 0.45, text: 'They doubled down and made things worse.', effects: { happiness: -8, jobPerformance: -3 } },
    ] },
    { label: 'Report it to HR', effects: { happiness: -1, karma: 2 } },
    { label: 'Grit your teeth and move on', effects: { happiness: -3 } },
  ],
});
ev({
  id: 'career_friend_side_hustle', category: 'career', weight: 4,
  text: 'A friend suggests you start a side hustle in your spare time.',
  choices: [
    { label: 'Give it a shot', outcomes: [
      { chance: 0.5, text: 'It actually turned a modest profit.', effects: { money: 6_000, happiness: 3 } },
      { chance: 0.5, text: 'It fizzled out after a few months.', effects: { money: -1_500, smarts: 1 } },
    ] },
    { label: 'Not worth the time', effects: {} },
  ],
});
ev({
  id: 'biz_supplier_price_hike', category: 'business', weight: 5, conditions: { hasBusiness: true },
  text: '{company}\'s key supplier just hiked prices without warning.',
  choices: [
    { label: 'Negotiate a better rate', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'You talked them down significantly.', effects: { companyCash: -8_000 } },
      { chance: 0.45, text: 'They would not budge.', effects: { companyCash: -25_000 } },
    ] },
    { label: 'Pay it and pass the cost to customers', effects: { companyCash: -5_000, companyBrand: -2 } },
    { label: 'Find a new supplier', effects: { companyCash: -15_000, companyQuality: 2 } },
  ],
});
ev({
  id: 'biz_key_employee_poached', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A rival firm is aggressively courting one of {company}\'s best people.',
  choices: [
    { label: 'Counter with a raise and equity', effects: { companyCash: -20_000, companyMorale: 6 } },
    { label: 'Let them go gracefully', effects: { companyMorale: -3 } },
    { label: 'Match nothing — they made their choice', effects: { companyMorale: -6 } },
  ],
});
ev({
  id: 'biz_viral_marketing', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A scrappy social post about {company} unexpectedly went viral.',
  choices: [
    { label: 'Lean into the moment with a follow-up campaign', skillCheck: { skillId: SK.marketing, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'The momentum turned into real sales.', effects: { companyBrand: 8, companyCash: 15_000 } },
      { chance: 0.4, text: 'The follow-up fell flat and killed the buzz.', effects: { companyBrand: -2 } },
    ] },
    { label: 'Let it run its course naturally', effects: { companyBrand: 4 } },
  ],
});
ev({
  id: 'biz_patent_troll', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'A shell company with a vague patent is threatening to sue {company}.',
  choices: [
    { label: 'Fight it in court', skillCheck: { skillId: SK.law, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The suit was thrown out.', effects: { companyCash: -10_000, reputation: 2 } },
      { chance: 0.5, text: 'The costly case dragged on for a year.', effects: { companyCash: -60_000 } },
    ] },
    { label: 'Settle quietly', effects: { companyCash: -30_000 } },
  ],
});
ev({
  id: 'market_ipo_hype', category: 'market', weight: 4,
  text: 'A hyped new IPO is the talk of every trading desk. Get in early for {amount}?',
  amount: { min: 5_000, max: 40_000 },
  choices: [
    { label: 'Buy in on the hype', outcomes: [
      { chance: 0.4, text: 'It popped on debut — a nice quick profit.', effects: { moneyAmountMult: 0.4, karma: -1 } },
      { chance: 0.6, text: 'It cratered below the offer price.', effects: { moneyAmountMult: -0.5 } },
    ] },
    { label: 'Wait and watch from the sidelines', effects: { karma: 1 } },
  ],
});
ev({
  id: 'market_flash_crash', category: 'market', weight: 3, conditions: { hasStocks: true },
  text: 'A brief algorithmic flash crash sent your portfolio into a tailspin for a few terrifying minutes before recovering.',
  choices: [
    { label: 'Ride it out calmly', effects: { happiness: -2, smarts: 1 } },
    { label: 'Panic-sell some positions', effects: { money: -5_000, karma: -1 } },
  ],
});
ev({
  id: 'market_insider_tip', category: 'market', weight: 3, conditions: { hasStocks: true },
  text: 'An old contact offers you a "sure thing" stock tip that smells like insider information.',
  choices: [
    { label: 'Act on it', skillCheck: { skillId: SK.evasion, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.55, text: 'The trade paid off and nobody noticed.', effects: { money: 25_000, karma: -6 } },
      { chance: 0.45, text: 'Regulators came knocking.', effects: { money: -10_000, criminalRecord: 1, reputation: -10, karma: -6 } },
    ] },
    { label: 'Refuse — not worth the risk', effects: { karma: 4 } },
  ],
});
ev({
  id: 'pol_gerrymandering_scandal', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'Leaked maps suggest your party gerrymandered districts to lock in an advantage.',
  choices: [
    { label: 'Defend the maps as standard practice', effects: { popularity: -4, karma: -3 } },
    { label: 'Call for an independent redistricting commission', effects: { popularity: 3, karma: 4, influence: -2 } },
  ],
});
ev({
  id: 'pol_endorsement_request', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'A smaller, ideologically adjacent party asks for your public endorsement ahead of the election.',
  choices: [
    { label: 'Endorse them', effects: { influence: 3, popularity: -1 } },
    { label: 'Decline to avoid the association', effects: { influence: -1 } },
  ],
});
ev({
  id: 'pol_whistleblower_leak', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'A whistleblower leaked internal memos revealing sloppy, but not illegal, decision-making in your office.',
  choices: [
    { label: 'Own the mistakes publicly', effects: { popularity: 1, karma: 4, reputation: 2 } },
    { label: 'Discredit the whistleblower', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The story lost steam.', effects: { karma: -4 } },
      { chance: 0.5, text: 'It backfired badly.', effects: { popularity: -8, karma: -5 } },
    ] },
  ],
});
ev({
  id: 'pol_state_visit', category: 'politics', weight: 3, conditions: { inOffice: ['head_of_state'] },
  text: 'You are hosting a state visit from a foreign dignitary, cameras everywhere.',
  choices: [
    { label: 'Roll out the full ceremonial treatment', effects: { money: -30_000, influence: 4, popularity: 2 } },
    { label: 'Keep it modest and businesslike', effects: { influence: 2 } },
  ],
});
ev({
  id: 'crime_informant_offer', category: 'crime', weight: 3, conditions: { inCrimeFamily: true },
  text: 'Detectives quietly offer you a deal: reduced charges if you inform on your associates.',
  choices: [
    { label: 'Take the deal', effects: { criminalRecord: -1, karma: -8, notoriety: -5 } },
    { label: 'Refuse and stay loyal', effects: { karma: 3, notoriety: 3 } },
  ],
});
ev({
  id: 'crime_turf_war', category: 'crime', weight: 3, conditions: { inCrimeFamily: true },
  text: 'A rival crew is muscling into territory your family considers its own.',
  choices: [
    { label: 'Push back hard', skillCheck: { skillId: SK.streetSmarts, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'You held the line and earned respect.', effects: { notoriety: 4, reputation: -2 } },
      { chance: 0.45, text: 'It got ugly and drew police attention.', effects: { criminalRecord: 1, jailYears: 1 } },
    ] },
    { label: 'Cede the ground quietly', effects: { notoriety: -3 } },
  ],
});
ev({
  id: 'crime_money_launderer_deal', category: 'crime', weight: 3, conditions: { inCrimeFamily: true },
  text: 'A professional launderer offers to clean your money for a cut, no questions asked.',
  choices: [
    { label: 'Take the deal', effects: { moneyPct: -0.05, karma: -3 } },
    { label: 'Handle it yourself', effects: { karma: -1 } },
  ],
});
ev({
  id: 'world_archaeological_find', category: 'world', weight: 4,
  text: 'Archaeologists in {country} uncovered a site that is rewriting the region\'s history.',
  choices: [
    { label: 'Follow the story with interest', effects: { smarts: 1, happiness: 1 } },
    { label: 'Ignore it', effects: {} },
  ],
});
ev({
  id: 'world_tech_breakthrough', category: 'world', weight: 4,
  text: 'Researchers announced a genuine breakthrough in {industry} that could reshape the sector.',
  choices: [
    { label: 'Study the implications for your own plans', effects: { smarts: 1 } },
    { label: 'Move on with your day', effects: {} },
  ],
});
ev({
  id: 'world_natural_wonder_tourism', category: 'world', weight: 3,
  text: 'A viral travel trend is sending tourists flooding toward a natural wonder in {country}.',
  choices: [
    { label: 'Consider visiting yourself someday', effects: { happiness: 1 } },
    { label: 'Not interested', effects: {} },
  ],
});
ev({
  id: 'media_deepfake_scandal', category: 'media', weight: 3, conditions: { minReputation: 40 },
  text: 'A convincing deepfake video of you saying something outrageous is spreading online.',
  choices: [
    { label: 'Issue a swift, clear debunking', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'The debunking worked and the story died fast.', effects: { reputation: 1 } },
      { chance: 0.4, text: 'Plenty of people believed it anyway.', effects: { reputation: -6, popularity: -4 } },
    ] },
    { label: 'Ignore it and hope it blows over', effects: { reputation: -3 } },
  ],
});
ev({
  id: 'media_documentary_offer', category: 'media', weight: 3, conditions: { minReputation: 55 },
  text: 'A respected documentary filmmaker wants to make a feature about your rise.',
  choices: [
    { label: 'Grant full access', effects: { reputation: 5, popularity: 3, happiness: -2 } },
    { label: 'Allow limited access only', effects: { reputation: 2 } },
    { label: 'Decline — too exposing', effects: { karma: 1 } },
  ],
});
ev({
  id: 'fam_inheritance_windfall', category: 'family', weight: 3,
  text: 'A distant relative you barely knew has left you a modest inheritance.',
  choices: [
    { label: 'Accept it gratefully', effects: { money: 25_000, happiness: 3 } },
    { label: 'Donate it to their favorite cause', effects: { karma: 6, happiness: 2 } },
  ],
});
ev({
  id: 'fam_family_reunion', category: 'family', weight: 3, conditions: { hasChildren: true },
  text: 'A big, chaotic family reunion brings everyone together for a weekend.',
  choices: [
    { label: 'Throw yourself into it', effects: { happiness: 6, karma: 2 } },
    { label: 'Keep some polite distance', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'health_diagnosis_scare', category: 'health', weight: 4,
  text: 'A routine check-up flagged something that needs further testing.',
  choices: [
    { label: 'Get the full workup immediately', effects: { money: -2_500, happiness: -3, health: 2 } },
    { label: 'Wait and see if it resolves on its own', effects: { happiness: -5 } },
  ],
});
ev({
  id: 'health_fitness_breakthrough', category: 'health', weight: 4,
  text: 'Months of consistent effort finally show real results — you hit a personal best.',
  choices: [
    { label: 'Celebrate the milestone', effects: { happiness: 6, health: 4, skillXp: [SK.fitness, 10] } },
  ],
});

// ---------------------------------------------------------------------------
// V10: 15 additional event templates
// ---------------------------------------------------------------------------
ev({
  id: 'life_neighbor_dispute', category: 'life', weight: 4, conditions: { hasProperty: true },
  text: 'A property line dispute with your neighbor in {city} is getting heated.',
  choices: [
    { label: 'Hire a surveyor to settle it', effects: { money: -1_500, happiness: -1 } },
    { label: 'Let it go for the sake of peace', effects: { happiness: -2, karma: 2 } },
  ],
});
ev({
  id: 'life_pet_emergency', category: 'life', weight: 3,
  text: 'An unexpected emergency vet bill for {amount} landed on your desk.',
  amount: { min: 300, max: 1_200 },
  choices: [
    { label: 'Pay it without hesitation', effects: { moneyAmountMult: -1, happiness: 1 } },
    { label: 'Shop around for a cheaper clinic', effects: { moneyAmountMult: -0.6, happiness: -1 } },
  ],
});
ev({
  id: 'career_promotion_review', category: 'career', weight: 5, conditions: { employed: true },
  text: 'Your annual performance review is coming up, and a promotion might be on the table.',
  choices: [
    { label: 'Make your case assertively', skillCheck: { skillId: SK.persuasion, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'You got the promotion and a raise.', effects: { jobPerformance: 10, happiness: 5 } },
      { chance: 0.5, text: 'You were passed over this cycle.', effects: { happiness: -4 } },
    ] },
    { label: 'Let your work speak for itself', effects: { jobPerformance: 3 } },
  ],
});
ev({
  id: 'career_conference_invite', category: 'career', weight: 4, conditions: { employed: true },
  text: 'Your employer is sending a few people to an industry conference. You could be one of them.',
  choices: [
    { label: 'Volunteer to go', effects: { smarts: 1, jobPerformance: 3, happiness: 2 } },
    { label: 'Let someone else take the trip', effects: {} },
  ],
});
ev({
  id: 'biz_esg_report_scrutiny', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'A watchdog group is scrutinizing {company}\'s environmental and labor practices.',
  choices: [
    { label: 'Commission an independent audit', effects: { companyCash: -15_000, companyBrand: 5 } },
    { label: 'Dismiss it as activist noise', effects: { companyBrand: -4, karma: -2 } },
  ],
});
ev({
  id: 'biz_union_organizing', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'Workers at {company} are quietly organizing to unionize.',
  choices: [
    { label: 'Get ahead of it with better pay and conditions', effects: { companyCash: -25_000, companyMorale: 10, karma: 3 } },
    { label: 'Fight the unionization effort', skillCheck: { skillId: SK.management, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The effort fizzled out.', effects: { companyMorale: -3, karma: -3 } },
      { chance: 0.5, text: 'It succeeded anyway, and morale is sour.', effects: { companyMorale: -8, karma: -4 } },
    ] },
  ],
});
ev({
  id: 'market_meme_stock', category: 'market', weight: 3, conditions: { hasStocks: true },
  text: 'One of your holdings got adopted as an internet meme stock overnight.',
  choices: [
    { label: 'Ride the wave and sell into the spike', effects: { money: 8_000, karma: -1 } },
    { label: 'Hold for the fundamentals', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'market_analyst_downgrade', category: 'market', weight: 3, conditions: { businessPublic: true },
  text: 'A prominent analyst downgraded {company}, citing growth concerns.',
  choices: [
    { label: 'Respond publicly with confidence', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The market shrugged it off.', effects: { companyBrand: 1 } },
      { chance: 0.5, text: 'Shares dipped anyway.', effects: { companyCash: -5_000 } },
    ] },
    { label: 'Let the fundamentals speak for themselves', effects: {} },
  ],
});
ev({
  id: 'pol_town_hall_disruption', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'Protesters disrupted your town hall meeting in {city}, chanting over your remarks.',
  choices: [
    { label: 'Engage with them directly', skillCheck: { skillId: SK.diplomacy, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You defused the tension and even won some over.', effects: { popularity: 3, karma: 2 } },
      { chance: 0.45, text: 'It devolved into a shouting match.', effects: { popularity: -4 } },
    ] },
    { label: 'Have security remove them', effects: { popularity: -3, notoriety: 1 } },
  ],
});
ev({
  id: 'pol_youth_wing_energy', category: 'politics', weight: 3, conditions: { inParty: true },
  text: 'Your party\'s youth wing is pushing for a bolder, more energetic platform.',
  choices: [
    { label: 'Embrace their energy', effects: { influence: 2, popularity: 2 } },
    { label: 'Rein them in — stability first', effects: { influence: -1 } },
  ],
});
ev({
  id: 'crime_heist_crew_offer', category: 'crime', weight: 3, conditions: { inCrimeFamily: true },
  text: 'A crew wants to bring you in on a much bigger job than usual.',
  choices: [
    { label: 'Join the crew', skillCheck: { skillId: SK.streetSmarts, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.45, text: 'The job paid off huge.', effects: { money: 60_000, notoriety: 5 } },
      { chance: 0.55, text: 'It went sideways and you barely escaped.', effects: { criminalRecord: 1, jailYears: 2 } },
    ] },
    { label: 'Sit this one out', effects: { notoriety: -1 } },
  ],
});
ev({
  id: 'world_currency_devaluation', category: 'world', weight: 3,
  text: '{country} devalued its currency overnight, rattling regional markets.',
  choices: [
    { label: 'Watch your exposure closely', effects: { smarts: 1 } },
    { label: 'Not your problem', effects: {} },
  ],
});
ev({
  id: 'media_longform_podcast_invite', category: 'media', weight: 4, conditions: { minReputation: 45 },
  text: 'A popular podcast wants to have you on for a long-form interview.',
  choices: [
    { label: 'Go on and be candid', skillCheck: { skillId: SK.publicSpeaking, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'You came across as thoughtful and genuine.', effects: { reputation: 4, popularity: 2 } },
      { chance: 0.4, text: 'An offhand comment got clipped out of context.', effects: { reputation: -3 } },
    ] },
    { label: 'Stick to safe talking points', effects: { reputation: 1 } },
  ],
});
ev({
  id: 'fam_blended_family_tension', category: 'family', weight: 3, conditions: { hasSpouse: true, hasChildren: true },
  text: 'Balancing time between your spouse and kids has been stressful lately.',
  choices: [
    { label: 'Plan a dedicated family day', effects: { happiness: 5, money: -500 } },
    { label: 'Push through — things will settle down', effects: { happiness: -2 } },
  ],
});
ev({
  id: 'health_burnout_warning', category: 'health', weight: 4, conditions: { employed: true },
  text: 'You have been running on empty for weeks and your body is sending warning signs.',
  choices: [
    { label: 'Take real time off to recover', effects: { happiness: 6, health: 5, jobPerformance: -3 } },
    { label: 'Push through it', effects: { health: -5, happiness: -3 } },
  ],
});

// ---------------------------------------------------------------------------
// V29 CONTENT BATCH — 110 new templates across all ten categories
// ---------------------------------------------------------------------------

// --- LIFE ---
ev({
  id: 'life_garage_sale', category: 'life', weight: 4,
  text: 'Your closet is overflowing. A neighborhood garage sale is coming up.',
  choices: [
    { label: 'Sell off the clutter', effects: { money: 300, happiness: 2 } },
    { label: 'Donate it all instead', effects: { karma: 3, happiness: 1 } },
    { label: 'Leave it for another year', effects: {} },
  ],
});
ev({
  id: 'life_road_trip_offer', category: 'life', weight: 4,
  text: 'Friends are planning a spontaneous road trip. Entry costs {amount} in gas and lodging.',
  amount: { min: 400, max: 1200 },
  choices: [
    { label: 'Go for it', effects: { moneyAmountMult: -1, happiness: 6 } },
    { label: 'Stay home and save', effects: {} },
  ],
});
ev({
  id: 'life_new_hobby_expensive', category: 'life', weight: 3,
  text: 'A friend got you hooked on an expensive new hobby — gear runs {amount}.',
  amount: { min: 500, max: 3000 },
  choices: [
    { label: 'Dive in headfirst', effects: { moneyAmountMult: -1, happiness: 5, skillXp: [SK.golf, 10] } },
    { label: 'Try it cheaply first', effects: { happiness: 2, money: -100 } },
    { label: 'Pass', effects: {} },
  ],
});
ev({
  id: 'life_home_declutter', category: 'life', weight: 4,
  text: 'A weekend of ruthless decluttering left your home feeling brand new.',
  choices: [
    { label: 'Enjoy the calm', effects: { happiness: 3, health: 1 } },
  ],
});
ev({
  id: 'life_bank_scam_call', category: 'life', weight: 4,
  text: 'You got a convincing call claiming to be from your bank about "suspicious activity."',
  choices: [
    { label: 'Hang up and call the bank directly', skillCheck: { skillId: SK.economics, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.9, text: 'Good instinct — it was a scam.', effects: { happiness: 1 } },
      { chance: 0.1, text: 'You second-guessed yourself and gave up a code before hanging up.', effects: { money: -800, happiness: -4 } },
    ] },
    { label: 'Give them the verification code', outcomes: [
      { chance: 0.85, text: 'It was indeed a scam. Costly lesson.', effects: { money: -1500, happiness: -5 } },
      { chance: 0.15, text: 'Somehow it was legitimate.', effects: {} },
    ] },
  ],
});
ev({
  id: 'life_reunion_invite', category: 'life', weight: 4, conditions: { minAge: 28 },
  text: 'A high school reunion invitation arrived. Attending costs {amount}.',
  amount: { min: 100, max: 400 },
  choices: [
    { label: 'Go and reconnect', effects: { moneyAmountMult: -1, happiness: 4, charisma: 1 } },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'life_minimalism_kick', category: 'life', weight: 3,
  text: 'You went through a minimalism phase and sold most of what you own.',
  choices: [
    { label: 'Lean into it', effects: { money: 600, happiness: 2 } },
    { label: 'Regret it halfway through', effects: { money: 200, happiness: -1 } },
  ],
});
ev({
  id: 'life_language_immersion', category: 'life', weight: 3,
  text: 'A language immersion weekend is being offered in {city} for {amount}.',
  amount: { min: 300, max: 900 },
  choices: [
    { label: 'Sign up', effects: { moneyAmountMult: -1, skillXp: [SK.foreignLanguages, 15], smarts: 1 } },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'life_home_garden', category: 'life', weight: 4,
  text: 'You started a small backyard garden.',
  choices: [
    { label: 'Tend it diligently', effects: { happiness: 3, health: 1, money: -100 } },
    { label: 'Let it go wild', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'life_estate_sale_find', category: 'life', weight: 3,
  text: 'You stumbled on an estate sale with a genuinely interesting find.',
  choices: [
    { label: 'Buy it on a hunch', effects: { money: -300, happiness: 2 } },
    { label: 'Walk away', effects: {} },
  ],
});
ev({
  id: 'life_volunteer_abroad', category: 'life', weight: 3, conditions: { minMoney: 3000 },
  text: 'A volunteer program abroad is recruiting. It costs {amount} to join for a month.',
  amount: { min: 1500, max: 4000 },
  choices: [
    { label: 'Go volunteer', effects: { moneyAmountMult: -1, karma: 6, happiness: 5, reputation: 2 } },
    { label: 'Donate money instead', effects: { money: -300, karma: 3 } },
    { label: 'Not this year', effects: {} },
  ],
});

// --- CAREER ---
ev({
  id: 'career_mentor_offer', category: 'career', weight: 4, conditions: { employed: true },
  text: 'A senior colleague offered to mentor you informally.',
  choices: [
    { label: 'Accept gladly', effects: { jobPerformance: 4, smarts: 1 } },
    { label: 'Politely decline — too busy', effects: {} },
  ],
});
ev({
  id: 'career_harsh_manager', category: 'career', weight: 4, conditions: { employed: true },
  text: 'Your boss has been unusually harsh and demanding lately.',
  choices: [
    { label: 'Push back diplomatically', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'They backed off and things improved.', effects: { happiness: 3, jobPerformance: 1 } },
      { chance: 0.5, text: 'They got defensive and things got tenser.', effects: { happiness: -3, jobPerformance: -2 } },
    ] },
    { label: 'Grin and bear it', effects: { happiness: -3, health: -2 } },
    { label: 'Start looking elsewhere', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'career_industry_conference', category: 'career', weight: 4, conditions: { employed: true },
  text: 'Your company is sending a few people to an industry conference. Attendance costs {amount} out of pocket for extras.',
  amount: { min: 200, max: 800 },
  choices: [
    { label: 'Go and network hard', effects: { moneyAmountMult: -1, jobPerformance: 3, charisma: 1 } },
    { label: 'Skip the extras', effects: {} },
  ],
});
ev({
  id: 'career_credit_stolen', category: 'career', weight: 3, conditions: { employed: true },
  text: 'A coworker presented your idea as their own in a meeting.',
  choices: [
    { label: 'Call it out directly', skillCheck: { skillId: SK.publicSpeaking, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.55, text: 'You reclaimed credit and earned respect.', effects: { reputation: 2, jobPerformance: 2 } },
      { chance: 0.45, text: 'It came across as petty office politics.', effects: { happiness: -2, jobPerformance: -1 } },
    ] },
    { label: 'Let it go this time', effects: { happiness: -2 } },
  ],
});
ev({
  id: 'career_cross_training', category: 'career', weight: 4, conditions: { employed: true },
  text: 'Your employer offered free cross-training in a new skill area.',
  choices: [
    { label: 'Take the training', effects: { skillXp: [SK.management, 12], jobPerformance: 2 } },
    { label: 'Stick to your lane', effects: {} },
  ],
});
ev({
  id: 'career_relocation_offer', category: 'career', weight: 3, conditions: { employed: true },
  text: 'Your company offered to relocate you to a bigger office for a promotion track.',
  choices: [
    { label: 'Accept the move', effects: { jobPerformance: 5, happiness: -2, money: -2000 } },
    { label: 'Stay put', effects: {} },
  ],
});
ev({
  id: 'career_office_politics_alliance', category: 'career', weight: 3, conditions: { employed: true },
  text: 'A coworker is quietly building a faction and wants you on their side.',
  choices: [
    { label: 'Join them', effects: { jobPerformance: 2, karma: -1 } },
    { label: 'Stay neutral', effects: {} },
    { label: 'Report it to management', effects: { jobPerformance: -1, karma: 1 } },
  ],
});
ev({
  id: 'career_side_hustle_temptation', category: 'career', weight: 4, conditions: { employed: true },
  text: 'A friend wants you to moonlight on a side project in your off hours.',
  choices: [
    { label: 'Do it for the extra cash', effects: { money: 1200, health: -3, happiness: -1 } },
    { label: 'Focus on your day job', effects: {} },
  ],
});
ev({
  id: 'career_bad_performance_review', category: 'career', weight: 3, conditions: { employed: true },
  text: 'Your performance review came back weaker than expected.',
  choices: [
    { label: 'Ask for specific feedback and improve', effects: { jobPerformance: 3, happiness: -1 } },
    { label: 'Brush it off', effects: { jobPerformance: -2 } },
  ],
});
ev({
  id: 'career_headhunter_call', category: 'career', weight: 4, conditions: { employed: true, minReputation: 20 },
  text: 'A headhunter called with a tempting pitch about "a role you should hear about."',
  choices: [
    { label: 'Take the call', effects: { happiness: 1, reputation: 1 } },
    { label: 'Ignore it — loyal to your current job', effects: { jobPerformance: 1 } },
  ],
});
ev({
  id: 'career_office_move', category: 'career', weight: 3, conditions: { employed: true },
  text: 'Your company is moving offices to a much longer commute for you.',
  choices: [
    { label: 'Adjust and push through', effects: { happiness: -3, health: -1 } },
    { label: 'Negotiate remote days', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'They agreed to two remote days a week.', effects: { happiness: 3 } },
      { chance: 0.5, text: 'They said no, company policy.', effects: { happiness: -2 } },
    ] },
  ],
});

// --- BUSINESS ---
ev({
  id: 'biz_landlord_dispute', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'Your landlord wants to raise commercial rent sharply at renewal.',
  choices: [
    { label: 'Negotiate hard', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You got a more reasonable rate.', effects: { companyCash: -20000 } },
      { chance: 0.45, text: 'They held firm.', effects: { companyCash: -60000 } },
    ] },
    { label: 'Pay it and move on', effects: { companyCash: -60000 } },
    { label: 'Start looking for a new location', effects: { companyMorale: -3 } },
  ],
});
ev({
  id: 'biz_rival_poaching_attempt', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A rival company is trying to poach one of your best employees.',
  choices: [
    { label: 'Counter-offer to keep them', effects: { companyCash: -25000, companyMorale: 3 } },
    { label: 'Let them go', effects: { companyQuality: -3 } },
  ],
});
ev({
  id: 'biz_supplier_cost_increase', category: 'business', weight: 5, conditions: { hasBusiness: true },
  text: 'A key supplier is raising prices due to rising costs.',
  choices: [
    { label: 'Absorb the cost', effects: { companyCash: -30000 } },
    { label: 'Pass it to customers', effects: { companyBrand: -3, companyCash: 10000 } },
    { label: 'Find a new supplier', skillCheck: { skillId: SK.operations, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'You found a solid replacement.', effects: { companyCash: -5000 } },
      { chance: 0.5, text: 'The switch caused disruption.', effects: { companyQuality: -4, companyCash: -15000 } },
    ] },
  ],
});
ev({
  id: 'biz_social_viral_moment', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'Your business unexpectedly went viral on social media overnight.',
  choices: [
    { label: 'Lean into the moment', effects: { companyBrand: 8, companyCash: 20000 } },
    { label: 'Stay quiet and let it pass', effects: { companyBrand: 2 } },
  ],
});
ev({
  id: 'biz_equipment_breakdown', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'Critical equipment broke down, halting part of your operations.',
  choices: [
    { label: 'Rush repair', effects: { companyCash: -25000 } },
    { label: 'Limp along and delay', effects: { companyQuality: -5, companyCash: -10000 } },
  ],
});
ev({
  id: 'biz_board_disagreement', category: 'business', weight: 3, conditions: { hasBusiness: true, businessPublic: true },
  text: 'The board is split on your strategic direction.',
  choices: [
    { label: 'Push your vision through', skillCheck: { skillId: SK.strategy, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You won them over.', effects: { reputation: 2, companyCash: 15000 } },
      { chance: 0.45, text: 'It created lasting friction.', effects: { reputation: -2 } },
    ] },
    { label: 'Compromise on a middle path', effects: { companyCash: 5000 } },
  ],
});
ev({
  id: 'biz_customer_lawsuit_threat', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'An unhappy customer is threatening legal action over a product issue.',
  choices: [
    { label: 'Settle quietly', effects: { companyCash: -15000 } },
    { label: 'Fight it', skillCheck: { skillId: SK.law, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The claim was dismissed.', effects: {} },
      { chance: 0.5, text: 'You lost and paid heavily.', effects: { companyCash: -80000, companyBrand: -4 } },
    ] },
  ],
});
ev({
  id: 'biz_industry_award_nomination', category: 'business', weight: 3, conditions: { hasBusiness: true, minReputation: 30 },
  text: 'Your company was nominated for an industry award.',
  choices: [
    { label: 'Campaign for votes', effects: { companyCash: -5000, companyBrand: 4 } },
    { label: 'Let the nomination speak for itself', effects: { companyBrand: 1 } },
  ],
});
ev({
  id: 'biz_data_breach', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'Your company suffered a minor data breach.',
  choices: [
    { label: 'Disclose transparently and fix it', effects: { companyCash: -20000, companyBrand: -2, reputation: 1 } },
    { label: 'Quietly patch and stay quiet', outcomes: [
      { chance: 0.6, text: 'It never came out.', effects: { companyCash: -5000 } },
      { chance: 0.4, text: 'It leaked anyway, and the cover-up made it worse.', effects: { companyBrand: -10, reputation: -4 } },
    ] },
  ],
});
ev({
  id: 'biz_office_culture_survey', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'An anonymous employee survey revealed some real dissatisfaction.',
  choices: [
    { label: 'Act on the feedback', effects: { companyCash: -15000, companyMorale: 6 } },
    { label: 'File it away', effects: { companyMorale: -3 } },
  ],
});
ev({
  id: 'biz_export_opportunity', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'A distributor overseas wants to carry your product.',
  choices: [
    { label: 'Sign the export deal', effects: { companyCash: 40000, companyBrand: 3 } },
    { label: 'Not ready to scale internationally', effects: {} },
  ],
});

// --- MARKET ---
ev({
  id: 'market_hyped_ipo_listing', category: 'market', weight: 4, conditions: { minMoney: 5000 },
  text: 'A hyped new IPO is about to list, and everyone is talking about it.',
  choices: [
    { label: 'Buy in on day one', outcomes: [
      { chance: 0.4, text: 'It popped hard on debut.', effects: { money: 4000 } },
      { chance: 0.6, text: 'It fizzled after the hype faded.', effects: { money: -2500 } },
    ] },
    { label: 'Wait and watch', effects: {} },
  ],
});
ev({
  id: 'market_analyst_downgrade_note', category: 'market', weight: 4, conditions: { hasStocks: true },
  text: 'A major analyst downgraded a stock you hold.',
  choices: [
    { label: 'Sell before it drops further', effects: { money: -1000 } },
    { label: 'Hold your position', outcomes: [
      { chance: 0.5, text: 'The stock recovered.', effects: { money: 1500 } },
      { chance: 0.5, text: 'The downgrade proved right.', effects: { money: -2000 } },
    ] },
  ],
});
ev({
  id: 'market_dividend_surprise', category: 'market', weight: 4, conditions: { hasStocks: true },
  text: 'A company you hold announced a surprise special dividend.',
  choices: [
    { label: 'Take the payout', effects: { money: 1800, happiness: 2 } },
  ],
});
ev({
  id: 'market_insider_tip_offer', category: 'market', weight: 3, conditions: { hasStocks: true },
  text: 'An acquaintance hints they have inside information on an upcoming merger.',
  choices: [
    { label: 'Trade on it', outcomes: [
      { chance: 0.35, text: 'You made a killing before anyone noticed.', effects: { money: 15000, notoriety: 3 } },
      { chance: 0.65, text: 'Regulators noticed the unusual trading pattern.', effects: { money: -20000, criminalRecord: 1, reputation: -8 } },
    ] },
    { label: 'Refuse — not worth the risk', effects: { karma: 1 } },
  ],
});
ev({
  id: 'market_etf_rebalance', category: 'market', weight: 4, conditions: { hasStocks: true },
  text: 'Your broker suggests rebalancing your portfolio into index funds for stability.',
  choices: [
    { label: 'Rebalance', effects: { skillXp: [SK.investing, 8], money: -200 } },
    { label: 'Stay concentrated in individual picks', effects: {} },
  ],
});
ev({
  id: 'market_short_squeeze', category: 'market', weight: 3, conditions: { hasStocks: true, minMoney: 10000 },
  text: 'A heavily shorted stock is being talked about as a potential short squeeze.',
  choices: [
    { label: 'Pile in for the ride', outcomes: [
      { chance: 0.3, text: 'The squeeze happened. Huge gains.', effects: { money: 12000, happiness: 4 } },
      { chance: 0.7, text: 'It fizzled and you lost money.', effects: { money: -6000, happiness: -3 } },
    ] },
    { label: 'Stay away from the meme trade', effects: {} },
  ],
});
ev({
  id: 'market_bond_ladder_pitch', category: 'market', weight: 3, conditions: { minMoney: 20000 },
  text: 'A financial advisor pitched you on building a bond ladder for steady income.',
  choices: [
    { label: 'Set it up', effects: { skillXp: [SK.investing, 6], money: -500 } },
    { label: 'Not interested right now', effects: {} },
  ],
});
ev({
  id: 'market_currency_swing', category: 'market', weight: 3,
  text: 'A sudden currency swing affected the value of your foreign holdings.',
  choices: [
    { label: 'Ride it out', outcomes: [
      { chance: 0.5, text: 'It swung back in your favor.', effects: { money: 1200 } },
      { chance: 0.5, text: 'It kept moving against you.', effects: { money: -1200 } },
    ] },
  ],
});
ev({
  id: 'market_activist_investor_letter', category: 'market', weight: 3, conditions: { hasBusiness: true, businessPublic: true },
  text: 'An activist investor sent a public letter demanding changes at your company.',
  choices: [
    { label: 'Engage and negotiate', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'You reached an amicable settlement.', effects: { companyCash: -10000, reputation: 1 } },
      { chance: 0.5, text: 'It turned into a public fight.', effects: { companyBrand: -6, reputation: -2 } },
    ] },
    { label: 'Ignore the letter', effects: { companyBrand: -3 } },
  ],
});
ev({
  id: 'market_options_expiry_win', category: 'market', weight: 3, conditions: { hasStocks: true, minMoney: 5000 },
  text: 'You considered a risky options play ahead of earnings.',
  choices: [
    { label: 'Take the bet', outcomes: [
      { chance: 0.4, text: 'It paid off big.', effects: { money: 6000 } },
      { chance: 0.6, text: 'The options expired worthless.', effects: { money: -3000 } },
    ] },
    { label: 'Stick to your normal strategy', effects: {} },
  ],
});
ev({
  id: 'market_index_milestone', category: 'market', weight: 3,
  text: 'The national stock index hit a record high, dominating the headlines.',
  choices: [
    { label: 'Feel good about your holdings', effects: { happiness: 1 } },
    { label: 'Worry it means a correction is coming', effects: { happiness: -1 } },
  ],
  conditions: { hasStocks: true },
});

// --- POLITICS ---
ev({
  id: 'pol_town_hall_heckler', category: 'politics', weight: 4, conditions: { campaigning: true },
  text: 'A heckler disrupted your town hall event with pointed questions.',
  choices: [
    { label: 'Engage them directly', skillCheck: { skillId: SK.debate, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'You handled it with poise and won the room.', effects: { campaignMomentum: 4, popularity: 2 } },
      { chance: 0.45, text: 'It got tense and awkward on camera.', effects: { campaignMomentum: -3 } },
    ] },
    { label: 'Have security remove them', effects: { campaignMomentum: -1, popularity: -1 } },
  ],
});
ev({
  id: 'pol_endorsement_offer', category: 'politics', weight: 4, conditions: { campaigning: true },
  text: 'A prominent local business association wants to endorse your campaign.',
  choices: [
    { label: 'Accept the endorsement', effects: { campaignMomentum: 3, popularity: 1 } },
    { label: 'Decline to avoid the optics', effects: { reputation: 1 } },
  ],
});
ev({
  id: 'pol_leaked_memo', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'An internal policy memo leaked to the press before you were ready to announce it.',
  choices: [
    { label: 'Get ahead of the story', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You controlled the narrative.', effects: { popularity: 2 } },
      { chance: 0.45, text: 'The story ran wild before you could respond.', effects: { popularity: -4 } },
    ] },
    { label: 'Say nothing and let it blow over', effects: { popularity: -1 } },
  ],
});
ev({
  id: 'pol_constituent_casework', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'A constituent came to you with a genuinely difficult personal problem needing your help.',
  choices: [
    { label: 'Personally intervene', effects: { popularity: 2, karma: 2, politicalCapital: -1 } },
    { label: 'Refer them to your staff', effects: {} },
  ],
});
ev({
  id: 'pol_rival_scandal_opportunity', category: 'politics', weight: 3, conditions: { inParty: true, notInOffice: true },
  text: 'You learned of a genuine scandal involving a political rival.',
  choices: [
    { label: 'Leak it to the press', outcomes: [
      { chance: 0.6, text: 'It landed and damaged your rival badly.', effects: { popularity: 3, karma: -2 } },
      { chance: 0.4, text: 'It was traced back to you.', effects: { reputation: -6, karma: -3 } },
    ] },
    { label: 'Take the high road', effects: { karma: 2 } },
  ],
});
ev({
  id: 'pol_budget_negotiation', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'Tense budget negotiations with the opposition are dragging on.',
  choices: [
    { label: 'Compromise to get a deal done', skillCheck: { skillId: SK.coalition, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'A workable deal was reached.', effects: { popularity: 1, politicalCapital: 2 } },
      { chance: 0.4, text: 'Talks collapsed and voters blamed everyone.', effects: { popularity: -3 } },
    ] },
    { label: 'Hold the line on principle', effects: { politicalCapital: -2, popularity: 1 } },
  ],
});
ev({
  id: 'pol_grassroots_volunteers', category: 'politics', weight: 4, conditions: { campaigning: true },
  text: 'A wave of enthusiastic grassroots volunteers showed up wanting to help your campaign.',
  choices: [
    { label: 'Put them to work canvassing', effects: { campaignMomentum: 4 } },
    { label: 'Keep the operation lean', effects: {} },
  ],
});
ev({
  id: 'pol_foreign_delegation_visit', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'A foreign delegation requested a courtesy visit while touring the country.',
  choices: [
    { label: 'Host them warmly', effects: { influence: 2, popularity: 1 } },
    { label: 'Keep it brief and formal', effects: {} },
  ],
});
ev({
  id: 'pol_ballot_initiative', category: 'politics', weight: 3,
  text: 'A citizen-led ballot initiative on a hot-button issue is gathering signatures.',
  choices: [
    { label: 'Publicly support it', effects: { popularity: 1 } },
    { label: 'Publicly oppose it', effects: { popularity: -1 } },
    { label: 'Stay neutral', effects: {} },
  ],
});
ev({
  id: 'pol_staff_defection', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'A trusted senior staffer resigned abruptly to join a rival\'s team.',
  choices: [
    { label: 'Let them go gracefully', effects: { reputation: 1 } },
    { label: 'Publicly criticize their loyalty', effects: { popularity: -2, karma: -1 } },
  ],
});
ev({
  id: 'pol_infrastructure_ribbon_cutting', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'A long-promised infrastructure project finally finished, and there\'s a ribbon-cutting ceremony.',
  choices: [
    { label: 'Make it a big media event', effects: { popularity: 3 } },
    { label: 'Keep it low-key', effects: { popularity: 1 } },
  ],
});

// --- CRIME ---
ev({
  id: 'crime_stolen_identity', category: 'crime', weight: 3,
  text: 'Someone used your identity to open a fraudulent line of credit.',
  choices: [
    { label: 'Dispute it immediately', effects: { money: -300, happiness: -2 } },
    { label: 'Deal with it later', outcomes: [
      { chance: 0.5, text: 'It resolved itself eventually.', effects: { money: -500 } },
      { chance: 0.5, text: 'The debt collectors got aggressive.', effects: { money: -2000, happiness: -4 } },
    ] },
  ],
});
ev({
  id: 'crime_witness_approach', category: 'crime', weight: 3,
  text: 'You witnessed a crime and someone involved is pressuring you to stay quiet.',
  choices: [
    { label: 'Report it anyway', effects: { karma: 3, notoriety: 1 } },
    { label: 'Stay silent', effects: { karma: -2, money: 1000 } },
  ],
});
ev({
  id: 'crime_pickpocketed', category: 'crime', weight: 4,
  text: 'You got pickpocketed in a crowded market.',
  choices: [
    { label: 'Chase them down', outcomes: [
      { chance: 0.4, text: 'You caught them and got your things back.', effects: { happiness: 1 } },
      { chance: 0.6, text: 'They got away, and you got hurt trying.', effects: { health: -3, money: -200 } },
    ] },
    { label: 'Let it go', effects: { money: -200, happiness: -2 } },
  ],
});
ev({
  id: 'crime_bribery_offer', category: 'crime', weight: 3, conditions: { hasBusiness: true },
  text: 'A local official hinted that a "processing fee" would speed up your permits.',
  choices: [
    { label: 'Pay the bribe', outcomes: [
      { chance: 0.75, text: 'The permits sailed through.', effects: { companyCash: -8000, money: -3000, karma: -3 } },
      { chance: 0.25, text: 'It was a sting operation.', effects: { criminalRecord: 1, reputation: -8, jailYears: 1 } },
    ] },
    { label: 'Refuse and wait it out', effects: { karma: 2, companyCash: -2000 } },
  ],
});
ev({
  id: 'crime_neighborhood_watch', category: 'crime', weight: 4,
  text: 'Your neighborhood is starting a watch program after a string of break-ins.',
  choices: [
    { label: 'Join and volunteer', effects: { karma: 2, happiness: 1, skillXp: [SK.streetSmarts, 5] } },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'crime_counterfeit_goods', category: 'crime', weight: 3,
  text: 'You were offered a "great deal" on designer goods that are obviously counterfeit.',
  choices: [
    { label: 'Buy them anyway', effects: { money: -200, notoriety: 1, happiness: 1 } },
    { label: 'Refuse', effects: {} },
  ],
});
ev({
  id: 'crime_hacked_account', category: 'crime', weight: 3,
  text: 'One of your online accounts was compromised in a breach.',
  choices: [
    { label: 'Lock it down immediately', skillCheck: { skillId: SK.hacking, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.7, text: 'You secured everything in time.', effects: {} },
      { chance: 0.3, text: 'Some damage was already done.', effects: { money: -1500, happiness: -2 } },
    ] },
    { label: 'Deal with it whenever', effects: { money: -1500, happiness: -2 } },
  ],
});
ev({
  id: 'crime_underground_poker', category: 'crime', weight: 3, conditions: { minMoney: 5000 },
  text: 'You were invited to a high-stakes, off-the-books poker game.',
  choices: [
    { label: 'Play', skillCheck: { skillId: SK.poker, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'You cleaned up.', effects: { money: 8000, notoriety: 1 } },
      { chance: 0.5, text: 'You got cleaned out.', effects: { money: -6000 } },
    ] },
    { label: 'Decline', effects: {} },
  ],
});
ev({
  id: 'crime_extortion_threat', category: 'crime', weight: 3, conditions: { hasBusiness: true, minMoney: 20000 },
  text: 'Someone is threatening to spread damaging rumors about your business unless you pay up.',
  choices: [
    { label: 'Pay to make it go away', effects: { money: -8000, karma: -1 } },
    { label: 'Go to the police', outcomes: [
      { chance: 0.6, text: 'They caught the extortionist.', effects: { reputation: 2 } },
      { chance: 0.4, text: 'They followed through and spread the rumors anyway.', effects: { reputation: -6, companyBrand: -4 } },
    ] },
  ],
});
ev({
  id: 'crime_fake_charity', category: 'crime', weight: 3,
  text: 'A door-to-door "charity collector" seemed off, but was persistent.',
  choices: [
    { label: 'Donate anyway', effects: { money: -100 } },
    { label: 'Report them to local authorities', effects: { karma: 1 } },
  ],
});
ev({
  id: 'crime_stolen_vehicle', category: 'crime', weight: 3, conditions: { minMoney: 10000 },
  text: 'Your car was stolen from outside your home.',
  choices: [
    { label: 'File an insurance claim', effects: { money: -1000, happiness: -3 } },
    { label: 'Track it down yourself', skillCheck: { skillId: SK.streetSmarts, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.4, text: 'You actually found it, abandoned nearby.', effects: { happiness: 2 } },
      { chance: 0.6, text: 'It was long gone.', effects: { money: -5000, happiness: -4 } },
    ] },
  ],
});

// --- WORLD ---
ev({
  id: 'world_heatwave', category: 'world', weight: 4,
  text: 'A brutal heatwave is straining the power grid across {country}.',
  choices: [
    { label: 'Stay informed and prepared', effects: { health: -1 } },
    { label: 'Ignore it', effects: { health: -2 } },
  ],
});
ev({
  id: 'world_tech_leap', category: 'world', weight: 3,
  text: 'A breakthrough in a foreign lab promises to reshape an entire industry.',
  choices: [
    { label: 'Study the implications', effects: { smarts: 1 } },
    { label: 'Not your concern', effects: {} },
  ],
});
ev({
  id: 'world_royal_visit', category: 'world', weight: 3,
  text: 'A foreign head of state is visiting {country} and public events are being held.',
  choices: [
    { label: 'Attend a public event', effects: { happiness: 1, influence: 1 } },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'world_labor_strike', category: 'world', weight: 4,
  text: 'A nationwide transit strike is disrupting daily life across {country}.',
  choices: [
    { label: 'Work around it', effects: { happiness: -1 } },
    { label: 'Support the strikers publicly', effects: { karma: 1, reputation: 1 } },
  ],
});
ev({
  id: 'world_cultural_festival', category: 'world', weight: 4,
  text: 'A major cultural festival is happening in {city} this year.',
  choices: [
    { label: 'Attend and enjoy it', effects: { happiness: 3, money: -80 } },
    { label: 'Stay home', effects: {} },
  ],
});
ev({
  id: 'world_debt_downgrade', category: 'world', weight: 3,
  text: '{country}\'s credit rating was downgraded by a major agency.',
  choices: [
    { label: 'Watch your investments closely', effects: { smarts: 1 } },
    { label: 'Nothing to do about it', effects: {} },
  ],
});
ev({
  id: 'world_border_dispute', category: 'world', weight: 3,
  text: 'A minor border dispute between neighboring nations is making headlines.',
  choices: [
    { label: 'Follow the news closely', effects: {} },
    { label: 'Tune it out', effects: {} },
  ],
});
ev({
  id: 'world_science_prize', category: 'world', weight: 3,
  text: 'A researcher from {country} just won a major international science prize.',
  choices: [
    { label: 'Feel a swell of national pride', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'world_refugee_crisis', category: 'world', weight: 3,
  text: 'A humanitarian crisis abroad has sent a wave of refugees toward {country}.',
  choices: [
    { label: 'Donate to relief efforts', effects: { money: -200, karma: 3 } },
    { label: 'Focus on your own life', effects: {} },
  ],
});
ev({
  id: 'world_tourism_boom', category: 'world', weight: 4,
  text: 'Tourism to {country} is booming this year, filling hotels and streets.',
  choices: [
    { label: 'Enjoy the vibrant atmosphere', effects: { happiness: 1 } },
    { label: 'Find it overwhelming', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'world_undersea_cable_cut', category: 'world', weight: 2,
  text: 'A key undersea internet cable was damaged, slowing connectivity across the region.',
  choices: [
    { label: 'Adapt to slower service', effects: { happiness: -1 } },
  ],
});

// --- MEDIA ---
ev({
  id: 'media_documentary_pitch', category: 'media', weight: 3, conditions: { minReputation: 40 },
  text: 'A documentary crew wants to feature your life story.',
  choices: [
    { label: 'Cooperate fully', effects: { reputation: 3, popularity: 2, happiness: -1 } },
    { label: 'Decline — keep your privacy', effects: {} },
  ],
});
ev({
  id: 'media_hit_piece', category: 'media', weight: 3, conditions: { minReputation: 20 },
  text: 'A tabloid published an unflattering hit piece about you.',
  choices: [
    { label: 'Issue a public rebuttal', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'Your response won public sympathy.', effects: { reputation: 2 } },
      { chance: 0.5, text: 'It only fanned the flames.', effects: { reputation: -3 } },
    ] },
    { label: 'Ignore it', effects: { reputation: -1 } },
  ],
});
ev({
  id: 'media_viral_meme', category: 'media', weight: 3,
  text: 'A photo of you became an unexpected internet meme.',
  choices: [
    { label: 'Embrace it with humor', effects: { popularity: 3, happiness: 2 } },
    { label: 'Try to get it taken down', effects: { happiness: -1, reputation: -1 } },
  ],
});
ev({
  id: 'media_book_deal_offer', category: 'media', weight: 3, conditions: { minReputation: 35 },
  text: 'A publisher offered you a book deal about your career.',
  choices: [
    { label: 'Sign the deal', effects: { money: 15000, reputation: 2 } },
    { label: 'Not ready to write it', effects: {} },
  ],
});
ev({
  id: 'media_live_interview_gaffe', category: 'media', weight: 3, conditions: { minReputation: 25 },
  text: 'You misspoke badly during a live TV interview.',
  choices: [
    { label: 'Address it head-on afterward', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'Owning it earned you respect.', effects: { reputation: 1 } },
      { chance: 0.5, text: 'It kept getting replayed online.', effects: { reputation: -4 } },
    ] },
    { label: 'Hope it blows over', effects: { reputation: -2 } },
  ],
});
ev({
  id: 'media_photographer_stalking', category: 'media', weight: 2, conditions: { minReputation: 50 },
  text: 'Paparazzi have been following you around persistently.',
  choices: [
    { label: 'Hire security', effects: { money: -3000, happiness: 1 } },
    { label: 'Just deal with it', effects: { happiness: -2 } },
  ],
});
ev({
  id: 'media_op_ed_invite', category: 'media', weight: 4, conditions: { minReputation: 20 },
  text: 'A major newspaper invited you to write a guest op-ed.',
  choices: [
    { label: 'Write something bold', skillCheck: { skillId: SK.writing, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'It struck a chord and was widely shared.', effects: { reputation: 3, popularity: 2 } },
      { chance: 0.4, text: 'It landed flat.', effects: { reputation: -1 } },
    ] },
    { label: 'Play it safe', effects: { reputation: 1 } },
  ],
});
ev({
  id: 'media_talk_show_banter', category: 'media', weight: 3, conditions: { minReputation: 30 },
  text: 'You were invited onto a late-night talk show for a light interview.',
  choices: [
    { label: 'Be charming and funny', skillCheck: { skillId: SK.charm, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.65, text: 'You were a hit with the audience.', effects: { popularity: 3, happiness: 2 } },
      { chance: 0.35, text: 'The jokes fell flat.', effects: { popularity: -1 } },
    ] },
    { label: 'Keep it professional', effects: { reputation: 1 } },
  ],
});
ev({
  id: 'media_fact_check_dispute', category: 'media', weight: 3, conditions: { minReputation: 25 },
  text: 'A fact-checking outlet disputed a claim you made publicly.',
  choices: [
    { label: 'Correct the record', effects: { reputation: 1 } },
    { label: 'Stand by your original statement', outcomes: [
      { chance: 0.4, text: 'You were vindicated later.', effects: { reputation: 2 } },
      { chance: 0.6, text: 'It didn\'t hold up.', effects: { reputation: -3 } },
    ] },
  ],
});
ev({
  id: 'media_charity_telethon', category: 'media', weight: 3, conditions: { minReputation: 30 },
  text: 'You were invited to appear on a charity telethon broadcast.',
  choices: [
    { label: 'Pledge generously on air', effects: { money: -5000, karma: 4, popularity: 2 } },
    { label: 'Appear without pledging much', effects: { popularity: 1 } },
  ],
});

// --- FAMILY ---
ev({
  id: 'fam_inheritance_dispute', category: 'family', weight: 3, conditions: { minAge: 30 },
  text: 'A family inheritance dispute erupted after a relative\'s passing.',
  choices: [
    { label: 'Push for your fair share', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'It resolved amicably in your favor.', effects: { money: 12000 } },
      { chance: 0.5, text: 'It dragged on and damaged relationships.', effects: { happiness: -4, money: 2000 } },
    ] },
    { label: 'Step back to preserve family peace', effects: { karma: 2, happiness: 1 } },
  ],
});
ev({
  id: 'fam_sibling_feud', category: 'family', weight: 3,
  text: 'An old sibling rivalry flared up again at a family gathering.',
  choices: [
    { label: 'Address it honestly', effects: { happiness: 2, karma: 1 } },
    { label: 'Avoid the conflict', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'fam_child_school_trouble', category: 'family', weight: 4, conditions: { hasChildren: true },
  text: 'One of your children is struggling at school.',
  amount: { min: 500, max: 2000 },
  choices: [
    { label: 'Get them a tutor ({amount})', effects: { moneyAmountMult: -1, happiness: 2 } },
    { label: 'Handle it yourself', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'fam_parent_aging_care', category: 'family', weight: 4, conditions: { minAge: 40 },
  text: 'An aging parent needs more care and attention than before.',
  amount: { min: 2000, max: 8000 },
  choices: [
    { label: 'Arrange professional care ({amount})', effects: { moneyAmountMult: -1, happiness: 1 } },
    { label: 'Take on the caregiving yourself', effects: { happiness: -2, health: -2, karma: 3 } },
  ],
});
ev({
  id: 'fam_surprise_pregnancy', category: 'family', weight: 3, conditions: { hasSpouse: true },
  text: 'An unexpected pregnancy has your family talking through what comes next.',
  choices: [
    { label: 'Embrace it', effects: { happiness: 5 } },
    { label: 'It complicates your plans', effects: { happiness: -2 } },
  ],
});
ev({
  id: 'fam_spouse_career_change', category: 'family', weight: 3, conditions: { hasSpouse: true },
  text: 'Your spouse wants to make a major career change that affects the household budget.',
  choices: [
    { label: 'Support them fully', effects: { happiness: 4, money: -3000 } },
    { label: 'Ask them to wait', effects: { happiness: -2 } },
  ],
});
ev({
  id: 'fam_estranged_reconciliation', category: 'family', weight: 3, conditions: { minAge: 35 },
  text: 'An estranged family member reached out wanting to reconcile.',
  choices: [
    { label: 'Open the door', effects: { happiness: 4, karma: 2 } },
    { label: 'Keep your distance', effects: {} },
  ],
});
ev({
  id: 'fam_kids_college_savings', category: 'family', weight: 4, conditions: { hasChildren: true },
  text: 'It\'s time to think seriously about saving for your kids\' education.',
  amount: { min: 2000, max: 10000 },
  choices: [
    { label: 'Start a dedicated fund ({amount})', effects: { moneyAmountMult: -1, happiness: 2 } },
    { label: 'Deal with it later', effects: {} },
  ],
});
ev({
  id: 'fam_pet_adoption', category: 'family', weight: 4,
  text: 'A family member wants to adopt a pet.',
  choices: [
    { label: 'Say yes', effects: { happiness: 3, money: -400 } },
    { label: 'Not right now', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'fam_holiday_hosting', category: 'family', weight: 4,
  text: 'It\'s your turn to host the whole extended family for the holidays.',
  amount: { min: 500, max: 2000 },
  choices: [
    { label: 'Go all out ({amount})', effects: { moneyAmountMult: -1, happiness: 3 } },
    { label: 'Keep it simple', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'fam_grandparent_visit', category: 'family', weight: 4, conditions: { hasChildren: true },
  text: 'The grandparents are visiting for an extended stay.',
  choices: [
    { label: 'Enjoy the extra help and company', effects: { happiness: 3 } },
    { label: 'Find it a bit stressful', effects: { happiness: -1 } },
  ],
});

// --- HEALTH ---
ev({
  id: 'health_allergy_discovery', category: 'health', weight: 3,
  text: 'You discovered a new food allergy the hard way.',
  choices: [
    { label: 'Adjust your diet carefully', effects: { health: 1, happiness: -1 } },
    { label: 'Wing it and hope for the best', effects: { health: -2 } },
  ],
});
ev({
  id: 'health_sleep_study', category: 'health', weight: 3, conditions: { minAge: 25 },
  text: 'Chronic tiredness led you to book a sleep study.',
  amount: { min: 800, max: 2500 },
  choices: [
    { label: 'Get the full workup ({amount})', effects: { moneyAmountMult: -1, health: 4 } },
    { label: 'Just try to sleep more', effects: { health: 1 } },
  ],
});
ev({
  id: 'health_dental_surgery', category: 'health', weight: 3,
  text: 'You need a dental procedure that insurance won\'t fully cover.',
  amount: { min: 1500, max: 6000 },
  choices: [
    { label: 'Get it done ({amount})', effects: { moneyAmountMult: -1, health: 3 } },
    { label: 'Put it off', effects: { health: -3 } },
  ],
});
ev({
  id: 'health_meditation_retreat', category: 'health', weight: 3,
  text: 'A meditation retreat is being offered for {amount}.',
  amount: { min: 400, max: 1500 },
  choices: [
    { label: 'Go and unplug', effects: { moneyAmountMult: -1, happiness: 6, health: 2 } },
    { label: 'Can\'t spare the time', effects: {} },
  ],
});
ev({
  id: 'health_injury_recovery', category: 'health', weight: 4,
  text: 'A minor sports injury is taking longer to heal than expected.',
  amount: { min: 500, max: 1800 },
  choices: [
    { label: 'Get physical therapy ({amount})', effects: { moneyAmountMult: -1, health: 4 } },
    { label: 'Push through it', effects: { health: -3 } },
  ],
});
ev({
  id: 'health_annual_physical', category: 'health', weight: 5,
  text: 'It\'s time for your annual physical checkup.',
  choices: [
    { label: 'Go and get the full picture', effects: { health: 2, money: -200 } },
    { label: 'Skip it again this year', effects: { health: -1 } },
  ],
});
ev({
  id: 'health_diet_overhaul', category: 'health', weight: 4,
  text: 'You committed to a serious diet overhaul.',
  choices: [
    { label: 'Stick with it', effects: { health: 4, happiness: 1, skillXp: [SK.cooking, 8] } },
    { label: 'Give up after a few weeks', effects: { happiness: -1 } },
  ],
});

// --- CHILDHOOD ---
ev({
  id: 'child_playground_dare', category: 'life', weight: 5, conditions: { minAge: 5, maxAge: 11 },
  text: 'A kid at the playground dares you to jump off the tall slide backwards.',
  choices: [
    { label: 'Do it', outcomes: [
      { chance: 0.6, text: 'You stuck the landing. Instant playground legend.', effects: { happiness: 4, popularity: 2 } },
      { chance: 0.4, text: 'You landed wrong and scraped up both knees.', effects: { health: -4, happiness: -2 } },
    ] },
    { label: 'Say no', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'child_report_card', category: 'life', weight: 6, conditions: { minAge: 6, maxAge: 17, studying: true },
  text: 'Report cards came out today.',
  choices: [
    { label: 'You studied hard all term', outcomes: [
      { chance: 0.7, text: 'Straight A\'s! Your parents are thrilled.', effects: { happiness: 5, smarts: 3 } },
      { chance: 0.3, text: 'Decent grades, but not the A\'s you hoped for.', effects: { happiness: 1, smarts: 2 } },
    ] },
    { label: 'You barely tried', effects: { happiness: -2, smarts: -1 } },
  ],
});
ev({
  id: 'child_tooth_fairy', category: 'life', weight: 4, conditions: { minAge: 5, maxAge: 9 },
  text: 'You lost another tooth and put it under your pillow.',
  choices: [
    { label: 'Check under the pillow', effects: { money: 5, happiness: 2 } },
  ],
});
ev({
  id: 'child_show_and_tell', category: 'life', weight: 4, conditions: { minAge: 5, maxAge: 10 },
  text: 'It\'s show-and-tell day at school.',
  choices: [
    { label: 'Bring your favorite toy', effects: { happiness: 3, charisma: 1 } },
    { label: 'Forget it\'s today and go empty-handed', effects: { happiness: -2 } },
  ],
});
ev({
  id: 'child_bully', category: 'life', weight: 4, conditions: { minAge: 6, maxAge: 15 },
  text: 'A bully has been giving you a hard time at school.',
  choices: [
    { label: 'Stand up for yourself', outcomes: [
      { chance: 0.6, text: 'They backed off. You feel proud.', effects: { happiness: 4, charisma: 2 } },
      { chance: 0.4, text: 'It turned into a scuffle and you both got in trouble.', effects: { happiness: -3, health: -2 } },
    ] },
    { label: 'Tell a teacher', effects: { happiness: 1, smarts: 1 } },
    { label: 'Avoid them and say nothing', effects: { happiness: -3 } },
  ],
});
ev({
  id: 'child_talent_show', category: 'life', weight: 4, conditions: { minAge: 7, maxAge: 14 },
  text: 'The school talent show is coming up. Signups are open.',
  choices: [
    { label: 'Perform something', skillCheck: { skillId: SK.publicSpeaking, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'The crowd loved it! You got a standing ovation from the parents.', effects: { happiness: 6, charisma: 3, popularity: 2 } },
      { chance: 0.5, text: 'You froze up on stage. Embarrassing, but everyone forgot by Monday.', effects: { happiness: -3, charisma: -1 } },
    ] },
    { label: 'Watch from the audience', effects: {} },
  ],
});
ev({
  id: 'child_sibling_rivalry', category: 'family', weight: 4, conditions: { minAge: 4, maxAge: 16, hasChildren: false },
  text: 'You and a sibling got into a huge fight over the TV remote.',
  choices: [
    { label: 'Apologize first', effects: { happiness: 1, karma: 1 } },
    { label: 'Hold your ground', effects: { happiness: -1, charisma: 1 } },
  ],
});
ev({
  id: 'child_first_pet_request', category: 'family', weight: 4, once: true, conditions: { minAge: 5, maxAge: 12 },
  text: 'You begged your parents for a pet for weeks.',
  choices: [
    { label: 'Keep begging', outcomes: [
      { chance: 0.55, text: 'They caved! You got a puppy.', effects: { happiness: 8 } },
      { chance: 0.45, text: 'They said maybe when you\'re older.', effects: { happiness: -3 } },
    ] },
    { label: 'Give up asking', effects: {} },
  ],
});
ev({
  id: 'child_science_fair', category: 'career', weight: 4, conditions: { minAge: 8, maxAge: 14, studying: true },
  text: 'The school science fair is here and you need a project.',
  choices: [
    { label: 'Build something ambitious', skillCheck: { skillId: SK.economics, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.5, text: 'You won first place at the science fair!', effects: { happiness: 5, smarts: 4, popularity: 2 } },
      { chance: 0.5, text: 'The volcano fizzled. Literally.', effects: { happiness: -1, smarts: 1 } },
    ] },
    { label: 'Do the minimum effort poster', effects: { smarts: 1 } },
  ],
});
ev({
  id: 'child_summer_camp', category: 'life', weight: 4, conditions: { minAge: 6, maxAge: 15 },
  text: 'Your parents are asking if you want to go to summer camp this year.',
  amount: { min: 200, max: 800 },
  choices: [
    { label: 'Go to camp ({amount})', effects: { moneyAmountMult: -1, happiness: 5, charisma: 2 } },
    { label: 'Stay home instead', effects: {} },
  ],
});
ev({
  id: 'child_video_game_addiction', category: 'life', weight: 4, conditions: { minAge: 8, maxAge: 17 },
  text: 'You\'ve been staying up way too late playing video games.',
  choices: [
    { label: 'Cut back and get more sleep', effects: { health: 3, smarts: 1, happiness: -1 } },
    { label: 'Keep gaming all night', effects: { health: -3, happiness: 3, smarts: -1 } },
  ],
});
ev({
  id: 'child_first_crush', category: 'family', weight: 4, conditions: { minAge: 10, maxAge: 16, hasSpouse: false },
  text: 'You have a huge crush on someone at school.',
  choices: [
    { label: 'Pass them a note', outcomes: [
      { chance: 0.5, text: 'They liked you back! You\'re walking on air.', effects: { happiness: 6, charisma: 2 } },
      { chance: 0.5, text: 'Awkward silence. You want to disappear.', effects: { happiness: -3 } },
    ] },
    { label: 'Keep it to yourself', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'child_grounded', category: 'family', weight: 3, conditions: { minAge: 8, maxAge: 17 },
  text: 'You broke a house rule and got grounded.',
  choices: [
    { label: 'Accept it and behave', effects: { happiness: -2, karma: 1 } },
    { label: 'Sneak out anyway', outcomes: [
      { chance: 0.5, text: 'You got away with it. This time.', effects: { happiness: 3 } },
      { chance: 0.5, text: 'Caught red-handed. Grounded for even longer now.', effects: { happiness: -5 } },
    ] },
  ],
});
ev({
  id: 'child_part_time_job', category: 'career', weight: 4, conditions: { minAge: 14, maxAge: 17, employed: false },
  text: 'You\'re old enough for a part-time after-school job now.',
  choices: [
    { label: 'Get a job at the local shop', effects: { money: 600, happiness: 2, skillXp: [SK.negotiation, 5] } },
    { label: 'Focus on school and hobbies instead', effects: { smarts: 1 } },
  ],
});

// ---------------------------------------------------------------------------
// V51: Dynamic World Engine — personalized callback events. hasGrudgingRival forces
// {company} to the NPC company (any industry, your country) holding the most grudge against
// you (see corpExpansion-adjacent grudge hooks in actions.ts and business.ts's
// tickCorporateSabotage); momentumState gates on state.worldMomentum crossing a real threshold;
// minAchievements references the player's actual accumulated career, not generic flavor text.
// ---------------------------------------------------------------------------
ev({
  id: 'grudge_rival_smear', category: 'business', weight: 5, conditions: { hasGrudgingRival: true },
  text: '{company} clearly hasn\'t forgotten what happened between you — word is they\'re telling anyone who\'ll listen that you can\'t be trusted in a deal.',
  amount: { min: 2_000, max: 8_000 },
  choices: [
    { label: 'Hit back through the press', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'Your version of events won out. {company} looks petty.', effects: { reputation: 4, companyGrudgeDelta: -10 } },
      { chance: 0.5, text: 'It just fanned the flames. Everyone\'s talking about the feud now.', effects: { reputation: -3, notoriety: 3, companyGrudgeDelta: 10 } },
    ] },
    { label: 'Offer an olive branch — buy them a drink and clear the air ({amount})', skillCheck: { skillId: SK.persuasion, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'It actually worked. The grudge seems to be fading.', effects: { moneyAmountMult: -1, companyGrudgeDelta: -35, karma: 3 } },
      { chance: 0.5, text: 'They took the drink and kept the grudge.', effects: { moneyAmountMult: -1, happiness: -2 } },
    ] },
    { label: 'Ignore it — let the work speak for itself', effects: { karma: 2, smarts: 1 } },
  ],
});
ev({
  id: 'grudge_rival_boils_over', category: 'business', weight: 3, conditions: { hasGrudgingRival: true, minReputation: 20 },
  text: 'Sources say {company} has been quietly rallying other players in the industry against you — old grudges have a way of finding company.',
  amount: { min: 5_000, max: 20_000 },
  choices: [
    { label: 'Get ahead of it — call in favors of your own ({amount})', outcomes: [
      { chance: 0.55, text: 'Your network held. The coalition against you fizzled out.', effects: { moneyAmountMult: -1, influence: 4, companyGrudgeDelta: -15 } },
      { chance: 0.45, text: 'It cost you and didn\'t change much.', effects: { moneyAmountMult: -1, happiness: -2 } },
    ] },
    { label: 'Let them come — you\'ll deal with it head-on', effects: { notoriety: 4, karma: -2 } },
  ],
});
ev({
  id: 'momentum_hot_streak', category: 'life', weight: 4, conditions: { momentumState: 'hot' },
  text: 'Everything you\'ve touched lately has turned to gold — {name}, this is about as hot as a streak gets.',
  choices: [
    { label: 'Press the advantage — go bigger', effects: { happiness: 6, notoriety: 2, karma: -1 } },
    { label: 'Stay grounded and bank the gains', effects: { happiness: 3, karma: 2, money: 10_000 } },
  ],
});
ev({
  id: 'momentum_cold_streak', category: 'life', weight: 4, conditions: { momentumState: 'cold' },
  text: 'It feels like the tide has turned against you lately — nothing\'s been landing the way it used to.',
  choices: [
    { label: 'Double down and grind through it', effects: { happiness: -3, smarts: 2, skillXp: [SK.strategy, 8] } },
    { label: 'Take a step back and regroup', effects: { happiness: 4, health: 3 } },
  ],
});
ev({
  id: 'legacy_career_retrospective', category: 'media', weight: 2, once: true, conditions: { minAchievements: 10 },
  text: 'A local magazine wants to run a retrospective on your career — {achievementCount} milestones and counting, by their count.',
  choices: [
    { label: 'Sit for the interview', effects: { reputation: 6, popularity: 3, happiness: 4 } },
    { label: 'Decline — let the record speak for itself', effects: { karma: 2 } },
  ],
});

// ---------------------------------------------------------------------------
// V55: Rival Empires — themed "clash" events, one per settled RivalStrategy (see
// assignRivalStrategy in business.ts). Each requires hasGrudgingRival:true so {company}
// resolves to that same grudging rival, and further gates on the rival having actually
// settled into the matching strategy — a price warrior always undercuts you, never smears you.
// ---------------------------------------------------------------------------
ev({
  id: 'rival_expander_land_grab', category: 'business', weight: 4, conditions: { hasGrudgingRival: true, rivalStrategy: ['aggressive_expander'] },
  text: '{company} is expanding fast and aggressively into every market you touch — it feels less like growth and more like a land grab aimed squarely at you.',
  amount: { min: 3_000, max: 12_000 },
  choices: [
    { label: 'Match their expansion pace ({amount})', outcomes: [
      { chance: 0.55, text: 'You held your ground and then some — they overextended a little.', effects: { moneyAmountMult: -1, companyGrudgeDelta: -10, notoriety: 2 } },
      { chance: 0.45, text: 'It stretched you thin without slowing them down.', effects: { moneyAmountMult: -1, happiness: -3 } },
    ] },
    { label: 'Let them overextend — expansions this fast rarely last', effects: { karma: 2, smarts: 1 } },
  ],
});
ev({
  id: 'rival_price_war_squeeze', category: 'business', weight: 4, conditions: { hasGrudgingRival: true, rivalStrategy: ['price_warrior'] },
  text: '{company} has slashed prices again — a war of attrition they clearly think they can win against you.',
  amount: { min: 2_000, max: 9_000 },
  choices: [
    { label: 'Cut prices right back at them ({amount})', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'You out-lasted them — they blinked first and quietly raised prices back up.', effects: { moneyAmountMult: -1, companyGrudgeDelta: -15, reputation: 2 } },
      { chance: 0.5, text: 'It turned into a real margin bloodbath for both sides.', effects: { moneyAmountMult: -1, happiness: -3 } },
    ] },
    { label: 'Hold your price and lean on brand loyalty instead', effects: { karma: 1, smarts: 1 } },
  ],
});
ev({
  id: 'rival_tech_patent_barrage', category: 'business', weight: 4, conditions: { hasGrudgingRival: true, rivalStrategy: ['tech_innovator'] },
  text: '{company}\'s legal team has been busy — another patent claim just landed, and it has their R&D fingerprints all over it.',
  amount: { min: 4_000, max: 15_000 },
  choices: [
    { label: 'Fight it in court ({amount})', skillCheck: { skillId: SK.law, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'The claim got thrown out. Their legal strategy looks a little desperate now.', effects: { moneyAmountMult: -1, companyGrudgeDelta: -12, reputation: 2 } },
      { chance: 0.5, text: 'You won on a technicality, but it cost more than expected.', effects: { moneyAmountMult: -1, happiness: -2 } },
    ] },
    { label: 'Quietly settle and move on', effects: { moneyAmountMult: -0.6, karma: -1 } },
  ],
});
ev({
  id: 'rival_brand_smear_campaign', category: 'business', weight: 4, conditions: { hasGrudgingRival: true, rivalStrategy: ['brand_builder'] },
  text: '{company} has been running slick ads that draw an unmistakable, unflattering comparison to you.',
  choices: [
    { label: 'Respond with your own campaign', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'Your response landed better than theirs did. Public opinion swung your way.', effects: { reputation: 5, companyGrudgeDelta: -10 } },
      { chance: 0.5, text: 'It just kept the story in the news longer.', effects: { reputation: -2, notoriety: 3 } },
    ] },
    { label: 'Take the high road and say nothing', effects: { karma: 3, happiness: -1 } },
  ],
});
ev({
  id: 'rival_talent_raid_attempt', category: 'business', weight: 4, conditions: { hasGrudgingRival: true, rivalStrategy: ['talent_raider'] },
  text: '{company} has been quietly calling your best people with offers that are hard to refuse.',
  amount: { min: 3_000, max: 10_000 },
  choices: [
    { label: 'Get ahead of it with retention bonuses ({amount})', outcomes: [
      { chance: 0.6, text: 'It worked — your people are staying put, and word got back to {company} that it was a waste of their time.', effects: { moneyAmountMult: -1, companyGrudgeDelta: -10, happiness: 2 } },
      { chance: 0.4, text: 'A couple of people left anyway.', effects: { moneyAmountMult: -1, happiness: -2 } },
    ] },
    { label: 'Trust your culture to hold people better than a bigger paycheck', effects: { karma: 2, smarts: 1 } },
  ],
});

// ---------------------------------------------------------------------------
// V59 BATCH
// ---------------------------------------------------------------------------
ev({
  id: 'v59_life_declutter', category: 'life', weight: 5,
  text: 'A weekend urge to declutter turns into a full closet purge. Some of it might be worth selling.',
  choices: [
    { label: 'Sell it all online', effects: { money: 300, happiness: 2 } },
    { label: 'Donate it', effects: { karma: 3, happiness: 2 } },
    { label: 'Just throw it out', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'v59_life_reunion', category: 'life', weight: 4, conditions: { minAge: 28 },
  text: 'A class reunion invitation lands in your inbox. Attending costs {amount}.',
  amount: { min: 150, max: 600 },
  choices: [
    { label: 'Go and reconnect', effects: { moneyAmountMult: -1, happiness: 4, charisma: 1 } },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'v59_life_home_project', category: 'life', weight: 4, conditions: { hasProperty: true },
  text: 'You finally start that home improvement project you keep putting off. Budget is {amount}.',
  amount: { min: 1000, max: 8000 },
  choices: [
    { label: 'Hire a professional', effects: { moneyAmountMult: -1, happiness: 3 } },
    { label: 'DIY it', skillCheck: { skillId: SK.construction, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'It turned out great, and you saved a bundle.', effects: { moneyAmountMult: -0.3, happiness: 5, skillXp: [SK.construction, 10] } },
      { chance: 0.4, text: 'You had to call a professional anyway to fix your mistakes.', effects: { moneyAmountMult: -1.2, happiness: -2 } },
    ] },
  ],
});
ev({
  id: 'v59_life_language_class', category: 'life', weight: 4,
  text: 'You sign up for a foreign language class, mostly for fun.',
  choices: [
    { label: 'Commit to it', effects: { money: -300, skillXp: [SK.foreignLanguages, 15], happiness: 2 } },
    { label: 'Try a free app instead', effects: { skillXp: [SK.foreignLanguages, 5], happiness: 1 } },
  ],
});
ev({
  id: 'v59_career_side_project', category: 'career', weight: 5, conditions: { employed: true },
  text: 'A side project you started for fun is getting real attention online.',
  choices: [
    { label: 'Turn it into something real', outcomes: [
      { chance: 0.4, text: 'It took off — a nice side income now.', effects: { money: 4000, happiness: 4, reputation: 2 } },
      { chance: 0.6, text: 'It fizzled out after the initial buzz.', effects: { happiness: -1 } },
    ] },
    { label: 'Keep it as a hobby', effects: { happiness: 2 } },
  ],
});
ev({
  id: 'v59_career_mentor_offer', category: 'career', weight: 4, conditions: { employed: true },
  text: 'A junior colleague asks if you would mentor them.',
  choices: [
    { label: 'Take them under your wing', effects: { reputation: 2, happiness: 2, charisma: 1 } },
    { label: "You don't have the time", effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v59_career_conference_speaker', category: 'career', weight: 3, conditions: { employed: true, minReputation: 15 },
  text: "You've been invited to speak at an industry conference.",
  choices: [
    { label: 'Accept and prepare hard', skillCheck: { skillId: SK.publicSpeaking, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'The talk landed well — people are still talking about it.', effects: { reputation: 4, charisma: 1, happiness: 3 } },
      { chance: 0.45, text: 'You froze up halfway through. Rough.', effects: { happiness: -3, reputation: -1 } },
    ] },
    { label: 'Politely decline', effects: {} },
  ],
});
ev({
  id: 'v59_career_office_move', category: 'career', weight: 3, conditions: { employed: true },
  text: 'Your company is relocating offices to a new part of town.',
  choices: [
    { label: 'New commute, new routine', effects: { happiness: -1 } },
    { label: 'Use it as an excuse to ask about remote work', effects: { happiness: 2, jobPerformance: -1 } },
  ],
});
ev({
  id: 'v59_business_supplier_upgrade', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A better supplier offers your company improved terms, but switching costs {amount} upfront.',
  amount: { min: 5000, max: 40000 },
  choices: [
    { label: 'Switch suppliers', effects: { moneyAmountMult: -1, companyQuality: 4, companyCash: -1 } },
    { label: 'Stick with what works', effects: {} },
  ],
});
ev({
  id: 'v59_business_office_party', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'Your team suggests a company party to celebrate a good quarter. Cost: {amount}.',
  amount: { min: 1000, max: 6000 },
  choices: [
    { label: 'Throw a great party', effects: { moneyAmountMult: -1, companyMorale: 8, happiness: 2 } },
    { label: 'Keep it low-key', effects: { companyMorale: 2 } },
  ],
});
ev({
  id: 'v59_business_trade_show', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A major trade show invites your company to exhibit. Booth costs {amount}.',
  amount: { min: 8000, max: 50000 },
  choices: [
    { label: 'Exhibit', outcomes: [
      { chance: 0.5, text: 'Great leads came out of it.', effects: { moneyAmountMult: -1, companyBrand: 5, reputation: 2 } },
      { chance: 0.5, text: 'It was a quiet show — mostly networking.', effects: { moneyAmountMult: -1, companyBrand: 1 } },
    ] },
    { label: 'Skip it this year', effects: {} },
  ],
});
ev({
  id: 'v59_business_intern_program', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'A local university asks if your company will host summer interns.',
  choices: [
    { label: 'Host them', effects: { companyMorale: 2, reputation: 1, karma: 2 } },
    { label: 'Not this year', effects: {} },
  ],
});
ev({
  id: 'v59_market_ipo_rumor', category: 'market', weight: 4, conditions: { hasStocks: true },
  text: "There's a rumor one of your holdings is preparing an acquisition offer.",
  choices: [
    { label: 'Hold and see what happens', outcomes: [
      { chance: 0.4, text: 'The rumor was true — the stock jumped.', effects: { money: 3000, happiness: 2 } },
      { chance: 0.6, text: 'Nothing came of it.', effects: {} },
    ] },
    { label: 'Sell now to lock in gains', effects: { money: 1200 } },
  ],
});
ev({
  id: 'v59_market_analyst_downgrade', category: 'market', weight: 4, conditions: { hasStocks: true },
  text: 'An analyst downgrades a stock you own, citing weak guidance.',
  choices: [
    { label: 'Sell before it drops further', effects: { money: -400 } },
    { label: 'Ignore the noise', outcomes: [
      { chance: 0.5, text: 'The stock recovered within weeks.', effects: { money: 800 } },
      { chance: 0.5, text: 'It kept sliding.', effects: { money: -1800 } },
    ] },
  ],
});
ev({
  id: 'v59_market_gold_rally', category: 'market', weight: 3,
  text: 'Gold prices are rallying on safe-haven demand. A stake would cost {amount}.',
  amount: { min: 2000, max: 20000 },
  choices: [
    { label: 'Buy some gold', effects: { moneyAmountMult: -1, skillXp: [SK.investing, 5] } },
    { label: 'Not interested', effects: {} },
  ],
});
ev({
  id: 'v59_market_broker_pitch', category: 'market', weight: 3,
  text: 'A broker cold-calls you with a "can\'t miss" investment opportunity worth {amount}.',
  amount: { min: 1000, max: 10000 },
  choices: [
    { label: 'Hear them out and invest', outcomes: [
      { chance: 0.3, text: 'It actually paid off.', effects: { moneyAmountMult: 1.4 } },
      { chance: 0.7, text: 'It was exactly the scam it sounded like.', effects: { moneyAmountMult: -1, happiness: -3 } },
    ] },
    { label: 'Hang up', effects: {} },
  ],
});
ev({
  id: 'v59_politics_town_hall', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'Constituents pack a town hall meeting with pointed questions about your record.',
  choices: [
    { label: 'Face it head-on', skillCheck: { skillId: SK.debate, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You handled the tough questions well.', effects: { popularity: 4, reputation: 2 } },
      { chance: 0.45, text: 'You stumbled on a key question.', effects: { popularity: -3 } },
    ] },
    { label: 'Send a deputy instead', effects: { popularity: -2 } },
  ],
});
ev({
  id: 'v59_politics_endorsement_offer', category: 'politics', weight: 4, conditions: { campaigning: true },
  text: 'A well-known local figure offers to publicly endorse your campaign.',
  choices: [
    { label: 'Accept the endorsement', effects: { popularity: 4, influence: 1 } },
    { label: 'Politely decline — too controversial', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'v59_politics_committee_seat', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'A seat opens up on an influential legislative committee.',
  choices: [
    { label: 'Campaign for the seat', outcomes: [
      { chance: 0.5, text: 'You got the seat — real influence now.', effects: { influence: 3, reputation: 2 } },
      { chance: 0.5, text: 'It went to a rival.', effects: { happiness: -2 } },
    ] },
    { label: "Don't bother", effects: {} },
  ],
});
ev({
  id: 'v59_politics_leaked_memo', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'An internal memo from your office leaks to the press, causing a minor stir.',
  choices: [
    { label: 'Get ahead of the story', skillCheck: { skillId: SK.spin, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.6, text: 'You managed the story well. It blew over.', effects: { reputation: 1 } },
      { chance: 0.4, text: 'It became a bigger deal than it should have.', effects: { popularity: -4, reputation: -2 } },
    ] },
    { label: 'Say nothing and hope it fades', effects: { popularity: -2 } },
  ],
});
ev({
  id: 'v59_crime_pawn_shop_deal', category: 'crime', weight: 3,
  text: 'A shady contact offers you a "too good to be true" deal on some electronics for {amount}.',
  amount: { min: 200, max: 2000 },
  choices: [
    { label: 'Take the deal', outcomes: [
      { chance: 0.6, text: 'Legit goods, great price.', effects: { moneyAmountMult: -0.5 } },
      { chance: 0.4, text: 'It was stolen property — you got a warning from police.', effects: { moneyAmountMult: -1, notoriety: 3, happiness: -3 } },
    ] },
    { label: 'Walk away', effects: {} },
  ],
});
ev({
  id: 'v59_crime_witness_intimidation', category: 'crime', weight: 3, conditions: { inCrimeFamily: true },
  text: 'A witness in a case connected to your operation is getting cold feet about testifying.',
  choices: [
    { label: 'Send someone to "encourage" silence', outcomes: [
      { chance: 0.5, text: 'The witness backed out. The case fell apart.', effects: { notoriety: 4, karma: -4 } },
      { chance: 0.5, text: 'It backfired — now there\'s a tampering investigation.', effects: { notoriety: 8, happiness: -5 } },
    ] },
    { label: 'Let it play out', effects: {} },
  ],
});
ev({
  id: 'v59_crime_stakeout_close_call', category: 'crime', weight: 3, conditions: { inCrimeFamily: true },
  text: 'You notice an unmarked car parked outside your usual meeting spot for days.',
  choices: [
    { label: 'Lay low for a while', effects: { happiness: -1, notoriety: -2 } },
    { label: 'Ignore it and carry on', outcomes: [
      { chance: 0.6, text: 'It was nothing.', effects: {} },
      { chance: 0.4, text: 'It really was surveillance. Heat is rising.', effects: { notoriety: 6, happiness: -3 } },
    ] },
  ],
});
ev({
  id: 'v59_world_currency_devaluation', category: 'world', weight: 3,
  text: '{country} devalues its currency sharply overnight, rattling regional markets.',
  choices: [
    { label: 'Watch your exposure closely', effects: { happiness: -1 } },
    { label: 'Not your problem', effects: {} },
  ],
});
ev({
  id: 'v59_world_tech_conference', category: 'world', weight: 3,
  text: 'A landmark global tech conference showcases breakthroughs that shift industry sentiment.',
  choices: [
    { label: 'Follow the coverage closely', effects: { skillXp: [SK.economics, 3], happiness: 1 } },
    { label: "Doesn't concern you", effects: {} },
  ],
});
ev({
  id: 'v59_world_heat_wave', category: 'world', weight: 4,
  text: 'A record-breaking heat wave grips the region for weeks. Running the AC nonstop costs {amount}.',
  amount: { min: 100, max: 500 },
  choices: [
    { label: 'Crank the AC', effects: { moneyAmountMult: -1, health: 1 } },
    { label: 'Tough it out', effects: { health: -2, happiness: -1 } },
  ],
});
ev({
  id: 'v59_world_trade_delegation', category: 'world', weight: 3,
  text: 'A foreign trade delegation visits {city}, looking to strike new deals.',
  choices: [
    { label: 'Attend the reception', effects: { charisma: 1, happiness: 1 } },
    { label: 'Skip it', effects: {} },
  ],
});
ev({
  id: 'v59_media_podcast_invite', category: 'media', weight: 4, conditions: { minReputation: 10 },
  text: "A popular podcast wants you as a guest to talk about your career.",
  choices: [
    { label: 'Go on the show', skillCheck: { skillId: SK.publicSpeaking, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.6, text: 'You came across great — new fans and opportunities.', effects: { reputation: 3, charisma: 1, happiness: 2 } },
      { chance: 0.4, text: 'A clip of an awkward moment went around online.', effects: { reputation: -2, happiness: -2 } },
    ] },
    { label: 'Decline politely', effects: {} },
  ],
});
ev({
  id: 'v59_media_profile_piece', category: 'media', weight: 3, conditions: { minReputation: 20 },
  text: 'A magazine wants to run a profile piece on you.',
  choices: [
    { label: 'Sit for the interview', outcomes: [
      { chance: 0.6, text: 'A flattering, well-written piece.', effects: { reputation: 3, popularity: 2 } },
      { chance: 0.4, text: 'The angle was more critical than you expected.', effects: { reputation: -2 } },
    ] },
    { label: 'Decline', effects: {} },
  ],
});
ev({
  id: 'v59_media_meme_moment', category: 'media', weight: 4,
  text: 'A photo of you from an ordinary day somehow becomes a viral meme.',
  choices: [
    { label: 'Lean into the joke', effects: { happiness: 2, popularity: 2, charisma: 1 } },
    { label: 'Try to ignore it', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v59_media_documentary_request', category: 'media', weight: 2, conditions: { minReputation: 30 },
  text: 'A documentary filmmaker wants to feature your story.',
  choices: [
    { label: 'Participate', outcomes: [
      { chance: 0.55, text: 'It aired to great acclaim.', effects: { reputation: 5, popularity: 3, money: 5000 } },
      { chance: 0.45, text: 'The final cut was not flattering.', effects: { reputation: -3, happiness: -3 } },
    ] },
    { label: 'Pass', effects: {} },
  ],
});
ev({
  id: 'v59_family_sibling_visit', category: 'family', weight: 5,
  text: 'A sibling calls to say they are coming to visit for a week.',
  choices: [
    { label: 'Host them', effects: { happiness: 3, money: -300 } },
    { label: "Say you're too busy right now", effects: { happiness: -2, karma: -1 } },
  ],
});
ev({
  id: 'v59_family_parent_advice', category: 'family', weight: 4,
  text: 'A parent offers unsolicited advice about a big decision you are making.',
  choices: [
    { label: 'Take it graciously', effects: { happiness: 1, smarts: 1 } },
    { label: 'Push back', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v59_family_child_hobby', category: 'family', weight: 4, conditions: { hasChildren: true },
  text: 'Your child wants to pursue an expensive extracurricular hobby.',
  amount: { min: 500, max: 3000 },
  choices: [
    { label: 'Support it ({amount})', effects: { moneyAmountMult: -1, happiness: 3 } },
    { label: 'Suggest something cheaper', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'v59_family_spouse_career_change', category: 'family', weight: 3, conditions: { hasSpouse: true },
  text: 'Your spouse is considering a big career change and wants your support.',
  choices: [
    { label: 'Fully back them', effects: { happiness: 4 } },
    { label: 'Urge caution', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v59_health_checkup_reminder', category: 'health', weight: 5,
  text: "It's been a while since your last checkup. A reminder card arrives in the mail.",
  choices: [
    { label: 'Book the appointment', effects: { health: 2, money: -150 } },
    { label: 'Put it off again', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v59_health_sleep_tracker', category: 'health', weight: 4,
  text: 'You start using a sleep tracker and discover your habits need work.',
  choices: [
    { label: 'Actually fix your sleep schedule', effects: { health: 3, happiness: 1 } },
    { label: 'Ignore the data', effects: { health: -1 } },
  ],
});
ev({
  id: 'v59_health_diet_challenge', category: 'health', weight: 4,
  text: 'A friend challenges you to a 30-day healthy eating challenge.',
  choices: [
    { label: 'Accept the challenge', skillCheck: { skillId: SK.fitness, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.6, text: 'You stuck with it and feel great.', effects: { health: 5, happiness: 3 } },
      { chance: 0.4, text: 'You gave up halfway through.', effects: { happiness: -1 } },
    ] },
    { label: "Not for you", effects: {} },
  ],
});
ev({
  id: 'v59_health_dental_surprise', category: 'health', weight: 4,
  text: 'A routine dental visit turns up a problem that needs immediate work.',
  amount: { min: 800, max: 5000 },
  choices: [
    { label: 'Get it fixed', effects: { moneyAmountMult: -1, health: 3 } },
    { label: 'Put it off', effects: { health: -3, happiness: -1 } },
  ],
});

// ---------------------------------------------------------------------------
// V8.3 — 50 new yearly event templates (several award the 20 new achievements)
// ---------------------------------------------------------------------------
ev({
  id: 'v83_life_travel_bug', category: 'life', weight: 5, conditions: { minAge: 18, minMoney: 3000 },
  text: 'You have the urge to see more of the world. A month-long trip across three continents would cost {amount}.',
  amount: { min: 4000, max: 18000 },
  choices: [
    { label: 'Book the trip of a lifetime', effects: { moneyAmountMult: -1, happiness: 10, health: 2, skillXp: [SK.foreignLanguages, 6], achievement: 'world_traveler' } },
    { label: 'A modest weekend away instead', effects: { money: -600, happiness: 3 } },
    { label: 'Stay home and save', effects: {} },
  ],
});
ev({
  id: 'v83_life_lucky_week', category: 'life', weight: 3,
  text: 'Everything is going your way lately — green lights, found money, good news.',
  choices: [
    { label: 'Ride the wave', outcomes: [
      { chance: 0.6, text: 'The streak held all year. Uncanny.', effects: { happiness: 6, money: 2000, achievement: 'lucky_streak' } },
      { chance: 0.4, text: 'It was nice while it lasted.', effects: { happiness: 3 } },
    ] },
    { label: 'Stay grounded', effects: { happiness: 2 } },
  ],
});
ev({
  id: 'v83_life_anon_gift', category: 'life', weight: 3, conditions: { minMoney: 50000 },
  text: 'You could quietly cover a struggling family’s rent for a year — no credit, no announcement.',
  amount: { min: 5000, max: 20000 },
  choices: [
    { label: 'Do it anonymously', effects: { moneyAmountMult: -1, karma: 8, happiness: 6, achievement: 'quiet_philanthropist' } },
    { label: 'Give a little publicly', effects: { money: -2000, karma: 3, reputation: 2 } },
    { label: 'Not this time', effects: {} },
  ],
});
ev({
  id: 'v83_life_neighborhood_flood', category: 'life', weight: 3,
  text: 'A storm floods your neighborhood. People are scrambling to save what they can.',
  choices: [
    { label: 'Lead the sandbag brigade', effects: { karma: 6, happiness: 4, reputation: 2, health: -2, achievement: 'community_hero' } },
    { label: 'Protect your own home', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v83_life_art_auction', category: 'life', weight: 3, conditions: { minMoney: 100000 },
  text: 'A rising artist’s first collection is up for auction. Backing them now means something.',
  amount: { min: 20000, max: 120000 },
  choices: [
    { label: 'Buy the centerpiece', effects: { moneyAmountMult: -1, happiness: 5, skillXp: [SK.artCollecting, 10], achievement: 'art_patron' } },
    { label: 'Buy a small piece', effects: { money: -6000, happiness: 2, skillXp: [SK.artCollecting, 3] } },
    { label: 'Admire and leave', effects: {} },
  ],
});
ev({
  id: 'v83_life_reunion', category: 'life', weight: 4, conditions: { minAge: 30 },
  text: 'Your school reunion is coming up. You haven’t seen most of these people in years.',
  choices: [
    { label: 'Go and reconnect', effects: { happiness: 4, skillXp: [SK.charm, 3] } },
    { label: 'Skip it', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v83_life_declutter_sale', category: 'life', weight: 4,
  text: 'You finally clear out years of accumulated stuff and hold a big sale.',
  choices: [
    { label: 'Sell everything', effects: { money: 1500, happiness: 3 } },
    { label: 'Donate it all', effects: { karma: 4, happiness: 2 } },
  ],
});
ev({
  id: 'v83_life_new_hobby', category: 'life', weight: 4,
  text: 'A friend drags you to a pottery class. You’re surprisingly into it.',
  choices: [
    { label: 'Commit to the craft', effects: { happiness: 4, money: -400 } },
    { label: 'One and done', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'v83_health_marathon_push', category: 'health', weight: 4, conditions: { minAge: 18, maxAge: 65 },
  text: 'You’ve been training for months. The city marathon is this weekend.',
  choices: [
    { label: 'Run the full 42km', skillCheck: { skillId: SK.fitness, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You crossed the finish line, exhausted and elated.', effects: { health: 8, happiness: 10, skillXp: [SK.fitness, 12], achievement: 'marathoner' } },
      { chance: 0.45, text: 'You had to stop at 30km, but you’ll be back.', effects: { health: 3, happiness: 2, skillXp: [SK.fitness, 6] } },
    ] },
    { label: 'Drop to the half', effects: { health: 4, happiness: 3, skillXp: [SK.fitness, 5] } },
  ],
});
ev({
  id: 'v83_health_wildfire', category: 'health', weight: 3, conditions: { minAge: 16 },
  text: 'A wildfire forces an evacuation of your area. The air is thick with smoke.',
  choices: [
    { label: 'Evacuate early and calmly', outcomes: [
      { chance: 0.8, text: 'You got out safely and helped others do the same.', effects: { happiness: 2, karma: 3, achievement: 'disaster_survivor' } },
      { chance: 0.2, text: 'A stressful escape, but you made it.', effects: { health: -4, happiness: -2, achievement: 'disaster_survivor' } },
    ] },
    { label: 'Stay and defend your home', outcomes: [
      { chance: 0.5, text: 'You saved the house.', effects: { happiness: 3, reputation: 1 } },
      { chance: 0.5, text: 'Smoke inhalation put you in hospital.', effects: { health: -14, money: -6000 } },
    ] },
  ],
});
ev({
  id: 'v83_health_wellness_retreat', category: 'health', weight: 3, conditions: { minMoney: 4000 },
  text: 'A silent wellness retreat in the mountains promises a full reset.',
  amount: { min: 2000, max: 9000 },
  choices: [
    { label: 'Go off-grid for a week', effects: { moneyAmountMult: -1, health: 6, happiness: 8 } },
    { label: 'A day spa instead', effects: { money: -300, health: 2, happiness: 3 } },
  ],
});
ev({
  id: 'v83_career_report_fraud', category: 'career', weight: 4, conditions: { employed: true },
  text: 'You’ve found clear evidence your employer is cooking the books.',
  choices: [
    { label: 'Report it to regulators', outcomes: [
      { chance: 0.6, text: 'The truth came out and you were protected — and vindicated.', effects: { karma: 8, reputation: 4, money: 5000, achievement: 'whistle_blower' } },
      { chance: 0.4, text: 'It got messy. You lost the job but kept your integrity.', effects: { loseJob: true, karma: 6, happiness: -4, achievement: 'whistle_blower' } },
    ] },
    { label: 'Stay quiet', effects: { happiness: -3, karma: -3 } },
  ],
});
ev({
  id: 'v83_career_big_negotiation', category: 'career', weight: 4, conditions: { employed: true },
  text: 'A major client contract is on the table and you’re leading the negotiation.',
  choices: [
    { label: 'Push hard for the best terms', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'You closed a landmark deal on your terms.', effects: { jobPerformance: 10, money: 8000, skillXp: [SK.negotiation, 10], achievement: 'master_negotiator' } },
      { chance: 0.5, text: 'You met in the middle. Still a solid win.', effects: { jobPerformance: 4, money: 2000, skillXp: [SK.negotiation, 5] } },
    ] },
    { label: 'Accept their first offer', effects: { jobPerformance: 1 } },
  ],
});
ev({
  id: 'v83_career_comeback', category: 'career', weight: 3, conditions: { minAge: 25 },
  text: 'After a rough stretch — a layoff, a failed venture — you get one more shot at a great role.',
  choices: [
    { label: 'Give it everything', skillCheck: { skillId: SK.leadership, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You landed the job and silenced the doubters.', effects: { happiness: 8, reputation: 3, money: 4000, achievement: 'comeback_kid' } },
      { chance: 0.45, text: 'Not this one — but you’re back in the game.', effects: { happiness: 2, skillXp: [SK.leadership, 5] } },
    ] },
    { label: 'Play it safe with a lesser role', effects: { happiness: 1, money: 1000 } },
  ],
});
ev({
  id: 'v83_career_mentorship', category: 'career', weight: 4, conditions: { employed: true, minAge: 30 },
  text: 'A group of juniors have started coming to you for advice. You could make it official.',
  choices: [
    { label: 'Become a dedicated mentor', effects: { karma: 5, reputation: 3, happiness: 4, skillXp: [SK.teaching, 8], achievement: 'mentor_of_many' } },
    { label: 'Help out casually', effects: { happiness: 2, karma: 1 } },
  ],
});
ev({
  id: 'v83_career_relocation_offer', category: 'career', weight: 3, conditions: { employed: true },
  text: 'Your company offers you a big role — in another country.',
  choices: [
    { label: 'Take the leap abroad', effects: { money: 6000, happiness: 3, jobPerformance: 5, skillXp: [SK.foreignLanguages, 6] } },
    { label: 'Stay put', effects: { jobPerformance: -1 } },
  ],
});
ev({
  id: 'v83_business_angel_invest', category: 'business', weight: 4, conditions: { hasBusiness: true, minMoney: 50000 },
  text: 'A scrappy founder pitches you their startup. It’s early, risky, and genuinely exciting.',
  amount: { min: 20000, max: 150000 },
  choices: [
    { label: 'Write the check', outcomes: [
      { chance: 0.35, text: 'They took off — your early bet paid off enormously.', effects: { moneyAmountMult: 6, reputation: 4, achievement: 'angel_backer' } },
      { chance: 0.4, text: 'Modest return, good relationship built.', effects: { moneyAmountMult: 1, achievement: 'angel_backer' } },
      { chance: 0.25, text: 'It folded. That’s early-stage investing.', effects: { moneyAmountMult: -1, achievement: 'angel_backer' } },
    ] },
    { label: 'Pass', effects: {} },
  ],
});
ev({
  id: 'v83_business_turnaround', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'One of your companies is bleeding cash. A hard restructuring could save it — or finish it.',
  choices: [
    { label: 'Lead the turnaround', skillCheck: { skillId: SK.strategy, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'You cut deep, refocused, and pulled it back from the brink.', effects: { companyCash: 500000, companyMorale: -6, reputation: 4, achievement: 'turnaround_artist' } },
      { chance: 0.5, text: 'The cuts hurt morale and it kept sinking.', effects: { companyCash: -200000, companyMorale: -12 } },
    ] },
    { label: 'Wind it down', effects: { happiness: -4 } },
  ],
});
ev({
  id: 'v83_business_go_green', category: 'business', weight: 4, conditions: { hasBusiness: true, minMoney: 30000 },
  text: 'You could convert your operations to run fully on renewables. Costly now, but a real statement.',
  amount: { min: 30000, max: 200000 },
  choices: [
    { label: 'Invest in the transition', effects: { moneyAmountMult: -1, companyBrand: 12, reputation: 5, karma: 4, achievement: 'green_pioneer' } },
    { label: 'Do the bare minimum', effects: { companyBrand: 2 } },
  ],
});
ev({
  id: 'v83_business_pr_crisis', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A product defect is trending online and reporters are calling your office.',
  choices: [
    { label: 'Front it head-on with a recall', skillCheck: { skillId: SK.pr, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'Your honesty turned the story around. Trust actually rose.', effects: { companyBrand: 6, reputation: 4, money: -30000, achievement: 'crisis_manager' } },
      { chance: 0.4, text: 'It was rocky, but you contained the damage.', effects: { companyBrand: -4, money: -50000, achievement: 'crisis_manager' } },
    ] },
    { label: 'Deny everything', outcomes: [
      { chance: 0.5, text: 'It blew over.', effects: { companyBrand: -2 } },
      { chance: 0.5, text: 'The cover-up became the story.', effects: { companyBrand: -15, reputation: -6, notoriety: 4 } },
    ] },
  ],
});
ev({
  id: 'v83_business_night_launch', category: 'business', weight: 3, conditions: { minAge: 18, maxAge: 45 },
  text: 'You’ve been building a side project at night for a year. It’s ready to launch.',
  choices: [
    { label: 'Ship it and grind', outcomes: [
      { chance: 0.5, text: 'The all-nighters paid off — it found real traction.', effects: { money: 12000, happiness: 6, skillXp: [SK.programming, 8], achievement: 'night_owl_founder' } },
      { chance: 0.5, text: 'Quiet launch, but you learned a ton.', effects: { happiness: 2, skillXp: [SK.programming, 6], achievement: 'night_owl_founder' } },
    ] },
    { label: 'Shelve it', effects: { happiness: -2 } },
  ],
});
ev({
  id: 'v83_business_supplier_squeeze', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'Your main supplier abruptly demands a 20% price increase.',
  choices: [
    { label: 'Negotiate hard', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You held the line and even locked in a longer contract.', effects: { companyCash: 80000, skillXp: [SK.negotiation, 6] } },
      { chance: 0.45, text: 'You split the difference.', effects: { companyCash: -40000 } },
    ] },
    { label: 'Find a new supplier', effects: { companyCash: -20000, companyQuality: -3 } },
  ],
});
ev({
  id: 'v83_market_buy_the_dip', category: 'market', weight: 4, conditions: { hasStocks: true },
  text: 'The market just cratered on panic selling. Your gut says it’s oversold.',
  amount: { min: 5000, max: 60000, pctOfMoney: 0.2 },
  choices: [
    { label: 'Back up the truck', outcomes: [
      { chance: 0.55, text: 'The rebound was sharp — perfectly timed.', effects: { moneyAmountMult: 2, skillXp: [SK.investing, 8], achievement: 'market_timer' } },
      { chance: 0.45, text: 'It fell further before recovering. Nerve-wracking.', effects: { moneyAmountMult: -1, skillXp: [SK.investing, 4] } },
    ] },
    { label: 'Sit on your hands', effects: {} },
  ],
});
ev({
  id: 'v83_market_ipo_hype', category: 'market', weight: 3, conditions: { hasStocks: true },
  text: 'A wildly hyped tech company is going public tomorrow. Everyone’s piling in.',
  amount: { min: 3000, max: 40000 },
  choices: [
    { label: 'Buy on day one', outcomes: [
      { chance: 0.4, text: 'It popped and you sold into strength.', effects: { moneyAmountMult: 1.5 } },
      { chance: 0.6, text: 'It sank after the hype faded.', effects: { moneyAmountMult: -0.6 } },
    ] },
    { label: 'Wait for the dust to settle', effects: { skillXp: [SK.investing, 2] } },
  ],
});
ev({
  id: 'v83_market_bond_ladder', category: 'market', weight: 3, conditions: { minMoney: 20000 },
  text: 'A financial advisor suggests building a bond ladder for steady, boring income.',
  choices: [
    { label: 'Set it up', effects: { money: -10000, skillXp: [SK.investing, 4], happiness: 1 } },
    { label: 'Prefer to stay in stocks', effects: {} },
  ],
});
ev({
  id: 'v83_media_viral_clip', category: 'media', weight: 4, conditions: { minAge: 14 },
  text: 'A casual video you posted is exploding — millions of views overnight.',
  choices: [
    { label: 'Lean into the moment', outcomes: [
      { chance: 0.5, text: 'You parlayed it into a real following and some brand deals.', effects: { money: 15000, socialFollowersPct: 2.5, reputation: 2, achievement: 'viral_sensation' } },
      { chance: 0.5, text: 'Fifteen minutes of fame, and then quiet.', effects: { socialFollowersPct: 0.8, happiness: 3, achievement: 'viral_sensation' } },
    ] },
    { label: 'Delete it, too much attention', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v83_media_trendsetter', category: 'media', weight: 3, conditions: { minFollowers: 5000 },
  text: 'Something you championed early has become a full-blown cultural trend.',
  choices: [
    { label: 'Claim your role as a tastemaker', effects: { reputation: 4, socialFollowersPct: 0.6, happiness: 4, achievement: 'tastemaker' } },
    { label: 'Stay humble about it', effects: { happiness: 2, karma: 1 } },
  ],
});
ev({
  id: 'v83_media_documentary', category: 'media', weight: 3, conditions: { minReputation: 40 },
  text: 'A filmmaker wants to make a documentary about your life and work.',
  choices: [
    { label: 'Give full access', outcomes: [
      { chance: 0.6, text: 'It was flattering and widely watched.', effects: { reputation: 5, popularity: 3 } },
      { chance: 0.4, text: 'They found an unflattering angle.', effects: { reputation: -3, notoriety: 2 } },
    ] },
    { label: 'Decline politely', effects: {} },
  ],
});
ev({
  id: 'v83_family_teach_kid', category: 'family', weight: 4, conditions: { hasChildren: true },
  text: 'Your child wants to learn something you’re good at.',
  choices: [
    { label: 'Spend the year teaching them', effects: { happiness: 6, karma: 3, skillXp: [SK.teaching, 5] } },
    { label: 'Sign them up for lessons instead', effects: { money: -1500, happiness: 2 } },
  ],
});
ev({
  id: 'v83_family_block_party', category: 'family', weight: 3,
  text: 'The neighborhood wants someone to organize the annual block party.',
  choices: [
    { label: 'Take charge and make it great', effects: { karma: 4, reputation: 2, happiness: 4, money: -300, achievement: 'people_person' } },
    { label: 'Just bring a dish', effects: { happiness: 2 } },
  ],
});
ev({
  id: 'v83_family_elderly_parent', category: 'family', weight: 3, conditions: { minAge: 35 },
  text: 'An aging parent needs more help than they’ll admit.',
  choices: [
    { label: 'Move them closer and care for them', effects: { money: -8000, happiness: 3, karma: 5, health: -1 } },
    { label: 'Arrange professional care', effects: { money: -15000, happiness: 1, karma: 2 } },
  ],
});
ev({
  id: 'v83_family_heirloom', category: 'family', weight: 3, conditions: { minAge: 30 },
  text: 'You inherit a box of family heirlooms and old letters.',
  choices: [
    { label: 'Preserve and archive them', effects: { happiness: 4, karma: 1 } },
    { label: 'Sell the valuable pieces', effects: { money: 4000, happiness: -1 } },
  ],
});
ev({
  id: 'v83_politics_town_hall', category: 'politics', weight: 4, conditions: { inOffice: 'any' },
  text: 'An angry town hall awaits you over a controversial local issue.',
  choices: [
    { label: 'Face the crowd honestly', skillCheck: { skillId: SK.publicSpeaking, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'You won them over with candor.', effects: { popularity: 5, approvalOfGovernment: 3 } },
      { chance: 0.45, text: 'It got heated and clips went viral.', effects: { popularity: -3, notoriety: 2 } },
    ] },
    { label: 'Send a deputy', effects: { popularity: -2 } },
  ],
});
ev({
  id: 'v83_politics_grassroots', category: 'politics', weight: 3, conditions: { inParty: true },
  text: 'A grassroots movement wants your backing on a bold reform.',
  choices: [
    { label: 'Champion their cause', effects: { influence: 4, popularity: 3, politicalCapital: -3 } },
    { label: 'Offer quiet support', effects: { influence: 1 } },
  ],
});
ev({
  id: 'v83_politics_ethics_test', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'A donor offers a large, perfectly legal contribution — with unspoken expectations.',
  choices: [
    { label: 'Refuse it publicly', effects: { reputation: 4, popularity: 2, karma: 3, politicalCapital: -2 } },
    { label: 'Take it quietly', effects: { money: 20000, notoriety: 2, karma: -3 } },
  ],
});
ev({
  id: 'v83_world_pandemic_scare', category: 'world', weight: 3,
  text: 'A new virus is spreading abroad and your country is bracing for it.',
  choices: [
    { label: 'Prepare early and stock up', effects: { money: -500, health: 1, happiness: -1 } },
    { label: 'Carry on as normal', outcomes: [
      { chance: 0.6, text: 'It stayed contained.', effects: {} },
      { chance: 0.4, text: 'You caught it and were laid up for weeks.', effects: { health: -8, happiness: -3 } },
    ] },
  ],
});
ev({
  id: 'v83_world_boom_town', category: 'world', weight: 3, conditions: { hasProperty: true },
  text: 'Your area is suddenly booming — a big employer is moving in and property is soaring.',
  choices: [
    { label: 'Sell into the boom', effects: { propertyValuePct: 0.15, money: 20000, happiness: 2 } },
    { label: 'Hold and ride it', effects: { propertyValuePct: 0.25 } },
  ],
});
ev({
  id: 'v83_world_charity_gala', category: 'world', weight: 3, conditions: { minMoney: 30000 },
  text: 'A high-profile charity gala is raising money for disaster relief.',
  choices: [
    { label: 'Pledge generously', effects: { money: -15000, karma: 6, reputation: 3, popularity: 2 } },
    { label: 'A modest donation', effects: { money: -2000, karma: 2 } },
  ],
});
ev({
  id: 'v83_crime_witness', category: 'crime', weight: 3,
  text: 'You witness a mugging in progress on a quiet street.',
  choices: [
    { label: 'Intervene', outcomes: [
      { chance: 0.55, text: 'You scared them off and helped the victim.', effects: { karma: 6, reputation: 2, happiness: 2 } },
      { chance: 0.45, text: 'You got hurt in the scuffle.', effects: { health: -10, karma: 5 } },
    ] },
    { label: 'Call the police and observe', effects: { karma: 2 } },
  ],
});
ev({
  id: 'v83_crime_scam_target', category: 'crime', weight: 4,
  text: 'A convincing scam email is trying to drain your accounts.',
  choices: [
    { label: 'Spot it and report it', effects: { skillXp: [SK.cybersecurity, 4], karma: 1 } },
    { label: 'Almost fall for it', outcomes: [
      { chance: 0.5, text: 'Your bank caught it just in time.', effects: { happiness: -1 } },
      { chance: 0.5, text: 'They got you for a chunk.', effects: { money: -4000, happiness: -4 } },
    ] },
  ],
});
ev({
  id: 'v83_life_language_challenge', category: 'life', weight: 3, conditions: { minAge: 16 },
  text: 'You set yourself a goal: become conversational in a new language this year.',
  choices: [
    { label: 'Study daily', skillCheck: { skillId: SK.foreignLanguages, bonusPerLevel: 0.004 }, outcomes: [
      { chance: 0.6, text: 'You did it — you can hold a real conversation now.', effects: { skillXp: [SK.foreignLanguages, 15], happiness: 5, smarts: 3 } },
      { chance: 0.4, text: 'You made solid progress.', effects: { skillXp: [SK.foreignLanguages, 8], happiness: 2 } },
    ] },
    { label: 'Give up after a month', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v83_life_side_charity', category: 'life', weight: 3,
  text: 'You start volunteering weekly at a food bank.',
  choices: [
    { label: 'Make it a real commitment', effects: { karma: 6, happiness: 4, health: -1 } },
    { label: 'Help during the holidays only', effects: { karma: 2, happiness: 2 } },
  ],
});
ev({
  id: 'v83_health_quit_habit', category: 'health', weight: 3, conditions: { minAge: 20 },
  text: 'You decide this is the year you finally drop a bad habit for good.',
  choices: [
    { label: 'Go all in', outcomes: [
      { chance: 0.55, text: 'You kicked it. You feel like a new person.', effects: { health: 8, happiness: 5 } },
      { chance: 0.45, text: 'You slipped, but you’re trying.', effects: { health: 2, happiness: 1 } },
    ] },
    { label: 'Maybe next year', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v83_career_public_speaking', category: 'career', weight: 3, conditions: { employed: true },
  text: 'You’re asked to give the keynote at a big industry conference.',
  choices: [
    { label: 'Take the stage', skillCheck: { skillId: SK.publicSpeaking, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.6, text: 'You nailed it — standing ovation.', effects: { reputation: 5, jobPerformance: 6, skillXp: [SK.publicSpeaking, 10] } },
      { chance: 0.4, text: 'Nervy, but you got through it.', effects: { skillXp: [SK.publicSpeaking, 6] } },
    ] },
    { label: 'Recommend a colleague', effects: { jobPerformance: -1 } },
  ],
});
ev({
  id: 'v83_business_franchise_offer', category: 'business', weight: 3, conditions: { hasBusiness: true, minMoney: 100000 },
  text: 'Someone wants to franchise your successful concept in another city.',
  amount: { min: 50000, max: 250000 },
  choices: [
    { label: 'License the franchise', effects: { moneyAmountMult: 1, companyBrand: 5, reputation: 2 } },
    { label: 'Keep it exclusive', effects: { companyBrand: 1 } },
  ],
});
ev({
  id: 'v83_market_crypto_swing', category: 'market', weight: 3, conditions: { minMoney: 5000 },
  text: 'A volatile crypto coin is swinging wildly. Friends are getting rich (on paper).',
  amount: { min: 2000, max: 25000 },
  choices: [
    { label: 'Take a small position', outcomes: [
      { chance: 0.45, text: 'You rode it up and cashed out.', effects: { moneyAmountMult: 1.8 } },
      { chance: 0.55, text: 'It crashed. Lesson learned.', effects: { moneyAmountMult: -0.7 } },
    ] },
    { label: 'Stay well clear', effects: { skillXp: [SK.investing, 2] } },
  ],
});
ev({
  id: 'v83_world_climate_summit', category: 'world', weight: 3, conditions: { minInfluence: 30 },
  text: 'You’re invited to speak at a global climate summit.',
  choices: [
    { label: 'Make a bold pledge', effects: { reputation: 4, influence: 3, karma: 3, money: -5000 } },
    { label: 'Attend quietly', effects: { influence: 1 } },
  ],
});
ev({
  id: 'v83_life_open_mic', category: 'life', weight: 3, conditions: { minAge: 16 },
  text: 'There’s an open mic night at a local bar. You’ve always wanted to try stand-up.',
  choices: [
    { label: 'Get on stage', skillCheck: { skillId: SK.charm, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.5, text: 'You killed it — the room was roaring.', effects: { happiness: 6, charisma: 3, skillXp: [SK.charm, 6] } },
      { chance: 0.5, text: 'Tough crowd, but you survived.', effects: { happiness: 1, skillXp: [SK.charm, 3] } },
    ] },
    { label: 'Just watch', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'v83_career_side_consulting', category: 'career', weight: 3, conditions: { employed: true, minAge: 28 },
  text: 'A former colleague offers you well-paid weekend consulting work.',
  choices: [
    { label: 'Take the extra work', effects: { money: 6000, health: -2, happiness: -1, skillXp: [SK.strategy, 4] } },
    { label: 'Protect your free time', effects: { happiness: 2 } },
  ],
});
ev({
  id: 'v83_family_family_business', category: 'family', weight: 3, conditions: { hasChildren: true, hasBusiness: true },
  text: 'Your grown child wants to join the family business.',
  choices: [
    { label: 'Bring them in and train them', effects: { happiness: 5, companyMorale: 3, karma: 2 } },
    { label: 'Tell them to earn it elsewhere first', effects: { happiness: -1, karma: 1 } },
  ],
});

// ---------------------------------------------------------------------------
// V8.4 — 30 new yearly event templates (several award the 10 new achievements)
// ---------------------------------------------------------------------------
ev({
  id: 'v84_business_handshake_deal', category: 'business', weight: 4, conditions: { hasBusiness: true },
  text: 'A rival owner proposes a bold joint venture over dinner. It could double your reach.',
  choices: [
    { label: 'Shake on it', skillCheck: { skillId: SK.negotiation, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'The partnership thrived and reshaped your market.', effects: { companyCash: 400000, reputation: 4, achievement: 'deal_maker' } },
      { chance: 0.45, text: 'It fizzled, but you parted on good terms.', effects: { companyCash: -50000, achievement: 'deal_maker' } },
    ] },
    { label: 'Keep your independence', effects: {} },
  ],
});
ev({
  id: 'v84_market_all_in', category: 'market', weight: 3, conditions: { hasStocks: true, minMoney: 20000 },
  text: 'You have a strong conviction about one stock. Everything says go big.',
  amount: { min: 10000, max: 80000, pctOfMoney: 0.4 },
  choices: [
    { label: 'Bet big', outcomes: [
      { chance: 0.45, text: 'Your conviction paid off spectacularly.', effects: { moneyAmountMult: 2.5, achievement: 'risk_taker' } },
      { chance: 0.55, text: 'It went against you. Painful lesson.', effects: { moneyAmountMult: -0.8, achievement: 'risk_taker' } },
    ] },
    { label: 'Diversify instead', effects: { skillXp: [SK.investing, 4] } },
  ],
});
ev({
  id: 'v84_life_urban_garden', category: 'life', weight: 4,
  text: 'A plot opens up at the community garden. You could grow your own food.',
  choices: [
    { label: 'Tend it all season', effects: { happiness: 4, health: 2, money: 200, achievement: 'master_gardener' } },
    { label: 'Too much work', effects: {} },
  ],
});
ev({
  id: 'v84_life_read_100', category: 'life', weight: 3, conditions: { minAge: 12 },
  text: 'You set an ambitious goal: read 100 books this year.',
  choices: [
    { label: 'Commit to the challenge', outcomes: [
      { chance: 0.5, text: 'You did it — your mind feels sharper than ever.', effects: { smarts: 6, happiness: 4, skillXp: [SK.research, 8], achievement: 'bookworm' } },
      { chance: 0.5, text: 'You read a respectable 60. Still a win.', effects: { smarts: 3, happiness: 2, achievement: 'bookworm' } },
    ] },
    { label: 'Maybe a dozen', effects: { smarts: 1 } },
  ],
});
ev({
  id: 'v84_media_festival', category: 'media', weight: 3, conditions: { minMoney: 20000 },
  text: 'You could launch a small music and arts festival in your city.',
  amount: { min: 15000, max: 90000 },
  choices: [
    { label: 'Make it happen', outcomes: [
      { chance: 0.5, text: 'It became a beloved annual event.', effects: { moneyAmountMult: 1, reputation: 5, popularity: 4, achievement: 'festival_founder' } },
      { chance: 0.5, text: 'A rocky first year, but people showed up.', effects: { moneyAmountMult: -1, reputation: 2, achievement: 'festival_founder' } },
    ] },
    { label: 'Too big a risk', effects: {} },
  ],
});
ev({
  id: 'v84_health_storm', category: 'health', weight: 3,
  text: 'A once-in-a-generation storm is bearing down on your region.',
  choices: [
    { label: 'Volunteer with the response crews', outcomes: [
      { chance: 0.6, text: 'You helped dozens to safety. A hero to your town.', effects: { karma: 8, reputation: 3, health: -3, achievement: 'storm_chaser' } },
      { chance: 0.4, text: 'It was dangerous work and you got banged up.', effects: { health: -10, karma: 6, achievement: 'storm_chaser' } },
    ] },
    { label: 'Shelter in place', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v84_politics_broker_peace', category: 'politics', weight: 3, conditions: { minInfluence: 40 },
  text: 'Two factions are on the brink of conflict. You could mediate.',
  choices: [
    { label: 'Broker a peace deal', skillCheck: { skillId: SK.diplomacy, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.55, text: 'You pulled off a historic reconciliation.', effects: { influence: 6, reputation: 6, karma: 5, achievement: 'peacemaker' } },
      { chance: 0.45, text: 'Talks stalled, but you kept a lid on it.', effects: { influence: 2, karma: 2, achievement: 'peacemaker' } },
    ] },
    { label: 'Stay out of it', effects: {} },
  ],
});
ev({
  id: 'v84_business_patent', category: 'business', weight: 3, conditions: { minAge: 18 },
  text: 'You’ve tinkered up a genuinely novel invention in your garage.',
  choices: [
    { label: 'File a patent and develop it', skillCheck: { skillId: SK.engineering, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.45, text: 'Licensing deals rolled in — you’re an inventor now.', effects: { money: 40000, reputation: 4, skillXp: [SK.engineering, 10], achievement: 'inventor' } },
      { chance: 0.55, text: 'It didn’t sell, but you learned a ton.', effects: { money: -3000, skillXp: [SK.engineering, 8], achievement: 'inventor' } },
    ] },
    { label: 'Keep it a hobby', effects: { happiness: 2 } },
  ],
});
ev({
  id: 'v84_life_world_tour', category: 'life', weight: 3, conditions: { minAge: 21, minMoney: 40000 },
  text: 'You could take a full year off to travel every continent.',
  amount: { min: 30000, max: 120000 },
  choices: [
    { label: 'See the whole world', effects: { moneyAmountMult: -1, happiness: 12, health: 3, skillXp: [SK.foreignLanguages, 12], achievement: 'globe_trotter' } },
    { label: 'A couple of big trips', effects: { money: -8000, happiness: 5 } },
    { label: 'Stay and keep building', effects: {} },
  ],
});
ev({
  id: 'v84_life_rescue', category: 'life', weight: 3,
  text: 'You come across a car accident on a deserted road. Someone is trapped.',
  choices: [
    { label: 'Stop and help', outcomes: [
      { chance: 0.7, text: 'You kept them calm and safe until help arrived.', effects: { karma: 8, happiness: 3, achievement: 'good_samaritan' } },
      { chance: 0.3, text: 'A harrowing scene, but you did the right thing.', effects: { karma: 8, happiness: -2, achievement: 'good_samaritan' } },
    ] },
    { label: 'Call it in and drive on', effects: { karma: 1 } },
  ],
});
ev({
  id: 'v84_career_startup_offer', category: 'career', weight: 4, conditions: { employed: true },
  text: 'A hot startup offers you a role — lower pay, but a big equity stake.',
  choices: [
    { label: 'Take the equity gamble', outcomes: [
      { chance: 0.4, text: 'The startup soared and your shares are worth a fortune.', effects: { money: 60000, happiness: 6 } },
      { chance: 0.6, text: 'It flamed out, but you learned fast.', effects: { money: -4000, skillXp: [SK.strategy, 8] } },
    ] },
    { label: 'Stay in your stable job', effects: { jobPerformance: 2 } },
  ],
});
ev({
  id: 'v84_career_burnout_recovery', category: 'career', weight: 3, conditions: { employed: true, minAge: 30 },
  text: 'You’re running on empty. HR quietly offers a sabbatical.',
  choices: [
    { label: 'Take three months off', effects: { money: -6000, health: 8, happiness: 8, jobPerformance: -3 } },
    { label: 'Power through', effects: { health: -4, jobPerformance: 2 } },
  ],
});
ev({
  id: 'v84_family_adopt_pet', category: 'family', weight: 4,
  text: 'A shelter dog with sad eyes is looking right at you.',
  choices: [
    { label: 'Adopt them', effects: { happiness: 5, money: -800, karma: 2 } },
    { label: 'Not the right time', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v84_family_surprise_party', category: 'family', weight: 3, conditions: { hasSpouse: true },
  text: 'It’s your spouse’s milestone birthday. You could throw a big surprise party.',
  amount: { min: 2000, max: 15000 },
  choices: [
    { label: 'Go all out', effects: { moneyAmountMult: -1, happiness: 8 } },
    { label: 'A quiet dinner', effects: { money: -300, happiness: 4 } },
  ],
});
ev({
  id: 'v84_family_college_fund', category: 'family', weight: 3, conditions: { hasChildren: true, minMoney: 20000 },
  text: 'Your child’s college years are approaching. You could set up a serious fund.',
  amount: { min: 15000, max: 100000 },
  choices: [
    { label: 'Fully fund their future', effects: { moneyAmountMult: -1, happiness: 5, karma: 3 } },
    { label: 'Contribute what you can', effects: { money: -5000, happiness: 2 } },
  ],
});
ev({
  id: 'v84_world_refugee_crisis', category: 'world', weight: 3,
  text: 'A humanitarian crisis abroad is dominating the headlines.',
  choices: [
    { label: 'Fund a relief effort', effects: { money: -6000, karma: 6, reputation: 2 } },
    { label: 'Raise awareness online', effects: { karma: 2, socialFollowersPct: 0.3 } },
  ],
});
ev({
  id: 'v84_world_tech_breakthrough', category: 'world', weight: 3,
  text: 'A stunning scientific breakthrough is announced. The world feels different.',
  choices: [
    { label: 'Invest in the trend early', effects: { money: -8000, skillXp: [SK.research, 5] } },
    { label: 'Watch it unfold', effects: { smarts: 1 } },
  ],
});
ev({
  id: 'v84_crime_bribe_offer', category: 'crime', weight: 3, conditions: { hasBusiness: true },
  text: 'An inspector hints that a “gift” would make your permit problems disappear.',
  choices: [
    { label: 'Refuse and do it right', effects: { reputation: 3, karma: 3, money: -2000 } },
    { label: 'Pay the bribe', outcomes: [
      { chance: 0.6, text: 'Problem solved, no questions asked.', effects: { money: -5000, notoriety: 2, karma: -3 } },
      { chance: 0.4, text: 'It was a sting. You’re in trouble.', effects: { criminalRecord: 1, money: -10000, reputation: -5 } },
    ] },
  ],
});
ev({
  id: 'v84_health_new_diet', category: 'health', weight: 4, conditions: { minAge: 25 },
  text: 'You commit to a serious lifestyle overhaul — diet, sleep, exercise.',
  choices: [
    { label: 'Stick with it all year', outcomes: [
      { chance: 0.6, text: 'You feel a decade younger.', effects: { health: 10, happiness: 5 } },
      { chance: 0.4, text: 'Good progress, some backsliding.', effects: { health: 4, happiness: 2 } },
    ] },
    { label: 'Fizzle out by February', effects: { happiness: -1 } },
  ],
});
ev({
  id: 'v84_business_expand_overseas', category: 'business', weight: 3, conditions: { hasBusiness: true, minMoney: 100000 },
  text: 'Your company could open its first international office.',
  amount: { min: 50000, max: 300000 },
  choices: [
    { label: 'Expand abroad', outcomes: [
      { chance: 0.5, text: 'The new market embraced you.', effects: { moneyAmountMult: 1.5, companyBrand: 6, reputation: 3 } },
      { chance: 0.5, text: 'Tougher than expected, but a foothold.', effects: { moneyAmountMult: -1, companyBrand: 2 } },
    ] },
    { label: 'Stay domestic for now', effects: {} },
  ],
});
ev({
  id: 'v84_politics_referendum', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'A contentious issue is going to a public referendum, and your side is asking you to lead.',
  choices: [
    { label: 'Front the campaign', skillCheck: { skillId: SK.campaigning, bonusPerLevel: 0.006 }, outcomes: [
      { chance: 0.5, text: 'Your side won. A defining victory.', effects: { popularity: 6, influence: 4, politicalCapital: 3 } },
      { chance: 0.5, text: 'You lost narrowly, but fought well.', effects: { popularity: -2, politicalCapital: -2 } },
    ] },
    { label: 'Stay neutral', effects: { popularity: -1 } },
  ],
});
ev({
  id: 'v84_market_short_squeeze', category: 'market', weight: 3, conditions: { hasStocks: true },
  text: 'A heavily-shorted stock is being squeezed and social media is euphoric.',
  amount: { min: 3000, max: 30000 },
  choices: [
    { label: 'Ride the squeeze', outcomes: [
      { chance: 0.4, text: 'You sold near the top. Rare timing.', effects: { moneyAmountMult: 2 } },
      { chance: 0.6, text: 'You were left holding the bag.', effects: { moneyAmountMult: -0.7 } },
    ] },
    { label: 'Watch the madness', effects: { skillXp: [SK.investing, 3] } },
  ],
});
ev({
  id: 'v84_life_learn_instrument', category: 'life', weight: 3,
  text: 'You’ve always wanted to play an instrument. This is the year.',
  choices: [
    { label: 'Practice daily', effects: { happiness: 5, money: -600, skillXp: [SK.charm, 3] } },
    { label: 'Give it a casual try', effects: { happiness: 1 } },
  ],
});
ev({
  id: 'v84_life_mentor_youth', category: 'life', weight: 3, conditions: { minAge: 25 },
  text: 'A local program pairs mentors with at-risk teens.',
  choices: [
    { label: 'Become a mentor', effects: { karma: 6, happiness: 4, skillXp: [SK.teaching, 5] } },
    { label: 'Donate instead', effects: { money: -1000, karma: 2 } },
  ],
});
ev({
  id: 'v84_career_award_nom', category: 'career', weight: 3, conditions: { employed: true, minReputation: 30 },
  text: 'You’ve been nominated for a prestigious industry award.',
  choices: [
    { label: 'Campaign hard for it', outcomes: [
      { chance: 0.5, text: 'You won! A career highlight.', effects: { reputation: 6, jobPerformance: 5, happiness: 6 } },
      { chance: 0.5, text: 'Runner-up, but the recognition helped.', effects: { reputation: 2, happiness: 2 } },
    ] },
    { label: 'Let the work speak', effects: { reputation: 1 } },
  ],
});
ev({
  id: 'v84_business_cyberattack', category: 'business', weight: 3, conditions: { hasBusiness: true },
  text: 'Hackers have breached your company’s systems and are demanding a ransom.',
  choices: [
    { label: 'Refuse and rebuild', skillCheck: { skillId: SK.cybersecurity, bonusPerLevel: 0.005 }, outcomes: [
      { chance: 0.55, text: 'You restored from backups and hardened everything.', effects: { companyCash: -80000, companyBrand: 2 } },
      { chance: 0.45, text: 'Recovery was slow and customers noticed.', effects: { companyCash: -200000, companyBrand: -6 } },
    ] },
    { label: 'Pay the ransom', effects: { companyCash: -150000, notoriety: 1 } },
  ],
});
ev({
  id: 'v84_world_lottery_town', category: 'world', weight: 2, conditions: { minAge: 18 },
  text: 'Your entire town pooled together for a lottery syndicate — and it hit.',
  choices: [
    { label: 'Share in the winnings', effects: { money: 25000, happiness: 6 } },
    { label: 'Donate your share locally', effects: { karma: 5, reputation: 2, happiness: 3 } },
  ],
});
ev({
  id: 'v84_family_family_reunion', category: 'family', weight: 3, conditions: { minAge: 30 },
  text: 'You could host a big family reunion at your place.',
  amount: { min: 1000, max: 8000 },
  choices: [
    { label: 'Host everyone', effects: { moneyAmountMult: -1, happiness: 6, karma: 2 } },
    { label: 'Keep it small', effects: { happiness: 2 } },
  ],
});
ev({
  id: 'v84_health_blood_donor', category: 'health', weight: 4, conditions: { minAge: 18 },
  text: 'A blood drive is set up near you and they’re short on donors.',
  choices: [
    { label: 'Donate', effects: { karma: 3, happiness: 2, health: -1 } },
    { label: 'Not today', effects: {} },
  ],
});
ev({
  id: 'v84_politics_anti_corruption', category: 'politics', weight: 3, conditions: { inOffice: 'any' },
  text: 'You could launch a sweeping anti-corruption drive — and make powerful enemies.',
  choices: [
    { label: 'Clean house', outcomes: [
      { chance: 0.55, text: 'You rooted out graft and the public loved it.', effects: { popularity: 6, reputation: 5, influence: -2, karma: 4 } },
      { chance: 0.45, text: 'The establishment fought back hard.', effects: { popularity: 2, influence: -4, notoriety: 2 } },
    ] },
    { label: 'Pick your battles', effects: {} },
  ],
});

export const EVENT_TEMPLATES: EventTemplate[] = E;
