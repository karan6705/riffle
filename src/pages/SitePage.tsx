import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import { Link, useParams } from 'react-router-dom';
import { oneHealth } from '../core/onehealth';
import { categorise, CATEGORIES } from '../core/scoring';
import { TAXA } from '../core/taxa';
import { BugIcon } from '../components/BugIcon';
import { Icon } from '../components/Icon';
import { TILE_ATTR, TILE_URL } from '../components/PinMap';
import { CategoryChip, OneHealthRings, RingLegend, TrendChart } from '../components/Visuals';
import { fmtDate, useSiteSummaries } from '../state/derived';
import { useForecast, useOutlooks } from '../state/forecast';
import { useSites } from '../state/store';
import { StatusChip } from './Review';
import { RiskStrip } from './Alerts';
import { Trend } from './Home';

type Metric = 'ecosystem' | 'people' | 'animals';

export default function SitePage() {
  const { id } = useParams();
  const sites = useSites();
  const { summaries, latestBySite } = useSiteSummaries();
  const forecast = useForecast();
  const outlooks = useOutlooks(sites, latestBySite, forecast.days);
  const [metric, setMetric] = useState<Metric>('ecosystem');
  const s = summaries.find((x) => x.site.id === id);
  const outlook = outlooks.find((o) => o.site.id === id);

  const points = useMemo(
    () => (s?.visits ?? []).map((v) => {
      const oh = oneHealth(v);
      return { date: v.observedAt, value: oh[metric], category: categorise(oh.bugScore, v.habitat.substrate) };
    }),
    [s, metric],
  );

  // Presence of each group per quarter — shows sensitive life appearing or vanishing.
  const presence = useMemo(() => {
    const visits = s?.visits ?? [];
    const quarters = [...new Set(visits.map((v) => { const d = new Date(v.observedAt); return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`; }))];
    return {
      quarters,
      rows: TAXA.map((t) => ({
        taxon: t,
        cells: quarters.map((q) => {
          const inQ = visits.filter((v) => { const d = new Date(v.observedAt); return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}` === q; });
          return inQ.length ? inQ.filter((v) => v.taxa.includes(t.id)).length / inQ.length : 0;
        }),
      })),
    };
  }, [s]);

  if (!s) return <p className="py-20 text-center">Site not found. <Link to="/map" className="underline">Back to map</Link></p>;
  const h = s.health;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <Link to="/map" className="text-sm font-semibold text-river">← All streams</Link>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">{s.site.name}</h1>
          <p className="text-ink-2">{s.site.stream} · {s.site.city} · {s.site.substrate} bed</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-3">{s.site.description}</p>
        </div>
        <Link to={`/check?site=${s.site.id}`} className="btn btn-accent"><Icon name="plus" size={18} /> Check this site</Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr_1fr]">
        <section className="card flex flex-col items-center gap-3 p-5">
          {h ? (
            <>
              <OneHealthRings overall={h.overall} ecosystem={h.ecosystem} people={h.people} animals={h.animals} size={170} />
              <CategoryChip category={h.category} />
              <RingLegend ecosystem={h.ecosystem} people={h.people} animals={h.animals} />
            </>
          ) : <p className="text-ink-3">No checks yet.</p>}
        </section>
        <section className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex-1 font-semibold">Trend over time <Trend value={s.trend} /></h2>
            <div role="tablist" aria-label="Metric" className="flex rounded-full border border-line p-0.5 text-xs">
              {(['ecosystem', 'people', 'animals'] as Metric[]).map((m) => (
                <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
                  className={`rounded-full px-3 py-1 font-semibold capitalize ${metric === m ? 'bg-river text-paper' : 'text-ink-2'}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="mt-3"><TrendChart points={points} label={`${metric} health trend for ${s.site.name}`} /></div>
          <p className="text-xs text-ink-3">Line = 3-visit moving average; dots = individual checks coloured by stream category.</p>
        </section>
      </div>

      {outlook && (
        <section className="card p-5" aria-labelledby="outlook">
          <h2 id="outlook" className="font-semibold">Next 7 days {forecast.isScenario && <span className="chip ml-2 bg-caution-soft text-caution">stress-test weather</span>}</h2>
          <RiskStrip risk={outlook.risk} />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card overflow-x-auto p-5" aria-labelledby="life">
          <h2 id="life" className="font-semibold">Who has been living here</h2>
          <p className="text-xs text-ink-3">Share of checks per quarter that found each group. Sensitive groups vanishing is an early warning sign.</p>
          <table className="mt-3 text-xs">
            <thead>
              <tr><th />{presence.quarters.map((q) => <th key={q} className="px-1 pb-1 font-mono font-normal text-ink-3">{q.replace(/^20/, "'")}</th>)}</tr>
            </thead>
            <tbody>
              {presence.rows.map(({ taxon, cells }) => (
                <tr key={taxon.id}>
                  <th scope="row" className="flex items-center gap-1.5 whitespace-nowrap pr-3 text-left font-medium">
                    <BugIcon taxon={taxon} size={22} /> {taxon.name}
                  </th>
                  {cells.map((c, i) => (
                    <td key={i} className="p-0.5">
                      <span
                        className="block h-5 w-8 rounded"
                        title={`${Math.round(c * 100)}% of checks`}
                        style={{ background: c ? `color-mix(in srgb, var(--river) ${Math.round(20 + c * 80)}%, transparent)` : 'var(--paper-2)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5" aria-labelledby="visits">
          <h2 id="visits" className="font-semibold">Recent checks</h2>
          <ul className="mt-2 divide-y divide-line">
            {[...s.visits].reverse().slice(0, 10).map((v) => {
              const oh = oneHealth(v);
              return (
                <li key={v.id}>
                  <Link to={`/record/${v.id}`} className="flex items-center gap-3 py-2.5 hover:bg-paper-2/50">
                    <span className="size-2.5 rounded-full" style={{ background: CATEGORIES[oh.category].colour }} />
                    <span className="flex-1 text-sm">
                      {fmtDate(v.observedAt)} <span className="text-ink-3">· {v.observer}</span>
                    </span>
                    <StatusChip status={v.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="card overflow-hidden p-0">
        <MapContainer center={[s.site.location.lat, s.site.location.lng]} zoom={15} className="h-56 w-full" scrollWheelZoom={false}>
          <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
          <CircleMarker center={[s.site.location.lat, s.site.location.lng]} radius={12} pathOptions={{ color: '#0f2e2d', fillColor: h ? CATEGORIES[h.category].colour : '#999', fillOpacity: 0.85 }} />
        </MapContainer>
      </section>
    </div>
  );
}
