import type { Taxon } from '../core/taxa';

/**
 * Procedurally drawn, top-down field-guide sketch of a macroinvertebrate group.
 * Built from the taxon's shape parameters so every group is recognisable by
 * its key ID features (number of tails, legs, case, shell…).
 */
export function BugIcon({ taxon, size = 72, className = '' }: { taxon: Taxon; size?: number; className?: string }) {
  const s = taxon.shape;
  const top = 18;
  const len = s.body * 62;
  const w = s.width * 34;
  const cx = 50;
  const els: React.ReactNode[] = [];
  const stroke = 'var(--ink)';
  const fill = taxon.id === 'true-flies' ? '#c65a4a' : 'var(--shallows)';

  if (s.shell === 'spiral') {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
        <path d="M30 70 Q24 76 34 78 L66 78 Q74 76 68 70" fill={fill} stroke={stroke} strokeWidth="2" />
        <path d="M22 52 C 22 32, 58 24, 64 40 C 70 56, 50 64, 42 56 C 34 48, 44 38, 52 44" fill={fill} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="50" cy="50" r="26" fill="none" stroke={stroke} strokeWidth="2.2" />
        <path d="M68 70 l8 -8 M72 74 l10 -4" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Tails
  for (let i = 0; i < s.tails; i++) {
    const spread = s.tails === 1 ? 0 : (i / (s.tails - 1) - 0.5) * 28;
    const y0 = top + len;
    if (taxon.id === 'damselflies') {
      els.push(<ellipse key={`t${i}`} cx={cx + spread * 0.5} cy={y0 + 9} rx="3" ry="9" transform={`rotate(${spread} ${cx} ${y0})`} fill={fill} stroke={stroke} strokeWidth="1.5" />);
    } else {
      els.push(<path key={`t${i}`} d={`M${cx} ${y0 - 2} Q ${cx + spread * 0.4} ${y0 + 10} ${cx + spread} ${y0 + 18}`} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />);
    }
  }

  // Legs (pairs), attached along the thorax.
  for (let i = 0; i < s.legs; i++) {
    const y = top + 8 + len * 0.12 + i * (len * 0.4 / Math.max(1, s.legs));
    const dir = i < s.legs / 2 ? -1 : 1;
    for (const side of [-1, 1]) {
      const x0 = cx + side * w * 0.45;
      const kx = cx + side * (w * 0.45 + 12);
      const ky = y + dir * 4;
      const fx = cx + side * (w * 0.45 + 18);
      const fy = y + dir * 12 + 4;
      els.push(<path key={`l${i}${side}`} d={`M${x0} ${y} L${kx} ${ky} L${fx} ${fy}`} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />);
    }
  }

  if (s.claws) {
    for (const side of [-1, 1]) {
      els.push(
        <path key={`c${side}`} d={`M${cx + side * w * 0.3} ${top + 6} Q ${cx + side * (w * 0.5 + 10)} ${top - 4} ${cx + side * (w * 0.5 + 6)} ${top - 12} M${cx + side * (w * 0.5 + 6)} ${top - 12} l${side * 6} 3 M${cx + side * (w * 0.5 + 6)} ${top - 12} l${side * -2} -6`} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />,
      );
    }
  }

  // Body segments, tapering toward the tail.
  const n = Math.max(1, s.segments);
  const segLen = len / n;
  for (let i = n - 1; i >= 0; i--) {
    const taper = n === 1 ? 1 : 1 - (i / (n - 1)) * 0.45;
    const cy = top + 6 + segLen * i + segLen / 2;
    els.push(<ellipse key={`s${i}`} cx={cx} cy={cy} rx={(w / 2) * taper} ry={segLen * 0.62 + 1} fill={fill} stroke={stroke} strokeWidth="1.5" />);
  }

  if (s.shell === 'case') {
    const y = top + len * 0.35;
    els.push(<rect key="case" x={cx - w * 0.7} y={y} width={w * 1.4} height={len * 0.7} rx={w * 0.5} fill="#b49468" stroke={stroke} strokeWidth="1.6" />);
    for (let i = 1; i < 6; i++) {
      els.push(<path key={`ch${i}`} d={`M${cx - w * 0.6} ${y + (len * 0.7 * i) / 6} l${w * 1.2} ${i % 2 ? 2 : -2}`} stroke={stroke} strokeWidth="1" opacity="0.6" />);
    }
  }
  if (s.shell === 'carapace') {
    els.push(<path key="cara" d={`M${cx - w * 0.55} ${top + 8} Q ${cx} ${top - 4} ${cx + w * 0.55} ${top + 8} L ${cx + w * 0.45} ${top + len * 0.45} Q ${cx} ${top + len * 0.52} ${cx - w * 0.45} ${top + len * 0.45} Z`} fill={fill} stroke={stroke} strokeWidth="1.8" />);
  }
  if (s.wings) {
    els.push(<path key="wing" d={`M${cx} ${top + 12} L${cx} ${top + len}`} stroke={stroke} strokeWidth="1.5" />);
    els.push(<ellipse key="wing2" cx={cx} cy={top + 10 + len / 2} rx={w * 0.52} ry={len * 0.48} fill="none" stroke={stroke} strokeWidth="1.8" />);
  }
  if (taxon.id === 'other-mayflies') {
    // Paired abdominal gills — the key ID feature.
    for (let i = 3; i < n; i++) {
      const cy = top + 6 + segLen * i + segLen / 2;
      for (const side of [-1, 1]) {
        els.push(<ellipse key={`g${i}${side}`} cx={cx + side * (w * 0.55)} cy={cy} rx="3.2" ry="2" fill="none" stroke={stroke} strokeWidth="1.2" />);
      }
    }
  }

  // Head, eyes, antennae.
  const headR = Math.max(4.5, w * 0.34);
  const hasAntennae = s.legs > 0 && !s.shell;
  els.push(<circle key="head" cx={cx} cy={top + 2} r={headR} fill={fill} stroke={stroke} strokeWidth="1.6" />);
  if (taxon.id === 'dragonflies') {
    els.push(<circle key="e1" cx={cx - headR * 0.6} cy={top} r={headR * 0.45} fill={stroke} />, <circle key="e2" cx={cx + headR * 0.6} cy={top} r={headR * 0.45} fill={stroke} />);
  } else if (taxon.id === 'flatworms') {
    els.push(<circle key="e1" cx={cx - 2} cy={top + 1} r="1.3" fill={stroke} />, <circle key="e2" cx={cx + 2} cy={top + 1} r="1.3" fill={stroke} />);
  }
  if (hasAntennae) {
    els.push(<path key="ant" d={`M${cx - 2} ${top - headR + 1} Q ${cx - 8} ${top - 12} ${cx - 12} ${top - 14} M${cx + 2} ${top - headR + 1} Q ${cx + 8} ${top - 12} ${cx + 12} ${top - 14}`} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />);
  }

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      {els}
    </svg>
  );
}
