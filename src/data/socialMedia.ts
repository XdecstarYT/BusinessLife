/** Social-media post styles: the tradeoff between reach and backlash risk. */
export interface PostStyle {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  viralityBase: number; // 0..1, baseline chance of a big hit
  backlashRisk: number; // 0..1, baseline chance of a real backlash if it doesn't land well
  reputationSwing: number; // multiplier on reputation/popularity effects, positive or negative
}

export const POST_STYLES: PostStyle[] = [
  { id: 'humor', label: 'Humor', icon: '😂', blurb: 'Low-risk, broadly likable — rarely a hit, rarely a disaster.', viralityBase: 0.16, backlashRisk: 0.04, reputationSwing: 0.6 },
  { id: 'promo', label: 'Promo', icon: '📣', blurb: "Plug your work or brand — safe, but people scroll past it.", viralityBase: 0.1, backlashRisk: 0.03, reputationSwing: 0.5 },
  { id: 'inspirational', label: 'Inspirational', icon: '✨', blurb: 'Earnest and warm — modest reach, almost no backlash risk.', viralityBase: 0.13, backlashRisk: 0.02, reputationSwing: 0.7 },
  { id: 'political', label: 'Political Take', icon: '🗳️', blurb: 'Strong reach if it resonates, but it will alienate someone.', viralityBase: 0.22, backlashRisk: 0.16, reputationSwing: 1.1 },
  { id: 'controversial', label: 'Controversial', icon: '🔥', blurb: 'The highest possible reach — and the highest chance it blows up in your face.', viralityBase: 0.32, backlashRisk: 0.3, reputationSwing: 1.6 },
];

export const POST_STYLE_BY_ID: Record<string, PostStyle> = Object.fromEntries(POST_STYLES.map((s) => [s.id, s]));
