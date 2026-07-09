/**
 * The Studio: the Product Design & Commerce hub. An innovation-lab 3D viewport,
 * a full design pipeline (concept → prototype → testing → production → launch),
 * an AI concept assistant, materials/engineering, R&D tree, manufacturing,
 * branding & packaging, publishing, launch events, a storefront, and an
 * analytics dashboard — the whole journey from idea to global product empire.
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { useGame } from '../../store/gameStore';
import {
  applyColorway, brandProduct, buildPrototype, clearPartOverride, createProduct,
  engineerPart, fileProductPatent, generateConcept, holdLaunchEvent, issueRecall,
  playerProducts, productQuality, productSustainability, productUnitCost, publishProduct,
  refineDesign, researchProductTech, retireProduct, revisePart, runFocusGroup, runProductTests,
  segmentFit, setComponentTier, setPartForSale, setPartOverride, setProductManufacturing,
  setProductMaterials, setProductMarketing, setProductPackaging, setProductPrice, setStorefront,
  setTargetSegment, setWarranty, startProduction, toggleProductChannel, updateProductForm,
  upgradeGeneration,
} from '../../sim/products';
import {
  COLORWAYS, COMPONENT_BY_ID, COMPONENT_DEFS, COMPONENT_TIERS, CUSTOMER_SEGMENTS, LAUNCH_VENUES,
  MANUFACTURING_STRATEGIES, PACKAGING_STYLES, PART_NAME_PREFIX, PART_SWATCHES, PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_BY_ID, PRODUCT_COMPONENTS, PRODUCT_MATERIALS, PRODUCT_PARTS,
  PRODUCT_TECH_BY_ID, PRODUCT_TECH_TREE,
} from '../../data/productData';
import { Badge, Button, Card, LineChart, Modal, Pill, PillRow, SectionHeader, StatBar, TextInput } from '../components';
import { money, moneyFull } from '../format';
import type {
  ComponentTier, Product, ProductCategory, ProductFinish, ProductMaterialId,
  SalesChannel, StudioLighting,
} from '../../sim/types';

const ProductStudioScene = lazy(() => import('../three/ProductStudioScene').then((m) => ({ default: m.ProductStudioScene })));
const SceneFallback = <div className="w-full h-80 rounded-2xl bg-slate-100 dark:bg-ink-800 animate-pulse" />;

const STAGE_INFO: Record<Product['stage'], { label: string; tone: 'brand' | 'good' | 'warn' | 'bad' }> = {
  concept: { label: 'Concept', tone: 'brand' },
  prototype: { label: 'Prototype', tone: 'brand' },
  testing: { label: 'Testing', tone: 'warn' },
  production: { label: 'Production', tone: 'warn' },
  launched: { label: 'Launched', tone: 'good' },
  retired: { label: 'Retired', tone: 'bad' },
};

const THEMES = [
  { id: 'aurora', label: 'Aurora', swatch: 'from-teal-400 to-violet-500' },
  { id: 'noir', label: 'Noir', swatch: 'from-slate-700 to-slate-900' },
  { id: 'porcelain', label: 'Porcelain', swatch: 'from-slate-100 to-slate-300' },
  { id: 'terra', label: 'Terra', swatch: 'from-amber-400 to-rose-500' },
] as const;

export function Studio() {
  const { state } = useGame();
  const [tab, setTab] = useState<'lab' | 'designer' | 'parts' | 'rnd' | 'analytics' | 'store'>('lab');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  if (!state) return null;

  const products = playerProducts(state);
  const selected = selectedId ? state.products[selectedId] : null;

  const openDesigner = (id: string) => {
    setSelectedId(id);
    setTab('designer');
  };

  return (
    <div>
      <SectionHeader title="✨ The Studio" />
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
        Your innovation campus: design products in 3D, research technology, build a brand, and take ideas to global launch.
      </p>
      <PillRow>
        <Pill label={`Lab (${products.length})`} active={tab === 'lab'} onClick={() => setTab('lab')} />
        <Pill label="Designer" active={tab === 'designer'} onClick={() => setTab('designer')} />
        <Pill label={`Parts (${Object.keys(state.customParts ?? {}).length})`} active={tab === 'parts'} onClick={() => setTab('parts')} />
        <Pill label={`R&D (${state.productTech.length}/${PRODUCT_TECH_TREE.length})`} active={tab === 'rnd'} onClick={() => setTab('rnd')} />
        <Pill label="Analytics" active={tab === 'analytics'} onClick={() => setTab('analytics')} />
        <Pill label="Storefront" active={tab === 'store'} onClick={() => setTab('store')} />
      </PillRow>

      {tab === 'lab' && <LabTab products={products} onOpen={openDesigner} onNew={() => setCreating(true)} />}
      {tab === 'designer' && (
        selected ? <DesignerTab product={selected} onSelect={setSelectedId} /> : (
          <Card className="p-6 mt-4 text-center text-slate-500 dark:text-slate-400">
            Pick a product from the Lab to open it on the design table{products.length === 0 ? ' — start by creating your first concept' : ''}.
          </Card>
        )
      )}
      {tab === 'parts' && <PartsTab />}
      {tab === 'rnd' && <RndTab />}
      {tab === 'analytics' && <AnalyticsTab products={products} />}
      {tab === 'store' && <StoreTab products={products} onOpen={openDesigner} />}

      {creating && <NewProductModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); openDesigner(id); }} />}
    </div>
  );
}

  // ------------------------------------------------------------------ Lab

function LabTab({ products, onOpen, onNew }: { products: Product[]; onOpen: (id: string) => void; onNew: () => void }) {
    const { state } = useGame();
    if (!state) return null;
    return (
      <div className="mt-4 space-y-3">
        <Button className="w-full" size="lg" onClick={onNew}>+ New Product Concept</Button>
        {products.length === 0 && (
          <Card className="p-6 text-center text-slate-500 dark:text-slate-400">
            The lab is quiet. Found a company on the Business screen, then bring your first product idea here.
          </Card>
        )}
        {products.map((p) => {
          const cat = PRODUCT_CATEGORY_BY_ID[p.category];
          const stage = STAGE_INFO[p.stage];
          const company = state.companies[p.companyId];
          return (
            <Card key={p.id} className="p-4" onClick={() => onOpen(p.id)}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${p.form.bodyColor}22`, border: `1.5px solid ${p.form.accentColor}` }}>
                  {cat.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">{p.name}{p.generation > 1 && <span className="text-xs text-slate-400"> · Gen {p.generation}</span>}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {cat.label} · {company?.name ?? '—'}{p.tagline ? ` · “${p.tagline}”` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                  {p.stage === 'launched' && (
                    <div className="text-xs font-semibold mt-1">{p.rating > 0 ? `${p.rating.toFixed(1)}★` : 'no ratings'} · {p.unitsSoldTotal.toLocaleString()} units</div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // ------------------------------------------------------------------ Designer

function DesignerTab({ product, onSelect }: { product: Product; onSelect: (id: string) => void }) {
    const { state, run } = useGame();
    const [prompt, setPrompt] = useState('');
    const [tagline, setTagline] = useState('');
    const [launching, setLaunching] = useState(false);
    if (!state) return null;
    const p = product;
    const company = state.companies[p.companyId];
    const q = Math.round(productQuality(state!, p));
    const unitCost = productUnitCost(state!, p);
    const sustain = Math.round(productSustainability(state!, p));
    const margin = p.price > 0 ? (p.price - unitCost) / p.price : 0;

    const form = (patch: Parameters<typeof updateProductForm>[2]) => run(updateProductForm, p.id, patch);

    return (
      <div className="mt-4 space-y-4">
        <Suspense fallback={SceneFallback}>
          <ProductStudioScene product={p} tall />
        </Suspense>
        <p className="text-[11px] text-slate-400 text-center -mt-2">Drag to rotate · scroll or pinch to zoom · the lab re-renders every design change live.</p>

        {/* Vital signs */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <Card className="p-2"><div className="text-[10px] text-slate-400">Quality</div><div className="font-extrabold">{q}</div></Card>
          <Card className="p-2"><div className="text-[10px] text-slate-400">Unit Cost</div><div className="font-extrabold">{money(unitCost)}</div></Card>
          <Card className="p-2"><div className="text-[10px] text-slate-400">Margin</div><div className={`font-extrabold ${margin >= 0.25 ? 'text-emerald-500' : margin >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>{Math.round(margin * 100)}%</div></Card>
          <Card className="p-2"><div className="text-[10px] text-slate-400">Sustainability</div><div className="font-extrabold">{sustain}</div></Card>
        </div>

        {/* AI concept assistant */}
        <Card className="p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
          <div className="text-[11px] font-bold text-brand-600 dark:text-brand-400 uppercase mb-2">🤖 Studio Design Assistant</div>
          <div className="flex gap-2">
            <TextInput value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder='e.g. "luxury futuristic coffee machine"' className="flex-1" />
            <Button size="sm" onClick={() => run(generateConcept, p.id, prompt)}>Generate</Button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">Drafts a full concept — form, palette, materials, name, tagline, pricing. Everything stays editable.</p>
        </Card>

        {/* Form sliders */}
        <Card className="p-4">
          <div className="font-bold mb-3">Form & Surface</div>
          {([['size', 'Scale', 0.6, 1.8, 0.05], ['slimness', 'Slimness', 0, 1, 0.05], ['curvature', 'Curvature', 0, 1, 0.05], ['accent', 'Accent details', 0, 1, 0.05]] as const).map(([key, label, min, max, step]) => (
            <div key={key} className="mb-2">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span>
                <span className="text-slate-400">{(p.form[key] as number).toFixed(2)}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={p.form[key] as number} onChange={(e) => form({ [key]: Number(e.target.value) })} className="w-full" />
            </div>
          ))}
          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Colorways</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {COLORWAYS.map((cw) => {
                const active = p.form.bodyColor === cw.body && p.form.accentColor === cw.accent;
                return (
                  <button
                    key={cw.id}
                    title={cw.label}
                    onClick={() => run(applyColorway, p.id, cw.id)}
                    className={`shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl border transition-all ${active ? 'border-brand-500 bg-brand-500/10 scale-105' : 'border-slate-200 dark:border-ink-700 hover:border-slate-300 dark:hover:border-ink-600'}`}
                  >
                    <span className="relative w-8 h-8 rounded-full overflow-hidden shadow-inner">
                      <span className="absolute inset-0" style={{ background: cw.body }} />
                      <span className="absolute inset-0" style={{ background: cw.accent, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
                    </span>
                    <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">{cw.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2">
              Body <input type="color" value={p.form.bodyColor} onChange={(e) => form({ bodyColor: e.target.value })} className="w-14 h-8 rounded cursor-pointer border-0 bg-transparent" />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2">
              Accent <input type="color" value={p.form.accentColor} onChange={(e) => form({ accentColor: e.target.value })} className="w-14 h-8 rounded cursor-pointer border-0 bg-transparent" />
            </label>
          </div>
          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Finish</div>
            <PillRow>
              {(['matte', 'gloss', 'metallic', 'brushed'] as const).map((fin) => (
                <Pill key={fin} label={fin} active={p.form.finish === fin} onClick={() => form({ finish: fin })} />
              ))}
            </PillRow>
          </div>
          <div className="mt-2">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Lab lighting</div>
            <PillRow>
              {(['studio', 'sunset', 'showroom', 'noir'] as StudioLighting[]).map((l) => (
                <Pill key={l} label={l} active={p.form.lighting === l} onClick={() => form({ lighting: l })} />
              ))}
            </PillRow>
          </div>
        </Card>

        {/* Materials */}
        <Card className="p-4">
          <div className="font-bold mb-1">Materials & Engineering</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">Materials drive cost, durability, luxury, weight and sustainability. 🔒 = needs R&D.</p>
          {([0, 1] as const).map((slot) => (
            <div key={slot} className="mb-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{slot === 0 ? 'Body material' : 'Accent material'}</div>
              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_MATERIALS.map((m) => {
                  const locked = !!m.unlockTech && !state.productTech.includes(m.unlockTech);
                  const active = p.materials[slot] === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        const next: [ProductMaterialId, ProductMaterialId] = [...p.materials] as [ProductMaterialId, ProductMaterialId];
                        next[slot] = m.id;
                        run(setProductMaterials, p.id, next[0], next[1]);
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${active ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-100 dark:bg-ink-800 border-transparent text-slate-600 dark:text-slate-300'} ${locked ? 'opacity-45' : ''}`}
                    >
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: m.color }} />
                      {m.label}{locked ? ' 🔒' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>

        <PartsStudio product={p} />
        <ComponentsCard product={p} />

        {/* Branding & packaging */}
        <Card className="p-4">
          <div className="font-bold mb-2">Brand & Packaging</div>
          <StatBar label="Brand power" value={p.brandPower} />
          <div className="flex gap-2 mt-3">
            <TextInput value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder={p.tagline || 'Write a tagline…'} className="flex-1" />
            <Button size="sm" variant="soft" onClick={() => { run(brandProduct, p.id, tagline); setTagline(''); }}>Brand ($15k)</Button>
          </div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 mb-1">Packaging</div>
          <PillRow>
            {PACKAGING_STYLES.map((pk) => (
              <Pill key={pk.id} label={`${pk.icon} ${pk.label}`} active={p.packaging === pk.id} onClick={() => run(setProductPackaging, p.id, pk.id)} />
            ))}
          </PillRow>
        </Card>

        {/* Manufacturing, price, marketing, channels */}
        <Card className="p-4">
          <div className="font-bold mb-2">Manufacturing & Commerce</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {MANUFACTURING_STRATEGIES.map((m) => {
              const locked = !!m.unlockTech && !state.productTech.includes(m.unlockTech);
              const active = p.manufacturing === m.id;
              return (
                <button
                  key={m.id}
                  title={`${m.blurb} Cost ×${m.costMult} · capacity ${m.capacity.toLocaleString()}/yr`}
                  onClick={() => run(setProductManufacturing, p.id, m.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${active ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-100 dark:bg-ink-800 border-transparent text-slate-600 dark:text-slate-300'} ${locked ? 'opacity-45' : ''}`}
                >
                  {m.icon} {m.label}{locked ? ' 🔒' : ''}
                </button>
              );
            })}
          </div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Retail price: {moneyFull(p.price)} <span className="text-slate-400">(category anchor {money(PRODUCT_CATEGORY_BY_ID[p.category].basePrice)})</span></label>
          <input
            type="range"
            min={Math.max(1, Math.round(PRODUCT_CATEGORY_BY_ID[p.category].basePrice * 0.3))}
            max={Math.round(PRODUCT_CATEGORY_BY_ID[p.category].basePrice * 4)}
            value={p.price}
            onChange={(e) => run(setProductPrice, p.id, Number(e.target.value))}
            className="w-full mt-1 mb-2"
          />
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Marketing budget: {moneyFull(p.marketingBudget)}/yr</label>
          <input type="range" min={0} max={2_000_000} step={25_000} value={p.marketingBudget} onChange={(e) => run(setProductMarketing, p.id, Number(e.target.value))} className="w-full mt-1 mb-2" />
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Sales channels</div>
          <PillRow>
            {(['storefront', 'online', 'retail', 'boutique'] as SalesChannel[]).map((ch) => (
              <Pill key={ch} label={ch} active={p.channels.includes(ch)} onClick={() => run(toggleProductChannel, p.id, ch)} />
            ))}
          </PillRow>
        </Card>

        <AudienceCard product={p} />
        <SupportCard product={p} />

        {/* Test report */}
        {p.testScores && (
          <Card className="p-4">
            <div className="font-bold mb-3">🧪 Lab Test Report {p.iterations > 0 && <span className="text-xs text-slate-400">(iteration {p.iterations})</span>}</div>
            <div className="space-y-2">
              {Object.entries(p.testScores).map(([k, v]) => (
                <StatBar key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} value={v} />
              ))}
            </div>
          </Card>
        )}

        {/* Pipeline */}
        <Card className="p-4">
          <div className="font-bold mb-1">Pipeline</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {['concept', 'prototype', 'testing', 'production', 'launched'].map((s, i) => (
              <span key={s} className={p.stage === s ? 'font-bold text-brand-500' : ''}>{i > 0 ? ' → ' : ''}{s}</span>
            ))}
            {' '}· Features: {p.features.length ? p.features.join(', ') : 'none yet'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {p.stage === 'concept' && <Button size="sm" onClick={() => run(buildPrototype, p.id)}>🖨️ Build Prototype</Button>}
            {(p.stage === 'prototype' || p.stage === 'testing') && <Button size="sm" onClick={() => run(runProductTests, p.id)}>🧪 Run Lab Tests ($15k)</Button>}
            {p.stage !== 'retired' && p.stage !== 'launched' && <Button size="sm" variant="soft" onClick={() => run(refineDesign, p.id)}>🔁 Refine Design</Button>}
            {!p.patented && p.stage !== 'retired' && <Button size="sm" variant="soft" onClick={() => run(fileProductPatent, p.id)}>📜 File Patent ($40k)</Button>}
            {p.stage === 'testing' && <Button size="sm" onClick={() => run(startProduction, p.id)}>🏭 Start Production</Button>}
            {p.stage === 'production' && <Button size="sm" onClick={() => setLaunching(true)}>🎬 Plan Launch Event</Button>}
            {p.stage === 'launched' && <Button size="sm" variant="soft" onClick={() => { const r = run(upgradeGeneration, p.id); const created = (r as { productId?: string }).productId; if (created) onSelect(created); }}>🔁 Next Generation</Button>}
            {p.stage === 'launched' && <Button size="sm" variant="danger" onClick={() => run(retireProduct, p.id)}>🌙 Retire</Button>}
          </div>
          {p.stage !== 'launched' && p.stage !== 'retired' && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Publish as</div>
              <PillRow>
                {(['draft', 'internal', 'portfolio', 'marketplace'] as const).map((ps) => (
                  <Pill key={ps} label={ps} active={p.publishState === ps} onClick={() => run(publishProduct, p.id, ps)} />
                ))}
              </PillRow>
            </div>
          )}
          <div className="text-[11px] text-slate-400 mt-2">Company treasury: {company ? money(company.cash) : '—'} · every step is funded from {company?.name ?? 'the company'}.</div>
        </Card>

        {launching && (
          <Modal open onClose={() => setLaunching(false)} title={`Launch ${p.name}`}>
            <div className="space-y-2">
              {LAUNCH_VENUES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { run(holdLaunchEvent, p.id, v.id); setLaunching(false); }}
                  className="w-full text-left p-3 rounded-2xl bg-slate-100 dark:bg-ink-800 hover:bg-slate-200 dark:hover:bg-ink-700"
                >
                  <div className="font-semibold">{v.icon} {v.label} <span className="text-xs text-slate-400">· {money(v.cost)} · hype ~{v.hype}</span></div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{v.blurb}</div>
                </button>
              ))}
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------ Parts studio (per-piece customization)

function PartsStudio({ product }: { product: Product }) {
  const { state, run } = useGame();
  const parts = PRODUCT_PARTS[product.category] ?? [];
  const [partId, setPartId] = useState(parts[0]?.id ?? '');
  if (!state || parts.length === 0) return null;
  const p = product;
  const overrides = p.partOverrides ?? {};
  const part = parts.find((x) => x.id === partId) ?? parts[0];
  const o = overrides[part.id];
  const effColor = (pt: typeof parts[number]) =>
    overrides[pt.id]?.color ?? (pt.base === 'body' ? p.form.bodyColor : p.form.accentColor);
  const isTouched = (pt: typeof parts[number]) => {
    const ov = overrides[pt.id];
    return !!(ov && (ov.color || ov.materialId || ov.finish));
  };
  const patch = (change: Partial<{ color: string | null; materialId: ProductMaterialId | null; finish: ProductFinish | null }>) =>
    run(setPartOverride, p.id, part.id, change);

  return (
    <Card className="p-4">
      <div className="font-bold mb-1">🧩 Part Customizer</div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
        Every piece of the model is yours: give any part its own color, material and finish. The viewport re-renders live.
      </p>
      {/* part chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {parts.map((pt) => (
          <button
            key={pt.id}
            onClick={() => setPartId(pt.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${part.id === pt.id ? 'bg-brand-500 text-white border-brand-500 shadow' : 'bg-slate-100 dark:bg-ink-800 border-transparent text-slate-600 dark:text-slate-300'}`}
          >
            <span className={`w-3 h-3 rounded-full border ${isTouched(pt) ? 'border-amber-400 border-2' : 'border-black/10 dark:border-white/20'}`} style={{ background: effColor(pt) }} />
            {pt.label}
          </button>
        ))}
      </div>
      {/* color swatches */}
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{part.label} color</div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {PART_SWATCHES.map((sw) => (
          <button
            key={sw}
            onClick={() => patch({ color: sw })}
            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${o?.color === sw ? 'border-brand-500 scale-110' : 'border-black/10 dark:border-white/15'}`}
            style={{ background: sw }}
          />
        ))}
        <label className="w-7 h-7 rounded-full border-2 border-dashed border-slate-300 dark:border-ink-600 flex items-center justify-center text-[10px] cursor-pointer overflow-hidden relative" title="Custom color">
          🎨
          <input type="color" value={o?.color ?? effColor(part)} onChange={(e) => patch({ color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
      </div>
      {/* material */}
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{part.label} material</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => patch({ materialId: null })}
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${!o?.materialId ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-100 dark:bg-ink-800 border-transparent text-slate-600 dark:text-slate-300'}`}
        >
          Inherit
        </button>
        {PRODUCT_MATERIALS.map((m) => {
          const locked = !!m.unlockTech && !state.productTech.includes(m.unlockTech);
          return (
            <button
              key={m.id}
              onClick={() => patch({ materialId: m.id })}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${o?.materialId === m.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-100 dark:bg-ink-800 border-transparent text-slate-600 dark:text-slate-300'} ${locked ? 'opacity-45' : ''}`}
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: m.color }} />
              {m.label}{locked ? ' 🔒' : ''}
            </button>
          );
        })}
      </div>
      {/* finish + reset */}
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{part.label} finish</div>
      <div className="flex items-center justify-between gap-2">
        <PillRow>
          <Pill label="inherit" active={!o?.finish} onClick={() => patch({ finish: null })} />
          {(['matte', 'gloss', 'metallic', 'brushed'] as ProductFinish[]).map((fin) => (
            <Pill key={fin} label={fin} active={o?.finish === fin} onClick={() => patch({ finish: fin })} />
          ))}
        </PillRow>
      </div>
      {isTouched(part) && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => run(clearPartOverride, p.id, part.id)}>↩︎ Reset {part.label.toLowerCase()} to base design</Button>
      )}
    </Card>
  );
}

  // ------------------------------------------------------------------ Component sourcing

function ComponentsCard({ product }: { product: Product }) {
  const { state, run } = useGame();
  if (!state) return null;
  const p = product;
  const slots = PRODUCT_COMPONENTS[p.category] ?? [];
  if (slots.length === 0) return null;
  const shortage = state.componentShortage;
  const myParts = Object.values(state.customParts ?? {}).filter((cp) => cp.companyId === p.companyId);
  return (
    <Card className="p-4">
      <div className="font-bold mb-1">🔩 Component Sourcing</div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
        Your bill of materials. Premium parts raise quality and cut defects; budget parts pad the margin — and the return rate.
        Engineer your own components in the Parts tab and install them here.
      </p>
      {shortage && slots.includes(shortage.componentId) && (
        <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2 mb-2">
          ⚠️ Global {COMPONENT_BY_ID[shortage.componentId].label.toLowerCase()} shortage — sourcing costs +25% this year.
        </div>
      )}
      <div className="space-y-2">
        {slots.map((slot) => {
          const def = COMPONENT_BY_ID[slot];
          const current = (p.components ?? {})[slot] ?? 'standard';
          const ownParts = myParts.filter((cp) => cp.componentId === slot);
          return (
            <div key={slot}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 min-w-0 truncate">{def.icon} {def.label}</div>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-ink-700 shrink-0">
                  {(['budget', 'standard', 'premium'] as ComponentTier[]).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => run(setComponentTier, p.id, slot, tier)}
                      title={`cost ×${COMPONENT_TIERS[tier].costMult} · quality ${COMPONENT_TIERS[tier].quality >= 0 ? '+' : ''}${COMPONENT_TIERS[tier].quality}`}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${current === tier ? (tier === 'premium' ? 'bg-violet-500 text-white' : tier === 'budget' ? 'bg-amber-500 text-white' : 'bg-brand-500 text-white') : 'bg-slate-100 dark:bg-ink-800 text-slate-500 dark:text-slate-400'}`}
                    >
                      {tier === 'budget' ? '$' : tier === 'standard' ? '$$' : '$$$'}
                    </button>
                  ))}
                </div>
              </div>
              {ownParts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {ownParts.map((cp) => (
                    <button
                      key={cp.id}
                      onClick={() => run(setComponentTier, p.id, slot, cp.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${current === cp.id ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-100 dark:bg-ink-800 border-transparent text-slate-600 dark:text-slate-300'}`}
                    >
                      ⚙️ {cp.name} v{cp.version} · grade {cp.grade}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

  // ------------------------------------------------------------------ Engineered parts

function PartsTab() {
  const { state, run } = useGame();
  const [engineering, setEngineering] = useState(false);
  if (!state) return null;
  const parts = Object.values(state.customParts ?? {});
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
        Design your own components from scratch — your own battery, your own chip — install them in place of a sourcing
        tier, then list them on the global component market for other manufacturers to buy.
      </p>
      <Button className="w-full" size="lg" onClick={() => setEngineering(true)}>+ Engineer a New Part</Button>
      {parts.length === 0 && (
        <Card className="p-6 text-center text-slate-500 dark:text-slate-400">
          No parts engineered yet — build your first component and give it a name (Bat62, Core9, whatever you like).
        </Card>
      )}
      {parts.map((cp) => {
        const def = COMPONENT_BY_ID[cp.componentId];
        const company = state.companies[cp.companyId];
        return (
          <Card key={cp.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="font-bold truncate">{def.icon} {cp.name} <span className="text-xs text-slate-400 font-medium">v{cp.version}</span></div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{def.label} · {company?.name ?? '—'} · engineered {cp.yearDesigned}</div>
              </div>
              <Badge tone={cp.grade >= 80 ? 'good' : cp.grade >= 50 ? 'brand' : 'warn'}>Grade {cp.grade}</Badge>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center mb-3">
              <div className="rounded-xl bg-slate-100 dark:bg-ink-800 p-1.5"><div className="text-[9px] text-slate-400">Quality</div><div className="text-xs font-bold">{cp.quality >= 0 ? '+' : ''}{cp.quality}</div></div>
              <div className="rounded-xl bg-slate-100 dark:bg-ink-800 p-1.5"><div className="text-[9px] text-slate-400">Defects</div><div className="text-xs font-bold">{(cp.defectMod * 100).toFixed(2)}%</div></div>
              <div className="rounded-xl bg-slate-100 dark:bg-ink-800 p-1.5"><div className="text-[9px] text-slate-400">Cost ×</div><div className="text-xs font-bold">{cp.costMult.toFixed(2)}</div></div>
              <div className="rounded-xl bg-slate-100 dark:bg-ink-800 p-1.5"><div className="text-[9px] text-slate-400">Luxury</div><div className="text-xs font-bold">{cp.luxury >= 0 ? '+' : ''}{cp.luxury}</div></div>
            </div>
            {cp.forSale && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                On the market: {cp.unitsSoldTotal.toLocaleString()} units sold · {money(cp.revenueTotal)} lifetime revenue
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="soft" onClick={() => run(revisePart, cp.id, 50_000)}>🔁 Revise ($50k)</Button>
              <Button size="sm" variant={cp.forSale ? 'primary' : 'ghost'} onClick={() => run(setPartForSale, cp.id, !cp.forSale)}>
                {cp.forSale ? '🏷️ Listed for sale' : 'List on market'}
              </Button>
            </div>
          </Card>
        );
      })}
      {engineering && <EngineerPartModal onClose={() => setEngineering(false)} />}
    </div>
  );
}

function EngineerPartModal({ onClose }: { onClose: () => void }) {
  const { state, run } = useGame();
  const [companyId, setCompanyId] = useState('');
  const [componentId, setComponentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [investment, setInvestment] = useState(100_000);
  if (!state) return null;
  const companies = state.player.companies.map((id) => state.companies[id]).filter((c) => c && c.status === 'active');
  const chosenCompany = companyId || companies[0]?.id || '';
  return (
    <Modal open onClose={onClose} title="Engineer a New Component">
      {companies.length === 0 ? (
        <p className="text-center text-slate-500 dark:text-slate-400 py-6">You need an active company first — found one on the Business screen.</p>
      ) : (
        <>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Company</div>
          <select value={chosenCompany} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-2xl bg-slate-100 dark:bg-ink-800 border border-transparent px-4 py-3 mb-3 text-slate-900 dark:text-white">
            {companies.map((c) => <option key={c!.id} value={c!.id}>{c!.name} — {money(c!.cash)} cash</option>)}
          </select>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Component type</div>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto mb-3">
            {COMPONENT_DEFS.map((c) => (
              <button
                key={c.id}
                onClick={() => setComponentId(c.id)}
                className={`p-2 rounded-xl text-left border flex items-center gap-2 ${componentId === c.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-100 dark:bg-ink-800 border-transparent'}`}
              >
                <span className="text-lg">{c.icon}</span>
                <span className="text-[11px] font-semibold">{c.label}</span>
              </button>
            ))}
          </div>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={componentId ? `e.g. "${PART_NAME_PREFIX[componentId] ?? 'Part'}62"` : 'Part name'} maxLength={20} className="mb-3" />
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Engineering investment: {moneyFull(investment)} <span className="text-slate-400">(higher = better odds of a high grade)</span></label>
          <input type="range" min={50_000} max={2_000_000} step={25_000} value={investment} onChange={(e) => setInvestment(Number(e.target.value))} className="w-full mt-1 mb-3" />
          <Button
            className="w-full"
            size="lg"
            disabled={!componentId}
            onClick={() => {
              if (!componentId) return;
              const r = run(engineerPart, chosenCompany, componentId, name, investment);
              if (r.ok) onClose();
            }}
          >
            Start Engineering
          </Button>
        </>
      )}
    </Modal>
  );
}

  // ------------------------------------------------------------------ Audience & market research

function AudienceCard({ product }: { product: Product }) {
  const { state, run } = useGame();
  if (!state) return null;
  const p = product;
  const insights = p.segmentInsights ?? {};
  return (
    <Card className="p-4">
      <div className="font-bold mb-1">🎯 Audience & Market Research</div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
        Run focus groups to see how each segment rates this product, then aim your marketing at the one that loves it.
      </p>
      <div className="space-y-2.5">
        {CUSTOMER_SEGMENTS.map((seg) => {
          const revealed = insights[seg.id];
          const live = Math.round(segmentFit(state, p, seg.id));
          const targeted = p.targetSegment === seg.id;
          return (
            <div key={seg.id} className={`rounded-xl p-2.5 border ${targeted ? 'border-brand-500 bg-brand-500/5' : 'border-slate-100 dark:border-ink-800'}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-xs font-bold">{seg.icon} {seg.label} <span className="text-slate-400 font-medium">· {Math.round(seg.share * 100)}% of market</span></div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => run(runFocusGroup, p.id, seg.id)}>🗣️ $8k</Button>
                  <Button size="sm" variant={targeted ? 'primary' : 'soft'} onClick={() => run(setTargetSegment, p.id, targeted ? null : seg.id)}>
                    {targeted ? 'Targeted ✓' : 'Target'}
                  </Button>
                </div>
              </div>
              {revealed !== undefined ? (
                <StatBar label={`Fit ${revealed !== live ? `(latest: ${live})` : ''}`} value={live} />
              ) : (
                <div className="text-[11px] text-slate-400 italic">{seg.blurb}</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

  // ------------------------------------------------------------------ Warranty, trust & recalls

function SupportCard({ product }: { product: Product }) {
  const { state, run } = useGame();
  if (!state) return null;
  const p = product;
  const trust = Math.round(p.trust ?? 70);
  const defect = p.activeDefect;
  return (
    <Card className="p-4">
      <div className="font-bold mb-1">🛡️ Warranty & Consumer Trust</div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
        Warranty costs ~3.5%/yr of unit cost but cuts returns and builds trust — and trust scales demand.
      </p>
      <StatBar label={`Consumer trust ${trust >= 90 ? '· beloved' : trust >= 70 ? '· solid' : trust >= 45 ? '· shaky' : '· in crisis'}`} value={trust} />
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 mb-1">Warranty coverage</div>
      <PillRow>
        {[0, 1, 2, 3].map((y) => (
          <Pill key={y} label={y === 0 ? 'None' : `${y} yr${y > 1 ? 's' : ''}`} active={(p.warrantyYears ?? 1) === y} onClick={() => run(setWarranty, p.id, y)} />
        ))}
      </PillRow>
      {(p.recalls ?? 0) > 0 && (
        <div className="text-[11px] text-slate-400 mt-2">Recall history: {p.recalls} voluntary recall{p.recalls! > 1 ? 's' : ''} — handled openly.</div>
      )}
      {defect && (
        <div className="mt-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-500/10 p-3">
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
            🚨 Field defect: {defect.name} (severity {defect.severity}/3)
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            Discovered in {defect.year}. Every year you ignore it, trust and ratings bleed — and lawsuits loom.
          </p>
          <Button size="sm" variant="danger" onClick={() => run(issueRecall, p.id)}>🛟 Issue Voluntary Recall</Button>
        </div>
      )}
    </Card>
  );
}

  // ------------------------------------------------------------------ R&D

function RndTab() {
    const { state, run } = useGame();
    const tracks = [...new Set(PRODUCT_TECH_TREE.map((t) => t.track))];
    if (!state) return null;
    return (
      <div className="mt-4 space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
          Studio R&D is funded from your personal fortune and unlocks materials, manufacturing and product features across every company you own.
        </p>
        {tracks.map((track) => (
          <div key={track}>
            <div className="font-bold mb-2 text-sm">{track}</div>
            <div className="space-y-2">
              {PRODUCT_TECH_TREE.filter((t) => t.track === track).map((t) => {
                const done = state.productTech.includes(t.id);
                const gated = !!t.requires && !state.productTech.includes(t.requires);
                return (
                  <Card key={t.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{t.icon} {t.label} {done && <Badge tone="good">Researched</Badge>}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.blurb}{t.requires && !done ? ` Requires ${PRODUCT_TECH_BY_ID[t.requires].label}.` : ''}
                      </div>
                    </div>
                    {!done && (
                      <Button size="sm" variant="soft" disabled={gated} onClick={() => run(researchProductTech, t.id)} className="shrink-0">
                        {gated ? '🔒' : money(t.cost)}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ------------------------------------------------------------------ Analytics

function AnalyticsTab({ products }: { products: Product[] }) {
    const { state } = useGame();
    const launchedOrRetired = products.filter((p) => p.salesHistory.length > 0);
    const totals = useMemo(() => launchedOrRetired.reduce(
      (acc, p) => ({ units: acc.units + p.unitsSoldTotal, revenue: acc.revenue + p.revenueTotal, profit: acc.profit + p.profitTotal }),
      { units: 0, revenue: 0, profit: 0 },
    ), [launchedOrRetired]);
    if (!state) return null;

    if (launchedOrRetired.length === 0) {
      return <Card className="p-6 mt-4 text-center text-slate-500 dark:text-slate-400">No sales data yet — launch a product and advance a year.</Card>;
    }
    return (
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-3"><div className="text-[10px] text-slate-400">Lifetime Units</div><div className="font-extrabold">{totals.units.toLocaleString()}</div></Card>
          <Card className="p-3"><div className="text-[10px] text-slate-400">Revenue</div><div className="font-extrabold text-emerald-500">{money(totals.revenue)}</div></Card>
          <Card className="p-3"><div className="text-[10px] text-slate-400">Profit</div><div className={`font-extrabold ${totals.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{money(totals.profit)}</div></Card>
        </div>
        {launchedOrRetired.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-bold">{PRODUCT_CATEGORY_BY_ID[p.category].icon} {p.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {p.rating > 0 ? `${p.rating.toFixed(1)}★` : 'unrated'} · returns {(p.returnRate * 100).toFixed(1)}% · sustainability {Math.round(productSustainability(state!, p))} · {STAGE_INFO[p.stage].label.toLowerCase()}
                </div>
              </div>
              <Badge tone={p.profitTotal >= 0 ? 'good' : 'bad'}>{money(p.profitTotal)} lifetime</Badge>
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Units / year</div>
            <div className="h-16 mb-2">
              <LineChart data={p.salesHistory.map((h) => h.units)} height={64} color="#8b5cf6" />
            </div>
            {p.reviews.length > 0 && (
              <div className="border-t border-slate-100 dark:border-ink-800 pt-2 space-y-1">
                {p.reviews.slice(-2).map((r, i) => (
                  <div key={i} className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-amber-500">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span> “{r.text}”
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    );
  }

  // ------------------------------------------------------------------ Storefront

function StoreTab({ products, onOpen }: { products: Product[]; onOpen: (id: string) => void }) {
    const { state, run } = useGame();
    const [name, setName] = useState('');
    const publicProducts = products.filter((p) => p.publishState === 'public' || p.publishState === 'marketplace');
    if (!state) return null;
    const sf = state.storefront;
    const themeBg: Record<string, string> = {
      aurora: 'bg-gradient-to-br from-teal-500/15 to-violet-500/15',
      noir: 'bg-gradient-to-br from-slate-800/40 to-slate-900/40',
      porcelain: 'bg-gradient-to-br from-slate-100/60 to-slate-200/40 dark:from-slate-400/10 dark:to-slate-500/10',
      terra: 'bg-gradient-to-br from-amber-500/15 to-rose-500/15',
    };
    return (
      <div className="mt-4 space-y-3">
        <Card className={`p-5 ${themeBg[sf.theme]}`}>
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Your storefront</div>
          <div className="text-2xl font-black mb-1">{sf.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">{publicProducts.length} product(s) live · theme: {sf.theme}</div>
          <div className="flex gap-2 mb-3">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Rename storefront…" className="flex-1" />
            <Button size="sm" variant="soft" onClick={() => { if (name.trim()) { run(setStorefront, { name: name.trim().slice(0, 40) }); setName(''); } }}>Save</Button>
          </div>
          <PillRow>
            {THEMES.map((t) => (
              <Pill key={t.id} label={t.label} active={sf.theme === t.id} onClick={() => run(setStorefront, { theme: t.id })} />
            ))}
          </PillRow>
        </Card>
        {publicProducts.length === 0 && (
          <Card className="p-6 text-center text-slate-500 dark:text-slate-400">Nothing on the shelves yet — launch a product to stock your storefront.</Card>
        )}
        {publicProducts.map((p) => (
          <Card key={p.id} className="p-4 flex items-center gap-3" onClick={() => onOpen(p.id)}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${p.form.bodyColor}22`, border: `1.5px solid ${p.form.accentColor}` }}>
              {PRODUCT_CATEGORY_BY_ID[p.category].icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate">{p.name} {sf.featuredProductId === p.id && <Badge tone="brand">Featured</Badge>}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.tagline || PRODUCT_CATEGORY_BY_ID[p.category].label} · {money(p.price)}</div>
            </div>
            <Button size="sm" variant="ghost" className="shrink-0" onClick={() => run(setStorefront, { featuredProductId: p.id })}>Feature</Button>
          </Card>
        ))}
      </div>
    );
  }

  // ------------------------------------------------------------------ New product wizard

function NewProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
    const { state, run } = useGame();
    const [companyId, setCompanyId] = useState<string>('');
    const [category, setCategory] = useState<ProductCategory | null>(null);
    const [name, setName] = useState('');
    if (!state) return null;
    const companies = state.player.companies.map((id) => state.companies[id]).filter((c) => c && c.status === 'active');
    const chosenCompany = companyId || companies[0]?.id || '';
    return (
      <Modal open onClose={onClose} title="New Product Concept">
        {companies.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 py-6">You need an active company first — found one on the Business screen.</p>
        ) : (
          <>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Company</div>
            <select value={chosenCompany} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-2xl bg-slate-100 dark:bg-ink-800 border border-transparent px-4 py-3 mb-3 text-slate-900 dark:text-white">
              {companies.map((c) => <option key={c!.id} value={c!.id}>{c!.name} — {money(c!.cash)} cash</option>)}
            </select>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Category</div>
            <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto mb-3">
              {PRODUCT_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`p-2 rounded-xl text-center border ${category === c.id ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-100 dark:bg-ink-800 border-transparent'}`}
                >
                  <div className="text-xl">{c.icon}</div>
                  <div className="text-[9px] font-semibold leading-tight mt-0.5">{c.label}</div>
                </button>
              ))}
            </div>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name (or let the assistant name it)" maxLength={40} className="mb-3" />
            <Button
              className="w-full"
              size="lg"
              disabled={!category}
              onClick={() => {
                if (!category) return;
                const r = run(createProduct, chosenCompany, category, name);
                const created = (r as { productId?: string }).productId;
                if (r.ok && created) onCreated(created);
              }}
            >
              Open in the Studio ($10k concept budget)
            </Button>
          </>
        )}
      </Modal>
    );
  }
