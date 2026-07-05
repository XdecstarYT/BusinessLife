/** Stats: net-worth chart, achievements, full profile, save/export tools. */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { netWorth } from '../../sim/engine';
import { OFFICE_SPEC_BY_KIND } from '../../sim/politics';
import { Badge, Button, Card, LineChart, Modal, SectionHeader, StatBar, TextInput } from '../components';
import { money } from '../format';

const ACHIEVEMENTS: Record<string, { label: string; icon: string }> = {
  millionaire: { label: 'Millionaire', icon: '💰' },
  deca_millionaire: { label: 'Deca-Millionaire', icon: '💎' },
  billionaire: { label: 'Billionaire', icon: '🤑' },
  centenarian: { label: 'Centenarian', icon: '🎂' },
  founded_party: { label: 'Party Founder', icon: '🏛️' },
  married: { label: 'Married', icon: '💍' },
  big_family: { label: 'Big Family', icon: '👨‍👩‍👧‍👦' },
  first_company: { label: 'Founder', icon: '🚀' },
  ipo_ceo: { label: 'IPO\'d a Company', icon: '📈' },
  dynasty_founder: { label: 'Dynasty Founder', icon: '👑' },
  jailbird: { label: 'Survived Prison', icon: '⛓️' },
  coalition_builder: { label: 'Coalition Builder', icon: '🤝' },
  philanthropist: { label: 'Philanthropist', icon: '❤️' },
  crime_boss: { label: 'Crime Boss', icon: '🕶️' },
  bond_investor: { label: 'Bond Investor', icon: '📜' },
  diplomat: { label: 'Diplomat', icon: '🕊️' },
  well_connected: { label: 'Well Connected', icon: '🌟' },
  arch_rival: { label: 'Arch Rival', icon: '⚔️' },
  forex_trader: { label: 'Forex Trader', icon: '💱' },
  political_dynasty: { label: 'Political Dynasty', icon: '🏰' },
  hq_megacomplex: { label: 'Megacomplex HQ', icon: '🏙️' },
  trademark_portfolio: { label: 'Trademark Portfolio', icon: '™️' },
  debate_winner: { label: 'Debate Winner', icon: '🎙️' },
  celebrity_backed: { label: 'Celebrity Backed', icon: '⭐' },
  intel_operative: { label: 'Intelligence Operative', icon: '🕵️' },
  advisor_team: { label: 'Full Advisory Team', icon: '🧠' },
  manifesto_keeper: { label: 'Manifesto Keeper', icon: '📜' },
  nation_builder: { label: 'Nation Builder', icon: '🏗️' },
  knighted: { label: 'Knighted', icon: '⚔️' },
  hall_of_fame: { label: 'Hall of Fame', icon: '🏆' },
  adoptive_parent: { label: 'Adoptive Parent', icon: '👨‍👩‍👧' },
  space_pioneer: { label: 'Space Pioneer', icon: '🚀' },
  dynasty_continued: { label: 'Dynasty Continued', icon: '🕯️' },
  challenge_crusher: { label: 'Challenge Crusher', icon: '🎯' },
  startup_investor: { label: 'Startup Investor', icon: '🌱' },
  summit_diplomat: { label: 'Summit Diplomat', icon: '🌐' },
  billionaire_lifestyle: { label: 'Billionaire Lifestyle', icon: '💎' },
  celebrity_investor: { label: 'Celebrity Investor', icon: '🌟' },
  budget_orator: { label: 'Budget Orator', icon: '📜' },
  innovation_leader: { label: 'Innovation Leader', icon: '🔬' },
  mega_builder: { label: 'Mega Builder', icon: '🏗️' },
  centa_millionaire: { label: 'Centimillionaire', icon: '💰' },
  multi_billionaire: { label: 'Multi-Billionaire', icon: '🤑' },
  nonagenarian: { label: 'Nonagenarian', icon: '🎂' },
  centenarian_elite: { label: 'Super-Centenarian', icon: '🎂' },
  renaissance_mind: { label: 'Renaissance Mind', icon: '🧠' },
  health_nut: { label: 'Health Nut', icon: '💪' },
  zen_master: { label: 'Zen Master', icon: '🧘' },
  company_empire: { label: 'Company Empire', icon: '🏢' },
  public_company_mogul: { label: 'Public Company Mogul', icon: '📈' },
  notorious: { label: 'Notorious', icon: '😈' },
  paragon: { label: 'Paragon', icon: '😇' },
  property_baron: { label: 'Property Baron', icon: '🏘️' },
  condemned_no_more: { label: 'Condemned No More', icon: '🏚️' },
  corner_office: { label: 'Corner Office', icon: '🏙️' },
  first_gig: { label: 'First Gig', icon: '🧰' },
  gig_economy_star: { label: 'Gig Economy Star', icon: '⭐' },
  viral_star: { label: 'Viral Star', icon: '📱' },
  burned_out: { label: 'Burned Out', icon: '🔥' },
  early_release: { label: 'Early Release', icon: '🔓' },
  portfolio_titan: { label: 'Portfolio Titan', icon: '📊' },
  patent_powerhouse: { label: 'Patent Powerhouse', icon: '🔬' },
  trademark_empire: { label: 'Trademark Empire', icon: '™️' },
  grand_dynasty: { label: 'Grand Dynasty', icon: '👑' },
  big_family_tree: { label: 'Big Family Tree', icon: '🌳' },
  ironman_survivor: { label: 'Iron Man Survivor', icon: '🛡️' },
  lifelong_learner: { label: 'Lifelong Learner', icon: '🎓' },
  luxury_collector: { label: 'Luxury Collector', icon: '💎' },
  debt_free: { label: 'Debt Free', icon: '🆓' },
  ten_skills_mastered: { label: 'Master of Many Trades', icon: '🧰' },
  crime_free_life: { label: 'Clean Record', icon: '✅' },
  happily_married: { label: 'Happily Married', icon: '💞' },
  serial_entrepreneur: { label: 'Serial Entrepreneur', icon: '🔁' },
  influence_peddler: { label: 'Influence Peddler', icon: '🕸️' },
  silver_tongue: { label: 'Silver Tongue', icon: '🗣️' },
  saint: { label: 'Saint', icon: '😇' },
  iron_will: { label: 'Iron Will', icon: '🖤' },
  polyglot_scholar: { label: 'Polyglot Scholar', icon: '🌍' },
  market_whale: { label: 'Market Whale', icon: '🐋' },
  ten_year_veteran_ceo: { label: 'Decade at the Helm', icon: '⏳' },
  unbreakable: { label: 'Unbreakable', icon: '💪' },
  jetsetter: { label: 'Jetsetter', icon: '✈️' },
  island_life: { label: 'Island Life', icon: '🏝️' },
  crypto_trader: { label: 'Crypto Trader', icon: '🪙' },
  crypto_millionaire: { label: 'Crypto Millionaire', icon: '🪙' },
  foundation_founder: { label: 'Foundation Founder', icon: '🏛️' },
  foundation_million: { label: 'Million-Dollar Giver', icon: '💝' },
  retired: { label: 'Retired', icon: '🌅' },
  high_roller: { label: 'High Roller', icon: '🎰' },
  bestselling_author: { label: 'Bestselling Author', icon: '📖' },
  games_host: { label: 'Global Games Host', icon: '🏟️' },
  company_of_the_year: { label: 'Company of the Year', icon: '🏆' },
  moonshot_landed: { label: 'Moonshot Landed', icon: '🚀' },
  chairman: { label: 'Chairman', icon: '🪑' },
  first_product: { label: 'First Concept', icon: '💡' },
  product_patented: { label: 'Product Patent', icon: '📜' },
  product_launched: { label: 'Product Launch', icon: '🎬' },
  product_dynasty: { label: 'Product Dynasty', icon: '🔁' },
  rnd_visionary: { label: 'R&D Visionary', icon: '🔬' },
  design_icon: { label: 'Design Icon', icon: '✨' },
  million_units: { label: 'Million Units', icon: '📦' },
  master_customizer: { label: 'Master Customizer', icon: '🧩' },
  premium_engineering: { label: 'Premium Engineering', icon: '🔩' },
  segment_master: { label: 'Segment Master', icon: '🎯' },
  trusted_brand: { label: 'Trusted Brand', icon: '🛡️' },
  recall_survivor: { label: 'Recall Survivor', icon: '🛟' },
  part_engineer: { label: 'Part Engineer', icon: '⚙️' },
  component_supplier: { label: 'Component Supplier', icon: '🏭' },
};

export function Stats() {
  const { state, save, exportCurrent, toast } = useGame();
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
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
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 mx-auto flex items-center justify-center text-white text-2xl font-black">
            {p.name.charAt(0)}
          </div>
          <div className="font-extrabold text-lg mt-2">{p.name}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Age {p.age} · Started {state.startYear}</div>
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
