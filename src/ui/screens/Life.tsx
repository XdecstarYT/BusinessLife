/**
 * Life hub — the home screen. Featured "advance year" card, player stat bars,
 * a grid of circular icon tiles that navigate the game (mirroring the
 * reference's "Featured brands" grid), quick lifestyle chips, and the life
 * log feed. This is the screen the reference image most directly informs.
 */
import { useState, type ReactNode } from 'react';
import { useGame, type Screen } from '../../store/gameStore';
import { attemptPrisonEscape, bribeJudge, contestTerritory, CRIME_RANK_TITLES, declareCrimeWar, doActivity, donateToFoundation, enterWitnessProtection, foundCharityFoundation, goStraight, heist, issuePublicApology, joinCrimeFamily, postOnSocialMedia, proposeCrimeAlliance, requestParole, retire, socialMediaPostStyles, writeMemoir } from '../../sim/actions';
import { playerCrimeFamily } from '../../sim/crime';
import { titleForRank } from '../../data/careers';
import { netWorth } from '../../sim/engine';
import { Badge, Button, Card, CircleTile, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';
import {
  IconArrowRight,
  IconAssets,
  IconBrain,
  IconBusiness,
  IconCareer,
  IconHeart,
  IconMarket,
  IconNews,
  IconPolitics,
  IconSpark,
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

const LOG_TONE: Record<string, string> = {
  good: 'border-l-emerald-500',
  bad: 'border-l-rose-500',
  money: 'border-l-amber-500',
  politics: 'border-l-violet-500',
  business: 'border-l-brand-500',
  milestone: 'border-l-fuchsia-500',
  info: 'border-l-slate-300 dark:border-l-ink-700',
};

export function Life() {
  const { state, setScreen, nextYear, nextDay, nextWeek, run, eventQueue, activeEvent } = useGame();
  const [showMoreActivities, setShowMoreActivities] = useState(false);
  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;
  const nw = netWorth(state);
  const pendingCount = eventQueue.length + (activeEvent ? 1 : 0);
  const recentLog = [...state.lifeLog].slice(-14).reverse();

  const badgeFor = (s: Screen): string | number | undefined => {
    if (s === 'business') return p.companies.filter((id) => state.companies[id]?.status === 'active').length || undefined;
    if (s === 'politics') return p.office ? '★' : p.campaign ? '!' : undefined;
    if (s === 'family') return p.spouseId ? '💍' : undefined;
    return undefined;
  };

  return (
    <div className="space-y-1">
      {/* Featured hero: advance year */}
      <Card className="overflow-hidden mt-2">
        <div className="bg-gradient-to-br from-brand-600 via-brand-500 to-violet-500 p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-80">Net Worth</div>
              <div className="text-3xl font-black leading-tight">{money(nw, home.currencySymbol)}</div>
              <div className="text-sm opacity-90 mt-1">
                {p.office ? `${p.office.title} of ${p.office.regionName}` : p.job ? titleForRank(p.job.title, p.job.rank) : 'Independent'}
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <IconSpark className="w-8 h-8" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs opacity-80 mt-4 mb-1">
            <span>Day {state.calendarDay + 1} of 365</span>
            <span>{Math.round(((state.calendarDay + 1) / 365) * 100)}% through {state.year}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-3">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${((state.calendarDay + 1) / 365) * 100}%` }} />
          </div>
          {pendingCount > 0 ? (
            <Button disabled className="w-full bg-white/60! text-brand-700! font-extrabold" size="lg">
              Resolve {pendingCount} event{pendingCount > 1 ? 's' : ''} first
            </Button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={nextDay} className="bg-white/15! text-white! hover:bg-white/25! font-bold">
                +1 Day
              </Button>
              <Button onClick={nextWeek} className="bg-white/15! text-white! hover:bg-white/25! font-bold">
                +1 Week
              </Button>
              <Button onClick={nextYear} className="bg-white! text-brand-700! hover:bg-white/90! font-extrabold">
                Year {state.year + 1} →
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Vital stats */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Card className="p-4 space-y-3">
          <StatBar label="Health" value={p.health} icon={<IconHeart className="w-3.5 h-3.5" />} />
          <StatBar label="Happiness" value={p.happiness} icon={<IconSpark className="w-3.5 h-3.5" />} />
          <StatBar label="Smarts" value={p.smarts} icon={<IconBrain className="w-3.5 h-3.5" />} />
          <StatBar label={`Stress${p.burnoutUntilYear !== null && state.year <= p.burnoutUntilYear ? ' — burned out' : ''}`} value={p.stress} />
        </Card>
        <Card className="p-4 space-y-3">
          <StatBar label="Reputation" value={p.reputation} />
          <StatBar label="Popularity" value={p.popularity} />
          <StatBar label="Influence" value={p.influence} />
        </Card>
      </div>

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
        <Pill label="🐶 Adopt Pet" onClick={() => run(doActivity, 'adopt_pet')} />
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

      {/* Life log */}
      <SectionHeader title="Life Log" action="News" onAction={() => setScreen('news')} />
      <div className="space-y-2">
        {recentLog.map((entry, i) => (
          <div
            key={i}
            className={`bg-white dark:bg-ink-850 border border-slate-100 dark:border-ink-800 border-l-4 ${LOG_TONE[entry.kind] ?? LOG_TONE.info} rounded-xl px-4 py-2.5`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold text-slate-400">AGE {entry.age}</span>
              {entry.kind === 'milestone' && <IconArrowRight className="w-3 h-3 text-fuchsia-500" />}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">{entry.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
