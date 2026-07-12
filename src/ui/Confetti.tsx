/** A short, self-contained confetti burst: a fixed full-viewport overlay of small colored
 * pieces that fall/rotate/fade once, then unmount themselves. Mount fresh (e.g. keyed by an
 * incrementing id) to replay — used for achievement unlocks and big year-end wins. */
import { useEffect, useState } from 'react';

const COLORS = ['#5150d6', '#fbbf24', '#f472b6', '#60a5fa', '#f87171', '#a78bfa', '#34d399'];

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.05,
  duration: 1.1 + (i % 5) * 0.15,
  rotate: (i * 53) % 360,
  color: COLORS[i % COLORS.length],
  size: 6 + (i % 3) * 3,
}));

export function Confetti({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone?.(); }, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[80] pointer-events-none overflow-hidden" aria-hidden>
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-sm anim-confetti"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
