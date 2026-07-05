/** Family & Dynasty: dating, marriage, children, succession planning, relationships. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  adoptChild,
  datingPool,
  declareRival,
  divorce,
  dynastyScore,
  endRivalry,
  haveChild,
  namePoliticalHeir,
  namePrimaryHeir,
  nameSuccessor,
  networking,
  propose,
  relationshipCandidates,
  seekMentor,
  type DatingCandidate,
} from '../../sim/family';
import { giftMoneyToChild, investInChildEducation } from '../../sim/actions';
import { npcWarmth } from '../../sim/npcMind';
import type { NPC } from '../../sim/types';
import { Badge, Button, Card, Modal, SectionHeader, StatBar } from '../components';
import { money } from '../format';

const MOOD_LABEL = (mood: number): string => (mood >= 70 ? 'upbeat' : mood >= 45 ? 'even-keeled' : mood >= 25 ? 'strained' : 'miserable');

function PersonCard({ role, npc }: { role: string; npc: NPC }) {
  const warmth = npcWarmth(npc);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0 pr-2">
          <div className="text-xs text-slate-400 uppercase font-bold">{role}</div>
          <div className="font-bold truncate" title={npc.name}>{npc.name}</div>
        </div>
        <Badge tone={warmth >= 65 ? 'good' : warmth <= 30 ? 'bad' : 'neutral'}>{Math.round(warmth)} warmth</Badge>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        Feeling {MOOD_LABEL(npc.mood)} · {npc.relationshipTension >= 50 ? 'tension is running high' : 'no particular tension'} with you
      </div>
      {npc.memory.length > 0 && (
        <div className="text-xs italic text-slate-400 truncate" title={npc.memory[0]}>"{npc.memory[0]}"</div>
      )}
    </Card>
  );
}

export function Family() {
  const { state, run } = useGame();
  const [proposing, setProposing] = useState<DatingCandidate | null>(null);
  const [withPrenup, setWithPrenup] = useState(false);
  const [successorFor, setSuccessorFor] = useState<string | null>(null);
  const [pickingRival, setPickingRival] = useState(false);
  const [draftingWill, setDraftingWill] = useState(false);
  if (!state) return null;
  const p = state.player;
  const spouse = p.spouseId ? state.npcs[p.spouseId] : null;
  const mentor = p.mentorId ? state.npcs[p.mentorId] : null;
  const rival = p.rivalId ? state.npcs[p.rivalId] : null;
  const children = p.children.map((id) => state.npcs[id]).filter((n): n is NonNullable<typeof n> => !!n);
  const grandchildren = p.grandchildren.map((id) => state.npcs[id]).filter((n): n is NonNullable<typeof n> => !!n);
  const candidates = !p.spouseId ? datingPool(state) : [];
  const companies = p.companies.map((id) => state.companies[id]).filter((c) => c?.status === 'active');
  const friends = p.relationships.filter((r) => r.kind === 'friend' || r.kind === 'ally');
  const willEligible = [
    ...(spouse && spouse.alive ? [{ id: spouse.id, name: spouse.name, relation: 'Spouse' }] : []),
    ...children.filter((c) => c.alive).map((c) => ({ id: c.id, name: c.name, relation: 'Child' })),
    ...grandchildren.filter((c) => c.alive).map((c) => ({ id: c.id, name: c.name, relation: 'Grandchild' })),
  ];
  const primaryHeirName = p.primaryHeirId ? state.npcs[p.primaryHeirId]?.name : null;

  return (
    <div>
      <SectionHeader title="Family & Dynasty" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3 text-center">
          <div className="text-[11px] text-slate-400">Generation</div>
          <div className="font-extrabold">{state.generation}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[11px] text-slate-400">Children</div>
          <div className="font-extrabold">{children.filter((c) => c.alive).length}</div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <StatBar label="Dynasty Score" value={dynastyScore(state)} />
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          How well positioned your family is to carry your legacy forward: heirs named, generations, and marriage.
        </div>
      </Card>

      {spouse ? (
        <Card className="p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-brand-500 uppercase font-bold">Spouse</div>
              <div className="font-extrabold text-lg truncate max-w-[220px]" title={spouse.name}>{spouse.name}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Age {spouse.age} · {money(spouse.wealth)} personal wealth</div>
              {p.hasPrenup && <Badge tone="brand">Prenup in place</Badge>}
            </div>
            <span className="text-3xl">💍</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button size="sm" variant="soft" onClick={() => run(haveChild)}>Have a Child</Button>
            <Button size="sm" variant="soft" onClick={() => run(adoptChild)}>Adopt ($25k)</Button>
            <Button size="sm" variant="danger" className="col-span-2" onClick={() => run(divorce)}>Divorce</Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-4 mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">You're single, but you can still grow your family.</span>
            <Button size="sm" variant="soft" onClick={() => run(adoptChild)}>Adopt ($25k)</Button>
          </Card>
          <Card className="p-4 mb-3 text-sm text-slate-500 dark:text-slate-400">Here's who you've met recently:</Card>
          <div className="space-y-3 mb-4">
            {candidates.map((c) => (
              <Card key={c.npcId} className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-fuchsia-500 flex items-center justify-center text-white font-black shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate" title={c.name}>{c.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Age {c.age} · {money(c.wealth)} · {c.compatibility}% compatible
                  </div>
                </div>
                <Button size="sm" onClick={() => setProposing(c)}>Propose</Button>
              </Card>
            ))}
          </div>
        </>
      )}

      {children.length > 0 && (
        <>
          <SectionHeader title="Children" />
          <div className="space-y-2 mb-4">
            {children.map((child) => (
              <Card key={child.id} className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold truncate flex items-center gap-2" title={child.name}>
                    {child.name}
                    {!child.alive && <Badge tone="bad">Deceased</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Age {child.age} {child.age >= 18 ? '· Adult' : '· Minor'}
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {child.alive && child.age >= 18 && companies.length > 0 && (
                    <Button size="sm" variant="soft" onClick={() => setSuccessorFor(child.id)}>
                      Name Successor
                    </Button>
                  )}
                  {child.alive && child.age >= 18 && (p.partyId || p.office) && p.politicalHeirId !== child.id && (
                    <Button size="sm" variant="soft" onClick={() => run(namePoliticalHeir, child.id)}>
                      Name Political Heir
                    </Button>
                  )}
                  {p.politicalHeirId === child.id && <Badge tone="brand">Political Heir</Badge>}
                  {child.alive && (
                    <Button size="sm" variant="ghost" onClick={() => run(giftMoneyToChild, child.id, 5_000)}>
                      Gift $5k
                    </Button>
                  )}
                  {child.alive && child.age < 22 && (
                    <Button size="sm" variant="ghost" onClick={() => run(investInChildEducation, child.id, 5_000)}>
                      Invest in Education ($5k)
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {grandchildren.length > 0 && (
        <>
          <SectionHeader title="Grandchildren" />
          <div className="space-y-2 mb-4">
            {grandchildren.map((gc) => (
              <Card key={gc.id} className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold truncate flex items-center gap-2" title={gc.name}>
                    {gc.name}
                    {!gc.alive && <Badge tone="bad">Deceased</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Age {gc.age}</div>
                </div>
                {p.primaryHeirId === gc.id && <Badge tone="brand">Primary Heir</Badge>}
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Your Will" />
      <Card className="p-4 mb-4">
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Name a primary heir to get the largest share of your estate and top billing if you choose to continue
          play as a family member when you die.
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{primaryHeirName ? `Primary heir: ${primaryHeirName}` : 'No primary heir named'}</div>
          <Button size="sm" variant="soft" disabled={willEligible.length === 0} onClick={() => setDraftingWill(true)}>
            Draft Will
          </Button>
        </div>
      </Card>

      {companies.some((c) => c.successorId) && (
        <>
          <SectionHeader title="Succession Plan" />
          <div className="space-y-2">
            {companies.filter((c) => c.successorId).map((c) => (
              <Card key={c!.id} className="p-4 flex justify-between items-center">
                <span className="font-semibold truncate" title={c!.name}>{c!.name}</span>
                <Badge tone="brand">→ {state.npcs[c!.successorId!]?.name ?? 'Unknown'}</Badge>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Relationships" action="Network" onAction={() => run(networking)} />
      <div className="space-y-3 mb-4">
        <Card className="p-4 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-xs text-brand-500 uppercase font-bold">Mentor</div>
            {mentor ? (
              <div className="font-bold truncate" title={mentor.name}>{mentor.name}</div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">No mentor yet</div>
            )}
          </div>
          {!mentor && <Button size="sm" variant="soft" onClick={() => run(seekMentor)}>Seek Mentor</Button>}
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-xs text-rose-500 uppercase font-bold">Rival</div>
            {rival ? (
              <div className="font-bold truncate" title={rival.name}>{rival.name}</div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">No rival</div>
            )}
          </div>
          {rival ? (
            <Button size="sm" variant="soft" onClick={() => run(endRivalry)}>Make Peace</Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setPickingRival(true)}>Declare Rival</Button>
          )}
        </Card>
        {friends.length > 0 && (
          <Card className="p-4">
            <div className="text-xs text-slate-400 uppercase font-bold mb-2">Friends & Allies</div>
            <div className="flex flex-wrap gap-2">
              {friends.map((r) => (
                <Badge key={r.npcId} tone={r.kind === 'ally' ? 'brand' : 'neutral'}>
                  {state.npcs[r.npcId]?.name ?? 'Unknown'} · {r.closeness}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      {(spouse || mentor || rival) && (
        <>
          <SectionHeader title="People" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
            Every person you're close to has a real mood, memory and disposition toward you — not just a stat you moved.
          </p>
          <div className="space-y-3 mb-4">
            {spouse && spouse.alive && <PersonCard role="Spouse" npc={spouse} />}
            {mentor && mentor.alive && <PersonCard role="Mentor" npc={mentor} />}
            {rival && rival.alive && <PersonCard role="Rival" npc={rival} />}
          </div>
        </>
      )}

      {pickingRival && (
        <Modal open onClose={() => setPickingRival(false)} title="Declare a Rival">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {relationshipCandidates(state).length === 0 && <p className="text-center text-slate-400 py-6">Nobody notable to rival right now.</p>}
            {relationshipCandidates(state).map((n) => (
              <button
                key={n.id}
                onClick={() => { run(declareRival, n.id); setPickingRival(false); }}
                className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
              >
                <div className="font-semibold truncate" title={n.name}>{n.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Competence {n.competence} · {n.role}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {proposing && (
        <Modal open onClose={() => setProposing(null)} title={`Propose to ${proposing.name}?`}>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {proposing.compatibility}% compatibility · your charisma and their fondness for you determine the odds.
          </p>
          <label className="flex items-center gap-2 mb-4 text-sm">
            <input type="checkbox" checked={withPrenup} onChange={(e) => setWithPrenup(e.target.checked)} />
            Sign a prenuptial agreement (protects premarital assets in a future divorce)
          </label>
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              const r = run(propose, proposing, withPrenup);
              if (r.ok || !r.ok) { setProposing(null); setWithPrenup(false); }
            }}
          >
            Pop the Question
          </Button>
        </Modal>
      )}

      {successorFor && (
        <Modal open onClose={() => setSuccessorFor(null)} title="Name Successor">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Choose which company {state.npcs[successorFor]?.name} will inherit if something happens to you.
          </p>
          <div className="space-y-2">
            {companies.map((c) => (
              <Button
                key={c!.id}
                variant="soft"
                className="w-full justify-start"
                onClick={() => { run(nameSuccessor, c!.id, successorFor); setSuccessorFor(null); }}
              >
                {c!.name}
              </Button>
            ))}
          </div>
        </Modal>
      )}

      {draftingWill && (
        <Modal open onClose={() => setDraftingWill(false)} title="Draft Your Will">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Your primary heir receives a double share of your estate and is highlighted if you choose to
            continue play as a family member.
          </p>
          <div className="space-y-2">
            {willEligible.map((h) => (
              <button
                key={h.id}
                onClick={() => { run(namePrimaryHeir, h.id); setDraftingWill(false); }}
                className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">{h.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{h.relation}</div>
                </div>
                {p.primaryHeirId === h.id && <Badge tone="brand">Current</Badge>}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
