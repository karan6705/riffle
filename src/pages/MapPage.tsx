import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import { Link, useNavigate } from 'react-router-dom';
import { oneHealth } from '../core/onehealth';
import { CATEGORIES } from '../core/scoring';
import { CITY_CENTRE } from '../core/seed';
import { TILE_ATTR, TILE_URL } from '../components/PinMap';
import { CategoryChip, Meter } from '../components/Visuals';
import { useSiteSummaries } from '../state/derived';
import { useForecast, useOutlooks } from '../state/forecast';
import { useSites, useStore } from '../state/store';
import { Trend } from './Home';

type Layer = 'health' | 'risk';

const riskColour = (r: number) => (r >= 0.65 ? '#c8423b' : r >= 0.4 ? '#e3b23c' : '#1f8a70');

export default function MapPage() {
  const navigate = useNavigate();
  const sites = useSites();
  const { summaries, latestBySite } = useSiteSummaries();
  const forecast = useForecast();
  const outlooks = useOutlooks(sites, latestBySite, forecast.days);
  const all = useStore((s) => s.assessments);
  const [layer, setLayer] = useState<Layer>('health');

  // City-wide pressures over the last 90 days: which stressors citizens report most.
  const pressures = useMemo(() => {
    const since = Date.now() - 90 * 86400000;
    const recent = all.filter((a) => new Date(a.observedAt).getTime() >= since && a.status !== 'rejected');
    const n = Math.max(1, recent.length);
    const pct = (f: (a: (typeof recent)[number]) => boolean) => Math.round((recent.filter(f).length / n) * 100);
    return {
      n: recent.length,
      rows: [
        ['Algae growth (some or lots)', pct((a) => a.water.algae !== 'none')],
        ['Litter present', pct((a) => a.habitat.litter >= 1)],
        ['Pipes or drains discharging', pct((a) => a.habitat.pipesOrOutfalls)],
        ['Murky water', pct((a) => a.water.clarity === 'murky')],
        ['Sewage or chemical smell', pct((a) => a.water.smell === 'sewage' || a.water.smell === 'chemical')],
        ['Foam or oily sheen', pct((a) => a.water.foamOrSheen)],
      ].sort((a, b) => (b[1] as number) - (a[1] as number)) as [string, number][],
      oh: recent.length
        ? (['ecosystem', 'people', 'animals'] as const).map((k) => [k, Math.round(recent.reduce((s, a) => s + oneHealth(a)[k], 0) / n)] as const)
        : [],
    };
  }, [all]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kingfisher">Data to insight</p>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Coimbra's streams at a glance</h1>
        </div>
        <div role="tablist" aria-label="Map layer" className="flex rounded-full border border-line bg-card p-1">
          {(['health', 'risk'] as Layer[]).map((l) => (
            <button key={l} role="tab" aria-selected={layer === l} onClick={() => setLayer(l)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${layer === l ? 'bg-river text-paper' : 'text-ink-2'}`}>
              {l === 'health' ? 'Stream health' : '7-day risk'}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card overflow-hidden p-0">
          <MapContainer center={[CITY_CENTRE.lat, CITY_CENTRE.lng - 0.015]} zoom={13} className="h-[440px] w-full md:h-[560px]" scrollWheelZoom>
            <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
            {summaries.map((s) => {
              const out = outlooks.find((o) => o.site.id === s.site.id);
              const peak = Math.max(0, ...(out?.risk.map((d) => d.peak) ?? [0]));
              const colour = layer === 'health' ? (s.health ? CATEGORIES[s.health.category].colour : '#999') : riskColour(peak);
              return (
                <CircleMarker
                  key={s.site.id}
                  center={[s.site.location.lat, s.site.location.lng]}
                  radius={9 + Math.min(10, s.visits.length / 3)}
                  pathOptions={{ color: '#0f2e2d', weight: 2, fillColor: colour, fillOpacity: 0.85 }}
                  eventHandlers={{ click: () => navigate(`/site/${s.site.id}`) }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <strong>{s.site.name}</strong>
                    <br />
                    {layer === 'health'
                      ? s.health ? `${CATEGORIES[s.health.category].label} · One Health ${s.health.overall}` : 'No data'
                      : `Peak risk ${(peak * 100).toFixed(0)}%${out?.alerts[0] ? ` · ${out.alerts[0].title}` : ''}`}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
          <div className="flex flex-wrap gap-3 border-t border-line p-3 text-xs text-ink-2">
            {layer === 'health'
              ? Object.values(CATEGORIES).map((c) => (
                  <span key={c.id} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: c.colour }} />{c.label}</span>
                ))
              : [['Low', '#1f8a70'], ['Watch', '#e3b23c'], ['Warning', '#c8423b']].map(([l, c]) => (
                  <span key={l} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: c }} />{l}</span>
                ))}
            <span className="ml-auto">Circle size = number of checks · {forecast.isScenario ? 'risk uses stress-test weather' : 'risk uses live Open-Meteo forecast'}</span>
          </div>
        </div>

        <div className="grid content-start gap-6">
          <section className="card p-5" aria-labelledby="city-oh">
            <h2 id="city-oh" className="font-semibold">City One Health · last 90 days</h2>
            <p className="text-xs text-ink-3">Average over {pressures.n} checks</p>
            <div className="mt-3 grid gap-3">
              {pressures.oh.map(([k, v]) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-sm"><span className="capitalize">{k}</span><span className="font-mono">{v}</span></div>
                  <Meter value={v} label={`${k} health`} colour={v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--caution)' : 'var(--warning)'} />
                </div>
              ))}
            </div>
          </section>
          <section className="card p-5" aria-labelledby="press">
            <h2 id="press" className="font-semibold">What is stressing the streams?</h2>
            <p className="text-xs text-ink-3">Share of recent checks reporting each pressure — a to-do list for the city.</p>
            <ul className="mt-3 grid gap-2.5">
              {pressures.rows.map(([label, v]) => (
                <li key={label}>
                  <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-mono">{v}%</span></div>
                  <Meter value={v} label={label} colour="var(--kingfisher)" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="card overflow-x-auto p-0" aria-labelledby="table">
        <h2 id="table" className="px-5 pt-5 font-semibold">All sites</h2>
        <table className="mt-2 w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-ink-3">
            <tr><th className="px-5 py-2">Site</th><th>Health</th><th>One Health</th><th>Trend</th><th>Checks</th><th className="pr-5">Alerts</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {summaries.map((s) => {
              const out = outlooks.find((o) => o.site.id === s.site.id);
              return (
                <tr key={s.site.id} className="hover:bg-paper-2/50">
                  <td className="px-5 py-3"><Link to={`/site/${s.site.id}`} className="font-medium hover:underline">{s.site.name}</Link><div className="text-xs text-ink-3">{s.site.stream}</div></td>
                  <td>{s.health ? <CategoryChip category={s.health.category} /> : '—'}</td>
                  <td className="font-mono">{s.health?.overall ?? '—'}</td>
                  <td><Trend value={s.trend} /></td>
                  <td className="font-mono">{s.visits.length}</td>
                  <td className="pr-5 text-xs">{out?.alerts.length ? out.alerts.map((a) => a.type).join(', ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
