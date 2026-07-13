/**
 * Culinary Empire hub: line cook → sous chef → head chef, then an optional leap to opening your
 * own restaurant and chasing Michelin stars. Simple confirm-and-go actions like Medical/Casino —
 * no dedicated 3D scene (see data/culinary.ts for the catalog).
 */
import { lazy, Suspense, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  cookService, growRestaurant, openRestaurant, pursueMichelinStar, retireFromCooking, runKitchenService, seekKitchenPromotion, startCookingCareer,
} from '../../sim/culinary';
import { CUISINE_BY_ID, CUISINES, MICHELIN_STAR_REQUIREMENTS, OPEN_RESTAURANT_BASE_COST, RESTAURANT_TIER_TITLES } from '../../data/culinary';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';

const KitchenServiceScene = lazy(() => import('../three/KitchenServiceScene').then((m) => ({ default: m.KitchenServiceScene })));
const SceneFallback = <div className="w-full h-56 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

export function Culinary() {
  const { state, run, toast } = useGame();
  const [cuisinePick, setCuisinePick] = useState('diner');
  const [playingService, setPlayingService] = useState(false);
  if (!state) return null;
  const p = state.player;
  const c = p.culinaryCareer;

  if (!c || !c.active) {
    return (
      <div>
        <SectionHeader title="👨‍🍳 Culinary Empire" />
        {c?.stage === 'retired' && (
          <Card className="p-4 mb-4">
            <div className="text-xs text-slate-400 uppercase font-bold">Retired Career</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {c.dishesServed.toLocaleString()} dishes served · {c.michelinStars} Michelin star{c.michelinStars === 1 ? '' : 's'}
            </div>
          </Card>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Work your way up the line to head chef, then open your own restaurant and chase
          Michelin stars — real skill wins over the pass, but a bad service risks a health code
          violation.
        </p>
        <SectionHeader title="Pick a Cuisine" />
        <PillRow>
          {CUISINES.map((cu) => (
            <Pill key={cu.id} label={`${cu.icon} ${cu.name}`} active={cuisinePick === cu.id} onClick={() => setCuisinePick(cu.id)} />
          ))}
        </PillRow>
        <Card className="p-4 mt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Difficulty {CUISINE_BY_ID[cuisinePick].difficulty}/100 · Base salary {CUISINE_BY_ID[cuisinePick].baseSalary.toLocaleString()}/yr
          </div>
          <Button className="w-full" onClick={() => run(startCookingCareer, cuisinePick)}>Start Cooking {CUISINE_BY_ID[cuisinePick].name}</Button>
        </Card>
      </div>
    );
  }

  const cuisine = c.cuisineId ? CUISINE_BY_ID[c.cuisineId] : null;
  const isEmployed = c.stage === 'line_cook' || c.stage === 'sous_chef' || c.stage === 'head_chef';
  const isOwner = c.stage === 'restaurant_owner';
  const michelinReq = isOwner && c.michelinStars < 3 ? MICHELIN_STAR_REQUIREMENTS[c.michelinStars] : null;
  const growCost = isOwner ? Math.round(OPEN_RESTAURANT_BASE_COST * 0.8 * (c.rank + 1)) : 0;
  const openCost = cuisine ? Math.round(OPEN_RESTAURANT_BASE_COST * (0.6 + cuisine.difficulty * 0.01)) : 0;

  return (
    <div>
      <SectionHeader title={isOwner ? '🏮 Restaurant Owner' : `👨‍🍳 ${c.stage === 'line_cook' ? 'Line Cook' : c.stage === 'sous_chef' ? 'Sous Chef' : 'Head Chef'}`} />
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">{cuisine?.name} · {c.workplaceName}</div>
            <div className="font-extrabold text-lg">
              {isOwner ? RESTAURANT_TIER_TITLES[c.rank] : `Year ${c.yearsOfService}`}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {c.healthCodeViolations > 0 && <Badge tone="bad">⚠️ {c.healthCodeViolations}</Badge>}
            {c.michelinStars > 0 && <Badge tone="good">{'⭐'.repeat(c.michelinStars)}</Badge>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Skill" value={c.skill} />
          <StatBar label="Reputation" value={c.reputation} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {c.dishesServed.toLocaleString()} dishes served
        </div>
        {c.restaurantClosed && <div className="mt-2"><Badge tone="bad">Restaurant Closed</Badge></div>}
      </Card>

      {isEmployed && !c.restaurantClosed && (
        <>
          <SectionHeader title="Actions" />
          <PillRow>
            <Pill label="🎮 Play the Service" tone="brand" onClick={() => setPlayingService(true)} />
            <Pill label="🍳 Cook a Service (quick)" onClick={() => run(cookService)} />
            {c.stage !== 'head_chef' && <Pill label="📈 Seek Promotion" onClick={() => run(seekKitchenPromotion)} />}
            {c.stage === 'head_chef' && (
              <Pill label={`🏮 Open Restaurant (${money(openCost)})`} tone="brand" onClick={() => run(openRestaurant)} />
            )}
          </PillRow>
          {playingService && (
            <Card className="p-4 mt-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Tap the lit station before it goes cold — a sharp service gives your real cook-service roll a real edge.</div>
              <Suspense fallback={SceneFallback}>
                <KitchenServiceScene
                  onComplete={(score) => {
                    const r = run(runKitchenService, score);
                    toast(`${Math.round(score * 100)}% accuracy — ${r.message}`, r.ok ? 'ok' : 'err');
                    setPlayingService(false);
                  }}
                />
              </Suspense>
            </Card>
          )}
        </>
      )}

      {isOwner && !c.restaurantClosed && (
        <>
          <SectionHeader title="Grow the Restaurant" />
          <PillRow>
            {c.rank < RESTAURANT_TIER_TITLES.length - 1 && (
              <Pill label={`🏗️ Expand (${money(growCost)})`} tone="brand" onClick={() => run(growRestaurant)} />
            )}
            {c.michelinStars < 3 && <Pill label="⭐ Pursue a Michelin Star" onClick={() => run(pursueMichelinStar)} />}
          </PillRow>
          {michelinReq && (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-1 mt-1">
              Needs {michelinReq.reputation}+ reputation, {michelinReq.skill}+ skill, and {RESTAURANT_TIER_TITLES[michelinReq.minTier]} status.
            </p>
          )}
        </>
      )}

      <SectionHeader title="Exit" />
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
            Retire from cooking for good.
          </div>
          <Button size="sm" variant="danger" onClick={() => run(retireFromCooking)}>🚪 Retire</Button>
        </div>
      </Card>
    </div>
  );
}

