/**
 * Cult/Movement Founder hub: recruit followers, collect donations, extract funds, expand a
 * compound, and manage suspicion. Simple confirm-and-go actions like Casino/Drugs — no dedicated
 * 3D scene (see data/cult.ts for the static catalog).
 */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  collectDonations, disbandCult, expandCompound, extractFunds, foundCult, indoctrinate,
  recruitFollowers, suggestCultName,
} from '../../sim/cult';
import { compoundUpgradeCost } from '../../data/cult';
import { RNG } from '../../sim/rng';
import { Badge, Button, Card, Pill, PillRow, SectionHeader, StatBar, TextInput } from '../components';
import { money } from '../format';

export function Cult() {
  const { state, run } = useGame();
  const [name, setName] = useState(() => suggestCultName(new RNG(Date.now())));
  const [extractAmount, setExtractAmount] = useState(1000);
  if (!state) return null;
  const p = state.player;
  const c = p.cult;

  if (!c || !c.active) {
    return (
      <div>
        <SectionHeader title="🔮 Movement" />
        {c?.disbanded && (
          <Card className="p-4 mb-4">
            <div className="text-xs text-slate-400 uppercase font-bold">{c.name}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Peak followers {c.followers.toLocaleString()} · ended: {c.disbandedReason}
            </div>
          </Card>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
          Found your own spiritual movement: recruit followers, collect donations, build a
          compound, and grow your influence — but stay too visible and the authorities will come.
        </p>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Movement name" className="mb-3" />
        <Button className="w-full" size="lg" onClick={() => run(foundCult, name)}>
          🔮 Found Movement
        </Button>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title={`🔮 ${c.name}`} />
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-brand-500 uppercase font-bold">Followers</div>
            <div className="font-extrabold text-lg">{c.followers.toLocaleString()}</div>
          </div>
          {c.suspicion > 60 && <Badge tone="bad">👁️ Under Watch</Badge>}
          {c.suspicion <= 60 && c.suspicion > 30 && <Badge tone="warn">Noticed</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatBar label="Charisma" value={c.charisma} />
          <StatBar label="Suspicion" value={c.suspicion} />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Compound level {c.compoundLevel}/5 · Funds {money(c.funds)} · Raids survived {c.raidsSurvived}
        </div>
      </Card>

      <SectionHeader title="Actions" />
      <PillRow>
        <Pill label="📣 Recruit Followers" tone="brand" onClick={() => run(recruitFollowers)} />
        <Pill label="🕯️ Hold a Gathering" onClick={() => run(indoctrinate)} />
        <Pill label="💰 Collect Donations" onClick={() => run(collectDonations)} />
        {c.compoundLevel < 5 && <Pill label={`🏚️ Expand Compound (${money(compoundUpgradeCost(c.compoundLevel))})`} onClick={() => run(expandCompound)} />}
      </PillRow>

      <SectionHeader title="Extract Funds" />
      <Card className="p-4 mb-4">
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Move cult funds into your own pocket. This is embezzlement — it comes out as dirty money and raises suspicion.
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, Math.round(c.funds))}
          step={100}
          value={Math.min(extractAmount, Math.round(c.funds))}
          onChange={(e) => setExtractAmount(Number(e.target.value))}
          className="w-full mb-2"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">{money(extractAmount)}</span>
          <Button size="sm" disabled={extractAmount <= 0 || extractAmount > c.funds} onClick={() => run(extractFunds, extractAmount)}>
            💸 Extract
          </Button>
        </div>
      </Card>

      <SectionHeader title="Exit" />
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 pr-2">
            Disband the movement for good.
          </div>
          <Button size="sm" variant="danger" onClick={() => run(disbandCult)}>🚪 Disband</Button>
        </div>
      </Card>
    </div>
  );
}
