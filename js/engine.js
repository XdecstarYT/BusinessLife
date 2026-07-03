/* ============================================================
   BusinessLife — ENGINE
   The tick loop: advance one month / one year, apply income,
   costs, aging, events, achievements, and game-over checks.
   ============================================================ */
window.Engine = (function () {

  const ACHIEVEMENTS = [
    { id: 'founder', name: 'Founder', emoji: '🚀', desc: 'Start your first business' },
    { id: 'sixfig', name: 'Six Figures', emoji: '💵', desc: 'Reach $100K net worth', check: () => Economy.netWorth() >= 100000 },
    { id: 'millionaire', name: 'Millionaire', emoji: '💰', desc: 'Reach $1M net worth', check: () => Economy.netWorth() >= 1e6 },
    { id: 'decamillionaire', name: 'Deca-Millionaire', emoji: '🏦', desc: 'Reach $10M net worth', check: () => Economy.netWorth() >= 1e7 },
    { id: 'centimillionaire', name: 'Centi-Millionaire', emoji: '💎', desc: 'Reach $100M net worth', check: () => Economy.netWorth() >= 1e8 },
    { id: 'billionaire', name: 'Billionaire', emoji: '👑', desc: 'Reach $1B net worth', check: () => Economy.netWorth() >= 1e9 },
    { id: 'raised', name: 'Backed', emoji: '🤝', desc: 'Raise venture funding' },
    { id: 'ipo', name: 'Ring the Bell', emoji: '🔔', desc: 'Take a company public' },
    { id: 'exit', name: 'Exit Strategy', emoji: '🏆', desc: 'Sell a business' },
    { id: 'empire', name: 'Empire Builder', emoji: '🏛️', desc: 'Run 3 businesses at once', check: () => G.businesses.length >= 3 },
    { id: 'mogul', name: 'Property Mogul', emoji: '🏢', desc: 'Own 5 rental properties', check: () => G.realEstate.length >= 5 },
    { id: 'graduate', name: 'Scholar', emoji: '🎓', desc: 'Earn an MBA or PhD', check: () => G.education.includes('mba') || G.education.includes('phd') },
    { id: 'famous', name: 'Household Name', emoji: '🌟', desc: 'Reach 80 fame', check: () => G.fame >= 80 },
    { id: 'family', name: 'Family First', emoji: '👨‍👩‍👧', desc: 'Get married and have a child', check: () => G.partner && G.partner.married && G.children.length > 0 },
    { id: 'centenarian', name: 'Centenarian', emoji: '🎂', desc: 'Live to 100', check: () => G.age >= 100 },
  ];

  function checkAchievement(id) {
    if (G.achievements.includes(id)) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    G.achievements.push(id);
    State.log(a.emoji, `Achievement unlocked: ${a.name} — ${a.desc}`, 'milestone');
    UI.toast(a.emoji, `Achievement: ${a.name}!`, 'good');
  }
  function sweepAchievements() {
    ACHIEVEMENTS.forEach(a => { if (a.check && !G.achievements.includes(a.id) && a.check()) checkAchievement(a.id); });
  }

  /* ---------- one month ---------- */
  function tickMonth() {
    if (!G.alive || G.gameOver) return;

    /* macro & markets */
    Economy.stepMacro();
    Economy.stepPrices();
    Economy.stepRealEstate();

    /* salary income */
    if (G.job) {
      const job = DATA.JOBS.find(j => j.id === G.job);
      const country = DATA.COUNTRIES.find(c => c.id === G.country);
      const gross = job.pay / 12;
      const net = gross * (1 - country.tax);
      G.cash += net;
      G.totals.earned += gross;
      G.totals.taxesPaid += gross - net;
      G.jobMonths++;
      G.jobPerformance = U.clamp(G.jobPerformance + U.gauss(0.4, 2) + (G.energy > 50 ? 0.3 : -0.5), 0, 100);
      G.skills[job.skill] = U.clamp(G.skills[job.skill] + 0.35, 0, 100);
      // possible raise/promotion pressure handled on year tick
    }

    /* studying */
    if (G.studying) {
      G.studying.monthsLeft--;
      G.energy = U.clamp(G.energy - 1, 0, 100);
      if (G.studying.monthsLeft <= 0) {
        const ed = DATA.EDUCATION.find(e => e.id === G.studying.id);
        G.education.push(ed.id);
        Object.entries(ed.boost).forEach(([k, v]) => { G.skills[k] = U.clamp(G.skills[k] + v, 0, 100); });
        State.log('🎓', `Graduated: ${ed.name}${ed.degree ? ` (${ed.degree})` : ''}!`, 'milestone');
        UI.toast('🎓', `You earned your ${ed.degree || ed.name}!`, 'good');
        G.studying = null;
        sweepAchievements();
      }
    }

    /* businesses */
    for (const b of [...G.businesses]) {
      const res = Business.step(b);
      if (res.bankrupt) Business.bankrupt(b);
    }

    /* personal cost of living (scales with lifestyle) */
    const lifestyleCost = G.assets.reduce((s, a) => {
      const item = DATA.ASSETS[a.catId].find(x => x.id === a.id);
      return s + (item.upkeep || item.price * 0.001);
    }, 0);
    const famCost = G.children.length * 900 + (G.partner ? 500 : 0);
    G.cash -= G.monthlyBurn + lifestyleCost + famCost;
    G.totals.spent += G.monthlyBurn + lifestyleCost + famCost;

    /* debt interest */
    if (G.debt > 0) {
      const interest = G.debt * G.debtRate / 12;
      G.cash -= interest;
      G.totals.spent += interest;
    }

    /* friend payback */
    if (G.pendingPayback && U.chance(0.08)) {
      G.cash += G.pendingPayback;
      State.log('🎁', `Your friend actually paid you back ${U.money(G.pendingPayback, G.currency)}!`, 'money');
      G.pendingPayback = 0;
    }

    /* mentor */
    if (G.mentor) {
      G.skills[G.mentor.skill] = U.clamp(G.skills[G.mentor.skill] + 0.8, 0, 100);
      G.mentor.monthsLeft--;
      if (G.mentor.monthsLeft <= 0) {
        State.log('🧙', `${G.mentor.name}'s mentorship ended. You learned a lot.`, 'info');
        G.mentor = null;
      }
    }

    /* relationships drift */
    if (G.partner) {
      G.partner.months++;
      const neglect = G.energy < 25 ? -1.2 : 0;
      G.partner.quality = U.clamp(G.partner.quality + U.gauss(0.1, 1.2) + neglect + (G.happiness > 60 ? 0.2 : -0.2), 0, 100);
      if (G.partner.quality < 12) {
        const wasMarried = G.partner.married;
        State.log('💔', `${G.partner.name} left you.${wasMarried ? ' The divorce cost you dearly.' : ''}`, 'bad');
        if (wasMarried) { const settle = Economy.netWorth() * 0.2; G.cash -= settle; }
        G.partner = null;
        G.happiness = U.clamp(G.happiness - 20, 0, 100);
      }
    }
    G.children.forEach(c => { c.age += 1 / 12; });

    /* vitals drift */
    const ageStrain = G.age > 60 ? (G.age - 60) * 0.05 : 0;
    G.health = U.clamp(G.health + U.gauss(-0.08, 0.55) - ageStrain - (G.stress > 70 ? 0.4 : 0), 0, 100);
    G.energy = U.clamp(G.energy + U.gauss(1.5, 2) - (G.businesses.length * 0.5), 0, 100);
    G.happiness = U.clamp(G.happiness + U.gauss(-0.2, 1) + (G.partner ? 0.3 : 0), 0, 100);
    G.stress = U.clamp(G.stress + (G.businesses.length * 0.4) + (G.cash < 0 ? 3 : -0.8) + U.gauss(0, 1), 0, 100);

    /* fame follows wealth + reputation */
    const nw = Economy.netWorth();
    const fameTarget = U.clamp(Math.log10(Math.max(1, nw)) * 9 - 35 + G.reputation * 0.3, 0, 100);
    G.fame += (fameTarget - G.fame) * 0.03;

    /* negative cash spiral -> forced borrowing / game over check */
    if (G.cash < 0) {
      const limit = Economy.creditLimit();
      if (G.debt < limit) {
        const draw = Math.min(Math.abs(G.cash) + 2000, limit - G.debt);
        G.debt += draw; G.cash += draw;
      } else if (G.cash < -limit * 0.75) {
        gameOver('bankrupt', 'Personal bankruptcy. Creditors took everything.');
        return;
      } else if (U.chance(0.3)) {
        UI.toast('⚠️', 'You are drowning in debt. Sell something or earn — fast.', 'bad');
      }
    }

    /* random event */
    const ev = Events.maybeFire();
    if (ev) G.pendingEvents.push(ev);

    /* month/age advance */
    G.month++;
    if (G.month >= 12) { G.month = 0; tickYear(); }

    /* death check (monthly, low probability, health-driven) */
    const deathP = deathProbMonthly();
    if (U.chance(deathP)) { die(); return; }

    sweepAchievements();
    G.netWorthHist.push(nw);
    if (G.netWorthHist.length > 120) G.netWorthHist.shift();
    State.save();
  }

  /* ---------- one year ---------- */
  function tickYear() {
    G.age++;
    State.log('🎂', `Happy ${G.age}th birthday!`, 'info');

    /* job promotion check */
    if (G.job) {
      const job = DATA.JOBS.find(j => j.id === G.job);
      if (job.promo && G.jobPerformance > 70) {
        const next = DATA.JOBS.find(j => j.id === job.promo);
        const eduOk = !next.reqEdu || G.education.includes(next.reqEdu);
        const skillOk = G.skills[next.skill] >= next.reqSkill;
        if (eduOk && skillOk && G.age >= next.minAge && U.chance(0.6)) {
          G.job = next.id; G.jobMonths = 0; G.jobPerformance = 55;
          State.log('📈', `Promoted to ${next.title}! New salary: ${U.money(next.pay, G.currency)}/yr.`, 'milestone');
          UI.toast('📈', `Promoted to ${next.title}!`, 'good');
        }
      } else if (G.jobPerformance < 15 && U.chance(0.5)) {
        State.log('🪓', `You were fired from your ${job.title} job for poor performance.`, 'bad');
        G.job = null; G.jobMonths = 0;
      }
    }

    /* asset aging */
    G.assets.forEach(a => a.age += 12);

    /* kids growing */
    G.children.forEach(c => {
      if (Math.floor(c.age) === 18) State.log('🎓', `${c.name} turned 18 and is heading to college. Tuition time.`, 'info');
    });
    const tuition = G.children.filter(c => c.age >= 18 && c.age < 22).length * 30000;
    if (tuition) { G.cash -= tuition; G.totals.spent += tuition; }
  }

  function deathProbMonthly() {
    if (G.age < 50) return G.health <= 2 ? 0.05 : 0.00008;
    const base = Math.pow((G.age - 45) / 60, 4) / 12;
    const healthMul = 2 - (G.health / 100) * 1.5;
    return U.clamp(base * healthMul, 0, 0.25);
  }

  function die() {
    G.alive = false;
    const nw = Economy.netWorth();
    gameOver('death', `${G.name} died at ${G.age}, leaving behind a ${U.money(nw, G.currency)} estate.`);
  }

  function gameOver(reason, summary) {
    G.gameOver = { reason, summary, netWorth: Economy.netWorth(), age: G.age };
    State.log(reason === 'death' ? '🪦' : '📉', summary, 'bad');
    State.save();
    UI.render();
  }

  /* ---------- public: advance N months ---------- */
  function advance(months = 1) {
    for (let i = 0; i < months; i++) {
      if (!G.alive || G.gameOver) break;
      tickMonth();
      if (G.pendingEvents.length) break; // stop to let player decide
    }
    UI.render();
    if (G.pendingEvents.length) UI.showEvent(G.pendingEvents.shift());
  }

  return { advance, checkAchievement, sweepAchievements, ACHIEVEMENTS };
})();
