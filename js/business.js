/* ============================================================
   BusinessLife — BUSINESS SIMULATION
   Found, operate, staff, market, raise, acquire, and exit
   companies. The heart of the game.
   ============================================================ */
window.Business = (function () {

  /* ---------- Founding ---------- */
  function found(industryId, name, investment) {
    const ind = DATA.INDUSTRIES.find(i => i.id === industryId);
    if (!ind || investment > G.cash) return null;
    const underfunded = investment < ind.capital;
    const b = {
      uid: U.uid(),
      name,
      industryId,
      foundedAge: G.age,
      months: 0,
      equity: 1.0,                 // founder ownership
      cash: investment,            // company bank account
      revenue: 0,                  // monthly revenue (evolves)
      baseRevenue: investment * U.rand(0.24, 0.34) * (underfunded ? 0.6 : 1),
      quality: U.clamp(30 + G.skills[ind.keySkill] * 0.5 + (underfunded ? -10 : 0), 5, 80),
      brand: 5,
      morale: 70,
      efficiency: 50,
      employees: [],               // {roleId, name, salary, months, skill}
      marketingBudget: 0,          // monthly
      rdBudget: 0,                 // monthly
      dividendPolicy: 0.3,         // fraction of profit paid to shareholders
      pricing: 'standard',         // 'budget' | 'standard' | 'premium'
      level: 1,                    // expansion level (locations/servers/lines)
      funding: [],                 // {round, amount, equitySold, valuation}
      public: false,
      sharePrice: 0,
      history: [],                 // monthly profit history
      revHistory: [],
      loans: 0,
      crisis: null,                // active crisis {type, monthsLeft}
      acquiredCompanies: [],
    };
    G.cash -= investment;
    G.totals.spent += investment;
    G.totals.businessesFounded++;
    G.businesses.push(b);
    State.log('🚀', `Founded ${name} (${ind.name}) with ${U.money(investment, G.currency)}.`, 'milestone');
    Engine.checkAchievement('founder');
    return b;
  }

  /* ---------- Monthly operation ---------- */
  function step(b) {
    const ind = DATA.INDUSTRIES.find(i => i.id === b.industryId);
    b.months++;

    /* --- workforce output (diminishing returns on headcount) --- */
    let rawOutput = 1;
    let revBoost = 0, brandBoost = 0, qualityBoost = 0, effBoost = 0, moraleBoost = 0;
    b.employees.forEach(e => {
      const role = DATA.ROLES.find(r => r.id === e.roleId);
      const skillMul = 0.7 + e.skill / 100 * 0.6;
      rawOutput += (role.boosts.output || 0) * skillMul;
      revBoost += role.boosts.revenue || 0;
      brandBoost += role.boosts.brand || 0;
      qualityBoost += role.boosts.quality || 0;
      effBoost += role.boosts.efficiency || 0;
      moraleBoost += role.boosts.morale || 0;
      e.months++;
    });
    const output = Math.pow(rawOutput, 0.65);

    /* --- morale dynamics --- */
    const workload = b.revenue / Math.max(1, (1 + b.employees.length) * 25000);
    b.morale = U.clamp(b.morale + moraleBoost * 10 - (workload > 3 ? 3 : 0) + (b.cash > 0 ? 0.5 : -4) + U.gauss(0, 2), 5, 100);
    const moraleMul = 0.6 + b.morale / 100 * 0.55;

    /* --- brand & quality evolve with budgets --- */
    const mkRoi = Math.sqrt(Math.max(0, b.marketingBudget)) / 90;
    b.brand = U.clamp(b.brand + mkRoi + brandBoost * 2 - 0.4, 0, 100);
    const rdRoi = Math.sqrt(Math.max(0, b.rdBudget)) / 110;
    b.quality = U.clamp(b.quality + rdRoi + qualityBoost * 2 - 0.25, 0, 100);
    b.efficiency = U.clamp(b.efficiency + effBoost * 2 - 0.15 + (G.skills.operations / 400), 5, 100);

    /* --- founder skill influence (only while alive & not retired) --- */
    const founderMul = G.retired ? 0.85 : 0.9 + (G.skills[ind.keySkill] / 100) * 0.35 + (G.skills.leadership / 100) * 0.15;

    /* --- pricing strategy --- */
    const priceCfg = {
      budget: { rev: 0.85, demand: 1.25, brandDrag: -0.2 },
      standard: { rev: 1.0, demand: 1.0, brandDrag: 0 },
      premium: { rev: 1.3, demand: 0.75 + b.brand / 200, brandDrag: 0.1 },
    }[b.pricing];

    /* --- revenue model --- */
    const demand = Economy.macroMult() * (0.7 + b.brand / 100 * 0.8) * priceCfg.demand;
    const growthPull = ind.growth * (1 + Math.log10(1 + b.level) * 0.35);
    let target = b.baseRevenue * output * growthPull * demand * founderMul * moraleMul * (0.75 + b.quality / 100 * 0.5);
    // market saturation: each expansion level raises the addressable ceiling
    const ceiling = ind.capital * ind.scale * 1.5 * b.level;
    target = ceiling * target / (ceiling + target);
    const noise = U.gauss(0, ind.volatility * 0.11);
    b.revenue = Math.max(0, b.revenue * 0.72 + target * 0.28 * priceCfg.rev);
    b.revenue *= (1 + noise);

    // crisis suppression
    if (b.crisis) {
      b.revenue *= b.crisis.revMul;
      b.crisis.monthsLeft--;
      if (b.crisis.monthsLeft <= 0) {
        State.log('🌤️', `${b.name}: the ${b.crisis.label} has passed.`, 'business');
        b.crisis = null;
      }
    }

    /* --- costs --- */
    const payroll = b.employees.reduce((s, e) => s + e.salary / 12, 0);
    const overhead = (ind.capital * 0.012) * b.level * (1 - b.efficiency / 300);
    // gross margin = structural industry floor (0.32) + industry margin edge
    const cogs = b.revenue * (1 - (0.32 + ind.margin) - (b.quality - 50) / 900 + (b.pricing === 'premium' ? -0.03 : 0));
    const interest = b.loans * (G.market.econ.interest + 0.04) / 12;
    const totalCosts = payroll + overhead + Math.max(0, cogs) + b.marketingBudget + b.rdBudget + interest;

    const profit = b.revenue - totalCosts;
    b.cash += profit;

    /* dividends: profitable + solvent companies pay out per policy */
    if (profit > 0 && b.cash > 0 && (b.dividendPolicy || 0) > 0) {
      const payout = profit * b.dividendPolicy;
      const founderCut = payout * b.equity;
      b.cash -= payout;
      G.cash += founderCut * 0.85; // 15% dividend tax
      G.totals.earned += founderCut;
      G.totals.taxesPaid += founderCut * 0.15;
    }
    b.history.push(profit);
    b.revHistory.push(b.revenue);
    if (b.history.length > 60) { b.history.shift(); b.revHistory.shift(); }

    /* --- organic base growth (capped near the saturation ceiling) --- */
    b.baseRevenue = Math.min(b.baseRevenue * (1 + (ind.growth - 1) / 40 + (b.quality - 50) / 6000), ceiling * 2);

    /* --- distress --- */
    if (b.cash < 0) {
      // auto-draw emergency credit if possible, else insolvency countdown
      if (U.chance(0.5) && b.loans < valuation(b) * 0.4) {
        const draw = Math.abs(b.cash) * 1.5;
        b.loans += draw; b.cash += draw;
        State.log('🏦', `${b.name} drew ${U.money(draw, G.currency)} in emergency credit.`, 'business');
      } else if (b.cash < -valuation(b) * 0.25) {
        return { bankrupt: true, profit };
      }
    }
    return { bankrupt: false, profit };
  }

  /* ---------- Valuation ---------- */
  function valuation(b) {
    const ind = DATA.INDUSTRIES.find(i => i.id === b.industryId);
    const annualRev = b.revenue * 12;
    const recentProfit = b.history.slice(-12).reduce((s, p) => s + p, 0);
    const revMultiple = 1.2 + ind.growth * 1.4 + (b.brand / 100) * 1.5 + (ind.scale / 12);
    const profMultiple = 8 + ind.growth * 4;
    let v = Math.max(annualRev * revMultiple * 0.45 + Math.max(0, recentProfit) * profMultiple * 0.55, b.cash);
    v = v * Economy.macroMult() * (0.85 + G.market.econ.sentiment * 0.3);
    return Math.max(0, v + b.cash - b.loans);
  }

  /* ---------- Hiring ---------- */
  function hire(b, roleId) {
    const role = DATA.ROLES.find(r => r.id === roleId);
    const gender = U.chance(0.5) ? 'm' : 'f';
    const name = U.pick(gender === 'm' ? DATA.FIRST_M : DATA.FIRST_F) + ' ' + U.pick(DATA.LAST);
    const skill = U.clamp(U.randInt(30, 70) + G.skills.leadership / 5, 10, 95);
    const salary = Math.round(role.salary * (0.85 + skill / 100 * 0.4));
    b.employees.push({ uid: U.uid(), roleId, name, salary, months: 0, skill });
    State.log('🤝', `${b.name} hired ${name} as ${role.title} (${U.money(salary, G.currency)}/yr).`, 'business');
  }
  function fire(b, uid) {
    const i = b.employees.findIndex(e => e.uid === uid);
    if (i < 0) return;
    const e = b.employees[i];
    const sev = e.salary / 12 * 2;
    b.cash -= sev;
    b.morale = U.clamp(b.morale - 6, 5, 100);
    b.employees.splice(i, 1);
    State.log('📤', `${b.name} let ${e.name} go (severance ${U.money(sev, G.currency)}).`, 'business');
  }

  /* ---------- Expansion ---------- */
  function expandCost(b) {
    const ind = DATA.INDUSTRIES.find(i => i.id === b.industryId);
    return Math.round(ind.capital * 0.8 * Math.pow(1.9, b.level - 1));
  }
  function expand(b) {
    const cost = expandCost(b);
    if (b.cash < cost) return false;
    b.cash -= cost;
    b.level++;
    b.baseRevenue *= 1.55;
    State.log('🏗️', `${b.name} expanded to level ${b.level}!`, 'milestone');
    return true;
  }

  /* ---------- Funding rounds ---------- */
  const ROUNDS = ['Seed', 'Series A', 'Series B', 'Series C', 'Series D'];
  function nextRound(b) {
    return ROUNDS[b.funding.length] || 'Growth';
  }
  function raiseTerms(b) {
    const v = valuation(b);
    const roundIdx = b.funding.length;
    const premium = 1.15 + G.skills.negotiation / 250 + G.reputation / 400;
    const preMoney = Math.max(v * premium, (roundIdx + 1) * 400000);
    const amount = Math.round(preMoney * U.rand(0.15, 0.25));
    const equitySold = amount / (preMoney + amount);
    return { round: nextRound(b), preMoney, amount, equitySold };
  }
  function acceptRaise(b, terms) {
    b.cash += terms.amount;
    b.equity -= b.equity * terms.equitySold;
    b.funding.push({ round: terms.round, amount: terms.amount, equitySold: terms.equitySold, valuation: terms.preMoney + terms.amount });
    State.log('💰', `${b.name} raised ${U.money(terms.amount, G.currency)} (${terms.round}) at ${U.money(terms.preMoney + terms.amount, G.currency)} post. You now own ${(b.equity * 100).toFixed(1)}%.`, 'milestone');
    Engine.checkAchievement('raised');
  }

  /* ---------- IPO ---------- */
  function canIPO(b) {
    return !b.public && valuation(b) >= 50000000 && b.revenue * 12 >= 10000000;
  }
  function ipo(b) {
    if (!canIPO(b)) return false;
    const v = valuation(b) * (0.9 + G.market.econ.sentiment * 0.35);
    const floatFrac = 0.2;
    const proceeds = v * floatFrac * b.equity; // founder sells 20% of their stake
    b.equity *= (1 - floatFrac);
    b.public = true;
    b.sharePrice = 25;
    G.cash += proceeds * (1 - 0.03); // banker fees
    G.fame = U.clamp(G.fame + 20, 0, 100);
    G.reputation = U.clamp(G.reputation + 15, 0, 100);
    State.log('🔔', `${b.name} IPO'd at a ${U.money(v, G.currency)} valuation! You cashed out ${U.money(proceeds, G.currency)}.`, 'milestone');
    Engine.checkAchievement('ipo');
    return true;
  }

  /* ---------- Sell / exit ---------- */
  function saleOffer(b) {
    const v = valuation(b);
    const strategic = U.rand(0.9, 1.35) + G.skills.negotiation / 300;
    return Math.round(v * strategic);
  }
  function sell(b, price) {
    const proceeds = price * b.equity;
    const tax = proceeds * 0.2;
    G.cash += proceeds - tax;
    G.totals.taxesPaid += tax;
    G.totals.exits++;
    G.soldBusinesses.push({ name: b.name, industryId: b.industryId, price, ageAtSale: G.age, founded: b.foundedAge });
    G.businesses = G.businesses.filter(x => x.uid !== b.uid);
    G.reputation = U.clamp(G.reputation + 8, 0, 100);
    G.happiness = U.clamp(G.happiness + 10, 0, 100);
    State.log('🏆', `Sold ${b.name} for ${U.money(price, G.currency)} — you pocketed ${U.money(proceeds - tax, G.currency)} after tax.`, 'milestone');
    Engine.checkAchievement('exit');
  }

  function bankrupt(b) {
    G.businesses = G.businesses.filter(x => x.uid !== b.uid);
    G.happiness = U.clamp(G.happiness - 18, 0, 100);
    G.reputation = U.clamp(G.reputation - 10, 0, 100);
    G.stress = U.clamp(G.stress + 20, 0, 100);
    State.log('💀', `${b.name} went bankrupt after ${Math.floor(b.months / 12)}y ${b.months % 12}m. Creditors seized everything.`, 'bad');
  }

  /* ---------- Acquire competitors ---------- */
  function acquisitionTarget(b) {
    const ind = DATA.INDUSTRIES.find(i => i.id === b.industryId);
    const size = U.rand(0.25, 0.8);
    const price = Math.round(valuation(b) * size * U.rand(0.8, 1.2) + ind.capital);
    const names = ['Apex', 'Northstar', 'Blue Harbor', 'Vertex', 'Summit', 'Pioneer', 'Atlas', 'Meridian'];
    return { name: U.pick(names) + ' ' + ind.name.split(' ')[0], price, revBoost: size * 0.7 };
  }
  function acquire(b, target) {
    if (b.cash < target.price) return false;
    b.cash -= target.price;
    b.baseRevenue *= (1 + target.revBoost);
    b.revenue *= (1 + target.revBoost * 0.6);
    b.acquiredCompanies.push(target.name);
    State.log('🤝', `${b.name} acquired ${target.name} for ${U.money(target.price, G.currency)}.`, 'milestone');
    return true;
  }

  return {
    found, step, valuation, hire, fire, expand, expandCost,
    raiseTerms, acceptRaise, nextRound, canIPO, ipo,
    saleOffer, sell, bankrupt, acquisitionTarget, acquire,
  };
})();
