/** Politics: party membership, offices/campaigns, legislation, government. */
import { lazy, Suspense, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  appointMinister,
  availableOffices,
  cabinetCandidates,
  campaignAction,
  deliverBudgetSpeech,
  dismissMinister,
  donateToPoliticalParty,
  investigateOfficial,
  foundParty,
  cancelPRAgency,
  hirePRAgency,
  holdCabinetMeeting,
  hostFundraiserGala,
  holdPressConference,
  joinParty,
  launchCampaign,
  leaveParty,
  negotiateCoalition,
  proposeLaw,
  proposedLaws,
  repealLaw,
  respondToProtests,
  seekCelebrityEndorsement,
} from '../../sim/actions';
import { campaignWinChance, promiseFulfillment, publicOpinionBreakdown } from '../../sim/politics';
import { LAW_CATEGORIES } from '../../data/laws';
import { BarList, Badge, Button, Card, Field, Modal, Pill, PillRow, SectionHeader, StatBar, TextInput } from '../components';
import { money, moneyFull, pct } from '../format';
import { CABINET_PORTFOLIOS, MANIFESTO_PROMISES, type CabinetPortfolio, type Country, type ManifestoPromise } from '../../sim/types';

const PoliticalChamberScene = lazy(() => import('../three/PoliticalChamberScene').then((m) => ({ default: m.PoliticalChamberScene })));
const ChamberFallback = <div className="w-full h-56 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

const PROMISE_LABELS: Record<ManifestoPromise, string> = {
  tax_cuts: 'Cut Taxes',
  healthcare: 'Boost Healthcare',
  education: 'Expand Education',
  jobs: 'Create Jobs',
  crime_reduction: 'Fight Crime',
  infrastructure: 'Build Infrastructure',
};

export function Politics() {
  const { state, run } = useGame();
  const [tab, setTab] = useState<'status' | 'office' | 'laws' | 'party' | 'cabinet'>('status');
  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const party = home.parties.find((x) => x.id === p.partyId);
  const isLeader = home.leaderId === 'player';

  return (
    <div>
      <SectionHeader title="Politics" />
      <PillRow>
        <Pill label="Status" active={tab === 'status'} onClick={() => setTab('status')} />
        <Pill label="Office" active={tab === 'office'} onClick={() => setTab('office')} />
        <Pill label="Legislation" active={tab === 'laws'} onClick={() => setTab('laws')} />
        <Pill label="Party" active={tab === 'party'} onClick={() => setTab('party')} />
        {isLeader && <Pill label="Cabinet" active={tab === 'cabinet'} onClick={() => setTab('cabinet')} />}
      </PillRow>

      {home.totalSeats > 0 && (
        <div className="mt-4">
          <Suspense fallback={ChamberFallback}>
            <PoliticalChamberScene
              parties={home.parties.map((party) => ({ id: party.id, name: party.name, seats: party.seats, ideology: party.ideology, isPlayerParty: party.id === p.partyId }))}
              totalSeats={home.totalSeats}
              isLeader={isLeader}
              portfolios={CABINET_PORTFOLIOS.map((portfolio) => ({
                name: portfolio,
                filled: !!home.cabinet[portfolio],
                byPlayer: home.cabinet[portfolio] === 'player',
              }))}
            />
          </Suspense>
        </div>
      )}

      {tab === 'status' && (
        <div className="mt-4 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-slate-400 uppercase font-bold">Your Position</div>
                <div className="font-extrabold text-lg">
                  {p.office ? `${p.office.title}` : isLeader ? home.leaderTitle : 'Private Citizen'}
                </div>
                {p.office && <div className="text-sm text-slate-500 dark:text-slate-400">{p.office.regionName} · {p.office.yearsInOffice}/{p.office.termYears === 99 ? '∞' : p.office.termYears} yr term</div>}
              </div>
              {isLeader && <Badge tone="brand">🏛️ Head of State</Badge>}
            </div>
            <div className="space-y-3">
              <StatBar label="Popularity" value={p.popularity} />
              <StatBar label="Influence" value={p.influence} />
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Political Capital</span>
                <span className="font-bold text-brand-500">{Math.round(p.politicalCapital)}</span>
              </div>
            </div>
          </Card>

          {p.campaign && (
            <Card className="p-5 border-2 border-brand-400">
              <div className="text-xs text-brand-500 uppercase font-bold mb-1">Active Campaign</div>
              <div className="font-extrabold">{p.campaign.regionName}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                War chest {money(p.campaign.warChest)} · {p.campaign.yearsToElection > 0 ? `${p.campaign.yearsToElection} yr to vote` : 'election this year'}
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Projected win chance</span>
                  <span className="font-bold">{pct(campaignWinChance(state), 0)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
                  <div className="h-full bg-brand-500" style={{ width: `${campaignWinChance(state) * 100}%` }} />
                </div>
              </div>
              {p.campaign.promises.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.campaign.promises.map((pr) => <Badge key={pr}>{PROMISE_LABELS[pr]}</Badge>)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="soft" onClick={() => run(campaignAction, 'rally')}>📣 Rally</Button>
                <Button size="sm" variant="soft" onClick={() => run(campaignAction, 'doorknock')}>🚪 Doorknock</Button>
                <Button size="sm" variant="soft" onClick={() => run(campaignAction, 'ads')}>📺 Ads ($50k)</Button>
                <Button size="sm" variant="soft" onClick={() => run(campaignAction, 'fundraise')}>💰 Fundraise</Button>
                <Button size="sm" variant="soft" onClick={() => run(campaignAction, 'polling')}>📊 Polling ($15k)</Button>
                <Button size="sm" variant="soft" onClick={() => run(campaignAction, 'debate')}>🎙️ Debate</Button>
                <Button size="sm" variant="soft" onClick={() => run(holdPressConference)}>📰 Press Conference</Button>
                <Button size="sm" variant="soft" onClick={() => run(seekCelebrityEndorsement)}>⭐ Celebrity Endorsement ($30k)</Button>
                <Button
                  size="sm"
                  variant={p.campaign.consultantHired ? 'ghost' : 'soft'}
                  disabled={p.campaign.consultantHired}
                  onClick={() => run(campaignAction, 'consultant')}
                >
                  {p.campaign.consultantHired ? '✅ Consultant Hired' : '🎯 Hire Consultant ($100k)'}
                </Button>
                <Button size="sm" variant="soft" className="col-span-2" onClick={() => run(hostFundraiserGala)}>🎉 Host Fundraiser Gala ($15k)</Button>
              </div>
            </Card>
          )}

          {p.office && p.office.promises.length > 0 && (
            <Card className="p-5">
              <div className="font-bold mb-3">Manifesto Scorecard</div>
              <div className="space-y-2">
                {promiseFulfillment(p.office, home).map((f) => (
                  <div key={f.promise} className="flex items-center justify-between text-sm">
                    <span>{PROMISE_LABELS[f.promise]}</span>
                    <Badge tone={f.fulfilled ? 'good' : 'bad'}>{f.fulfilled ? '✅ On track' : '❌ Off track'}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="font-bold mb-3">Public Relations</div>
            <div className="space-y-2">
              {p.office && !p.campaign && (
                <Button size="sm" variant="soft" className="w-full" onClick={() => run(holdPressConference)}>📰 Hold Press Conference</Button>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 pr-2">PR agency ($50k, $10k/yr): softens negative reputation/popularity hits.</span>
                {p.prAgencyHired ? (
                  <Button size="sm" variant="ghost" onClick={() => run(cancelPRAgency)}>Cancel</Button>
                ) : (
                  <Button size="sm" variant="soft" onClick={() => run(hirePRAgency)}>Retain</Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="font-bold mb-3">{home.flag} {home.name} Government</div>
            <div className="space-y-3">
              <StatBar label="Govt Approval" value={home.approvalOfGovernment} />
              <StatBar label="Stability" value={home.stability} />
              <StatBar label="Corruption" value={home.corruption} />
              <StatBar label="Press Freedom" value={home.pressFreedom} />
              <StatBar label="Unrest" value={home.unrest} />
            </div>
            <div className="mt-3 text-sm flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">System</span>
              <span className="font-semibold capitalize">{home.system}</span>
            </div>
            {home.totalSeats > 0 && (
              <div className="text-sm flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Next election</span>
                <span className="font-semibold">{home.electionInYears} yr</span>
              </div>
            )}
            {home.leaderId === 'player' && (
              <Button size="sm" variant="soft" className="w-full mt-3" onClick={() => run(deliverBudgetSpeech)}>📜 Deliver Budget Speech (10 PC)</Button>
            )}
          </Card>

          {home.leaderId === 'player' && home.oppositionLeaderId && state.npcs[home.oppositionLeaderId] && (
            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase font-bold mb-1">Leader of the Opposition</div>
                <div className="font-bold">{state.npcs[home.oppositionLeaderId].name}</div>
              </div>
              <Badge tone={state.npcs[home.oppositionLeaderId].popularity > 50 ? 'bad' : 'brand'}>
                {Math.round(state.npcs[home.oppositionLeaderId].popularity)} popularity
              </Badge>
            </Card>
          )}

          {home.leaderId === 'player' && home.unrest >= 30 && (
            <Card className="p-5">
              <div className="font-bold mb-2">✊ Protests & Unrest</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Unrest is at {Math.round(home.unrest)}. How do you respond?</p>
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="soft" onClick={() => run(respondToProtests, 'concede')}>Concede</Button>
                <Button size="sm" variant="danger" onClick={() => run(respondToProtests, 'crackdown')}>Crackdown</Button>
                <Button size="sm" variant="ghost" onClick={() => run(respondToProtests, 'ignore')}>Ignore</Button>
              </div>
            </Card>
          )}

          {home.cities.length > 0 && <PublicOpinionDashboard home={home} />}
        </div>
      )}

      {tab === 'office' && <OfficeTab />}
      {tab === 'laws' && <LawsTab />}
      {tab === 'party' && <PartyTab party={party} />}
      {tab === 'cabinet' && <CabinetTab />}
    </div>
  );
}

const OPINION_TABS = [
  { key: 'byRegion', label: 'Region' },
  { key: 'byIdeology', label: 'Ideology' },
  { key: 'byClass', label: 'Class' },
  { key: 'byAge', label: 'Age' },
] as const;

function PublicOpinionDashboard({ home }: { home: Country }) {
  const [seg, setSeg] = useState<(typeof OPINION_TABS)[number]['key']>('byRegion');
  const breakdown = publicOpinionBreakdown(home);
  return (
    <Card className="p-5">
      <div className="font-bold mb-3">Public Opinion</div>
      <PillRow>
        {OPINION_TABS.map((t) => (
          <Pill key={t.key} label={t.label} active={seg === t.key} onClick={() => setSeg(t.key)} />
        ))}
      </PillRow>
      <div className="mt-3">
        <BarList
          items={breakdown[seg].map((s) => ({ label: s.label, value: s.value, color: '#337dff' }))}
        />
      </div>
    </Card>
  );
}

function OfficeTab() {
  const { state, run } = useGame();
  const [campaignFor, setCampaignFor] = useState<string | null>(null);
  const [warChest, setWarChest] = useState(0);
  const [promises, setPromises] = useState<ManifestoPromise[]>([]);
  if (!state) return null;
  const p = state.player;
  const offices = availableOffices(state);

  return (
    <div className="mt-4 space-y-3">
      {p.campaign && <Card className="p-4 text-center text-slate-500 dark:text-slate-400">You're already campaigning. Resolve it at the next election before running for another office.</Card>}
      {offices.map(({ spec, eligible, reason, region, cost }) => (
        <Card key={spec.kind} className="p-4">
          <div className="flex justify-between items-start">
            <div className="min-w-0">
              <div className="font-bold">{spec.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{region} · salary {money(spec.salary)}/yr</div>
              {!eligible && <div className="text-xs text-rose-500 mt-1">{reason}</div>}
            </div>
            <Button
              size="sm"
              disabled={!eligible || !!p.campaign}
              onClick={() => { setCampaignFor(spec.kind); setWarChest(Math.min(p.money, cost)); }}
            >
              Run
            </Button>
          </div>
        </Card>
      ))}

      {campaignFor && (
        <Modal open onClose={() => setCampaignFor(null)} title={`Campaign: ${offices.find((o) => o.spec.kind === campaignFor)?.spec.title}`}>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Set your initial war chest. A bigger budget improves your odds; you can fundraise more during the campaign.
          </p>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">War chest: {moneyFull(warChest)}</label>
          <input type="range" min={0} max={Math.round(p.money)} value={warChest} onChange={(e) => setWarChest(Number(e.target.value))} className="w-full mt-1 mb-4" />
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Manifesto promises (up to 3) — kept promises help re-election, broken ones hurt it.</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {MANIFESTO_PROMISES.map((pr) => {
              const active = promises.includes(pr);
              return (
                <button
                  key={pr}
                  onClick={() => setPromises((cur) => (active ? cur.filter((x) => x !== pr) : cur.length >= 3 ? cur : [...cur, pr]))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${active ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-600 dark:text-slate-300'}`}
                >
                  {PROMISE_LABELS[pr]}
                </button>
              );
            })}
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              const r = run(launchCampaign, campaignFor as never, warChest, promises);
              if (r.ok) { setCampaignFor(null); setPromises([]); }
            }}
          >
            Launch Campaign
          </Button>
        </Modal>
      )}
    </div>
  );
}

function LawsTab() {
  const { state, run } = useGame();
  const [cat, setCat] = useState('all');
  if (!state) return null;
  const laws = proposedLaws(state);
  const canLegislate = laws[0]?.canLegislate;
  const filtered = cat === 'all' ? laws : laws.filter((l) => l.law.category === cat);

  return (
    <div className="mt-4">
      {!canLegislate && (
        <Card className="p-4 mb-3 text-center text-sm text-slate-500 dark:text-slate-400">
          You need a seat in national government (MP, Minister, or Head of State) to propose laws. You can still see what's in force.
        </Card>
      )}
      <PillRow>
        <Pill label="All" active={cat === 'all'} onClick={() => setCat('all')} />
        {LAW_CATEGORIES.map((c) => (
          <Pill key={c} label={c} active={cat === c} onClick={() => setCat(c)} />
        ))}
      </PillRow>
      <div className="mt-3 space-y-2">
        {filtered.map(({ law, inForce, chance }) => (
          <Card key={law.id} className="p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-2">
                  {law.name}
                  {inForce && <Badge tone="good">In force</Badge>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{law.description}</div>
              </div>
            </div>
            {canLegislate && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-slate-400">{inForce ? 'Enacted' : `~${pct(chance, 0)} to pass`}</span>
                {inForce ? (
                  law.repealable ? <Button size="sm" variant="danger" onClick={() => run(repealLaw, law.id)}>Repeal</Button> : <Badge>Permanent</Badge>
                ) : (
                  <Button size="sm" onClick={() => run(proposeLaw, law.id)}>Propose (5 PC)</Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function PartyTab({ party }: { party: { id: string; name: string; ideology: number; support: number; seats: number } | undefined }) {
  const { state, run } = useGame();
  const [founding, setFounding] = useState(false);
  const [name, setName] = useState('');
  const [ideology, setIdeology] = useState(0);
  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;

  if (home.totalSeats === 0) {
    return <Card className="p-6 mt-4 text-center text-slate-500 dark:text-slate-400">{home.name} is a {home.system} with no competitive party system. Political advancement here means seizing power directly.</Card>;
  }

  return (
    <div className="mt-4 space-y-3">
      {party ? (
        <Card className="p-5">
          <div className="text-xs text-brand-500 uppercase font-bold mb-1">Your Party</div>
          <div className="font-extrabold text-lg truncate" title={party.name}>{party.name}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            {ideologyLabel(party.ideology)} · {pct(party.support / 100, 0)} support · {party.seats} seats
            {party.id === p.partyId && home.parties.find((x) => x.id === party.id)?.leaderId === 'player' && ' · You lead it'}
          </div>
          <Button size="sm" variant="ghost" onClick={() => run(leaveParty)}>Leave Party</Button>
        </Card>
      ) : null}

      {party && party.seats / home.totalSeats < 0.5 && (
        <Card className="p-5">
          <div className="font-bold mb-1">Coalition</div>
          {home.coalitionPartnerId ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Governing in coalition with the <span className="font-semibold">{home.parties.find((x) => x.id === home.coalitionPartnerId)?.name}</span>.
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Your party doesn't hold a majority ({party.seats}/{home.totalSeats} seats). Negotiate a coalition to guarantee votes on legislation.
              </p>
              <div className="space-y-2">
                {home.parties.filter((x) => x.id !== party.id).map((x) => (
                  <div key={x.id} className="flex items-center justify-between bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2">
                    <span className="text-sm font-semibold truncate pr-2" title={x.name}>{x.name} ({x.seats} seats)</span>
                    <Button size="sm" onClick={() => run(negotiateCoalition, x.id)}>Negotiate (10 PC)</Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {!party && (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 px-1">Join a party to unlock higher offices, or found your own (needs 25+ influence and $250k).</p>
          {home.parties.map((pt) => (
            <Card key={pt.id} className="p-4 flex justify-between items-center gap-2">
              <div className="min-w-0">
                <div className="font-bold truncate" title={pt.name}>{pt.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{ideologyLabel(pt.ideology)} · {pt.seats} seats · {pct(pt.support / 100, 0)}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => run(donateToPoliticalParty, pt.id, 10_000)}>Donate $10k</Button>
                <Button size="sm" onClick={() => run(joinParty, pt.id)}>Join</Button>
              </div>
            </Card>
          ))}
          <Button variant="soft" className="w-full" onClick={() => setFounding(true)}>+ Found Your Own Party</Button>
        </>
      )}

      <Modal open={founding} onClose={() => setFounding(false)} title="Found a Party">
        <Field label="Party name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="(auto if blank)" maxLength={30} />
        </Field>
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ideology: {ideologyLabel(ideology)}</label>
          <input type="range" min={-100} max={100} value={ideology} onChange={(e) => setIdeology(Number(e.target.value))} className="w-full mt-1" />
          <div className="flex justify-between text-[11px] text-slate-400"><span>Left</span><span>Center</span><span>Right</span></div>
        </div>
        <Button className="w-full mt-5" size="lg" onClick={() => { const r = run(foundParty, name, ideology); if (r.ok) setFounding(false); }}>
          Found Party ($250k)
        </Button>
      </Modal>
    </div>
  );
}

function ideologyLabel(v: number): string {
  if (v < -60) return 'Far Left';
  if (v < -20) return 'Center-Left';
  if (v < 20) return 'Centrist';
  if (v < 60) return 'Center-Right';
  return 'Far Right';
}

function CabinetTab() {
  const { state, run } = useGame();
  const [appointing, setAppointing] = useState<CabinetPortfolio | null>(null);
  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const candidates = cabinetCandidates(state);

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs text-slate-400 px-1">Ministers nudge their portfolio's national stats each year based on competence and integrity.</p>
      {Object.values(home.cabinet).some((id) => id !== 'player') && (
        <Button size="sm" variant="soft" className="w-full" onClick={() => run(holdCabinetMeeting)}>🗣️ Hold Cabinet Meeting</Button>
      )}
      {CABINET_PORTFOLIOS.map((portfolio) => {
        const npcId = home.cabinet[portfolio];
        const minister = npcId ? state.npcs[npcId] : null;
        return (
          <Card key={portfolio} className="p-4 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="font-bold">{portfolio}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {minister ? `${minister.name} · competence ${minister.competence}` : 'Vacant'}
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end">
              {minister ? (
                <Button size="sm" variant="danger" onClick={() => run(dismissMinister, portfolio)}>Dismiss</Button>
              ) : (
                <Button size="sm" onClick={() => setAppointing(portfolio)}>Appoint</Button>
              )}
              {minister && (
                <Button size="sm" variant="ghost" onClick={() => run(investigateOfficial, minister.id)}>🕵️ Investigate</Button>
              )}
            </div>
          </Card>
        );
      })}

      {appointing && (
        <Modal open onClose={() => setAppointing(null)} title={`Appoint Minister for ${appointing}`}>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {candidates.length === 0 && <p className="text-center text-slate-400 py-6">No available politicians right now.</p>}
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => { run(appointMinister, appointing, c.id); setAppointing(null); }}
                className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
              >
                <div className="font-semibold truncate" title={c.name}>{c.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Competence {c.competence} · Integrity {c.integrity}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
