/* ============================================================
   BusinessLife — RANDOM EVENTS
   BitLife-style decision events. Each returns an event object:
   { emoji, title, text, options: [{label, desc, apply()}] }
   Events are checked monthly; weights control frequency.
   ============================================================ */
window.Events = (function () {

  const cur = () => G.currency;

  /* ---------- helpers ---------- */
  function adj(stat, amt) { G[stat] = U.clamp(G[stat] + amt, 0, 100); }
  function skill(id, amt) { G.skills[id] = U.clamp(G.skills[id] + amt, 0, 100); }
  function randomBiz() { return G.businesses.length ? U.pick(G.businesses) : null; }

  /* ---------- Event pool ---------- */
  const POOL = [

    /* ===== personal / life ===== */
    {
      id: 'street_pitch', weight: 3, cond: () => G.age < 40,
      make: () => ({
        emoji: '💡', title: 'Elevator Pitch',
        text: 'You share an elevator with a well-known angel investor. Thirty seconds. Do you pitch?',
        options: [
          { label: 'Pitch your vision', desc: 'Could impress… or embarrass', apply() {
            if (U.chance(0.35 + G.skills.negotiation / 250)) {
              const gift = U.randInt(5, 20) * 1000;
              G.cash += gift; adj('reputation', 5);
              return { emoji: '🤝', text: `They loved it! They wired you ${U.money(gift, cur())} as a friendly angel check.` };
            }
            adj('happiness', -4);
            return { emoji: '😬', text: 'You rambled about synergy. They got off two floors early.' };
          } },
          { label: 'Stay quiet', desc: 'Respect their space', apply() { adj('energy', 1); return { emoji: '🤐', text: 'You nodded politely. Dignity intact.' }; } },
        ],
      }),
    },
    {
      id: 'burnout', weight: 4, cond: () => G.stress > 55,
      make: () => ({
        emoji: '🔥', title: 'Burnout Warning',
        text: 'You wake up exhausted for the third week straight. Your body is sending invoices.',
        options: [
          { label: 'Push through', desc: 'Grind now, pay later', apply() { adj('health', -8); adj('stress', 8); skill('operations', 2); return { emoji: '😤', text: 'You powered through. Your health took the hit.' }; } },
          { label: 'Take two weeks off', desc: 'Costs momentum, restores you', apply() { adj('health', 6); adj('happiness', 8); adj('stress', -20); adj('energy', 15); return { emoji: '🌴', text: 'Two weeks offline. You feel human again.' }; } },
        ],
      }),
    },
    {
      id: 'old_friend', weight: 3, cond: () => G.cash > 20000,
      make: () => {
        const ask = Math.round(G.cash * U.rand(0.05, 0.15));
        return {
          emoji: '📱', title: 'An Old Friend Calls',
          text: `A childhood friend asks to borrow ${U.money(ask, cur())} for a "sure thing" food truck.`,
          options: [
            { label: 'Lend the money', desc: 'Maybe you get it back', apply() {
              G.cash -= ask;
              if (U.chance(0.4)) { const back = Math.round(ask * 1.5); G.pendingPayback = (G.pendingPayback || 0) + back; adj('happiness', 3); return { emoji: '🤞', text: 'They promise to repay you with interest. We\'ll see.' }; }
              adj('happiness', -3);
              return { emoji: '💸', text: 'Deep down, you know that money is gone.' };
            } },
            { label: 'Politely decline', desc: 'Protect your capital', apply() { adj('happiness', -2); adj('reputation', -1); return { emoji: '🙅', text: 'Awkward silence. They understood… mostly.' }; } },
            { label: 'Offer advice instead', desc: 'Free, maybe more valuable', apply() { skill('leadership', 2); adj('reputation', 2); return { emoji: '🧠', text: 'You spent an evening on their business plan. They were grateful.' }; } },
          ],
        };
      },
    },
    {
      id: 'health_scare', weight: 2, cond: () => G.health < 45,
      make: () => ({
        emoji: '🏥', title: 'Health Scare',
        text: 'Chest pains during a board call. The doctor says it\'s stress-related — this time.',
        options: [
          { label: 'Full medical workup', desc: `Costs ${U.money(12000, cur())}`, apply() { G.cash -= 12000; adj('health', 15); adj('stress', -10); return { emoji: '🩺', text: 'Caught early, treated fully. Money well spent.' }; } },
          { label: 'Ignore it', desc: 'You\'re fine. Probably.', apply() { if (U.chance(0.3)) { adj('health', -20); return { emoji: '🚑', text: 'It got worse. Much worse. Hospital stay required.' }; } return { emoji: '😅', text: 'It passed. You got lucky.' }; } },
        ],
      }),
    },

    /* ===== business events ===== */
    {
      id: 'viral_moment', weight: 3, cond: () => G.businesses.length > 0,
      make: () => {
        const b = randomBiz();
        return {
          emoji: '📈', title: 'Viral Moment',
          text: `A celebrity casually mentioned ${b.name} online. Traffic is exploding. Capitalize?`,
          options: [
            { label: 'Blitz marketing spend', desc: `Spend ${U.money(Math.round(b.revenue * 0.5) || 5000, cur())} from company cash`, apply() {
              const spend = Math.round(b.revenue * 0.5) || 5000;
              b.cash -= spend; b.brand = U.clamp(b.brand + 14, 0, 100); b.revenue *= 1.35;
              return { emoji: '🚀', text: `${b.name}'s brand surged. Revenue jumped 35% this month.` };
            } },
            { label: 'Ride it organically', desc: 'Free, smaller boost', apply() { b.brand = U.clamp(b.brand + 6, 0, 100); b.revenue *= 1.12; return { emoji: '📊', text: 'A nice bump without spending a cent.' }; } },
          ],
        };
      },
    },
    {
      id: 'key_employee_poached', weight: 3, cond: () => { const b = randomBiz(); return b && b.employees.length > 0; },
      make: () => {
        const b = G.businesses.find(x => x.employees.length > 0);
        const e = U.pick(b.employees);
        const counter = Math.round(e.salary * 1.35);
        return {
          emoji: '🎣', title: 'Poaching Attempt',
          text: `A competitor offered ${e.name} (${DATA.ROLES.find(r => r.id === e.roleId).title} at ${b.name}) a big raise. Counter-offer?`,
          options: [
            { label: `Counter at ${U.money(counter, cur())}/yr`, desc: 'Keep the talent, raise payroll', apply() { e.salary = counter; e.skill = U.clamp(e.skill + 5, 0, 100); b.morale = U.clamp(b.morale + 4, 0, 100); return { emoji: '🤝', text: `${e.name} stayed — and told the team you fight for your people.` }; } },
            { label: 'Let them walk', desc: 'Save the money', apply() { b.employees = b.employees.filter(x => x.uid !== e.uid); b.morale = U.clamp(b.morale - 8, 0, 100); return { emoji: '👋', text: `${e.name} left. The team noticed.` }; } },
          ],
        };
      },
    },
    {
      id: 'lawsuit', weight: 2, cond: () => { const b = randomBiz(); return b && b.revenue > 20000; },
      make: () => {
        const b = randomBiz();
        const claim = Math.round(b.revenue * U.rand(2, 5));
        return {
          emoji: '⚖️', title: 'Lawsuit Filed',
          text: `${b.name} is being sued for ${U.money(claim, cur())} over an alleged IP violation.`,
          options: [
            { label: 'Settle quietly', desc: `Pay ${U.money(Math.round(claim * 0.35), cur())} now`, apply() { b.cash -= Math.round(claim * 0.35); return { emoji: '🤫', text: 'Settled with an NDA. It never happened.' }; } },
            { label: 'Fight in court', desc: 'Win big or lose bigger', apply() {
              const winP = 0.4 + G.skills.negotiation / 200 + G.reputation / 400;
              if (U.chance(winP)) { adj('reputation', 6); return { emoji: '🏛️', text: 'You won! The case was dismissed and your reputation grew.' }; }
              b.cash -= claim; adj('reputation', -6);
              return { emoji: '🔨', text: `You lost. ${U.money(claim, cur())} plus legal fees. Ouch.` };
            } },
          ],
        };
      },
    },
    {
      id: 'supply_crisis', weight: 3, cond: () => { const b = randomBiz(); return b && ['coffee', 'restaurant', 'manufacturing', 'ecommerce', 'fashion', 'logistics'].includes(b.industryId); },
      make: () => {
        const b = G.businesses.find(x => ['coffee', 'restaurant', 'manufacturing', 'ecommerce', 'fashion', 'logistics'].includes(x.industryId));
        return {
          emoji: '🚢', title: 'Supply Chain Crisis',
          text: `${b.name}'s main supplier just collapsed. Shelves will empty within weeks.`,
          options: [
            { label: 'Pay premium supplier', desc: 'Expensive but instant', apply() { b.cash -= Math.round(b.revenue * 0.8); return { emoji: '💳', text: 'Costly, but not a single order was missed.' }; } },
            { label: 'Wait it out', desc: 'Save money, lose sales', apply() { b.crisis = { label: 'supply shortage', revMul: 0.6, monthsLeft: 3 }; return { emoji: '📉', text: 'Revenue will suffer for a few months.' }; } },
            { label: 'Negotiate rescue deal', desc: 'Uses your negotiation skill', apply() {
              if (U.chance(0.3 + G.skills.negotiation / 130)) { skill('negotiation', 3); return { emoji: '🤝', text: 'You restructured their debt and saved your supplier. Genius.' }; }
              b.crisis = { label: 'supply shortage', revMul: 0.55, monthsLeft: 4 };
              return { emoji: '😖', text: 'Talks collapsed. The shortage bites hard.' };
            } },
          ],
        };
      },
    },
    {
      id: 'acquisition_offer', weight: 2, cond: () => { const b = randomBiz(); return b && Business.valuation(b) > 500000 && b.months > 18; },
      make: () => {
        const b = G.businesses.filter(x => Business.valuation(x) > 500000)[0];
        const offer = Math.round(Business.valuation(b) * U.rand(1.1, 1.6));
        return {
          emoji: '💼', title: 'Acquisition Offer',
          text: `A strategic buyer wants ${b.name}. They're offering ${U.money(offer, cur())} — ${Math.round(offer / Math.max(1, Business.valuation(b)) * 100)}% of fair value.`,
          options: [
            { label: 'Take the money', desc: `You'd get ${U.money(offer * b.equity * 0.8, cur())} after tax`, apply() { Business.sell(b, offer); return { emoji: '🏆', text: 'Signed. Wired. Champagne.' }; } },
            { label: 'Reject and build on', desc: 'Bet on yourself', apply() { adj('reputation', 3); b.morale = U.clamp(b.morale + 5, 0, 100); return { emoji: '🧱', text: 'The team is fired up that you believe in the mission.' }; } },
            { label: 'Counter 40% higher', desc: 'Risk them walking', apply() {
              if (U.chance(0.25 + G.skills.negotiation / 160)) { Business.sell(b, Math.round(offer * 1.4)); return { emoji: '🤯', text: 'They blinked. You got the higher price!' }; }
              return { emoji: '🚪', text: 'They walked away. The offer is gone.' };
            } },
          ],
        };
      },
    },
    {
      id: 'pr_scandal', weight: 2, cond: () => { const b = randomBiz(); return b && b.brand > 25; },
      make: () => {
        const b = G.businesses.find(x => x.brand > 25);
        return {
          emoji: '🗞️', title: 'PR Scandal',
          text: `A viral thread accuses ${b.name} of terrible customer service. Journalists are calling.`,
          options: [
            { label: 'Public apology + refunds', desc: 'Costly, honest', apply() { b.cash -= Math.round(b.revenue * 0.4); b.brand = U.clamp(b.brand - 3, 0, 100); adj('reputation', 3); return { emoji: '🙏', text: 'The apology landed well. Crisis mostly defused.' }; } },
            { label: 'Ignore it', desc: 'News cycles are short', apply() { if (U.chance(0.5)) { b.brand = U.clamp(b.brand - 15, 0, 100); adj('reputation', -6); return { emoji: '🔥', text: 'It snowballed. Brand damage is real.' }; } return { emoji: '🌊', text: 'It blew over in 48 hours. Lucky.' }; } },
            { label: 'Hire crisis PR firm', desc: U.money(50000, cur()), apply() { b.cash -= 50000; b.brand = U.clamp(b.brand + 2, 0, 100); return { emoji: '🎩', text: 'The professionals spun it into a comeback story.' }; } },
          ],
        };
      },
    },
    {
      id: 'rival_emerges', weight: 2, cond: () => G.businesses.length > 0 && G.rivals.length < 3,
      make: () => {
        const b = randomBiz();
        const rname = U.pick(DATA.FIRST_M.concat(DATA.FIRST_F)) + ' ' + U.pick(DATA.LAST);
        return {
          emoji: '😼', title: 'A Rival Emerges',
          text: `${rname} just launched a well-funded clone of ${b.name} and is trash-talking you in interviews.`,
          options: [
            { label: 'Ignore them', desc: 'Stay focused', apply() { G.rivals.push({ name: rname, company: 'Rival Corp', heat: 30 }); return { emoji: '🧘', text: 'You stay heads-down. But they\'re out there…' }; } },
            { label: 'Fire back publicly', desc: 'Fuel the feud', apply() { G.rivals.push({ name: rname, company: 'Rival Corp', heat: 60 }); adj('reputation', 2); b.brand = U.clamp(b.brand + 4, 0, 100); return { emoji: '🎤', text: 'Your clapback went viral. The feud is ON.' }; } },
          ],
        };
      },
    },
    {
      id: 'tax_audit', weight: 1.5, cond: () => Economy.netWorth() > 200000,
      make: () => ({
        emoji: '🧾', title: 'Tax Audit',
        text: 'The tax authority is auditing your last three years of filings.',
        options: [
          { label: 'Cooperate fully', desc: 'Lawyers + accountants', apply() {
            const fee = Math.round(Economy.netWorth() * 0.01);
            G.cash -= fee;
            if (U.chance(0.25)) { const owed = Math.round(Economy.netWorth() * 0.04); G.cash -= owed; G.totals.taxesPaid += owed; return { emoji: '📋', text: `They found discrepancies. You paid ${U.money(owed + fee, cur())} total.` }; }
            return { emoji: '✅', text: `Clean audit. Cost ${U.money(fee, cur())} in professional fees.` };
          } },
          { label: 'Obstruct the audit', desc: 'Very risky', apply() {
            if (U.chance(0.5)) { const fine = Math.round(Economy.netWorth() * 0.12); G.cash -= fine; adj('reputation', -12); return { emoji: '🚨', text: `Bad idea. Fined ${U.money(fine, cur())} plus a reputation hit.` }; }
            return { emoji: '😮‍💨', text: 'Somehow they moved on. Never again.' };
          } },
        ],
      }),
    },
    {
      id: 'mentor_offer', weight: 1.5, cond: () => !G.mentor && G.reputation > 20,
      make: () => {
        const name = U.pick(DATA.FIRST_M.concat(DATA.FIRST_F)) + ' ' + U.pick(DATA.LAST);
        const sk = U.pick(DATA.SKILLS);
        return {
          emoji: '🧙', title: 'A Mentor Appears',
          text: `${name}, a retired mogul, offers to mentor you in ${sk.name} for a year.`,
          options: [
            { label: 'Accept gratefully', desc: `+${sk.name} monthly for 12 months`, apply() { G.mentor = { name, skill: sk.id, monthsLeft: 12 }; return { emoji: '🎓', text: `${name} takes you under their wing.` }; } },
            { label: 'Decline', desc: 'You learn alone', apply() { return { emoji: '🚶', text: 'You prefer the hard way.' }; } },
          ],
        };
      },
    },
    {
      id: 'romance', weight: 2, cond: () => !G.partner && G.age >= 20,
      make: () => {
        const name = U.pick(G.gender === 'm' ? DATA.FIRST_F : DATA.FIRST_M) + ' ' + U.pick(DATA.LAST);
        return {
          emoji: '💘', title: 'Someone Special',
          text: `You hit it off with ${name} at an industry gala. There's a spark.`,
          options: [
            { label: 'Pursue the relationship', desc: 'Love + happiness, costs time', apply() { G.partner = { name, quality: U.randInt(55, 90), months: 0 }; adj('happiness', 12); return { emoji: '❤️', text: `You and ${name} are now together.` }; } },
            { label: 'Stay married to the grind', desc: 'The empire comes first', apply() { adj('happiness', -2); skill('operations', 1); return { emoji: '💼', text: 'Another lonely night with the spreadsheets.' }; } },
          ],
        };
      },
    },
    {
      id: 'proposal', weight: 2, cond: () => G.partner && G.partner.months > 24 && !G.partner.married,
      make: () => ({
        emoji: '💍', title: 'Pop the Question?',
        text: `You and ${G.partner.name} have been together ${Math.floor(G.partner.months / 12)} years. Is it time?`,
        options: [
          { label: 'Propose (lavish wedding)', desc: U.money(150000, cur()), apply() { G.cash -= 150000; G.partner.married = true; adj('happiness', 20); G.reputation = U.clamp(G.reputation + 4, 0, 100); return { emoji: '🎊', text: 'A wedding the tabloids covered. Beautiful.' }; } },
          { label: 'Propose (courthouse)', desc: U.money(2000, cur()), apply() { G.cash -= 2000; G.partner.married = true; adj('happiness', 15); return { emoji: '💒', text: 'Simple, intimate, perfect.' }; } },
          { label: 'Not yet', desc: 'The moment isn\'t right', apply() { G.partner.quality -= 8; return { emoji: '😶', text: `${G.partner.name} seemed disappointed.` }; } },
        ],
      }),
    },
    {
      id: 'baby', weight: 1.5, cond: () => G.partner && G.partner.married && G.children.length < 4 && G.age < 45,
      make: () => ({
        emoji: '👶', title: 'Growing the Family?',
        text: `${G.partner.name} asks about having a child.`,
        options: [
          { label: 'Yes — start a family', desc: 'Joy + expenses', apply() {
            const bn = U.pick(U.chance(0.5) ? DATA.FIRST_M : DATA.FIRST_F);
            G.children.push({ name: bn, age: 0 });
            adj('happiness', 16); G.monthlyBurn += 1200;
            return { emoji: '🍼', text: `Welcome to the world, ${bn}!` };
          } },
          { label: 'Not right now', desc: 'Timing matters', apply() { G.partner.quality -= 4; return { emoji: '⏳', text: 'The conversation is shelved… for now.' }; } },
        ],
      }),
    },
    {
      id: 'insider_tip', weight: 1.5, cond: () => G.cash > 50000,
      make: () => {
        const s = U.pick(G.market.stocks);
        return {
          emoji: '🤫', title: 'Insider Tip',
          text: `A contact whispers that ${s.ticker} will "definitely pop next quarter." Trading on this is illegal.`,
          options: [
            { label: 'Buy heavily', desc: 'Illegal insider trading', apply() {
              const amt = Math.min(G.cash * 0.5, 500000);
              if (U.chance(0.55)) { G.cash += amt * U.rand(0.3, 0.8); return { emoji: '🤑', text: `The tip was real. You made a killing. Nobody noticed… this time.` }; }
              const fine = amt * 1.5; G.cash -= fine; adj('reputation', -20); G.fame = U.clamp(G.fame + 5, 0, 100);
              return { emoji: '🚔', text: `SEC investigation! Fined ${U.money(fine, cur())} and publicly disgraced.` };
            } },
            { label: 'Report them', desc: 'Integrity play', apply() { adj('reputation', 8); adj('happiness', 3); return { emoji: '🕊️', text: 'You reported the scheme. Regulators send their thanks.' }; } },
            { label: 'Walk away', desc: 'Not worth the risk', apply() { return { emoji: '🚶', text: 'You pretend you never heard it.' }; } },
          ],
        };
      },
    },
    {
      id: 'windfall', weight: 1, cond: () => true,
      make: () => {
        const amt = U.randInt(2, 30) * 1000;
        return {
          emoji: '🍀', title: 'Unexpected Windfall',
          text: `A forgotten investment matured — ${U.money(amt, cur())} lands in your account.`,
          options: [
            { label: 'Sweet!', desc: 'Take the money', apply() { G.cash += amt; adj('happiness', 4); return { emoji: '💵', text: 'Free money is the best money.' }; } },
          ],
        };
      },
    },
    {
      id: 'conference_keynote', weight: 1.5, cond: () => G.reputation > 35 && G.businesses.length > 0,
      make: () => ({
        emoji: '🎤', title: 'Keynote Invitation',
        text: 'A major business conference wants you to deliver the opening keynote.',
        options: [
          { label: 'Accept and prepare hard', desc: 'Fame + reputation', apply() { adj('reputation', 7); G.fame = U.clamp(G.fame + 8, 0, 100); adj('energy', -8); skill('leadership', 3); return { emoji: '👏', text: 'Standing ovation. Clips of your talk are everywhere.' }; } },
          { label: 'Decline politely', desc: 'Guard your time', apply() { adj('energy', 2); return { emoji: '📩', text: '"Maybe next year," you reply.' }; } },
        ],
      }),
    },
  ];

  /* ---------- Selection ---------- */
  function maybeFire() {
    if (U.chance(0.62)) return null; // ~38% of months have an event
    const eligible = POOL.filter(e => { try { return e.cond(); } catch { return false; } });
    if (!eligible.length) return null;
    const totalW = eligible.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * totalW;
    for (const e of eligible) { r -= e.weight; if (r <= 0) return e.make(); }
    return eligible[0].make();
  }

  return { maybeFire };
})();
