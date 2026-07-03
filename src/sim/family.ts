/**
 * Family & dynasty simulation. Spouses and children are ordinary NPCs linked
 * via player.relationships (kind 'spouse'/'child'); this module generates
 * dating candidates, resolves proposals/divorce/childbirth, ages children
 * into milestones, and hands the estate to an heir on death so play can
 * continue across generations.
 */
import type { Company, GameState, NPC } from './types';
import { clamp100 } from './types';
import { RNG } from './rng';
import { makePersonName } from '../data/names';
import { log } from './engine';
import { companyValuation } from './business';

let npcCounter = 100_000; // offset from world.ts's own counter space to avoid id collisions

function freshNpcId(state: GameState): string {
  while (state.npcs[`npc_f${npcCounter}`]) npcCounter++;
  return `npc_f${npcCounter++}`;
}

export interface DatingCandidate {
  npcId: string;
  name: string;
  age: number;
  charisma: number;
  wealth: number;
  compatibility: number; // 0..100, flavor score shown to the player
}

/** Generate a handful of dating candidates from the player's home country. */
export function datingPool(state: GameState): DatingCandidate[] {
  const p = state.player;
  const rng = new RNG(state.seed ^ (state.year * 92821));
  const candidates: DatingCandidate[] = [];
  const existing = new Set(Object.values(state.npcs).map((n) => n.name));
  for (let i = 0; i < 5; i++) {
    const gender = p.gender === 'male' ? (rng.chance(0.85) ? 'female' : 'male') : rng.chance(0.85) ? 'male' : 'female';
    let name = makePersonName(rng, gender);
    let guard = 0;
    while (existing.has(name) && guard++ < 5) name = makePersonName(rng, gender);
    const age = clampAge(p.age + rng.int(-6, 6));
    const charisma = rng.int(30, 90);
    const wealth = rng.range(1_000, 2_000_000);
    const compatibility = Math.round(clamp100(50 + (charisma - 50) * 0.4 + rng.range(-20, 20)));
    candidates.push({ npcId: `candidate_${i}_${rng.state}`, name, age, charisma, wealth, compatibility });
  }
  return candidates;
}

function clampAge(a: number): number {
  return Math.max(18, Math.min(80, a));
}

export interface FamilyActionResult {
  ok: boolean;
  message: string;
}

/** Propose to a dating candidate; materializes them as a real NPC on success. */
export function propose(state: GameState, candidate: DatingCandidate): FamilyActionResult {
  const p = state.player;
  if (p.spouseId) return { ok: false, message: 'You are already married.' };
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  const chance = 0.35 + (p.charisma - 50) * 0.006 + (candidate.compatibility - 50) * 0.004 + (p.money > 100_000 ? 0.05 : 0);
  const accepted = rng.chance(Math.max(0.05, Math.min(0.9, chance)));
  state.rngState = rng.state;

  if (!accepted) {
    log(state, `You proposed to ${candidate.name}, but they turned you down.`, 'bad');
    p.happiness = clamp100(p.happiness - 6);
    return { ok: false, message: `${candidate.name} said no.` };
  }

  const npc: NPC = {
    id: freshNpcId(state),
    name: candidate.name,
    gender: p.gender === 'male' ? 'female' : 'male',
    age: candidate.age,
    alive: true,
    countryId: p.countryId,
    role: 'family',
    wealth: candidate.wealth,
    competence: rng.int(30, 80),
    charisma: candidate.charisma,
    ambition: rng.int(20, 80),
    riskTolerance: rng.int(20, 80),
    ideology: rng.int(-60, 60),
    integrity: rng.int(30, 90),
    popularity: 0,
    opinionOfPlayer: 70,
    partyId: null,
    officeKind: null,
    companyId: null,
    goal: 'build a life together',
    memory: [`Married ${p.name} in ${state.year}.`],
  };
  state.npcs[npc.id] = npc;
  p.spouseId = npc.id;
  p.relationships.push({ npcId: npc.id, kind: 'spouse', closeness: 80 });
  p.money += candidate.wealth * 0.15; // modest dowry/shared assets
  p.happiness = clamp100(p.happiness + 15);
  log(state, `💍 You married ${npc.name}!`, 'milestone');
  if (!state.achievements.includes('married')) state.achievements.push('married');
  return { ok: true, message: `${npc.name} said yes!` };
}

export function divorce(state: GameState): FamilyActionResult {
  const p = state.player;
  if (!p.spouseId) return { ok: false, message: 'You are not married.' };
  const spouse = state.npcs[p.spouseId];
  const settlement = p.money * 0.3;
  p.money -= settlement;
  p.happiness = clamp100(p.happiness - 12);
  p.relationships = p.relationships.filter((r) => r.npcId !== p.spouseId);
  log(state, `💔 You divorced ${spouse?.name ?? 'your spouse'}, paying a $${Math.round(settlement).toLocaleString()} settlement.`, 'bad');
  p.spouseId = null;
  p.divorceCount++;
  return { ok: true, message: 'The divorce is finalized.' };
}

export function haveChild(state: GameState): FamilyActionResult {
  const p = state.player;
  if (!p.spouseId) return { ok: false, message: 'You need a spouse first.' };
  if (p.children.length >= 6) return { ok: false, message: 'Your family is already large enough!' };
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  const gender = rng.chance(0.5) ? 'male' : 'female';
  const names = { male: ['Milo', 'Theo', 'Jonah', 'Ezra', 'Silas'], female: ['Nora', 'Ivy', 'Wren', 'Luna', 'Rose'] };
  const first = rng.pick(names[gender]);
  const lastName = p.name.split(' ').slice(-1)[0];
  state.rngState = rng.state;

  const child: NPC = {
    id: freshNpcId(state),
    name: `${first} ${lastName}`,
    gender,
    age: 0,
    alive: true,
    countryId: p.countryId,
    role: 'family',
    wealth: 0,
    competence: rng.int(30, 80),
    charisma: rng.int(30, 80),
    ambition: rng.int(20, 90),
    riskTolerance: rng.int(20, 80),
    ideology: rng.int(-40, 40),
    integrity: rng.int(40, 90),
    popularity: 0,
    opinionOfPlayer: 90,
    partyId: null,
    officeKind: null,
    companyId: null,
    goal: 'grow up',
    memory: [],
  };
  state.npcs[child.id] = child;
  p.children.push(child.id);
  p.relationships.push({ npcId: child.id, kind: 'child', closeness: 90 });
  p.happiness = clamp100(p.happiness + 10);
  log(state, `👶 You welcomed a child: ${child.name}!`, 'milestone');
  if (p.children.length >= 3 && !state.achievements.includes('big_family')) state.achievements.push('big_family');
  return { ok: true, message: `Welcome, ${child.name}!` };
}

/** Designate an adult child as the heir to one of the player's companies. */
export function nameSuccessor(state: GameState, companyId: string, childId: string): FamilyActionResult {
  const p = state.player;
  const company = state.companies[companyId];
  const child = state.npcs[childId];
  if (!company || !company.playerOwned) return { ok: false, message: 'Not your company.' };
  if (!child || !p.children.includes(childId)) return { ok: false, message: 'Not your child.' };
  if (child.age < 18) return { ok: false, message: `${child.name} is too young to run a business.` };
  company.successorId = childId;
  if (!state.achievements.includes('dynasty_founder')) state.achievements.push('dynasty_founder');
  log(state, `${child.name} was named successor of ${company.name}.`, 'business');
  return { ok: true, message: `${child.name} is now in line to inherit ${company.name}.` };
}

/** Called once a year from the engine: ages children through milestones. */
export function tickFamily(state: GameState, rng: RNG): void {
  const p = state.player;

  // NPCs (including spouse/children) age and may die in tickNPCs earlier this
  // same year; detect that here so the player's pointers stay consistent.
  if (p.spouseId && !state.npcs[p.spouseId]?.alive) {
    log(state, `💔 Your spouse ${state.npcs[p.spouseId]?.name ?? ''} has passed away.`, 'bad');
    p.spouseId = null;
    p.happiness = clamp100(p.happiness - 20);
  }

  for (const childId of p.children) {
    const child = state.npcs[childId];
    if (!child || !child.alive) continue;
    if (child.age === 5) log(state, `${child.name} started school.`, 'info');
    if (child.age === 13) log(state, `${child.name} became a teenager. They ${rng.pick(['love', 'are indifferent to', 'question'])} your career choices.`, 'info');
    if (child.age === 18) {
      log(state, `${child.name} turned 18 and is now an adult, free to chart their own path.`, 'milestone');
      p.happiness = clamp100(p.happiness + 3);
    }
  }
  // Spousal relationship drifts a little each year.
  if (p.spouseId) {
    const rel = p.relationships.find((r) => r.npcId === p.spouseId);
    if (rel) rel.closeness = clamp100(rel.closeness + rng.range(-4, 3));
    if (rel && rel.closeness < 15 && rng.chance(0.08)) {
      log(state, `Your marriage has grown distant. ${state.npcs[p.spouseId]?.name} may not stay much longer.`, 'bad');
    }
  }

  // A mentor passes on a little wisdom each year, if still alive.
  if (p.mentorId) {
    const mentor = state.npcs[p.mentorId];
    if (mentor?.alive) {
      p.smarts = clamp100(p.smarts + 0.5);
      p.influence = clamp100(p.influence + 0.5);
    } else {
      log(state, 'Your mentor has passed away. Their guidance stays with you.', 'bad');
      p.mentorId = null;
    }
  }
  // A rival keeps the pressure on; if they die, the rivalry ends.
  if (p.rivalId && !state.npcs[p.rivalId]?.alive) {
    log(state, 'Your rival has passed away. The rivalry is over.', 'info');
    p.rivalId = null;
  }
}

/** On the player's death, pass companies to named successors and cash to the family. */
export function distributeEstate(state: GameState): string[] {
  const p = state.player;
  const notes: string[] = [];
  const heirs = [p.spouseId, ...p.children].filter((id): id is string => !!id && !!state.npcs[id]?.alive);

  for (const companyId of p.companies) {
    const company: Company | undefined = state.companies[companyId];
    if (!company || company.status !== 'active') continue;
    if (company.successorId && state.npcs[company.successorId]?.alive) {
      const heir = state.npcs[company.successorId]!;
      company.founderId = heir.id;
      heir.companyId = company.id;
      notes.push(`${company.name} passed to ${heir.name}.`);
    } else {
      // No named successor: liquidated into the estate for the family.
      const value = companyValuation(company) * company.playerSharePct;
      company.status = 'sold';
      company.playerOwned = false;
      if (heirs.length > 0) {
        const share = value / heirs.length;
        for (const id of heirs) state.npcs[id]!.wealth += share;
        notes.push(`${company.name} was sold and its value split among your family.`);
      }
    }
  }
  if (heirs.length > 0) {
    const share = p.money / heirs.length;
    for (const id of heirs) state.npcs[id]!.wealth += share;
    notes.push(`Your $${Math.round(p.money).toLocaleString()} estate was divided among ${heirs.length} heir(s).`);
  }
  if (p.properties.length > 0 && heirs.length > 0) {
    notes.push(`${p.properties.length} propert${p.properties.length > 1 ? 'ies' : 'y'} passed to your family.`);
  }
  if (p.lifeInsurance && heirs.length > 0) {
    const share = p.lifeInsurance.payout / heirs.length;
    for (const id of heirs) state.npcs[id]!.wealth += share;
    notes.push(`Your life insurance paid out $${Math.round(p.lifeInsurance.payout).toLocaleString()} to your family.`);
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Relationships: mentors, rivals, and general networking
// ---------------------------------------------------------------------------

export interface RelationResult {
  ok: boolean;
  message: string;
}

/** A handful of NPCs the player could plausibly approach for mentorship or rivalry. */
export function relationshipCandidates(state: GameState): NPC[] {
  const p = state.player;
  const excluded = new Set([p.mentorId, p.rivalId, p.spouseId, ...p.children].filter(Boolean));
  return Object.values(state.npcs)
    .filter((n) => n.alive && n.countryId === p.countryId && !excluded.has(n.id) && (n.role === 'executive' || n.role === 'politician' || n.role === 'investor' || n.role === 'celebrity'))
    .sort((a, b) => b.competence - a.competence)
    .slice(0, 8);
}

export function seekMentor(state: GameState): RelationResult {
  const p = state.player;
  if (p.mentorId) return { ok: false, message: 'You already have a mentor.' };
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  const candidates = relationshipCandidates(state).filter((n) => n.age > p.age + 8);
  if (!candidates.length) return { ok: false, message: 'Nobody suitable is willing to mentor you right now.' };
  const candidate = rng.weighted(candidates, (n) => n.competence);
  const chance = 0.3 + (p.charisma - 50) * 0.005 + (p.reputation - 50) * 0.003;
  const accepted = rng.chance(Math.max(0.1, Math.min(0.8, chance)));
  state.rngState = rng.state;
  if (!accepted) {
    p.happiness = Math.max(0, p.happiness - 2);
    return { ok: false, message: `${candidate.name} declined to mentor you.` };
  }
  p.mentorId = candidate.id;
  p.relationships.push({ npcId: candidate.id, kind: 'mentor', closeness: 60 });
  candidate.opinionOfPlayer = Math.min(100, candidate.opinionOfPlayer + 20);
  log(state, `${candidate.name} agreed to mentor you.`, 'good');
  if (!state.achievements.includes('well_connected')) state.achievements.push('well_connected');
  return { ok: true, message: `${candidate.name} is now your mentor.` };
}

export function declareRival(state: GameState, npcId: string): RelationResult {
  const p = state.player;
  if (p.rivalId) return { ok: false, message: 'You already have a rival.' };
  const npc = state.npcs[npcId];
  if (!npc || !npc.alive) return { ok: false, message: 'That person is unavailable.' };
  p.rivalId = npcId;
  p.relationships.push({ npcId, kind: 'rival', closeness: 10 });
  npc.opinionOfPlayer = Math.max(-100, npc.opinionOfPlayer - 40);
  log(state, `You made an enemy of ${npc.name}.`, 'bad');
  if (!state.achievements.includes('arch_rival')) state.achievements.push('arch_rival');
  return { ok: true, message: `${npc.name} is now your rival.` };
}

export function endRivalry(state: GameState): RelationResult {
  const p = state.player;
  if (!p.rivalId) return { ok: false, message: 'You have no rival.' };
  const npc = state.npcs[p.rivalId];
  p.relationships = p.relationships.filter((r) => r.npcId !== p.rivalId);
  log(state, `You and ${npc?.name ?? 'your rival'} called a truce.`, 'good');
  p.rivalId = null;
  return { ok: true, message: 'Rivalry ended.' };
}

export function networking(state: GameState): RelationResult {
  const p = state.player;
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  const candidates = relationshipCandidates(state);
  if (!candidates.length) {
    state.rngState = rng.state;
    return { ok: false, message: 'Nobody new to meet right now.' };
  }
  const npc = rng.pick(candidates);
  const alreadyKnown = p.relationships.some((r) => r.npcId === npc.id);
  if (!alreadyKnown) {
    p.relationships.push({ npcId: npc.id, kind: rng.chance(0.5) ? 'friend' : 'ally', closeness: rng.int(30, 55) });
  }
  p.influence = Math.min(100, p.influence + 2);
  p.charisma = Math.min(100, p.charisma + 1);
  npc.opinionOfPlayer = Math.min(100, npc.opinionOfPlayer + 8);
  state.rngState = rng.state;
  log(state, `You made a valuable new connection: ${npc.name}.`, 'info');
  return { ok: true, message: `Met ${npc.name} at a networking event.` };
}
