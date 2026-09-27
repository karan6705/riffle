import { useMemo } from 'react';
import { runCopilot } from '../core/copilot';
import { toFhirBundle, validateBundle, type Bundle } from '../core/fhir';
import { defaultModel, FEATURES } from '../core/model';
import { oneHealth } from '../core/onehealth';
import { download } from '../components/FhirViewer';
import { Icon } from '../components/Icon';
import { useStore } from '../state/store';

export default function DataPage() {
  const all = useStore((s) => s.assessments);
  const model = defaultModel();
  const published = all.filter((a) => a.status !== 'rejected');

  const exportFhir = () => {
    const bundles = published.map((a) => toFhirBundle(a, oneHealth(a), runCopilot(a, model).flags));
    const batch: Bundle = {
      resourceType: 'Bundle',
      id: `riffle-export-${Date.now()}`,
      type: 'collection',
      timestamp: new Date().toISOString(),
      meta: { tag: [{ system: 'https://riffle.app/fhir/CodeSystem/stream-assessment', code: 'export' }] },
      entry: bundles.flatMap((b) => b.entry),
    };
    download('riffle-export.fhir.json', JSON.stringify(batch, null, 2));
  };

  const exportCsv = () => {
    const header = ['id', 'site_id', 'site', 'lat', 'lng', 'observed_at', 'status', 'quality', 'minisass', 'category', 'one_health', 'ecosystem', 'people', 'animals', 'clarity', 'colour', 'smell', 'foam', 'flow', 'algae', 'temp_c', 'substrate', 'vegetation', 'shade', 'litter', 'outfalls', 'urbanisation', 'taxa'];
    const rows = published.map((a) => {
      const oh = oneHealth(a);
      return [a.id, a.siteId, a.siteName, a.location.lat, a.location.lng, a.observedAt, a.status, a.qualityScore, oh.bugScore, oh.category, oh.overall, oh.ecosystem, oh.people, oh.animals,
        a.water.clarity, a.water.colour, a.water.smell, a.water.foamOrSheen, a.water.flow, a.water.algae, a.water.temperature ?? '',
        a.habitat.substrate, a.habitat.bankVegetation, a.habitat.shade, a.habitat.litter, a.habitat.pipesOrOutfalls, a.habitat.urbanisation, a.taxa.join('|')];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    download('riffle-export.csv', csv, 'text/csv');
  };

  const validity = useMemo(() => {
    const sample = published.slice(-25);
    const bad = sample.filter((a) => validateBundle(toFhirBundle(a, oneHealth(a), runCopilot(a, model).flags)).length > 0).length;
    return { checked: sample.length, bad };
  }, [published, model]);

  const weights = FEATURES.map((f, i) => ({ label: f.label, w: model.weights[i] })).sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
  const maxW = Math.max(...weights.map((w) => Math.abs(w.w)));

  return (
    <div className="grid gap-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kingfisher">Interoperability · open science</p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">Open data & standards</h1>
        <p className="mt-1 max-w-2xl text-ink-2">
          Every check becomes a standards-based record that researchers, water utilities and public-health agencies can use
          without re-keying — with provenance showing exactly what the citizen, the AI and the expert each contributed.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="font-display text-4xl font-semibold">{published.length}</p>
          <p className="text-sm text-ink-3">published records</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary px-3 py-2 text-sm" onClick={exportFhir}><Icon name="download" size={16} /> FHIR R4 bundle</button>
            <button className="btn btn-ghost px-3 py-2 text-sm" onClick={exportCsv}><Icon name="download" size={16} /> CSV</button>
          </div>
        </div>
        <div className="card p-5">
          <p className="font-display text-4xl font-semibold">{validity.checked - validity.bad}/{validity.checked}</p>
          <p className="text-sm text-ink-3">latest bundles pass structural validation (required elements, R4 status codes, value[x], reference integrity)</p>
        </div>
        <div className="card p-5">
          <p className="font-semibold">FHIR mapping</p>
          <ul className="mt-2 grid gap-1 font-mono text-xs text-ink-2">
            <li><b>Location</b> — sampling site (WGS84)</li>
            <li><b>Observation</b> — miniSASS + taxa components</li>
            <li><b>Observation</b> ×11 — water & habitat</li>
            <li><b>Observation</b> — One Health index</li>
            <li><b>DetectedIssue</b> — co-pilot flags</li>
            <li><b>Provenance</b> — citizen / AI / expert</li>
          </ul>
        </div>
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="arch">
        <h2 id="arch" className="font-display text-2xl font-semibold">Architecture</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          {[
            ['Citizen PWA', ['Guided 6-step check', 'Offline-first, installable', 'On-device photo analysis', 'No account needed'], 'var(--kingfisher)'],
            ['Co-pilot (on device)', ['Expert rules', 'Explainable ridge model', 'Photo cross-check', 'Human decides every flag'], 'var(--river)'],
            ['Insight & warning', ['One Health index', 'Trends & presence maps', 'Open-Meteo forecast', 'Site vulnerability'], 'var(--good)'],
            ['Integration', ['HL7 FHIR R4 bundles', 'CSV open data', 'Expert review loop', 'OneAquaHealth hub'], '#5b7fd9'],
          ].map(([title, items, c], i) => (
            <div key={title as string} className="relative rounded-2xl border border-line p-4" style={{ borderTop: `4px solid ${c}` }}>
              <p className="font-semibold">{title as string}</p>
              <ul className="mt-2 grid gap-1 text-ink-2">{(items as string[]).map((x) => <li key={x}>· {x}</li>)}</ul>
              {i < 3 && <span className="absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full bg-card text-ink-3 md:grid"><Icon name="arrowRight" size={14} /></span>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-3">
          The whole pipeline runs client-side, so it works in the field without signal and scales to any city at the cost of static hosting.
          The core is a pure TypeScript library (scoring, co-pilot, One Health, warnings, FHIR) covered by unit tests, ready to be reused by a
          server, the OneAquaHealth app, or a FHIR-based surveillance platform.
        </p>
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="model-card">
        <h2 id="model-card" className="font-display text-2xl font-semibold">Model card · plausibility model</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <dl className="grid gap-3 text-sm">
            <div><dt className="font-semibold">Purpose</dt><dd className="text-ink-2">Estimate the miniSASS score a stream <em>should</em> have from what the citizen saw, to prompt a double-check when the animals disagree. It never edits or rejects data.</dd></div>
            <div><dt className="font-semibold">Type</dt><dd className="text-ink-2">Ridge regression (λ = 2) on {FEATURES.length} interpretable features. Explanations are exact additive contributions, not approximations.</dd></div>
            <div><dt className="font-semibold">Training data</dt><dd className="text-ink-2">{model.n.toLocaleString()} synthetic records from a documented expert-prior generative model (diffuse urban pressure, habitat quality, point-source spills). R² = {model.r2.toFixed(2)}, residual SD = {model.residualSd.toFixed(2)}.</dd></div>
            <div><dt className="font-semibold">Decision rule</dt><dd className="text-ink-2">Flag when |observed − expected| &gt; 2 × residual SD. Expectation is revealed only after animals are recorded, to avoid anchoring bias.</dd></div>
            <div><dt className="font-semibold">Limitations</dt><dd className="text-ink-2">Not yet calibrated on real OneAquaHealth data; thresholds adapted from miniSASS (southern-African origin) and must be validated for European streams. Photo analysis is a colour heuristic affected by light.</dd></div>
            <div><dt className="font-semibold">Next step</dt><dd className="text-ink-2"><code>fitModel()</code> retrains on expert-verified records — every review in the queue becomes training data.</dd></div>
          </dl>
          <div>
            <p className="mb-2 text-sm font-semibold">Learned weights (effect on expected score)</p>
            <ul className="grid gap-1.5">
              {weights.map(({ label, w }) => (
                <li key={label} className="grid grid-cols-[1fr_110px_44px] items-center gap-2 text-xs">
                  <span className="truncate">{label}</span>
                  <span className="relative h-2 rounded-full bg-paper-2">
                    <span className="absolute top-0 h-2 rounded-full" style={{ background: w > 0 ? 'var(--good)' : 'var(--warning)', width: `${(Math.abs(w) / maxW) * 50}%`, left: w > 0 ? '50%' : `${50 - (Math.abs(w) / maxW) * 50}%` }} />
                  </span>
                  <span className="text-right font-mono">{w > 0 ? '+' : ''}{w.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="card p-5 text-sm text-ink-2 md:p-6" aria-labelledby="privacy">
        <h2 id="privacy" className="font-display text-2xl font-semibold text-ink">Privacy & responsible AI</h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          <li>✔︎ Photos are analysed on the device and never uploaded.</li>
          <li>✔︎ No login or personal data required; names are optional display names.</li>
          <li>✔︎ AI suggestions are explained in plain language with their source.</li>
          <li>✔︎ Citizens always decide; unusual findings are escalated, never deleted.</li>
          <li>✔︎ Every AI and human contribution is recorded in FHIR Provenance.</li>
          <li>✔︎ Reviewer agreement is tracked to monitor the co-pilot over time.</li>
        </ul>
      </section>
    </div>
  );
}
