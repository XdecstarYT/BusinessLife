/** Stats: net-worth chart, achievements, full profile, save/export tools. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { netWorth } from '../../sim/engine';
import { OFFICE_SPEC_BY_KIND } from '../../sim/politics';
import { changeGenderIdentity, changeLegalName } from '../../sim/actions';
import { ACHIEVEMENTS } from '../../data/achievements';
import { Badge, Button, Card, LineChart, Modal, SectionHeader, StatBar, TextInput } from '../components';
import { money } from '../format';

export function Stats() {
  const { state, save, exportCurrent, toast, run } = useGame();
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  if (!state) return null;
  const p = state.player;
  const nw = netWorth(state);
  const nwHistory = state.netWorthHistory.map((h) => h.value);
  const offices = state.achievements.filter((a) => a.startsWith('office:')).map((a) => OFFICE_SPEC_BY_KIND[a.slice(7)]?.title).filter(Boolean);
  const badges = state.achievements.filter((a) => ACHIEVEMENTS[a]);
  const timeline = state.lifeLog.filter((l) => l.kind === 'milestone');

  const doExport = () => {
    const data = exportCurrent();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `businesslife-${p.name.replace(/\s+/g, '-')}-${state.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Save exported.');
  };

  return (
    <div>
      <SectionHeader title="Profile" />
      <Card className="p-5 mb-4">
        <div className="text-center mb-3">
          <div className="w-16 h-16 rounded-full bg-brand-500 mx-auto flex items-center justify-center text-white text-2xl font-black">
            {p.name.charAt(0)}
          </div>
          <div className="font-extrabold text-lg mt-2">{p.name}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Age {p.age} · {p.gender === 'male' ? 'Male' : 'Female'} · Started {state.startYear}</div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => { setNameDraft(p.name); setEditingIdentity(true); }}>🪪 Identity</Button>
        </div>
        <div className="text-center py-3 border-y border-slate-100 dark:border-ink-800">
          <div className="text-xs text-slate-400">Net Worth</div>
          <div className="text-3xl font-black text-emerald-500">{money(nw)}</div>
        </div>
        <div className="h-24 mt-3">
          <LineChart data={nwHistory} height={96} color="#10b981" showAxis format={(v) => money(v)} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 space-y-3">
          <StatBar label="Health" value={p.health} />
          <StatBar label="Happiness" value={p.happiness} />
          <StatBar label="Smarts" value={p.smarts} />
          <StatBar label="Charisma" value={p.charisma} />
        </Card>
        <Card className="p-4 space-y-3">
          <StatBar label="Reputation" value={p.reputation} />
          <StatBar label="Popularity" value={p.popularity} />
          <StatBar label="Influence" value={p.influence} />
          <StatBar label="Karma" value={p.karma} />
        </Card>
      </div>

      <SectionHeader title="Career Highlights" />
      <Card className="p-4 space-y-2 text-sm">
        <Row label="Days lived" value={((state.year - state.startYear) * 365 + state.calendarDay + 1).toLocaleString()} />
        <Row label="Companies founded" value={String(p.companies.length)} />
        <Row label="Properties owned" value={String(p.properties.length)} />
        <Row label="Stock positions" value={String(p.portfolio.length)} />
        <Row label="Highest office" value={offices[offices.length - 1] ?? 'None'} />
        <Row label="Criminal record" value={p.criminalRecord ? `${p.criminalRecord} conviction(s)` : 'Clean'} />
        <Row label="Degrees" value={p.education.map((e) => e.degree).join(', ') || 'None'} />
      </Card>

      {badges.length > 0 && (
        <>
          <SectionHeader title="Achievements" />
          <div className="flex flex-wrap gap-2">
            {badges.map((a) => (
              <Badge key={a} tone="brand">{ACHIEVEMENTS[a].icon} {ACHIEVEMENTS[a].label}</Badge>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Legacy" />
      <Button variant="soft" className="w-full mb-4" onClick={() => setShowTimeline(true)}>📖 View Life Timeline ({timeline.length})</Button>

      <SectionHeader title="Save" />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="soft" onClick={() => setSaving(true)}>💾 Save Slot</Button>
        <Button variant="soft" onClick={doExport}>⬇️ Export JSON</Button>
      </div>

      <Modal open={saving} onClose={() => setSaving(false)} title="Save Game">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Autosave runs every year. Create a named snapshot you can return to.</p>
        <TextInput value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Before the election" maxLength={40} />
        <Button
          className="w-full mt-4"
          onClick={() => { void save(`slot_${Date.now()}`); setSaving(false); }}
        >
          Save Snapshot
        </Button>
      </Modal>

      <Modal open={showTimeline} onClose={() => setShowTimeline(false)} title="Life Timeline">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {timeline.length === 0 && <p className="text-center text-slate-400 py-6">No milestones yet — get out there and live a little.</p>}
          {timeline.map((entry, i) => (
            <div key={i} className="flex gap-3">
              <div className="text-xs font-bold text-brand-500 w-14 shrink-0 pt-0.5">{entry.year}</div>
              <div className="flex-1 text-sm text-slate-700 dark:text-slate-200 border-l-2 border-brand-200 dark:border-brand-900 pl-3 pb-3">
                {entry.text}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={editingIdentity} onClose={() => setEditingIdentity(false)} title="Legal Identity">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Legally change your name or gender marker. Each can be updated once per year.</p>
        <div className="flex gap-2 mb-4">
          <TextInput value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={40} className="flex-1" />
          <Button size="sm" onClick={() => { if (run(changeLegalName, nameDraft).ok) setEditingIdentity(false); }}>Save ($150)</Button>
        </div>
        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Gender Marker</div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={p.gender === 'male' ? 'primary' : 'soft'}
            onClick={() => { if (run(changeGenderIdentity, 'male').ok) setEditingIdentity(false); }}
          >
            Male
          </Button>
          <Button
            size="sm"
            variant={p.gender === 'female' ? 'primary' : 'soft'}
            onClick={() => { if (run(changeGenderIdentity, 'female').ok) setEditingIdentity(false); }}
          >
            Female
          </Button>
        </div>
      </Modal>
    </div>
  );

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
    );
  }
}
