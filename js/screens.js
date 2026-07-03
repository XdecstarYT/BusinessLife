/* ============================================================
   BusinessLife — SCREENS
   All five tabs + intro + game over. Pure DOM string building
   with delegated handlers.
   ============================================================ */
window.Screens = (function () {
  const $ = (root, sel) => root.querySelector(sel);
  const $$ = (root, sel) => [...root.querySelectorAll(sel)];
  const cur = () => G.currency;
  const M = (v) => U.money(v, cur());
  const MF = (v) => U.moneyFull(v, cur());

  /* ============================================================
     INTRO / CHARACTER CREATION
     ============================================================ */
  function renderIntro(s) {
    const saved = State.load();
    s.innerHTML = `
      <div class="page-head" style="margin-top:40px">
        <div>
          <div style="color:var(--amber);font-size:26px;margin-bottom:4px">◗</div>
          <div class="page-title">Business<span class="dim">Life</span></div>
          <p class="muted" style="margin-top:10px;font-size:15px;line-height:1.5">Build an empire from nothing.<br>Every month is a decision.</p>
        </div>
      </div>
      ${saved ? `
      <div class="banner purple" id="resumeBtn" style="cursor:pointer">
        <div class="b-bar"></div>
        <div class="b-tx"><small>Saved Game</small><b>Continue as ${U.esc(saved.name)}, ${saved.age}</b></div>
        <div class="b-arrow">›</div>
      </div>` : ''}
      <div class="section-label">New Life</div>
      <div class="card">
        <div class="field"><label>Your Name</label><input id="cName" maxlength="24" placeholder="e.g. Alex Sterling" value="" /></div>
        <div class="field"><label>Gender</label>
          <div class="seg" id="cGender">
            <button data-v="m" class="on">Male</button><button data-v="f">Female</button><button data-v="x">Other</button>
          </div>
        </div>
        <div class="field"><label>Starting Country</label>
          <select id="cCountry">${DATA.COUNTRIES.map(c => `<option value="${c.id}">${c.flag} ${c.name} (tax ${(c.tax * 100).toFixed(0)}%)</option>`).join('')}</select>
        </div>
        <div class="field"><label>Origin Story</label>
          <div class="seg" id="cDiff" style="flex-direction:column">
            <button data-v="bootstrap" class="on" style="text-align:left">💪 Bootstrapper — start with pocket change ($5K)</button>
            <button data-v="loan" style="text-align:left">🏦 Loan Taker — $100K cash, $100K debt at 8%</button>
            <button data-v="trustfund" style="text-align:left">💼 Trust Fund — $500K, zero hunger</button>
          </div>
        </div>
        <button class="btn primary mt" id="cStart">Begin Your Life ›</button>
      </div>
      <p class="center-txt tiny muted" style="margin-top:16px">Age one month at a time · random events · markets · rivals<br>Your choices compound.</p>
    `;
    let gender = 'm', diff = 'bootstrap';
    $$(s, '#cGender button').forEach(b => b.onclick = () => { $$(s, '#cGender button').forEach(x => x.classList.remove('on')); b.classList.add('on'); gender = b.dataset.v; });
    $$(s, '#cDiff button').forEach(b => b.onclick = () => { $$(s, '#cDiff button').forEach(x => x.classList.remove('on')); b.classList.add('on'); diff = b.dataset.v; });
    if (saved) $(s, '#resumeBtn').onclick = () => { State.resume(saved); UI.render(); };
    $(s, '#cStart').onclick = () => {
      let name = $(s, '#cName').value.trim();
      if (!name) name = U.pick(gender === 'f' ? DATA.FIRST_F : DATA.FIRST_M) + ' ' + U.pick(DATA.LAST);
      State.start({ name, gender, country: $(s, '#cCountry').value, difficulty: diff });
      UI.render();
    };
  }

  /* ============================================================
     SHARED: timeline strip + advance controls
     ============================================================ */
  function timelineHTML() {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    let cells = '';
    for (let i = -2; i <= 2; i++) {
      let m = G.month + i, age = G.age;
      while (m < 0) { m += 12; age--; }
      while (m >= 12) { m -= 12; age++; }
      const active = i === 0;
      if (age < 18) { cells += `<div class="tl-cell"><div class="tl-lab">—</div><div class="tl-orb"></div><div class="tl-num muted">·</div></div>`; continue; }
      cells += `<div class="tl-cell ${active ? 'active' : ''}">
        <div class="tl-star">${active ? '✦' : '&nbsp;'}</div>
        <div class="tl-lab">${months[m]}</div>
        <div class="tl-orb"></div>
        <div class="tl-num">${age}</div>
      </div>`;
    }
    return `<div class="timeline">${cells}
      <div class="tl-cell cta" id="tlAdvance"><div class="big">▶</div><div class="tl-lab" style="margin-top:4px">MONTH</div></div>
      <div class="tl-cell cta" id="tlYear"><div class="big">⏩</div><div class="tl-lab" style="margin-top:4px">YEAR</div></div>
    </div>`;
  }
  function bindTimeline(s) {
    const a = $(s, '#tlAdvance'), y = $(s, '#tlYear');
    if (a) a.onclick = () => Engine.advance(1);
    if (y) y.onclick = () => Engine.advance(12);
  }

  /* ============================================================
     HOME (Empire dashboard)
     ============================================================ */
  function renderHome(s) {
    const nw = Economy.netWorth();
    const phase = Economy.phaseInfo();
    const bizIncome = G.businesses.reduce((sum, b) => sum + (b.history.slice(-1)[0] || 0) * b.equity, 0);
    const first = G.name.split(' ')[0];
    const focus = homeFocusLine(nw);

    s.innerHTML = `
      <div class="page-head">
        <div>
          <div style="color:var(--amber);font-size:20px;line-height:1">◗</div>
          <div class="page-title">${U.esc(first)} <span class="dim">${G.age}</span></div>
        </div>
      </div>
      ${timelineHTML()}
      <div class="qa-row">
        <button class="qa" id="qaBank">
          <span class="qa-ic">💵</span>
          <span class="qa-tx"><small>Cash</small><b>${M(G.cash)}</b></span>
        </button>
        <button class="qa" id="qaNW">
          <span class="qa-ic">📊</span>
          <span class="qa-tx"><small>Net Worth</small><b>${M(nw)}</b></span>
        </button>
      </div>
      <div class="banner purple mt" id="bnEcon" style="cursor:pointer">
        <div class="b-bar"></div>
        <div class="b-tx"><small>Economy · ${phase.label}</small><b>${econHeadline()}</b></div>
        <div class="b-emoji">${phase.emoji}</div>
        <div class="b-arrow">›</div>
      </div>
      <div class="hero mt" id="heroCard" style="cursor:pointer">
        <div class="hero-bg" style="background:${heroGradient(nw)}"></div>
        <div>
          <div class="h-kicker">Based on your empire</div>
          <div class="h-title">Monthly Report</div>
        </div>
        <div>
          <div class="h-focus">Focus on</div>
          <div class="h-big">${focus}</div>
          <div class="mt" style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="pill ${bizIncome >= 0 ? 'g' : 'r'}">${bizIncome >= 0 ? '▲' : '▼'} ${M(Math.abs(bizIncome))}/mo business</span>
            ${G.job ? `<span class="pill b">💼 ${U.esc(DATA.JOBS.find(j => j.id === G.job).title)}</span>` : ''}
            ${G.debt > 0 ? `<span class="pill r">🏦 ${M(G.debt)} debt</span>` : ''}
          </div>
        </div>
      </div>
      <div class="section-label">Vitals</div>
      <div class="card">
        ${UI.statBar('❤️ Health', G.health, G.health > 50 ? 'g' : 'r')}
        ${UI.statBar('😊 Happiness', G.happiness, '')}
        ${UI.statBar('⚡ Energy', G.energy, 'b')}
        ${UI.statBar('🔥 Stress', G.stress, G.stress > 60 ? 'r' : 'p')}
        ${UI.statBar('⭐ Reputation', G.reputation, '')}
      </div>
      <div class="section-label">Life Log</div>
      <div class="card logfeed">
        ${G.log.slice(0, 14).map(l => `
          <div class="logline"><span class="lg-em">${l.emoji}</span>
            <span class="lg-tx">${U.esc(l.text)}<small>AGE ${l.age} · MONTH ${l.month + 1}</small></span>
          </div>`).join('') || '<div class="empty">Your story begins…</div>'}
      </div>
    `;
    bindTimeline(s);
    $(s, '#qaBank').onclick = () => openBankSheet();
    $(s, '#qaNW').onclick = () => openNetWorthSheet();
    $(s, '#bnEcon').onclick = () => openEconSheet();
    $(s, '#heroCard').onclick = () => openNetWorthSheet();
  }

  function homeFocusLine(nw) {
    if (G.cash < 0) return 'You are bleeding cash. Stop the leak before it sinks you';
    if (G.stress > 70) return 'Your stress is dangerous. Protecting your peace is the most productive move this month';
    if (G.health < 40) return 'No empire matters if you\'re in a hospital bed. See a doctor';
    if (!G.businesses.length && G.cash < 20000) return 'Build capital first — a job or the markets. Then strike';
    if (!G.businesses.length) return 'You have capital and no company. Time to found something';
    const b = G.businesses[0];
    if (b.morale < 40) return `Morale at ${b.name} is cracking. Your people need you`;
    if (b.cash < 0) return `${b.name} is burning cash. Cut costs or raise money`;
    if (nw > 1e9) return 'You\'ve won the game of money. Now play for legacy';
    return 'Compound quietly. Expand, reinvest, and let time work';
  }
  function heroGradient(nw) {
    if (nw < 0) return 'linear-gradient(160deg,#3d1a1a,#1a0d0d)';
    if (nw < 1e6) return 'linear-gradient(160deg,#241d3d 0%,#151022 70%)';
    if (nw < 1e8) return 'linear-gradient(160deg,#1c3d33 0%,#0d1a16 70%)';
    return 'linear-gradient(160deg,#3d3418 0%,#1a160a 70%)';
  }
  function econHeadline() {
    const e = G.market.econ;
    return { expansion: 'Steady growth, fair winds', boom: 'Markets are euphoric', recession: 'Belt-tightening everywhere', recovery: 'Green shoots appearing' }[e.phase];
  }

  /* ---------- bank sheet ---------- */
  function openBankSheet() {
    const limit = Economy.creditLimit();
    const body = UI.modal(`
      <h2>🏦 Personal Bank</h2>
      <p class="sub">Cash ${MF(G.cash)} · Debt ${MF(G.debt)} at ${(G.debtRate * 100).toFixed(1)}% APR<br>Credit limit: ${M(limit)}</p>
      <div class="field"><label>Amount</label><input id="bkAmt" type="number" min="0" placeholder="10000" /></div>
      <div class="btn-row">
        <button class="btn green" id="bkBorrow">Borrow</button>
        <button class="btn" id="bkRepay">Repay Debt</button>
      </div>
      <div class="divider"></div>
      <p class="tiny muted">Monthly burn: ${MF(G.monthlyBurn)} living costs${G.children.length ? ` + ${MF(G.children.length * 900)} kids` : ''}${G.partner ? ' + partner expenses' : ''}. Interest accrues monthly.</p>
    `);
    $(body, '#bkBorrow').onclick = () => {
      const amt = +$(body, '#bkAmt').value || 0;
      if (Economy.takeLoan(amt)) { UI.toast('🏦', `Borrowed ${M(amt)}`); UI.closeModal(); UI.render(); }
      else UI.toast('❌', 'Exceeds your credit limit', 'bad');
    };
    $(body, '#bkRepay').onclick = () => {
      const amt = +$(body, '#bkAmt').value || 0;
      if (Economy.repayLoan(amt)) { UI.toast('✅', 'Debt repaid'); UI.closeModal(); UI.render(); }
      else UI.toast('❌', 'Nothing to repay with that amount', 'bad');
    };
  }

  /* ---------- net worth sheet ---------- */
  function openNetWorthSheet() {
    const bizV = G.businesses.reduce((s, b) => s + Business.valuation(b) * b.equity, 0);
    const port = Economy.portfolioValue();
    const re = G.realEstate.reduce((s, p) => s + p.value, 0);
    const assets = G.assets.reduce((s, a) => s + Economy.assetValue(a), 0);
    UI.modal(`
      <h2>📊 Net Worth Breakdown</h2>
      <p class="sub">Total: <b class="${Economy.netWorth() >= 0 ? 'pos' : 'neg'}">${MF(Economy.netWorth())}</b></p>
      <div class="card tight">
        <div class="lrow"><div class="l-ic">💵</div><div class="l-tx"><b>Cash</b></div><div class="l-end">${M(G.cash)}</div></div>
        <div class="lrow"><div class="l-ic">🏢</div><div class="l-tx"><b>Business equity</b><small>${G.businesses.length} compan${G.businesses.length === 1 ? 'y' : 'ies'}</small></div><div class="l-end">${M(bizV)}</div></div>
        <div class="lrow"><div class="l-ic">📈</div><div class="l-tx"><b>Investments</b></div><div class="l-end">${M(port)}</div></div>
        <div class="lrow"><div class="l-ic">🏠</div><div class="l-tx"><b>Real estate</b><small>${G.realEstate.length} propert${G.realEstate.length === 1 ? 'y' : 'ies'}</small></div><div class="l-end">${M(re)}</div></div>
        <div class="lrow"><div class="l-ic">💎</div><div class="l-tx"><b>Personal assets</b></div><div class="l-end">${M(assets)}</div></div>
        <div class="lrow"><div class="l-ic">🏦</div><div class="l-tx"><b>Debt</b></div><div class="l-end neg">-${M(G.debt)}</div></div>
      </div>
      <div class="mt">${UI.sparkline(G.netWorthHist)}</div>
      <p class="tiny muted center-txt mt">Net worth over the last ${Math.min(G.netWorthHist.length, 18)} months</p>
    `);
  }

  /* ---------- economy sheet ---------- */
  function openEconSheet() {
    const e = G.market.econ;
    const p = Economy.phaseInfo();
    UI.modal(`
      <h2>${p.emoji} The Economy</h2>
      <p class="sub">Cycle phase: <b>${p.label}</b> (${e.phaseMonths} months in)</p>
      <div class="grid2">
        <div class="stat-chip"><div class="s-val">${(e.interest * 100).toFixed(1)}%</div><div class="s-lab">Interest Rate</div></div>
        <div class="stat-chip"><div class="s-val">${Math.round(e.sentiment * 100)}</div><div class="s-lab">Sentiment</div></div>
      </div>
      <p class="sub mt">${{
        expansion: 'Business as usual. Revenue growth is steady and capital is reasonably priced.',
        boom: 'Valuations are inflated and everything sells. Great time to raise money or exit — booms never last.',
        recession: 'Demand is crushed and credit is tight. Cut burn, keep cash, and buy assets cheap if you can.',
        recovery: 'The worst is over. Position early for the next expansion.',
      }[e.phase]}</p>
    `);
  }

  /* ============================================================
     VENTURES (businesses)
     ============================================================ */
  function renderVentures(s) {
    s.innerHTML = `
      <div class="page-head"><div class="page-title">Ventures<span class="ac">.</span></div></div>
      ${timelineHTML()}
      ${G.businesses.length === 0 ? `
        <div class="empty card">
          <div class="e-em">🏗️</div>
          <b>No companies yet</b>
          You're one bold decision away from your first venture.
        </div>` : ''}
      <div id="bizList"></div>
      <button class="btn primary mt2" id="foundBtn">＋ Found a New Business</button>
      ${G.soldBusinesses.length ? `
        <div class="section-label">Exits</div>
        <div class="card tight">
          ${G.soldBusinesses.map(sb => {
            const ind = DATA.INDUSTRIES.find(i => i.id === sb.industryId);
            return `<div class="lrow"><div class="l-ic">${ind.emoji}</div>
              <div class="l-tx"><b>${U.esc(sb.name)}</b><small>Founded ${sb.founded} · sold at ${sb.ageAtSale}</small></div>
              <div class="l-end pos">${M(sb.price)}</div></div>`;
          }).join('')}
        </div>` : ''}
    `;
    bindTimeline(s);
    const list = $(s, '#bizList');
    G.businesses.forEach(b => {
      const ind = DATA.INDUSTRIES.find(i => i.id === b.industryId);
      const profit = b.history.slice(-1)[0] || 0;
      const card = U.el(`
        <div class="card mt" style="cursor:pointer">
          <div class="flex-between">
            <div style="display:flex;gap:12px;align-items:center">
              <div class="l-ic" style="font-size:24px;width:50px;height:50px">${ind.emoji}</div>
              <div><b style="font-size:17px">${U.esc(b.name)}</b>
                <div class="tiny muted">${ind.name} · Lv${b.level} · ${b.employees.length} staff · ${(b.equity * 100).toFixed(0)}% yours</div>
              </div>
            </div>
            ${b.public ? '<span class="tag" style="color:var(--amber)">PUBLIC</span>' : ''}
          </div>
          <div class="grid3 mt">
            <div class="stat-chip" style="padding:10px"><div class="s-val" style="font-size:16px">${M(b.revenue)}</div><div class="s-lab">Rev/mo</div></div>
            <div class="stat-chip" style="padding:10px"><div class="s-val ${profit >= 0 ? 'pos' : 'neg'}" style="font-size:16px">${M(profit)}</div><div class="s-lab">Profit/mo</div></div>
            <div class="stat-chip" style="padding:10px"><div class="s-val" style="font-size:16px">${M(Business.valuation(b))}</div><div class="s-lab">Valuation</div></div>
          </div>
          ${b.crisis ? `<div class="pill r mt">⚠️ ${b.crisis.label} (${b.crisis.monthsLeft}mo left)</div>` : ''}
          <div class="mt">${UI.sparkline(b.revHistory)}</div>
        </div>`);
      card.onclick = () => openBizSheet(b.uid);
      list.appendChild(card);
    });
    $(s, '#foundBtn').onclick = openFoundSheet;
  }

  /* ---------- found a business ---------- */
  function openFoundSheet() {
    const body = UI.modal(`
      <h2>🚀 Found a Business</h2>
      <p class="sub">Pick an industry. Recommended capital gets you a healthy start — underfund at your peril. Cash: <b>${M(G.cash)}</b></p>
      <div id="indList"></div>
    `);
    const list = $(body, '#indList');
    DATA.INDUSTRIES.forEach(ind => {
      const afford = G.cash >= ind.capital * 0.4;
      const row = U.el(`
        <button class="opt" ${afford ? '' : 'disabled style="opacity:.4"'}>
          <span class="o-ic">${ind.emoji}</span>
          <span class="o-tx"><b>${ind.name}</b><small>${ind.desc}</small>
            <small style="color:var(--amber2)">Needs ~${M(ind.capital)} · margin ${(ind.margin * 100).toFixed(0)}% · ${ind.keySkill} driven</small></span>
        </button>`);
      if (afford) row.onclick = () => configureFounding(ind);
      list.appendChild(row);
    });
  }
  function configureFounding(ind) {
    const maxInv = Math.floor(G.cash);
    const rec = Math.min(ind.capital, maxInv);
    const body = UI.modal(`
      <h2>${ind.emoji} ${ind.name}</h2>
      <p class="sub">${ind.desc}</p>
      <div class="field"><label>Company Name</label><input id="fName" maxlength="28" placeholder="${suggestName(ind)}" /></div>
      <div class="field"><label>Initial Investment — <span id="fAmtLab">${M(rec)}</span></label>
        <input class="range" type="range" id="fAmt" min="${Math.min(5000, maxInv)}" max="${maxInv}" value="${rec}" step="1000" />
        <p class="tiny muted">Recommended: ${M(ind.capital)}. Less = weaker start; more = bigger launch.</p>
      </div>
      <button class="btn primary" id="fGo">Incorporate 🖋️</button>
    `);
    const slider = $(body, '#fAmt');
    slider.oninput = () => { $(body, '#fAmtLab').textContent = M(+slider.value); };
    $(body, '#fGo').onclick = () => {
      const name = $(body, '#fName').value.trim() || suggestName(ind);
      Business.found(ind.id, name, +slider.value);
      UI.closeModal(); UI.render();
      UI.toast('🚀', `${name} is live!`, 'good');
    };
  }
  function suggestName(ind) {
    const pre = ['Nova', 'Apex', 'Ember', 'Bold', 'True', 'Prime', 'Luna', 'Iron', 'Swift', 'Golden'];
    const suf = { coffee: 'Brew Co.', restaurant: 'Kitchen', ecommerce: 'Goods', saas: 'Labs', app: 'App', agency: 'Media', realestate: 'Properties', fashion: 'Atelier', fintech: 'Pay', manufacturing: 'Works', gaming: 'Games', biotech: 'Bio', logistics: 'Freight', crypto: 'Exchange', fitness: 'Fit', media: 'Studios' };
    return U.pick(pre) + ' ' + (suf[ind.id] || 'Ventures');
  }

  /* ---------- business management sheet ---------- */
  function openBizSheet(uid) {
    const b = G.businesses.find(x => x.uid === uid);
    if (!b) return;
    const ind = DATA.INDUSTRIES.find(i => i.id === b.industryId);
    const val = Business.valuation(b);
    const profit = b.history.slice(-1)[0] || 0;
    const body = UI.modal(`
      <div class="flex-between">
        <h2>${ind.emoji} ${U.esc(b.name)}</h2>
        ${b.public ? '<span class="tag" style="color:var(--amber)">PUBLIC</span>' : ''}
      </div>
      <p class="sub">${ind.name} · Level ${b.level} · Founded at age ${b.foundedAge} · You own <b>${(b.equity * 100).toFixed(1)}%</b></p>
      <div class="grid3">
        <div class="stat-chip"><div class="s-val" style="font-size:15px">${M(b.revenue)}</div><div class="s-lab">Revenue/mo</div></div>
        <div class="stat-chip"><div class="s-val ${profit >= 0 ? 'pos' : 'neg'}" style="font-size:15px">${M(profit)}</div><div class="s-lab">Profit/mo</div></div>
        <div class="stat-chip"><div class="s-val" style="font-size:15px">${M(val)}</div><div class="s-lab">Valuation</div></div>
      </div>
      <div class="grid3 mt">
        <div class="stat-chip"><div class="s-val" style="font-size:15px">${M(b.cash)}</div><div class="s-lab">Co. Cash</div></div>
        <div class="stat-chip"><div class="s-val" style="font-size:15px">${Math.round(b.brand)}</div><div class="s-lab">Brand</div></div>
        <div class="stat-chip"><div class="s-val" style="font-size:15px">${Math.round(b.quality)}</div><div class="s-lab">Quality</div></div>
      </div>
      <div class="card tight mt">${UI.statBar('👥 Team morale', b.morale, b.morale > 50 ? 'g' : 'r')}${UI.statBar('⚙️ Efficiency', b.efficiency, 'b')}</div>

      <div class="section-label">Budgets (monthly)</div>
      <div class="card tight">
        <div class="field"><label>Marketing — <span id="mkLab">${M(b.marketingBudget)}</span></label>
          <input class="range" type="range" id="mkBud" min="0" max="${Math.max(10000, Math.round(b.revenue * 1.2))}" step="500" value="${b.marketingBudget}" /></div>
        <div class="field"><label>R&D — <span id="rdLab">${M(b.rdBudget)}</span></label>
          <input class="range" type="range" id="rdBud" min="0" max="${Math.max(10000, Math.round(b.revenue * 1.2))}" step="500" value="${b.rdBudget}" /></div>
        <div class="field" style="margin-bottom:4px"><label>Dividend payout — <span id="dvLab">${Math.round((b.dividendPolicy || 0) * 100)}% of profit</span></label>
          <input class="range" type="range" id="dvPol" min="0" max="100" step="5" value="${Math.round((b.dividendPolicy || 0) * 100)}" />
          <p class="tiny muted">Your ${(b.equity * 100).toFixed(0)}% share of payouts hits your pocket (15% tax). Lower it to reinvest.</p></div>
      </div>
      <div class="section-label">Pricing Strategy</div>
      <div class="seg" id="priceSeg">
        <button data-v="budget" class="${b.pricing === 'budget' ? 'on' : ''}">💸 Budget</button>
        <button data-v="standard" class="${b.pricing === 'standard' ? 'on' : ''}">⚖️ Standard</button>
        <button data-v="premium" class="${b.pricing === 'premium' ? 'on' : ''}">👑 Premium</button>
      </div>

      <div class="section-label">Team (${b.employees.length})</div>
      <div class="card tight" id="teamList">
        ${b.employees.map(e => {
          const r = DATA.ROLES.find(x => x.id === e.roleId);
          return `<div class="lrow"><div class="l-ic">🧑‍💼</div>
            <div class="l-tx"><b>${U.esc(e.name)}</b><small>${r.title} · skill ${Math.round(e.skill)} · ${M(e.salary)}/yr</small></div>
            <button class="btn sm red" data-fire="${e.uid}">Fire</button></div>`;
        }).join('') || '<p class="tiny muted center-txt" style="padding:8px">No employees — you\'re a one-person show.</p>'}
      </div>
      <button class="btn mt" id="hireBtn">🤝 Hire Talent</button>

      <div class="section-label">Growth Moves</div>
      <div class="btn-row"><button class="btn" id="expandBtn">🏗️ Expand — ${M(Business.expandCost(b))}</button></div>
      <div class="btn-row mt">
        <button class="btn purple" id="raiseBtn" ${b.public ? 'disabled' : ''}>💰 Raise ${Business.nextRound(b)}</button>
        <button class="btn" id="acqBtn">🎯 Acquire Rival</button>
      </div>
      <div class="btn-row mt">
        <button class="btn ${Business.canIPO(b) ? 'primary' : 'ghost'}" id="ipoBtn" ${Business.canIPO(b) || b.public ? '' : 'disabled'}>${b.public ? '📊 Already Public' : '🔔 Go Public (IPO)'}</button>
        <button class="btn green" id="sellBtn">🏷️ Sell Company</button>
      </div>
      <button class="btn ghost mt" id="closeBiz">Close</button>
    `);

    /* budgets */
    $(body, '#mkBud').oninput = (e) => { b.marketingBudget = +e.target.value; $(body, '#mkLab').textContent = M(b.marketingBudget); State.save(); };
    $(body, '#rdBud').oninput = (e) => { b.rdBudget = +e.target.value; $(body, '#rdLab').textContent = M(b.rdBudget); State.save(); };
    $(body, '#dvPol').oninput = (e) => { b.dividendPolicy = +e.target.value / 100; $(body, '#dvLab').textContent = e.target.value + '% of profit'; State.save(); };
    /* pricing */
    $$(body, '#priceSeg button').forEach(btn => btn.onclick = () => {
      $$(body, '#priceSeg button').forEach(x => x.classList.remove('on'));
      btn.classList.add('on'); b.pricing = btn.dataset.v; State.save();
    });
    /* fire */
    $$(body, '[data-fire]').forEach(btn => btn.onclick = () => {
      Business.fire(b, btn.dataset.fire);
      UI.closeModal(); openBizSheet(uid);
    });
    /* hire */
    $(body, '#hireBtn').onclick = () => {
      const hb = UI.modal(`<h2>🤝 Hire for ${U.esc(b.name)}</h2><p class="sub">Company cash: ${M(b.cash)}. Salaries paid monthly from company account.</p><div id="roleList"></div>`);
      DATA.ROLES.forEach(r => {
        const row = U.el(`<button class="opt"><span class="o-ic">🧑‍💼</span>
          <span class="o-tx"><b>${r.title}</b><small>${Object.entries(r.boosts).map(([k, v]) => `${k} +${typeof v === 'number' && v < 2 ? Math.round(v * 100) + '%' : v}`).join(' · ')}</small></span>
          <span class="o-end">~${M(r.salary)}/yr</span></button>`);
        row.onclick = () => { Business.hire(b, r.id); UI.closeModal(); openBizSheet(uid); };
        $(hb, '#roleList').appendChild(row);
      });
    };
    /* expand */
    $(body, '#expandBtn').onclick = () => {
      if (Business.expand(b)) { UI.toast('🏗️', `${b.name} expanded!`, 'good'); UI.closeModal(); openBizSheet(uid); }
      else UI.toast('❌', 'Company can\'t afford expansion', 'bad');
    };
    /* raise */
    $(body, '#raiseBtn').onclick = () => {
      const t = Business.raiseTerms(b);
      UI.confirm(`💰 ${t.round} Term Sheet`,
        `Investors offer ${M(t.amount)} at a ${M(t.preMoney)} pre-money valuation. You'd give up ${(t.equitySold * 100).toFixed(1)}% of the company (your stake: ${(b.equity * 100).toFixed(1)}% → ${(b.equity * (1 - t.equitySold) * 100).toFixed(1)}%).`,
        'Sign Term Sheet', () => { Business.acceptRaise(b, t); UI.render(); }, 'purple');
    };
    /* acquire */
    $(body, '#acqBtn').onclick = () => {
      const t = Business.acquisitionTarget(b);
      UI.confirm('🎯 Acquisition Target',
        `${t.name} is available for ${M(t.price)} (paid from company cash: ${M(b.cash)}). Their book would boost your revenue ~${Math.round(t.revBoost * 100)}%.`,
        'Buy Them', () => {
          if (Business.acquire(b, t)) { UI.toast('🤝', `Acquired ${t.name}!`, 'good'); UI.render(); }
          else UI.toast('❌', 'Not enough company cash', 'bad');
        });
    };
    /* IPO */
    $(body, '#ipoBtn').onclick = () => {
      if (b.public) return;
      UI.confirm('🔔 Initial Public Offering',
        `Take ${b.name} public? You'll sell 20% of your stake at a ~${M(Business.valuation(b))} valuation. Fame and fortune await — and quarterly scrutiny.`,
        'Ring the Bell', () => { if (Business.ipo(b)) { UI.closeModal(); UI.render(); } }, 'primary');
    };
    /* sell */
    $(body, '#sellBtn').onclick = () => {
      const offer = Business.saleOffer(b);
      UI.confirm('🏷️ Sell the Company',
        `Market check: a buyer would pay ~${M(offer)}. Your ${(b.equity * 100).toFixed(1)}% nets ${M(offer * b.equity * 0.8)} after 20% capital gains tax. This is final.`,
        'Sell It', () => { Business.sell(b, offer); UI.closeModal(); UI.render(); }, 'green');
    };
    $(body, '#closeBiz').onclick = UI.closeModal;
  }

  /* ============================================================
     MARKET (stocks, crypto, real estate)
     ============================================================ */
  function renderMarket(s) {
    const port = Economy.portfolioValue();
    s.innerHTML = `
      <div class="page-head"><div class="page-title">Market<span class="ac">s</span></div></div>
      ${timelineHTML()}
      <div class="qa-row">
        <div class="qa"><span class="qa-ic">📈</span><span class="qa-tx"><small>Portfolio</small><b>${M(port)}</b></span></div>
        <div class="qa"><span class="qa-ic">💵</span><span class="qa-tx"><small>Buying Power</small><b>${M(G.cash)}</b></span></div>
      </div>
      <div class="section-label">Stocks</div>
      <div class="card tight" id="stockList"></div>
      <div class="section-label">Crypto</div>
      <div class="card tight" id="cryptoList"></div>
      <div class="section-label">Rental Real Estate</div>
      <div class="card tight" id="reOwned">
        ${G.realEstate.map(p => {
          const t = Economy.PROPERTY_TYPES.find(x => x.id === p.typeId);
          const gain = (p.value - p.boughtFor) / p.boughtFor;
          return `<div class="lrow"><div class="l-ic">${t.emoji}</div>
            <div class="l-tx"><b>${t.name}</b><small>${p.occupied ? '🟢 Tenanted' : '🔴 Vacant'} · ${U.pct(gain)} value</small></div>
            <div style="text-align:right"><div class="l-end">${M(p.value)}</div>
            <button class="btn sm mt" data-sellre="${p.uid}" style="margin-top:6px">Sell</button></div></div>`;
        }).join('') || '<p class="tiny muted center-txt" style="padding:8px">No rental properties yet. Passive income awaits.</p>'}
      </div>
      <button class="btn mt" id="buyREBtn">🔑 Buy Property</button>
    `;
    bindTimeline(s);

    const mkRow = (list, holdings, isCrypto) => (sMkt) => {
      const meta = (isCrypto ? DATA.CRYPTO : DATA.STOCKS).find(d => d.ticker === sMkt.ticker);
      const h = holdings[sMkt.ticker];
      const prev = sMkt.hist.length > 1 ? sMkt.hist[sMkt.hist.length - 2] : sMkt.price;
      const chg = (sMkt.price - prev) / prev;
      const row = U.el(`<div class="lrow" style="cursor:pointer">
        <div class="l-ic" style="font-size:13px;font-weight:800">${sMkt.ticker}</div>
        <div class="l-tx"><b>${meta.name}</b><small>${h ? `${h.shares < 10 ? h.shares.toFixed(3) : Math.round(h.shares)} units · ${M(h.shares * sMkt.price)}` : 'Not held'}</small></div>
        <div style="text-align:right"><div class="l-end">${sMkt.price < 10 ? MF(sMkt.price) : M(sMkt.price)}</div>
          <span class="pill ${chg >= 0 ? 'g' : 'r'}" style="padding:2px 8px;font-size:11px">${U.pct(chg, 1)}</span></div>
      </div>`);
      row.onclick = () => openTradeSheet(sMkt.ticker, isCrypto);
      list.appendChild(row);
    };
    G.market.stocks.forEach(mkRow($(s, '#stockList'), G.portfolio, false));
    G.market.crypto.forEach(mkRow($(s, '#cryptoList'), G.cryptoWallet, true));

    $$(s, '[data-sellre]').forEach(btn => btn.onclick = (e) => {
      e.stopPropagation();
      Economy.sellProperty(btn.dataset.sellre);
      UI.render(); UI.toast('🔑', 'Property sold', 'good');
    });
    $(s, '#buyREBtn').onclick = () => {
      const body = UI.modal(`<h2>🔑 Buy Rental Property</h2><p class="sub">Cash: ${M(G.cash)}. Rentals pay monthly yield minus upkeep, appreciate with the cycle, and tenants churn.</p><div id="reList"></div>`);
      Economy.PROPERTY_TYPES.forEach(t => {
        const row = U.el(`<button class="opt" ${G.cash < t.price ? 'disabled style="opacity:.4"' : ''}>
          <span class="o-ic">${t.emoji}</span>
          <span class="o-tx"><b>${t.name}</b><small>~${(t.rentYield * 100).toFixed(1)}% gross yield</small></span>
          <span class="o-end">${M(t.price)}</span></button>`);
        if (G.cash >= t.price) row.onclick = () => { Economy.buyProperty(t.id); UI.closeModal(); UI.render(); UI.toast('🏠', `${t.name} acquired`, 'good'); };
        $(body, '#reList').appendChild(row);
      });
    };
  }

  function openTradeSheet(ticker, isCrypto) {
    const list = isCrypto ? G.market.crypto : G.market.stocks;
    const meta = (isCrypto ? DATA.CRYPTO : DATA.STOCKS).find(d => d.ticker === ticker);
    const sMkt = list.find(x => x.ticker === ticker);
    const book = isCrypto ? G.cryptoWallet : G.portfolio;
    const h = book[ticker];
    const body = UI.modal(`
      <h2>${ticker} · ${meta.name}</h2>
      <p class="sub">Price ${MF(sMkt.price)} · ${isCrypto ? 'Crypto (extreme volatility)' : meta.sector + ' sector'} ${h ? `<br>You hold ${M(h.shares * sMkt.price)} (avg cost ${MF(h.avgCost)})` : ''}</p>
      ${UI.sparkline(sMkt.hist)}
      <div class="field mt"><label>Buy Amount (${cur()})</label><input id="trAmt" type="number" min="0" placeholder="10000" /></div>
      <div class="btn-row">
        <button class="btn green" id="trBuy">Buy</button>
        ${h ? '<button class="btn" id="trHalf">Sell Half</button><button class="btn red" id="trAll">Sell All</button>' : ''}
      </div>
      <p class="tiny muted mt">15% capital gains tax applies on profitable sales.</p>
    `);
    $(body, '#trBuy').onclick = () => {
      const amt = +$(body, '#trAmt').value || 0;
      if (Economy.buyStock(ticker, amt, isCrypto)) { UI.closeModal(); UI.render(); UI.toast('🛒', `Bought ${M(amt)} of ${ticker}`, 'good'); }
      else UI.toast('❌', 'Invalid amount or insufficient cash', 'bad');
    };
    if (h) {
      $(body, '#trHalf').onclick = () => { Economy.sellStock(ticker, 0.5, isCrypto); UI.closeModal(); UI.render(); };
      $(body, '#trAll').onclick = () => { Economy.sellStock(ticker, 1, isCrypto); UI.closeModal(); UI.render(); };
    }
  }

  /* ============================================================
     LIFE (activities, education, job, relationships, shopping)
     ============================================================ */
  function renderLife(s) {
    const job = G.job ? DATA.JOBS.find(j => j.id === G.job) : null;
    s.innerHTML = `
      <div class="page-head"><div class="page-title">Life<span class="ac">.</span></div></div>
      ${timelineHTML()}

      <div class="banner amber" id="eduBanner" style="cursor:pointer">
        <div class="b-bar"></div>
        <div class="b-tx"><small>Education</small><b>${G.studying ? `Studying — ${G.studying.monthsLeft}mo left` : 'Enroll in a Program'}</b></div>
        <div class="b-emoji">🎓</div><div class="b-arrow">›</div>
      </div>
      <div class="banner ${job ? 'green' : 'purple'} mt" id="jobBanner" style="cursor:pointer">
        <div class="b-bar"></div>
        <div class="b-tx"><small>Career</small><b>${job ? `${job.title} · ${M(job.pay)}/yr` : 'Find a Job'}</b></div>
        <div class="b-emoji">💼</div><div class="b-arrow">›</div>
      </div>

      <div class="section-label">Activities</div>
      <div class="grid2" id="actGrid"></div>

      <div class="section-label">Relationships</div>
      <div class="card tight">
        ${G.partner ? `<div class="lrow"><div class="l-ic">${G.partner.married ? '💍' : '❤️'}</div>
          <div class="l-tx"><b>${U.esc(G.partner.name)}</b><small>${G.partner.married ? 'Spouse' : 'Partner'} · ${Math.floor(G.partner.months / 12)}y ${G.partner.months % 12}m together</small></div>
          <button class="btn sm" id="dateBtn">Date Night</button></div>` :
        '<div class="lrow"><div class="l-ic">💤</div><div class="l-tx"><b>Single</b><small>Romance finds busy people at galas…</small></div></div>'}
        ${G.children.map(c => `<div class="lrow"><div class="l-ic">${c.age < 5 ? '👶' : c.age < 13 ? '🧒' : '🧑'}</div>
          <div class="l-tx"><b>${U.esc(c.name)}</b><small>Age ${Math.floor(c.age)}</small></div></div>`).join('')}
        ${G.mentor ? `<div class="lrow"><div class="l-ic">🧙</div><div class="l-tx"><b>${U.esc(G.mentor.name)}</b><small>Mentor · ${DATA.SKILLS.find(k => k.id === G.mentor.skill).name} · ${G.mentor.monthsLeft}mo left</small></div></div>` : ''}
        ${G.rivals.map(r => `<div class="lrow"><div class="l-ic">😼</div><div class="l-tx"><b>${U.esc(r.name)}</b><small>Rival · heat ${r.heat}</small></div></div>`).join('')}
      </div>

      <div class="section-label">Lifestyle Shopping</div>
      <div class="qa-row">
        <button class="qa" id="shopHomes"><span class="qa-ic">🏡</span><span class="qa-tx"><small>Buy</small><b>Homes</b></span></button>
        <button class="qa" id="shopCars"><span class="qa-ic">🏎️</span><span class="qa-tx"><small>Buy</small><b>Vehicles</b></span></button>
      </div>
      <div class="qa-row mt"><button class="qa" id="shopLux"><span class="qa-ic">💎</span><span class="qa-tx"><small>Buy</small><b>Luxury</b></span></button>
      <div class="qa" style="visibility:${G.assets.length ? 'visible' : 'hidden'}"><span class="qa-ic">📦</span><span class="qa-tx"><small>Owned</small><b>${G.assets.length} items</b></span></div></div>
      ${G.assets.length ? `<div class="card tight mt" id="ownedList">
        ${G.assets.map((a, i) => {
          const item = DATA.ASSETS[a.catId].find(x => x.id === a.id);
          return `<div class="lrow"><div class="l-ic">${item.emoji}</div>
            <div class="l-tx"><b>${item.name}</b><small>Worth ${M(Economy.assetValue(a))}</small></div>
            <button class="btn sm" data-sellasset="${i}">Sell</button></div>`;
        }).join('')}
      </div>` : ''}
    `;
    bindTimeline(s);
    $(s, '#eduBanner').onclick = openEduSheet;
    $(s, '#jobBanner').onclick = openJobSheet;
    if ($(s, '#dateBtn')) $(s, '#dateBtn').onclick = () => {
      if (G.cash < 500) return UI.toast('❌', 'Too broke for date night', 'bad');
      G.cash -= 500; G.partner.quality = U.clamp(G.partner.quality + 6, 0, 100);
      G.happiness = U.clamp(G.happiness + 4, 0, 100);
      State.log('🕯️', `Date night with ${G.partner.name}. Worth every penny.`, 'info');
      State.save(); UI.render(); UI.toast('❤️', 'Relationship strengthened', 'good');
    };

    /* activities */
    const grid = $(s, '#actGrid');
    DATA.ACTIVITIES.forEach(a => {
      const afford = G.cash >= a.cost;
      const card = U.el(`<button class="card tight" style="text-align:left;${afford ? '' : 'opacity:.45'}">
        <div style="font-size:26px">${a.emoji}</div>
        <b style="font-size:14.5px;display:block;margin-top:6px">${a.name}</b>
        <small class="muted">${a.cost ? M(a.cost) : 'Free'} · ${a.desc}</small>
      </button>`);
      if (afford) card.onclick = () => doActivity(a);
      grid.appendChild(card);
    });

    /* shops */
    $(s, '#shopHomes').onclick = () => openShop('homes', '🏡 Homes');
    $(s, '#shopCars').onclick = () => openShop('cars', '🏎️ Vehicles');
    $(s, '#shopLux').onclick = () => openShop('luxury', '💎 Luxury');
    $$(s, '[data-sellasset]').forEach(btn => btn.onclick = () => {
      const a = G.assets[+btn.dataset.sellasset];
      const item = DATA.ASSETS[a.catId].find(x => x.id === a.id);
      const v = Economy.assetValue(a) * 0.92;
      UI.confirm('Sell ' + item.name, `You'd receive ${M(v)} (8% dealer fee).`, 'Sell', () => {
        G.cash += v; G.assets.splice(+btn.dataset.sellasset, 1);
        State.log('🏷️', `Sold ${item.name} for ${M(v)}.`, 'money');
        State.save(); UI.render();
      });
    });
  }

  function doActivity(a) {
    G.cash -= a.cost;
    G.totals.spent += a.cost;
    Object.entries(a.effects).forEach(([k, v]) => { G[k] = U.clamp(G[k] + v, 0, 100); });
    if (a.rep) G.reputation = U.clamp(G.reputation + a.rep, 0, 100);
    if (a.skill) {
      const id = a.skill === 'random' ? U.pick(DATA.SKILLS).id : a.skill;
      G.skills[id] = U.clamp(G.skills[id] + a.skillGain, 0, 100);
      UI.toast(a.emoji, `${a.name}: +${a.skillGain} ${DATA.SKILLS.find(k => k.id === id).name}`, 'good');
    } else {
      UI.toast(a.emoji, a.name + ' ✓', 'good');
    }
    State.log(a.emoji, `${a.name}.`, 'info');
    State.save(); UI.render();
  }

  function openShop(catId, title) {
    const body = UI.modal(`<h2>${title}</h2><p class="sub">Cash: ${M(G.cash)}. Assets add happiness & prestige; homes appreciate, vehicles depreciate.</p><div id="shopList"></div>`);
    DATA.ASSETS[catId].forEach(item => {
      const owned = G.assets.some(a => a.catId === catId && a.id === item.id);
      const row = U.el(`<button class="opt" ${owned || G.cash < item.price ? 'disabled style="opacity:.45"' : ''}>
        <span class="o-ic">${item.emoji}</span>
        <span class="o-tx"><b>${item.name}${owned ? ' ✓' : ''}</b><small>+${item.happy} happiness · prestige ${item.prestige}${item.upkeep ? ` · ${M(item.upkeep)}/mo upkeep` : ''}</small></span>
        <span class="o-end">${M(item.price)}</span></button>`);
      if (!owned && G.cash >= item.price) row.onclick = () => {
        G.cash -= item.price;
        G.totals.spent += item.price;
        G.assets.push({ catId, id: item.id, boughtFor: item.price, age: 0 });
        G.happiness = U.clamp(G.happiness + item.happy, 0, 100);
        G.fame = U.clamp(G.fame + item.prestige, 0, 100);
        State.log(item.emoji, `Bought a ${item.name} for ${M(item.price)}.`, 'money');
        State.save(); UI.closeModal(); UI.render();
        UI.toast(item.emoji, `${item.name} is yours!`, 'good');
      };
      $(body, '#shopList').appendChild(row);
    });
  }

  function openEduSheet() {
    if (G.studying) {
      const ed = DATA.EDUCATION.find(e => e.id === G.studying.id);
      return UI.modal(`<h2>🎓 ${ed.name}</h2><p class="sub">${G.studying.monthsLeft} months until graduation. Keep advancing time.</p>`);
    }
    const body = UI.modal(`<h2>🎓 Education</h2><p class="sub">Programs cost tuition upfront and take real months, but permanently boost skills and unlock careers.</p><div id="eduList"></div>`);
    DATA.EDUCATION.filter(e => e.id !== 'hs').forEach(ed => {
      const done = G.education.includes(ed.id);
      const reqOk = !ed.req || G.education.includes(ed.req);
      const afford = G.cash >= ed.cost;
      const ok = !done && reqOk && afford;
      const row = U.el(`<button class="opt" ${ok ? '' : 'disabled style="opacity:.45"'}>
        <span class="o-ic">${done ? '✅' : '📘'}</span>
        <span class="o-tx"><b>${ed.name}</b><small>${ed.years} years · ${Object.entries(ed.boost).map(([k, v]) => `+${v} ${k}`).join(', ')}${!reqOk ? ` · requires ${DATA.EDUCATION.find(x => x.id === ed.req).name}` : ''}</small></span>
        <span class="o-end">${ed.cost ? M(ed.cost) : 'Free'}</span></button>`);
      if (ok) row.onclick = () => {
        G.cash -= ed.cost;
        G.totals.spent += ed.cost;
        G.studying = { id: ed.id, monthsLeft: ed.years * 12 };
        State.log('📚', `Enrolled in ${ed.name}.`, 'milestone');
        State.save(); UI.closeModal(); UI.render();
      };
      $(body, '#eduList').appendChild(row);
    });
  }

  function openJobSheet() {
    const body = UI.modal(`<h2>💼 Careers</h2><p class="sub">${G.job ? `Current: ${DATA.JOBS.find(j => j.id === G.job).title}. Performance ${Math.round(G.jobPerformance)}/100.` : 'A salary funds your first venture. Requirements gate the good stuff.'}</p>
      ${G.job ? '<button class="btn red mb" id="quitBtn">Quit Current Job</button>' : ''}
      <div id="jobList"></div>`);
    if (G.job) $(body, '#quitBtn').onclick = () => {
      State.log('🚪', `Quit your job as ${DATA.JOBS.find(j => j.id === G.job).title}.`, 'info');
      G.job = null; G.jobMonths = 0;
      State.save(); UI.closeModal(); UI.render();
    };
    const fields = [...new Set(DATA.JOBS.map(j => j.field))];
    fields.forEach(f => {
      $(body, '#jobList').appendChild(U.el(`<div class="section-label" style="margin:14px 2px 8px">${f}</div>`));
      DATA.JOBS.filter(j => j.field === f).forEach(j => {
        const eduOk = !j.reqEdu || G.education.includes(j.reqEdu);
        const skillOk = G.skills[j.skill] >= j.reqSkill;
        const ageOk = G.age >= j.minAge;
        const isCurrent = G.job === j.id;
        const ok = eduOk && skillOk && ageOk && !isCurrent;
        const reqs = [];
        if (!eduOk) reqs.push(DATA.EDUCATION.find(e => e.id === j.reqEdu).degree + ' required');
        if (!skillOk) reqs.push(`${j.skill} ${j.reqSkill}+ needed (you: ${Math.round(G.skills[j.skill])})`);
        if (!ageOk) reqs.push(`age ${j.minAge}+`);
        const row = U.el(`<button class="opt" ${ok ? '' : 'disabled style="opacity:.45"'}>
          <span class="o-ic">${isCurrent ? '⭐' : '💼'}</span>
          <span class="o-tx"><b>${j.title}${isCurrent ? ' (current)' : ''}</b><small>${reqs.length ? reqs.join(' · ') : 'You qualify — grows your ' + j.skill + ' skill'}</small></span>
          <span class="o-end">${M(j.pay)}/yr</span></button>`);
        if (ok) row.onclick = () => {
          G.job = j.id; G.jobMonths = 0; G.jobPerformance = 50;
          State.log('💼', `Hired as ${j.title} — ${M(j.pay)}/yr.`, 'milestone');
          State.save(); UI.closeModal(); UI.render();
          UI.toast('💼', `You're now a ${j.title}!`, 'good');
        };
        $(body, '#jobList').appendChild(row);
      });
    });
  }

  /* ============================================================
     YOU (profile, skills, achievements, stats, settings)
     ============================================================ */
  function renderYou(s) {
    const initials = G.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const country = DATA.COUNTRIES.find(c => c.id === G.country);
    const degrees = G.education.map(id => DATA.EDUCATION.find(e => e.id === id)).filter(e => e.degree).map(e => e.degree);
    s.innerHTML = `
      <div class="page-head"><div class="page-title">You<span class="ac">.</span></div></div>
      <div class="card" style="display:flex;gap:16px;align-items:center">
        <div class="avatar lg">${initials}</div>
        <div>
          <b style="font-size:20px;font-family:var(--serif)">${U.esc(G.name)}</b>
          <div class="muted tiny" style="margin-top:4px">${country.flag} ${country.name} · Age ${G.age}${degrees.length ? ' · ' + degrees.join(', ') : ''}</div>
          <div class="mt" style="display:flex;gap:6px;flex-wrap:wrap">
            <span class="pill a">🌟 Fame ${Math.round(G.fame)}</span>
            <span class="pill">⭐ Rep ${Math.round(G.reputation)}</span>
          </div>
        </div>
      </div>

      <div class="section-label">Skills</div>
      <div class="card">
        ${DATA.SKILLS.map(k => UI.statBar(`${k.emoji} ${k.name}`, G.skills[k.id], 'p')).join('')}
        ${UI.statBar('🧠 Intelligence', G.skills.intelligence, 'b')}
      </div>

      <div class="section-label">Lifetime Stats</div>
      <div class="grid2">
        <div class="stat-chip"><div class="s-val">${M(G.totals.earned)}</div><div class="s-lab">Earned</div></div>
        <div class="stat-chip"><div class="s-val">${M(G.totals.spent)}</div><div class="s-lab">Spent</div></div>
        <div class="stat-chip"><div class="s-val">${G.totals.businessesFounded}</div><div class="s-lab">Founded</div></div>
        <div class="stat-chip"><div class="s-val">${G.totals.exits}</div><div class="s-lab">Exits</div></div>
        <div class="stat-chip"><div class="s-val">${M(G.totals.taxesPaid)}</div><div class="s-lab">Taxes Paid</div></div>
        <div class="stat-chip"><div class="s-val">${G.achievements.length}/${Engine.ACHIEVEMENTS.length}</div><div class="s-lab">Achievements</div></div>
      </div>

      <div class="section-label">Achievements</div>
      <div class="card tight">
        ${Engine.ACHIEVEMENTS.map(a => {
          const got = G.achievements.includes(a.id);
          return `<div class="lrow" style="${got ? '' : 'opacity:.38'}">
            <div class="l-ic">${got ? a.emoji : '🔒'}</div>
            <div class="l-tx"><b>${a.name}</b><small>${a.desc}</small></div>
            ${got ? '<div class="l-end pos">✓</div>' : ''}
          </div>`;
        }).join('')}
      </div>

      <div class="section-label">Full Life Log</div>
      <div class="card logfeed">
        ${G.log.slice(0, 60).map(l => `
          <div class="logline"><span class="lg-em">${l.emoji}</span>
            <span class="lg-tx">${U.esc(l.text)}<small>AGE ${l.age} · MONTH ${l.month + 1}</small></span>
          </div>`).join('')}
      </div>

      <div class="section-label">Danger Zone</div>
      <button class="btn red" id="restartBtn">🔄 Abandon This Life</button>
    `;
    $(s, '#restartBtn').onclick = () => UI.confirm('Abandon Life?',
      `${G.name}'s story ends here and the save is erased. This cannot be undone.`,
      'Erase & Restart', () => { State.wipe(); window.G = null; UI.render(); }, 'red');
  }

  /* ============================================================
     GAME OVER
     ============================================================ */
  function renderGameOver(s) {
    const go = G.gameOver;
    const nw = go.netWorth;
    const verdict =
      nw >= 1e9 ? { em: '👑', t: 'Legendary Mogul', d: 'Your name will outlive the century.' } :
      nw >= 1e8 ? { em: '💎', t: 'Titan of Industry', d: 'Business schools will teach your story.' } :
      nw >= 1e7 ? { em: '🏆', t: 'Self-Made Success', d: 'You built real, lasting wealth.' } :
      nw >= 1e6 ? { em: '📈', t: 'Millionaire', d: 'You made it further than most ever do.' } :
      nw >= 0 ? { em: '🌱', t: 'Honest Hustler', d: 'Not every empire gets built in one lifetime.' } :
      { em: '💀', t: 'Cautionary Tale', d: 'Debt won. Podcasts will dissect what went wrong.' };
    s.innerHTML = `
      <div class="page-head" style="margin-top:60px"><div class="page-title">${go.reason === 'death' ? 'The End' : 'Game'}<span class="dim"> ${go.reason === 'death' ? '' : 'Over'}</span></div></div>
      <div class="card center-txt" style="padding:30px">
        <div style="font-size:64px">${verdict.em}</div>
        <h2 style="font-family:var(--serif);font-size:28px;margin:12px 0 6px">${verdict.t}</h2>
        <p class="muted" style="line-height:1.5">${U.esc(go.summary)}</p>
        <p class="muted tiny mt">${verdict.d}</p>
        <div class="grid2 mt2">
          <div class="stat-chip"><div class="s-val">${M(nw)}</div><div class="s-lab">Final Net Worth</div></div>
          <div class="stat-chip"><div class="s-val">${go.age}</div><div class="s-lab">Final Age</div></div>
          <div class="stat-chip"><div class="s-val">${G.totals.businessesFounded}</div><div class="s-lab">Companies Founded</div></div>
          <div class="stat-chip"><div class="s-val">${G.achievements.length}</div><div class="s-lab">Achievements</div></div>
        </div>
      </div>
      <button class="btn primary mt2" id="newLifeBtn">Start a New Life ›</button>
    `;
    $(s, '#newLifeBtn').onclick = () => { State.wipe(); window.G = null; UI.render(); };
  }

  return { renderIntro, renderHome, renderVentures, renderMarket, renderLife, renderYou, renderGameOver };
})();
