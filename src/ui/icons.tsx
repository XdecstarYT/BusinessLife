/** Inline SVG icon set — no external assets, crisp at any size, themeable. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
});

export const IconLife = (p: P) => (
  <svg {...base(p)}><path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5 5.5 5 8 5 9.5 6.5 12 9c2.5-2.5 4-4 6.5-4C22 5 23.5 9 21.5 12.5 19 16.65 12 21 12 21Z" /></svg>
);
export const IconCareer = (p: P) => (
  <svg {...base(p)}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></svg>
);
export const IconBusiness = (p: P) => (
  <svg {...base(p)}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h.01M15 11h.01" /></svg>
);
export const IconMarket = (p: P) => (
  <svg {...base(p)}><path d="M3 17l6-6 4 4 8-8M21 7v4h-4" /></svg>
);
export const IconAssets = (p: P) => (
  <svg {...base(p)}><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></svg>
);
export const IconPolitics = (p: P) => (
  <svg {...base(p)}><path d="M4 21h16M6 21V10M18 21V10M4 10h16L12 3 4 10ZM10 21v-7h4v7" /></svg>
);
export const IconWorld = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" /></svg>
);
export const IconNews = (p: P) => (
  <svg {...base(p)}><path d="M4 5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5ZM18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h5" /></svg>
);
export const IconStats = (p: P) => (
  <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconSun = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconMoon = (p: P) => (
  <svg {...base(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
);
export const IconMenu = (p: P) => (
  <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
export const IconHeart = (p: P) => (
  <svg {...base(p)}><path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5 5.5 5 8 5 9.5 6.5 12 9c2.5-2.5 4-4 6.5-4C22 5 23.5 9 21.5 12.5 19 16.65 12 21 12 21Z" /></svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconArrowRight = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconTrophy = (p: P) => (
  <svg {...base(p)}><path d="M6 4h12v4a6 6 0 0 1-12 0V4ZM6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M9 18h6M8 22h8M12 17v3" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconBrain = (p: P) => (
  <svg {...base(p)}><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 5 3 3 0 0 0 5 1V4a2 2 0 0 0-3-1ZM15 3a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 5 3 3 0 0 1-5 1" /></svg>
);
export const IconSpark = (p: P) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>
);
export const IconScale = (p: P) => (
  <svg {...base(p)}><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7ZM19 7l-3 6a3 3 0 0 0 6 0l-3-6Z" /></svg>
);

export const SCREEN_ICON = {
  life: IconLife,
  career: IconCareer,
  business: IconBusiness,
  market: IconMarket,
  assets: IconAssets,
  politics: IconPolitics,
  world: IconWorld,
  news: IconNews,
  stats: IconStats,
} as const;
