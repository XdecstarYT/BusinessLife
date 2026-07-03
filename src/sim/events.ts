/**
 * Event engine: filters the template catalogue against live game state,
 * fires a weighted random selection each year, resolves placeholders, and
 * applies choice effects (including skill-checked probabilistic outcomes).
 */
import type { EffectSpec, EventChoice, EventTemplate, FiredEvent, GameState } from './types';
import { clamp, clamp100 } from './types';
import { EVENT_TEMPLATES } from '../data/events';
import { INDUSTRY_BY_ID } from '../data/industries';
import { companyValuation } from './business';
import type { RNG } from './rng';

function conditionsMet(t: EventTemplate, state: GameState): boolean {
  const c = t.conditions;
  const p = state.player;
  if (t.once && state.firedOnce.includes(t.id)) return false;
  if (!c) return p.inJailYears <= 0; // default: not while jailed
  if (c.inJail !== undefined) {
    if (c.inJail !== p.inJailYears > 0) return false;
  } else if (p.inJailYears > 0) {
    return false;
  }
  if (c.minAge !== undefined && p.age < c.minAge) return false;
  if (c.maxAge !== undefined && p.age > c.maxAge) return false;
  if (c.minMoney !== undefined && p.money < c.minMoney) return false;
  if (c.maxMoney !== undefined && p.money > c.maxMoney) return false;
  if (c.employed !== undefined && (p.job !== null) !== c.employed) return false;
  if (c.hasBusiness !== undefined) {
    const active = p.companies.some((id) => state.companies[id]?.status === 'active');
    if (active !== c.hasBusiness) return false;
  }
  if (c.businessTag) {
    const has = p.companies.some((id) => {
      const co = state.companies[id];
      return co?.status === 'active' && INDUSTRY_BY_ID[co.industryId]?.tags.includes(c.businessTag!);
    });
    if (!has) return false;
  }
  if (c.inOffice) {
    if (!p.office) return false;
    if (c.inOffice !== 'any' && !c.inOffice.includes(p.office.kind)) return false;
  }
  if (c.notInOffice && p.office) return false;
  if (c.campaigning !== undefined && (p.campaign !== null) !== c.campaigning) return false;
  if (c.inParty !== undefined && (p.partyId !== null) !== c.inParty) return false;
  if (c.minPopularity !== undefined && p.popularity < c.minPopularity) return false;
  if (c.minReputation !== undefined && p.reputation < c.minReputation) return false;
  if (c.minNotoriety !== undefined && p.notoriety < c.minNotoriety) return false;
  if (c.minInfluence !== undefined && p.influence < c.minInfluence) return false;
  if (c.regime && !c.regime.includes(state.countries.find((k) => k.id === p.countryId)!.economy.regime)) return false;
  if (c.hasStocks !== undefined && (p.portfolio.length > 0) !== c.hasStocks) return false;
  if (c.studying !== undefined && (p.studying !== null) !== c.studying) return false;
  if (c.track !== undefined && p.job?.track !== c.track) return false;
  if (c.hasSpouse !== undefined && (p.spouseId !== null) !== c.hasSpouse) return false;
  if (c.hasChildren !== undefined && (p.children.length > 0) !== c.hasChildren) return false;
  if (c.businessPublic !== undefined) {
    const hasPublic = p.companies.some((id) => state.companies[id]?.status === 'active' && state.companies[id]?.isPublic === c.businessPublic);
    if (!hasPublic) return false;
  }
  if (c.duringWorldEvent !== undefined && state.worldEvent?.type !== c.duringWorldEvent) return false;
  if (c.inCrimeFamily !== undefined && (p.crimeFamilyId !== null) !== c.inCrimeFamily) return false;
  if (c.hasMentor !== undefined && (p.mentorId !== null) !== c.hasMentor) return false;
  if (c.hasRival !== undefined && (p.rivalId !== null) !== c.hasRival) return false;
  if (c.hasProperty !== undefined && (p.properties.length > 0) !== c.hasProperty) return false;
  return true;
}

function resolveText(text: string, state: GameState, subjectCompanyId: string | null, subjectNpcId: string | null, amount: number): string {
  const p = state.player;
  const country = state.countries.find((k) => k.id === p.countryId)!;
  const city = country.cities.find((k) => k.id === p.cityId) ?? country.cities[0];
  const company = subjectCompanyId ? state.companies[subjectCompanyId] : null;
  const npc = subjectNpcId ? state.npcs[subjectNpcId] : null;
  const industry = company ? INDUSTRY_BY_ID[company.industryId] : null;
  return text
    .replaceAll('{name}', p.name)
    .replaceAll('{city}', city?.name ?? 'the city')
    .replaceAll('{country}', country.name)
    .replaceAll('{company}', company?.name ?? 'your company')
    .replaceAll('{employer}', p.job?.employerName ?? 'your employer')
    .replaceAll('{npc}', npc?.name ?? 'someone you know')
    .replaceAll('{industry}', industry?.name ?? 'business')
    .replaceAll('{amount}', `$${Math.round(amount).toLocaleString()}`)
    .replaceAll('{year}', String(state.year));
}

/** Pick this year's events (1-3 depending on how eventful life is). */
export function fireEvents(state: GameState, rng: RNG): FiredEvent[] {
  const eligible = EVENT_TEMPLATES.filter((t) => conditionsMet(t, state));
  if (eligible.length === 0) return [];
  const count = state.player.inJailYears > 0 ? 1 : rng.chance(0.25) ? 3 : 2;
  const fired: FiredEvent[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count && used.size < eligible.length; i++) {
    const pool = eligible.filter((t) => !used.has(t.id));
    if (!pool.length) break;
    const t = rng.weighted(pool, (x) => x.weight);
    used.add(t.id);
    if (t.once) state.firedOnce.push(t.id);

    // Subjects
    const p = state.player;
    let activeCompanies = p.companies.filter((id) => state.companies[id]?.status === 'active');
    if (t.conditions?.businessPublic !== undefined) {
      activeCompanies = activeCompanies.filter((id) => state.companies[id]?.isPublic === t.conditions!.businessPublic);
    }
    const wantsCompany = t.category === 'business' || t.conditions?.hasBusiness || t.text.includes('{company}');
    const subjectCompanyId = wantsCompany && activeCompanies.length ? rng.pick(activeCompanies) : null;
    const livingNpcs = Object.values(state.npcs).filter((n) => n.alive && n.countryId === p.countryId);
    let subjectNpcId: string | null = null;
    if (t.conditions?.hasMentor && p.mentorId && state.npcs[p.mentorId]?.alive) subjectNpcId = p.mentorId;
    else if (t.conditions?.hasRival && p.rivalId && state.npcs[p.rivalId]?.alive) subjectNpcId = p.rivalId;
    else if (t.text.includes('{npc}') && livingNpcs.length) subjectNpcId = rng.pick(livingNpcs).id;

    // Amount
    let amount = 0;
    if (t.amount) {
      amount = rng.range(t.amount.min, t.amount.max);
      if (t.amount.pctOfMoney) amount = Math.max(t.amount.min, Math.min(amount, p.money * t.amount.pctOfMoney));
      amount = Math.round(amount / 10) * 10;
    }

    fired.push({
      templateId: t.id,
      text: resolveText(t.text, state, subjectCompanyId, subjectNpcId, amount),
      choices: t.choices.map((c) => ({
        ...c,
        label: resolveText(c.label, state, subjectCompanyId, subjectNpcId, amount),
      })),
      subjectCompanyId,
      subjectNpcId,
      amount,
    });
  }
  return fired;
}

/** Apply an EffectSpec to the game state. Returns log lines describing what happened. */
export function applyEffects(state: GameState, fx: EffectSpec, event: FiredEvent | null): string[] {
  const p = state.player;
  const logs: string[] = [];
  const amount = event?.amount ?? 0;

  if (fx.money) p.money += fx.money;
  if (fx.moneyPct) p.money += p.money * fx.moneyPct;
  if (fx.moneyAmountMult) p.money += amount * fx.moneyAmountMult;
  if (fx.health) p.health = clamp100(p.health + fx.health);
  if (fx.happiness) p.happiness = clamp100(p.happiness + fx.happiness);
  if (fx.smarts) p.smarts = clamp100(p.smarts + fx.smarts);
  if (fx.charisma) p.charisma = clamp100(p.charisma + fx.charisma);
  if (fx.reputation) p.reputation = clamp100(p.reputation + fx.reputation);
  if (fx.popularity) p.popularity = clamp100(p.popularity + fx.popularity);
  if (fx.influence) p.influence = clamp100(p.influence + fx.influence);
  if (fx.karma) p.karma = clamp100(p.karma + fx.karma);
  if (fx.notoriety) p.notoriety = clamp100(p.notoriety + fx.notoriety);
  if (fx.politicalCapital) p.politicalCapital = clamp(p.politicalCapital + fx.politicalCapital, 0, 100);
  if (fx.skillXp) {
    const [skillId, xp] = fx.skillXp;
    p.skills[skillId] = clamp100((p.skills[skillId] ?? 0) + xp * (0.7 + p.smarts / 200));
  }
  if (fx.jobPerformance && p.job) p.job.performance = clamp100(p.job.performance + fx.jobPerformance);
  if (fx.criminalRecord) p.criminalRecord += fx.criminalRecord;
  if (fx.jailYears) {
    p.inJailYears += fx.jailYears;
    p.job = null;
    p.campaign = null;
    if (p.office) {
      logs.push(`You were removed from office as ${p.office.title}.`);
      p.office = null;
    }
    logs.push(`You were sentenced to ${fx.jailYears} year${fx.jailYears > 1 ? 's' : ''} in prison.`);
  }
  if (fx.loseJob && p.job) {
    logs.push(`You left your job as ${p.job.title}.`);
    p.job = null;
  }
  if (fx.campaignMomentum && p.campaign) {
    p.campaign.momentum = clamp(p.campaign.momentum + fx.campaignMomentum, -50, 50);
  }
  if (fx.approvalOfGovernment) {
    const country = state.countries.find((k) => k.id === p.countryId)!;
    country.approvalOfGovernment = clamp100(country.approvalOfGovernment + fx.approvalOfGovernment);
  }
  const co = event?.subjectCompanyId ? state.companies[event.subjectCompanyId] : null;
  if (co) {
    if (fx.companyCash) co.cash += fx.companyCash;
    if (fx.companyBrand) co.brand = clamp100(co.brand + fx.companyBrand);
    if (fx.companyQuality) co.quality = clamp100(co.quality + fx.companyQuality);
    if (fx.companyMorale) co.morale = clamp100(co.morale + fx.companyMorale);
    if (fx.companySharePctDelta) co.playerSharePct = clamp(co.playerSharePct + fx.companySharePctDelta, 0.05, 1);
    if (fx.loseCompany) {
      const payout = companyValuation(co) * co.playerSharePct * 0.9;
      p.money += payout;
      co.status = 'sold';
      co.playerOwned = false;
      p.companies = p.companies.filter((id) => id !== co.id);
      logs.push(`You lost control of ${co.name} in the takeover, walking away with $${Math.round(payout).toLocaleString()}.`);
    }
  }
  if (fx.propertyValuePct) {
    for (const prop of p.properties) {
      const pct = fx.propertyValuePct < 0 && prop.insured ? fx.propertyValuePct * 0.5 : fx.propertyValuePct;
      prop.value = Math.max(10_000, prop.value * (1 + pct));
    }
  }
  return logs;
}

/** Resolve a player's choice on a fired event. Returns text + log lines. */
export function resolveChoice(state: GameState, event: FiredEvent, choice: EventChoice, rng: RNG): { text: string | null; logs: string[] } {
  const logs: string[] = [];
  if (choice.effects) logs.push(...applyEffects(state, choice.effects, event));
  let outcomeText: string | null = null;
  if (choice.outcomes && choice.outcomes.length > 0) {
    // Skill check shifts probability mass toward the first (best) outcome.
    let weights = choice.outcomes.map((o) => o.chance);
    if (choice.skillCheck) {
      const lvl = state.player.skills[choice.skillCheck.skillId] ?? 0;
      const shift = clamp(lvl * choice.skillCheck.bonusPerLevel, 0, 0.35);
      weights = weights.map((w, i) => (i === 0 ? w + shift : Math.max(0.02, w - shift / (weights.length - 1))));
    }
    let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
    let picked = choice.outcomes[choice.outcomes.length - 1];
    for (let i = 0; i < choice.outcomes.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        picked = choice.outcomes[i];
        break;
      }
    }
    outcomeText = picked.text;
    logs.push(...applyEffects(state, picked.effects, event));
  }
  return { text: outcomeText, logs };
}
