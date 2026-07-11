/** Main menu: continue, new-game creator, load slots, import save. */
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { AUTOSAVE_ID, type SaveSlotMeta } from '../../store/persistence';
import { Button, Card, Field, Pill, TextInput } from '../components';
import { money } from '../format';
import type { Difficulty, Gender } from '../../sim/types';
import type { Scenario } from '../../sim/world';
import { consumeRoyalty, getRoyaltySources } from '../../net/leaderboard';
import { getRibbonCabinet, RIBBONS } from '../../data/ribbons';
import { AccountPanel } from '../AccountPanel';
import { IconBusiness, IconSpark, IconTrophy } from '../icons';

const SCENARIOS: { id: Scenario; label: string; blurb: string }[] = [
  { id: 'modern', label: 'Modern Era', blurb: 'A balanced, present-day economy — the default experience.' },
  { id: 'boom', label: 'Boom Era', blurb: 'Start amid a red-hot economy: high growth, low unemployment, soaring markets.' },
  { id: 'recession', label: 'Recession Era', blurb: 'Start in a downturn: weak growth, rising joblessness, depressed markets.' },
  { id: 'crisis', label: 'Crisis Era', blurb: 'Start amid a full-blown crisis: contracting GDP, mass unemployment, a market crash.' },
];

const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 'casual', label: 'Casual', blurb: 'Softer crises and lower mortality — a relaxed playthrough.' },
  { id: 'standard', label: 'Standard', blurb: 'The default balance of risk and reward.' },
  { id: 'ironman', label: 'Iron Man', blurb: 'Harsher crises, higher mortality, and no continuing as an heir when you die.' },
];

export function Menu() {
  const { saves, refreshSaves, newGame, load, remove, importFrom, darkMode, toggleDark } = useGame();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [seed, setSeed] = useState('');
  const [scenario, setScenario] = useState<Scenario>('modern');
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [useLegacyBonus, setUseLegacyBonus] = useState(false);
  const [useRoyalty, setUseRoyalty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const royaltySources = getRoyaltySources();
  const ribbonCabinet = getRibbonCabinet();

  useEffect(() => {
    void refreshSaves();
  }, [refreshSaves]);

  const autosave = saves.find((s) => s.id === AUTOSAVE_ID);
  const manualSaves = saves.filter((s) => s.id !== AUTOSAVE_ID);
  const bestLegacyScore = Math.max(0, ...saves.map((s) => s.legacyScore ?? 0));
  const legacyBonusAmount = bestLegacyScore * 10_000;

  const start = () => {
    const spendRoyalty = useRoyalty && royaltySources.length > 0;
    newGame({
      playerName: name.trim() || 'Alex Morgan',
      gender,
      seedText: seed.trim() || `${Date.now()}`,
      scenario,
      difficulty,
      legacyBonus: useLegacyBonus ? legacyBonusAmount : 0,
      bornRoyal: spendRoyalty,
    });
    if (spendRoyalty) consumeRoyalty();
  };

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => importFrom(String(reader.result));
    reader.readAsText(file);
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-ink-900 text-slate-900 dark:text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white">
              <IconBusiness className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight leading-none">BusinessLife</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Business &amp; Politics Life Simulator</p>
            </div>
          </div>
          <button onClick={toggleDark} className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {!creating ? (
          <>
            {autosave && (
              <Card className="p-5 mb-4" onClick={() => load(autosave.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-brand-500 uppercase tracking-wide mb-1">Continue</div>
                    <div className="font-extrabold text-lg">{autosave.playerName}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Age {autosave.age} · Year {autosave.year} · {money(autosave.netWorth)}
                    </div>
                  </div>
                  <IconSpark className="w-8 h-8 text-brand-400" />
                </div>
              </Card>
            )}

            <Button size="lg" className="w-full mb-6" onClick={() => setCreating(true)}>
              ✨ Start a New Life
            </Button>

            {manualSaves.length > 0 && (
              <>
                <h2 className="text-lg font-extrabold mb-3">Saved Games</h2>
                <div className="space-y-3 mb-6">
                  {manualSaves.map((s) => (
                    <SaveRow key={s.id} save={s} onLoad={() => load(s.id)} onDelete={() => remove(s.id)} />
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-3">
              <Button variant="soft" className="flex-1" onClick={() => fileRef.current?.click()}>
                Import Save
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
              />
            </div>

            <AccountPanel />

            {/* Ribbon cabinet: every life ends with a ribbon; the collection persists across lives */}
            <Card className="p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold">🎗️ Ribbon Cabinet</span>
                <span className="text-xs font-bold text-brand-500">
                  {RIBBONS.filter((r) => ribbonCabinet[r.id]).length} / {RIBBONS.length} collected
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {RIBBONS.map((r) => {
                  const count = ribbonCabinet[r.id] ?? 0;
                  return (
                    <div
                      key={r.id}
                      title={count > 0 ? `${r.name} ×${count} — ${r.description}` : '??? — keep living lives to discover this ribbon'}
                      className={`rounded-xl px-1 py-2 text-center ${
                        count > 0 ? 'bg-brand-500/10' : 'bg-slate-100 dark:bg-ink-800 opacity-50'
                      }`}
                    >
                      <div className="text-xl leading-none">{count > 0 ? r.icon : '❔'}</div>
                      <div className={`text-[9px] font-bold truncate mt-1 ${count > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
                        {count > 0 ? r.name : '???'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-3">Every life ends with a ribbon. Which ones haven't you earned yet?</p>
            </Card>

            <Card className="p-5 mt-4">
              <div className="flex items-center gap-2 mb-2 text-brand-500">
                <IconTrophy className="w-5 h-5" />
                <span className="font-bold">How to play</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                You start at birth. Grow up, then act — study, take a job, found companies, trade stocks, buy property,
                join or found a party, campaign for office, and pass laws — then press <b>Advance Year</b> to let the
                world simulate forward. Build a business empire, run the country, or both. The economy, markets,
                elections and rival tycoons all evolve whether you act or not.
              </p>
            </Card>
          </>
        ) : (
          <Card className="p-6">
            <h2 className="text-xl font-extrabold mb-5">Create Your Character</h2>
            <div className="space-y-4">
              <Field label="Name">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" maxLength={28} />
              </Field>
              <Field label="Gender">
                <div className="flex gap-2">
                  <Pill label="Male" active={gender === 'male'} onClick={() => setGender('male')} />
                  <Pill label="Female" active={gender === 'female'} onClick={() => setGender('female')} />
                </div>
              </Field>
              <Field label="World Seed (optional — same seed = same world)">
                <TextInput value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="leave blank for random" maxLength={32} />
              </Field>
              <Field label="Starting Economy">
                <div className="grid grid-cols-2 gap-2">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setScenario(s.id)}
                      className={`text-left p-2.5 rounded-xl border-2 ${
                        scenario === s.id
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-800'
                      }`}
                    >
                      <div className="font-bold text-sm">{s.label}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{SCENARIOS.find((s) => s.id === scenario)?.blurb}</p>
              </Field>
              <Field label="Difficulty">
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      className={`text-left p-2.5 rounded-xl border-2 ${
                        difficulty === d.id
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-800'
                      }`}
                    >
                      <div className="font-bold text-sm">{d.label}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{DIFFICULTIES.find((d) => d.id === difficulty)?.blurb}</p>
              </Field>
              {bestLegacyScore > 0 && (
                <Field label="New Game+">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={useLegacyBonus} onChange={(e) => setUseLegacyBonus(e.target.checked)} />
                    Start with a {money(legacyBonusAmount)} bonus from your best Legacy Score ({bestLegacyScore})
                  </label>
                </Field>
              )}
              {royaltySources.length > 0 && (
                <Field label="Royal Bloodline">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={useRoyalty} onChange={(e) => setUseRoyalty(e.target.checked)} />
                    👑 You hit #1 on the {royaltySources.includes('networth') && royaltySources.includes('legacy')
                      ? 'Net Worth and Legacy Score'
                      : royaltySources.includes('networth') ? 'Net Worth' : 'Legacy Score'} leaderboard — spend it to be
                    born into royalty this life (a fortune, elite tutors, and standing before you've done a thing).
                  </label>
                </Field>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Back
              </Button>
              <Button className="flex-1" size="lg" onClick={start}>
                Begin Life →
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SaveRow({ save, onLoad, onDelete }: { save: SaveSlotMeta; onLoad: () => void; onDelete: () => void }) {
  return (
    <Card className="p-4 flex items-center justify-between">
      <button className="text-left flex-1" onClick={onLoad}>
        <div className="font-bold">{save.playerName}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Age {save.age} · Year {save.year} · {money(save.netWorth)}
        </div>
      </button>
      <button onClick={onDelete} className="text-rose-500 text-sm font-semibold px-2">
        Delete
      </button>
    </Card>
  );
}
