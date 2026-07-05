/** Career screen: current job, coworkers & office politics, job market, education, skills, freelance. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  applyForPromotion, DEGREES, dropOutOfSchool, enroll, freelanceGigListings, jobOpenings, networkWithCoworker,
  quitJob, reportToHR, setWorkStyle, takeFreelanceGig, takeJob, takeSabbatical,
} from '../../sim/actions';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money, moneyFull } from '../format';
import { INDUSTRY_BY_ID } from '../../data/industries';
import { SKILL_BY_ID } from '../../data/skills';
import { CAREER_LADDER, COWORKER_PERSONALITY_BY_ID, rankIndex, titleForRank, WORK_STYLES } from '../../data/careers';
import type { Player, WorkStyle } from '../../sim/types';

export function Career() {
  const { state, run } = useGame();
  const [tab, setTab] = useState<'job' | 'jobs' | 'freelance' | 'education' | 'skills'>('job');
  const [negotiate, setNegotiate] = useState(false);
  if (!state) return null;
  const p = state.player;
  const openings = jobOpenings(state);
  const gigs = freelanceGigListings();

  return (
    <div>
      <SectionHeader title="Career" />
      <PillRow>
        <Pill label="Current" active={tab === 'job'} onClick={() => setTab('job')} />
        <Pill label="Job Market" active={tab === 'jobs'} onClick={() => setTab('jobs')} />
        <Pill label="Freelance" active={tab === 'freelance'} onClick={() => setTab('freelance')} />
        <Pill label="Education" active={tab === 'education'} onClick={() => setTab('education')} />
        <Pill label="Skills" active={tab === 'skills'} onClick={() => setTab('skills')} />
      </PillRow>

      {tab === 'job' && (
        <div className="mt-4 space-y-4">
          {p.job ? (
            <>
              <Card className="p-5">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-lg truncate" title={p.job.title}>{titleForRank(p.job.title, p.job.rank)}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 truncate" title={p.job.employerName}>{p.job.employerName}</div>
                  </div>
                  <Badge tone="good">{money(p.job.salary)}/yr</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  <StatBar label="Performance" value={p.job.performance} />
                  <StatBar label="Reliability" value={p.job.reliability} />
                  <StatBar label={`Stress${p.job.stress >= 70 ? ' — burnout risk' : ''}`} value={p.job.stress} />
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Rank</span>
                    <span className="font-semibold capitalize">{p.job.rank} ({rankIndex(p.job.rank) + 1}/{CAREER_LADDER.length})</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Years in rank / at company</span>
                    <span className="font-semibold">{p.job.yearsInRole} / {p.job.yearsAtCompany}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Field</span>
                    <span className="font-semibold">{INDUSTRY_BY_ID[p.job.industryId]?.name ?? 'General'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button variant="soft" onClick={() => run(applyForPromotion)}>📈 Push for Promotion</Button>
                  <Button variant="soft" onClick={() => run(takeSabbatical)}>🏝️ Take Sabbatical</Button>
                  <Button variant="danger" className="col-span-2" onClick={() => run(quitJob)}>Quit Job</Button>
                </div>
              </Card>

              <Card className="p-4">
                <div className="font-bold mb-2 text-sm">Work Style</div>
                <PillRow>
                  {WORK_STYLES.map((w) => (
                    <Pill key={w.id} label={`${w.icon} ${w.label}`} active={p.job!.workStyle === w.id} onClick={() => run(setWorkStyle, w.id as WorkStyle)} />
                  ))}
                </PillRow>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{WORK_STYLES.find((w) => w.id === p.job!.workStyle)?.blurb}</p>
              </Card>

              <Card className="p-4">
                <div className="font-bold mb-3 text-sm">Coworkers & Office Politics</div>
                <div className="space-y-2">
                  {p.job.coworkers.map((cw) => {
                    const pers = COWORKER_PERSONALITY_BY_ID[cw.personality];
                    return (
                      <div key={cw.id} className="rounded-xl bg-slate-100 dark:bg-ink-800 p-3">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate">{pers.icon} {cw.name} <span className="text-xs text-slate-400 capitalize">· {cw.role}</span></div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{pers.blurb}</div>
                          </div>
                          <Badge tone={cw.rapport >= 65 ? 'good' : cw.rapport <= 30 ? 'bad' : 'neutral'}>{Math.round(cw.rapport)}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <Button size="sm" variant="soft" onClick={() => run(networkWithCoworker, cw.id)}>🤝 Network</Button>
                          <Button size="sm" variant="ghost" onClick={() => run(reportToHR, cw.id)}>🚩 Report to HR</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-slate-500 dark:text-slate-400 mb-3">
                You're not employed. Browse the job market to earn a steady income, pick up freelance gigs, or found your own company.
              </p>
              {p.lastFiredYear !== null && state.year - p.lastFiredYear < 3 && (
                <p className="text-xs text-rose-500 mb-3">A recent layoff is still on your record — interviews will be tougher for a couple more years.</p>
              )}
              <Button onClick={() => setTab('jobs')}>Browse Jobs</Button>
            </Card>
          )}
          {p.studying && (
            <Card className="p-5">
              <div className="text-xs font-bold text-brand-500 uppercase mb-1">Studying</div>
              <div className="font-bold">{p.studying.degree} in {p.studying.field}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {p.studying.yearsLeft} of {p.studying.totalYears} year(s) left · {money(p.studying.costPerYear)}/yr
              </div>
              <Button size="sm" variant="danger" onClick={() => run(dropOutOfSchool)}>Drop Out</Button>
            </Card>
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 px-1">
            <input type="checkbox" checked={negotiate} onChange={(e) => setNegotiate(e.target.checked)} className="w-4 h-4" />
            Negotiate salary if hired (risk: an aggressive push can cost you the offer)
          </label>
          {openings.map((o, i) => {
            const qualifies = p.smarts >= o.requiredSmarts;
            return (
              <Card key={i} className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold truncate">{titleForRank(o.title, 'junior')}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {money(o.salary)}/yr · needs {o.requiredSmarts} smarts
                    {o.track === 'public' && <span className="ml-1">· 🏛️ public sector</span>}
                  </div>
                </div>
                <Button size="sm" disabled={!qualifies} onClick={() => run(takeJob, o, negotiate)}>
                  {qualifies ? 'Apply' : 'Locked'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'freelance' && (
        <div className="mt-4 space-y-3">
          <Card className="p-4">
            <div className="flex justify-between items-center">
              <div className="font-bold text-sm">Freelance Reputation</div>
              <Badge tone="brand">{Math.round(p.freelanceReputation)}</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {p.freelanceGigsCompleted} gig{p.freelanceGigsCompleted === 1 ? '' : 's'} completed. Reputation drives pay and success odds — good reviews compound, bad ones sting.
            </p>
          </Card>
          {gigs.map((g) => (
            <Card key={g.id} className="p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-bold truncate">{g.icon} {g.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{g.blurb}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">~{money(g.basePay)}{g.skillId ? ` · uses ${SKILL_BY_ID[g.skillId]?.name ?? 'a skill'}` : ''}</div>
              </div>
              <Button size="sm" variant="soft" onClick={() => run(takeFreelanceGig, g.id)}>Take Gig</Button>
            </Card>
          ))}
        </div>
      )}

      {tab === 'education' && (
        <div className="mt-4 space-y-3">
          {p.studying ? (
            <Card className="p-6 text-center text-slate-500 dark:text-slate-400">
              <p>You are currently studying for a {p.studying.degree} in {p.studying.field}. Finish it before enrolling again.</p>
              <p className="text-sm mt-1">{p.studying.yearsLeft} of {p.studying.totalYears} year(s) left · {moneyFull(p.studying.costPerYear)}/yr</p>
              <Button size="sm" variant="danger" className="mt-3" onClick={() => run(dropOutOfSchool)}>Drop Out</Button>
            </Card>
          ) : (
            DEGREES.map((d, i) => (
              <Card key={i} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold">{d.degree} · {d.field}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {d.years} yrs · {moneyFull(d.cost)} total · +{d.smarts} smarts · graduates with {SKILL_BY_ID[d.skillId]?.name ?? 'a real skill'}
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

function SkillList({ player }: { player: Pick<Player, 'skills'> }) {
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
