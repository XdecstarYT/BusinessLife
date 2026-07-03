/* ============================================================
   BusinessLife — GAME STATE
   Central mutable state + save/load. All systems read/write G.
   ============================================================ */
window.G = null;

window.State = (function () {
  const SAVE_KEY = 'businesslife_save_v1';

  function newCharacter(opts) {
    const country = DATA.COUNTRIES.find(c => c.id === opts.country) || DATA.COUNTRIES[0];
    const mul = country.startMul;
    return {
      version: 1,
      seedYear: 2026,
      // --- identity ---
      name: opts.name,
      gender: opts.gender,
      country: country.id,
      currency: country.currency,
      age: 18,
      month: 0,               // months elapsed within current age-year (0..11)
      alive: true,
      retired: false,
      gameOver: null,          // {reason, summary} when over
      difficulty: opts.difficulty, // 'bootstrap' | 'loan' | 'trustfund'
      // --- core vitals (0..100) ---
      health: 90,
      happiness: U.randInt(60, 75),
      energy: 85,
      reputation: 10,          // public/business reputation (0..100)
      stress: 15,
      // --- skills (0..100) ---
      skills: {
        leadership: U.randInt(3, 12),
        marketing: U.randInt(3, 12),
        finance: U.randInt(3, 12),
        negotiation: U.randInt(3, 12),
        tech: U.randInt(3, 12),
        operations: U.randInt(3, 12),
        intelligence: U.randInt(20, 55),
      },
      // --- finances ---
      cash: Math.round((opts.difficulty === 'trustfund' ? 500000 : opts.difficulty === 'loan' ? 100000 : 5000) * mul),
      debt: opts.difficulty === 'loan' ? Math.round(100000 * mul) : 0,
      debtRate: 0.08,
      monthlyBurn: Math.round(1400 * country.col), // personal cost of living
      // --- education & career ---
      education: ['hs'],       // completed education ids
      studying: null,          // {id, monthsLeft}
      job: null,               // job id
      jobMonths: 0,
      jobPerformance: 50,
      // --- entrepreneurship ---
      businesses: [],          // Business objects (see business.js)
      soldBusinesses: [],      // {name, industry, price, age}
      // --- investments ---
      portfolio: {},           // ticker -> {shares, avgCost}
      cryptoWallet: {},        // ticker -> {units, avgCost}
      realEstate: [],          // owned rental properties
      // --- personal assets ---
      assets: [],              // {catId, id, boughtFor, age}
      // --- relationships ---
      partner: null,           // {name, quality, months}
      children: [],            // {name, age}
      mentor: null,            // {name, skill, monthsLeft}
      rivals: [],              // {name, company, heat}
      // --- market snapshot (prices evolve monthly) ---
      market: {
        stocks: DATA.STOCKS.map(s => ({ ticker: s.ticker, price: s.price, hist: [s.price] })),
        crypto: DATA.CRYPTO.map(s => ({ ticker: s.ticker, price: s.price, hist: [s.price] })),
        econ: { phase: 'expansion', phaseMonths: 0, interest: 0.05, sentiment: 0.6 },
      },
      // --- meta ---
      log: [],                 // life log [{age, month, emoji, text, kind}]
      achievements: [],
      totals: { earned: 0, spent: 0, taxesPaid: 0, businessesFounded: 0, exits: 0 },
      pendingEvents: [],       // queued decision events
      lastNetWorth: 0,
      netWorthHist: [],
      fame: 0,                 // 0..100 — grows with wealth/reputation
    };
  }

  function log(emoji, text, kind = 'info') {
    G.log.unshift({ age: G.age, month: G.month, emoji, text, kind });
    if (G.log.length > 400) G.log.length = 400;
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* storage full/blocked */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const g = JSON.parse(raw);
      if (!g || g.version !== 1) return null;
      return g;
    } catch (e) { return null; }
  }
  function wipe() { localStorage.removeItem(SAVE_KEY); }

  function start(opts) {
    window.G = newCharacter(opts);
    log('👶', `${G.name} turns 18 in ${DATA.COUNTRIES.find(c => c.id === G.country).name}. The empire starts here.`, 'milestone');
    if (G.difficulty === 'loan') log('🏦', `Took a ${U.money(G.debt, G.currency)} startup loan at 8% APR. Clock's ticking.`, 'money');
    if (G.difficulty === 'trustfund') log('💼', `Trust fund unlocked: ${U.money(G.cash, G.currency)}. Don't waste it.`, 'money');
    save();
  }

  function resume(g) { window.G = g; }

  return { start, resume, save, load, wipe, log, SAVE_KEY };
})();
