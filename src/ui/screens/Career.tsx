/** Career screen: current job, education, job market, degrees. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { DEGREES, enroll, jobOpenings, quitJob, takeJob, takeSabbatical } from '../../sim/actions';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money, moneyFull } from '../format';
import { INDUSTRY_BY_ID } from '../../data/industries';
import { SKILL_BY_ID } from '../../data/skills';

export function Career() {
  const { state, run } = useGame();
  const [tab, setTab] = useState<'job' | 'jobs' | 'education' | 'skills'>('job');
  if (!state) return null;
  const p = state.player;
  const openings = jobOpenings(state);

  return (
    <div>
      <SectionHeader title="Career" />
      <PillRow>
        <Pill label="Current" active={tab === 'job'} onClick={() => setTab('job')} />
        <Pill label="Job Market" active={tab === 'jobs'} onClick={() => setTab('jobs')} />
        <Pill label="Education" active={tab === 'education'} onClick={() => setTab('education')} />
        <Pill label="Skills" active={tab === 'skills'} onClick={() => setTab('skills')} />
      </PillRow>

      {tab === 'job' && (
        <div className="mt-4 space-y-4">
          {p.job ? (
            <Card className="p-5">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-extrabold text-lg truncate" title={p.job.title}>{p.job.title}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 truncate" title={p.job.employerName}>{p.job.employerName}</div>
                </div>
                <Badge tone="good">{money(p.job.salary)}/yr</Badge>
              </div>
              <div className="mt-4 space-y-3">
                <StatBar label="Performance" value={p.job.performance} />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Years in role</span>
                  <span className="font-semibold">{p.job.yearsInRole}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Field</span>
                  <span className="font-semibold">{INDUSTRY_BY_ID[p.job.industryId]?.name ?? 'General'}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button variant="soft" onClick={() => run(takeSabbatical)}>🏝️ Take Sabbatical</Button>
                <Button variant="danger" onClick={() => run(quitJob)}>Quit Job</Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-slate-500 dark:text-slate-400 mb-3">You're not employed. Browse the job market to earn a steady income, or found your own company.</p>
              <Button onClick={() => setTab('jobs')}>Browse Jobs</Button>
            </Card>
          )}
          {p.studying && (
            <Card className="p-5">
              <div className="text-xs font-bold text-brand-500 uppercase mb-1">Studying</div>
              <div className="font-bold">{p.studying.degree} in {p.studying.field}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {p.studying.yearsLeft} year(s) left · {money(p.studying.costPerYear)}/yr
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="mt-4 space-y-3">
          {openings.map((o, i) => {
            const qualifies = p.smarts >= o.requiredSmarts;
            return (
              <Card key={i} className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold truncate">{o.title}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {money(o.salary)}/yr · needs {o.requiredSmarts} smarts
                    {o.track === 'public' && <span className="ml-1">· 🏛️ public sector</span>}
                  </div>
                </div>
                <Button size="sm" disabled={!qualifies} onClick={() => run(takeJob, o)}>
                  {qualifies ? 'Apply' : 'Locked'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'education' && (
        <div className="mt-4 space-y-3">
          {p.studying ? (
            <Card className="p-6 text-center text-slate-500 dark:text-slate-400">
              You are currently studying for a {p.studying.degree} in {p.studying.field}. Finish it before enrolling again.
            </Card>
          ) : (
            DEGREES.map((d, i) => (
              <Card key={i} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold">{d.degree} · {d.field}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {d.years} yrs · {moneyFull(d.cost)} total · +{d.smarts} smarts
                  </div>
                </div>
                <Button size="sm" variant="soft" onClick={() => run(enroll, i)}>
                  Enroll
                </Button>
              </Card>
            ))
          )}
          {p.education.length > 0 && (
            <>
              <SectionHeader title="Qualifications" />
              <div className="flex flex-wrap gap-2">
                {p.education.map((e, i) => (
                  <Badge key={i} tone="brand">🎓 {e.degree} · {e.field}</Badge>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'skills' && <SkillList player={p} />}
    </div>
  );
}

function SkillList({ player }: { player: { skills: Record<string, number> } }) {
  const learned = Object.entries(player.skills)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const byCategory: Record<string, [string, number][]> = {};
  for (const [id, v] of learned) {
    const cat = SKILL_BY_ID[id]?.category ?? 'Other';
    (byCategory[cat] ??= []).push([id, v]);
  }
  if (learned.length === 0) {
    return <Card className="p-6 mt-4 text-center text-slate-500 dark:text-slate-400">No skills yet. Skills grow through jobs, study and events.</Card>;
  }
  return (
    <div className="mt-4 space-y-4">
      {Object.entries(byCategory).map(([cat, skills]) => (
        <Card key={cat} className="p-4">
          <div className="text-xs font-bold text-brand-500 uppercase mb-3">{cat}</div>
          <div className="space-y-3">
            {skills.map(([id, v]) => (
              <StatBar key={id} label={SKILL_BY_ID[id]?.name ?? id} value={v} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
