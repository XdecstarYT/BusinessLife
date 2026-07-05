/**
 * Explore: a walkable 3D plaza layered over the real simulation. Six
 * buildings — HQ, Bank, Parliament, Exchange, Studio and Home — are computed
 * fresh from live GameState every render, so what you see always matches
 * what's true: a bankrupt company's HQ is dark and boarded, Parliament only
 * flies a flag if you hold office, the Exchange glows with the real market
 * trend. Walking up to a building opens the real screen for that system.
 */
import { lazy, Suspense } from 'react';
import { useGame, type Screen } from '../../store/gameStore';
import { netWorth } from '../../sim/engine';
import { playerProducts } from '../../sim/products';
import { SectionHeader } from '../components';
import type { HubBuilding, HubBuildingId, HubSeason } from '../three/CityHubScene';

const CityHubScene = lazy(() => import('../three/CityHubScene').then((m) => ({ default: m.CityHubScene })));
const SceneFallback = <div className="w-full h-[420px] rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

const HUB_SCREEN: Record<HubBuildingId, Screen> = {
  hq: 'business',
  bank: 'assets',
  parliament: 'politics',
  exchange: 'market',
  studio: 'studio',
  home: 'life',
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

export function Explore() {
  const { state, setScreen } = useGame();
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
    accent: '#f59e0b',
  };

  const buildings = [hq, bank, parliament, exchange, studio, homeBuilding];
  const season = seasonFromDay(state.calendarDay);

  return (
    <div>
      <SectionHeader title="🧭 Explore" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
        Walk your city block. Every building reflects your real empire — approach one and step inside.
      </p>
      <Suspense fallback={SceneFallback}>
        <CityHubScene buildings={buildings} season={season} onEnter={(id) => setScreen(HUB_SCREEN[id])} />
      </Suspense>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {buildings.map((b) => (
          <div key={b.id} className="rounded-xl bg-slate-100 dark:bg-ink-800 p-2 text-center">
            <div className="text-[10px] font-bold truncate" style={{ color: b.accent }}>{b.label}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{b.sublabel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
