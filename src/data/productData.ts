/**
 * The Studio's data catalogue: product categories, engineering materials, the
 * product R&D tree, manufacturing strategies, packaging, launch venues, and the
 * grammar the in-game AI concept generator draws from. All gameplay-relevant
 * numbers live here so new industries/materials/tech are pure data additions.
 */
import type {
  ComponentTier, CustomerSegment, LaunchVenue, ManufacturingStrategy, PackagingStyle,
  ProductCategory, ProductMaterialId,
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
  { id: 'drone', label: 'Drone', icon: '🛸', archetype: 'device', baseUnitCost: 180, basePrice: 620, marketUnits: 250_000, techAffinity: 0.95, luxuryAffinity: 0.25 },
  { id: 'camera', label: 'Camera', icon: '📷', archetype: 'device', baseUnitCost: 380, basePrice: 1_250, marketUnits: 180_000, techAffinity: 0.85, luxuryAffinity: 0.6 },
  { id: 'tv', label: 'Television', icon: '📺', archetype: 'slab', baseUnitCost: 400, basePrice: 1_100, marketUnits: 500_000, techAffinity: 0.8, luxuryAffinity: 0.4 },
  { id: 'bicycle', label: 'Bicycle', icon: '🚲', archetype: 'device', baseUnitCost: 220, basePrice: 850, marketUnits: 350_000, techAffinity: 0.4, luxuryAffinity: 0.5 },
  { id: 'eyewear', label: 'Eyewear', icon: '🕶️', archetype: 'device', baseUnitCost: 30, basePrice: 190, marketUnits: 900_000, techAffinity: 0.2, luxuryAffinity: 0.85 },
  { id: 'instrument', label: 'Musical Instrument', icon: '🎸', archetype: 'device', baseUnitCost: 240, basePrice: 950, marketUnits: 120_000, techAffinity: 0.25, luxuryAffinity: 0.7 },
  { id: 'kitchenware', label: 'Kitchenware', icon: '🫖', archetype: 'vessel', baseUnitCost: 25, basePrice: 95, marketUnits: 1_500_000, techAffinity: 0.3, luxuryAffinity: 0.45 },
  { id: 'powertool', label: 'Power Tools', icon: '🔧', archetype: 'device', baseUnitCost: 60, basePrice: 220, marketUnits: 600_000, techAffinity: 0.55, luxuryAffinity: 0.1 },
  { id: 'pet_tech', label: 'Pet Tech & Accessories', icon: '🐾', archetype: 'device', baseUnitCost: 25, basePrice: 90, marketUnits: 700_000, techAffinity: 0.6, luxuryAffinity: 0.3 },
  { id: 'baby_gear', label: 'Baby & Kids Gear', icon: '🍼', archetype: 'seat', baseUnitCost: 60, basePrice: 220, marketUnits: 500_000, techAffinity: 0.25, luxuryAffinity: 0.5 },
  { id: 'outdoor_gear', label: 'Outdoor & Camping Gear', icon: '🏕️', archetype: 'device', baseUnitCost: 35, basePrice: 140, marketUnits: 600_000, techAffinity: 0.3, luxuryAffinity: 0.25 },
  { id: 'stationery', label: 'Office & Stationery', icon: '✏️', archetype: 'slab', baseUnitCost: 4, basePrice: 18, marketUnits: 3_000_000, techAffinity: 0.1, luxuryAffinity: 0.35 },
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

// --------------------------------------------------------------------------- customizable parts

export interface ProductPartDef {
  id: string;
  label: string;
  /** Which default material bucket the part uses when not overridden. */
  base: 'body' | 'accent';
}

/** Every named piece of every category's 3D model — each is individually customizable. */
export const PRODUCT_PARTS: Record<ProductCategory, ProductPartDef[]> = {
  smartphone: [
    { id: 'body', label: 'Body', base: 'body' }, { id: 'screen', label: 'Screen', base: 'accent' },
    { id: 'camera', label: 'Camera Island', base: 'accent' }, { id: 'buttons', label: 'Buttons', base: 'accent' },
    { id: 'logo', label: 'Logo', base: 'accent' },
  ],
  tablet: [
    { id: 'body', label: 'Body', base: 'body' }, { id: 'screen', label: 'Screen', base: 'accent' },
    { id: 'camera', label: 'Camera', base: 'accent' }, { id: 'buttons', label: 'Buttons', base: 'accent' },
    { id: 'logo', label: 'Logo', base: 'accent' },
  ],
  laptop: [
    { id: 'chassis', label: 'Chassis', base: 'body' }, { id: 'keyboard', label: 'Keyboard Deck', base: 'body' },
    { id: 'display', label: 'Display', base: 'accent' }, { id: 'hinge', label: 'Hinge', base: 'accent' },
    { id: 'logo', label: 'Lid Logo', base: 'accent' },
  ],
  wearable: [
    { id: 'case', label: 'Case', base: 'body' }, { id: 'face', label: 'Watch Face', base: 'accent' },
    { id: 'crown', label: 'Crown & Buttons', base: 'accent' }, { id: 'strap', label: 'Strap', base: 'accent' },
  ],
  audio: [
    { id: 'headband', label: 'Headband', base: 'body' }, { id: 'cups', label: 'Ear Cups', base: 'body' },
    { id: 'cushions', label: 'Cushions', base: 'accent' }, { id: 'yokes', label: 'Yokes', base: 'accent' },
  ],
  jewelry: [
    { id: 'band', label: 'Band', base: 'body' }, { id: 'gem', label: 'Gemstone', base: 'accent' },
    { id: 'setting', label: 'Setting', base: 'accent' },
  ],
  gaming: [
    { id: 'shell', label: 'Shell', base: 'body' }, { id: 'lightstrip', label: 'Light Strip', base: 'accent' },
    { id: 'vents', label: 'Vents', base: 'accent' }, { id: 'stand', label: 'Stand', base: 'accent' },
  ],
  smart_home: [
    { id: 'wrap', label: 'Speaker Wrap', base: 'body' }, { id: 'top', label: 'Top Plate', base: 'accent' },
    { id: 'led', label: 'Light Ring', base: 'accent' },
  ],
  appliance: [
    { id: 'shell', label: 'Housing', base: 'body' }, { id: 'head', label: 'Brew Head', base: 'accent' },
    { id: 'tray', label: 'Drip Tray', base: 'accent' }, { id: 'dial', label: 'Dial', base: 'accent' },
  ],
  furniture: [
    { id: 'cushion', label: 'Seat Cushion', base: 'body' }, { id: 'backrest', label: 'Backrest', base: 'body' },
    { id: 'pillow', label: 'Lumbar Pillow', base: 'accent' }, { id: 'legs', label: 'Legs', base: 'accent' },
  ],
  fashion: [
    { id: 'garment', label: 'Garment', base: 'body' }, { id: 'collar', label: 'Collar', base: 'accent' },
    { id: 'buttons', label: 'Buttons', base: 'accent' },
  ],
  shoes: [
    { id: 'sole', label: 'Sole', base: 'accent' }, { id: 'upper', label: 'Upper', base: 'body' },
    { id: 'laces', label: 'Laces', base: 'accent' }, { id: 'stripe', label: 'Side Stripe', base: 'accent' },
  ],
  sports: [
    { id: 'sole', label: 'Sole', base: 'accent' }, { id: 'upper', label: 'Body', base: 'body' },
    { id: 'laces', label: 'Straps', base: 'accent' }, { id: 'stripe', label: 'Stripe', base: 'accent' },
  ],
  cosmetics: [
    { id: 'flacon', label: 'Flacon', base: 'body' }, { id: 'liquid', label: 'Liquid', base: 'accent' },
    { id: 'cap', label: 'Cap', base: 'accent' },
  ],
  automotive: [
    { id: 'paint', label: 'Body Paint', base: 'body' }, { id: 'glass', label: 'Glass', base: 'accent' },
    { id: 'rims', label: 'Rims', base: 'accent' }, { id: 'tires', label: 'Tires', base: 'accent' },
    { id: 'lights', label: 'Lights', base: 'accent' }, { id: 'grille', label: 'Grille', base: 'accent' },
  ],
  food_beverage: [
    { id: 'vessel', label: 'Bottle', base: 'body' }, { id: 'label', label: 'Label', base: 'accent' },
    { id: 'cap', label: 'Cap', base: 'accent' },
  ],
  medical: [
    { id: 'shell', label: 'Housing', base: 'body' }, { id: 'screen', label: 'Display', base: 'accent' },
    { id: 'buttons', label: 'Controls', base: 'accent' }, { id: 'handle', label: 'Handle', base: 'accent' },
  ],
  industrial: [
    { id: 'base', label: 'Base Plate', base: 'body' }, { id: 'arm', label: 'Arm Segments', base: 'body' },
    { id: 'joints', label: 'Joints', base: 'accent' }, { id: 'claw', label: 'Gripper', base: 'accent' },
  ],
  toys: [
    { id: 'body', label: 'Body', base: 'body' }, { id: 'eyes', label: 'Eyes', base: 'accent' },
    { id: 'limbs', label: 'Arms & Feet', base: 'accent' }, { id: 'antenna', label: 'Antenna', base: 'accent' },
  ],
  luxury: [
    { id: 'body', label: 'Bag Body', base: 'body' }, { id: 'flap', label: 'Flap', base: 'body' },
    { id: 'hardware', label: 'Hardware', base: 'accent' }, { id: 'handle', label: 'Handle', base: 'accent' },
  ],
  drone: [
    { id: 'frame', label: 'Frame', base: 'body' }, { id: 'rotors', label: 'Rotors', base: 'accent' },
    { id: 'gimbal', label: 'Camera Gimbal', base: 'accent' }, { id: 'led', label: 'Nav Lights', base: 'accent' },
  ],
  camera: [
    { id: 'body', label: 'Body', base: 'body' }, { id: 'lens', label: 'Lens', base: 'accent' },
    { id: 'grip', label: 'Grip', base: 'accent' }, { id: 'dials', label: 'Dials', base: 'accent' },
  ],
  tv: [
    { id: 'panel', label: 'Panel', base: 'accent' }, { id: 'bezel', label: 'Bezel', base: 'body' },
    { id: 'stand', label: 'Stand', base: 'accent' }, { id: 'speaker', label: 'Soundbar', base: 'accent' },
  ],
  bicycle: [
    { id: 'frame', label: 'Frame', base: 'body' }, { id: 'wheels', label: 'Wheels', base: 'accent' },
    { id: 'saddle', label: 'Saddle', base: 'accent' }, { id: 'handlebar', label: 'Handlebar', base: 'accent' },
  ],
  eyewear: [
    { id: 'frame', label: 'Frame', base: 'body' }, { id: 'lenses', label: 'Lenses', base: 'accent' },
    { id: 'temples', label: 'Temples', base: 'body' }, { id: 'hinges', label: 'Hinges', base: 'accent' },
  ],
  instrument: [
    { id: 'body', label: 'Body', base: 'body' }, { id: 'neck', label: 'Neck', base: 'accent' },
    { id: 'pickguard', label: 'Pickguard', base: 'accent' }, { id: 'hardware', label: 'Hardware', base: 'accent' },
  ],
  kitchenware: [
    { id: 'body', label: 'Body', base: 'body' }, { id: 'handle', label: 'Handle', base: 'accent' },
    { id: 'lid', label: 'Lid', base: 'accent' }, { id: 'spout', label: 'Spout', base: 'body' },
  ],
  powertool: [
    { id: 'body', label: 'Body', base: 'body' }, { id: 'chuck', label: 'Chuck', base: 'accent' },
    { id: 'grip', label: 'Grip', base: 'accent' }, { id: 'battery', label: 'Battery Pack', base: 'accent' },
  ],
  pet_tech: [
    { id: 'body', label: 'Body', base: 'body' }, { id: 'collar', label: 'Collar', base: 'accent' },
    { id: 'tag', label: 'Tag', base: 'accent' }, { id: 'light', label: 'Status Light', base: 'accent' },
  ],
  baby_gear: [
    { id: 'frame', label: 'Frame', base: 'body' }, { id: 'seat', label: 'Seat Pad', base: 'body' },
    { id: 'canopy', label: 'Canopy', base: 'accent' }, { id: 'wheels', label: 'Wheels', base: 'accent' },
  ],
  outdoor_gear: [
    { id: 'shell', label: 'Shell', base: 'body' }, { id: 'straps', label: 'Straps', base: 'accent' },
    { id: 'buckles', label: 'Buckles', base: 'accent' }, { id: 'zipper', label: 'Zipper', base: 'accent' },
  ],
  stationery: [
    { id: 'cover', label: 'Cover', base: 'body' }, { id: 'pages', label: 'Pages', base: 'accent' },
    { id: 'binding', label: 'Binding', base: 'accent' }, { id: 'clip', label: 'Clip', base: 'accent' },
  ],
};

// --------------------------------------------------------------------------- colorways

/** One-tap curated palettes; applying one also clears per-part color overrides. */
export const COLORWAYS: { id: string; label: string; body: string; accent: string }[] = [
  { id: 'midnight', label: 'Midnight', body: '#16181f', accent: '#8ab4ff' },
  { id: 'porcelain', label: 'Porcelain', body: '#f2efe9', accent: '#1f2937' },
  { id: 'ember', label: 'Ember', body: '#2a1416', accent: '#ff6a3d' },
  { id: 'sage', label: 'Sage', body: '#dfe7dc', accent: '#3f6b4f' },
  { id: 'royal', label: 'Royal', body: '#1d2a5a', accent: '#e8b84a' },
  { id: 'blush', label: 'Blush', body: '#f6e3e0', accent: '#b4485e' },
  { id: 'graphite', label: 'Graphite', body: '#3a3f47', accent: '#d4d8de' },
  { id: 'aurora', label: 'Aurora', body: '#101c2c', accent: '#5eead4' },
];

/** Curated swatches offered in the part color picker (plus a free color input). */
export const PART_SWATCHES = [
  '#16181f', '#3a3f47', '#f2efe9', '#e8e6e1', '#1d2a5a', '#0f2a3d', '#2a1416', '#3b2f2a',
  '#8ab4ff', '#5eead4', '#3f6b4f', '#e8b84a', '#ff6a3d', '#b4485e', '#f472b6', '#ef4444',
];

// --------------------------------------------------------------------------- component supply chain

export interface ComponentDef { id: string; label: string; icon: string }

export const COMPONENT_DEFS: ComponentDef[] = [
  { id: 'chip', label: 'Processor', icon: '🧠' },
  { id: 'display_panel', label: 'Display Panel', icon: '🖥️' },
  { id: 'battery', label: 'Battery Cells', icon: '🔋' },
  { id: 'sensor', label: 'Sensor Suite', icon: '📡' },
  { id: 'motor', label: 'Motor & Drive', icon: '⚙️' },
  { id: 'drivers', label: 'Audio Drivers', icon: '🔊' },
  { id: 'optics', label: 'Optics', icon: '🔭' },
  { id: 'frame_parts', label: 'Frame & Structure', icon: '🩻' },
  { id: 'hardware_kit', label: 'Hardware & Trims', icon: '🔩' },
  { id: 'materials_stock', label: 'Raw Materials', icon: '📦' },
];

export const COMPONENT_BY_ID: Record<string, ComponentDef> =
  Object.fromEntries(COMPONENT_DEFS.map((c) => [c.id, c]));

/** Bill-of-materials slots per category; each slot is sourced at a chosen tier. */
export const PRODUCT_COMPONENTS: Record<ProductCategory, string[]> = {
  smartphone: ['chip', 'display_panel', 'battery'],
  laptop: ['chip', 'display_panel', 'battery'],
  tablet: ['chip', 'display_panel', 'battery'],
  wearable: ['chip', 'sensor', 'battery'],
  gaming: ['chip', 'frame_parts', 'hardware_kit'],
  audio: ['drivers', 'chip', 'battery'],
  appliance: ['motor', 'frame_parts', 'hardware_kit'],
  smart_home: ['chip', 'drivers', 'sensor'],
  furniture: ['frame_parts', 'materials_stock', 'hardware_kit'],
  fashion: ['materials_stock', 'hardware_kit'],
  shoes: ['materials_stock', 'frame_parts', 'hardware_kit'],
  jewelry: ['materials_stock', 'hardware_kit'],
  cosmetics: ['materials_stock', 'hardware_kit'],
  automotive: ['motor', 'battery', 'frame_parts', 'hardware_kit'],
  food_beverage: ['materials_stock', 'hardware_kit'],
  medical: ['chip', 'sensor', 'display_panel'],
  industrial: ['motor', 'frame_parts', 'chip'],
  toys: ['materials_stock', 'motor', 'hardware_kit'],
  sports: ['materials_stock', 'frame_parts'],
  luxury: ['materials_stock', 'hardware_kit'],
  drone: ['motor', 'battery', 'optics', 'chip'],
  camera: ['optics', 'sensor', 'chip'],
  tv: ['display_panel', 'chip', 'drivers'],
  bicycle: ['frame_parts', 'hardware_kit', 'materials_stock'],
  eyewear: ['optics', 'frame_parts'],
  instrument: ['materials_stock', 'hardware_kit'],
  kitchenware: ['materials_stock', 'frame_parts'],
  powertool: ['motor', 'battery', 'frame_parts'],
  pet_tech: ['sensor', 'battery', 'hardware_kit'],
  baby_gear: ['frame_parts', 'materials_stock', 'hardware_kit'],
  outdoor_gear: ['materials_stock', 'frame_parts', 'hardware_kit'],
  stationery: ['materials_stock', 'hardware_kit'],
};

export const COMPONENT_TIERS: Record<ComponentTier, { label: string; costMult: number; quality: number; defectMod: number; luxury: number }> = {
  budget: { label: 'Budget', costMult: 0.72, quality: -8, defectMod: 0.018, luxury: -6 },
  standard: { label: 'Standard', costMult: 1.0, quality: 0, defectMod: 0, luxury: 0 },
  premium: { label: 'Premium', costMult: 1.5, quality: 9, defectMod: -0.012, luxury: 8 },
};

/** Suggested naming prefixes for player-engineered parts (Bat62, Core9, Vue X1…). */
export const PART_NAME_PREFIX: Record<string, string> = {
  chip: 'Core', display_panel: 'Vue', battery: 'Bat', sensor: 'Sense', motor: 'Torq',
  drivers: 'Wave', optics: 'Lux', frame_parts: 'Frame', hardware_kit: 'Kit', materials_stock: 'Mat',
};

/** The global component market: annual external demand and average unit price per type.
 * Player-engineered parts listed for sale compete here for OEM contracts. */
export const COMPONENT_MARKET: Record<string, { units: number; price: number }> = {
  chip: { units: 2_500_000, price: 55 },
  display_panel: { units: 1_800_000, price: 60 },
  battery: { units: 3_000_000, price: 18 },
  sensor: { units: 1_500_000, price: 22 },
  motor: { units: 900_000, price: 80 },
  drivers: { units: 1_200_000, price: 12 },
  optics: { units: 500_000, price: 95 },
  frame_parts: { units: 800_000, price: 30 },
  hardware_kit: { units: 2_000_000, price: 8 },
  materials_stock: { units: 4_000_000, price: 5 },
};

/** Field-defect flavor names surfaced by the warranty/recall system. */
export const DEFECT_NAMES = [
  'battery swelling reports', 'hinge fatigue failures', 'display flicker batch', 'overheating under load',
  'coating peeling in sunlight', 'intermittent power fault', 'stress cracks near mounts', 'moisture ingress complaints',
];

// --------------------------------------------------------------------------- customer segments

export interface SegmentDef {
  id: CustomerSegment;
  label: string;
  icon: string;
  share: number; // slice of the addressable market
  priceSensitivity: number; // 0..1 — punishes price above category anchor
  lovesTech: number; // 0..1 weights on product qualities
  lovesLuxury: number;
  lovesEco: number;
  lovesReliability: number;
  blurb: string;
}

export const CUSTOMER_SEGMENTS: SegmentDef[] = [
  { id: 'value', label: 'Value Seekers', icon: '🏷️', share: 0.30, priceSensitivity: 1.0, lovesTech: 0.2, lovesLuxury: 0.05, lovesEco: 0.2, lovesReliability: 0.5, blurb: 'Price first. Deals, durability, no frills.' },
  { id: 'families', label: 'Families', icon: '👨‍👩‍👧', share: 0.25, priceSensitivity: 0.75, lovesTech: 0.3, lovesLuxury: 0.15, lovesEco: 0.35, lovesReliability: 1.0, blurb: 'Reliability and safety beat everything.' },
  { id: 'early_adopters', label: 'Early Adopters', icon: '🚀', share: 0.18, priceSensitivity: 0.25, lovesTech: 1.0, lovesLuxury: 0.35, lovesEco: 0.3, lovesReliability: 0.3, blurb: 'First in line for anything genuinely new.' },
  { id: 'eco', label: 'Eco-Conscious', icon: '🌿', share: 0.15, priceSensitivity: 0.5, lovesTech: 0.35, lovesLuxury: 0.2, lovesEco: 1.0, lovesReliability: 0.4, blurb: 'Materials, footprint and repairability matter.' },
  { id: 'luxury_buyers', label: 'Luxury Buyers', icon: '💎', share: 0.12, priceSensitivity: 0.05, lovesTech: 0.3, lovesLuxury: 1.0, lovesEco: 0.2, lovesReliability: 0.4, blurb: 'Craft, exclusivity and story. Price is a feature.' },
];

export const SEGMENT_BY_ID: Record<string, SegmentDef> =
  Object.fromEntries(CUSTOMER_SEGMENTS.map((s) => [s.id, s]));

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
