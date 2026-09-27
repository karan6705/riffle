// Early warning: combines a weather forecast (Open-Meteo, free and keyless)
// with each site's vulnerability and the latest citizen observations.

import type { Assessment, Site } from './types';

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  precip: number; // mm
  tmax: number; // °C
}

export type HazardType = 'overflow' | 'heat' | 'flood';
export type AlertLevel = 'watch' | 'warning';

export interface Hazard {
  type: HazardType;
  risk: number; // 0..1
}

export interface RiskDay {
  date: string;
  weather: DailyWeather;
  hazards: Hazard[];
  peak: number;
}

export interface Alert {
  siteId: string;
  type: HazardType;
  level: AlertLevel;
  date: string;
  risk: number;
  title: string;
  detail: string;
  actions: string[];
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const round2 = (x: number) => Math.round(x * 100) / 100;

export function siteRisk(site: Site, days: DailyWeather[], latest?: Assessment): RiskDay[] {
  const sewerHint = latest && (latest.habitat.pipesOrOutfalls || latest.water.smell === 'sewage') ? 0.12 : 0;
  const bloomHint = latest && (latest.water.algae === 'lots' ? 0.2 : latest.water.algae === 'some' ? 0.08 : 0);
  const stillHint = latest?.water.flow === 'still' ? 0.1 : 0;
  let hotStreak = 0;
  return days.map((d, i) => {
    // Runoff integrates today's rain plus half of yesterday's (soils and pipes are still full).
    const rain = d.precip + 0.5 * (days[i - 1]?.precip ?? 0);
    hotStreak = d.tmax >= 30 ? hotStreak + 1 : 0;
    const overflow = Math.min(1, sigmoid((rain - 12) / 4) * (0.45 + 0.55 * site.vulnerability) + sewerHint);
    const heat = Math.min(1, sigmoid((d.tmax - 31) / 2) * (0.5 + 0.2 * Math.min(hotStreak, 3)) + (bloomHint ?? 0) + stillHint);
    const flood = Math.min(1, sigmoid((rain - 40) / 6) * (0.6 + 0.4 * site.vulnerability));
    const hazards: Hazard[] = [
      { type: 'overflow' as const, risk: round2(overflow) },
      { type: 'heat' as const, risk: round2(heat) },
      { type: 'flood' as const, risk: round2(flood) },
    ];
    return { date: d.date, weather: d, hazards, peak: Math.max(...hazards.map((h) => h.risk)) };
  });
}

const COPY: Record<HazardType, { title: string; detail: (d: RiskDay) => string; actions: string[] }> = {
  overflow: {
    title: 'Sewer overflow & runoff risk',
    detail: (d) => `${d.weather.precip.toFixed(0)} mm of rain forecast. Storm drains and combined sewers may flush pollution into the stream.`,
    actions: ['Avoid water contact for 48 h after the rain', 'Check the stream the day after — report smell, foam or grey water', 'Keep dogs out of the water'],
  },
  heat: {
    title: 'Heat stress & algal bloom risk',
    detail: (d) => `Air up to ${d.weather.tmax.toFixed(0)} °C. Warm, slow water holds less oxygen and favours toxic cyanobacteria.`,
    actions: ['Look for green scum or dead fish and report them', 'Keep pets away from green or stagnant water', 'Offer shade: support tree-planting along the banks'],
  },
  flood: {
    title: 'Flash-flood risk',
    detail: (d) => `${d.weather.precip.toFixed(0)} mm of rain forecast. Sealed urban surfaces send it to the stream within minutes.`,
    actions: ['Stay away from banks and culverts during the storm', 'Do not sample until the water drops', 'Report blocked culverts to the municipality'],
  },
};

/** `from` (YYYY-MM-DD) excludes past days that are only in the window as context. */
export function alertsFor(site: Site, risk: RiskDay[], from = new Date().toISOString().slice(0, 10)): Alert[] {
  const alerts: Alert[] = [];
  for (const type of ['overflow', 'heat', 'flood'] as HazardType[]) {
    // One alert per hazard: its worst upcoming day.
    let best: { day: RiskDay; risk: number } | null = null;
    for (const day of risk) {
      if (day.date < from) continue;
      const r = day.hazards.find((h) => h.type === type)!.risk;
      if (!best || r > best.risk) best = { day, risk: r };
    }
    if (!best || best.risk < 0.4) continue;
    const c = COPY[type];
    alerts.push({
      siteId: site.id,
      type,
      level: best.risk >= 0.65 ? 'warning' : 'watch',
      date: best.day.date,
      risk: best.risk,
      title: c.title,
      detail: c.detail(best.day),
      actions: c.actions,
    });
  }
  return alerts.sort((a, b) => b.risk - a.risk);
}

/** Parse an Open-Meteo `daily` payload. */
export function parseOpenMeteo(json: unknown): DailyWeather[] {
  const daily = (json as { daily?: { time: string[]; precipitation_sum: (number | null)[]; temperature_2m_max: (number | null)[] } }).daily;
  if (!daily?.time?.length) throw new Error('Unexpected Open-Meteo response');
  return daily.time.map((date, i) => ({
    date,
    precip: daily.precipitation_sum[i] ?? 0,
    tmax: daily.temperature_2m_max[i] ?? 0,
  }));
}

export async function fetchForecast(lat: number, lng: number, signal?: AbortSignal): Promise<DailyWeather[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    '&daily=precipitation_sum,temperature_2m_max&past_days=1&forecast_days=7&timezone=auto';
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return parseOpenMeteo(await res.json());
}

/**
 * Deterministic scenario used when offline, and as a "stress test" so judges and
 * city staff can see the alerting behaviour on a calm week too.
 */
export function stressScenario(start = new Date()): DailyWeather[] {
  const precip = [0, 2, 28, 46, 6, 0, 0, 0];
  const tmax = [27, 25, 21, 19, 24, 31, 34, 35];
  return precip.map((p, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i - 1);
    return { date: d.toISOString().slice(0, 10), precip: p, tmax: tmax[i] };
  });
}

export interface AlertGroup {
  type: HazardType;
  date: string;
  level: AlertLevel;
  title: string;
  detail: string;
  actions: string[];
  sites: { site: Site; risk: number; level: AlertLevel }[];
}

/** Merge per-site alerts into one alert per hazard and day, listing affected sites. */
export function groupAlerts(items: { site: Site; alerts: Alert[] }[]): AlertGroup[] {
  const groups = new Map<string, AlertGroup>();
  for (const { site, alerts } of items) {
    for (const a of alerts) {
      const key = `${a.type}|${a.date}`;
      const g = groups.get(key) ?? { type: a.type, date: a.date, level: a.level, title: a.title, detail: a.detail, actions: a.actions, sites: [] };
      g.sites.push({ site, risk: a.risk, level: a.level });
      if (a.level === 'warning') g.level = 'warning';
      groups.set(key, g);
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, sites: g.sites.sort((x, y) => y.risk - x.risk) }))
    .sort((a, b) => (a.level === b.level ? b.sites[0].risk - a.sites[0].risk : a.level === 'warning' ? -1 : 1));
}
