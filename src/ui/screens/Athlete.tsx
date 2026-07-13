/**
 * Athlete: soccer, football and running career hub. Pick a sport, train, sign with a team (or
 * enter meets for running), play matches/races in real playable 3D, and track standings, career
 * stats, injuries and endorsements. The three match/race scenes are lazy-loaded and mounted only
 * while actually playing, exactly like Casino.tsx's fullscreen 3D takeover.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  negotiateContract, quickSimFixture, requestTrade, resolveMatch,
  resolveRace, retireAthlete, signEndorsement, standingsForLeague, startAthleteCareer,
  teamPrestige, trainAthlete, tryoutForTeam, type MatchOutcomeInput,
} from '../../sim/athletics';
import {
  ATHLETE_TEAMS, ATTRS_BY_SPORT, ENDORSEMENT_BRANDS, POSITIONS_BY_SPORT, RUNNING_EVENTS,
  RUNNING_EVENT_BY_ID, RUNNING_MEET_BY_ID, TEAM_BY_ID, TRAINING_BY_SPORT,
} from '../../data/athletics';
import type { AthleteSport } from '../../sim/types';
import { Badge, Button, Card, Modal, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';
import type { SoccerHud, SoccerMatchResult } from '../three/SoccerMatchScene';
import type { FootballHud, FootballMatchResult } from '../three/FootballMatchScene';
import type { RunningHud, RunningRaceResult } from '../three/RunningRaceScene';

const SoccerMatchScene = lazy(() => import('../three/SoccerMatchScene').then((m) => ({ default: m.SoccerMatchScene })));
const FootballMatchScene = lazy(() => import('../three/FootballMatchScene').then((m) => ({ default: m.FootballMatchScene })));
const RunningRaceScene = lazy(() => import('../three/RunningRaceScene').then((m) => ({ default: m.RunningRaceScene })));

const SceneFallback = <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">Loading…</div>;

const SPORT_META: Record<AthleteSport, { label: string; icon: string }> = {
  soccer: { label: 'Soccer', icon: '⚽' },
  football: { label: 'Football', icon: '🏈' },
  running: { label: 'Running', icon: '🏃' },
};

function attrLabel(sport: AthleteSport, attrId: string): string {
  return ATTRS_BY_SPORT[sport].find((a) => a.id === attrId)?.name ?? attrId;
}

export function Athlete() {
  const { state, run } = useGame();
  const [sportPick, setSportPick] = useState<AthleteSport>('soccer');
  const [positionPick, setPositionPick] = useState('ST');
  const [eventPick, setEventPick] = useState('100m');
  const [pickingTeam, setPickingTeam] = useState(false);
  const [pickingTrade, setPickingTrade] = useState(false);
  const [pickingTraining, setPickingTraining] = useState(false);
  const [pickingEndorsement, setPickingEndorsement] = useState(false);

  const [activeFixtureId, setActiveFixtureId] = useState<string | null>(null);
  const [racing, setRacing] = useState(false);
  const [soccerHud, setSoccerHud] = useState<SoccerHud | null>(null);
  const [footballHud, setFootballHud] = useState<FootballHud | null>(null);
  const [runningHud, setRunningHud] = useState<RunningHud | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches);
  const fsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = () => setIsPortrait(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const playing = !!activeFixtureId || racing;
  useEffect(() => {
    if (!playing) return;
    setFullscreen(true);
    const el = fsRef.current;
    Promise.resolve(el?.requestFullscreen?.())
      .then(() => (screen as any).orientation?.lock?.('landscape'))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const exitPlay = () => {
    setFullscreen(false);
    try { (screen as any).orientation?.unlock?.(); } catch { /* unsupported */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setActiveFixtureId(null);
    setRacing(false);
    setSoccerHud(null);
    setFootballHud(null);
    setRunningHud(null);
  };

  if (!state) return null;
  const p = state.player;
  const career = p.athlete;

  if (playing && career) {
    const isSoccer = career.sport === 'soccer';
    const isFootball = career.sport === 'football';
    const isRunning = career.sport === 'running';
    const team = career.teamId ? TEAM_BY_ID[career.teamId] : null;
    const fixture = career.fixtures.find((f) => f.id === activeFixtureId);
    const opponent = fixture ? TEAM_BY_ID[fixture.opponentTeamId] : null;

    return (
      <div ref={fsRef} className="fixed inset-0 z-[90] bg-black">
        <div className="absolute inset-0">
          <Suspense fallback={SceneFallback}>
            {isSoccer && fixture && team && opponent && (
              <SoccerMatchScene
                homeName={team.name} awayName={opponent.name}
                homeColor={team.colorPrimary} awayColor={opponent.colorPrimary}
                durationSeconds={90}
                onHud={setSoccerHud}
                onMatchEnd={(result: SoccerMatchResult) => {
                  const outcome: MatchOutcomeInput = {
                    fixtureId: fixture.id, playerGoals: result.playerGoals, playerAssists: result.playerAssists,
                    teamGoalsFor: result.homeScore, teamGoalsAgainst: result.awayScore,
                    playerTouchdowns: 0, playerPassingYards: 0, playerRushingYards: 0, playerReceivingYards: 0,
                    playerTackles: 0, playerInterceptions: 0, teamScoreFor: 0, teamScoreAgainst: 0,
                  };
                  run(resolveMatch, outcome);
                  exitPlay();
                }}
              />
            )}
            {isFootball && fixture && team && opponent && (
              <FootballMatchScene
                homeName={team.name} awayName={opponent.name}
                homeColor={team.colorPrimary} awayColor={opponent.colorPrimary}
                homePrestige={team.prestige} awayPrestige={opponent.prestige}
                durationSeconds={80}
                onHud={setFootballHud}
                onMatchEnd={(result: FootballMatchResult) => {
                  const outcome: MatchOutcomeInput = {
                    fixtureId: fixture.id, playerGoals: 0, playerAssists: 0, teamGoalsFor: 0, teamGoalsAgainst: 0,
                    playerTouchdowns: result.playerTouchdowns, playerPassingYards: result.playerPassingYards,
                    playerRushingYards: result.playerRushingYards, playerReceivingYards: 0, playerTackles: 0,
                    playerInterceptions: 0, teamScoreFor: result.homeScore, teamScoreAgainst: result.awayScore,
                  };
                  run(resolveMatch, outcome);
                  exitPlay();
                }}
              />
            )}
            {isRunning && career.event && career.nextMeetId && (
              <RunningRaceScene
                eventName={RUNNING_EVENT_BY_ID[career.event]?.name ?? career.event}
                tier={RUNNING_EVENT_BY_ID[career.event]?.type ?? 'sprint'}
                worldRecordSeconds={RUNNING_EVENT_BY_ID[career.event]?.worldRecordSeconds ?? 10}
                fieldSize={RUNNING_MEET_BY_ID[career.nextMeetId]?.fieldSize ?? 6}
                onHud={setRunningHud}
                onRaceEnd={(result: RunningRaceResult) => {
                  run(resolveRace, { meetId: career.nextMeetId!, playerTimeSeconds: result.finalTimeSeconds });
                  exitPlay();
                }}
              />
            )}
          </Suspense>
        </div>
        <button
          onClick={exitPlay}
          className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] right-[calc(0.5rem+env(safe-area-inset-right))] bg-black/60 hover:bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur transition-colors z-10"
        >
          ✕ Forfeit & Exit
        </button>
        {fullscreen && isPortrait && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-none px-8 z-10">
            <div className="text-center text-white">
              <div className="text-4xl mb-2 animate-pulse">🔄</div>
              <div className="text-sm font-semibold">Rotate your device for the best view</div>
            </div>
          </div>
        )}
        {(soccerHud || footballHud || runningHud) && (
          <div className="absolute top-[calc(0.5rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-xs font-bold px-4 py-1.5 rounded-full z-10">
            {soccerHud && `${soccerHud.homeScore} - ${soccerHud.awayScore} · ${soccerHud.minuteLabel}`}
            {footballHud && `${footballHud.homeScore} - ${footballHud.awayScore} · ${footballHud.down}${footballHud.down === 1 ? 'st' : footballHud.down === 2 ? 'nd' : footballHud.down === 3 ? 'rd' : 'th'} & ${footballHud.yardsToGo} · ${footballHud.clockLabel}`}
            {runningHud && `${(runningHud.distanceFrac * 100).toFixed(0)}% · place ${runningHud.place}/${runningHud.fieldSize} · stamina ${(runningHud.stamina * 100).toFixed(0)}%`}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // No active career (new or retired) — pick a sport and begin.
  // ---------------------------------------------------------------------------
  if (!career || career.retired) {
    const positions = POSITIONS_BY_SPORT[sportPick as 'soccer' | 'football'];
    return (
      <div>
        <SectionHeader title="🏟️ Athlete Career" />
        {career?.retired && (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase font-bold">Previous Career</div>
                <div className="font-bold">{SPORT_META[career.sport].icon} {SPORT_META[career.sport].label} · Overall {career.overallRating}</div>
              </div>
              {career.hallOfFame && <Badge tone="brand">🏆 Hall of Fame</Badge>}
            </div>
          </Card>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Pick a sport and start building a career — train up, sign with a team (or chase meets as a
          runner), and play real matches and races yourself.
        </p>
        <PillRow>
          {(['soccer', 'football', 'running'] as AthleteSport[]).map((s) => (
            <Pill key={s} label={`${SPORT_META[s].icon} ${SPORT_META[s].label}`} active={sportPick === s} tone="brand" onClick={() => setSportPick(s)} />
          ))}
        </PillRow>
        {sportPick === 'running' ? (
          <>
            <div className="text-xs text-slate-400 uppercase font-bold mt-4 mb-2">Event</div>
            <PillRow>
              {RUNNING_EVENTS.map((e) => (
                <Pill key={e.id} label={e.name} active={eventPick === e.id} onClick={() => setEventPick(e.id)} />
              ))}
            </PillRow>
          </>
        ) : (
          <>
            <div className="text-xs text-slate-400 uppercase font-bold mt-4 mb-2">Position</div>
            <PillRow>
              {positions.map((pos) => (
                <Pill key={pos.id} label={pos.name} active={positionPick === pos.id} onClick={() => setPositionPick(pos.id)} />
              ))}
            </PillRow>
          </>
        )}
        <Button
          className="w-full mt-4"
          size="lg"
          onClick={() => run(startAthleteCareer, sportPick, sportPick === 'running' ? eventPick : (positions.some((pos) => pos.id === positionPick) ? positionPick : positions[0].id))}
        >
          Begin Career
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Active career hub.
  // ---------------------------------------------------------------------------
  const isTeamSport = career.sport !== 'running';
  const positions = isTeamSport ? POSITIONS_BY_SPORT[career.sport as 'soccer' | 'football'] : [];
  const positionName = positions.find((pos) => pos.id === career.position)?.name ?? career.position;
  const team = career.teamId ? TEAM_BY_ID[career.teamId] : null;
  const nextMeet = career.nextMeetId ? RUNNING_MEET_BY_ID[career.nextMeetId] : null;
  const runningEvent = career.event ? RUNNING_EVENT_BY_ID[career.event] : null;
  const availableTeams = isTeamSport ? ATHLETE_TEAMS.filter((t) => t.sport === career.sport) : [];
  const tradeTargets = availableTeams.filter((t) => t.id !== career.teamId);
  const trainingPrograms = TRAINING_BY_SPORT[career.sport];
  const standings = career.leagueId ? standingsForLeague(state, career.leagueId) : [];
  const upcomingFixtures = career.fixtures.filter((f) => !f.played);
  const pastFixtures = career.fixtures.filter((f) => f.played).slice(-3).reverse();
  const eligibleBrands = ENDORSEMENT_BRANDS.filter((b) => career.overallRating >= b.minOverall && !career.endorsements.some((e) => e.brand === b.name));

  return (
    <div>
      <SectionHeader title={`${SPORT_META[career.sport].icon} Athlete Career`} />

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">{SPORT_META[career.sport].label} · {isTeamSport ? positionName : runningEvent?.name}</div>
            <div className="font-extrabold text-lg capitalize">{career.level.replace('_', ' ')}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {isTeamSport ? (team ? `${team.name} (${team.city})` : 'Free Agent') : (nextMeet ? `Next: ${nextMeet.name}` : 'No meet scheduled')}
            </div>
          </div>
          {career.hallOfFame && <Badge tone="brand">🏆 HOF</Badge>}
        </div>
        <StatBar label="Overall Rating" value={career.overallRating} />
        <div className="grid grid-cols-3 gap-2 mt-3">
          <StatBar label="Fitness" value={Math.round(career.fitness)} />
          <StatBar label="Form" value={Math.round(career.form)} />
          <StatBar label="Morale" value={Math.round(career.morale)} />
        </div>
        {career.currentInjury && (
          <div className="mt-3 text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-xl px-3 py-2">
            🚑 {career.currentInjury.name} — out ~{Math.max(0, career.currentInjury.weeksOut)} more weeks
          </div>
        )}
      </Card>

      <SectionHeader title="Actions" />
      <PillRow>
        <Pill label="💪 Train" onClick={() => setPickingTraining(true)} />
        {isTeamSport && !career.teamId && <Pill label="🖊️ Tryout" onClick={() => setPickingTeam(true)} />}
        {isTeamSport && career.teamId && career.contract && career.contract.yearsLeft <= 1 && (
          <Pill label="📄 Negotiate" onClick={() => run(negotiateContract)} />
        )}
        {isTeamSport && career.teamId && <Pill label="🔄 Request Trade" onClick={() => setPickingTrade(true)} />}
        {eligibleBrands.length > 0 && <Pill label="🤝 Endorsements" onClick={() => setPickingEndorsement(true)} />}
        <Pill label="🏳️ Retire" onClick={() => run(retireAthlete)} />
      </PillRow>

      {isTeamSport ? (
        <>
          <SectionHeader title="Schedule" />
          {!career.teamId && <Card className="p-4 mb-4 text-sm text-slate-500 dark:text-slate-400">Sign with a team to get a season schedule.</Card>}
          {career.teamId && upcomingFixtures.length === 0 && pastFixtures.length === 0 && (
            <Card className="p-4 mb-4 text-sm text-slate-500 dark:text-slate-400">Your season schedule generates at the next year advance.</Card>
          )}
          {upcomingFixtures.slice(0, 4).map((f) => {
            const opp = TEAM_BY_ID[f.opponentTeamId];
            return (
              <Card key={f.id} className="p-4 mb-2 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Week {f.week}</div>
                  <div className="font-bold">vs {opp?.name ?? 'Opponent'}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => (career.sport === 'soccer' ? setActiveFixtureId(f.id) : setActiveFixtureId(f.id))}>▶️ Play</Button>
                  <Button size="sm" variant="soft" onClick={() => run(quickSimFixture, f.id)}>⏭️ Sim</Button>
                </div>
              </Card>
            );
          })}
          {pastFixtures.length > 0 && (
            <div className="mb-4 space-y-2">
              {pastFixtures.map((f) => {
                const opp = TEAM_BY_ID[f.opponentTeamId];
                return (
                  <div key={f.id} className="flex items-center justify-between text-sm px-1">
                    <span className="text-slate-500 dark:text-slate-400">vs {opp?.name ?? 'Opponent'}</span>
                    <span className="font-semibold">{f.resultSummary} {f.playerRatingThisMatch != null && `· ${f.playerRatingThisMatch}/10`}</span>
                  </div>
                );
              })}
            </div>
          )}

          {career.leagueId && standings.length > 0 && (
            <>
              <SectionHeader title="Standings" />
              <Card className="p-4 mb-4">
                <div className="space-y-1">
                  {standings.map(({ team: t, ts }, i) => (
                    <div key={t.id} className={`flex items-center justify-between text-sm py-1 ${t.id === career.teamId ? 'font-bold text-brand-500' : ''}`}>
                      <span>{i + 1}. {t.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {ts.wins}-{ts.losses}{career.sport === 'soccer' ? `-${ts.draws}` : ''} · {ts.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          <SectionHeader title="Next Meet" />
          <Card className="p-4 mb-4 flex items-center justify-between">
            <div>
              <div className="font-bold">{nextMeet?.name ?? 'No meet scheduled'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{runningEvent?.name} · prestige {nextMeet?.prestige ?? 0}</div>
            </div>
            <Button onClick={() => setRacing(true)} disabled={!nextMeet}>🏁 Race</Button>
          </Card>
          {Object.keys(career.personalBests).length > 0 && (
            <>
              <SectionHeader title="Personal Bests" />
              <Card className="p-4 mb-4 space-y-1">
                {Object.entries(career.personalBests).map(([eventId, seconds]) => (
                  <div key={eventId} className="flex items-center justify-between text-sm">
                    <span>{RUNNING_EVENT_BY_ID[eventId]?.name ?? eventId}</span>
                    <span className="font-semibold">{seconds!.toFixed(2)}s</span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <SectionHeader title="Career Stats" />
      <Card className="p-4 mb-4 grid grid-cols-2 gap-y-2 text-sm">
        {career.sport === 'soccer' && (
          <>
            <div>Matches: <b>{career.careerStats.matchesPlayed}</b></div>
            <div>Goals: <b>{career.careerStats.goals}</b></div>
            <div>Assists: <b>{career.careerStats.assists}</b></div>
            <div>Clean sheets: <b>{career.careerStats.cleanSheets}</b></div>
          </>
        )}
        {career.sport === 'football' && (
          <>
            <div>Games: <b>{career.careerStats.matchesPlayed}</b></div>
            <div>Touchdowns: <b>{career.careerStats.touchdowns}</b></div>
            <div>Passing yds: <b>{career.careerStats.passingYards}</b></div>
            <div>Rushing yds: <b>{career.careerStats.rushingYards}</b></div>
          </>
        )}
        {career.sport === 'running' && (
          <>
            <div>Races: <b>{career.careerStats.racesRun}</b></div>
            <div>Wins: <b>{career.careerStats.racesWon}</b></div>
            <div>🥇🥈🥉: <b>{career.careerStats.medalsGold}/{career.careerStats.medalsSilver}/{career.careerStats.medalsBronze}</b></div>
          </>
        )}
      </Card>

      {career.endorsements.length > 0 && (
        <>
          <SectionHeader title="Endorsements" />
          <Card className="p-4 mb-4 space-y-2">
            {career.endorsements.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{e.brand}</span>
                <span className="font-semibold">{money(e.annualValue)}/yr · {e.yearsLeft}y left</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Team tryout picker */}
      <Modal open={pickingTeam} onClose={() => setPickingTeam(false)} title="Try Out for a Team">
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {availableTeams.map((t) => (
            <button
              key={t.id}
              onClick={() => { run(tryoutForTeam, t.id); setPickingTeam(false); }}
              className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
            >
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.city} · prestige {Math.round(teamPrestige(state, t.id))}</div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Trade request picker */}
      <Modal open={pickingTrade} onClose={() => setPickingTrade(false)} title="Request a Trade">
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {tradeTargets.map((t) => (
            <button
              key={t.id}
              onClick={() => { run(requestTrade, t.id); setPickingTrade(false); }}
              className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
            >
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.city} · prestige {Math.round(teamPrestige(state, t.id))}</div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Training picker */}
      <Modal open={pickingTraining} onClose={() => setPickingTraining(false)} title="Training">
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {trainingPrograms.map((prog) => (
            <button
              key={prog.id}
              onClick={() => { run(trainAthlete, prog.id); setPickingTraining(false); }}
              className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold">{prog.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Builds {attrLabel(career.sport, prog.attrId)} · current {Math.round(career.attributes[prog.attrId] ?? 0)}</div>
              </div>
              <div className="text-sm font-bold text-brand-500">{money(prog.cost)}</div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Endorsement picker */}
      <Modal open={pickingEndorsement} onClose={() => setPickingEndorsement(false)} title="Endorsement Offers">
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {eligibleBrands.length === 0 && <p className="text-center text-slate-400 py-6">No new offers right now.</p>}
          {eligibleBrands.map((b) => (
            <button
              key={b.id}
              onClick={() => { run(signEndorsement, b.id); setPickingEndorsement(false); }}
              className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold">{b.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{b.category}</div>
              </div>
              <div className="text-sm font-bold text-brand-500">~{money(b.baseValue)}/yr</div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
