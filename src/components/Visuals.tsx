import { CATEGORIES, type EcoCategory } from '../core/scoring';

/** Signature motif: slowly drifting stream contour lines. */
export function FlowLines({ className = '', lines = 7, opacity = 0.5 }: { className?: string; lines?: number; opacity?: number }) {
  return (
    <svg className={className} viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => {
        const y = 30 + i * (240 / lines);
        const a = 18 + (i % 3) * 8;
        return (
          <path
            key={i}
            className="flowline"
            style={{ animationDelay: `${-i * 1.7}s`, animationDuration: `${12 + i * 1.3}s` }}
            d={`M-20 ${y} C 120 ${y - a}, 220 ${y + a}, 380 ${y} S 640 ${y - a}, 820 ${y + a * 0.4}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={i % 2 ? 1.2 : 1.8}
            strokeLinecap="round"
            opacity={opacity * (0.5 + (i % 3) * 0.25)}
          />
        );
      })}
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="var(--river)" />
        <path d="M10 26c8-6 14 6 22 0s14 6 22 0M10 38c8-6 14 6 22 0s14 6 22 0" fill="none" stroke="var(--paper)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="46" cy="18" r="5" fill="var(--kingfisher)" />
      </svg>
      <span className="font-display text-[1.35rem] font-semibold tracking-tight text-river">Riffle</span>
    </span>
  );
}

export function CategoryChip({ category }: { category: EcoCategory }) {
  const c = CATEGORIES[category];
  return (
    <span className="chip" style={{ background: `color-mix(in srgb, ${c.colour} 18%, transparent)`, color: c.colour }}>
      <span className="size-2 rounded-full" style={{ background: c.colour }} />
      {c.label}
    </span>
  );
}

const toneColour = (v: number) => (v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--caution)' : 'var(--warning)');

/**
 * One Health "braid": three concentric arcs — ecosystem, people, animals —
 * wrapped around the overall index.
 */
export function OneHealthRings({ overall, ecosystem, people, animals, size = 190 }: { overall: number; ecosystem: number; people: number; animals: number; size?: number }) {
  const rings = [
    { label: 'Ecosystem', v: ecosystem, r: 80 },
    { label: 'People', v: people, r: 66 },
    { label: 'Animals', v: animals, r: 52 },
  ];
  const arc = 0.78; // open ring, gap at the bottom like a stream bend
  return (
    <figure className="relative" style={{ width: size, height: size }} aria-label={`One Health index ${overall} out of 100`}>
      <svg viewBox="0 0 200 200" width={size} height={size}>
        {rings.map((ring) => {
          const c = 2 * Math.PI * ring.r;
          return (
            <g key={ring.label} transform="rotate(130 100 100)">
              <circle cx="100" cy="100" r={ring.r} fill="none" stroke="var(--line)" strokeWidth="9" strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
              <circle
                cx="100"
                cy="100"
                r={ring.r}
                fill="none"
                stroke={toneColour(ring.v)}
                strokeWidth="9"
                strokeDasharray={`${c * arc * (ring.v / 100)} ${c}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s cubic-bezier(.2,.7,.2,1)' }}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-semibold leading-none">{overall}</span>
        <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-3">One Health</span>
      </figcaption>
    </figure>
  );
}

export function RingLegend({ ecosystem, people, animals }: { ecosystem: number; people: number; animals: number }) {
  const rows = [
    ['Ecosystem', ecosystem, 'outer'],
    ['People', people, 'middle'],
    ['Animals', animals, 'inner'],
  ] as const;
  return (
    <dl className="grid gap-2 text-sm">
      {rows.map(([label, v, ring]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="size-2.5 rounded-full" style={{ background: toneColour(v) }} />
          <dt className="w-32 whitespace-nowrap text-ink-2">
            {label} <span className="text-[0.7rem] text-ink-3">({ring})</span>
          </dt>
          <dd className="font-mono font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface TrendPoint { date: string; value: number; category?: EcoCategory }

/** Line chart with ecological-category bands behind it. */
export function TrendChart({ points, height = 180, bands = true, label }: { points: TrendPoint[]; height?: number; bands?: boolean; label: string }) {
  const W = 640, H = height, pad = { l: 30, r: 10, t: 10, b: 24 };
  if (points.length < 2) return <p className="text-sm text-ink-3">Not enough visits yet for a trend.</p>;
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime();
  const x = (d: string) => pad.l + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  // 3-point moving average to separate signal from single-visit noise.
  const smooth = points.map((p, i) => {
    const w = points.slice(Math.max(0, i - 2), i + 1);
    return { ...p, value: w.reduce((s, q) => s + q.value, 0) / w.length };
  });
  const path = smooth.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const months: string[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const m = p.date.slice(0, 7);
    if (!seen.has(m)) { seen.add(m); months.push(p.date); }
  }
  const bandDefs = [
    [70, 100, 'var(--good)'],
    [45, 70, 'var(--caution)'],
    [0, 45, 'var(--warning)'],
  ] as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      {bands && bandDefs.map(([lo, hi, c]) => (
        <rect key={lo} x={pad.l} width={W - pad.l - pad.r} y={y(hi)} height={y(lo) - y(hi)} fill={c} opacity="0.07" />
      ))}
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--ink-3)" fontFamily="var(--font-mono)">{v}</text>
        </g>
      ))}
      {months.filter((_, i) => i % 3 === 0).map((d) => (
        <text key={d} x={x(d)} y={H - 6} fontSize="10" fill="var(--ink-3)" textAnchor="middle">
          {new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
        </text>
      ))}
      {points.map((p) => (
        <circle key={p.date + p.value} cx={x(p.date)} cy={y(p.value)} r="2.6" fill={p.category ? CATEGORIES[p.category].colour : 'var(--ink-3)'} opacity="0.55" />
      ))}
      <path d={path} fill="none" stroke="var(--river)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Meter({ value, colour = 'var(--river)', label }: { value: number; colour?: string; label: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-paper-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: colour }} />
    </div>
  );
}
