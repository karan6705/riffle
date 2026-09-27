import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { runCopilot } from '../core/copilot';
import { defaultModel } from '../core/model';
import { CATEGORIES, categorise } from '../core/scoring';
import { TAXA_BY_ID } from '../core/taxa';
import type { Assessment, ReviewStatus } from '../core/types';
import { Icon } from '../components/Icon';
import { fmtDate } from '../state/derived';
import { useStore } from '../state/store';

const STATUS: Record<ReviewStatus, { label: string; cls: string }> = {
  'auto-accepted': { label: 'Published', cls: 'bg-good-soft text-good' },
  'needs-review': { label: 'Awaiting expert', cls: 'bg-caution-soft text-caution' },
  'expert-verified': { label: 'Expert verified', cls: 'bg-good-soft text-good' },
  rejected: { label: 'Rejected', cls: 'bg-warning-soft text-warning' },
};

export function StatusChip({ status }: { status: ReviewStatus }) {
  const s = STATUS[status];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export default function Review() {
  const all = useStore((s) => s.assessments);
  const review = useStore((s) => s.review);
  const [reviewer, setReviewer] = useState('Dr. M. Costa (UC freshwater lab)');
  const pending = all.filter((a) => a.status === 'needs-review').sort((a, b) => b.observedAt.localeCompare(a.observedAt));

  const stats = useMemo(() => {
    const reviewed = all.filter((a) => a.status === 'expert-verified' || a.status === 'rejected');
    const verified = reviewed.filter((a) => a.status === 'expert-verified').length;
    const auto = all.filter((a) => a.status === 'auto-accepted').length;
    return {
      reviewed: reviewed.length,
      verifiedPct: reviewed.length ? Math.round((verified / reviewed.length) * 100) : 0,
      autoPct: Math.round((auto / Math.max(1, all.length)) * 100),
    };
  }, [all]);

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kingfisher">Human-in-the-loop</p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">Expert review queue</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          The co-pilot never rejects a citizen's data. Records it could not reconcile arrive here with the citizen's own
          explanation and the model's evidence. Experts spend minutes, not hours — and every decision feeds back into the record's provenance.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Review statistics">
        {[
          [pending.length, 'waiting for review'],
          [`${stats.autoPct}%`, 'published without expert time'],
          [stats.reviewed, 'reviewed by experts'],
          [`${stats.verifiedPct}%`, 'of flagged records turned out valid'],
        ].map(([v, l]) => (
          <div key={l as string} className="card p-4">
            <p className="font-display text-3xl font-semibold">{v}</p>
            <p className="text-sm text-ink-3">{l}</p>
          </div>
        ))}
      </section>
      <p className="-mt-3 text-xs text-ink-3">
        A high "turned out valid" rate means flags often mark genuinely unusual events (e.g. a new spill) rather than mistakes — so they are never auto-deleted.
      </p>

      <label className="flex max-w-md flex-col gap-1 text-sm">
        <span className="font-medium">Reviewing as</span>
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="rounded-xl border border-line bg-card px-4 py-2.5" />
      </label>

      {pending.length === 0 ? (
        <div className="card p-10 text-center">
          <Icon name="check" size={32} className="mx-auto text-good" />
          <p className="font-display mt-2 text-2xl">Queue is clear</p>
          <p className="text-ink-3">All citizen checks have been reviewed.</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {pending.map((a) => <ReviewCard key={a.id} a={a} onDecide={(status, note) => review(a.id, status, reviewer, note)} />)}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({ a, onDecide }: { a: Assessment; onDecide: (s: ReviewStatus, note?: string) => void }) {
  const [note, setNote] = useState('');
  const r = useMemo(() => runCopilot(a, defaultModel()), [a]);
  const cat = categorise(r.observed, a.habitat.substrate);
  const w = a.water;
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <Link to={`/record/${a.id}`} className="font-display text-xl font-semibold hover:underline">{a.siteName}</Link>
          <p className="text-sm text-ink-3">{fmtDate(a.observedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })} (Coimbra time) · {a.observer} · {a.samplingMinutes} min search</p>
        </div>
        <span className="chip" style={{ background: `color-mix(in srgb, ${CATEGORIES[cat].colour} 18%, transparent)`, color: CATEGORIES[cat].colour }}>
          miniSASS {r.observed.toFixed(1)} · expected {Math.max(0, r.prediction.low).toFixed(1)}–{r.prediction.high.toFixed(1)}
        </span>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
        <div><dt className="inline text-ink-3">Water: </dt><dd className="inline">{w.clarity}, {w.colour === 'clear' ? 'no colour' : w.colour}, smell {w.smell}{w.foamOrSheen ? ', foam' : ''}, {w.flow}, algae {w.algae}{w.temperature !== undefined ? `, ${w.temperature} °C` : ''}</dd></div>
        <div><dt className="inline text-ink-3">Animals: </dt><dd className="inline">{a.taxa.length ? a.taxa.map((t) => TAXA_BY_ID[t]?.name).join(', ') : 'none found'}</dd></div>
        <div><dt className="inline text-ink-3">Banks: </dt><dd className="inline">{a.habitat.substrate}, outfalls {a.habitat.pipesOrOutfalls ? 'yes' : 'no'}, litter {a.habitat.litter}/3</dd></div>
      </dl>

      <ul className="mt-4 grid gap-2">
        {r.flags.map((f) => {
          const d = a.decisions.find((x) => x.flagId === f.id);
          return (
            <li key={f.id} className="rounded-xl bg-paper-2/60 p-3 text-sm">
              <p className="font-semibold">{f.title} <span className="font-normal text-ink-3">· {f.source}</span></p>
              <p className="text-ink-2">{f.message}</p>
              {d?.note && <p className="mt-1 border-l-2 border-kingfisher pl-2 italic">Citizen: “{d.note}”</p>}
            </li>
          );
        })}
      </ul>

      <label className="mt-4 block text-sm">
        <span className="sr-only">Note to the citizen</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to the citizen (e.g. 'Great spot — utility notified')" className="w-full rounded-xl border border-line bg-paper px-3 py-2" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary px-4 py-2 text-sm" onClick={() => onDecide('expert-verified', note)}>
          <Icon name="check" size={16} /> Verify
        </button>
        <button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => onDecide('rejected', note)}>
          <Icon name="x" size={16} /> Reject
        </button>
      </div>
    </li>
  );
}
