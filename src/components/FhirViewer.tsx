import { useMemo, useState } from 'react';
import { runCopilot } from '../core/copilot';
import { toFhirBundle, validateBundle } from '../core/fhir';
import { defaultModel } from '../core/model';
import { oneHealth } from '../core/onehealth';
import type { Assessment } from '../core/types';
import { Icon } from './Icon';

export function download(filename: string, content: string, type = 'application/fhir+json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shows the HL7 FHIR R4 Bundle for one assessment, with live structural validation. */
export function FhirViewer({ record }: { record: Assessment }) {
  const [open, setOpen] = useState(false);
  const bundle = useMemo(() => {
    const flags = runCopilot(record, defaultModel()).flags;
    return toFhirBundle(record, oneHealth(record), flags);
  }, [record]);
  const issues = useMemo(() => validateBundle(bundle), [bundle]);
  const json = useMemo(() => JSON.stringify(bundle, null, 2), [bundle]);
  const counts = bundle.entry.reduce<Record<string, number>>((m, e) => ({ ...m, [e.resource.resourceType]: (m[e.resource.resourceType] ?? 0) + 1 }), {});

  return (
    <section className="card p-5" aria-labelledby="fhir">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="fhir" className="font-semibold">Interoperable record · HL7 FHIR R4</h2>
        <span className={`chip ${issues.length ? 'bg-warning-soft text-warning' : 'bg-good-soft text-good'}`}>
          <Icon name={issues.length ? 'alert' : 'check'} size={14} /> {issues.length ? `${issues.length} issues` : 'Structurally valid'}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-3">
        Ready for health and environment information systems: the same format hospitals use, so stream signals can sit next to
        public-health data in a One Health surveillance system.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(counts).map(([t, n]) => (
          <span key={t} className="chip bg-paper-2 font-mono text-ink-2">{t} × {n}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Icon name="code" size={16} /> {open ? 'Hide' : 'View'} JSON
        </button>
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => download(`riffle-${record.id}.fhir.json`, json)}>
          <Icon name="download" size={16} /> Download bundle
        </button>
      </div>
      {issues.length > 0 && (
        <ul className="mt-3 text-sm text-warning">
          {issues.map((i) => <li key={i.path + i.message}>{i.path}: {i.message}</li>)}
        </ul>
      )}
      {open && (
        <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-[#0d1c1c] p-4 font-mono text-xs leading-relaxed text-[#cfe6df]">{json}</pre>
      )}
    </section>
  );
}
