// Engagement mechanics designed to reward *good science*, not just volume:
// XP for careful sampling and for resolving co-pilot flags honestly.

import { TAXA_BY_ID } from './taxa';
import type { Assessment } from './types';

export interface Level { name: string; min: number; blurb: string }

export const LEVELS: Level[] = [
  { name: 'Tadpole', min: 0, blurb: 'Just dipped a toe in' },
  { name: 'Water Strider', min: 150, blurb: 'Skimming the surface' },
  { name: 'Caddis Builder', min: 400, blurb: 'Building a solid record' },
  { name: 'Mayfly Watcher', min: 800, blurb: 'Knows the riffles' },
  { name: 'Stonefly Sentinel', min: 1400, blurb: 'Trusted local monitor' },
  { name: 'River Guardian', min: 2200, blurb: 'A pillar of the stream community' },
];

export interface Badge { id: string; name: string; description: string; icon: string }

export const BADGES: Badge[] = [
  { id: 'first-dip', name: 'First Dip', description: 'Completed your first stream check', icon: '💧' },
  { id: 'bug-detective', name: 'Bug Detective', description: 'Found 6+ animal groups in one visit', icon: '🔍' },
  { id: 'stonefly-spotter', name: 'Stonefly Spotter', description: 'Recorded a very sensitive group', icon: '🪨' },
  { id: 'honest-scientist', name: 'Honest Scientist', description: 'Double-checked and corrected an entry the co-pilot flagged', icon: '🧪' },
  { id: 'photo-pro', name: 'Photo Pro', description: 'Added a water-colour photo', icon: '📷' },
  { id: 'site-adopter', name: 'Site Adopter', description: 'Visited the same site 3 times', icon: '🏡' },
  { id: 'streak-3', name: 'Seasonal Regular', description: 'Checked a stream in 3 different weeks in a row', icon: '🔥' },
  { id: 'patient-sampler', name: 'Patient Sampler', description: 'Sampled for 5+ minutes', icon: '⏱️' },
];

export function xpFor(a: Assessment): { total: number; lines: { label: string; xp: number }[] } {
  const lines: { label: string; xp: number }[] = [{ label: 'Stream check completed', xp: 50 }];
  if (a.taxa.length) lines.push({ label: `${a.taxa.length} animal group${a.taxa.length > 1 ? 's' : ''} recorded`, xp: 8 * a.taxa.length });
  if (a.samplingMinutes >= 5) lines.push({ label: 'Thorough 5-minute search', xp: 20 });
  if (a.photo) lines.push({ label: 'Water-colour photo', xp: 15 });
  if (a.water.temperature !== undefined) lines.push({ label: 'Measured temperature', xp: 10 });
  const corrected = a.decisions.filter((d) => d.action === 'changed').length;
  const explained = a.decisions.filter((d) => d.action === 'confirmed' && d.note?.trim()).length;
  if (corrected) lines.push({ label: 'Double-checked flagged answers', xp: 25 * corrected });
  if (explained) lines.push({ label: 'Explained an unusual finding', xp: 15 * explained });
  return { total: lines.reduce((s, l) => s + l.xp, 0), lines };
}

export function levelFor(xp: number): { level: Level; next?: Level; progress: number } {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i++;
  const level = LEVELS[i];
  const next = LEVELS[i + 1];
  return { level, next, progress: next ? (xp - level.min) / (next.min - level.min) : 1 };
}

/** ISO-8601 week key, e.g. "2026-W40". */
export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Consecutive weeks (ending this week or last week) with at least one check. */
export function weekStreak(dates: Date[], now = new Date()): number {
  const weeks = new Set(dates.map(weekKey));
  const cursor = new Date(now);
  if (!weeks.has(weekKey(cursor))) cursor.setDate(cursor.getDate() - 7);
  let streak = 0;
  while (weeks.has(weekKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export function earnedBadges(mine: Assessment[], now = new Date()): Set<string> {
  const earned = new Set<string>();
  if (mine.length) earned.add('first-dip');
  const bySite = new Map<string, number>();
  for (const a of mine) {
    if (a.taxa.length >= 6) earned.add('bug-detective');
    if (a.taxa.some((t) => TAXA_BY_ID[t]?.sensitivity === 'very-sensitive')) earned.add('stonefly-spotter');
    if (a.decisions.some((d) => d.action === 'changed')) earned.add('honest-scientist');
    if (a.photo) earned.add('photo-pro');
    if (a.samplingMinutes >= 5) earned.add('patient-sampler');
    bySite.set(a.siteId, (bySite.get(a.siteId) ?? 0) + 1);
  }
  if ([...bySite.values()].some((n) => n >= 3)) earned.add('site-adopter');
  if (weekStreak(mine.map((a) => new Date(a.observedAt)), now) >= 3) earned.add('streak-3');
  return earned;
}
