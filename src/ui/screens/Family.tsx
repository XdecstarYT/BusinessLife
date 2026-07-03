/** Family & Dynasty: dating, marriage, children, succession planning, relationships. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  datingPool,
  declareRival,
  divorce,
  endRivalry,
  haveChild,
  nameSuccessor,
  networking,
  propose,
  relationshipCandidates,
  seekMentor,
  type DatingCandidate,
} from '../../sim/family';
import { Badge, Button, Card, Modal, SectionHeader } from '../components';
import { money } from '../format';

export function Family() {
  const { state, run } = useGame();
  const [proposing, setProposing] = useState<DatingCandidate | null>(null);
  const [successorFor, setSuccessorFor] = useState<string | null>(null);
  const [pickingRival, setPickingRival] = useState(false);
  if (!state) return null;
  const p = state.player;
  const spouse = p.spouseId ? state.npcs[p.spouseId] : null;
  const mentor = p.mentorId ? state.npcs[p.mentorId] : null;
  const rival = p.rivalId ? state.npcs[p.rivalId] : null;
  const children = p.children.map((id) => state.npcs[id]).filter((n): n is NonNullable<typeof n> => !!n);
  const candidates = !p.spouseId ? datingPool(state) : [];
  const companies = p.companies.map((id) => state.companies[id]).filter((c) => c?.status === 'active');
  const friends = p.relationships.filter((r) => r.kind === 'friend' || r.kind === 'ally');

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

      {spouse ? (
        <Card className="p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-brand-500 uppercase font-bold">Spouse</div>
              <div className="font-extrabold text-lg truncate max-w-[220px]" title={spouse.name}>{spouse.name}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Age {spouse.age} · {money(spouse.wealth)} personal wealth</div>
            </div>
            <span className="text-3xl">💍</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button size="sm" variant="soft" onClick={() => run(haveChild)}>Have a Child</Button>
            <Button size="sm" variant="danger" onClick={() => run(divorce)}>Divorce</Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-4 mb-3 text-sm text-slate-500 dark:text-slate-400">You're single. Here's who you've met recently:</Card>
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
                {child.alive && child.age >= 18 && companies.length > 0 && (
                  <Button size="sm" variant="soft" onClick={() => setSuccessorFor(child.id)}>
                    Name Successor
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

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
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              const r = run(propose, proposing);
              if (r.ok || !r.ok) setProposing(null);
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
    </div>
  );
}
