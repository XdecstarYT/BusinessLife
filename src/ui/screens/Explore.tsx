/**
 * Explore: a walkable 3D plaza layered over the real simulation — the
 * primary way to reach every major system, not a side visualization. Ten
 * fixed system buildings plus a skyline ring of every public company (see
 * MAX_COMPANY_BUILDINGS) are computed fresh from live GameState every
 * render, so what you see always matches what's true: a bankrupt company's
 * HQ is dark and boarded, Parliament only flies a flag if you hold office,
 * the Exchange glows with the real market trend, and a company that just
 * IPO'd sits behind scaffolding for a year before its real tier-driven
 * tower opens (see isBuildingUnderConstruction in sim/market.ts). Walking
 * up to a building opens the real screen for that system, and some offer a
 * quick action — a promotion push at the office, a moment of meditation at
 * the park — right there in the plaza.
 */
import { lazy, Suspense } from 'react';
import { useGame, type Screen } from '../../store/gameStore';
import { netWorth } from '../../sim/engine';
import { playerProducts } from '../../sim/products';
import { applyForPromotion, doActivity } from '../../sim/actions';
import { takeCase } from '../../sim/legal';
import { cookService } from '../../sim/culinary';
import { treatPatient } from '../../sim/medical';
import { isBuildingUnderConstruction, marketCap } from '../../sim/market';
import { INDUSTRY_BY_ID } from '../../data/industries';
import { SectionHeader } from '../components';
import { money } from '../format';
import type { HubBuilding, HubBuildingId, HubSeason } from '../three/CityHubScene';

const CityHubScene = lazy(() => import('../three/CityHubScene').then((m) => ({ default: m.CityHubScene })));
const SceneFallback = <div className="w-full h-[480px] rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

const HUB_SCREEN: Record<HubBuildingId, Screen> = {
  hq: 'business',
  bank: 'assets',
  parliament: 'politics',
  exchange: 'market',
  studio: 'studio',
  home: 'life',
  office: 'career',
  park: 'family',
  docks: 'world',
  newsstand: 'news',
  courthouse: 'legal',
  restaurant: 'culinary',
  hospital: 'medical',
  casino: 'casino',
};

const STOREFRONT_THEME_COLOR: Record<string, string> = {
  aurora: '#2dd4bf',
  noir: '#94a3b8',
  porcelain: '#cbd5e1',
  terra: '#f59e0b',
};

function seasonFromDay(calendarDay: number): HubSeason {
  const d = ((calendarDay % 365) + 365) % 365;
  if (d >= 60 && d < 152) return 'spring';
  if (d >= 152 && d < 244) return 'summer';
  if (d >= 244 && d < 335) return 'autumn';
  return 'winter';
}

function clampTier(n: number): 0 | 1 | 2 | 3 {
  return Math.max(0, Math.min(3, Math.round(n))) as 0 | 1 | 2 | 3;
}

// Every public company gets a building on the skyline ring, tinted by its sector so the city
// reads as a real mixed-industry downtown rather than a wall of identical gray towers.
const SECTOR_ACCENT: Record<string, string> = {
  Retail: '#f59e0b', Food: '#ef4444', Technology: '#38bdf8', Finance: '#d8b24a',
  Energy: '#22c55e', Industrial: '#94a3b8', Property: '#a78bfa', Transport: '#0ea5e9',
  Media: '#f472b6', Health: '#34d399', Services: '#facc15', Emerging: '#c084fc',
};
// The skyline ring can't render every NPC company in the world (there are hundreds) without
// becoming an unreadable, unusably slow wall of towers — cap it to the biggest, most relevant
// ones by market cap, which also happens to be the set a player actually cares about walking past.
const MAX_COMPANY_BUILDINGS = 32;

export function Explore() {
  const { state, setScreen, run, toast, cityHome, toggleCityHome } = useGame();
  if (!state) return null;
  const p = state.player;
  const home = state.countries.find((c) => c.id === p.countryId)!;

  // --- HQ: the player's largest active company ---
  const companies = p.companies.map((id) => state.companies[id]).filter((c) => c && c.status === 'active');
  const flagship = [...companies].sort((a, b) => b!.revenue - a!.revenue)[0] ?? null;
  const hq: HubBuilding = flagship
    ? {
        id: 'hq', label: flagship.name, sublabel: flagship.cash >= 2_000_000 ? 'Thriving' : flagship.cash >= 0 ? 'Stable' : 'Struggling',
        archetype: 'tower', tier: clampTier(flagship.cash < 0 ? 1 : flagship.cash >= 2_000_000 ? 3 : 2),
        accent: '#e8b84a',
      }
    : { id: 'hq', label: 'Vacant Lot', sublabel: 'Found a company to build here', archetype: 'tower', tier: 0, accent: '#64748b', dormant: true };

  // --- Bank: net worth tier ---
  const nw = netWorth(state);
  const bankTier = clampTier(nw >= 10_000_000 ? 3 : nw >= 1_000_000 ? 2 : nw >= 100_000 ? 1 : 0);
  const bank: HubBuilding = {
    id: 'bank', label: 'The Bank', sublabel: `Net worth tier ${bankTier + 1}/4`,
    archetype: 'bank', tier: bankTier, accent: '#d8b24a',
  };

  // --- Parliament: office + popularity ---
  const office = p.office;
  const parliament: HubBuilding = office
    ? {
        id: 'parliament', label: office.title, sublabel: `Popularity ${Math.round(p.popularity)}`,
        archetype: 'capitol', tier: clampTier(p.popularity >= 67 ? 3 : p.popularity >= 34 ? 2 : 1), accent: '#3b82f6',
      }
    : { id: 'parliament', label: 'Parliament', sublabel: 'Run for office to open it', archetype: 'capitol', tier: 0, accent: '#64748b', dormant: true };

  // --- Exchange: real market trend ---
  const prevIndex = home.economy.history[home.economy.history.length - 1]?.stockIndex ?? home.economy.stockIndex;
  const indexChange = prevIndex > 0 ? (home.economy.stockIndex - prevIndex) / prevIndex : 0;
  const exchange: HubBuilding = {
    id: 'exchange', label: 'The Exchange', sublabel: `Index ${indexChange >= 0 ? '+' : ''}${(indexChange * 100).toFixed(1)}%`,
    archetype: 'exchange', tier: clampTier(indexChange >= 0.05 ? 3 : indexChange >= 0 ? 2 : indexChange >= -0.05 ? 1 : 0),
    accent: indexChange >= 0 ? '#22c55e' : '#ef4444',
  };

  // --- Studio storefront: public products + theme ---
  const publicProducts = playerProducts(state).filter((prod) => prod.publishState === 'public' || prod.publishState === 'marketplace');
  const studio: HubBuilding = publicProducts.length > 0
    ? {
        id: 'studio', label: state.storefront.name, sublabel: `${publicProducts.length} product${publicProducts.length > 1 ? 's' : ''} live`,
        archetype: 'storefront', tier: clampTier(publicProducts.length >= 4 ? 3 : publicProducts.length >= 2 ? 2 : 1),
        accent: STOREFRONT_THEME_COLOR[state.storefront.theme] ?? '#2dd4bf',
      }
    : { id: 'studio', label: 'Studio Storefront', sublabel: 'Launch a product to open it', archetype: 'storefront', tier: 0, accent: '#64748b', dormant: true };

  // --- Home: happiness & health ---
  const wellbeing = (p.happiness + p.health) / 2;
  const homeBuilding: HubBuilding = {
    id: 'home', label: 'Home', sublabel: `Wellbeing ${Math.round(wellbeing)}`,
    archetype: 'house', tier: clampTier(wellbeing >= 75 ? 3 : wellbeing >= 50 ? 2 : wellbeing >= 25 ? 1 : 0),
    accent: '#f59e0b', quickAction: { icon: '💪', label: 'Work out' },
  };

  // --- Career office: job rank + promotion quick action ---
  const careerOffice: HubBuilding = p.job
    ? {
        id: 'office', label: `${p.job.employerName}`, sublabel: `${p.job.title} · Perf ${Math.round(p.job.performance)}`,
        archetype: 'office', tier: clampTier(p.job.performance >= 80 ? 3 : p.job.performance >= 55 ? 2 : 1),
        accent: '#38bdf8', quickAction: { icon: '📈', label: 'Push for Promotion' },
      }
    : { id: 'office', label: 'Job Centre', sublabel: 'Browse the job market to open it', archetype: 'office', tier: 0, accent: '#64748b', dormant: true };

  // --- Park: family size + a free moment of calm ---
  const familySize = (p.spouseId ? 1 : 0) + p.children.length + p.grandchildren.length;
  const park: HubBuilding = {
    id: 'park', label: 'The Park', sublabel: familySize > 0 ? `Family of ${familySize + 1}` : 'Meet someone new',
    archetype: 'park', tier: clampTier(familySize >= 4 ? 3 : familySize >= 2 ? 2 : familySize >= 1 ? 1 : 0),
    accent: '#22c55e', dormant: familySize === 0, quickAction: { icon: '🧘', label: 'Meditate a while' },
  };

  // --- Docks: foreign relations ---
  const atWar = home.atWarWith.length > 0;
  const allies = state.countries.filter((c) => c.id !== home.id && (home.relations[c.id] ?? 0) >= 60).length;
  const docks: HubBuilding = {
    id: 'docks', label: 'The Docks', sublabel: atWar ? `At war · Exhaustion ${Math.round(home.warExhaustion)}` : `${allies} friendly nation${allies === 1 ? '' : 's'}`,
    archetype: 'dock', tier: clampTier(atWar ? 0 : allies >= 5 ? 3 : allies >= 2 ? 2 : 1),
    accent: atWar ? '#ef4444' : '#0ea5e9',
  };

  // --- Newsstand: latest headline ---
  const latestNews = state.news[state.news.length - 1];
  const newsstand: HubBuilding = {
    id: 'newsstand', label: 'Newsstand', sublabel: latestNews ? latestNews.outlet : 'Quiet today',
    archetype: 'kiosk', tier: clampTier(state.news.length >= 200 ? 3 : state.news.length >= 50 ? 2 : 1),
    accent: '#f59e0b', quickAction: latestNews ? { icon: '📰', label: 'Skim the headlines' } : undefined,
  };

  // --- Courthouse: Legal career (V57 — Legal previously had zero hub presence) ---
  const legal = p.legalCareer;
  const courthouse: HubBuilding = legal && legal.active
    ? {
        id: 'courthouse', label: legal.stage === 'judge' ? 'The Bench' : 'Law Offices', sublabel: `${legal.stage.replace('_', ' ')} · rep ${Math.round(legal.reputation)}`,
        archetype: 'courthouse', tier: clampTier(legal.stage === 'judge' ? 3 : legal.rank >= 2 ? 2 : legal.rank >= 1 ? 1 : 0), accent: '#c9a227',
        quickAction: (legal.stage === 'associate' || legal.stage === 'partner') && !legal.disbarred ? { icon: '⚖️', label: 'Take a case' } : undefined,
      }
    : { id: 'courthouse', label: 'Courthouse', sublabel: 'Start a legal career to open it', archetype: 'courthouse', tier: 0, accent: '#64748b', dormant: true };

  // --- Restaurant: Culinary career (V57) ---
  const culinary = p.culinaryCareer;
  const restaurant: HubBuilding = culinary && culinary.active
    ? {
        id: 'restaurant', label: culinary.workplaceName ?? 'The Kitchen', sublabel: `${culinary.stage.replace('_', ' ')} · ${culinary.michelinStars} ⭐`,
        archetype: 'restaurant', tier: clampTier(culinary.stage === 'restaurant_owner' ? 2 + Math.min(1, culinary.michelinStars) : culinary.rank),
        accent: '#e8734a',
        quickAction: (culinary.stage === 'line_cook' || culinary.stage === 'sous_chef' || culinary.stage === 'head_chef') ? { icon: '🍳', label: 'Cook a service' } : undefined,
      }
    : { id: 'restaurant', label: 'Restaurant', sublabel: 'Start cooking to open it', archetype: 'restaurant', tier: 0, accent: '#64748b', dormant: true };

  // --- Hospital: Medical career (V57) ---
  const medical = p.medicalCareer;
  const hospital: HubBuilding = medical && medical.active
    ? {
        id: 'hospital', label: 'General Hospital', sublabel: `${medical.stage.replace('_', ' ')} · ${medical.patientsSaved} saved`,
        archetype: 'hospital', tier: clampTier(medical.rank), accent: '#e11d48',
        quickAction: (medical.stage === 'residency' || medical.stage === 'attending') && !medical.licenseRevoked ? { icon: '🩺', label: 'Treat a patient' } : undefined,
      }
    : { id: 'hospital', label: 'Hospital', sublabel: 'Enroll in med school to open it', archetype: 'hospital', tier: 0, accent: '#64748b', dormant: true };

  // --- Casino: lifetime wagering (V57) ---
  const wagered = p.casinoTotalWagered;
  const casino: HubBuilding = {
    id: 'casino', label: 'The Casino', sublabel: wagered > 0 ? `Biggest win ${money(p.casinoBiggestWin)}` : 'Try your luck',
    archetype: 'casinofront', tier: clampTier(wagered >= 1_000_000 ? 3 : wagered >= 100_000 ? 2 : wagered >= 10_000 ? 1 : 0),
    accent: '#c026d3', dormant: wagered === 0,
  };

  const systemBuildings = [hq, bank, parliament, exchange, studio, homeBuilding, careerOffice, park, docks, newsstand, courthouse, restaurant, hospital, casino];

  // --- Skyline: one building per publicly-listed company, freshest IPOs still scaffolded ---
  const publicCompanies = Object.values(state.companies)
    .filter((c) => c.isPublic && c.status === 'active' && c.countryId === p.countryId)
    .sort((a, b) => marketCap(b) - marketCap(a))
    .slice(0, MAX_COMPANY_BUILDINGS);
  const companyBuildings: HubBuilding[] = publicCompanies.map((c) => {
    const ind = INDUSTRY_BY_ID[c.industryId];
    const constructing = isBuildingUnderConstruction(c, state.year);
    return {
      id: c.id,
      label: c.name,
      sublabel: constructing ? 'Breaking ground — opens next year' : `${ind?.sector ?? 'Public'} · cap ${money(marketCap(c))}`,
      archetype: 'tower',
      tier: clampTier(c.hqTier),
      accent: c.playerOwned ? '#e8b84a' : (SECTOR_ACCENT[ind?.sector ?? ''] ?? '#8b5cf6'),
      constructing,
      kind: 'company',
    };
  });

  const buildings = [...systemBuildings, ...companyBuildings];
  const season = seasonFromDay(state.calendarDay);

  const handleQuickAction = (id: string) => {
    if (id === 'office') { run(applyForPromotion); return; }
    if (id === 'park') { run(doActivity, 'meditate'); return; }
    if (id === 'home') { run(doActivity, 'gym'); return; }
    if (id === 'courthouse') { run(takeCase); return; }
    if (id === 'restaurant') { run(cookService); return; }
    if (id === 'hospital') { run(treatPatient); return; }
    if (id === 'newsstand' && latestNews) { toast(`📰 ${latestNews.outlet}: "${latestNews.headline}"`); return; }
  };

  const handleEnter = (id: string) => {
    if (id in HUB_SCREEN) { setScreen(HUB_SCREEN[id as HubBuildingId]); return; }
    const company = state.companies[id];
    if (!company) return;
    if (isBuildingUnderConstruction(company, state.year)) {
      toast(`🏗️ ${company.name}'s new headquarters is still under construction — check back next year.`);
      return;
    }
    setScreen(company.playerOwned ? 'business' : 'market');
  };

  return (
    <div>
      <SectionHeader title="🧭 Explore" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
        Walk your city block. Every building reflects your real empire — approach one and step inside, or use the quick action on offer.
        {publicCompanies.length > 0 && ` The skyline beyond the plaza is every public company in ${home.name}, ${publicCompanies.length} strong.`}
      </p>
      <Suspense fallback={SceneFallback}>
        <CityHubScene buildings={buildings} season={season} onEnter={handleEnter} onQuickAction={handleQuickAction} />
      </Suspense>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {systemBuildings.map((b) => (
          <div key={b.id} className="rounded-xl bg-slate-100 dark:bg-ink-800 p-2 text-center">
            <div className="text-[10px] font-bold truncate" style={{ color: b.accent }}>{b.label}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{b.sublabel}</div>
          </div>
        ))}
      </div>
      <button
        onClick={toggleCityHome}
        className="mt-3 w-full rounded-xl bg-slate-100 dark:bg-ink-800 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-ink-700 transition-colors"
      >
        {cityHome ? '🏙️ Home base: the City (tap to land in the Life feed instead)' : '📖 Home base: the Life feed (tap to spawn in the City instead)'}
      </button>
    </div>
  );
}
