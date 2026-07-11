/**
 * Shared UI primitives styled after the reference: soft rounded surfaces,
 * pill chips, circular icon tiles, section headers with chevrons, stat bars,
 * and canvas sparkline/line charts. All theme-aware (light + dark).
 */
import { type ReactNode, useEffect, useRef } from 'react';
import { IconChevron } from './icons';
import { statBarColor } from './format';

// ---------------------------------------------------------------------------
export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl bg-white dark:bg-ink-850 border border-slate-100 dark:border-ink-800 [box-shadow:var(--shadow-lift)] ${
        onClick
          ? 'cursor-pointer transition-[transform,box-shadow] duration-200 hover:[box-shadow:var(--shadow-lift-lg)] hover:-translate-y-px active:scale-[0.985] active:translate-y-0'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Pill({
  label,
  active = false,
  disabled = false,
  onClick,
  tone = 'neutral',
}: {
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  tone?: 'neutral' | 'brand';
}) {
  const activeCls = tone === 'brand'
    ? 'bg-brand-500 text-white border-brand-500 [box-shadow:var(--shadow-glow-brand)]'
    : 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-ink-900 dark:border-white shadow-md';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? activeCls : 'bg-slate-100 text-slate-700 border-transparent dark:bg-ink-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-ink-700'
      }`}
    >
      {label}
    </button>
  );
}

export function PillRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">{children}</div>;
}

// ---------------------------------------------------------------------------
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-6 px-1">
      <h2 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        <span aria-hidden className="w-1 h-5 rounded-full bg-gradient-to-b from-brand-400 to-brand-600 shrink-0" />
        {title}
      </h2>
      {(action || onAction) && (
        <button onClick={onAction} className="flex items-center gap-1 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-500">
          {action} <IconChevron className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
const TILE_GRADIENTS = [
  'from-rose-500 to-orange-500',
  'from-brand-500 to-cyan-500',
  'from-amber-400 to-yellow-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-fuchsia-500',
  'from-sky-500 to-indigo-500',
  'from-pink-500 to-rose-500',
  'from-lime-500 to-emerald-500',
  'from-slate-600 to-slate-800',
];

export function CircleTile({
  icon,
  label,
  onClick,
  index = 0,
  badge,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  index?: number;
  badge?: string | number;
}) {
  const grad = TILE_GRADIENTS[index % TILE_GRADIENTS.length];
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group w-full">
      <div className="relative">
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white shadow-lg ring-2 ring-white/40 dark:ring-white/10 group-active:scale-90 group-hover:scale-105 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]`}
        >
          {icon}
        </div>
        {badge !== undefined && badge !== '' && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white dark:border-ink-900">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
export function StatBar({ label, value, icon, suffix }: { label: string; value: number; icon?: ReactNode; suffix?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">{icon}{label}</span>
        <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(value)}{suffix ?? ''}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden shadow-inner">
        <div
          className={`relative h-full rounded-full ${statBarColor(v)} transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]`}
          style={{ width: `${v}%` }}
        >
          {/* one-shot sheen sweep so a freshly-rendered bar reads as "live" */}
          <div
            className="absolute inset-0 rounded-full opacity-60"
            style={{
              backgroundImage: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s ease-out 1',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
  size = 'md',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary:
      'bg-gradient-to-b from-brand-400 to-brand-600 text-white hover:from-brand-500 hover:to-brand-700 [box-shadow:var(--shadow-glow-brand),inset_0_1px_0_rgb(255_255_255/0.25)]',
    soft: 'bg-slate-100 text-slate-800 dark:bg-ink-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-ink-700 shadow-sm',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-ink-800',
    danger:
      'bg-gradient-to-b from-rose-400 to-rose-600 text-white hover:from-rose-500 hover:to-rose-700 [box-shadow:var(--shadow-glow-danger),inset_0_1px_0_rgb(255_255_255/0.25)]',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl font-semibold transition-[background-color,box-shadow,transform,opacity] duration-200 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'brand' | 'warn' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-600 dark:bg-ink-800 dark:text-slate-300',
    good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    bad: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    warn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
/** Canvas line/sparkline chart. Draws a smooth series with a soft gradient fill. */
export function LineChart({
  data,
  height = 120,
  color = '#337dff',
  showAxis = false,
  format,
}: {
  data: number[];
  height?: number;
  color?: string;
  showAxis?: boolean;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    if (data.length < 2) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Not enough data yet', 8, h / 2);
      return;
    }
    const pad = showAxis ? 26 : 6;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad - 6);
    const y = (v: number) => pad / 2 + (1 - (v - min) / range) * (h - pad);

    // gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(x(0), y(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(x(i), y(data[i]));
    ctx.lineTo(x(data.length - 1), h);
    ctx.lineTo(x(0), h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(x(0), y(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(x(i), y(data[i]));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // last point dot
    ctx.beginPath();
    ctx.arc(x(data.length - 1), y(data[data.length - 1]), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (showAxis && format) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(format(max), 2, 10);
      ctx.fillText(format(min), 2, h - 2);
    }
  }, [data, height, color, showAxis, format]);
  return <canvas ref={ref} style={{ width: '100%', height }} />;
}

// ---------------------------------------------------------------------------
/** Simple horizontal bar comparison (e.g. party seats). */
export function BarList({ items, format }: { items: { label: string; value: number; color?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate pr-2">{it.label}</span>
            <span className="font-bold text-slate-500 dark:text-slate-400">{format ? format(it.value) : Math.round(it.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-ink-800 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? '#337dff' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl bg-slate-100 dark:bg-ink-800 border border-transparent focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 focus:bg-white dark:focus:bg-ink-850 outline-none px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 transition-[border-color,box-shadow,background-color] ${props.className ?? ''}`}
    />
  );
}

// ---------------------------------------------------------------------------
/** BitLife-style grouped list: a gray category divider bar, then icon + bold
 * title + gray subtitle rows with a chevron (or custom trailing content),
 * separated by thin lines. Use ListSectionBar between groups of ListRows. */
export function ListSectionBar({ label }: { label: string }) {
  return (
    <div className="bg-slate-200/80 dark:bg-ink-700/80 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 -mx-4 sm:mx-0">
      {label}
    </div>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 dark:border-ink-800 last:border-b-0 -mx-4 sm:mx-0 ${
        onClick && !disabled ? 'active:bg-slate-50 dark:active:bg-ink-800/60 transition-colors' : ''
      } ${disabled ? 'opacity-40' : ''}`}
      style={{ width: 'calc(100% + 2rem)' }}
    >
      <span className="text-2xl leading-none shrink-0 w-9 text-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-sm text-brand-700 dark:text-brand-400 truncate">{title}</span>
        {subtitle && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</span>}
      </span>
      <span className="shrink-0 text-slate-300 dark:text-slate-600">{trailing ?? (onClick ? <IconChevron className="w-5 h-5" /> : null)}</span>
    </button>
  );
}

/** Full-bleed navy header used atop a BitLife-style list sheet — pairs with ListRow/ListSectionBar. */
export function ListSheetHeader({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <div className="sticky top-0 z-10 bg-gradient-to-b from-ink-700 to-ink-800 dark:from-ink-800 dark:to-ink-900 px-4 py-3.5 flex items-center -mx-4 sm:mx-0 sm:rounded-t-3xl">
      {onClose && (
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform">
          ✕
        </button>
      )}
      <h3 className="flex-1 text-center font-black tracking-wide text-white uppercase text-sm pr-8">{title}</h3>
    </div>
  );
}

// ---------------------------------------------------------------------------
/** Bottom-sheet style modal, mobile-first, centered on desktop. */
export function Modal({ open, onClose, children, title }: { open: boolean; onClose?: () => void; children: ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-ink-850 rounded-t-3xl sm:rounded-3xl shadow-2xl anim-sheet border border-slate-100 dark:border-ink-800">
        {/* bottom-sheet grab handle (mobile affordance) */}
        <div className="sm:hidden pt-2.5 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-ink-600" />
        </div>
        {title && (
          <div className="sticky top-0 z-10 bg-white/90 dark:bg-ink-850/90 backdrop-blur px-5 py-4 border-b border-slate-100 dark:border-ink-800 flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">{title}</h3>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-ink-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-sm font-bold hover:bg-slate-200 dark:hover:bg-ink-700 active:scale-90 transition-[background-color,transform] shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
