/**
 * Legal Career hub: law school → associate → partner, with an optional late-career leap to the
 * bench. Cases resolve against a reactive CourtroomScene (see ui/three/CourtroomScene.tsx) —
 * one of the few career hubs with a dedicated 3D scene, since courtroom cases are the one
 * moment in this career worth literally staging.
 */
import { lazy, Suspense, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  enrollLawSchool, joinFirm, publishLawReview, retireFromLaw, runTrialArgument, seekJudgeship, seekLegalPromotion, takeCase,
} from '../../sim/legal';
import { JUDGESHIP_MIN_PARTNER_RANK, JUDGESHIP_MIN_REPUTATION, LAW_SCHOOL_YEARS, LEGAL_RANK_TITLES, LEGAL_SPECIALTIES, LEGAL_SPECIALTY_BY_ID } from '../../data/legal';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';

const CourtroomScene = lazy(() => import('../three/CourtroomScene').then((m) => ({ default: m.CourtroomScene })));
const SceneFallback = <div className="w-full h-48 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

export function Legal() {
  const { state, run, toast } = useGame();
  const [specialtyPick, setSpecialtyPick] = useState('family_law');
  const [verdict, setVerdict] = useState<'pending' | 'won' | 'lost'>('pending');
  const [playingTrial, setPlayingTrial] = useState(false);
  if (!state) return null;
  const p = state.player;
  const c = p.legalCareer;

  if (!c || !c.active) {
    return (
      <div>
        <SectionHeader title="⚖️ Legal Career" />
        {c?.stage === 'retired' && (
          <Card className="p-4 mb-4">
            <div className="text-xs text-slate-400 uppercase font-bold">Retired Career</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {c.casesWon} cases won · {c.barComplaints} bar complaint{c.barComplaints === 1 ? '' : 's'}
            </div>
          </Card>
        )}
        {c?.disbarred && <Card className="p-4 mb-4"><Badge tone="bad">Disbarred</Badge></Card>}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Grind through law school, pass the bar, and build a career winning cases — a strong
          record can carry you all the way to the bench, but a bad string of losses risks a
          complaint that could end your license.
        </p>
        <Button className="w-full" size="lg" onClick={() => run(enrollLawSchool)}>
          🎓 Enroll in Law School
        </Button>
      </div>
    );
  }

  if (c.stage === 'law_school') {
    const ready = c.yearsOfService >= LAW_SCHOOL_YEARS;
    return (
      <div>
        <SectionHeader title="🎓 Law School" />
        <Card className="p-5 mb-4">
          <div className="text-xs text-brand-500 uppercase font-bold">Progress</div>
          <div className="font-extrabold text-lg">Year {c.yearsOfService}/{LAW_SCHOOL_YEARS}</div>
        </Card>
        {!ready ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 px-1">Keep advancing the year to finish your studies.</p>
        ) : (
          <>
            <SectionHeader title="Sit the Bar & Join a Firm" />
            <PillRow>
              {LEGAL_SPECIALTIES.map((s) => (
                <Pill key={s.id} label={`${s.icon} ${s.name}`} active={specialtyPick === s.id} onClick={() => setSpecialtyPick(s.id)} />
              ))}
            </PillRow>
            <Card className="p-4 mt-2">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Difficulty {LEGAL_SPECIALTY_BY_ID[specialtyPick].difficulty}/100 · Base salary {LEGAL_SPECIALTY_BY_ID[specialtyPick].baseSalary.toLocaleString()}/yr
              </div>
              <Button className="w-full" onClick={() => run(joinFirm, specialtyPick)}>Sit the Bar for {LEGAL_SPECIALTY_BY_ID[specialtyPick].name}</Button>
            </Card>
          </>
        )}
      </div>
    );
  }

  const specialty = c.specialtyId ? LEGAL_SPECIALTY_BY_ID[c.specialtyId] : null;
  const eligibleForBench = c.stage === 'partner' && c.rank >= JUDGESHIP_MIN_PARTNER_RANK && c.reputation >= JUDGESHIP_MIN_REPUTATION;

  return (
    <div>
      <SectionHeader title={c.stage === 'associate' ? '💼 Associate' : c.stage === 'judge' ? '👨‍⚖️ On the Bench' : '⚖️ Partner'} />
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">
              {c.stage === 'judge' ? 'Presiding' : `${specialty?.name} at ${c.firmId}`}
            </div>
            <div className="font-extrabold text-lg">
              {c.stage === 'partner' ? LEGAL_RANK_TITLES[c.rank] : c.stage === 'judge' ? 'Judge' : `Associate, Year ${c.yearsOfService}`}
            </div>
          </div>
          {c.barComplaints > 0 && <Badge tone="bad">📋 {c.barComplaints}</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Skill" value={c.skill} />
          <StatBar label="Reputation" value={c.reputation} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {c.casesWon} won · {c.casesLost} lost · {c.publications} publication{c.publications === 1 ? '' : 's'}
        </div>
      </Card>

      {c.stage !== 'judge' && !playingTrial && (
        <Suspense fallback={SceneFallback}>
          <CourtroomScene verdict={verdict} asJudge={false} />
        </Suspense>
      )}
      {c.stage !== 'judge' && playingTrial && (
        <Suspense fallback={SceneFallback}>
          <CourtroomScene
            verdict="pending"
            asJudge={false}
            interactive
            onComplete={(score) => {
              const r = run(runTrialArgument, score);
              setVerdict(r.ok ? 'won' : 'lost');
              toast(`${Math.round(score * 100)}% accuracy — ${r.message}`, r.ok ? 'ok' : 'err');
              setPlayingTrial(false);
            }}
          />
        </Suspense>
      )}
      {c.stage === 'judge' && (
        <Suspense fallback={SceneFallback}>
          <CourtroomScene verdict="pending" asJudge />
        </Suspense>
      )}

      {c.stage !== 'judge' && (
        <>
          <SectionHeader title="Actions" />
          <PillRow>
            <Pill label="🎮 Argue the Trial" tone="brand" onClick={() => setPlayingTrial(true)} />
            <Pill
              label="📜 Take a Case (quick)"
              onClick={() => { const r = run(takeCase); setVerdict(r.ok ? 'won' : 'lost'); }}
            />
            {c.stage === 'partner' && <Pill label="📄 Publish Law Review" onClick={() => run(publishLawReview)} />}
            {c.stage === 'partner' && c.rank < LEGAL_RANK_TITLES.length - 1 && <Pill label="📈 Seek Promotion" onClick={() => run(seekLegalPromotion)} />}
            {eligibleForBench && <Pill label="👨‍⚖️ Seek a Judgeship" tone="brand" onClick={() => run(seekJudgeship)} />}
          </PillRow>
          {c.stage === 'partner' && !eligibleForBench && (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-1 mt-1">
              Reach {LEGAL_RANK_TITLES[JUDGESHIP_MIN_PARTNER_RANK]} with {JUDGESHIP_MIN_REPUTATION}+ reputation to be considered for the bench.
            </p>
          )}
        </>
      )}

      <SectionHeader title="Exit" />
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
            Retire from the law for good.
          </div>
          <Button size="sm" variant="danger" onClick={() => run(retireFromLaw)}>🚪 Retire</Button>
        </div>
      </Card>
    </div>
  );
}
