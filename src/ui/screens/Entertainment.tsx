/**
 * Entertainment Career hub: actor or musician fame path. Simple confirm-and-go actions like
 * Casino/Drugs/Military — no dedicated 3D scene (see data/entertainment.ts for the static catalog).
 */
import { useGame } from '../../store/gameStore';
import {
  attendAwardsShow, auditionForProject, courtControversy, goOnTour, hireAgent,
  retireFromEntertainment, startEntertainmentCareer, trainCraft,
} from '../../sim/entertainment';
import { PROJECT_BUDGET_TIERS } from '../../data/entertainment';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';

export function Entertainment() {
  const { state, run } = useGame();
  if (!state) return null;
  const p = state.player;
  const c = p.entertainmentCareer;

  if (!c || !c.active) {
    return (
      <div>
        <SectionHeader title="🎬 Entertainment" />
        {c?.retired && (
          <Card className="p-4 mb-4">
            <div className="text-xs text-slate-400 uppercase font-bold">Retired Career</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Peak fame {Math.round(c.fame)} · {c.projects.length} project{c.projects.length === 1 ? '' : 's'} · lifetime earnings {money(c.wealth)}
            </div>
          </Card>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Chase stardom as an actor or a musician: train your craft, land roles or record deals,
          sign with an agent, tour, court controversy, and win the awards that make you a legend.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => run(startEntertainmentCareer, 'actor')}>🎭 Try Acting</Button>
          <Button size="lg" onClick={() => run(startEntertainmentCareer, 'musician')}>🎤 Try Music</Button>
        </div>
      </div>
    );
  }

  const tier = [...PROJECT_BUDGET_TIERS].reverse().find((t) => c.fame >= t.minFame) ?? PROJECT_BUDGET_TIERS[0];
  const recentProjects = [...c.projects].reverse().slice(0, 5);

  return (
    <div>
      <SectionHeader title={c.track === 'actor' ? '🎭 Acting Career' : '🎤 Music Career'} />

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">Status</div>
            <div className="font-extrabold text-lg">Fame {Math.round(c.fame)}/100</div>
          </div>
          {c.hasAgent && <Badge tone="brand">🤝 Agented</Badge>}
          {c.feudTargetName && <Badge tone="bad">🔥 Feuding</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Fame" value={c.fame} />
          <StatBar label="Talent" value={c.talent} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Lifetime earnings {money(c.wealth)} · {c.projects.length} project{c.projects.length === 1 ? '' : 's'} · currently eligible for {tier.label} budgets
          {c.feudTargetName && ` · feuding with ${c.feudTargetName}`}
        </div>
      </Card>

      <SectionHeader title="Actions" />
      <PillRow>
        <Pill label="📚 Train Craft" onClick={() => run(trainCraft)} />
        <Pill label={c.track === 'actor' ? '🎬 Audition for a Role' : '💿 Pitch an Album'} tone="brand" onClick={() => run(auditionForProject)} />
        {c.track === 'musician' && <Pill label="🎤 Go On Tour" onClick={() => run(goOnTour)} />}
        {!c.hasAgent && <Pill label="🤝 Hire an Agent" onClick={() => run(hireAgent)} />}
        <Pill label="📸 Court Controversy" onClick={() => run(courtControversy)} />
        <Pill label="🏆 Attend Awards Show" onClick={() => run(attendAwardsShow)} />
      </PillRow>

      {recentProjects.length > 0 && (
        <>
          <SectionHeader title="Filmography / Discography" />
          <div className="space-y-2 mb-4">
            {recentProjects.map((proj) => (
              <Card key={proj.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{proj.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{proj.yearReleased} · Score {Math.round(proj.performanceScore)}</div>
                </div>
                {proj.awardsWon.length > 0 && <Badge tone="good">🏆 {proj.awardsWon.length}</Badge>}
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Exit" />
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
            Step away from the spotlight for good — your filmography stays, but the career ends.
          </div>
          <Button size="sm" variant="danger" onClick={() => run(retireFromEntertainment)}>🚪 Retire</Button>
        </div>
      </Card>
    </div>
  );
}
