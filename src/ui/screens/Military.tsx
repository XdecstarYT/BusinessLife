/**
 * Military Service career hub: enlist in a branch, pick a specialty, train, deploy overseas
 * against whatever nation your country is actually at war with, and choose — while deployed —
 * between heroism and an atrocity. No 3D scene here (unlike Athlete); the tension comes from real
 * risk resolved yearly: rank progression, injuries, medals, court-martial, and eventual discharge.
 */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  actHeroically, commitWarCrime, deployOverseas, enlistInMilitary, reenlistForBonus,
  requestDischarge, requestRotationHome, trainMilitary,
} from '../../sim/military';
import {
  BRANCH_BY_ID, MILITARY_BASES, MILITARY_BRANCHES, MILITARY_SPECIALTIES,
  MILITARY_TRAINING_PROGRAMS, RANKS_BY_BRANCH, SPECIALTY_BY_ID, rankAt,
} from '../../data/military';
import type { MilitaryBranch } from '../../sim/types';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';

const DISCHARGE_LABEL: Record<string, string> = {
  honorable: 'Honorably Discharged',
  general: 'General Discharge',
  medical: 'Medical Discharge',
  dishonorable: 'Dishonorably Discharged',
  kia: 'Killed in Action',
};

export function Military() {
  const { state, run } = useGame();
  const [branchPick, setBranchPick] = useState<MilitaryBranch>('army');
  const [specialtyPick, setSpecialtyPick] = useState('infantry');
  const [pickingTraining, setPickingTraining] = useState(false);

  if (!state) return null;
  const p = state.player;
  const career = p.military;
  const home = state.countries.find((c) => c.id === p.countryId);
  const atWar = (home?.atWarWith.length ?? 0) > 0;

  // ---------------------------------------------------------------------------
  // Not currently serving — enlist (or re-enlist after an honorable/general/medical discharge).
  // ---------------------------------------------------------------------------
  if (!career || career.dischargeType !== null) {
    const barred = career?.dischargeType === 'dishonorable';
    return (
      <div>
        <SectionHeader title="🪖 Military Service" />
        {career && (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase font-bold">Previous Service</div>
                <div className="font-bold">
                  {BRANCH_BY_ID[career.branch]?.name} · {rankAt(career.branch, career.rankIndex).name} · {career.yearsOfService} yrs
                </div>
              </div>
              <Badge tone={career.dischargeType === 'dishonorable' ? 'bad' : career.dischargeType === 'kia' ? 'bad' : 'good'}>
                {DISCHARGE_LABEL[career.dischargeType ?? '']}
              </Badge>
            </div>
            {career.medals.length > 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">🎖️ {career.medals.length} medal{career.medals.length === 1 ? '' : 's'} earned</div>
            )}
            {career.veteranPensionPerYear > 0 && (
              <div className="text-xs text-emerald-500 font-semibold mt-1">VA pension: {money(career.veteranPensionPerYear)}/yr</div>
            )}
          </Card>
        )}
        {barred ? (
          <Card className="p-4 text-sm text-rose-500 font-semibold">A dishonorable discharge bars you from ever re-enlisting.</Card>
        ) : (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
              Pick a branch and specialty and enlist. Rank, pay, and risk all depend on your specialty —
              combat roles pay more and see real action, support roles are safer.
            </p>
            <div className="text-xs text-slate-400 uppercase font-bold mb-2">Branch</div>
            <PillRow>
              {MILITARY_BRANCHES.map((b) => (
                <Pill key={b.id} label={`${b.icon} ${b.name}`} active={branchPick === b.id} tone="brand" onClick={() => setBranchPick(b.id)} />
              ))}
            </PillRow>
            <div className="text-xs text-slate-400 uppercase font-bold mt-4 mb-2">Specialty</div>
            <PillRow>
              {MILITARY_SPECIALTIES.map((s) => (
                <Pill key={s.id} label={`${s.combatRole ? '⚔️' : '🛠️'} ${s.name}`} active={specialtyPick === s.id} onClick={() => setSpecialtyPick(s.id)} />
              ))}
            </PillRow>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">{SPECIALTY_BY_ID[specialtyPick]?.description}</p>
            <Button className="w-full mt-4" size="lg" onClick={() => run(enlistInMilitary, branchPick, specialtyPick)}>
              {career ? 'Re-enlist' : 'Enlist'}
            </Button>
          </>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Active service hub.
  // ---------------------------------------------------------------------------
  const branchDef = BRANCH_BY_ID[career.branch];
  const specialty = SPECIALTY_BY_ID[career.specialtyId];
  const rank = rankAt(career.branch, career.rankIndex);
  const ladder = RANKS_BY_BRANCH[career.branch];
  const nextRank = ladder[career.rankIndex + 1];
  const deployment = career.currentDeployment;
  const base = deployment ? MILITARY_BASES.find((b) => b.id === deployment.baseId) : null;
  const enemy = deployment?.conflictCountryId ? state.countries.find((c) => c.id === deployment.conflictCountryId) : null;
  const availablePrograms = MILITARY_TRAINING_PROGRAMS.filter((prog) => career.rankIndex >= prog.minRankIndex);

  return (
    <div>
      <SectionHeader title={`${branchDef?.icon ?? '🪖'} Military Service`} />

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">{branchDef?.name} · {specialty?.name}</div>
            <div className="font-extrabold text-lg">{rank.name} <span className="text-xs font-semibold text-slate-400">({rank.payGrade})</span></div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{career.yearsOfService} years of service</div>
          </div>
          {deployment && <Badge tone="warn">🌍 Deployed</Badge>}
        </div>
        {nextRank && (
          <div className="text-[11px] text-slate-400 mb-2">Next rank: {nextRank.name} (eligible after {nextRank.minYears} yrs of service)</div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Combat Skill" value={career.combatSkill} />
          <StatBar label="Leadership" value={career.leadership} />
          <StatBar label="Fitness" value={career.fitness} />
          <StatBar label="Discipline" value={career.discipline} />
        </div>
        {career.disabilityRating > 0 && (
          <div className="mt-2 text-xs text-amber-500 font-semibold">Disability rating: {Math.round(career.disabilityRating)}/100</div>
        )}
      </Card>

      <SectionHeader title="Actions" />
      <PillRow>
        <Pill label="💪 Train" onClick={() => setPickingTraining((v) => !v)} />
        {!deployment && atWar && <Pill label="🌍 Deploy Overseas" tone="brand" onClick={() => run(deployOverseas)} />}
        {deployment && <Pill label="✈️ Request Rotation Home" onClick={() => run(requestRotationHome)} />}
        {deployment && <Pill label="🦸 Act Heroically" onClick={() => run(actHeroically)} />}
        {deployment && <Pill label="😈 Cross the Line" onClick={() => run(commitWarCrime)} />}
        {!deployment && <Pill label="🔁 Re-enlist for Bonus" onClick={() => run(reenlistForBonus)} />}
        {!deployment && <Pill label="🫡 Request Discharge" onClick={() => run(requestDischarge)} />}
      </PillRow>
      {!deployment && !atWar && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">Your country isn't at war right now — deployment opens up the moment it is.</p>
      )}

      {pickingTraining && (
        <>
          <SectionHeader title="Training Programs" />
          <div className="space-y-2 mb-4">
            {availablePrograms.map((prog) => (
              <Card key={prog.id} className="p-4" onClick={() => { run(trainMilitary, prog.id); setPickingTraining(false); }}>
                <div className="font-bold text-sm">{prog.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{prog.description}</div>
                <div className="text-[11px] text-slate-400">
                  +{prog.combatSkillGain} combat · +{prog.leadershipGain} leadership · +{prog.fitnessGain} fitness · +{prog.disciplineGain} discipline
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {deployment && (
        <>
          <SectionHeader title="Current Deployment" />
          <Card className="p-4 mb-4">
            <div className="font-bold">{base?.name ?? 'Forward theater'}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {enemy ? `Against ${enemy.name}` : 'Peacetime posting'} · deployed since {deployment.startYear} · {deployment.missionsCompleted} missions completed
            </div>
          </Card>
        </>
      )}

      {career.medals.length > 0 && (
        <>
          <SectionHeader title="🎖️ Medals & Decorations" />
          <Card className="p-4 mb-4 space-y-2">
            {[...career.medals].reverse().map((m, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-[11px] text-slate-400">{m.citation}</div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{m.yearAwarded}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {career.injuries.length > 0 && (
        <>
          <SectionHeader title="Service Injuries" />
          <Card className="p-4 mb-4 space-y-1.5">
            {career.injuries.map((inj, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{inj.name}{inj.permanent ? ' (permanent)' : ''}</span>
                <span className="text-xs text-slate-400">{inj.yearSustained}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {career.deployments.length > 0 && (
        <>
          <SectionHeader title="Service Record" />
          <Card className="p-4 mb-4 space-y-1.5">
            {[...career.deployments].reverse().slice(0, 6).map((d) => {
              const b = MILITARY_BASES.find((x) => x.id === d.baseId);
              return (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span>{b?.name ?? 'Deployment'} ({d.startYear}–{d.endYear ?? '—'})</span>
                  <span className="text-xs text-slate-400 capitalize">{d.outcome.replace('_', ' ')}</span>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
