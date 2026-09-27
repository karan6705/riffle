import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { runCopilot } from '../core/copilot';
import { BADGES, earnedBadges, xpFor } from '../core/gamification';
import { defaultModel } from '../core/model';
import { oneHealth } from '../core/onehealth';
import { CATEGORIES } from '../core/scoring';
import { TAXA_BY_ID } from '../core/taxa';
import { BugIcon } from '../components/BugIcon';
import { FhirViewer } from '../components/FhirViewer';
import { Icon } from '../components/Icon';
import { CategoryChip, FlowLines, OneHealthRings, RingLegend } from '../components/Visuals';
import { fmtDate } from '../state/derived';
import { useMine, useStore } from '../state/store';
import { StatusChip } from './Review';

export default function RecordPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get('new') === '1';
  const record = useStore((s) => s.assessments.find((a) => a.id === id));
  const mine = useMine();
  const [copied, setCopied] = useState(false);

  const newBadges = useMemo(() => {
    if (!isNew || !record) return [];
    const before = earnedBadges(mine.filter((a) => a.id !== record.id));
    const after = earnedBadges(mine);
    return BADGES.filter((b) => after.has(b.id) && !before.has(b.id));
  }, [isNew, record, mine]);

  if (!record) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-2xl">Record not found</p>
        <Link to="/" className="btn btn-primary mt-4">Go home</Link>
      </div>
    );
  }

  const oh = oneHealth(record);
  const cat = CATEGORIES[oh.category];
  const flags = runCopilot(record, defaultModel()).flags;
  const xp = xpFor(record);

  const share = async () => {
    const text = `I checked ${record.siteName} with Riffle: ${cat.label} stream health, One Health index ${oh.overall}/100.`;
    try {
      if (navigator.share) await navigator.share({ title: 'My stream check', text, url: location.href });
      else {
        await navigator.clipboard.writeText(`${text} ${location.href}`);
        setCopied(true);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="grid gap-6">
      {isNew && (
        <section className="card rise relative overflow-hidden bg-river p-6 text-paper" aria-live="polite">
          <FlowLines className="pointer-events-none absolute inset-0 h-full w-full text-shallows" opacity={0.35} />
          <div className="relative flex flex-wrap items-center gap-6">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kingfisher-soft">Check submitted</p>
              <h1 className="font-display mt-1 text-3xl font-semibold">Thank you — {record.siteName} is on the map.</h1>
              <p className="mt-1 opacity-80">
                {record.status === 'needs-review'
                  ? 'Your notes have been sent to a local freshwater expert. You will see their verdict here.'
                  : 'Your check passed the co-pilot and is already live for your community.'}
              </p>
            </div>
            <div className="text-center">
              <p className="font-display text-5xl font-semibold text-kingfisher-soft">+{xp.total}</p>
              <p className="text-sm opacity-80">XP earned</p>
            </div>
          </div>
          <ul className="relative mt-4 flex flex-wrap gap-2 text-xs">
            {xp.lines.map((l) => (
              <li key={l.label} className="chip bg-paper/15 text-paper">{l.label} +{l.xp}</li>
            ))}
          </ul>
          {newBadges.length > 0 && (
            <div className="relative mt-4 flex flex-wrap gap-3">
              {newBadges.map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-2xl bg-paper px-3 py-2 text-ink">
                  <span className="text-2xl" aria-hidden="true">{b.icon}</span>
                  <span className="text-sm"><strong>New badge: {b.name}</strong><br /><span className="text-ink-3">{b.description}</span></span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Link to={`/site/${record.siteId}`} className="text-sm font-semibold text-river underline-offset-4 hover:underline">{record.siteName}</Link>
          <h2 className="font-display text-2xl font-semibold md:text-3xl">Stream check · {fmtDate(record.observedAt)}</h2>
          <p className="text-sm text-ink-3">By {record.observer} · searched {record.samplingMinutes} min · data quality {record.qualityScore}/100</p>
        </div>
        <StatusChip status={record.status} />
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <section className="card flex flex-col items-center gap-4 p-5">
          <OneHealthRings overall={oh.overall} ecosystem={oh.ecosystem} people={oh.people} animals={oh.animals} />
          <RingLegend ecosystem={oh.ecosystem} people={oh.people} animals={oh.animals} />
        </section>
        <section className="card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <CategoryChip category={oh.category} />
            <span className="font-mono text-sm text-ink-3">miniSASS {oh.bugScore.toFixed(1)} · {record.habitat.substrate} bed</span>
          </div>
          <p className="font-display mt-2 text-2xl">{cat.plain}.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {oh.advice.map((a) => (
              <li key={a.title} className={`rounded-2xl p-3 text-sm ${a.tone === 'good' ? 'bg-good-soft' : a.tone === 'caution' ? 'bg-caution-soft' : 'bg-warning-soft'}`}>
                <strong className="block">{a.title}</strong>
                <span className="text-ink-2">{a.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-5" aria-labelledby="found">
        <h2 id="found" className="font-semibold">Animals found ({record.taxa.length})</h2>
        {record.taxa.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No animals were found in this sample.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-3">
            {record.taxa.map((t) => TAXA_BY_ID[t] && (
              <li key={t} className="flex items-center gap-2 rounded-2xl bg-paper-2/60 py-1 pl-1 pr-3">
                <BugIcon taxon={TAXA_BY_ID[t]} size={44} />
                <span className="text-sm font-medium">{TAXA_BY_ID[t].name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="trail">
        <h2 id="trail" className="font-semibold">Co-pilot & review trail</h2>
        <ol className="mt-3 grid gap-3 border-l-2 border-line pl-4 text-sm">
          <li><strong>{record.observer}</strong> recorded the check.</li>
          {flags.length === 0 && record.decisions.length === 0 && <li>The co-pilot found no inconsistencies.</li>}
          {record.decisions.map((d) => (
            <li key={d.flagId}>
              Co-pilot asked about <em>{d.flagId.replace(/-/g, ' ')}</em> → citizen{' '}
              {d.action === 'changed' ? 'corrected the answer' : 'confirmed it'}
              {d.note && <>: “{d.note}”</>}
            </li>
          ))}
          {record.reviewedBy && (
            <li>
              <strong>{record.reviewedBy}</strong> {record.status === 'rejected' ? 'rejected' : 'verified'} the record{record.reviewNote && <>: “{record.reviewNote}”</>}
            </li>
          )}
        </ol>
      </section>

      <FhirViewer record={record} />

      {isNew && (
        <div className="flex flex-wrap gap-3">
          <Link to="/" className="btn btn-primary"><Icon name="home" size={18} /> Back to today</Link>
          <Link to="/me" className="btn btn-ghost"><Icon name="trophy" size={18} /> My badges</Link>
        </div>
      )}
    </div>
  );
}
