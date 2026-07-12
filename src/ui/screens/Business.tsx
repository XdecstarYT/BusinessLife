/** Business screen: found companies, manage strategy levers, IPO, sell. */
import { lazy, Suspense, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  investInCompany,
  applyForGrant,
  attemptHostileTakeover,
  bidOnGovernmentContract,
  buybackShares,
  consultantRecommendation,
  CULTURE_INFO,
  diversifySupplyChain,
  fileTrademark,
  filePatentLawsuit,
  fireCEO,
  fireExecutive,
  franchiseCompany,
  hireBrandAmbassador,
  hireCEO,
  hireExecutive,
  holdInvestorConference,
  HQ_TIERS,
  investInRetailSecurity,
  investInStartup,
  issueCorporateBond,
  launderMoney,
  launchLoyaltyProgram,
  protectionRacket,
  proactiveRecall,
  proposeBoardResolution,
  proposeJointVenture,
  qualityAudit,
  raceForInnovation,
  renameCompany,
  runClinicalTrial,
  runFavorableCoverage,
  runRecruitmentDrive,
  runGraduateProgram,
  runLeadershipProgram,
  runTrainingProgram,
  sellCompany,
  setCompanyCulture,
  setCompanyLever,
  sponsorLocalSportsTeam,
  spinOffCompany,
  spyOnCompany,
  startCompany,
  startMoonshot,
  startPriceWar,
  takeCompanyPublic,
  toggleCompanyInsurance,
  upgradeHQ,
  withdrawFromCompany,
  type BoardProposal,
  type CompanyLever,
} from '../../sim/actions';
import { companyValuation } from '../../sim/business';
import { marketCap } from '../../sim/market';
import {
  acquireCompany, buildFactory, exitVentureStake, foundVentureArm, launchAdCampaign,
  openForeignOffice, upgradeFactoryAutomation, ventureInvest,
} from '../../sim/corpExpansion';
import { ACQUISITION_PREMIUM, AD_CAMPAIGN_MAX_YEARS, AD_CAMPAIGN_MIN_BUDGET, AD_CHANNELS, automationUpgradeCost, factoryCost, foreignOfficeCost, VENTURE_ARM_COST, VENTURE_ARM_MIN_HQ_TIER, VENTURE_MIN_INVESTMENT, VENTURE_TARGET_VALUATION_CEILING } from '../../data/corpExpansion';
import { Badge, Button, Card, Field, LineChart, Modal, Pill, PillRow, SectionHeader, StatBar, TextInput } from '../components';
import { money, moneyFull, pct } from '../format';
import { INDUSTRIES, INDUSTRY_BY_ID } from '../../data/industries';
import type { AdChannel, Company, ExecutiveRole } from '../../sim/types';

const HQTourScene = lazy(() => import('../three/HQTourScene').then((m) => ({ default: m.HQTourScene })));
const SupplyChainScene = lazy(() => import('../three/SupplyChainScene').then((m) => ({ default: m.SupplyChainScene })));
const SceneFallback = <div className="w-full h-48 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

const EXEC_ROLES: { role: ExecutiveRole; label: string; blurb: string }[] = [
  { role: 'cfo', label: 'CFO', blurb: 'Cuts your effective interest rate on debt.' },
  { role: 'coo', label: 'COO', blurb: 'Improves overall management effectiveness.' },
  { role: 'cmo', label: 'CMO', blurb: 'Boosts marketing power and demand.' },
];

export function Business() {
  const { state, run } = useGame();
  const [founding, setFounding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'mine' | 'rivals'>('mine');
  const [takeoverTarget, setTakeoverTarget] = useState<string | null>(null);
  const [jvTarget, setJvTarget] = useState<{ mineId: string; partnerId: string } | null>(null);
  if (!state) return null;
  const p = state.player;
  const companies = p.companies.map((id) => state.companies[id]).filter((c): c is Company => !!c && c.status === 'active');
  const totalRevenue = companies.reduce((s, c) => s + c.revenue, 0);
  const totalProfit = companies.reduce((s, c) => s + c.profit, 0);
  const rivals = Object.values(state.companies).filter(
    (c) => c.status === 'active' && c.countryId === p.countryId && !c.playerOwned,
  );

  return (
    <div>
      <SectionHeader title="Business Empire" action="Found" onAction={() => setFounding(true)} />
      <PillRow>
        <Pill label="My Companies" active={view === 'mine'} onClick={() => setView('mine')} />
        <Pill label={`Rivals (${rivals.length})`} active={view === 'rivals'} onClick={() => setView('rivals')} />
      </PillRow>

      {view === 'rivals' ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-400 px-1">
            Spy for a competitive edge, or launch a hostile takeover to seize a public rival outright (needs an offer worth 60%+ of market cap).
          </p>
          {rivals.map((c) => {
            const ind = INDUSTRY_BY_ID[c.industryId];
            const myRival = companies.find((mine) => mine.industryId === c.industryId);
            return (
              <Card key={c.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold truncate" title={c.name}>{c.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {ind?.name} · cap {money(marketCap(c))} · price {c.priceLevel < 0.9 ? 'discount' : c.priceLevel > 1.1 ? 'premium' : 'mid-market'} · {Math.round(c.marketShare * 100)}% share
                    </div>
                  </div>
                  {c.isPublic ? <Badge tone="brand">Public</Badge> : <Badge>Private</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="soft" onClick={() => run(spyOnCompany, c.id)}>🕵️ Espionage</Button>
                  {c.isPublic ? (
                    <Button size="sm" onClick={() => setTakeoverTarget(c.id)}>🏴 Takeover</Button>
                  ) : (
                    <Button size="sm" disabled={companyValuation(c) * ACQUISITION_PREMIUM > state.player.money} onClick={() => run(acquireCompany, c.id)}>
                      🤝 Acquire ({money(Math.round(companyValuation(c) * ACQUISITION_PREMIUM))})
                    </Button>
                  )}
                  {myRival && (
                    <Button size="sm" variant="soft" className="col-span-2" onClick={() => run(startPriceWar, myRival.id, c.id)}>
                      ⚔️ Price War (with {myRival.name})
                    </Button>
                  )}
                  {myRival && myRival.patents > 0 && (
                    <Button size="sm" variant="soft" className="col-span-2" onClick={() => run(filePatentLawsuit, myRival.id, c.id)}>
                      ⚖️ Sue for Patent Infringement (with {myRival.name})
                    </Button>
                  )}
                  {myRival && !myRival.jointVenturePartnerId && (
                    <Button size="sm" variant="soft" className="col-span-2" onClick={() => setJvTarget({ mineId: myRival.id, partnerId: c.id })}>
                      🤝 Propose Joint Venture (with {myRival.name})
                    </Button>
                  )}
                </div>
                {!c.isPublic && c.revenue <= 3_000_000 && (
                  <Button size="sm" variant="soft" className="w-full mt-2" onClick={() => run(investInStartup, c.id, 50_000)}>
                    🌱 Invest $50k (VC Stake)
                  </Button>
                )}
                {state.player.crimeFamilyId && (
                  <Button size="sm" variant="danger" className="w-full mt-2" onClick={() => run(protectionRacket, c.id)}>
                    🔫 Shakedown
                  </Button>
                )}
              </Card>
            );
          })}
          {rivals.length === 0 && <Card className="p-6 text-center text-slate-500 dark:text-slate-400">No rival companies found in your country yet.</Card>}
        </div>
      ) : (
        <BusinessMineView companies={companies} totalRevenue={totalRevenue} totalProfit={totalProfit} onFound={() => setFounding(true)} onSelect={setSelected} />
      )}

      <FoundModal open={founding} onClose={() => setFounding(false)} />
      {selected && <ManageModal companyId={selected} onClose={() => setSelected(null)} />}
      {takeoverTarget && <TakeoverModal companyId={takeoverTarget} onClose={() => setTakeoverTarget(null)} />}
      {jvTarget && <JointVentureModal mineId={jvTarget.mineId} partnerId={jvTarget.partnerId} onClose={() => setJvTarget(null)} />}
    </div>
  );
}

function BusinessMineView({
  companies,
  totalRevenue,
  totalProfit,
  onFound,
  onSelect,
}: {
  companies: Company[];
  totalRevenue: number;
  totalProfit: number;
  onFound: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-3">
      {companies.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MiniStat label="Companies" value={String(companies.length)} />
          <MiniStat label="Revenue" value={money(totalRevenue)} />
          <MiniStat label="Profit" value={money(totalProfit)} tone={totalProfit >= 0 ? 'good' : 'bad'} />
        </div>
      )}

      {companies.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="text-4xl mb-2">🏢</div>
          <p className="text-slate-500 dark:text-slate-400 mb-4">You don't own any companies yet. Found one to start building your empire — 200+ industries await.</p>
          <Button onClick={onFound}>Found a Company</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {companies.map((c) => {
            const ind = INDUSTRY_BY_ID[c.industryId];
            const revHist = c.history.map((h) => h.revenue);
            return (
              <Card key={c.id} className="p-4" onClick={() => onSelect(c.id)}>
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0">
                    <div className="font-extrabold truncate" title={c.name}>{c.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{ind?.name} · {ind?.sector}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.isPublic ? <Badge tone="brand">Public</Badge> : <Badge>Private</Badge>}
                  </div>
                </div>
                <div className="h-14 -mx-1">
                  <LineChart data={revHist.length ? revHist : [c.revenue]} height={56} color={c.profit >= 0 ? '#10b981' : '#f43f5e'} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div>
                    <div className="text-[11px] text-slate-400">Revenue</div>
                    <div className="font-bold text-sm">{money(c.revenue)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Profit</div>
                    <div className={`font-bold text-sm ${c.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{money(c.profit)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Value</div>
                    <div className="font-bold text-sm">{money(c.isPublic ? c.sharePrice * c.sharesOutstanding * c.playerSharePct : companyValuation(c) * c.playerSharePct)}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <Card className="p-3 text-center">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`font-extrabold ${tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-rose-500' : ''}`}>{value}</div>
    </Card>
  );
}

function FoundModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, run } = useGame();
  const [sector, setSector] = useState<string>('all');
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [funding, setFunding] = useState(0);
  if (!state) return null;
  const p = state.player;
  const sectors = ['all', ...new Set(INDUSTRIES.map((i) => i.sector))];
  const list = INDUSTRIES.filter((i) => (sector === 'all' ? true : i.sector === sector) && i.startupCost * 0.5 <= p.money);
  const ind = industryId ? INDUSTRY_BY_ID[industryId] : null;

  const pick = (id: string) => {
    setIndustryId(id);
    const i = INDUSTRY_BY_ID[id];
    setFunding(Math.min(p.money, Math.round(i.startupCost)));
  };

  return (
    <Modal open={open} onClose={onClose} title="Found a Company">
      {!ind ? (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Choose an industry you can afford (you have {money(p.money)}).</p>
          <PillRow>
            {sectors.map((s) => (
              <Pill key={s} label={s === 'all' ? 'All' : s} active={sector === s} onClick={() => setSector(s)} />
            ))}
          </PillRow>
          <div className="mt-3 space-y-2 max-h-[50vh] overflow-y-auto">
            {list.length === 0 && <p className="text-center text-slate-400 py-6">No affordable industries in this sector.</p>}
            {list.map((i) => {
              const era = state.industryEraMultiplier[i.id] ?? 1;
              return (
                <button
                  key={i.id}
                  onClick={() => pick(i.id)}
                  className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold truncate min-w-0" title={i.name}>
                      {i.name}
                      {era > 1.12 && <span title="Rising industry — a growing share of the world's economy"> 📈</span>}
                      {era < 0.9 && <span title="Declining industry — a shrinking share of the world's economy"> 📉</span>}
                    </span>
                    <span className="text-sm font-bold text-brand-500 shrink-0">{money(i.startupCost)}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {i.sector} · margin {pct(i.baseMargin, 0)} · {i.tags.slice(0, 3).join(', ')}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setIndustryId(null)} className="text-sm text-brand-500 font-semibold mb-3">← Change industry</button>
          <div className="font-extrabold text-lg">{ind.name}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">{ind.sector} sector · typical margin {pct(ind.baseMargin, 0)}</div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Company name</label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="(auto-generated if blank)" maxLength={30} className="mb-4 mt-1" />
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Initial funding: <span className="text-brand-500 font-bold">{moneyFull(funding)}</span>
          </label>
          <input
            type="range"
            min={Math.round(ind.startupCost * 0.5)}
            max={Math.round(Math.min(p.money, ind.startupCost * 5))}
            value={funding}
            onChange={(e) => setFunding(Number(e.target.value))}
            className="w-full mt-2 mb-1"
          />
          <div className="text-xs text-slate-400 mb-4">More capital means a bigger launch, faster growth and more staff.</div>
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              const r = run(startCompany, ind.id, name, funding);
              if (r.ok) onClose();
            }}
          >
            Launch for {money(funding)}
          </Button>
        </>
      )}
    </Modal>
  );
}

function ManageModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { state, run } = useGame();
  const [amount, setAmount] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [expansionModal, setExpansionModal] = useState<'factory' | 'office' | 'venture' | 'campaign' | null>(null);
  if (!state) return null;
  const c = state.companies[companyId];
  if (!c) return null;
  const ind = INDUSTRY_BY_ID[c.industryId];

  const lever = (key: CompanyLever, label: string, min: number, max: number, step: number, fmt: (v: number) => string) => (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-bold text-brand-500">{fmt((c as unknown as Record<string, number>)[key])}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={(c as unknown as Record<string, number>)[key]}
        onChange={(e) => run(setCompanyLever, companyId, key, Number(e.target.value))}
        className="w-full"
      />
    </div>
  );

  return (
    <>
    <Modal open onClose={onClose} title={c.name}>
      {renaming ? (
        <div className="flex items-center gap-2 mb-3">
          <TextInput value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} maxLength={40} className="flex-1" />
          <Button size="sm" onClick={() => { if (run(renameCompany, companyId, renameDraft).ok) setRenaming(false); }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
        </div>
      ) : (
        <button className="text-xs text-brand-500 font-semibold mb-3" onClick={() => { setRenameDraft(c.name); setRenaming(true); }}>
          ✏️ Rename company
        </button>
      )}
      <div className="flex items-center gap-2 mb-4">
        <Badge tone="brand">{ind?.name}</Badge>
        {c.isPublic && <Badge tone="good">Public · {money(c.sharePrice)}/sh</Badge>}
        {c.unionized && <Badge tone="warn">Unionized</Badge>}
        <Badge>{pct(c.playerSharePct, 0)} owned</Badge>
      </div>

      <div className="h-24 mb-3">
        <LineChart data={c.history.map((h) => h.revenue)} height={96} color="#337dff" />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <Row label="Cash" value={money(c.cash)} />
        <Row label="Debt" value={money(c.debt)} tone={c.debt > 0 ? 'bad' : undefined} />
        <Row label="Employees" value={c.employees.toLocaleString()} />
        <Row label="Market share" value={pct(c.marketShare, 2)} />
        <Row label="Patents" value={String(c.patents)} />
        <Row label="Lawsuits" value={String(c.lawsuits)} tone={c.lawsuits > 0 ? 'bad' : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3 space-y-2">
          <StatBar label="Brand" value={c.brand} />
          <StatBar label="Quality" value={c.quality} />
        </Card>
        <Card className="p-3 space-y-2">
          <StatBar label="Morale" value={c.morale} />
          <StatBar label="Satisfaction" value={c.customerSatisfaction} />
        </Card>
      </div>

      <div className="font-bold mb-3">Strategy</div>
      <div className="space-y-4">
        {lever('marketingPct', 'Marketing budget', 0, 0.25, 0.01, (v) => pct(v, 0))}
        {lever('rdPct', 'R&D budget', 0, 0.25, 0.01, (v) => pct(v, 0))}
        {lever('priceLevel', 'Pricing', 0.7, 1.5, 0.05, (v) => (v < 0.95 ? 'Discount' : v > 1.15 ? 'Premium' : 'Market'))}
        {lever('salaryLevel', 'Wages', 0.85, 1.4, 0.05, (v) => (v < 0.95 ? 'Low' : v > 1.15 ? 'Generous' : 'Market'))}
        {lever('automation', 'Automation', 0, 100, 5, (v) => `${Math.round(v)}%`)}
        {lever('cyberDefense', 'Cyber defense', 0, 100, 5, (v) => `${Math.round(v)}%`)}
        {c.isPublic && lever('dividendPayoutPct', 'Dividend payout', 0, 0.9, 0.05, (v) => pct(v, 0))}
      </div>

      <div className="flex items-center justify-between mt-4 bg-slate-100 dark:bg-ink-800 rounded-2xl px-4 py-3">
        <div>
          <div className="font-semibold text-sm">Business Insurance</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Costs ~1% of revenue/yr; covers 70% of lawsuit damages.</div>
        </div>
        <Button size="sm" variant={c.insured ? 'primary' : 'soft'} onClick={() => run(toggleCompanyInsurance, c.id)}>
          {c.insured ? 'Insured' : 'Uninsured'}
        </Button>
      </div>

      <div className="font-bold mt-5 mb-2">Headquarters</div>
      <Card className="p-3 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">{HQ_TIERS[c.hqTier].name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{HQ_TIERS[c.hqTier].blurb}</div>
          </div>
          {c.hqTier < 3 && (
            <Button size="sm" variant="soft" onClick={() => run(upgradeHQ, c.id)}>
              Upgrade
            </Button>
          )}
        </div>
      </Card>
      <Suspense fallback={SceneFallback}>
        <HQTourScene hqTier={c.hqTier} employees={c.employees} morale={c.morale} culture={c.culture} />
      </Suspense>
      <div className="font-bold mb-2 mt-3">Culture</div>
      <div className="grid grid-cols-2 gap-2 mb-1">
        {(Object.keys(CULTURE_INFO) as Company['culture'][]).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={c.culture === k ? 'primary' : 'soft'}
            onClick={() => run(setCompanyCulture, c.id, k)}
          >
            {CULTURE_INFO[k].label}
          </Button>
        ))}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{CULTURE_INFO[c.culture].blurb}</div>

      <Card className="p-3 mt-5 mb-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
        <div className="text-[11px] font-bold text-brand-600 dark:text-brand-400 uppercase mb-1">🤖 AI Business Consultant</div>
        <div className="text-xs text-slate-600 dark:text-slate-300">{consultantRecommendation(c, ind?.tags ?? [])}</div>
      </Card>

      <div className="font-bold mt-5 mb-2">One-off Initiatives</div>
      <div className="mb-2">
        <StatBar label="Supply chain resilience" value={c.supplyChainResilience} />
      </div>
      <Suspense fallback={SceneFallback}>
        <SupplyChainScene supplyChainResilience={c.supplyChainResilience} revenue={c.revenue} />
      </Suspense>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Button size="sm" variant="soft" onClick={() => run(hireBrandAmbassador, c.id)}>🌟 Brand Deal</Button>
        <Button size="sm" variant="soft" onClick={() => run(runTrainingProgram, c.id)}>🎓 Training</Button>
        <Button size="sm" variant="soft" onClick={() => run(runGraduateProgram, c.id)}>🎓 Graduate Program</Button>
        <Button size="sm" variant="soft" onClick={() => run(runLeadershipProgram, c.id)}>🏆 Leadership Program</Button>
        <Button size="sm" variant="soft" onClick={() => run(diversifySupplyChain, c.id)}>🔗 Diversify Supply</Button>
        <Button size="sm" variant="soft" onClick={() => run(qualityAudit, c.id)}>✅ Quality Audit</Button>
        <Button size="sm" variant="soft" onClick={() => run(fileTrademark, c.id)}>™️ File Trademark ({c.trademarks}/5)</Button>
        <Button size="sm" variant="soft" onClick={() => run(proactiveRecall, c.id)}>⚠️ Proactive Recall</Button>
        <Button size="sm" variant="soft" onClick={() => run(runRecruitmentDrive, c.id)}>🧑‍💼 Recruitment Drive</Button>
        <Button size="sm" variant="soft" onClick={() => run(franchiseCompany, c.id)}>🏬 Franchise ({c.franchiseCount})</Button>
        <Button size="sm" variant="soft" onClick={() => run(raceForInnovation, c.id)}>🔬 Race for Innovation</Button>
        <Button size="sm" variant="soft" onClick={() => run(sponsorLocalSportsTeam, c.id)}>🏟️ Sponsor Sports Team</Button>
        <Button size="sm" variant="soft" disabled={!!c.moonshot} onClick={() => run(startMoonshot, c.id)}>
          {c.moonshot ? `🚀 Moonshot: ${c.moonshot.yearsLeft}yr left` : '🚀 Start Moonshot'}
        </Button>
        {c.ceoName ? (
          <Button size="sm" variant="ghost" onClick={() => run(fireCEO, c.id)}>🪑 Dismiss CEO ({c.ceoName})</Button>
        ) : (
          <Button size="sm" variant="soft" onClick={() => run(hireCEO, c.id)}>🤝 Hire a CEO</Button>
        )}
        {c.isPublic && (
          <Button size="sm" variant="soft" onClick={() => run(holdInvestorConference, c.id)}>📊 Investor Conference</Button>
        )}
        {ind?.tags.includes('retail') && (
          <Button size="sm" variant="soft" disabled={c.securityInvested} onClick={() => run(investInRetailSecurity, c.id)}>
            {c.securityInvested ? '🔒 Security Active' : '🔒 Invest in Security'}
          </Button>
        )}
        {ind?.tags.includes('health') && ind.techIntensity >= 0.5 && (
          <Button size="sm" variant="soft" onClick={() => run(runClinicalTrial, c.id)}>💊 Run Clinical Trial</Button>
        )}
        {ind?.tags.includes('media') && (
          <Button size="sm" variant="soft" className="col-span-2" onClick={() => run(runFavorableCoverage, c.id)}>
            📰 Favorable Coverage ({Math.round(c.politicalInfluence)} influence)
          </Button>
        )}
        <Button
          size="sm"
          variant="soft"
          className="col-span-2"
          disabled={c.loyaltyProgram}
          onClick={() => run(launchLoyaltyProgram, c.id)}
        >
          {c.loyaltyProgram ? '💳 Loyalty Program Active' : '💳 Launch Loyalty Program'}
        </Button>
      </div>

      {state.player.dirtyMoney > 0 && (
        <>
          <div className="font-bold mt-5 mb-2">Launder Money</div>
          <div className="flex items-center justify-between bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2 mb-2">
            <div className="text-xs">
              <div className="font-semibold">Dirty money: {money(state.player.dirtyMoney)}</div>
              <div className="text-slate-500 dark:text-slate-400">Run it through {c.name} to clean it, minus a cut.</div>
            </div>
            <Button size="sm" variant="soft" onClick={() => run(launderMoney, c.id, state.player.dirtyMoney)}>Launder All</Button>
          </div>
        </>
      )}

      <div className="font-bold mt-5 mb-2">Executive Team</div>
      <div className="space-y-2 mb-2">
        {EXEC_ROLES.map(({ role, label, blurb }) => {
          const exec = c.executives.find((e) => e.role === role);
          return (
            <div key={role} className="flex items-center justify-between bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2">
              <div className="min-w-0 pr-2">
                <div className="text-xs font-bold">{label}{exec ? `: ${exec.name}` : ''}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{exec ? `Skill ${Math.round(exec.skill)} · ${money(exec.salary)}/yr` : blurb}</div>
              </div>
              {exec ? (
                <Button size="sm" variant="ghost" onClick={() => run(fireExecutive, c.id, role)}>Let Go</Button>
              ) : (
                <Button size="sm" variant="soft" onClick={() => run(hireExecutive, c.id, role)}>Hire</Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="font-bold mb-2">Corporate Finance</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {c.bondDebt > 0 ? (
          <div className="col-span-2 text-xs bg-slate-100 dark:bg-ink-800 rounded-xl px-3 py-2 flex justify-between">
            <span>Bond outstanding</span>
            <span className="font-bold">{money(c.bondDebt)} @ {(c.bondRate * 100).toFixed(1)}% · {c.bondYearsLeft}yr left</span>
          </div>
        ) : (
          <Button size="sm" variant="soft" onClick={() => run(issueCorporateBond, c.id, Math.max(50_000, Math.round(c.revenue * 0.3)), 5)}>
            🏦 Issue Bond
          </Button>
        )}
        {c.isPublic && (
          <Button size="sm" variant="soft" onClick={() => run(buybackShares, c.id, Math.min(c.cash, c.revenue * 0.1))}>
            🔁 Buyback Shares
          </Button>
        )}
        <Button size="sm" variant="soft" className={c.isPublic ? '' : 'col-span-2'} onClick={() => run(spinOffCompany, c.id)}>
          ✂️ Spin Off Division
        </Button>
        <Button size="sm" variant="soft" disabled={c.lastGovContractBidYear === state.year} onClick={() => run(bidOnGovernmentContract, c.id)}>
          🏛️ {c.lastGovContractBidYear === state.year ? 'Bid Placed This Year' : 'Bid on Gov Contract'}
        </Button>
        <Button size="sm" variant="soft" disabled={c.lastGrantYear === state.year} onClick={() => run(applyForGrant, c.id)}>
          📝 {c.lastGrantYear === state.year ? 'Applied This Year' : 'Apply for Grant'}
        </Button>
      </div>

      {c.isPublic && (
        <>
          <div className="font-bold mb-2">Shareholder Votes</div>
          <div className="grid grid-cols-1 gap-2 mb-2">
            {(
              [
                { id: 'increase_dividend', label: '📈 Propose Higher Dividend' },
                { id: 'exec_compensation', label: '💼 Propose Exec Pay Raise' },
                { id: 'block_activist', label: '🛡️ Rally Board vs. Activist' },
              ] as { id: BoardProposal; label: string }[]
            ).map((p) => (
              <Button key={p.id} size="sm" variant="soft" onClick={() => run(proposeBoardResolution, c.id, p.id)}>
                {p.label}
              </Button>
            ))}
          </div>
        </>
      )}

      <div className="font-bold mt-5 mb-2">🌍 Corporate Empire</div>
      <div className="space-y-2 mb-2">
        <Card className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-bold">🏭 Factories ({c.factories.length})</div>
            <Button size="sm" variant="soft" onClick={() => setExpansionModal('factory')}>Build</Button>
          </div>
          {c.factories.length > 0 ? (
            <div className="space-y-1 mt-1">
              {c.factories.map((f) => {
                const country = state.countries.find((x) => x.id === f.countryId);
                return (
                  <div key={f.id} className="flex items-center justify-between text-[11px] bg-slate-100 dark:bg-ink-800 rounded-lg px-2 py-1.5">
                    <span>{country?.flag} Automation {f.automationLevel}/5 · Condition {Math.round(f.condition)}%</span>
                    {f.automationLevel < 5 && (
                      <button className="text-brand-500 font-semibold" onClick={() => run(upgradeFactoryAutomation, c.id, f.id)}>
                        Upgrade ({money(automationUpgradeCost(f.automationLevel))})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">Build a factory for ongoing production capacity and an output dividend.</div>
          )}
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-bold">🌐 Foreign Offices ({c.internationalOffices.length})</div>
            <Button size="sm" variant="soft" onClick={() => setExpansionModal('office')}>Open</Button>
          </div>
          {c.internationalOffices.length > 0 ? (
            <div className="space-y-1 mt-1">
              {c.internationalOffices.map((o) => {
                const country = state.countries.find((x) => x.id === o.countryId);
                return (
                  <div key={o.id} className="text-[11px] bg-slate-100 dark:bg-ink-800 rounded-lg px-2 py-1.5">
                    {country?.flag} {country?.name} · Strength {Math.round(o.strength)}%
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">Open an office abroad for a new international revenue stream.</div>
          )}
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-bold">💰 Venture Capital Arm</div>
            {c.hasVentureArm ? (
              <Button size="sm" variant="soft" onClick={() => setExpansionModal('venture')}>Invest</Button>
            ) : (
              <Button size="sm" variant="soft" disabled={c.hqTier < VENTURE_ARM_MIN_HQ_TIER || c.cash < VENTURE_ARM_COST} onClick={() => run(foundVentureArm, c.id)}>
                Found ({money(VENTURE_ARM_COST)})
              </Button>
            )}
          </div>
          {c.hasVentureArm ? (
            c.ventureInvestments.length > 0 ? (
              <div className="space-y-1 mt-1">
                {c.ventureInvestments.map((v) => {
                  const target = state.companies[v.targetCompanyId];
                  return (
                    <div key={v.id} className="flex items-center justify-between text-[11px] bg-slate-100 dark:bg-ink-800 rounded-lg px-2 py-1.5">
                      <span>{target?.name ?? 'Unknown'} · {(v.equityPct * 100).toFixed(1)}% stake</span>
                      <button className="text-brand-500 font-semibold" onClick={() => run(exitVentureStake, c.id, v.id)}>Exit</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">No stakes yet — invest company cash in a small private rival for equity.</div>
            )
          ) : (
            <div className="text-[11px] text-slate-400">Needs {HQ_TIERS[VENTURE_ARM_MIN_HQ_TIER].name}+ HQ. Builds a startup portfolio funded by company cash.</div>
          )}
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-bold">📢 Marketing Campaign</div>
            {!c.activeCampaign && <Button size="sm" variant="soft" onClick={() => setExpansionModal('campaign')}>Launch</Button>}
          </div>
          {c.activeCampaign ? (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {AD_CHANNELS.find((a) => a.id === c.activeCampaign!.channel)?.icon} {AD_CHANNELS.find((a) => a.id === c.activeCampaign!.channel)?.name} ·
              {' '}{c.activeCampaign.yearsLeft}/{c.activeCampaign.totalYears} yr left · {money(c.activeCampaign.totalBudget)} committed
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">{c.campaignsRun} campaign{c.campaignsRun === 1 ? '' : 's'} run lifetime.</div>
          )}
        </Card>
      </div>

      <div className="font-bold mt-5 mb-2">Capital</div>
      <input
        type="range"
        min={0}
        max={Math.round(Math.max(state.player.money, c.cash * c.playerSharePct))}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-full mb-1"
      />
      <div className="text-center text-sm font-bold text-brand-500 mb-2">{moneyFull(amount)}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" size="sm" onClick={() => amount > 0 && run(investInCompany, companyId, amount)}>
          Invest In
        </Button>
        <Button variant="soft" size="sm" onClick={() => amount > 0 && run(withdrawFromCompany, companyId, amount)}>
          Withdraw
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {!c.isPublic && (
          <Button size="sm" onClick={() => { const r = run(takeCompanyPublic, companyId); if (r.ok) onClose(); }}>
            IPO 📈
          </Button>
        )}
        <Button variant="danger" size="sm" className={c.isPublic ? 'col-span-2' : ''} onClick={() => { const r = run(sellCompany, companyId); if (r.ok) onClose(); }}>
          Sell Company
        </Button>
      </div>
    </Modal>
    {expansionModal === 'factory' && <FactoryModal companyId={c.id} onClose={() => setExpansionModal(null)} />}
    {expansionModal === 'office' && <OfficeModal companyId={c.id} onClose={() => setExpansionModal(null)} />}
    {expansionModal === 'venture' && <VentureModal companyId={c.id} onClose={() => setExpansionModal(null)} />}
    {expansionModal === 'campaign' && <CampaignModal companyId={c.id} onClose={() => setExpansionModal(null)} />}
    </>
  );

  function Row({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
    return (
      <div className="flex justify-between">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`font-bold ${tone === 'bad' ? 'text-rose-500' : ''}`}>{value}</span>
      </div>
    );
  }
}

function FactoryModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { state, run } = useGame();
  const c = state?.companies[companyId];
  const eligibleCountries = state && c
    ? [state.countries.find((x) => x.id === c.countryId)!, ...c.internationalOffices.map((o) => state.countries.find((x) => x.id === o.countryId)!).filter(Boolean)]
    : [];
  const [countryId, setCountryId] = useState(c?.countryId ?? '');
  if (!state || !c) return null;
  const ind = INDUSTRY_BY_ID[c.industryId];
  const cost = factoryCost(ind?.capitalIntensity ?? 0.5);

  return (
    <Modal open onClose={onClose} title={`Build a Factory: ${c.name}`}>
      <p className="text-xs text-slate-400 mb-3">
        Adds production capacity for an ongoing output dividend each year, and can be upgraded with
        automation. Foreign factories require an office already open in that country.
      </p>
      <Field label="Location">
        <select
          value={countryId || c.countryId}
          onChange={(e) => setCountryId(e.target.value)}
          className="w-full rounded-2xl bg-slate-100 dark:bg-ink-800 border border-transparent px-4 py-3 text-slate-900 dark:text-white"
        >
          {eligibleCountries.map((country) => (
            <option key={country.id} value={country.id}>{country.flag} {country.name}{country.id === c.countryId ? ' (Home)' : ''}</option>
          ))}
        </select>
      </Field>
      <Button
        className="w-full mt-4"
        size="lg"
        disabled={cost > c.cash}
        onClick={() => { const r = run(buildFactory, companyId, countryId || c.countryId); if (r.ok) onClose(); }}
      >
        Build for {money(cost)}
      </Button>
    </Modal>
  );
}

function OfficeModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { state, run } = useGame();
  const c = state?.companies[companyId];
  const options = state && c ? state.countries.filter((x) => x.id !== c.countryId && !c.internationalOffices.some((o) => o.countryId === x.id)) : [];
  const [countryId, setCountryId] = useState(options[0]?.id ?? '');
  if (!state || !c) return null;
  const dest = state.countries.find((x) => x.id === (countryId || options[0]?.id));
  const cost = dest ? foreignOfficeCost(dest.economy.gdp) : 0;

  return (
    <Modal open onClose={onClose} title={`Open a Foreign Office: ${c.name}`}>
      <p className="text-xs text-slate-400 mb-3">Opens a new international revenue stream that ramps up over time.</p>
      {options.length === 0 ? (
        <p className="text-sm text-center text-slate-400 py-4">No new markets available.</p>
      ) : (
        <>
          <Field label="Country">
            <select
              value={countryId || options[0].id}
              onChange={(e) => setCountryId(e.target.value)}
              className="w-full rounded-2xl bg-slate-100 dark:bg-ink-800 border border-transparent px-4 py-3 text-slate-900 dark:text-white"
            >
              {options.map((country) => (
                <option key={country.id} value={country.id}>{country.flag} {country.name}</option>
              ))}
            </select>
          </Field>
          <Button
            className="w-full mt-4"
            size="lg"
            disabled={cost > c.cash}
            onClick={() => { const r = run(openForeignOffice, companyId, countryId || options[0].id); if (r.ok) onClose(); }}
          >
            Open for {money(cost)}
          </Button>
        </>
      )}
    </Modal>
  );
}

function VentureModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { state, run } = useGame();
  const c = state?.companies[companyId];
  const [amount, setAmount] = useState(VENTURE_MIN_INVESTMENT);
  const [targetId, setTargetId] = useState<string | null>(null);
  if (!state || !c) return null;
  const targets = Object.values(state.companies).filter(
    (t) => t.status === 'active' && !t.playerOwned && !t.isPublic && companyValuation(t) <= VENTURE_TARGET_VALUATION_CEILING,
  );

  return (
    <Modal open onClose={onClose} title={`Venture Investment: ${c.name}`}>
      {!targetId ? (
        <>
          <p className="text-xs text-slate-400 mb-3">Pick a small private company to back for an equity stake.</p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {targets.length === 0 && <p className="text-center text-slate-400 py-6">No eligible startups found right now.</p>}
            {targets.map((t) => (
              <button
                key={t.id}
                onClick={() => setTargetId(t.id)}
                className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-semibold truncate">{t.name}</span>
                  <span className="text-sm font-bold text-brand-500 shrink-0">{money(companyValuation(t))}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{INDUSTRY_BY_ID[t.industryId]?.name}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setTargetId(null)} className="text-sm text-brand-500 font-semibold mb-3">← Change target</button>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Investment: {moneyFull(amount)}</label>
          <input
            type="range"
            min={VENTURE_MIN_INVESTMENT}
            max={Math.max(VENTURE_MIN_INVESTMENT, Math.round(c.cash))}
            step={5_000}
            value={Math.min(amount, Math.round(c.cash))}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full mt-1 mb-4"
          />
          <Button
            className="w-full"
            size="lg"
            disabled={amount > c.cash}
            onClick={() => { const r = run(ventureInvest, companyId, targetId, amount); if (r.ok) onClose(); }}
          >
            Invest {money(amount)}
          </Button>
        </>
      )}
    </Modal>
  );
}

function CampaignModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { state, run } = useGame();
  const c = state?.companies[companyId];
  const [channel, setChannel] = useState<AdChannel>('social');
  const [budget, setBudget] = useState(AD_CAMPAIGN_MIN_BUDGET);
  const [years, setYears] = useState(2);
  if (!state || !c) return null;
  const def = AD_CHANNELS.find((a) => a.id === channel)!;

  return (
    <Modal open onClose={onClose} title={`Launch a Campaign: ${c.name}`}>
      <PillRow>
        {AD_CHANNELS.map((a) => (
          <Pill key={a.id} label={`${a.icon} ${a.name}`} active={channel === a.id} onClick={() => setChannel(a.id)} />
        ))}
      </PillRow>
      <p className="text-xs text-slate-400 mt-2 mb-3">{def.blurb}</p>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total budget: {moneyFull(budget)}</label>
      <input
        type="range"
        min={AD_CAMPAIGN_MIN_BUDGET}
        max={Math.max(AD_CAMPAIGN_MIN_BUDGET, Math.round(c.cash))}
        step={5_000}
        value={Math.min(budget, Math.round(c.cash))}
        onChange={(e) => setBudget(Number(e.target.value))}
        className="w-full mt-1 mb-4"
      />
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Duration: {years} year{years === 1 ? '' : 's'}</label>
      <input
        type="range"
        min={1}
        max={AD_CAMPAIGN_MAX_YEARS}
        value={years}
        onChange={(e) => setYears(Number(e.target.value))}
        className="w-full mt-1 mb-4"
      />
      <Button
        className="w-full"
        size="lg"
        disabled={budget > c.cash}
        onClick={() => { const r = run(launchAdCampaign, companyId, channel, budget, years); if (r.ok) onClose(); }}
      >
        Launch for {money(budget)}
      </Button>
    </Modal>
  );
}

function TakeoverModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const { state, run } = useGame();
  const c = state?.companies[companyId];
  const cap = c ? Math.max(1, marketCap(c)) : 1;
  const [offer, setOffer] = useState(Math.round(cap * 0.65));
  if (!state || !c) return null;
  const ratio = offer / cap;

  return (
    <Modal open onClose={onClose} title={`Hostile Takeover: ${c.name}`}>
      <div className="flex items-center gap-2 mb-4">
        <Badge tone="brand">Market cap {money(cap)}</Badge>
        <Badge tone={ratio >= 0.6 ? 'good' : 'bad'}>{pct(ratio, 0)} of cap</Badge>
      </div>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Offer: {moneyFull(offer)}</label>
      <input
        type="range"
        min={Math.round(cap * 0.3)}
        max={Math.round(Math.min(state.player.money, cap * 1.5))}
        value={offer}
        onChange={(e) => setOffer(Number(e.target.value))}
        className="w-full mt-1 mb-4"
      />
      <p className="text-xs text-slate-400 mb-4">Needs 60%+ of market cap to be taken seriously. A failed bid still costs a 5% due-diligence fee.</p>
      <Button
        className="w-full"
        size="lg"
        disabled={offer > state.player.money}
        onClick={() => {
          const r = run(attemptHostileTakeover, companyId, offer);
          if (r.ok) onClose();
        }}
      >
        Launch Bid for {money(offer)}
      </Button>
    </Modal>
  );
}

function JointVentureModal({ mineId, partnerId, onClose }: { mineId: string; partnerId: string; onClose: () => void }) {
  const { state, run } = useGame();
  const mine = state?.companies[mineId];
  const partner = state?.companies[partnerId];
  const [investment, setInvestment] = useState(50_000);
  if (!state || !mine || !partner) return null;

  return (
    <Modal open onClose={onClose} title={`Joint Venture with ${partner.name}`}>
      <p className="text-xs text-slate-400 mb-4">
        Pool capital with {partner.name} for 3 years: a modest ongoing brand/quality boost while it runs, then a
        one-time payout weighted by both companies' real strength — a strong partner is a genuinely better bet, but
        it can still come back a loss.
      </p>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Investment: {moneyFull(investment)}</label>
      <input
        type="range"
        min={50_000}
        max={Math.max(50_000, Math.round(mine.cash))}
        step={5_000}
        value={investment}
        onChange={(e) => setInvestment(Number(e.target.value))}
        className="w-full mt-1 mb-4"
      />
      <Button
        className="w-full"
        size="lg"
        disabled={investment > mine.cash}
        onClick={() => {
          const r = run(proposeJointVenture, mineId, partnerId, investment);
          if (r.ok) onClose();
        }}
      >
        Commit {money(investment)}
      </Button>
    </Modal>
  );
}
