/**
 * Space Program hub: join an agency, train, and fly missions with real fatality risk. Simple
 * confirm-and-go actions like Casino/Drugs — no dedicated 3D scene (see data/space.ts for the
 * static catalog).
 */
import { useGame } from '../../store/gameStore';
import { joinSpaceAgency, launchMission, retireFromSpaceProgram, seekAstronautPromotion, trainForMission } from '../../sim/space';
import { ASTRONAUT_RANK_TITLES, MISSIONS, SPACE_AGENCIES } from '../../data/space';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';

export function Space() {
  const { state, run } = useGame();
  if (!state) return null;
  const p = state.player;
  const c = p.astronaut;

  if (!c || !c.active) {
    return (
      <div>
        <SectionHeader title="🚀 Space Program" />
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Join a national or private space agency, train hard, and fly real missions —
          orbital flights, station rotations, a lunar landing, even Mars. Every launch carries
          genuine risk: a failed mission can end your life, not just your career.
        </p>
        <div className="space-y-2">
          {SPACE_AGENCIES.map((a) => (
            <Button key={a} className="w-full" size="lg" onClick={() => run(joinSpaceAgency, a)}>🚀 Join {a}</Button>
          ))}
        </div>
      </div>
    );
  }

  const mission = c.activeMission;
  const missionDef = mission ? MISSIONS.find((m) => m.kind === mission.kind) : null;

  return (
    <div>
      <SectionHeader title="🚀 Astronaut Career" />
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">{c.agencyId}</div>
            <div className="font-extrabold text-lg">{ASTRONAUT_RANK_TITLES[c.rank]}</div>
          </div>
          {c.walkedOnMoon && <Badge tone="brand">🌕 Moonwalker</Badge>}
          {c.walkedOnMars && <Badge tone="brand">🔴 Mars</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Training" value={c.trainingScore} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {c.missionsFlown} mission{c.missionsFlown === 1 ? '' : 's'} flown · {c.hoursInSpace.toLocaleString()} hours in space
        </div>
      </Card>

      {mission && missionDef ? (
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-sm">{missionDef.icon} {mission.name}</div>
            <Badge tone="warn">In Progress</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Launched {mission.startYear} · {mission.durationYears} year mission · danger {Math.round(mission.danger * 100)}%
          </p>
        </Card>
      ) : (
        <>
          <SectionHeader title="Actions" />
          <PillRow>
            <Pill label="🏋️ Train" onClick={() => run(trainForMission)} />
            {c.rank < ASTRONAUT_RANK_TITLES.length - 1 && <Pill label="📈 Seek Promotion" onClick={() => run(seekAstronautPromotion)} />}
          </PillRow>

          <SectionHeader title="Launch a Mission" />
          <div className="space-y-2 mb-4">
            {MISSIONS.map((m) => {
              const locked = c.rank < m.minRank || c.trainingScore < m.minTrainingScore;
              return (
                <Card key={m.kind} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{m.icon} {m.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {m.durationYears}yr · danger {Math.round(m.baseDanger * 100)}% · needs {ASTRONAUT_RANK_TITLES[m.minRank]}, training {m.minTrainingScore}+
                    </div>
                  </div>
                  <Button size="sm" variant="soft" disabled={locked} onClick={() => run(launchMission, m.kind)}>
                    {locked ? 'Locked' : 'Launch'}
                  </Button>
                </Card>
              );
            })}
          </div>

          <SectionHeader title="Exit" />
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">Retire from the space program.</div>
              <Button size="sm" variant="danger" onClick={() => run(retireFromSpaceProgram)}>🚪 Retire</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
