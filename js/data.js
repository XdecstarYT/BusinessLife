/* ============================================================
   BusinessLife — GAME DATA
   Static content: industries, careers, education, assets,
   names, countries, skills. Kept on window.DATA.
   ============================================================ */
window.DATA = (function () {

  /* ---------- Countries (affects starting cash, cost of living, tax) ---------- */
  const COUNTRIES = [
    { id: 'us', name: 'United States', flag: '🇺🇸', currency: '$', startMul: 1.0, tax: 0.24, col: 1.0 },
    { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', currency: '£', startMul: 0.95, tax: 0.28, col: 1.05 },
    { id: 'de', name: 'Germany', flag: '🇩🇪', currency: '€', startMul: 0.9, tax: 0.30, col: 0.95 },
    { id: 'in', name: 'India', flag: '🇮🇳', currency: '₹', startMul: 0.4, tax: 0.18, col: 0.45 },
    { id: 'jp', name: 'Japan', flag: '🇯🇵', currency: '¥', startMul: 0.85, tax: 0.26, col: 1.1 },
    { id: 'br', name: 'Brazil', flag: '🇧🇷', currency: 'R$', startMul: 0.5, tax: 0.22, col: 0.6 },
    { id: 'ng', name: 'Nigeria', flag: '🇳🇬', currency: '₦', startMul: 0.35, tax: 0.15, col: 0.4 },
    { id: 'ae', name: 'UAE', flag: '🇦🇪', currency: 'AED', startMul: 1.1, tax: 0.0, col: 1.15 },
    { id: 'sg', name: 'Singapore', flag: '🇸🇬', currency: 'S$', startMul: 1.05, tax: 0.17, col: 1.2 },
    { id: 'au', name: 'Australia', flag: '🇦🇺', currency: 'A$', startMul: 0.95, tax: 0.29, col: 1.05 },
  ];

  /* ---------- First / last names ---------- */
  const FIRST_M = ['James','Liam','Noah','Ethan','Marcus','Andre','Kenji','Rahul','Diego','Chen','Omar','Lucas','Felix','Ivan','Malik','Sebastian','Hugo','Theo','Aarav','Dmitri'];
  const FIRST_F = ['Ava','Mia','Sofia','Elena','Zara','Priya','Chloe','Nina','Amara','Yuki','Layla','Isabel','Freya','Anya','Maya','Lena','Aisha','Camila','Ingrid','Nora'];
  const LAST = ['Vance','Kane','Sterling','Okoye','Novak','Reyes','Sharma','Tanaka','Moreau','Bianchi','Hassan','Larsson','Cohen','Petrov','Adeyemi','Fischer','Rossi','Nakamura','Costa','Blackwood','Ashford','Vega','Sinclair','Delacroix'];

  /* ---------- Education stages ---------- */
  const EDUCATION = [
    { id: 'hs', name: 'High School', years: 4, cost: 0, req: null, boost: { intelligence: 4 }, degree: false },
    { id: 'community', name: 'Community College', years: 2, cost: 12000, req: 'hs', boost: { intelligence: 6, finance: 3 }, degree: 'Associate' },
    { id: 'bachelor', name: 'Bachelor of Business', years: 4, cost: 60000, req: 'hs', boost: { intelligence: 10, finance: 8, marketing: 6, operations: 5 }, degree: 'BBA' },
    { id: 'engineering', name: 'Engineering Degree', years: 4, cost: 72000, req: 'hs', boost: { intelligence: 14, tech: 12, operations: 6 }, degree: 'BEng' },
    { id: 'mba', name: 'MBA', years: 2, cost: 140000, req: 'bachelor', boost: { finance: 14, leadership: 14, negotiation: 10, marketing: 8 }, degree: 'MBA' },
    { id: 'phd', name: 'PhD', years: 4, cost: 40000, req: 'bachelor', boost: { intelligence: 18, tech: 8 }, degree: 'PhD' },
  ];

  /* ---------- Corporate career ladder (pre-entrepreneur income) ---------- */
  const JOBS = [
    { id: 'barista', title: 'Barista', field: 'Service', pay: 26000, reqEdu: null, reqSkill: 0, minAge: 16, skill: 'operations', promo: 'shift_lead' },
    { id: 'shift_lead', title: 'Shift Lead', field: 'Service', pay: 34000, reqEdu: null, reqSkill: 15, minAge: 18, skill: 'leadership', promo: 'store_mgr' },
    { id: 'store_mgr', title: 'Store Manager', field: 'Service', pay: 52000, reqEdu: null, reqSkill: 30, minAge: 20, skill: 'leadership', promo: null },

    { id: 'sales_rep', title: 'Sales Rep', field: 'Sales', pay: 42000, reqEdu: null, reqSkill: 0, minAge: 18, skill: 'negotiation', promo: 'account_exec' },
    { id: 'account_exec', title: 'Account Executive', field: 'Sales', pay: 68000, reqEdu: null, reqSkill: 25, minAge: 21, skill: 'negotiation', promo: 'sales_dir' },
    { id: 'sales_dir', title: 'Sales Director', field: 'Sales', pay: 120000, reqEdu: 'bachelor', reqSkill: 45, minAge: 26, skill: 'leadership', promo: 'vp_sales' },
    { id: 'vp_sales', title: 'VP of Sales', field: 'Sales', pay: 210000, reqEdu: 'bachelor', reqSkill: 60, minAge: 30, skill: 'leadership', promo: null },

    { id: 'analyst', title: 'Financial Analyst', field: 'Finance', pay: 72000, reqEdu: 'bachelor', reqSkill: 0, minAge: 21, skill: 'finance', promo: 'associate' },
    { id: 'associate', title: 'Associate', field: 'Finance', pay: 130000, reqEdu: 'bachelor', reqSkill: 30, minAge: 24, skill: 'finance', promo: 'vp_fin' },
    { id: 'vp_fin', title: 'VP, Investment Banking', field: 'Finance', pay: 320000, reqEdu: 'mba', reqSkill: 55, minAge: 29, skill: 'finance', promo: 'md' },
    { id: 'md', title: 'Managing Director', field: 'Finance', pay: 750000, reqEdu: 'mba', reqSkill: 75, minAge: 35, skill: 'negotiation', promo: null },

    { id: 'jr_dev', title: 'Junior Developer', field: 'Tech', pay: 78000, reqEdu: 'engineering', reqSkill: 0, minAge: 21, skill: 'tech', promo: 'sr_dev' },
    { id: 'sr_dev', title: 'Senior Engineer', field: 'Tech', pay: 155000, reqEdu: 'engineering', reqSkill: 30, minAge: 25, skill: 'tech', promo: 'eng_mgr' },
    { id: 'eng_mgr', title: 'Engineering Manager', field: 'Tech', pay: 240000, reqEdu: 'engineering', reqSkill: 50, minAge: 29, skill: 'leadership', promo: 'cto_corp' },
    { id: 'cto_corp', title: 'Chief Technology Officer', field: 'Tech', pay: 480000, reqEdu: 'engineering', reqSkill: 70, minAge: 34, skill: 'leadership', promo: null },

    { id: 'consultant', title: 'Management Consultant', field: 'Consulting', pay: 95000, reqEdu: 'bachelor', reqSkill: 0, minAge: 22, skill: 'operations', promo: 'engagement_mgr' },
    { id: 'engagement_mgr', title: 'Engagement Manager', field: 'Consulting', pay: 185000, reqEdu: 'mba', reqSkill: 40, minAge: 27, skill: 'leadership', promo: 'partner' },
    { id: 'partner', title: 'Partner', field: 'Consulting', pay: 620000, reqEdu: 'mba', reqSkill: 70, minAge: 33, skill: 'negotiation', promo: null },
  ];

  /* ---------- Industries you can found a business in ---------- */
  /* margin = base profit margin; volatility affects revenue swings;
     capital = recommended starting capital; scale = revenue ceiling factor */
  const INDUSTRIES = [
    { id: 'coffee', name: 'Coffee Shop', emoji: '☕', cat: 'Food & Bev', capital: 45000, margin: 0.14, volatility: 0.18, scale: 1, growth: 1.0, keySkill: 'operations',
      desc: 'A cozy local cafe. Low barrier, steady footfall, thin margins.', img: 'coffee' },
    { id: 'restaurant', name: 'Restaurant', emoji: '🍽️', cat: 'Food & Bev', capital: 180000, margin: 0.11, volatility: 0.30, scale: 2, growth: 1.1, keySkill: 'operations',
      desc: 'Full-service dining. High risk, prestige, and spoilage.', img: 'restaurant' },
    { id: 'ecommerce', name: 'E-Commerce Brand', emoji: '📦', cat: 'Retail', capital: 30000, margin: 0.22, volatility: 0.28, scale: 4, growth: 1.35, keySkill: 'marketing',
      desc: 'Direct-to-consumer online store. Scales with ad spend.', img: 'ecommerce' },
    { id: 'saas', name: 'SaaS Startup', emoji: '💻', cat: 'Technology', capital: 120000, margin: 0.35, volatility: 0.4, scale: 9, growth: 1.7, keySkill: 'tech',
      desc: 'Recurring-revenue software. High margins, VC catnip.', img: 'saas' },
    { id: 'app', name: 'Mobile App', emoji: '📱', cat: 'Technology', capital: 60000, margin: 0.30, volatility: 0.5, scale: 7, growth: 1.6, keySkill: 'tech',
      desc: 'Consumer app monetized by ads & subscriptions. Hit-driven.', img: 'app' },
    { id: 'agency', name: 'Marketing Agency', emoji: '📣', cat: 'Services', capital: 25000, margin: 0.28, volatility: 0.22, scale: 3, growth: 1.25, keySkill: 'marketing',
      desc: 'Sell creative & ad services to other businesses.', img: 'agency' },
    { id: 'realestate', name: 'Real Estate Firm', emoji: '🏢', cat: 'Real Estate', capital: 250000, margin: 0.18, volatility: 0.25, scale: 6, growth: 1.2, keySkill: 'negotiation',
      desc: 'Buy, develop, and flip property. Capital-heavy, cyclical.', img: 'realestate' },
    { id: 'fashion', name: 'Fashion Label', emoji: '👗', cat: 'Retail', capital: 90000, margin: 0.24, volatility: 0.35, scale: 5, growth: 1.4, keySkill: 'marketing',
      desc: 'Design & sell apparel. Brand is everything, trends brutal.', img: 'fashion' },
    { id: 'fintech', name: 'Fintech', emoji: '🏦', cat: 'Technology', capital: 200000, margin: 0.32, volatility: 0.45, scale: 10, growth: 1.8, keySkill: 'finance',
      desc: 'Payments, lending, or trading. Regulation heavy, huge upside.', img: 'fintech' },
    { id: 'manufacturing', name: 'Manufacturing', emoji: '🏭', cat: 'Industrial', capital: 400000, margin: 0.13, volatility: 0.2, scale: 8, growth: 1.15, keySkill: 'operations',
      desc: 'Build physical goods at scale. Slow, durable, moaty.', img: 'manufacturing' },
    { id: 'gaming', name: 'Game Studio', emoji: '🎮', cat: 'Media', capital: 150000, margin: 0.4, volatility: 0.6, scale: 9, growth: 1.65, keySkill: 'tech',
      desc: 'Develop video games. Feast or famine, massive hits possible.', img: 'gaming' },
    { id: 'biotech', name: 'Biotech Lab', emoji: '🧬', cat: 'Science', capital: 600000, margin: 0.45, volatility: 0.7, scale: 12, growth: 2.0, keySkill: 'intelligence',
      desc: 'Long R&D cycles, binary outcomes, life-changing payoffs.', img: 'biotech' },
    { id: 'logistics', name: 'Logistics & Delivery', emoji: '🚚', cat: 'Industrial', capital: 220000, margin: 0.1, volatility: 0.22, scale: 7, growth: 1.3, keySkill: 'operations',
      desc: 'Move goods for others. Thin margins, relentless scale.', img: 'logistics' },
    { id: 'crypto', name: 'Crypto Exchange', emoji: '⛓️', cat: 'Technology', capital: 300000, margin: 0.5, volatility: 0.9, scale: 11, growth: 2.2, keySkill: 'finance',
      desc: 'Wild volatility, regulatory risk, and generational wealth.', img: 'crypto' },
    { id: 'fitness', name: 'Fitness Studio', emoji: '💪', cat: 'Services', capital: 80000, margin: 0.2, volatility: 0.2, scale: 3, growth: 1.2, keySkill: 'leadership',
      desc: 'Memberships & classes. Community-driven, churn-sensitive.', img: 'fitness' },
    { id: 'media', name: 'Media / Content', emoji: '🎬', cat: 'Media', capital: 40000, margin: 0.3, volatility: 0.55, scale: 6, growth: 1.5, keySkill: 'marketing',
      desc: 'Build an audience, monetize attention. Algorithm-dependent.', img: 'media' },
  ];

  /* ---------- Employee roles you can hire ---------- */
  const ROLES = [
    { id: 'associate', title: 'Associate', salary: 45000, boosts: { output: 1.0 } },
    { id: 'manager', title: 'Manager', salary: 85000, boosts: { output: 1.4, morale: 0.1 } },
    { id: 'engineer', title: 'Engineer', salary: 130000, boosts: { quality: 0.12, output: 1.2 } },
    { id: 'marketer', title: 'Marketer', salary: 90000, boosts: { brand: 0.12, output: 1.1 } },
    { id: 'salesperson', title: 'Salesperson', salary: 75000, boosts: { revenue: 0.15 } },
    { id: 'operations', title: 'Ops Lead', salary: 95000, boosts: { efficiency: 0.12, output: 1.3 } },
    { id: 'executive', title: 'Executive (COO)', salary: 220000, boosts: { output: 1.8, morale: 0.15, efficiency: 0.1 } },
  ];

  /* ---------- Personal assets (lifestyle / net worth / happiness) ---------- */
  const ASSETS = {
    homes: [
      { id: 'apartment', name: 'City Apartment', emoji: '🏙️', price: 220000, happy: 6, upkeep: 1400, prestige: 1 },
      { id: 'townhouse', name: 'Townhouse', emoji: '🏘️', price: 480000, happy: 10, upkeep: 2600, prestige: 2 },
      { id: 'suburban', name: 'Suburban Home', emoji: '🏡', price: 750000, happy: 14, upkeep: 3800, prestige: 3 },
      { id: 'penthouse', name: 'Penthouse', emoji: '🌆', price: 2400000, happy: 22, upkeep: 9000, prestige: 5 },
      { id: 'mansion', name: 'Hillside Mansion', emoji: '🏰', price: 8500000, happy: 32, upkeep: 28000, prestige: 8 },
      { id: 'island', name: 'Private Island', emoji: '🏝️', price: 45000000, happy: 50, upkeep: 120000, prestige: 10 },
    ],
    cars: [
      { id: 'used', name: 'Used Sedan', emoji: '🚗', price: 12000, happy: 3, prestige: 1 },
      { id: 'ev', name: 'Electric SUV', emoji: '🚙', price: 62000, happy: 8, prestige: 3 },
      { id: 'sports', name: 'Sports Car', emoji: '🏎️', price: 180000, happy: 15, prestige: 5 },
      { id: 'super', name: 'Supercar', emoji: '🏁', price: 550000, happy: 24, prestige: 8 },
      { id: 'yacht', name: 'Superyacht', emoji: '🛥️', price: 22000000, happy: 40, prestige: 10 },
      { id: 'jet', name: 'Private Jet', emoji: '✈️', price: 65000000, happy: 55, prestige: 10 },
    ],
    luxury: [
      { id: 'watch', name: 'Luxury Watch', emoji: '⌚', price: 45000, happy: 6, prestige: 3 },
      { id: 'art', name: 'Fine Art', emoji: '🖼️', price: 320000, happy: 10, prestige: 6 },
      { id: 'wine', name: 'Wine Collection', emoji: '🍷', price: 90000, happy: 7, prestige: 4 },
      { id: 'jewelry', name: 'Fine Jewelry', emoji: '💎', price: 210000, happy: 9, prestige: 5 },
    ],
  };

  /* ---------- Investable stocks (simulated market) ---------- */
  const STOCKS = [
    { ticker: 'NOVA', name: 'Nova Semiconductors', price: 142, beta: 1.4, drift: 0.09, sector: 'Tech' },
    { ticker: 'ORBT', name: 'Orbital Aerospace', price: 88, beta: 1.7, drift: 0.11, sector: 'Aero' },
    { ticker: 'GRNL', name: 'GreenLeaf Energy', price: 34, beta: 1.1, drift: 0.07, sector: 'Energy' },
    { ticker: 'MDCX', name: 'MediCore Health', price: 210, beta: 0.7, drift: 0.05, sector: 'Health' },
    { ticker: 'RETL', name: 'Evermart Retail', price: 56, beta: 0.6, drift: 0.03, sector: 'Retail' },
    { ticker: 'FNTC', name: 'Fintech Global', price: 178, beta: 1.5, drift: 0.10, sector: 'Finance' },
    { ticker: 'AUTO', name: 'Voltaic Motors', price: 265, beta: 1.9, drift: 0.12, sector: 'Auto' },
    { ticker: 'FOOD', name: 'Harvest Foods', price: 41, beta: 0.5, drift: 0.02, sector: 'Consumer' },
  ];
  const CRYPTO = [
    { ticker: 'BTX', name: 'Bitcorn', price: 41000, beta: 3.2, drift: 0.15 },
    { ticker: 'ETR', name: 'Etheria', price: 2400, beta: 3.6, drift: 0.18 },
    { ticker: 'DOG', name: 'DogeMoon', price: 0.12, beta: 5.5, drift: 0.05 },
    { ticker: 'SOLR', name: 'SolarChain', price: 96, beta: 4.1, drift: 0.20 },
  ];

  /* ---------- Skills metadata ---------- */
  const SKILLS = [
    { id: 'leadership', name: 'Leadership', emoji: '👑' },
    { id: 'marketing', name: 'Marketing', emoji: '📣' },
    { id: 'finance', name: 'Finance', emoji: '💰' },
    { id: 'negotiation', name: 'Negotiation', emoji: '🤝' },
    { id: 'tech', name: 'Technical', emoji: '⚙️' },
    { id: 'operations', name: 'Operations', emoji: '📊' },
  ];

  /* ---------- Life activities (BitLife-style) ---------- */
  const ACTIVITIES = [
    { id: 'gym', name: 'Hit the Gym', emoji: '🏋️', cost: 50, effects: { health: 6, energy: -4, happiness: 2 }, desc: 'Sweat it out.' },
    { id: 'vacation', name: 'Take a Vacation', emoji: '🏖️', cost: 8000, effects: { happiness: 18, energy: 15, health: 4 }, desc: 'Recharge fully.' },
    { id: 'network', name: 'Networking Event', emoji: '🥂', cost: 400, effects: { happiness: 3, energy: -3 }, skill: 'negotiation', skillGain: 3, desc: 'Meet useful people.' },
    { id: 'course', name: 'Take a Course', emoji: '📚', cost: 1200, effects: { energy: -5, happiness: -1 }, skill: 'random', skillGain: 5, desc: 'Sharpen a skill.' },
    { id: 'therapy', name: 'Therapy Session', emoji: '🛋️', cost: 300, effects: { happiness: 10, energy: 4 }, desc: 'Mind over money.' },
    { id: 'party', name: 'Throw a Party', emoji: '🎉', cost: 5000, effects: { happiness: 12, energy: -6, health: -3 }, rep: 4, desc: 'Boost your reputation.' },
    { id: 'meditate', name: 'Meditate', emoji: '🧘', cost: 0, effects: { happiness: 5, energy: 8, health: 2 }, desc: 'Free and effective.' },
    { id: 'doctor', name: 'See a Doctor', emoji: '🩺', cost: 600, effects: { health: 12 }, desc: 'Fix what ails you.' },
    { id: 'charity', name: 'Donate to Charity', emoji: '❤️', cost: 25000, effects: { happiness: 10 }, rep: 8, desc: 'Give back, gain reputation.' },
    { id: 'read', name: 'Read Business Books', emoji: '📖', cost: 80, effects: { happiness: 2, energy: -2 }, skill: 'finance', skillGain: 2, desc: 'Learn from the greats.' },
  ];

  return {
    COUNTRIES, FIRST_M, FIRST_F, LAST, EDUCATION, JOBS, INDUSTRIES,
    ROLES, ASSETS, STOCKS, CRYPTO, SKILLS, ACTIVITIES,
  };
})();
