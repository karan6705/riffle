import { useState } from 'react';
import { Link } from 'react-router-dom';
import { groupAlerts, type HazardType, type RiskDay } from '../core/warning';
import { Icon, type IconName } from '../components/Icon';
import { useSiteSummaries } from '../state/derived';
import { useForecast, useOutlooks } from '../state/forecast';
import { useSites } from '../state/store';

const HAZ: Record<HazardType, { label: string; icon: IconName; colour: string }> = {
  overflow: { label: 'Sewer overflow', icon: 'rain', colour: '#5b7fd9' },
  heat: { label: 'Heat & bloom', icon: 'sun', colour: '#d9622b' },
  flood: { label: 'Flash flood', icon: 'wave', colour: '#7a4fb3' },
};

const day = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });

export function RiskStrip({ risk }: { risk: RiskDay[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <div className="grid min-w-[560px] gap-1.5" style={{ gridTemplateColumns: `repeat(${risk.length}, minmax(0, 1fr))` }}>
        {risk.map((d) => (
          <div key={d.date} className="rounded-xl bg-paper-2/60 p-2 text-center">
            <p className="text-xs font-semibold">{day(d.date)}</p>
            <p className="font-mono text-[0.68rem] text-ink-3">{d.weather.precip.toFixed(0)} mm · {d.weather.tmax.toFixed(0)}°</p>
            <div className="mt-2 flex h-14 items-end justify-center gap-1" aria-label={d.hazards.map((h) => `${HAZ[h.type].label} ${Math.round(h.risk * 100)}%`).join(', ')}>
              {d.hazards.map((h) => (
                <span key={h.type} className="w-2.5 rounded-t" title={`${HAZ[h.type].label}: ${Math.round(h.risk * 100)}%`} style={{ height: `${Math.max(4, h.risk * 100)}%`, background: HAZ[h.type].colour, opacity: h.risk >= 0.4 ? 1 : 0.35 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-3">
        {Object.values(HAZ).map((h) => <span key={h.label} className="flex items-center gap-1"><span className="size-2 rounded-sm" style={{ background: h.colour }} />{h.label}</span>)}
      </div>
    </div>
  );
}

export default function Alerts() {
  const sites = useSites();
  const { latestBySite } = useSiteSummaries();
  const forecast = useForecast();
  const outlooks = useOutlooks(sites, latestBySite, forecast.days);
  const alerts = groupAlerts(outlooks);
  const [notify, setNotify] = useState<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setNotify(p);
    if (p === 'granted' && alerts[0]) {
      const title = `Riffle: ${alerts[0].title}`;
      const options = { body: `${alerts[0].sites.map((x) => x.site.name).join(', ')} — ${alerts[0].detail}`, icon: './favicon.svg' };
      // Mobile browsers only allow notifications through the service worker.
      const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
      if (reg) await reg.showNotification(title, options);
      else {
        try { new Notification(title, options); } catch { /* unsupported on this platform */ }
      }
    }
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kingfisher">Resilience · early warning</p>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">What the next week holds</h1>
          <p className="mt-1 max-w-2xl text-ink-2">
            Weather forecasts combined with each site's vulnerability and the latest citizen observations — so people, pet owners
            and the city can act before a spill or a bloom, not after.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div role="tablist" aria-label="Weather source" className="flex rounded-full border border-line bg-card p-1 text-sm">
            <button role="tab" aria-selected={forecast.mode === 'live'} disabled={!forecast.live} onClick={() => forecast.setMode('live')}
              className={`rounded-full px-3 py-1.5 font-semibold disabled:opacity-40 ${forecast.mode === 'live' ? 'bg-river text-paper' : 'text-ink-2'}`}>Live forecast</button>
            <button role="tab" aria-selected={forecast.mode === 'stress'} onClick={() => forecast.setMode('stress')}
              className={`rounded-full px-3 py-1.5 font-semibold ${forecast.mode === 'stress' ? 'bg-river text-paper' : 'text-ink-2'}`}>Storm + heatwave test</button>
          </div>
          <p className="text-xs text-ink-3">
            {forecast.status === 'loading' && 'Fetching Open-Meteo forecast…'}
            {forecast.status === 'ok' && `Open-Meteo forecast for Coimbra, fetched ${new Date(forecast.fetchedAt!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
            {forecast.status === 'offline' && 'Offline — showing the stress-test scenario'}
          </p>
        </div>
      </header>

      <section aria-labelledby="active">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="active" className="font-display flex-1 text-2xl font-semibold">{alerts.length ? `${alerts.length} active alerts` : 'All clear this week'}</h2>
          {notify !== 'unsupported' && (
            <button className="btn btn-ghost px-3 py-2 text-sm" onClick={enableNotifications} disabled={notify === 'granted'}>
              <Icon name="bell" size={16} /> {notify === 'granted' ? 'Notifications on' : 'Notify me'}
            </button>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="card flex items-center gap-4 p-6">
            <Icon name="check" size={28} className="text-good" />
            <p className="text-ink-2">No elevated risk in the live forecast. Switch to the <strong>storm + heatwave test</strong> to see how Riffle warns people.</p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {alerts.map((a) => (
              <li key={a.type + a.date} className={`card border-l-4 p-4 ${a.level === 'warning' ? 'border-l-warning' : 'border-l-caution'}`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ background: HAZ[a.type].colour }}>
                    <Icon name={HAZ[a.type].icon} />
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: a.level === 'warning' ? 'var(--warning)' : 'var(--caution)' }}>
                      {a.level} · {day(a.date)} · {a.sites.length} site{a.sites.length > 1 ? 's' : ''}
                    </p>
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-1 text-sm text-ink-2">{a.detail}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Affected sites">
                      {a.sites.map((x) => (
                        <li key={x.site.id}>
                          <Link to={`/site/${x.site.id}`} className={`chip hover:underline ${x.level === 'warning' ? 'bg-warning-soft text-warning' : 'bg-caution-soft text-caution'}`}>
                            {x.site.name} · {Math.round(x.risk * 100)}%
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <ul className="mt-3 grid gap-1 text-sm">
                      {a.actions.map((x) => <li key={x} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-good" />{x}</li>)}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4" aria-labelledby="per-site">
        <h2 id="per-site" className="font-display text-2xl font-semibold">Risk by site</h2>
        {outlooks.map((o) => (
          <div key={o.site.id} className="card p-4">
            <div className="flex items-center gap-2">
              <Link to={`/site/${o.site.id}`} className="flex-1 font-semibold hover:underline">{o.site.name}</Link>
              <span className="text-xs text-ink-3">vulnerability {Math.round(o.site.vulnerability * 100)}%</span>
            </div>
            <RiskStrip risk={o.risk} />
          </div>
        ))}
      </section>

      <section className="card p-5 text-sm text-ink-2" aria-labelledby="how">
        <h2 id="how" className="font-semibold text-ink">How the risk is calculated</h2>
        <ul className="mt-2 grid gap-1.5">
          <li><strong>Sewer overflow:</strong> rain today + half of yesterday's, through a logistic curve centred at 12 mm, scaled by the site's sealed-surface vulnerability; raised if citizens recently reported outfalls or sewage smell.</li>
          <li><strong>Heat & bloom:</strong> daily max temperature (centred at 31 °C), amplified by consecutive hot days, recent algae reports and still water.</li>
          <li><strong>Flash flood:</strong> heavy rain (centred at 40 mm) scaled by vulnerability.</li>
          <li>Alerts fire at 40% (watch) and 65% (warning). Transparent rules today; designed to be calibrated with OneAquaHealth sensor and outcome data.</li>
        </ul>
      </section>
    </div>
  );
}
