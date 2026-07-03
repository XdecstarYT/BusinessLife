/** Main menu: continue, new-game creator, load slots, import save. */
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { AUTOSAVE_ID, type SaveSlotMeta } from '../../store/persistence';
import { Button, Card, Field, Pill, TextInput } from '../components';
import { money } from '../format';
import type { Gender } from '../../sim/types';
import { IconBusiness, IconSpark, IconTrophy } from '../icons';

export function Menu() {
  const { saves, refreshSaves, newGame, load, remove, importFrom, darkMode, toggleDark } = useGame();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [seed, setSeed] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refreshSaves();
  }, [refreshSaves]);

  const autosave = saves.find((s) => s.id === AUTOSAVE_ID);
  const manualSaves = saves.filter((s) => s.id !== AUTOSAVE_ID);

  const start = () => {
    newGame({ playerName: name.trim() || 'Alex Morgan', gender, seedText: seed.trim() || `${Date.now()}` });
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

            <Card className="p-5 mt-8">
              <div className="flex items-center gap-2 mb-2 text-brand-500">
                <IconTrophy className="w-5 h-5" />
                <span className="font-bold">How to play</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                You start at 18. Each year, act — study, take a job, found companies, trade stocks, buy property,
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
