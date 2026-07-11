/**
 * Drug Empire: buy and sell product, build out storage/grow/lab facilities, hire street dealers,
 * and fight for turf. Independent of joining a CrimeFamily (crime.ts) but synergizes with one —
 * mirrors how Military Service (military.ts) ties into the real war system instead of duplicating
 * it. All actions are simple confirm-and-go, like Casino/Military, no dedicated 3D scene.
 */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  bribeCop, buyProduct, cutProduct, expandTurf, fireDealer, hireDealer,
  investFacility, retireFromDealing, sellProduct, startDealing,
} from '../../sim/drugs';
import {
  DEALER_HIRE_COST, DRUGS, drugCapacity, facilityUpgradeCost, MAX_DEALERS_PER_TURF, stashTotal,
} from '../../data/drugs';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar } from '../components';
import { money } from '../format';

const FACILITY_LABEL: Record<'storage' | 'grow' | 'lab', { name: string; icon: string; blurb: string }> = {
  storage: { name: 'Stash House', icon: '🏚️', blurb: 'More capacity to hold product.' },
  grow: { name: 'Grow House', icon: '🌱', blurb: 'Free weed production every year.' },
  lab: { name: 'Meth Lab', icon: '🧫', blurb: 'Free meth production every year — level 3+ unlocks sourcing the hardest tier.' },
};

export function Drugs() {
  const { state, run } = useGame();
  const [selectedDrug, setSelectedDrug] = useState('weed');
  const [quantity, setQuantity] = useState(10);

  if (!state) return null;
  const p = state.player;
  const op = p.drugOperation;

  if (!op || !op.active) {
    return (
      <div>
        <SectionHeader title="🌿 Drug Empire" />
        {op && (
          <Card className="p-4 mb-4">
            <div className="text-xs text-slate-400 uppercase font-bold">Previous Operation</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Lifetime revenue {money(op.lifetimeRevenue)} · {op.busts} bust{op.busts === 1 ? '' : 's'} · {op.odIncidents} overdose{op.odIncidents === 1 ? '' : 's'}
            </div>
          </Card>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Start slinging on the corner and build it into a real operation: stash houses, grow ops, a lab,
          a street crew, and turf worth fighting for. It's real money — but it's dirty until you launder
          it, and the heat never really goes away.
        </p>
        <Button className="w-full" size="lg" onClick={() => run(startDealing)}>
          🌿 Start Dealing
        </Button>
      </div>
    );
  }

  const capacity = drugCapacity(op);
  const held = stashTotal(op.stash);
  const maxDealers = Math.floor(op.turf * MAX_DEALERS_PER_TURF) + (op.storageLevel > 0 ? 1 : 0);
  const drug = DRUGS.find((d) => d.id === selectedDrug)!;
  const stashUnits = op.stash[selectedDrug] ?? 0;
  const locked = op.reputation < drug.minReputation || (drug.tier >= 4 && op.labLevel < 3 && !p.crimeFamilyId);
  const buyCost = Math.round(quantity * drug.wholesaleCost);
  const roomLeft = capacity - held;

  return (
    <div>
      <SectionHeader title="🌿 Drug Empire" />

      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">Operation Status</div>
            <div className="font-extrabold text-lg">{held}/{capacity} units in stash</div>
          </div>
          {op.heat > 60 && <Badge tone="bad">🔥 Hot</Badge>}
          {op.heat <= 60 && op.heat > 30 && <Badge tone="warn">Watched</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Reputation" value={op.reputation} />
          <StatBar label="Turf" value={op.turf} />
          <StatBar label="Heat" value={op.heat} />
          <StatBar label="Dealers" value={maxDealers > 0 ? (op.dealersHired / maxDealers) * 100 : 0} suffix={` ${op.dealersHired}/${maxDealers}`} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Lifetime revenue {money(op.lifetimeRevenue)} · {op.busts} bust{op.busts === 1 ? '' : 's'} · {op.odIncidents} overdose{op.odIncidents === 1 ? '' : 's'}
        </div>
      </Card>

      <SectionHeader title="Facilities" />
      <div className="space-y-2 mb-4">
        {(['storage', 'grow', 'lab'] as const).map((track) => {
          const level = track === 'storage' ? op.storageLevel : track === 'grow' ? op.growLevel : op.labLevel;
          const def = FACILITY_LABEL[track];
          const maxed = level >= 5;
          const cost = maxed ? 0 : facilityUpgradeCost(track, level + 1);
          return (
            <Card key={track} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-sm">{def.icon} {def.name} · Level {level}/5</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{def.blurb}</div>
              </div>
              <Button size="sm" variant="soft" disabled={maxed} onClick={() => run(investFacility, track)}>
                {maxed ? 'Maxed' : `Upgrade ${money(cost)}`}
              </Button>
            </Card>
          );
        })}
      </div>

      <SectionHeader title="Product" />
      <PillRow>
        {DRUGS.map((d) => {
          const isLocked = op.reputation < d.minReputation || (d.tier >= 4 && op.labLevel < 3 && !p.crimeFamilyId);
          return (
            <Pill
              key={d.id}
              label={`${isLocked ? '🔒' : d.icon} ${d.name}${op.stash[d.id] ? ` (${op.stash[d.id]})` : ''}`}
              active={selectedDrug === d.id}
              onClick={() => { setSelectedDrug(d.id); setQuantity(10); }}
            />
          );
        })}
      </PillRow>

      <Card className="p-4 mt-2 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="font-bold text-sm">{drug.icon} {drug.name}</div>
          <div className="text-xs text-slate-400">Tier {drug.tier} · you hold {stashUnits}</div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{drug.description}</p>
        {locked ? (
          <p className="text-xs text-rose-500 font-semibold">
            {op.reputation < drug.minReputation
              ? `Needs ${drug.minReputation} reputation (you have ${Math.round(op.reputation)}).`
              : 'Needs a level-3+ lab or a crime family connection to source.'}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Wholesale {money(drug.wholesaleCost)}/unit · Street {money(drug.streetPrice)}/unit</span>
              <span>Qty: {quantity}</span>
            </div>
            <input
              type="range"
              min={1}
              max={Math.max(1, Math.max(roomLeft, stashUnits, 1))}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full mt-1 mb-3"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                disabled={roomLeft <= 0 || buyCost > p.money}
                onClick={() => run(buyProduct, drug.id, Math.min(quantity, roomLeft))}
              >
                💵 Buy ({money(Math.min(quantity, Math.max(1, roomLeft)) * drug.wholesaleCost)})
              </Button>
              <Button
                size="sm"
                variant="soft"
                disabled={stashUnits <= 0}
                onClick={() => run(sellProduct, drug.id, Math.min(quantity, stashUnits))}
              >
                💰 Sell ({money(Math.min(quantity, Math.max(1, stashUnits)) * drug.streetPrice)})
              </Button>
            </div>
          </>
        )}
      </Card>

      <SectionHeader title="Crew & Turf" />
      <PillRow>
        <Pill label={`👥 Hire Dealer (${money(DEALER_HIRE_COST)})`} onClick={() => run(hireDealer)} />
        {op.dealersHired > 0 && <Pill label="👋 Fire Dealer" onClick={() => run(fireDealer)} />}
        <Pill label="🗺️ Expand Turf" tone="brand" onClick={() => run(expandTurf)} />
        {stashUnits > 0 && <Pill label={`✂️ Cut ${drug.name}`} onClick={() => run(cutProduct, drug.id)} />}
        {op.heat > 20 && <Pill label="🚔 Bribe a Cop" onClick={() => run(bribeCop)} />}
      </PillRow>

      <SectionHeader title="Exit" />
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
            Walk away for good. Your stash, facilities, turf, and crew are gone — but your record stays.
          </div>
          <Button size="sm" variant="danger" onClick={() => run(retireFromDealing)}>🚪 Get Out</Button>
        </div>
      </Card>
    </div>
  );
}
