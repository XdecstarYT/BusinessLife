/**
 * The Studio: product design & commerce simulation. Players take products from
 * concept → prototype → testing → production → launch, then compete in a yearly
 * market where quality, price positioning, brand, hype, channels, manufacturing
 * and sustainability all shape demand. Product profits flow into the owning
 * company, so a hit product lifts the whole empire.
 */
import type {
  ComponentTier, CustomerSegment, CustomPart, GameState, LaunchVenue, ManufacturingStrategy,
  PackagingStyle, PartOverride, Product, ProductCategory, ProductForm, ProductMaterialId,
  PublishState, SalesChannel,
} from './types';
import { clamp, clamp100 } from './types';
import { RNG } from './rng';
import { log } from './engine';
import {
  COLORWAYS, COMPONENT_BY_ID, COMPONENT_MARKET, COMPONENT_TIERS, CONCEPT_ADJECTIVES,
  CONCEPT_PALETTES, CONCEPT_SUFFIXES, CONCEPT_TAGLINES, CUSTOMER_SEGMENTS, DEFECT_NAMES,
  LAUNCH_VENUES, MANUFACTURING_BY_ID, PACKAGING_STYLES, PART_NAME_PREFIX,
  PRODUCT_CATEGORY_BY_ID, PRODUCT_COMPONENTS, PRODUCT_MATERIAL_BY_ID, PRODUCT_PARTS,
  PRODUCT_TECH_BY_ID, PRODUCT_TECH_TREE, SEGMENT_BY_ID,
} from '../data/productData';

export interface StudioResult {
  ok: boolean;
  message: string;
  productId?: string;
}

function withRng(state: GameState): RNG {
  const rng = new RNG(state.seed);
  rng.state = state.rngState;
  return rng;
}
function commit(state: GameState, rng: RNG): void {
  state.rngState = rng.state;
}

function nextProductId(state: GameState): string {
  return `prod_${state.year}_${Object.keys(state.products).length + 1}`;
}

export function playerProducts(state: GameState): Product[] {
  return Object.values(state.products).filter((p) => state.companies[p.companyId]?.playerOwned);
}

function defaultComponents(category: ProductCategory): Record<string, ComponentTier> {
  return Object.fromEntries((PRODUCT_COMPONENTS[category] ?? []).map((c) => [c, 'standard' as ComponentTier]));
}

/** Backfills fields added after a save was created, so older products stay valid. */
export function normalizeProduct(p: Product): Product {
  if (!p.partOverrides) p.partOverrides = {};
  if (!p.components) p.components = defaultComponents(p.category);
  if (p.targetSegment === undefined) p.targetSegment = null;
  if (!p.segmentInsights) p.segmentInsights = {};
  if (p.warrantyYears === undefined) p.warrantyYears = 1;
  if (p.trust === undefined) p.trust = 70;
  if (p.activeDefect === undefined) p.activeDefect = null;
  if (p.recalls === undefined) p.recalls = 0;
  return p;
}

// --------------------------------------------------------------------------- creation

export function createProduct(state: GameState, companyId: string, category: ProductCategory, name: string): StudioResult {
  const company = state.companies[companyId];
  if (!company || !company.playerOwned || company.status !== 'active') return { ok: false, message: 'Pick one of your active companies.' };
  const cat = PRODUCT_CATEGORY_BY_ID[category];
  if (!cat) return { ok: false, message: 'Unknown category.' };
  const conceptCost = 10_000;
  if (company.cash < conceptCost) return { ok: false, message: `Needs $${conceptCost.toLocaleString()} in company cash for concept work.` };
  company.cash -= conceptCost;
  const id = nextProductId(state);
  const product: Product = {
    id,
    companyId,
    name: name.trim() || `${cat.label} Concept`,
    tagline: '',
    category,
    generation: 1,
    predecessorId: null,
    stage: 'concept',
    publishState: 'draft',
    materials: ['plastic', 'aluminum'],
    form: { size: 1, slimness: 0.5, curvature: 0.5, accent: 0.5, bodyColor: '#1c1e26', accentColor: '#e8b84a', finish: 'matte', lighting: 'studio' },
    partOverrides: {},
    components: defaultComponents(category),
    targetSegment: null,
    segmentInsights: {},
    warrantyYears: 1,
    trust: 70,
    activeDefect: null,
    recalls: 0,
    features: [],
    packaging: 'minimal',
    manufacturing: 'regional',
    price: cat.basePrice,
    patented: false,
    testScores: null,
    iterations: 0,
    designQuality: 30,
    hype: 0,
    brandPower: clamp100(company.brand * 0.5),
    yearDesigned: state.year,
    yearLaunched: null,
    unitsSoldTotal: 0,
    revenueTotal: 0,
    profitTotal: 0,
    rating: 0,
    reviews: [],
    returnRate: 0,
    marketingBudget: 0,
    channels: ['storefront', 'online'],
    salesHistory: [],
  };
  state.products[id] = product;
  if (!state.achievements.includes('first_product')) state.achievements.push('first_product');
  log(state, `💡 ${company.name} opened a new concept in the Studio: ${product.name}.`, 'business');
  return { ok: true, message: `${product.name} created — over to the design table.`, productId: id };
}

/** The in-game AI design assistant: deterministically turns a text prompt into a full
 * editable concept (form, palette, materials, name, tagline, price positioning). */
export function generateConcept(state: GameState, productId: string, prompt: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.stage === 'launched' || p.stage === 'retired') return { ok: false, message: 'This product is past the concept stage.' };
  // Seed a private RNG from the prompt so the same prompt always yields the same concept.
  let hash = 2166136261;
  const text = (prompt || p.name).toLowerCase();
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const rng = new RNG(hash >>> 0);
  const cat = PRODUCT_CATEGORY_BY_ID[p.category];

  const wantsLuxury = /lux|premium|gold|elegant|exclusive/.test(text);
  const wantsEco = /eco|sustain|green|recycl|planet/.test(text);
  const wantsMinimal = /minimal|clean|simple|pure/.test(text);
  const wantsFuturistic = /futur|sci|next|2050|space/.test(text);

  const palette = rng.pick(CONCEPT_PALETTES);
  p.form = {
    size: rng.range(0.8, 1.3),
    slimness: wantsMinimal || wantsFuturistic ? rng.range(0.6, 0.95) : rng.range(0.3, 0.7),
    curvature: wantsFuturistic ? rng.range(0.6, 1) : rng.range(0.2, 0.8),
    accent: wantsMinimal ? rng.range(0.1, 0.35) : rng.range(0.4, 0.9),
    bodyColor: palette.body,
    accentColor: wantsLuxury ? '#d8b24a' : palette.accent,
    finish: wantsLuxury ? 'gloss' : wantsFuturistic ? 'metallic' : wantsMinimal ? 'matte' : rng.pick(['matte', 'gloss', 'brushed'] as const),
    lighting: wantsLuxury ? 'showroom' : wantsFuturistic ? 'noir' : 'studio',
  };
  const unlocked = (m: ProductMaterialId) => {
    const def = PRODUCT_MATERIAL_BY_ID[m];
    return !def.unlockTech || state.productTech.includes(def.unlockTech);
  };
  const pickMat = (prefs: ProductMaterialId[], fallback: ProductMaterialId): ProductMaterialId =>
    prefs.find(unlocked) ?? fallback;
  if (wantsEco) p.materials = [pickMat(['eco_composite', 'recycled', 'wood'], 'wood'), pickMat(['recycled', 'fabric'], 'fabric')];
  else if (wantsLuxury) p.materials = [pickMat(['gold', 'marble', 'titanium', 'leather'], 'leather'), pickMat(['gold', 'chrome'], 'chrome')];
  else if (wantsFuturistic) p.materials = [pickMat(['carbon_fiber', 'titanium', 'aluminum'], 'aluminum'), pickMat(['chrome', 'glass'], 'glass')];
  else p.materials = ['aluminum', 'glass'];

  p.name = `${rng.pick(CONCEPT_ADJECTIVES)} ${rng.pick(CONCEPT_SUFFIXES)}`;
  p.tagline = rng.pick(CONCEPT_TAGLINES);
  const luxMult = wantsLuxury ? 1.6 : wantsEco ? 1.1 : 1;
  p.price = Math.round(cat.basePrice * luxMult * rng.range(0.9, 1.2));
  p.designQuality = clamp100(p.designQuality + 10);
  log(state, `🤖 The Studio assistant drafted "${p.name}" from your brief.`, 'business');
  return { ok: true, message: `Concept generated: ${p.name} — "${p.tagline}". Everything stays editable.` };
}

// --------------------------------------------------------------------------- design edits

export function updateProductForm(state: GameState, productId: string, patch: Partial<ProductForm>): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.stage === 'retired') return { ok: false, message: 'This product is retired.' };
  p.form = { ...p.form, ...patch };
  return { ok: true, message: 'Design updated.' };
}

export function setProductMaterials(state: GameState, productId: string, primary: ProductMaterialId, accent: ProductMaterialId): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  for (const m of [primary, accent]) {
    const def = PRODUCT_MATERIAL_BY_ID[m];
    if (!def) return { ok: false, message: 'Unknown material.' };
    if (def.unlockTech && !state.productTech.includes(def.unlockTech)) {
      return { ok: false, message: `${def.label} requires ${PRODUCT_TECH_BY_ID[def.unlockTech].label} research.` };
    }
  }
  p.materials = [primary, accent];
  return { ok: true, message: 'Materials updated.' };
}

export function setProductPackaging(state: GameState, productId: string, packaging: PackagingStyle): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  p.packaging = packaging;
  return { ok: true, message: 'Packaging updated.' };
}

export function setProductPrice(state: GameState, productId: string, price: number): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (price <= 0) return { ok: false, message: 'Invalid price.' };
  p.price = Math.round(price);
  return { ok: true, message: `Price set to $${p.price.toLocaleString()}.` };
}

export function setProductMarketing(state: GameState, productId: string, budget: number): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  p.marketingBudget = Math.max(0, Math.round(budget));
  return { ok: true, message: `Marketing budget: $${p.marketingBudget.toLocaleString()}/yr.` };
}

export function toggleProductChannel(state: GameState, productId: string, channel: SalesChannel): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.channels.includes(channel)) {
    if (p.channels.length === 1) return { ok: false, message: 'Keep at least one sales channel.' };
    p.channels = p.channels.filter((c) => c !== channel);
  } else {
    p.channels.push(channel);
  }
  return { ok: true, message: 'Channels updated.' };
}

export function setProductManufacturing(state: GameState, productId: string, strategy: ManufacturingStrategy): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  const def = MANUFACTURING_BY_ID[strategy];
  if (!def) return { ok: false, message: 'Unknown strategy.' };
  if (def.unlockTech && !state.productTech.includes(def.unlockTech)) {
    return { ok: false, message: `${def.label} requires ${PRODUCT_TECH_BY_ID[def.unlockTech].label} research.` };
  }
  p.manufacturing = strategy;
  return { ok: true, message: `Manufacturing: ${def.label}.` };
}

export function brandProduct(state: GameState, productId: string, tagline: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  const company = state.companies[p.companyId];
  const cost = 15_000;
  if (!company || company.cash < cost) return { ok: false, message: `Needs $${cost.toLocaleString()} in company cash.` };
  company.cash -= cost;
  if (tagline.trim()) p.tagline = tagline.trim().slice(0, 80);
  p.brandPower = clamp100(p.brandPower + 8 + company.brand * 0.05);
  log(state, `🎨 Branding session for ${p.name}: "${p.tagline || '—'}".`, 'business');
  return { ok: true, message: 'Brand identity sharpened.' };
}

// --------------------------------------------------------------------------- per-part customization

export function setPartOverride(state: GameState, productId: string, partId: string, patch: Partial<PartOverride>): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  normalizeProduct(p);
  const parts = PRODUCT_PARTS[p.category] ?? [];
  if (!parts.some((x) => x.id === partId)) return { ok: false, message: 'That part does not exist on this product.' };
  if (patch.materialId) {
    const def = PRODUCT_MATERIAL_BY_ID[patch.materialId];
    if (!def) return { ok: false, message: 'Unknown material.' };
    if (def.unlockTech && !state.productTech.includes(def.unlockTech)) {
      return { ok: false, message: `${def.label} requires ${PRODUCT_TECH_BY_ID[def.unlockTech].label} research.` };
    }
  }
  const current = p.partOverrides[partId] ?? { color: null, materialId: null, finish: null };
  p.partOverrides[partId] = { ...current, ...patch };
  const customized = Object.values(p.partOverrides).filter((o) => o.color || o.materialId || o.finish).length;
  if (customized >= 4 && !state.achievements.includes('master_customizer')) state.achievements.push('master_customizer');
  return { ok: true, message: 'Part updated.' };
}

export function clearPartOverride(state: GameState, productId: string, partId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  normalizeProduct(p);
  delete p.partOverrides[partId];
  return { ok: true, message: 'Part reset to the base design.' };
}

/** Applies a curated colorway and clears per-part color overrides so it reads cleanly. */
export function applyColorway(state: GameState, productId: string, colorwayId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  normalizeProduct(p);
  const cw = COLORWAYS.find((c) => c.id === colorwayId);
  if (!cw) return { ok: false, message: 'Unknown colorway.' };
  p.form.bodyColor = cw.body;
  p.form.accentColor = cw.accent;
  for (const partId of Object.keys(p.partOverrides)) {
    p.partOverrides[partId] = { ...p.partOverrides[partId], color: null };
  }
  return { ok: true, message: `${cw.label} colorway applied.` };
}

// --------------------------------------------------------------------------- component supply chain

/** Sets a component slot to a sourcing tier ('budget'|'standard'|'premium') or an engineered CustomPart id. */
export function setComponentTier(state: GameState, productId: string, componentId: string, tier: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  normalizeProduct(p);
  if (!(PRODUCT_COMPONENTS[p.category] ?? []).includes(componentId)) {
    return { ok: false, message: 'This product does not use that component.' };
  }
  const asTier = COMPONENT_TIERS[tier as ComponentTier];
  if (!asTier) {
    const cp = (state.customParts ?? {})[tier];
    if (!cp) return { ok: false, message: 'Unknown component tier or part.' };
    if (cp.componentId !== componentId) return { ok: false, message: `${cp.name} is a ${COMPONENT_BY_ID[cp.componentId].label.toLowerCase()} — it does not fit this slot.` };
    p.components[componentId] = cp.id;
    return { ok: true, message: `${COMPONENT_BY_ID[componentId].label}: your own ${cp.name} installed.` };
  }
  p.components[componentId] = tier;
  const def = COMPONENT_BY_ID[componentId];
  return { ok: true, message: `${def.label}: ${asTier.label} tier.` };
}

/** Average sourcing effects across the product's bill of materials (tiers and engineered parts). */
function componentProfile(state: GameState, p: Product): { costMult: number; quality: number; defectMod: number; luxury: number; premiumOnly: boolean } {
  const slots = PRODUCT_COMPONENTS[p.category] ?? [];
  if (slots.length === 0) return { costMult: 1, quality: 0, defectMod: 0, luxury: 0, premiumOnly: false };
  let cost = 0, quality = 0, defect = 0, lux = 0, premium = 0;
  for (const slot of slots) {
    const v = (p.components ?? {})[slot] ?? 'standard';
    const t = COMPONENT_TIERS[v as ComponentTier];
    if (t) {
      cost += t.costMult;
      quality += t.quality;
      defect += t.defectMod;
      lux += t.luxury;
      if (t === COMPONENT_TIERS.premium) premium++;
    } else {
      const cp = (state.customParts ?? {})[v];
      if (cp) {
        cost += cp.costMult;
        quality += cp.quality;
        defect += cp.defectMod;
        lux += cp.luxury;
        if (cp.quality >= COMPONENT_TIERS.premium.quality) premium++;
      } else {
        cost += 1; // dangling reference — treat as standard
      }
    }
  }
  const n = slots.length;
  return { costMult: cost / n, quality: quality / n, defectMod: defect / n, luxury: lux / n, premiumOnly: premium === n };
}

// --------------------------------------------------------------------------- engineered parts

function partStatsFromGrade(grade: number): Pick<CustomPart, 'quality' | 'defectMod' | 'costMult' | 'luxury'> {
  return {
    quality: Math.round((grade - 50) * 0.3 * 10) / 10,
    defectMod: -Math.round((grade - 50) * 0.0004 * 10000) / 10000,
    costMult: Math.round((0.9 + grade * 0.006) * 100) / 100,
    luxury: Math.round((grade - 50) * 0.2),
  };
}

function partTechBonus(state: GameState, componentId: string): number {
  let bonus = state.productTech.includes('precision_tooling') ? 4 : 0;
  if (componentId === 'battery' && state.productTech.includes('dense_batteries')) bonus += 10;
  if (componentId === 'chip' && state.productTech.includes('fast_chips')) bonus += 10;
  if (componentId === 'chip' && state.productTech.includes('ai_integration')) bonus += 5;
  if (componentId === 'display_panel' && state.productTech.includes('haptic_glass')) bonus += 8;
  if (componentId === 'frame_parts' && state.productTech.includes('adv_alloys')) bonus += 8;
  if (componentId === 'materials_stock' && state.productTech.includes('green_materials')) bonus += 6;
  return bonus;
}

/** Designs a brand-new component from scratch — your own silicon, cells, optics… */
export function engineerPart(state: GameState, companyId: string, componentId: string, name: string, investment: number): StudioResult {
  if (!state.customParts) state.customParts = {};
  const company = state.companies[companyId];
  if (!company || !company.playerOwned || company.status !== 'active') return { ok: false, message: 'Pick one of your active companies.' };
  if (!COMPONENT_BY_ID[componentId]) return { ok: false, message: 'Unknown component type.' };
  const invest = Math.round(investment);
  if (invest < 50_000) return { ok: false, message: 'Component engineering starts at $50,000.' };
  if (company.cash < invest) return { ok: false, message: `${company.name} cannot cover a $${invest.toLocaleString()} engineering program.` };
  const rng = withRng(state);
  company.cash -= invest;
  const grade = clamp100(20 + Math.sqrt(invest / 1_000) * 1.6 + partTechBonus(state, componentId) + rng.range(-6, 8));
  const id = `cp_${state.year}_${Object.keys(state.customParts).length + 1}`;
  const autoName = `${PART_NAME_PREFIX[componentId] ?? 'Part'}${Math.round(rng.range(10, 99))}`;
  const part: CustomPart = {
    id,
    companyId,
    name: (name.trim() || autoName).slice(0, 20),
    componentId,
    version: 1,
    grade: Math.round(grade),
    ...partStatsFromGrade(grade),
    forSale: false,
    unitsSoldTotal: 0,
    revenueTotal: 0,
    yearDesigned: state.year,
  };
  commit(state, rng);
  state.customParts[id] = part;
  if (!state.achievements.includes('part_engineer')) state.achievements.push('part_engineer');
  log(state, `⚙️ ${company.name} engineered its own ${COMPONENT_BY_ID[componentId].label.toLowerCase()}: ${part.name} (grade ${part.grade}).`, 'business');
  return { ok: true, message: `${part.name} is real — grade ${part.grade}. Install it in your products or sell it to the industry.`, productId: id };
}

/** A revision program: raises the grade, bumps the version. */
export function revisePart(state: GameState, partId: string, investment: number): StudioResult {
  const cp = (state.customParts ?? {})[partId];
  if (!cp) return { ok: false, message: 'Part not found.' };
  const company = state.companies[cp.companyId];
  const invest = Math.round(investment);
  if (invest < 25_000) return { ok: false, message: 'Revisions start at $25,000.' };
  if (!company || company.cash < invest) return { ok: false, message: `Needs $${invest.toLocaleString()} in company cash.` };
  const rng = withRng(state);
  company.cash -= invest;
  const gain = Math.max(1, Math.sqrt(invest / 1_000) * 0.9 * (1 - cp.grade / 130) + rng.range(-1, 2));
  cp.grade = Math.round(clamp100(cp.grade + gain));
  Object.assign(cp, partStatsFromGrade(cp.grade));
  cp.version++;
  commit(state, rng);
  return { ok: true, message: `${cp.name} v${cp.version}: grade now ${cp.grade}.` };
}

export function setPartForSale(state: GameState, partId: string, forSale: boolean): StudioResult {
  const cp = (state.customParts ?? {})[partId];
  if (!cp) return { ok: false, message: 'Part not found.' };
  cp.forSale = forSale;
  return { ok: true, message: forSale ? `${cp.name} is now listed on the global component market.` : `${cp.name} delisted — exclusive to your products.` };
}

export function playerParts(state: GameState): CustomPart[] {
  return Object.values(state.customParts ?? {});
}

// --------------------------------------------------------------------------- market research & segments

/** How well this product fits one customer segment, 0..100. */
export function segmentFit(state: GameState, p: Product, segmentId: CustomerSegment): number {
  const seg = SEGMENT_BY_ID[segmentId];
  const cat = PRODUCT_CATEGORY_BY_ID[p.category];
  const primary = PRODUCT_MATERIAL_BY_ID[p.materials[0]];
  const accent = PRODUCT_MATERIAL_BY_ID[p.materials[1]];
  const q = productQuality(state, p);
  const priceRatio = p.price / cat.basePrice;
  // Price above the anchor punishes sensitive segments; luxury buyers read cheap as off-brand.
  const pricePenalty = (priceRatio - 1) * seg.priceSensitivity * 35;
  const cheapPenalty = segmentId === 'luxury_buyers' && priceRatio < 0.9 ? (0.9 - priceRatio) * 30 : 0;
  const techScore = (p.features.length * 10 + cat.techAffinity * 22) * seg.lovesTech;
  const luxScore = (primary.luxury * 0.7 + accent.luxury * 0.3) * seg.lovesLuxury * 0.35;
  const ecoScore = productSustainability(state, p) * seg.lovesEco * 0.3;
  const reliability = primary.durability * 0.5 + (p.warrantyYears ?? 0) * 8 + (p.trust ?? 70) * 0.2;
  const relScore = reliability * seg.lovesReliability * 0.3;
  return clamp100(18 + q * 0.3 + techScore + luxScore + ecoScore + relScore - pricePenalty - cheapPenalty);
}

export function runFocusGroup(state: GameState, productId: string, segmentId: CustomerSegment): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  normalizeProduct(p);
  const company = state.companies[p.companyId];
  const cost = 8_000;
  if (!company || company.cash < cost) return { ok: false, message: `A focus group costs $${cost.toLocaleString()} in company cash.` };
  company.cash -= cost;
  const seg = SEGMENT_BY_ID[segmentId];
  const fit = Math.round(segmentFit(state, p, segmentId));
  p.segmentInsights[segmentId] = fit;
  if (CUSTOMER_SEGMENTS.every((s) => p.segmentInsights[s.id] !== undefined) && !state.achievements.includes('segment_master')) {
    state.achievements.push('segment_master');
  }
  const tip = fit >= 70 ? 'They would buy it today.'
    : fit >= 45 ? (seg.priceSensitivity > 0.6 ? 'Interested, but the price gives them pause.' : 'Interested — sharpen what makes it special.')
    : seg.lovesLuxury > 0.7 ? 'It does not feel exclusive enough for them yet.'
    : seg.lovesEco > 0.7 ? 'They asked hard questions about materials and footprint.'
    : 'Not their product — or not at this price.';
  log(state, `🗣️ Focus group with ${seg.label} on ${p.name}: fit ${fit}/100.`, 'business');
  return { ok: true, message: `${seg.label}: fit ${fit}/100. ${tip}` };
}

export function setTargetSegment(state: GameState, productId: string, segmentId: CustomerSegment | null): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  normalizeProduct(p);
  p.targetSegment = segmentId;
  return { ok: true, message: segmentId ? `Marketing now targets ${SEGMENT_BY_ID[segmentId].label}.` : 'Marketing back to broad targeting.' };
}

// --------------------------------------------------------------------------- warranty, recalls & trust

export function setWarranty(state: GameState, productId: string, years: number): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  normalizeProduct(p);
  p.warrantyYears = clamp(Math.round(years), 0, 3);
  return { ok: true, message: p.warrantyYears === 0 ? 'No warranty — cheap, but buyers notice.' : `${p.warrantyYears}-year warranty set.` };
}

export function issueRecall(state: GameState, productId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  normalizeProduct(p);
  if (!p.activeDefect) return { ok: false, message: 'No active defect to recall.' };
  const company = state.companies[p.companyId];
  const lastYear = p.salesHistory[p.salesHistory.length - 1];
  const affected = Math.max(1_000, Math.round((lastYear?.units ?? 5_000) * 0.6));
  const cost = Math.round(50_000 + affected * productUnitCost(state, p) * 0.35);
  if (!company || company.cash < cost) return { ok: false, message: `A full recall would cost $${cost.toLocaleString()} — the company cannot cover it.` };
  company.cash -= cost;
  const defectName = p.activeDefect.name;
  p.activeDefect = null;
  p.recalls++;
  p.trust = clamp100(p.trust + 14);
  p.rating = clamp(p.rating + 0.2, 0, 5);
  company.brand = clamp100(company.brand + 2);
  if (!state.achievements.includes('recall_survivor')) state.achievements.push('recall_survivor');
  log(state, `🛟 ${company.name} voluntarily recalled ${p.name} over ${defectName} — customers applauded the honesty.`, 'business');
  return { ok: true, message: `Recall complete ($${cost.toLocaleString()}). Trust rebounded to ${Math.round(p.trust)}.` };
}

// --------------------------------------------------------------------------- pipeline

export function buildPrototype(state: GameState, productId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.stage !== 'concept') return { ok: false, message: 'Already past the concept stage.' };
  const company = state.companies[p.companyId];
  const cat = PRODUCT_CATEGORY_BY_ID[p.category];
  const cost = Math.max(20_000, cat.baseUnitCost * 120);
  if (!company || company.cash < cost) return { ok: false, message: `Prototype run needs $${Math.round(cost).toLocaleString()} in company cash.` };
  company.cash -= cost;
  p.stage = 'prototype';
  p.designQuality = clamp100(p.designQuality + 8);
  log(state, `🖨️ First ${p.name} prototypes came off the Studio printers.`, 'business');
  return { ok: true, message: 'Prototype built. Send it to the testing lab.' };
}

/** How good the product actually is, before market factors. 0..100. */
export function productQuality(state: GameState, p: Product): number {
  const primary = PRODUCT_MATERIAL_BY_ID[p.materials[0]];
  const accent = PRODUCT_MATERIAL_BY_ID[p.materials[1]];
  const cat = PRODUCT_CATEGORY_BY_ID[p.category];
  const matDurability = primary.durability * 0.7 + accent.durability * 0.3;
  const matLuxury = primary.luxury * 0.7 + accent.luxury * 0.3;
  const techBonus = p.features.length * 6 * cat.techAffinity;
  const precision = state.productTech.includes('precision_tooling') ? 6 : 0;
  const compBonus = componentProfile(state, p).quality;
  return clamp100(
    p.designQuality * 0.45 + matDurability * 0.2 + matLuxury * 0.15 * cat.luxuryAffinity + techBonus + precision + compBonus + p.iterations * 2,
  );
}

export function productUnitCost(state: GameState, p: Product): number {
  const cat = PRODUCT_CATEGORY_BY_ID[p.category];
  const primary = PRODUCT_MATERIAL_BY_ID[p.materials[0]];
  const accent = PRODUCT_MATERIAL_BY_ID[p.materials[1]];
  const matMult = primary.costMult * 0.75 + accent.costMult * 0.25;
  const mfg = MANUFACTURING_BY_ID[p.manufacturing];
  const pack = PACKAGING_STYLES.find((x) => x.id === p.packaging)!;
  const qualityMult = 1 + (p.designQuality - 50) / 250;
  // Components are ~55% of the bill of materials; a global shortage inflates affected categories.
  const comp = componentProfile(state, p);
  let compMult = 0.45 + 0.55 * comp.costMult;
  const shortage = state.componentShortage;
  if (shortage && (PRODUCT_COMPONENTS[p.category] ?? []).includes(shortage.componentId)) compMult *= 1.25;
  return Math.max(0.5, cat.baseUnitCost * matMult * mfg.costMult * qualityMult * compMult + pack.costPerUnit);
}

export function productSustainability(_state: GameState, p: Product): number {
  const primary = PRODUCT_MATERIAL_BY_ID[p.materials[0]];
  const accent = PRODUCT_MATERIAL_BY_ID[p.materials[1]];
  const mfg = MANUFACTURING_BY_ID[p.manufacturing];
  const pack = PACKAGING_STYLES.find((x) => x.id === p.packaging)!;
  return clamp100(primary.sustainability * 0.4 + accent.sustainability * 0.15 + mfg.sustainability * 0.3 + pack.sustainability * 0.15);
}

export function runProductTests(state: GameState, productId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.stage !== 'prototype' && p.stage !== 'testing') return { ok: false, message: 'Build a prototype first.' };
  const company = state.companies[p.companyId];
  const cost = 15_000;
  if (!company || company.cash < cost) return { ok: false, message: `Lab time needs $${cost.toLocaleString()}.` };
  company.cash -= cost;
  const rng = withRng(state);
  const cat = PRODUCT_CATEGORY_BY_ID[p.category];
  const primary = PRODUCT_MATERIAL_BY_ID[p.materials[0]];
  const accent = PRODUCT_MATERIAL_BY_ID[p.materials[1]];
  const q = productQuality(state, p);
  const noise = () => rng.range(-6, 6);
  const valueScore = clamp100(60 + (p.price > 0 ? ((cat.basePrice / p.price) - 1) * 40 : 0) + (q - 50) * 0.4);
  p.testScores = {
    appearance: clamp100(q * 0.5 + (primary.luxury + accent.luxury) / 4 + p.form.accent * 12 + (state.productTech.includes('haptic_glass') ? 6 : 0) + noise()),
    innovation: clamp100(30 + p.features.length * 10 + cat.techAffinity * 20 + (state.productTech.includes('ai_integration') ? 10 : 0) + noise()),
    comfort: clamp100(50 + p.form.curvature * 20 + (100 - primary.weight) * 0.15 + (state.productTech.includes('dense_batteries') ? 6 : 0) + noise()),
    reliability: clamp100(primary.durability * 0.6 + q * 0.3 + (state.productTech.includes('self_healing') ? 10 : 0) + noise()),
    performance: clamp100(q * 0.5 + cat.techAffinity * ((state.productTech.includes('fast_chips') ? 25 : 10)) + noise()),
    easeOfUse: clamp100(55 + p.form.slimness * 10 + p.iterations * 4 + noise()),
    sustainability: productSustainability(state, p),
    buildQuality: clamp100(q * 0.7 + (100 - MANUFACTURING_BY_ID[p.manufacturing].defectRate * 800) * 0.2 + noise()),
    value: valueScore,
  };
  commit(state, rng);
  p.stage = 'testing';
  log(state, `🧪 ${p.name} came back from the testing lab.`, 'business');
  return { ok: true, message: 'Test report is in — iterate or move to production.' };
}

export function refineDesign(state: GameState, productId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.stage === 'retired') return { ok: false, message: 'This product is retired.' };
  const company = state.companies[p.companyId];
  const modular = state.productTech.includes('modular_design');
  const cost = modular ? 12_000 : 20_000;
  if (!company || company.cash < cost) return { ok: false, message: `Refinement pass needs $${cost.toLocaleString()}.` };
  company.cash -= cost;
  p.iterations++;
  p.designQuality = clamp100(p.designQuality + (modular ? 7 : 5));
  // Grant tech features to refined products in tech-affine categories.
  const cat = PRODUCT_CATEGORY_BY_ID[p.category];
  if (cat.techAffinity >= 0.5) {
    for (const tech of PRODUCT_TECH_TREE) {
      if (tech.grantsFeature && state.productTech.includes(tech.id) && !p.features.includes(tech.grantsFeature)) {
        p.features.push(tech.grantsFeature);
      }
    }
  }
  return { ok: true, message: `Iteration ${p.iterations}: design quality now ${Math.round(p.designQuality)}.` };
}

export function fileProductPatent(state: GameState, productId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.patented) return { ok: false, message: 'Already patented.' };
  const company = state.companies[p.companyId];
  const cost = 40_000;
  if (!company || company.cash < cost) return { ok: false, message: `Patent filing needs $${cost.toLocaleString()}.` };
  const q = productQuality(state, p);
  if (q < 55) return { ok: false, message: 'Examiners rejected it — quality below 55 is not novel enough.' };
  company.cash -= cost;
  p.patented = true;
  company.patents++;
  if (!state.achievements.includes('product_patented')) state.achievements.push('product_patented');
  log(state, `📜 Patent granted for ${p.name} — exclusive market position secured.`, 'business');
  return { ok: true, message: 'Patent granted. Competitors will struggle to copy this.' };
}

export function startProduction(state: GameState, productId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.stage !== 'testing') return { ok: false, message: 'Run lab tests before tooling a factory line.' };
  const company = state.companies[p.companyId];
  const mfg = MANUFACTURING_BY_ID[p.manufacturing];
  const toolingCost = Math.max(30_000, productUnitCost(state, p) * 200 * mfg.costMult);
  if (!company || company.cash < toolingCost) return { ok: false, message: `Tooling up needs $${Math.round(toolingCost).toLocaleString()} in company cash.` };
  company.cash -= toolingCost;
  p.stage = 'production';
  log(state, `🏭 ${p.name} entered production (${mfg.label}).`, 'business');
  return { ok: true, message: `Production line ready — plan the launch.` };
}

export function publishProduct(state: GameState, productId: string, publishState: PublishState): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (publishState === 'public' && p.stage !== 'launched') return { ok: false, message: 'Hold a launch to go public.' };
  p.publishState = publishState;
  return { ok: true, message: `Publishing state: ${publishState}.` };
}

export function holdLaunchEvent(state: GameState, productId: string, venue: LaunchVenue): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.stage !== 'production') return { ok: false, message: 'Get the product into production first.' };
  const company = state.companies[p.companyId];
  const v = LAUNCH_VENUES.find((x) => x.id === venue)!;
  if (!company || company.cash < v.cost) return { ok: false, message: `${v.label} costs $${v.cost.toLocaleString()}.` };
  const rng = withRng(state);
  company.cash -= v.cost;
  const q = productQuality(state, p);
  const stumble = rng.chance(clamp(0.25 - q * 0.002, 0.03, 0.25));
  p.hype = clamp100(v.hype * (stumble ? 0.45 : 1) + p.brandPower * 0.3 + rng.range(-5, 8));
  commit(state, rng);
  p.stage = 'launched';
  p.publishState = 'public';
  p.yearLaunched = state.year;
  company.brand = clamp100(company.brand + (stumble ? 1 : 4));
  state.player.reputation = clamp100(state.player.reputation + (stumble ? 0 : 2));
  if (!state.achievements.includes('product_launched')) state.achievements.push('product_launched');
  log(state, stumble
    ? `🎬 The ${p.name} launch had an awkward on-stage demo glitch, but it shipped.`
    : `🎬 ${p.name} launched at a ${v.label.toLowerCase()} to real buzz (hype ${Math.round(p.hype)}).`, 'milestone');
  return { ok: true, message: stumble ? 'A rocky launch — hype took a hit, but you are live.' : `Launched! Hype at ${Math.round(p.hype)}.` };
}

export function upgradeGeneration(state: GameState, productId: string): StudioResult {
  const old = state.products[productId];
  if (!old) return { ok: false, message: 'Product not found.' };
  if (old.stage !== 'launched') return { ok: false, message: 'Only launched products can be superseded.' };
  const company = state.companies[old.companyId];
  const cost = 50_000;
  if (!company || company.cash < cost) return { ok: false, message: `A next-gen program needs $${cost.toLocaleString()}.` };
  company.cash -= cost;
  const id = nextProductId(state);
  const next: Product = {
    ...old,
    id,
    name: old.name.replace(/ (Gen \d+)$/, '') + ` Gen ${old.generation + 1}`,
    generation: old.generation + 1,
    predecessorId: old.id,
    stage: 'concept',
    publishState: 'draft',
    patented: false,
    testScores: null,
    iterations: 0,
    designQuality: clamp100(old.designQuality * 0.8 + 10),
    hype: 0,
    brandPower: clamp100(old.brandPower + 5),
    yearDesigned: state.year,
    yearLaunched: null,
    unitsSoldTotal: 0,
    revenueTotal: 0,
    profitTotal: 0,
    rating: 0,
    reviews: [],
    returnRate: 0,
    salesHistory: [],
    features: [...old.features],
    materials: [...old.materials] as [ProductMaterialId, ProductMaterialId],
    form: { ...old.form },
    channels: [...old.channels],
    partOverrides: Object.fromEntries(Object.entries(old.partOverrides ?? {}).map(([k, v]) => [k, { ...v }])),
    components: { ...(old.components ?? defaultComponents(old.category)) },
    segmentInsights: {},
    targetSegment: old.targetSegment ?? null,
    warrantyYears: old.warrantyYears ?? 1,
    trust: clamp100((old.trust ?? 70) * 0.5 + 38),
    activeDefect: null,
    recalls: 0,
  };
  state.products[id] = next;
  if (next.generation >= 3 && !state.achievements.includes('product_dynasty')) state.achievements.push('product_dynasty');
  log(state, `🔁 ${company.name} kicked off ${next.name}, successor to ${old.name}.`, 'business');
  return { ok: true, message: `${next.name} enters the Studio, inheriting the line's brand power.`, productId: id };
}

export function retireProduct(state: GameState, productId: string): StudioResult {
  const p = state.products[productId];
  if (!p) return { ok: false, message: 'Product not found.' };
  if (p.stage === 'retired') return { ok: false, message: 'Already retired.' };
  p.stage = 'retired';
  p.publishState = 'portfolio';
  log(state, `🌙 ${p.name} was retired after ${p.unitsSoldTotal.toLocaleString()} lifetime units.`, 'business');
  return { ok: true, message: `${p.name} retired to the portfolio.` };
}

// --------------------------------------------------------------------------- R&D

export function researchProductTech(state: GameState, techId: string): StudioResult {
  const tech = PRODUCT_TECH_BY_ID[techId];
  if (!tech) return { ok: false, message: 'Unknown technology.' };
  if (state.productTech.includes(techId)) return { ok: false, message: 'Already researched.' };
  if (tech.requires && !state.productTech.includes(tech.requires)) {
    return { ok: false, message: `Requires ${PRODUCT_TECH_BY_ID[tech.requires].label} first.` };
  }
  if (state.player.money < tech.cost) return { ok: false, message: `Needs $${tech.cost.toLocaleString()}.` };
  state.player.money -= tech.cost;
  state.productTech.push(techId);
  if (state.productTech.length >= 6 && !state.achievements.includes('rnd_visionary')) state.achievements.push('rnd_visionary');
  log(state, `🔬 Studio R&D breakthrough: ${tech.label}.`, 'business');
  return { ok: true, message: `${tech.label} researched. ${tech.blurb}` };
}

// --------------------------------------------------------------------------- storefront

export function setStorefront(state: GameState, patch: Partial<GameState['storefront']>): StudioResult {
  state.storefront = { ...state.storefront, ...patch };
  return { ok: true, message: 'Storefront updated.' };
}

// --------------------------------------------------------------------------- yearly market simulation

export function tickProducts(state: GameState, rng: RNG): string[] {
  const headlines: string[] = [];
  const home = state.countries.find((c) => c.isPlayerHome)!;
  const e = home.economy;
  if (!state.customParts) state.customParts = {};
  for (const p of Object.values(state.products)) normalizeProduct(p);

  // Global component shortages ripple through every affected category's costs.
  if (state.componentShortage) {
    state.componentShortage.yearsLeft--;
    if (state.componentShortage.yearsLeft <= 0) {
      headlines.push(`Global ${COMPONENT_BY_ID[state.componentShortage.componentId].label.toLowerCase()} supply finally normalizes`);
      state.componentShortage = null;
    }
  } else if (rng.chance(0.08)) {
    const comp = rng.pick(Object.values(COMPONENT_BY_ID));
    state.componentShortage = { componentId: comp.id, yearsLeft: rng.chance(0.4) ? 2 : 1 };
    headlines.push(`Global ${comp.label.toLowerCase()} shortage squeezes manufacturers`);
  }

  const launched = Object.values(state.products).filter((p) => p.stage === 'launched');
  // Category crowding: your own products cannibalize each other.
  const perCategory: Record<string, number> = {};
  for (const p of launched) perCategory[p.category] = (perCategory[p.category] ?? 0) + 1;

  for (const p of launched) {
    const company = state.companies[p.companyId];
    if (!company || company.status !== 'active') continue;
    const cat = PRODUCT_CATEGORY_BY_ID[p.category];
    const mfg = MANUFACTURING_BY_ID[p.manufacturing];
    const q = productQuality(state, p);
    const unitCost = productUnitCost(state, p);

    // Appeal: quality vs. price positioning, brand, hype, channels, sustainability sentiment.
    const priceRatio = p.price / cat.basePrice;
    const qualityFit = clamp(q / 100 * 1.3 - (priceRatio - 1) * 0.5, 0.05, 1.4);
    const brandMult = 0.7 + (p.brandPower / 100) * 0.6 + (company.brand / 100) * 0.2;
    const hypeMult = 1 + (p.hype / 100) * 0.8;
    const channelMult = 0.55 + p.channels.length * 0.15;
    const sustainMult = 1 + (productSustainability(state, p) - 50) / 100 * 0.2 + mfg.perception * 0.008;
    const economyMult = clamp(0.6 + e.consumerConfidence / 100 * 0.7, 0.4, 1.3);
    const patentMult = p.patented ? 1.15 : 1;
    const marketingMult = 1 + Math.min(0.5, Math.sqrt(p.marketingBudget / 1_000_000) * 0.4);
    const ageYears = state.year - (p.yearLaunched ?? state.year);
    const lifecycleMult = clamp(1 - Math.max(0, ageYears - 2) * 0.15, 0.15, 1);
    const crowding = 1 / Math.sqrt(perCategory[p.category] ?? 1);

    // Segment demand: how each slice of the market rates this product, with targeting focus.
    let segAcc = 0;
    for (const seg of CUSTOMER_SEGMENTS) {
      const fit = segmentFit(state, p, seg.id) / 100;
      let w = seg.share;
      if (p.targetSegment === seg.id) w *= 1.5;
      else if (p.targetSegment) w *= 0.85;
      segAcc += w * fit;
    }
    const segmentMult = clamp(segAcc * 1.7, 0.25, 1.5);
    const trustMult = clamp(p.trust / 70, 0.35, 1.25);

    const appeal = qualityFit * brandMult * hypeMult * channelMult * sustainMult * economyMult * patentMult * marketingMult * lifecycleMult * crowding * segmentMult * trustMult;
    let units = Math.round(cat.marketUnits * clamp(appeal * 0.22, 0, 0.9) * rng.range(0.8, 1.2));
    units = Math.min(units, mfg.capacity);

    // Defects & returns — component tiers and warranty coverage both matter.
    const comp = componentProfile(state, p);
    const defectRate = clamp((mfg.defectRate + comp.defectMod) * (state.productTech.includes('self_healing') ? 0.5 : 1) * (2 - q / 100), 0.002, 0.15);
    p.returnRate = defectRate * rng.range(0.8, 1.5) * (1 - p.warrantyYears * 0.1);
    const returnedUnits = Math.round(units * p.returnRate);
    const netUnits = Math.max(0, units - returnedUnits);

    const revenue = netUnits * p.price;
    const marketing = Math.min(p.marketingBudget, company.cash > 0 ? p.marketingBudget : 0);
    const warrantyReserve = netUnits * unitCost * 0.035 * p.warrantyYears;
    const costs = units * unitCost + marketing + warrantyReserve;
    const profit = revenue - costs;

    company.cash += profit;
    company.revenue += revenue * 0.15; // products lift the company's top-line trajectory too
    p.unitsSoldTotal += netUnits;
    p.revenueTotal += revenue;
    p.profitTotal += profit;
    p.salesHistory.push({ year: state.year, units: netUnits, revenue, profit });
    if (p.salesHistory.length > 40) p.salesHistory.shift();

    // Ratings drift toward the quality the market actually experiences.
    const experienced = clamp(q / 20 - p.returnRate * 8 + rng.range(-0.3, 0.3), 1, 5);
    p.rating = p.rating === 0 ? experienced : p.rating * 0.7 + experienced * 0.3;
    if (rng.chance(0.6)) {
      const stars = Math.round(clamp(experienced + rng.range(-1, 1), 1, 5));
      const good = stars >= 4;
      const texts = good
        ? [`Feels genuinely premium — the ${PRODUCT_MATERIAL_BY_ID[p.materials[0]].label.toLowerCase()} body is gorgeous.`, 'Exceeded expectations. Worth every dollar.', `The ${p.features[0]?.toLowerCase() ?? 'design'} alone justifies the upgrade.`]
        : ['Wanted to love it, but quality control let it down.', 'Overpriced for what it delivers.', 'Returned mine after a week.'];
      p.reviews.push({ year: state.year, stars, text: rng.pick(texts) });
      if (p.reviews.length > 12) p.reviews.shift();
    }

    // Consumer trust drifts with warranty generosity, delivered quality — and festering defects.
    p.trust = clamp100(p.trust + p.warrantyYears * 1.2 - 0.5 + (p.rating - 3) * 1.5);
    if (!p.activeDefect && units > 2_000 && rng.chance(clamp(defectRate * 4, 0.02, 0.3))) {
      const severity = rng.chance(0.3) ? 3 : rng.chance(0.5) ? 2 : 1;
      p.activeDefect = { name: rng.pick(DEFECT_NAMES), severity, year: state.year };
      p.trust = clamp100(p.trust - 5 * severity);
      headlines.push(`${p.name} hit by ${p.activeDefect.name}`);
      log(state, `⚠️ Field defect on ${p.name}: ${p.activeDefect.name} (severity ${severity}). Recall or ride it out?`, 'business');
    } else if (p.activeDefect && p.activeDefect.year < state.year) {
      p.trust = clamp100(p.trust - 7 * p.activeDefect.severity);
      p.rating = clamp(p.rating - 0.15, 0, 5);
      if (rng.chance(0.3)) {
        const damages = p.activeDefect.severity * 250_000;
        company.cash -= damages;
        headlines.push(`${company.name} settles lawsuits over ${p.name} ${p.activeDefect.name}`);
      }
    }
    if (p.trust >= 95 && !state.achievements.includes('trusted_brand')) {
      state.achievements.push('trusted_brand');
      log(state, `🏆 ${p.name} tops consumer-trust rankings.`, 'milestone');
    }
    if (comp.premiumOnly && !state.achievements.includes('premium_engineering')) state.achievements.push('premium_engineering');

    p.hype = clamp100(p.hype * 0.55);
    if (p.rating >= 4.5 && p.unitsSoldTotal > 10_000 && !state.achievements.includes('design_icon')) {
      state.achievements.push('design_icon');
      log(state, `🏆 ${p.name} is being called a design icon (${p.rating.toFixed(1)}★).`, 'milestone');
    }
    if (p.unitsSoldTotal >= 1_000_000 && !state.achievements.includes('million_units')) {
      state.achievements.push('million_units');
      log(state, `🏆 ${p.name} passed one million lifetime units.`, 'milestone');
    }
    if (profit > 5_000_000 && rng.chance(0.4)) headlines.push(`${p.name} is flying off shelves for ${company.name}`);
    if (p.returnRate > 0.08) headlines.push(`${company.name} faces returns headache over ${p.name} defects`);
  }

  // Global component market: parts listed for sale compete for OEM contracts.
  const listed = Object.values(state.customParts ?? {}).filter((cp) => cp.forSale);
  const byComponent: Record<string, CustomPart[]> = {};
  for (const cp of listed) (byComponent[cp.componentId] ??= []).push(cp);
  for (const [componentId, parts] of Object.entries(byComponent)) {
    const market = COMPONENT_MARKET[componentId];
    if (!market) continue;
    const totalGrade = parts.reduce((sum, cp) => sum + cp.grade, 0);
    for (const cp of parts) {
      const company = state.companies[cp.companyId];
      if (!company || company.status !== 'active') continue;
      const shareOfDemand = cp.grade / (totalGrade + 200); // competes against the rest of the industry too
      const units = Math.round(market.units * shareOfDemand * rng.range(0.7, 1.3));
      const price = market.price * (0.6 + cp.grade / 100);
      const revenue = units * price;
      company.cash += revenue * 0.7; // 30% goes to distribution/licensing overhead
      company.revenue += revenue * 0.1;
      cp.unitsSoldTotal += units;
      cp.revenueTotal += revenue;
      if (cp.unitsSoldTotal >= 500_000 && !state.achievements.includes('component_supplier')) {
        state.achievements.push('component_supplier');
        log(state, `🏆 ${cp.name} has shipped to half a million devices industry-wide.`, 'milestone');
      }
      if (revenue > 1_000_000 && rng.chance(0.3)) headlines.push(`${cp.name} becomes a go-to ${COMPONENT_BY_ID[componentId].label.toLowerCase()} for the industry`);
    }
  }
  return headlines;
}
