import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { levelFor, xpFor } from '../core/gamification';
import { oneHealth } from '../core/onehealth';
import { groupAlerts } from '../core/warning';
import { CATEGORIES } from '../core/scoring';
import { Icon, type IconName } from '../components/Icon';
import { CategoryChip, FlowLines, Meter, OneHealthRings, RingLegend } from '../components/Visuals';
import { distanceKm, fmtDate, useSiteSummaries } from '../state/derived';
import { recentRain, useForecast, useOutlooks } from '../state/forecast';
import { useMine, useSites, useStore } from '../state/store';

const AUDIENCE_ICON: Record<string, IconName> = { people: 'people', pets: 'paw', wildlife: 'leaf', community: 'spark' };
const TONE: Record<string, string> = {
  good: 'bg-good-soft text-good',
  caution: 'bg-caution-soft text-caution',
  warning: 'bg-warning-soft text-warning',
};

export function Home() {
  const sites = useSites();
  const { summaries, latestBySite } = useSiteSummaries();
  const forecast = useForecast();
  const outlooks = useOutlooks(sites, latestBySite, forecast.days);
  const mine = useMine();
  const userName = useStore((s) => s.userName);
  const onboarded = useStore((s) => s.onboarded);
  const finishOnboarding = useStore((s) => s.finishOnboarding);
  const all = useStore((s) => s.assessments);
  const [siteId, setSiteId] = useState(sites[4]?.id ?? sites[0].id);
  const [locating, setLocating] = useState(false);

  const summary = summaries.find((s) => s.site.id === siteId) ?? summaries[0];
  const rain = recentRain(forecast.days);
  const health = summary.latest ? oneHealth(summary.latest, { recentRain: rain, airTemp: forecast.days[1]?.tmax }) : undefined;
  const siteAlerts = outlooks.find((o) => o.site.id === siteId)?.alerts ?? [];
  const warnings = groupAlerts(outlooks).filter((a) => a.level === 'warning');

  const xp = mine.reduce((s, a) => s + xpFor(a).total, 0);
  const lvl = levelFor(xp);

  const since30 = Date.now() - 30 * 86400000;
  const monthChecks = all.filter((a) => new Date(a.observedAt).getTime() >= since30).length;
  const citizens = new Set(all.map((a) => a.observer)).size;
  const pending = all.filter((a) => a.status === 'needs-review').length;
  const challengeGoal = 40;

  const verdict = useMemo(() => {
    if (!health) return { title: 'No recent check here yet', text: 'Be the first to check this stream — it takes about 5 minutes.' };
    const warn = (aud: string) => health.advice.some((a) => a.audience === aud && a.tone === 'warning');
    if (warn('people')) return { title: 'Keep out of the water', text: 'Signs of sewage or overflow mean a health risk from touching the water today.' };
    if (warn('pets')) return { title: 'Keep dogs out of the water', text: 'A walk along the bank is fine, but the water may be toxic for pets today.' };
    if (health.band === 'good') return { title: 'Looking healthy', text: `The last check found ${CATEGORIES[health.category].plain.toLowerCase()}.` };
    if (health.band === 'warning') return { title: 'The stream is struggling', text: 'No obvious risk from a visit, but its wildlife is in trouble. Regular checks help track it.' };
    return { title: 'Enjoy, with care', text: 'Some signs of stress. Read the advice below before you or your dog go in.' };
  }, [health]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const nearest = [...sites].sort((a, b) => distanceKm(here, a.location) - distanceKm(here, b.location))[0];
        setSiteId(nearest.id);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  return (
    <div className="grid gap-6">
      {!onboarded && (
        <section className="card rise relative overflow-hidden border-river/30 p-5 md:p-6" aria-labelledby="welcome">
          <FlowLines className="pointer-events-none absolute inset-0 h-full w-full text-shallows" opacity={0.6} />
          <div className="relative grid gap-4 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kingfisher">Welcome to Riffle</p>
              <h1 id="welcome" className="font-display mt-1 text-3xl font-semibold leading-tight md:text-4xl">
                Your stream, read like a doctor reads a pulse.
              </h1>
              <p className="mt-2 max-w-prose text-ink-2">
                Tiny river animals reveal how healthy the water is — for nature, for people and for pets. Riffle guides you
                through a 5-minute check, an AI co-pilot helps you get it right, and your data warns the whole city early.
              </p>
            </div>
            <ol className="grid gap-2 text-sm">
              {[
                ['1', 'Look, smell and lift a few stones', 'No jargon, just pictures.'],
                ['2', 'The co-pilot double-checks with you', 'It explains every suggestion. You decide.'],
                ['3', 'Get a One Health reading', 'For the stream, people and animals — shared as open data.'],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-3 rounded-xl bg-card/80 p-3">
                  <span className="font-display grid size-7 shrink-0 place-items-center rounded-full bg-river text-paper">{n}</span>
                  <span>
                    <strong className="block">{t}</strong>
                    <span className="text-ink-3">{d}</span>
                  </span>
                </li>
              ))}
              <li className="flex gap-2 pt-1">
                <Link to="/check" className="btn btn-accent flex-1" onClick={finishOnboarding}>
                  Start my first check
                </Link>
                <button className="btn btn-ghost" onClick={finishOnboarding}>
                  Explore first
                </button>
              </li>
            </ol>
          </div>
        </section>
      )}

      {warnings.length > 0 && (
        <Link
          to="/alerts"
          className="rise flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-warning"
          style={{ animationDelay: '60ms' }}
        >
          <Icon name="alert" size={22} />
          <span className="flex-1 text-sm">
            <strong>{warnings.length} early warning{warnings.length > 1 ? 's' : ''}</strong>
            {forecast.isScenario ? ' (stress-test scenario)' : ''}: {warnings[0].title.toLowerCase()} on{' '}
            {new Date(warnings[0].date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })} at {warnings[0].sites.length} site
            {warnings[0].sites.length > 1 ? 's' : ''}.
          </span>
          <Icon name="arrowRight" />
        </Link>
      )}

      {/* The daily question people actually have */}
      <section className="card rise overflow-hidden" style={{ animationDelay: '120ms' }} aria-labelledby="today-q">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <h2 id="today-q" className="font-display flex-1 text-xl font-semibold md:text-2xl">
            Hi {userName === 'You' ? 'there' : userName}, is your stream OK today?
          </h2>
          <label className="sr-only" htmlFor="site-select">Choose a stream site</label>
          <select
            id="site-select"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className="btn btn-ghost px-3 py-2 text-sm" onClick={useMyLocation} aria-label="Use my location to pick the nearest site">
            <Icon name="pin" size={16} /> {locating ? 'Locating…' : 'Nearest'}
          </button>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:gap-8 md:p-6">
          <div className="flex flex-col items-center gap-3">
            {health ? (
              <>
                <OneHealthRings overall={health.overall} ecosystem={health.ecosystem} people={health.people} animals={health.animals} />
                <RingLegend ecosystem={health.ecosystem} people={health.people} animals={health.animals} />
              </>
            ) : (
              <div className="grid size-[190px] place-items-center rounded-full border-2 border-dashed border-line text-center text-sm text-ink-3">No data yet</div>
            )}
          </div>
          <div className="grid content-start gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-3xl font-semibold">{verdict.title}</p>
                {health && <CategoryChip category={health.category} />}
              </div>
              <p className="mt-1 text-ink-2">{verdict.text}</p>
              {summary.latest && (
                <p className="mt-1 text-xs text-ink-3">
                  Last checked {fmtDate(summary.latest.observedAt)} by {summary.latest.observer} ·{' '}
                  {rain >= 1 ? `${rain.toFixed(0)} mm rain in the last 48 h` : 'dry last 48 h'}
                  {summary.latest.status === 'needs-review' && ' · awaiting expert review'}
                </p>
              )}
            </div>
            {health && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {health.advice.map((a) => (
                  <li key={a.title} className={`flex gap-3 rounded-2xl p-3 ${TONE[a.tone]}`}>
                    <Icon name={AUDIENCE_ICON[a.audience]} size={22} className="mt-0.5 shrink-0" />
                    <span>
                      <strong className="block text-[0.95rem]">{a.title}</strong>
                      <span className="text-sm text-ink-2">{a.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {siteAlerts.length > 0 && (
              <p className="flex items-center gap-2 text-sm font-medium text-caution">
                <Icon name="bell" size={16} /> Upcoming: {siteAlerts.map((a) => a.title.toLowerCase()).join(' · ')}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link to={`/check?site=${siteId}`} className="btn btn-primary">
                <Icon name="plus" size={18} /> Check this stream
              </Link>
              <Link to={`/site/${siteId}`} className="btn btn-ghost">
                See its history
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card rise p-5" style={{ animationDelay: '180ms' }} aria-labelledby="streams">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="streams" className="font-display text-xl font-semibold">Streams in Coimbra</h2>
            <Link to="/map" className="text-sm font-semibold text-river underline-offset-4 hover:underline">Open map</Link>
          </div>
          <ul className="divide-y divide-line">
            {summaries.map((s) => (
              <li key={s.site.id}>
                <Link to={`/site/${s.site.id}`} className="flex items-center gap-3 py-3 hover:bg-paper-2/50">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: s.health ? CATEGORIES[s.health.category].colour : 'var(--line)' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.site.name}</span>
                    <span className="text-xs text-ink-3">
                      {s.visits.length} checks · last {s.latest ? fmtDate(s.latest.observedAt, { day: 'numeric', month: 'short' }) : '—'}
                    </span>
                  </span>
                  <Trend value={s.trend} />
                  {s.health && <CategoryChip category={s.health.category} />}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid content-start gap-6">
          <section className="card rise p-5" style={{ animationDelay: '240ms' }} aria-labelledby="you">
            <div className="flex items-center justify-between">
              <h2 id="you" className="font-display text-xl font-semibold">{lvl.level.name}</h2>
              <span className="font-mono text-sm text-ink-3">{xp} XP</span>
            </div>
            <p className="text-sm text-ink-3">{lvl.level.blurb}</p>
            <div className="mt-3">
              <Meter value={lvl.progress * 100} colour="var(--kingfisher)" label="Progress to next level" />
              {lvl.next && <p className="mt-1 text-xs text-ink-3">{lvl.next.min - xp} XP to {lvl.next.name}</p>}
            </div>
            <Link to="/me" className="mt-3 inline-block text-sm font-semibold text-river underline-offset-4 hover:underline">
              Badges & challenges
            </Link>
          </section>

          <section className="card rise relative overflow-hidden p-5" style={{ animationDelay: '300ms' }} aria-labelledby="pulse">
            <h2 id="pulse" className="font-display text-xl font-semibold">Community pulse</h2>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                [monthChecks, 'checks in 30 days'],
                [citizens, 'citizen scientists'],
                [pending, 'awaiting experts'],
              ].map(([v, l]) => (
                <div key={l as string} className="rounded-xl bg-paper-2/60 p-2">
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-display text-2xl font-semibold">{v}</dd>
                  <dd className="text-[0.7rem] leading-tight text-ink-3">{l}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <p className="text-sm font-semibold">Autumn Riffle Blitz</p>
              <p className="text-xs text-ink-3">Coimbra goal: {challengeGoal} checks in 30 days, before the autumn storms.</p>
              <div className="mt-2 flex items-center gap-2">
                <Meter value={(monthChecks / challengeGoal) * 100} label="Community challenge progress" colour="var(--good)" />
                <span className="font-mono text-xs">{monthChecks}/{challengeGoal}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function Trend({ value }: { value: number }) {
  if (Math.abs(value) < 4) return <span className="text-xs text-ink-3" title="Stable">→ stable</span>;
  const up = value > 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-good' : 'text-warning'}`} title={`${up ? 'Improving' : 'Declining'} by ${Math.abs(value).toFixed(0)} points`}>
      {up ? '↗ improving' : '↘ declining'}
    </span>
  );
}
