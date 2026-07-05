/**
 * The Studio's data catalogue: product categories, engineering materials, the
 * product R&D tree, manufacturing strategies, packaging, launch venues, and the
 * grammar the in-game AI concept generator draws from. All gameplay-relevant
 * numbers live here so new industries/materials/tech are pure data additions.
 */
import type {
  LaunchVenue, ManufacturingStrategy, PackagingStyle, ProductCategory, ProductMaterialId,
} from '../sim/types';

// --------------------------------------------------------------------------- categories

/** Archetype keys drive which procedural 3D mesh the Studio viewport builds. */
export type FormArchetype = 'slab' | 'clamshell' | 'round' | 'tower' | 'vessel' | 'seat' | 'vehicle' | 'shoe' | 'device';

export interface ProductCategoryDef {
  id: ProductCategory;
  label: string;
  icon: string;
  archetype: FormArchetype;
  baseUnitCost: number; // at quality 50, before material/manufacturing multipliers
  basePrice: number; // sensible anchor retail price
  marketUnits: number; // annual addressable units at perfect appeal (home nation scale)
  techAffinity: number; // 0..1 how much product tech matters
  luxuryAffinity: number; // 0..1 how much luxury materials matter
}

export const PRODUCT_CATEGORIES: ProductCategoryDef[] = [
  { id: 'smartphone', label: 'Smartphone', icon: '📱', archetype: 'slab', baseUnitCost: 220, basePrice: 800, marketUnits: 900_000, techAffinity: 1.0, luxuryAffinity: 0.5 },
  { id: 'laptop', label: 'Laptop', icon: '💻', archetype: 'clamshell', baseUnitCost: 450, basePrice: 1_400, marketUnits: 400_000, techAffinity: 0.95, luxuryAffinity: 0.4 },
  { id: 'tablet', label: 'Tablet', icon: '📲', archetype: 'slab', baseUnitCost: 260, basePrice: 700, marketUnits: 350_000, techAffinity: 0.9, luxuryAffinity: 0.4 },
  { id: 'wearable', label: 'Smartwatch & Wearables', icon: '⌚', archetype: 'round', baseUnitCost: 90, basePrice: 380, marketUnits: 500_000, techAffinity: 0.85, luxuryAffinity: 0.6 },
  { id: 'gaming', label: 'Gaming Device', icon: '🎮', archetype: 'tower', baseUnitCost: 320, basePrice: 550, marketUnits: 450_000, techAffinity: 1.0, luxuryAffinity: 0.2 },
  { id: 'audio', label: 'Audio & Headphones', icon: '🎧', archetype: 'round', baseUnitCost: 60, basePrice: 300, marketUnits: 700_000, techAffinity: 0.75, luxuryAffinity: 0.5 },
  { id: 'appliance', label: 'Home Appliance', icon: '☕', archetype: 'tower', baseUnitCost: 140, basePrice: 420, marketUnits: 500_000, techAffinity: 0.6, luxuryAffinity: 0.4 },
  { id: 'smart_home', label: 'Smart Home', icon: '🏠', archetype: 'tower', baseUnitCost: 70, basePrice: 220, marketUnits: 600_000, techAffinity: 0.9, luxuryAffinity: 0.3 },
  { id: 'furniture', label: 'Furniture', icon: '🪑', archetype: 'seat', baseUnitCost: 180, basePrice: 700, marketUnits: 300_000, techAffinity: 0.2, luxuryAffinity: 0.7 },
  { id: 'fashion', label: 'Fashion & Apparel', icon: '🧥', archetype: 'shoe', baseUnitCost: 45, basePrice: 240, marketUnits: 1_200_000, techAffinity: 0.15, luxuryAffinity: 0.9 },
  { id: 'shoes', label: 'Footwear', icon: '👟', archetype: 'shoe', baseUnitCost: 40, basePrice: 190, marketUnits: 1_000_000, techAffinity: 0.3, luxuryAffinity: 0.7 },
  { id: 'jewelry', label: 'Jewelry', icon: '💍', archetype: 'round', baseUnitCost: 120, basePrice: 900, marketUnits: 150_000, techAffinity: 0.05, luxuryAffinity: 1.0 },
  { id: 'cosmetics', label: 'Cosmetics', icon: '💄', archetype: 'vessel', baseUnitCost: 12, basePrice: 65, marketUnits: 2_000_000, techAffinity: 0.25, luxuryAffinity: 0.8 },
  { id: 'automotive', label: 'Automotive', icon: '🚗', archetype: 'vehicle', baseUnitCost: 22_000, basePrice: 48_000, marketUnits: 40_000, techAffinity: 0.9, luxuryAffinity: 0.7 },
  { id: 'food_beverage', label: 'Food & Beverage', icon: '🥤', archetype: 'vessel', baseUnitCost: 1.6, basePrice: 5, marketUnits: 12_000_000, techAffinity: 0.1, luxuryAffinity: 0.4 },
  { id: 'medical', label: 'Medical Device', icon: '🩺', archetype: 'device', baseUnitCost: 900, basePrice: 3_500, marketUnits: 60_000, techAffinity: 1.0, luxuryAffinity: 0.1 },
  { id: 'industrial', label: 'Industrial Machinery', icon: '⚙️', archetype: 'device', baseUnitCost: 14_000, basePrice: 42_000, marketUnits: 9_000, techAffinity: 0.85, luxuryAffinity: 0.05 },
  { id: 'toys', label: 'Toys', icon: '🧸', archetype: 'device', baseUnitCost: 14, basePrice: 45, marketUnits: 1_500_000, techAffinity: 0.35, luxuryAffinity: 0.2 },
  { id: 'sports', label: 'Sports Equipment', icon: '🏀', archetype: 'shoe', baseUnitCost: 35, basePrice: 140, marketUnits: 800_000, techAffinity: 0.4, luxuryAffinity: 0.3 },
  { id: 'luxury', label: 'Luxury Goods', icon: '👜', archetype: 'vessel', baseUnitCost: 350, basePrice: 2_800, marketUnits: 80_000, techAffinity: 0.1, luxuryAffinity: 1.0 },
];

export const PRODUCT_CATEGORY_BY_ID: Record<string, ProductCategoryDef> =
  Object.fromEntries(PRODUCT_CATEGORIES.map((c) => [c.id, c]));

// --------------------------------------------------------------------------- materials

export interface ProductMaterialDef {
  id: ProductMaterialId;
  label: string;
  costMult: number; // multiplies unit cost when used as primary (accent counts half)
  durability: number; // 0..100
  luxury: number; // 0..100
  sustainability: number; // 0..100
  weight: number; // 0..100 heavier => shipping drag
  // Viewport rendering
  color: string;
  metalness: number;
  roughness: number;
  unlockTech: string | null; // product R&D node required, if any
}

export const PRODUCT_MATERIALS: ProductMaterialDef[] = [
  { id: 'plastic', label: 'Plastic', costMult: 0.8, durability: 45, luxury: 15, sustainability: 20, weight: 20, color: '#8fa3b8', metalness: 0.05, roughness: 0.55, unlockTech: null },
  { id: 'aluminum', label: 'Aluminum', costMult: 1.0, durability: 65, luxury: 55, sustainability: 55, weight: 35, color: '#c8cdd4', metalness: 0.85, roughness: 0.35, unlockTech: null },
  { id: 'steel', label: 'Steel', costMult: 1.05, durability: 85, luxury: 40, sustainability: 45, weight: 75, color: '#9aa2ad', metalness: 0.9, roughness: 0.4, unlockTech: null },
  { id: 'glass', label: 'Glass', costMult: 1.15, durability: 35, luxury: 70, sustainability: 50, weight: 50, color: '#bcd8e6', metalness: 0.3, roughness: 0.05, unlockTech: null },
  { id: 'wood', label: 'Wood', costMult: 0.95, durability: 55, luxury: 60, sustainability: 75, weight: 40, color: '#8a5a33', metalness: 0.0, roughness: 0.7, unlockTech: null },
  { id: 'fabric', label: 'Fabric', costMult: 0.85, durability: 40, luxury: 45, sustainability: 60, weight: 12, color: '#7d8aa0', metalness: 0.0, roughness: 0.9, unlockTech: null },
  { id: 'leather', label: 'Leather', costMult: 1.25, durability: 60, luxury: 80, sustainability: 30, weight: 25, color: '#6e4a2f', metalness: 0.05, roughness: 0.65, unlockTech: null },
  { id: 'ceramic', label: 'Ceramic', costMult: 1.2, durability: 50, luxury: 75, sustainability: 55, weight: 45, color: '#e8e4dc', metalness: 0.1, roughness: 0.25, unlockTech: null },
  { id: 'copper', label: 'Copper', costMult: 1.15, durability: 60, luxury: 65, sustainability: 50, weight: 65, color: '#b26e45', metalness: 0.95, roughness: 0.3, unlockTech: null },
  { id: 'chrome', label: 'Chrome', costMult: 1.3, durability: 70, luxury: 72, sustainability: 35, weight: 70, color: '#dfe5ea', metalness: 1.0, roughness: 0.08, unlockTech: null },
  { id: 'titanium', label: 'Titanium', costMult: 1.7, durability: 95, luxury: 85, sustainability: 60, weight: 30, color: '#aab3bb', metalness: 0.8, roughness: 0.3, unlockTech: 'adv_alloys' },
  { id: 'carbon_fiber', label: 'Carbon Fiber', costMult: 1.8, durability: 90, luxury: 80, sustainability: 40, weight: 10, color: '#23282f', metalness: 0.4, roughness: 0.35, unlockTech: 'adv_alloys' },
  { id: 'marble', label: 'Marble', costMult: 1.6, durability: 55, luxury: 92, sustainability: 45, weight: 95, color: '#e6e2da', metalness: 0.05, roughness: 0.15, unlockTech: 'luxury_craftwork' },
  { id: 'gold', label: 'Gold', costMult: 2.6, durability: 50, luxury: 100, sustainability: 25, weight: 90, color: '#d8b24a', metalness: 1.0, roughness: 0.15, unlockTech: 'luxury_craftwork' },
  { id: 'eco_composite', label: 'Sustainable Composite', costMult: 1.25, durability: 70, luxury: 55, sustainability: 95, weight: 22, color: '#7ba05b', metalness: 0.1, roughness: 0.5, unlockTech: 'green_materials' },
  { id: 'recycled', label: 'Recycled Materials', costMult: 0.9, durability: 55, luxury: 40, sustainability: 100, weight: 25, color: '#94a68b', metalness: 0.15, roughness: 0.6, unlockTech: 'green_materials' },
];

export const PRODUCT_MATERIAL_BY_ID: Record<string, ProductMaterialDef> =
  Object.fromEntries(PRODUCT_MATERIALS.map((m) => [m.id, m]));

// --------------------------------------------------------------------------- R&D tree

export interface ProductTechDef {
  id: string;
  label: string;
  icon: string;
  track: 'Materials' | 'Electronics' | 'Manufacturing' | 'Sustainability' | 'Frontier';
  cost: number;
  requires: string | null;
  blurb: string;
  /** Feature name granted to future/refined products in tech-affine categories. */
  grantsFeature: string | null;
}

export const PRODUCT_TECH_TREE: ProductTechDef[] = [
  { id: 'adv_alloys', label: 'Advanced Alloys', icon: '🔩', track: 'Materials', cost: 150_000, requires: null, blurb: 'Unlocks titanium and carbon fiber.', grantsFeature: null },
  { id: 'luxury_craftwork', label: 'Luxury Craftwork', icon: '👑', track: 'Materials', cost: 250_000, requires: 'adv_alloys', blurb: 'Unlocks marble and gold, plus luxury manufacturing.', grantsFeature: null },
  { id: 'green_materials', label: 'Green Materials', icon: '🌿', track: 'Sustainability', cost: 180_000, requires: null, blurb: 'Unlocks sustainable composites and recycled materials.', grantsFeature: null },
  { id: 'clean_production', label: 'Clean Production', icon: '♻️', track: 'Sustainability', cost: 220_000, requires: 'green_materials', blurb: 'Unlocks sustainable manufacturing; big sustainability score boost.', grantsFeature: null },
  { id: 'fast_chips', label: 'Faster Processors', icon: '⚡', track: 'Electronics', cost: 300_000, requires: null, blurb: '+performance for tech products.', grantsFeature: 'Next-gen processor' },
  { id: 'dense_batteries', label: 'Better Batteries', icon: '🔋', track: 'Electronics', cost: 280_000, requires: 'fast_chips', blurb: '+reliability and comfort for tech products.', grantsFeature: 'All-week battery' },
  { id: 'ai_integration', label: 'AI Integration', icon: '🤖', track: 'Electronics', cost: 400_000, requires: 'dense_batteries', blurb: '+innovation across smart categories.', grantsFeature: 'On-device AI' },
  { id: 'robotic_lines', label: 'Robotic Assembly', icon: '🦾', track: 'Manufacturing', cost: 350_000, requires: null, blurb: 'Unlocks automated production; lowers defect rates.', grantsFeature: null },
  { id: 'precision_tooling', label: 'Precision Tooling', icon: '🛠️', track: 'Manufacturing', cost: 260_000, requires: 'robotic_lines', blurb: '+build quality across all products.', grantsFeature: null },
  { id: 'modular_design', label: 'Modular Design', icon: '🧩', track: 'Manufacturing', cost: 200_000, requires: null, blurb: 'Refinement iterations are cheaper and stronger.', grantsFeature: 'Modular repairability' },
  { id: 'haptic_glass', label: 'Haptic Glass', icon: '🫧', track: 'Frontier', cost: 500_000, requires: 'ai_integration', blurb: 'Experimental: +appearance and innovation for slab/wearable devices.', grantsFeature: 'Haptic glass surface' },
  { id: 'self_healing', label: 'Self-Healing Coatings', icon: '🧬', track: 'Frontier', cost: 600_000, requires: 'precision_tooling', blurb: 'Experimental: durability rises, return rates fall.', grantsFeature: 'Self-healing finish' },
];

export const PRODUCT_TECH_BY_ID: Record<string, ProductTechDef> =
  Object.fromEntries(PRODUCT_TECH_TREE.map((t) => [t.id, t]));

// --------------------------------------------------------------------------- manufacturing

export interface ManufacturingDef {
  id: ManufacturingStrategy;
  label: string;
  icon: string;
  costMult: number;
  capacity: number; // max units/year
  defectRate: number; // baseline 0..1
  sustainability: number; // 0..100
  perception: number; // -10..+10 public-image modifier
  unlockTech: string | null;
  blurb: string;
}

export const MANUFACTURING_STRATEGIES: ManufacturingDef[] = [
  { id: 'handmade', label: 'Handmade', icon: '🤲', costMult: 2.2, capacity: 3_000, defectRate: 0.01, sustainability: 80, perception: 8, unlockTech: null, blurb: 'Tiny volume, superb quality, artisan story.' },
  { id: 'boutique', label: 'Boutique Workshop', icon: '🏚️', costMult: 1.6, capacity: 25_000, defectRate: 0.02, sustainability: 65, perception: 5, unlockTech: null, blurb: 'Small-batch craft with real capacity.' },
  { id: 'regional', label: 'Regional Factory', icon: '🏭', costMult: 1.15, capacity: 250_000, defectRate: 0.035, sustainability: 50, perception: 2, unlockTech: null, blurb: 'Balanced cost, speed and local goodwill.' },
  { id: 'overseas', label: 'Overseas Factory', icon: '🚢', costMult: 0.75, capacity: 900_000, defectRate: 0.05, sustainability: 30, perception: -4, unlockTech: null, blurb: 'Cheapest at scale; reputational drag.' },
  { id: 'mass', label: 'Mass Production', icon: '📦', costMult: 0.85, capacity: 3_000_000, defectRate: 0.045, sustainability: 35, perception: -2, unlockTech: null, blurb: 'Huge volume for huge markets.' },
  { id: 'automated', label: 'Automated Lines', icon: '🦾', costMult: 0.9, capacity: 1_500_000, defectRate: 0.015, sustainability: 55, perception: 1, unlockTech: 'robotic_lines', blurb: 'Robots: low defects at volume.' },
  { id: 'sustainable', label: 'Sustainable Production', icon: '🌿', costMult: 1.3, capacity: 400_000, defectRate: 0.03, sustainability: 95, perception: 7, unlockTech: 'clean_production', blurb: 'Certified clean; customers notice.' },
  { id: 'luxury_craft', label: 'Luxury Manufacture', icon: '💎', costMult: 1.9, capacity: 60_000, defectRate: 0.008, sustainability: 60, perception: 9, unlockTech: 'luxury_craftwork', blurb: 'Atelier-grade finishing for premium lines.' },
];

export const MANUFACTURING_BY_ID: Record<string, ManufacturingDef> =
  Object.fromEntries(MANUFACTURING_STRATEGIES.map((m) => [m.id, m]));

// --------------------------------------------------------------------------- packaging & launch

export const PACKAGING_STYLES: { id: PackagingStyle; label: string; icon: string; costPerUnit: number; appeal: number; sustainability: number }[] = [
  { id: 'minimal', label: 'Minimal', icon: '⬜', costPerUnit: 2, appeal: 6, sustainability: 70 },
  { id: 'premium', label: 'Premium Unboxing', icon: '🎁', costPerUnit: 9, appeal: 12, sustainability: 35 },
  { id: 'eco', label: 'Eco Paper', icon: '🌱', costPerUnit: 3, appeal: 5, sustainability: 100 },
  { id: 'playful', label: 'Playful', icon: '🎨', costPerUnit: 4, appeal: 8, sustainability: 50 },
  { id: 'industrial', label: 'Industrial', icon: '🗃️', costPerUnit: 1, appeal: 1, sustainability: 60 },
];

export const LAUNCH_VENUES: { id: LaunchVenue; label: string; icon: string; cost: number; hype: number; blurb: string }[] = [
  { id: 'livestream', label: 'Studio Livestream', icon: '📡', cost: 25_000, hype: 25, blurb: 'Lean, global, low-risk.' },
  { id: 'rooftop_party', label: 'Rooftop Launch Party', icon: '🥂', cost: 90_000, hype: 40, blurb: 'Influencers, skyline, press photos.' },
  { id: 'convention_keynote', label: 'Convention Keynote', icon: '🎤', cost: 250_000, hype: 60, blurb: 'The industry watches you walk the stage.' },
  { id: 'flagship_theater', label: 'Flagship Theater Event', icon: '🎬', cost: 700_000, hype: 85, blurb: 'A cinematic unveiling the whole world streams.' },
];

// --------------------------------------------------------------------------- concept generator grammar

export const CONCEPT_ADJECTIVES = ['Aero', 'Nova', 'Lumen', 'Pulse', 'Vertex', 'Halo', 'Ion', 'Terra', 'Onyx', 'Astra', 'Zephyr', 'Solace', 'Kite', 'Ember', 'Frost', 'Echo'];
export const CONCEPT_SUFFIXES = ['One', 'Pro', 'Air', 'Edge', 'Prime', 'S', 'X', 'Neo', 'Flow', 'Mini', 'Max', 'Studio'];
export const CONCEPT_TAGLINES = [
  'Designed for the way you live.',
  'Beautifully simple. Impossibly capable.',
  'The future, held in your hand.',
  'Crafted without compromise.',
  'Less object. More experience.',
  'Engineered to disappear into your life.',
  'Where craft meets courage.',
  'Quietly revolutionary.',
];
export const CONCEPT_PALETTES: { body: string; accent: string }[] = [
  { body: '#1c1e26', accent: '#e8b84a' },
  { body: '#e8e6e1', accent: '#2563eb' },
  { body: '#0f2a3d', accent: '#5eead4' },
  { body: '#3b2f2a', accent: '#d9a066' },
  { body: '#f4f1ec', accent: '#111827' },
  { body: '#25324a', accent: '#f472b6' },
  { body: '#e7ecef', accent: '#16a34a' },
  { body: '#101014', accent: '#ef4444' },
];
