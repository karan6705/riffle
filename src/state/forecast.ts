import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { CITY_CENTRE } from '../core/seed';
import type { Assessment, Site } from '../core/types';
import { alertsFor, fetchForecast, siteRisk, stressScenario, type Alert, type DailyWeather, type RiskDay } from '../core/warning';

type Mode = 'live' | 'stress';

interface ForecastState {
  mode: Mode;
  live: DailyWeather[] | null;
  status: 'idle' | 'loading' | 'ok' | 'offline';
  fetchedAt?: string;
  setMode: (m: Mode) => void;
  load: () => Promise<void>;
}

export const useForecastStore = create<ForecastState>((set, get) => ({
  mode: 'live',
  live: null,
  status: 'idle',
  setMode: (mode) => set({ mode }),
  load: async () => {
    if (get().status === 'loading' || get().status === 'ok') return;
    set({ status: 'loading' });
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const live = await fetchForecast(CITY_CENTRE.lat, CITY_CENTRE.lng, ctrl.signal);
      clearTimeout(t);
      set({ live, status: 'ok', fetchedAt: new Date().toISOString() });
    } catch {
      // No network: fall back to the scenario so the app still demonstrates alerting.
      set({ status: 'offline', mode: 'stress' });
    }
  },
}));

export function useForecast() {
  const s = useForecastStore();
  const load = s.load;
  useEffect(() => {
    void load();
  }, [load]);
  const days = useMemo(() => (s.mode === 'live' && s.live ? s.live : stressScenario()), [s.mode, s.live]);
  return { ...s, days, isScenario: s.mode === 'stress' || !s.live };
}

export interface SiteOutlook {
  site: Site;
  risk: RiskDay[];
  alerts: Alert[];
}

export function useOutlooks(sites: Site[], latestBySite: Map<string, Assessment>, days: DailyWeather[]): SiteOutlook[] {
  return useMemo(
    () =>
      sites.map((site) => {
        const risk = siteRisk(site, days, latestBySite.get(site.id));
        return { site, risk, alerts: alertsFor(site, risk) };
      }),
    [sites, latestBySite, days],
  );
}

/** Rain over the last ~48 h from the forecast window (includes past_days=1). */
export function recentRain(days: DailyWeather[]): number {
  const today = new Date().toISOString().slice(0, 10);
  const idx = days.findIndex((d) => d.date === today);
  const i = idx === -1 ? 1 : idx;
  return (days[i]?.precip ?? 0) + (days[i - 1]?.precip ?? 0);
}
