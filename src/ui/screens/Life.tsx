/**
 * Life hub — the home screen, BitLife-style: an age ribbon with day-level
 * time controls, then the life log as the hero — chronological text entries
 * grouped under bold "Age N" headers, newest chapter first. The year itself
 * advances from the big AGE button in the app shell's tab bar. Below the
 * feed: the manage grid, social media, lifestyle chips, underworld, legacy.
 */
import { useState, type ReactNode } from 'react';
import { useGame, type Screen } from '../../store/gameStore';
import { adoptPet, attemptPrisonEscape, bribeJudge, buyLotteryTicket, buyScratchCard, commitSuicide, contestTerritory, CRIME_RANK_TITLES, declareCrimeWar, doActivity, donateToFoundation, enterWitnessProtection, foundCharityFoundation, goStraight, heist, issuePublicApology, joinCrimeFamily, playWithPet, postOnSocialMedia, proposeCrimeAlliance, requestParole, retire, socialMediaPostStyles, writeMemoir } from '../../sim/actions';
import { PET_CATALOG, PET_SPEC_BY_KIND } from '../../sim/pets';
import { playerCrimeFamily } from '../../sim/crime';
import { netWorth } from '../../sim/engine';
import { Badge, Button, Card, CircleTile, Modal, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';
import {
  IconArrowRight,
  IconAssets,
  IconBusiness,
  IconCareer,
  IconHeart,
  IconMarket,
  IconNews,
  IconPolitics,
  IconStats,
  IconWorld,
} from '../icons';

const HUB: { screen: Screen; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
  { screen: 'career', label: 'Career', Icon: IconCareer },
  { screen: 'business', label: 'Business', Icon: IconBusiness },
  { screen: 'market', label: 'Markets', Icon: IconMarket },
  { screen: 'assets', label: 'Assets', Icon: IconAssets },
  { screen: 'politics', label: 'Politics', Icon: IconPolitics },
  { screen: 'family', label: 'Family', Icon: IconHeart },
  { screen: 'world', label: 'World', Icon: IconWorld },
  { screen: 'news', label: 'News', Icon: IconNews },
  { screen: 'stats', label: 'Stats', Icon: IconStats },
];

const LOG_DOT: Record<string, string> = {
  good: 'bg-emerald-500',
  bad: 'bg-rose-500',
  money: 'bg-amber-500',
  politics: 'bg-violet-500',
  business: 'bg-brand-500',
  milestone: 'bg-fuchsia-500',
  info: 'bg-slate-300 dark:bg-ink-600',
};

export function Life() {
  const { state, setScreen, nextDay, nextWeek, run, eventQueue, activeEvent } = useGame();
  const [showMoreActivities, setShowMoreActivities] = useState(false);
  const [confirmingSuicide, setConfirmingSuicide] = useState(false);
  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const nw = netWorth(state);
  const pendingCount = eventQueue.length + (activeEvent ? 1 : 0);

  // BitLife-style feed: entries grouped under bold "Age N" headers, newest age
  // first so the latest chapter of your life is always at the top.
  const logGroups: { age: number; year: number; entries: typeof state.lifeLog }[] = [];
  for (const e of state.lifeLog.slice(-70)) {
    const last = logGroups[logGroups.length - 1];
    if (last && last.age === e.age) last.entries.push(e);
    else logGroups.push({ age: e.age, year: e.year, entries: [e] });
  }
  logGroups.reverse();

  const badgeFor = (s: Screen): string | number | undefined => {
    if (s === 'business') return p.companies.filter((id) => state.companies[id]?.status === 'active').length || undefined;
    if (s === 'politics') return p.office ? '★' : p.campaign ? '!' : undefined;
    if (s === 'family') return p.spouseId ? '💍' : undefined;
    return undefined;
  };

  return (
    <div className="space-y-1">
      {/* Age ribbon — day progress plus the sub-year time controls */}
      <Card className="mt-2 p-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-extrabold leading-tight">Age {p.age} — {state.year}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            Day {state.calendarDay + 1} of 365 · net worth {money(nw, home.currencySymbol)}
          </div>
          <div className="h-1 mt-1.5 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${((state.calendarDay + 1) / 365) * 100}%` }} />
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="soft" disabled={pendingCount > 0} onClick={nextDay}>+1 Day</Button>
          <Button size="sm" variant="soft" disabled={pendingCount > 0} onClick={nextWeek}>+1 Wk</Button>
        </div>
      </Card>

      {pendingCount > 0 && (
        <Card className="p-3 mt-2 border-2 border-amber-400 text-sm font-semibold text-amber-600 dark:text-amber-400">
          ⏳ {pendingCount} event{pendingCount > 1 ? 's' : ''} to resolve before time can move on.
        </Card>
      )}

      {/* The life log — the BitLife-style heart of the screen */}
      <Card className="mt-3 divide-y divide-slate-100 dark:divide-ink-800 overflow-hidden">
        {logGroups.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Your story starts now. Hit the AGE button below.
          </div>
        )}
        {logGroups.map((g, gi) => (
          <div key={`${g.age}-${gi}`} className="px-4 py-3">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-sm font-black text-brand-600 dark:text-brand-400">Age {g.age}</span>
              <span className="text-[11px] font-semibold text-slate-400">{g.year}</span>
            </div>
            <div className="space-y-1.5">
              {g.entries.map((entry, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${LOG_DOT[entry.kind] ?? LOG_DOT.info}`} />
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">{entry.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* Standing in society — the stats the bottom strip doesn't cover */}
      <Card className="p-4 mt-3 grid grid-cols-3 gap-3">
        <StatBar label="Reputation" value={p.reputation} />
        <StatBar label="Popularity" value={p.popularity} />
        <StatBar label={`Stress${p.burnoutUntilYear !== null && state.year <= p.burnoutUntilYear ? ' 🔥' : ''}`} value={p.stress} />
      </Card>

      {/* Bucket list — this life's personal goals, each paying out on completion */}
      {(state.bucketList?.length ?? 0) > 0 && (
        <>
          <SectionHeader title="🎯 Bucket List" />
          <Card className="p-4 space-y-2.5">
            {state.bucketList.map((g) => (
              <div key={g.defId} className="flex items-start gap-2.5">
                <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                  g.done ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-ink-800 text-slate-400'
                }`}>
                  {g.done ? '✓' : ''}
                </span>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold leading-snug ${g.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                    {g.description}
                  </div>
                  <div className="text-[11px] text-slate-400">Reward: {money(g.rewardMoney)} · +{g.rewardHappiness} happiness</div>
                </div>
              </div>
            ))}
            <div className="text-[11px] font-bold text-brand-600 dark:text-brand-400 pt-1">
              {state.bucketList.filter((g) => g.done).length} of {state.bucketList.length} complete
            </div>
          </Card>
        </>
      )}

      {/* Status chips */}
      <PillRow>
        <Badge tone={home.economy.regime === 'recession' || home.economy.regime === 'depression' ? 'bad' : home.economy.regime === 'boom' ? 'good' : 'neutral'}>
          📈 {home.economy.regime}
        </Badge>
        <Badge tone="brand">Karma {Math.round(p.karma)}</Badge>
        {p.notoriety > 3 && <Badge tone="warn">Notoriety {Math.round(p.notoriety)}</Badge>}
        {p.criminalRecord > 0 && <Badge tone="bad">Record ×{p.criminalRecord}</Badge>}
        {p.partyId && <Badge tone="brand">{home.parties.find((x) => x.id === p.partyId)?.name}</Badge>}
        <Badge tone="good">PC {Math.round(p.politicalCapital)}</Badge>
        {p.crimeFamilyId && <Badge tone="bad">🕶️ {CRIME_RANK_TITLES[p.crimeRank]}</Badge>}
        {p.turfControl > 0 && <Badge tone="bad">Turf {Math.round(p.turfControl)}</Badge>}
        {p.dirtyMoney > 0 && <Badge tone="warn">Dirty {money(p.dirtyMoney)}</Badge>}
        {p.inWitnessProtection && <Badge tone="good">🛡️ Protected</Badge>}
        {p.investigationHeat > 40 && <Badge tone="warn">🕵️ Heat {Math.round(p.investigationHeat)}</Badge>}
      </PillRow>

      {p.inJailYears > 0 && (
        <Card className="p-4 mt-4 border-2 border-rose-400">
          <div className="flex items-center justify-between mb-2">
            <span className="font-extrabold">🔒 In Prison</span>
            <Badge tone="bad">{p.inJailYears} yr{p.inJailYears > 1 ? 's' : ''} left</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Served {p.yearsServedThisSentence} yr{p.yearsServedThisSentence === 1 ? '' : 's'} of this sentence.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="soft" onClick={() => run(bribeJudge)}>💵 Bribe Judge</Button>
            <Button size="sm" variant="danger" onClick={() => run(attemptPrisonEscape)}>🏃 Attempt Escape</Button>
            <Button size="sm" variant="soft" className="col-span-2" disabled={p.yearsServedThisSentence < 1} onClick={() => run(requestParole)}>
              ⚖️ Request Parole
            </Button>
          </div>
        </Card>
      )}

      {/* Hub grid — circular icon tiles */}
      <SectionHeader title="Manage" />
      <div className="grid grid-cols-4 gap-y-5 gap-x-2">
        {HUB.map((h, i) => (
          <CircleTile
            key={h.screen}
            icon={<h.Icon className="w-7 h-7" />}
            label={h.label}
            index={i}
            badge={badgeFor(h.screen)}
            onClick={() => setScreen(h.screen)}
          />
        ))}
      </div>

      {/* Social media */}
      <SectionHeader title="Social Media" />
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="font-bold text-sm">👥 {p.socialFollowers.toLocaleString()} followers</div>
          {p.cancelledUntilYear !== null && p.cancelledUntilYear >= state.year && (
            <Badge tone="bad">🔥 Cancelled until {p.cancelledUntilYear}</Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          {p.cancelledUntilYear !== null && p.cancelledUntilYear >= state.year
            ? "You're in the middle of a backlash — posting is off the table until it passes."
            : 'Post once a year. Bigger reach means bigger risk of it blowing up.'}
        </p>
        <PillRow>
          {socialMediaPostStyles().map((s) => (
            <Pill
              key={s.id}
              label={`${s.icon} ${s.label}`}
              disabled={p.lastSocialPostYear === state.year || (p.cancelledUntilYear !== null && p.cancelledUntilYear >= state.year)}
              onClick={() => run(postOnSocialMedia, s.id)}
            />
          ))}
        </PillRow>
      </Card>

      {/* Lifestyle quick actions */}
      <SectionHeader title="Lifestyle" />
      <PillRow>
        <Pill label="🏖️ Vacation" onClick={() => run(doActivity, 'vacation')} />
        <Pill label="💪 Gym" onClick={() => run(doActivity, 'gym')} />
        <Pill label="🩺 Doctor" onClick={() => run(doActivity, 'doctor')} />
        <Pill label="🧘 Meditate" onClick={() => run(doActivity, 'meditate')} />
        <Pill label="🎉 Party" onClick={() => run(doActivity, 'party')} />
        <Pill label="❤️ Charity" onClick={() => run(doActivity, 'charity')} />
        <Pill label="📚 Book Club" onClick={() => run(doActivity, 'book_club')} />
        <Pill label="🛋️ Therapy" onClick={() => run(doActivity, 'therapy')} />
        <Pill label="🎸 Instrument" onClick={() => run(doActivity, 'learn_instrument')} />
        <Pill label="🚗 Road Trip" onClick={() => run(doActivity, 'road_trip')} />
        <Pill label="🖼️ Art Collecting" onClick={() => run(doActivity, 'art_collecting')} />
        <Pill label="🍷 Wine Tasting" onClick={() => run(doActivity, 'wine_tasting')} />
        <Pill label="🃏 Poker Night" onClick={() => run(doActivity, 'poker_night')} />
        <Pill label="🤝 Volunteer" onClick={() => run(doActivity, 'volunteer')} />
        <Pill label="🎓 Seminar" onClick={() => run(doActivity, 'seminar')} />
        <Pill label="💆 Spa Day" onClick={() => run(doActivity, 'spa_day')} />
        <Pill label="🔨 Home Improve" onClick={() => run(doActivity, 'home_improvement')} />
        <Pill label="✍️ Blog" onClick={() => run(doActivity, 'blog')} />
        <Pill label="🗣️ Language" onClick={() => run(doActivity, 'learn_language')} />
        <Pill label="🦁 Zoo" onClick={() => run(doActivity, 'zoo_visit')} />
        <Pill label="🎬 Movie Theater" onClick={() => run(doActivity, 'movie_theater')} />
        {p.age >= 18 && <Pill label="🪩 Nightlife" onClick={() => run(doActivity, 'nightlife')} />}
        <Pill label={showMoreActivities ? '▲ Fewer' : '▼ More'} onClick={() => setShowMoreActivities((v) => !v)} />
      </PillRow>
      {showMoreActivities && (
      <PillRow>
        <Pill label="🧘‍♀️ Yoga" onClick={() => run(doActivity, 'yoga')} />
        <Pill label="🍳 Cooking Class" onClick={() => run(doActivity, 'cooking_class')} />
        <Pill label="⛳ Golf Day" onClick={() => run(doActivity, 'golf_day')} />
        <Pill label="♟️ Chess Tournament" onClick={() => run(doActivity, 'chess_tournament')} />
        <Pill label="⛵ Sailing Lesson" onClick={() => run(doActivity, 'sailing_lesson')} />
        <Pill label="🪂 Skydiving" onClick={() => run(doActivity, 'skydiving')} />
        <Pill label="🏃 Marathon Training" onClick={() => run(doActivity, 'marathon_training')} />
        <Pill label="🏛️ Museum Visit" onClick={() => run(doActivity, 'museum_visit')} />
        <Pill label="🎤 Live Concert" onClick={() => run(doActivity, 'live_concert')} />
        <Pill label="🏕️ Camping Trip" onClick={() => run(doActivity, 'camping_trip')} />
        <Pill label="🛥️ Yacht Day" onClick={() => run(doActivity, 'yacht_day')} />
        <Pill label="🍇 Wine Country Tour" onClick={() => run(doActivity, 'wine_country_tour')} />
        <Pill label="🖼️ Gallery Opening" onClick={() => run(doActivity, 'gallery_opening')} />
        <Pill label="🎣 Fishing Trip" onClick={() => run(doActivity, 'fishing_trip')} />
        <Pill label="🥋 Martial Arts" onClick={() => run(doActivity, 'martial_arts')} />
        <Pill label="🎙️ Stand-Up Comedy" onClick={() => run(doActivity, 'stand_up_comedy')} />
        <Pill label="🎓 Public Speaking" onClick={() => run(doActivity, 'public_speaking_course')} />
        <Pill label="💻 Coding Bootcamp" onClick={() => run(doActivity, 'coding_bootcamp')} />
        <Pill label="🔐 Cybersecurity Course" onClick={() => run(doActivity, 'cybersecurity_course')} />
        <Pill label="💰 Personal Finance Course" onClick={() => run(doActivity, 'personal_finance_course')} />
        <Pill label="🏢 Industry Conference" onClick={() => run(doActivity, 'industry_conference')} />
        <Pill label="🚀 Startup Weekend" onClick={() => run(doActivity, 'startup_weekend')} />
        <Pill label="🧑‍🏫 Life Coaching" onClick={() => run(doActivity, 'life_coaching')} />
        <Pill label="🌄 Mindfulness Retreat" onClick={() => run(doActivity, 'mindfulness_retreat')} />
        <Pill label="🗣️ Debate Club" onClick={() => run(doActivity, 'debate_club')} />
        <Pill label="🎭 Improv Class" onClick={() => run(doActivity, 'improv_class')} />
        <Pill label="💃 Dance Lessons" onClick={() => run(doActivity, 'dance_lessons')} />
        <Pill label="🩹 First Aid Course" onClick={() => run(doActivity, 'first_aid_course')} />
        <Pill label="📈 Investment Seminar" onClick={() => run(doActivity, 'investment_seminar')} />
        <Pill label="🤝 Negotiation Workshop" onClick={() => run(doActivity, 'negotiation_workshop')} />
      </PillRow>
      )}
      {(p.notoriety > 0 || p.reputation < 50) && (
        <PillRow>
          <Pill label="🙏 Issue Public Apology" onClick={() => run(issuePublicApology)} />
        </PillRow>
      )}

      {/* Pets — real companions that age, bond, and pass on */}
      <SectionHeader title="🐾 Pets" />
      <Card className="p-4 space-y-3">
        {(p.pets ?? []).map((pet) => {
          const spec = PET_SPEC_BY_KIND[pet.kind];
          const playedThisYear = p.actionCooldowns[`pet_play_${pet.id}`] === state.year;
          return (
            <div key={pet.id} className="flex items-center gap-3">
              <span className="text-2xl shrink-0">{spec.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm leading-tight">{pet.name} <span className="text-[11px] font-semibold text-slate-400">· {spec.label}, age {pet.ageYears}</span></div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <StatBar label="Bond" value={pet.bond} />
                  <StatBar label="Health" value={pet.health} />
                </div>
              </div>
              <Button size="sm" variant="soft" disabled={playedThisYear} onClick={() => run(playWithPet, pet.id)}>
                {playedThisYear ? 'Played' : '🎾 Play'}
              </Button>
            </div>
          );
        })}
        {(p.pets ?? []).length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A pet boosts your happiness every year in proportion to the bond you build — and a loyal one might just come through for you.
          </p>
        )}
        {(p.pets ?? []).length < 4 && (
          <PillRow>
            {PET_CATALOG.map((spec) => (
              <Pill key={spec.kind} label={`${spec.icon} ${spec.label} (${money(spec.cost)})`} onClick={() => run(adoptPet, spec.kind)} />
            ))}
          </PillRow>
        )}
      </Card>

      {/* Lottery — instant scratch-and-win dopamine, capped per year */}
      <SectionHeader title="🎟️ Lottery" />
      <Card className="p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Feeling lucky? The jackpot is $2,000,000. Results are instant — and the odds are exactly as bad as real life.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" disabled={(p.lotteryTicketsThisYear ?? 0) >= 20} onClick={() => run(buyLotteryTicket)}>
            🎟️ Ticket ($100)
          </Button>
          <Button variant="soft" disabled={(p.scratchCardsThisYear ?? 0) >= 30} onClick={() => run(buyScratchCard)}>
            🎫 Scratch Card ($50)
          </Button>
        </div>
        <div className="text-[11px] text-slate-400 mt-2 text-center">
          {(p.lotteryTicketsThisYear ?? 0)}/20 tickets · {(p.scratchCardsThisYear ?? 0)}/30 cards this year
        </div>
      </Card>

      <SectionHeader title="Underworld" />
      <PillRow>
        {!p.crimeFamilyId ? (
          <>
            <Pill label="🕶️ Join Crime Family" onClick={() => run(joinCrimeFamily)} />
            {!p.inWitnessProtection && p.criminalRecord > 0 && (
              <Pill label="🛡️ Witness Protection ($100k)" onClick={() => run(enterWitnessProtection)} />
            )}
          </>
        ) : (
          <>
            <Pill label="💰 Heist" onClick={() => run(heist)} />
            <Pill label="🗺️ Contest Territory" onClick={() => run(contestTerritory)} />
            <Pill label="🚪 Go Straight" onClick={() => run(goStraight)} />
          </>
        )}
      </PillRow>
      {(() => {
        const myFamily = playerCrimeFamily(state);
        const families = state.crimeFamilies.filter((f) => f.countryId === p.countryId && !f.disbanded);
        if (families.length === 0) return null;
        return (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-slate-400 px-1">
              The real crime families operating in your country — they war, ally, and get crushed by the law on their own, whether or not you're in one.
            </p>
            {families.map((f) => {
              const isMine = myFamily?.id === f.id;
              const atWar = myFamily ? myFamily.atWarWith.includes(f.id) : false;
              const allied = myFamily ? myFamily.alliedWith.includes(f.id) : false;
              const boss = state.npcs[f.bossId];
              return (
                <Card key={f.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold truncate" title={f.name}>{f.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        Boss: {boss?.name ?? 'Unknown'} · strength {Math.round(f.strength)} · turf {Math.round(f.turf)}% · heat {Math.round(f.heat)}
                      </div>
                    </div>
                    {isMine ? <Badge tone="brand">Your Family</Badge> : atWar ? <Badge tone="bad">At War</Badge> : allied ? <Badge tone="good">Allied</Badge> : null}
                  </div>
                  {myFamily && !isMine && !atWar && !allied && (
                    <div className="grid grid-cols-2 gap-2">
                      <Pill label="🤝 Propose Alliance" onClick={() => run(proposeCrimeAlliance, f.id)} />
                      <Pill label="⚔️ Declare War" onClick={() => run(declareCrimeWar, f.id)} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      <SectionHeader title="Drug Empire" />
      <Card className="p-4 mb-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setScreen('drugs')}>
        <div>
          <div className="font-bold">🌿 {p.drugOperation?.active ? 'Run the Operation' : 'Get Into the Game'}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Buy, produce, and sell product; build out a stash house, grow op, or lab; fight for turf.</div>
        </div>
        <IconArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
      </Card>

      <SectionHeader title="Casino" />
      <Card className="p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setScreen('casino')}>
        <div>
          <div className="font-bold">🎰 Visit the Casino</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Named slot machines with real jackpots, blackjack, roulette, high-stakes poker.</div>
        </div>
        <IconArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
      </Card>

      <SectionHeader title="Legacy" />
      <Card className="p-4 mb-4 space-y-3">
        {p.foundation ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">❤️ {p.foundation.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Endowment {money(p.foundation.endowment)} · given {money(p.foundation.totalGiven)} to date</div>
            </div>
            <Button size="sm" variant="soft" onClick={() => run(donateToFoundation, 100_000)}>Endow $100k</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">Found a charitable foundation ($250k endowment). It grants 5% a year, building karma and reputation forever.</div>
            <Button size="sm" variant="soft" onClick={() => run(foundCharityFoundation, '')}>Found</Button>
          </div>
        )}
        {p.memoir ? (
          <div className="text-xs text-slate-500 dark:text-slate-400">📖 "{p.memoir.title}" is earning {money(p.memoir.royaltyPerYear)}/yr in royalties for {p.memoir.yearsLeft} more year(s).</div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">Write your memoir (age 35+). Royalties for 5 years, scaled by your fame — and infamy.</div>
            <Button size="sm" variant="soft" onClick={() => run(writeMemoir, '')}>Publish</Button>
          </div>
        )}
        {!p.retired && p.age >= 60 && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">Formally retire: quit working with a pension based on your final salary.</div>
            <Button size="sm" variant="soft" onClick={() => run(retire)}>🌅 Retire</Button>
          </div>
        )}
        {p.retired && <div className="text-xs text-emerald-500 font-semibold">🌅 Retired · pension {money(p.pensionIncome)}/yr</div>}
      </Card>

      {p.challenge && (
        <>
          <SectionHeader title="Challenge" />
          <Card className="p-4 mb-4">
            <div className="font-semibold text-sm mb-1">🎯 {p.challenge.description}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Deadline: {p.challenge.deadlineYear} · Reward: {money(p.challenge.rewardMoney)}</div>
          </Card>
        </>
      )}

      <SectionHeader title="Mind & Body" />
      <Card className="p-4 mb-4 border border-rose-500/30">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
            If things ever feel unbearable in real life, please reach out to a crisis line — this button only affects this fictional life.
          </div>
          <Button size="sm" variant="danger" onClick={() => setConfirmingSuicide(true)}>💀 Suicide</Button>
        </div>
      </Card>
      <Modal open={confirmingSuicide} onClose={() => setConfirmingSuicide(false)} title="Are you sure?">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          This ends {p.name}'s life immediately and permanently. There is no undo.
        </p>
        <div className="flex gap-2">
          <Button className="flex-1" variant="ghost" onClick={() => setConfirmingSuicide(false)}>Cancel</Button>
          <Button className="flex-1" variant="danger" onClick={() => { setConfirmingSuicide(false); run(commitSuicide); }}>
            End it
          </Button>
        </div>
      </Modal>

    </div>
  );
}
