import { useMemo } from 'react';
import { oneHealth, type OneHealthScore } from '../core/onehealth';
import type { Assessment, Site } from '../core/types';
import { useSites, useStore } from './store';

export interface SiteSummary {
  site: Site;
  visits: Assessment[];
  latest?: Assessment;
  health?: OneHealthScore;
  /** Change in ecosystem score, recent 6 visits vs the 6 before. */
  trend: number;
}

/** Only records that count as evidence (rejected ones are excluded). */
const usable = (a: Assessment) => a.status !== 'rejected';

export function useSiteSummaries(): { summaries: SiteSummary[]; latestBySite: Map<string, Assessment> } {
  const sites = useSites();
  const all = useStore((s) => s.assessments);
  return useMemo(() => {
    const latestBySite = new Map<string, Assessment>();
    const summaries = sites.map((site) => {
      const visits = all.filter((a) => a.siteId === site.id && usable(a)).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
      const latest = visits[visits.length - 1];
      if (latest) latestBySite.set(site.id, latest);
      const eco = visits.map((v) => oneHealth(v).ecosystem);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
      const trend = eco.length >= 12 ? avg(eco.slice(-6)) - avg(eco.slice(-12, -6)) : 0;
      return { site, visits, latest, health: latest ? oneHealth(latest) : undefined, trend };
    });
    return { summaries, latestBySite };
  }, [sites, all]);
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString('en-GB', opts);

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
