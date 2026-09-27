import { TAXA_BY_ID } from './taxa';
import type { Substrate } from './types';

export type EcoCategory = 'natural' | 'good' | 'fair' | 'poor' | 'very-poor';

export interface CategoryInfo {
  id: EcoCategory;
  label: string;
  plain: string;
  colour: string;
}

export const CATEGORIES: Record<EcoCategory, CategoryInfo> = {
  natural: { id: 'natural', label: 'Natural', plain: 'Thriving — close to an untouched stream', colour: '#1f8a70' },
  good: { id: 'good', label: 'Good', plain: 'Healthy, with a few signs of human impact', colour: '#5bb450' },
  fair: { id: 'fair', label: 'Fair', plain: 'Under pressure — some sensitive life is missing', colour: '#e3b23c' },
  poor: { id: 'poor', label: 'Poor', plain: 'Struggling — mostly hardy, pollution-tolerant life', colour: '#e07a3f' },
  'very-poor': { id: 'very-poor', label: 'Very poor', plain: 'Seriously degraded — urgent attention needed', colour: '#c8423b' },
};

// Lower bounds of each category, per substrate (miniSASS interpretation table).
const THRESHOLDS: Record<Substrate, [EcoCategory, number][]> = {
  rocky: [
    ['natural', 7.9],
    ['good', 6.8],
    ['fair', 6.1],
    ['poor', 5.1],
  ],
  sandy: [
    ['natural', 6.9],
    ['good', 5.8],
    ['fair', 4.9],
    ['poor', 4.3],
  ],
};

/** Average sensitivity score (ASPT-style) over the groups found. 0 when nothing was found. */
export function miniSassScore(taxa: string[]): number {
  const known = [...new Set(taxa)].filter((id) => TAXA_BY_ID[id]);
  if (known.length === 0) return 0;
  const total = known.reduce((sum, id) => sum + TAXA_BY_ID[id].weight, 0);
  return Math.round((total / known.length) * 100) / 100;
}

export function categorise(score: number, substrate: Substrate): EcoCategory {
  for (const [cat, min] of THRESHOLDS[substrate]) {
    if (score > min) return cat;
  }
  return 'very-poor';
}

/** Maps a score onto 0..100 relative to the "natural" threshold for that substrate. */
export function ecosystemPercent(score: number, substrate: Substrate): number {
  const top = substrate === 'rocky' ? 9.5 : 8.5;
  return Math.max(0, Math.min(100, Math.round((score / top) * 100)));
}
