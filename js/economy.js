/* ============================================================
   BusinessLife — ECONOMY & MARKETS
   Macro cycle, stock/crypto simulation, personal investing,
   rental real estate, loans, taxes.
   ============================================================ */
window.Economy = (function () {

  /* ---------- Macro economic cycle ---------- */
  const PHASES = {
    expansion: { next: 'boom', mult: 1.0, label: 'Expansion', emoji: '📈' },
    boom: { next: 'recession', mult: 1.18, label: 'Boom', emoji: '🚀' },
    recession: { next: 'recovery', mult: 0.78, label: 'Recession', emoji: '📉' },
    recovery: { next: 'expansion', mult: 0.92, label: 'Recovery', emoji: '🌱' },
  };

  function stepMacro() {
    const e = G.market.econ;
    e.phaseMonths++;
    const avgLen = { expansion: 36, boom: 18, recession: 14, recovery: 16 }[e.phase];
    if (U.chance(1 / avgLen)) {
      const old = e.phase;
      e.phase = PHASES[e.phase].next;
      e.phaseMonths = 0;
      const p = PHASES[e.phase];
      State.log(p.emoji, `The economy shifted from ${PHASES[old].label} to ${p.label}.`, 'market');
      if (e.phase === 'recession') UI.toast('📉', 'Recession hits. Brace your businesses.', 'bad');
      if (e.phase === 'boom') UI.toast('🚀', 'Economic boom! Everything is up.', 'good');
    }
    // interest rate drifts with the cycle
    const target = { expansion: 0.05, boom: 0.075, recession: 0.03, recovery: 0.04 }[e.phase];
    e.interest += (target - e.interest) * 0.08 + U.gauss(0, 0.002);
    e.interest = U.clamp(e.interest, 0.005, 0.14);
    e.sentiment = U.clamp(e.sentiment + U.gauss(0, 0.05) + (PHASES[e.phase].mult - 1) * 0.05, 0.05, 1);
  }

  function macroMult() { return PHASES[G.market.econ.phase].mult; }
  function phaseInfo() { return PHASES[G.market.econ.phase]; }

  /* ---------- Securities ---------- */
  function stepPrices() {
    const m = macroMult();
    G.market.stocks.forEach(s => {
      const meta = DATA.STOCKS.find(d => d.ticker === s.ticker);
      const monthlyDrift = meta.drift / 12 * m;
      const shock = U.gauss(0, meta.beta * 0.045);
      s.price = Math.max(1, s.price * (1 + monthlyDrift + shock));
      s.hist.push(s.price);
      if (s.hist.length > 60) s.hist.shift();
    });
    G.market.crypto.forEach(s => {
      const meta = DATA.CRYPTO.find(d => d.ticker === s.ticker);
      const monthlyDrift = meta.drift / 12 * (m * m); // crypto amplifies cycle
      const shock = U.gauss(0, meta.beta * 0.06);
      s.price = Math.max(0.0001, s.price * (1 + monthlyDrift + shock));
      s.hist.push(s.price);
      if (s.hist.length > 60) s.hist.shift();
    });
  }

  function buyStock(ticker, amount, isCrypto = false) {
    const list = isCrypto ? G.market.crypto : G.market.stocks;
    const s = list.find(x => x.ticker === ticker);
    if (!s || amount <= 0 || amount > G.cash) return false;
    const units = amount / s.price;
    const book = isCrypto ? G.cryptoWallet : G.portfolio;
    const h = book[ticker] || { shares: 0, avgCost: 0 };
    h.avgCost = (h.avgCost * h.shares + amount) / (h.shares + units);
    h.shares += units;
    book[ticker] = h;
    G.cash -= amount;
    G.totals.spent += amount;
    State.log('🛒', `Bought ${U.money(amount, G.currency)} of ${ticker} @ ${U.moneyFull(s.price, G.currency)}.`, 'market');
    return true;
  }

  function sellStock(ticker, fraction, isCrypto = false) {
    const list = isCrypto ? G.market.crypto : G.market.stocks;
    const book = isCrypto ? G.cryptoWallet : G.portfolio;
    const s = list.find(x => x.ticker === ticker);
    const h = book[ticker];
    if (!s || !h || h.shares <= 0) return false;
    const units = h.shares * fraction;
    const proceeds = units * s.price;
    const gain = proceeds - units * h.avgCost;
    const tax = gain > 0 ? gain * 0.15 : 0;
    h.shares -= units;
    if (h.shares < 1e-9) delete book[ticker];
    G.cash += proceeds - tax;
    G.totals.taxesPaid += tax;
    State.log('💸', `Sold ${ticker} for ${U.money(proceeds, G.currency)} (${gain >= 0 ? 'gain' : 'loss'} ${U.money(gain, G.currency)}).`, 'market');
    return true;
  }

  function portfolioValue() {
    let v = 0;
    for (const [t, h] of Object.entries(G.portfolio)) {
      const s = G.market.stocks.find(x => x.ticker === t);
      if (s) v += h.shares * s.price;
    }
    for (const [t, h] of Object.entries(G.cryptoWallet)) {
      const s = G.market.crypto.find(x => x.ticker === t);
      if (s) v += h.shares * s.price;
    }
    return v;
  }

  /* ---------- Rental real estate ---------- */
  const PROPERTY_TYPES = [
    { id: 'studio', name: 'Studio Rental', emoji: '🚪', price: 140000, rentYield: 0.075 },
    { id: 'duplex', name: 'Duplex', emoji: '🏠', price: 380000, rentYield: 0.07 },
    { id: 'block', name: 'Apartment Block', emoji: '🏬', price: 2200000, rentYield: 0.065 },
    { id: 'tower', name: 'Office Tower', emoji: '🏢', price: 18000000, rentYield: 0.06 },
  ];

  function buyProperty(typeId) {
    const t = PROPERTY_TYPES.find(p => p.id === typeId);
    if (!t || G.cash < t.price) return false;
    G.cash -= t.price;
    G.totals.spent += t.price;
    G.realEstate.push({ uid: U.uid(), typeId, boughtFor: t.price, value: t.price, occupied: true, monthsOwned: 0 });
    State.log('🔑', `Purchased a ${t.name} for ${U.money(t.price, G.currency)}.`, 'money');
    return true;
  }

  function sellProperty(uid) {
    const i = G.realEstate.findIndex(p => p.uid === uid);
    if (i < 0) return false;
    const p = G.realEstate[i];
    const t = PROPERTY_TYPES.find(x => x.id === p.typeId);
    const proceeds = p.value * 0.94; // closing costs
    G.cash += proceeds;
    G.realEstate.splice(i, 1);
    State.log('🔑', `Sold ${t.name} for ${U.money(proceeds, G.currency)}.`, 'money');
    return true;
  }

  function stepRealEstate() {
    const m = macroMult();
    G.realEstate.forEach(p => {
      const t = PROPERTY_TYPES.find(x => x.id === p.typeId);
      p.monthsOwned++;
      p.value *= 1 + (0.035 / 12) * m + U.gauss(0, 0.008);
      // occupancy churn
      if (p.occupied && U.chance(0.03)) { p.occupied = false; State.log('📭', `Your ${t.name} lost its tenant.`, 'money'); }
      else if (!p.occupied && U.chance(0.45)) { p.occupied = true; }
      if (p.occupied) {
        const rent = (p.value * t.rentYield) / 12;
        const upkeep = p.value * 0.012 / 12;
        G.cash += rent - upkeep;
        G.totals.earned += rent;
      } else {
        G.cash -= p.value * 0.012 / 12;
      }
    });
  }

  /* ---------- Loans ---------- */
  function takeLoan(amount) {
    // credit limit scales with net worth + income
    const limit = creditLimit();
    if (amount <= 0 || G.debt + amount > limit) return false;
    G.debt += amount;
    G.cash += amount;
    G.debtRate = U.clamp(G.market.econ.interest + 0.03 + (G.debt > limit * 0.7 ? 0.02 : 0), 0.04, 0.2);
    State.log('🏦', `Borrowed ${U.money(amount, G.currency)} at ${(G.debtRate * 100).toFixed(1)}% APR.`, 'money');
    return true;
  }
  function repayLoan(amount) {
    amount = Math.min(amount, G.debt, G.cash);
    if (amount <= 0) return false;
    G.debt -= amount;
    G.cash -= amount;
    State.log('✅', `Repaid ${U.money(amount, G.currency)} of debt.`, 'money');
    return true;
  }
  function creditLimit() {
    return Math.max(50000, netWorth() * 0.6 + 100000);
  }

  /* ---------- Net worth ---------- */
  function netWorth() {
    let nw = G.cash - G.debt;
    nw += portfolioValue();
    nw += G.realEstate.reduce((s, p) => s + p.value, 0);
    nw += G.businesses.reduce((s, b) => s + Business.valuation(b) * b.equity, 0);
    nw += G.assets.reduce((s, a) => s + assetValue(a), 0);
    return nw;
  }
  function assetValue(a) {
    const item = DATA.ASSETS[a.catId].find(x => x.id === a.id);
    if (!item) return 0;
    // homes appreciate, cars depreciate, luxury holds
    const yrs = a.age / 12;
    if (a.catId === 'homes') return a.boughtFor * Math.pow(1.03, yrs);
    if (a.catId === 'cars') return a.boughtFor * Math.pow(0.85, yrs);
    return a.boughtFor * Math.pow(1.01, yrs);
  }

  return {
    stepMacro, stepPrices, stepRealEstate, macroMult, phaseInfo,
    buyStock, sellStock, portfolioValue,
    PROPERTY_TYPES, buyProperty, sellProperty,
    takeLoan, repayLoan, creditLimit,
    netWorth, assetValue,
  };
})();
