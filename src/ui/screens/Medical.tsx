/**
 * Medical Career hub: med school → residency → attending physician. Simple confirm-and-go
 * actions like Casino/Drugs/Military — no dedicated 3D scene (see data/medical.ts for the catalog).
 */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  enrollMedSchool, matchResidency, publishResearch, retireFromMedicine, seekPromotion, treatPatient,
} from '../../sim/medical';
import { MED_SCHOOL_YEARS, MEDICAL_RANK_TITLES, MEDICAL_SPECIALTIES, MEDICAL_SPECIALTY_BY_ID } from '../../data/medical';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';

export function Medical() {
  const { state, run } = useGame();
  const [specialtyPick, setSpecialtyPick] = useState('general_practice');
  if (!state) return null;
  const p = state.player;
  const c = p.medicalCareer;

  if (!c || !c.active) {
    return (
      <div>
        <SectionHeader title="🩺 Medical Career" />
        {c?.stage === 'retired' && (
          <Card className="p-4 mb-4">
            <div className="text-xs text-slate-400 uppercase font-bold">Retired Career</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {c.patientsSaved} patients saved · {c.malpracticeSuits} malpractice suit{c.malpracticeSuits === 1 ? '' : 's'}
            </div>
          </Card>
        )}
        {c?.licenseRevoked && <Card className="p-4 mb-4"><Badge tone="bad">License Revoked</Badge></Card>}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Grind through medical school, match into a residency, and build a career treating
          patients — real skill saves lives, but a bad outcome can mean a malpractice suit.
        </p>
        <Button className="w-full" size="lg" onClick={() => run(enrollMedSchool)}>
          🎓 Enroll in Medical School
        </Button>
      </div>
    );
  }

  if (c.stage === 'med_school') {
    const ready = c.yearsOfService >= MED_SCHOOL_YEARS;
    return (
      <div>
        <SectionHeader title="🎓 Medical School" />
        <Card className="p-5 mb-4">
          <div className="text-xs text-brand-500 uppercase font-bold">Progress</div>
          <div className="font-extrabold text-lg">Year {c.yearsOfService}/{MED_SCHOOL_YEARS}</div>
        </Card>
        {!ready ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 px-1">Keep advancing the year to finish your studies.</p>
        ) : (
          <>
            <SectionHeader title="Match into a Residency" />
            <PillRow>
              {MEDICAL_SPECIALTIES.map((s) => (
                <Pill key={s.id} label={`${s.icon} ${s.name}`} active={specialtyPick === s.id} onClick={() => setSpecialtyPick(s.id)} />
              ))}
            </PillRow>
            <Card className="p-4 mt-2">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Difficulty {MEDICAL_SPECIALTY_BY_ID[specialtyPick].difficulty}/100 · Base salary {MEDICAL_SPECIALTY_BY_ID[specialtyPick].baseSalary.toLocaleString()}/yr
              </div>
              <Button className="w-full" onClick={() => run(matchResidency, specialtyPick)}>Match into {MEDICAL_SPECIALTY_BY_ID[specialtyPick].name}</Button>
            </Card>
          </>
        )}
      </div>
    );
  }

  const specialty = c.specialtyId ? MEDICAL_SPECIALTY_BY_ID[c.specialtyId] : null;

  return (
    <div>
      <SectionHeader title={c.stage === 'residency' ? '🏥 Residency' : '🩺 Attending Physician'} />
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">{specialty?.name} at {c.hospitalId}</div>
            <div className="font-extrabold text-lg">{c.stage === 'attending' ? MEDICAL_RANK_TITLES[c.rank] : `Resident, Year ${c.yearsOfService}`}</div>
          </div>
          {c.malpracticeSuits > 0 && <Badge tone="bad">⚖️ {c.malpracticeSuits}</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Skill" value={c.skill} />
          <StatBar label="Reputation" value={c.reputation} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {c.patientsSaved} saved · {c.patientsLost} lost · {c.publications} publication{c.publications === 1 ? '' : 's'}
        </div>
      </Card>

      <SectionHeader title="Actions" />
      <PillRow>
        <Pill label="🩹 Treat a Patient" tone="brand" onClick={() => run(treatPatient)} />
        {c.stage === 'attending' && <Pill label="📄 Publish Research" onClick={() => run(publishResearch)} />}
        {c.stage === 'attending' && c.rank < MEDICAL_RANK_TITLES.length - 1 && <Pill label="📈 Seek Promotion" onClick={() => run(seekPromotion)} />}
      </PillRow>

      <SectionHeader title="Exit" />
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
            Retire from medicine for good.
          </div>
          <Button size="sm" variant="danger" onClick={() => run(retireFromMedicine)}>🚪 Retire</Button>
        </div>
      </Card>
    </div>
  );
}
