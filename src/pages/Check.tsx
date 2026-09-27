import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { decide, runCopilot, type Flag, type WizardStep } from '../core/copilot';
import { defaultModel } from '../core/model';
import { analysePixels } from '../core/photo';
import { CATEGORIES, categorise } from '../core/scoring';
import { TAXA, type Taxon } from '../core/taxa';
import type { Assessment, FlagDecision, GeoPoint, HabitatObservation, Level, PhotoAnalysis, WaterObservation } from '../core/types';
import { BugIcon } from '../components/BugIcon';
import { Icon } from '../components/Icon';
import { PinMap } from '../components/PinMap';
import { distanceKm } from '../state/derived';
import { useSites, useStore } from '../state/store';

const STEPS: { id: WizardStep | 'review'; label: string }[] = [
  { id: 'site', label: 'Place' },
  { id: 'water', label: 'Water' },
  { id: 'habitat', label: 'Banks' },
  { id: 'bugs', label: 'Animals' },
  { id: 'photo', label: 'Photo' },
  { id: 'review', label: 'Co-pilot' },
];

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function Check() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sites = useSites();
  const { userName, setUserName, addAssessment, addSite } = useStore();
  const model = useMemo(() => defaultModel(), []);

  const [step, setStep] = useState(params.get('site') ? 1 : 0);
  const [siteId, setSiteId] = useState<string | 'new'>(params.get('site') ?? sites[0].id);
  const [newSiteName, setNewSiteName] = useState('');
  const [point, setPoint] = useState<GeoPoint>(sites.find((s) => s.id === params.get('site'))?.location ?? sites[0].location);
  const [when, setWhen] = useState(nowLocal());
  const [name, setName] = useState(userName === 'You' ? '' : userName);
  const [water, setWater] = useState<WaterObservation>({ clarity: 'clear', colour: 'clear', smell: 'none', foamOrSheen: false, flow: 'slow', algae: 'none' });
  const [habitat, setHabitat] = useState<HabitatObservation>({
    substrate: sites.find((s) => s.id === siteId)?.substrate ?? 'rocky',
    bankVegetation: 2, shade: 1, litter: 1, pipesOrOutfalls: false, urbanisation: 2,
  });
  const [taxa, setTaxa] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(5);
  const [photo, setPhoto] = useState<{ url: string; analysis: PhotoAnalysis } | undefined>();
  const [decisions, setDecisions] = useState<FlagDecision[]>([]);
  const [fixing, setFixing] = useState<string | null>(null);

  const site = sites.find((s) => s.id === siteId);
  const input = {
    water, habitat, taxa, samplingMinutes: minutes, photo: photo?.analysis,
    location: siteId === 'new' ? point : site?.location ?? point,
    observedAt: new Date(when).toISOString(),
  };
  // Keyed on the serialised input so the co-pilot only re-runs when an answer changes.
  const inputKey = JSON.stringify(input);
  const result = useMemo(() => runCopilot(JSON.parse(inputKey), model), [inputKey, model]);

  // When the citizen returns from fixing a flagged answer, record whether it resolved.
  const goReview = () => {
    if (fixing) {
      const still = result.flags.some((f) => f.id === fixing);
      if (!still) setDecisions((d) => [...d.filter((x) => x.flagId !== fixing), { flagId: fixing, action: 'changed' }]);
      setFixing(null);
    }
    setStep(5);
  };

  const canNext = step !== 0 || siteId !== 'new' || newSiteName.trim().length > 2;

  const submit = () => {
    const openFlags = result.flags;
    // Resolved-by-change flags are no longer in `openFlags`, but keep their decision for the record.
    const verdict = decide(openFlags, decisions);
    let finalSite = site;
    if (siteId === 'new') {
      finalSite = {
        id: `site-${Date.now().toString(36)}`,
        name: newSiteName.trim(),
        stream: newSiteName.trim(),
        city: 'Coimbra',
        location: point,
        substrate: habitat.substrate,
        vulnerability: habitat.urbanisation / 3,
        description: 'Site added by a citizen scientist.',
      };
      addSite(finalSite);
    }
    if (name.trim()) setUserName(name);
    const a: Assessment = {
      id: `rec-${Date.now().toString(36)}`,
      siteId: finalSite!.id,
      siteName: finalSite!.name,
      location: siteId === 'new' ? point : finalSite!.location,
      observedAt: input.observedAt,
      observer: name.trim() || 'You',
      samplingMinutes: minutes,
      water, habitat, taxa,
      photo: photo?.analysis,
      qualityScore: verdict.qualityScore,
      decisions,
      status: verdict.status,
    };
    addAssessment(a);
    navigate(`/record/${a.id}?new=1`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 flex items-center gap-3">
        <button className="btn btn-ghost px-3 py-2" onClick={() => navigate(-1)} aria-label="Leave stream check">
          <Icon name="x" size={18} />
        </button>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kingfisher">Stream check · step {step + 1} of 6</p>
          <h1 className="font-display text-2xl font-semibold">{['Where are you?', 'Look at the water', 'Look at the banks', 'Who lives here?', 'Snap the water (optional)', 'Co-pilot check'][step]}</h1>
        </div>
      </header>

      <ol className="mb-6 grid grid-cols-6 gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
              className="group w-full text-left disabled:cursor-default"
            >
              <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-river' : 'bg-line'}`} />
              <span className={`mt-1 hidden text-xs sm:block ${i === step ? 'font-semibold text-river' : 'text-ink-3'}`}>{s.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div key={step} className="rise">
        {step === 0 && (
          <SiteStep
            sites={sites} siteId={siteId} setSiteId={setSiteId} point={point} setPoint={setPoint}
            newSiteName={newSiteName} setNewSiteName={setNewSiteName} when={when} setWhen={setWhen}
            name={name} setName={setName}
            onSubstrate={(s) => setHabitat((h) => ({ ...h, substrate: s }))}
          />
        )}
        {step === 1 && <WaterStep water={water} setWater={setWater} />}
        {step === 2 && <HabitatStep habitat={habitat} setHabitat={setHabitat} />}
        {step === 3 && <BugStep taxa={taxa} setTaxa={setTaxa} minutes={minutes} setMinutes={setMinutes} />}
        {step === 4 && <PhotoStep photo={photo} setPhoto={setPhoto} />}
        {step === 5 && (
          <ReviewStep
            result={result}
            substrate={habitat.substrate}
            decisions={decisions}
            setDecisions={setDecisions}
            onFix={(f) => { setFixing(f.id); setStep(STEPS.findIndex((s) => s.id === f.step)); }}
          />
        )}
      </div>

      <footer className="sticky bottom-0 z-20 -mx-4 mt-8 flex gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        {step > 0 && (
          <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            <Icon name="arrowLeft" size={18} /> Back
          </button>
        )}
        <div className="flex-1" />
        {fixing && step < 5 && (
          <button className="btn btn-accent" onClick={goReview}>Back to co-pilot</button>
        )}
        {step < 4 && !fixing && (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next <Icon name="arrowRight" size={18} />
          </button>
        )}
        {step === 4 && !fixing && (
          <button className="btn btn-primary" onClick={goReview}>
            {photo ? 'Next' : 'Skip photo'} <Icon name="arrowRight" size={18} />
          </button>
        )}
        {step === 5 && (
          <button className="btn btn-accent" onClick={submit}>
            <Icon name="check" size={18} /> Submit my check
          </button>
        )}
      </footer>
    </div>
  );
}

/* ---------------- Reusable choice controls ---------------- */

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-6">
      <legend className="mb-1 font-semibold">{title}</legend>
      {hint && <p className="mb-3 text-sm text-ink-3">{hint}</p>}
      {children}
    </fieldset>
  );
}

function Choices<T extends string | number | boolean>({ value, options, onChange, cols = 3 }: {
  value: T;
  options: { value: T; label: string; hint?: string; swatch?: string; emoji?: string }[];
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div role="radiogroup" className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${cols >= 4 ? 120 : 140}px, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="tile flex items-center gap-3 p-3 text-left"
        >
          {o.swatch && <span className="size-9 shrink-0 rounded-full border border-line" style={{ background: o.swatch }} />}
          {o.emoji && <span className="text-2xl" aria-hidden="true">{o.emoji}</span>}
          <span>
            <span className="block font-medium leading-tight">{o.label}</span>
            {o.hint && <span className="text-xs text-ink-3">{o.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

const LEVELS: { value: Level; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 1, label: 'A little' },
  { value: 2, label: 'A lot' },
  { value: 3, label: 'Everywhere' },
];

/* ---------------- Steps ---------------- */

function SiteStep(p: {
  sites: ReturnType<typeof useSites>; siteId: string; setSiteId: (s: string) => void;
  point: GeoPoint; setPoint: (p: GeoPoint) => void; newSiteName: string; setNewSiteName: (s: string) => void;
  when: string; setWhen: (s: string) => void; name: string; setName: (s: string) => void;
  onSubstrate: (s: 'rocky' | 'sandy') => void;
}) {
  const [gps, setGps] = useState<'idle' | 'busy' | 'error'>('idle');
  const locate = () => {
    if (!navigator.geolocation) return setGps('error');
    setGps('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        p.setPoint(here);
        const near = p.sites.find((s) => distanceKm(here, s.location) < 0.15);
        if (near) p.setSiteId(near.id);
        else p.setSiteId('new');
        setGps('idle');
      },
      () => setGps('error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const sorted = [...p.sites].sort((a, b) => distanceKm(p.point, a.location) - distanceKm(p.point, b.location));
  return (
    <div>
      <div className="card mb-5 overflow-hidden">
        <PinMap
          value={p.point}
          sites={p.sites}
          onPick={(pt) => { p.setPoint(pt); p.setSiteId('new'); }}
          onSite={(s) => { p.setSiteId(s.id); p.setPoint(s.location); p.onSubstrate(s.substrate); }}
        />
        <div className="flex flex-wrap items-center gap-2 p-3 text-sm">
          <button type="button" className="btn btn-ghost px-3 py-2 text-sm" onClick={locate}>
            <Icon name="pin" size={16} /> {gps === 'busy' ? 'Finding you…' : 'Use my GPS'}
          </button>
          <span className="text-ink-3">{gps === 'error' ? 'Could not get your location — tap the map instead.' : 'Tap a dot to pick a known site, or tap the map to add a new one.'}</span>
        </div>
      </div>

      <Question title="Which site?">
        <div className="grid gap-2">
          {sorted.slice(0, 6).map((s) => (
            <button
              key={s.id} type="button" role="radio" aria-checked={p.siteId === s.id}
              onClick={() => { p.setSiteId(s.id); p.setPoint(s.location); p.onSubstrate(s.substrate); }}
              className="tile flex items-center gap-3 p-3 text-left"
            >
              <Icon name="wave" className="text-river" />
              <span className="flex-1">
                <span className="block font-medium">{s.name}</span>
                <span className="text-xs text-ink-3">{s.stream}</span>
              </span>
              <span className="font-mono text-xs text-ink-3">{distanceKm(p.point, s.location).toFixed(1)} km</span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={p.siteId === 'new'} onClick={() => p.setSiteId('new')} className="tile flex items-center gap-3 p-3 text-left">
            <Icon name="plus" className="text-kingfisher" />
            <span className="font-medium">A new place (use the pin on the map)</span>
          </button>
        </div>
        {p.siteId === 'new' && (
          <label className="mt-3 block">
            <span className="text-sm font-medium">Give this place a name</span>
            <input
              value={p.newSiteName}
              onChange={(e) => p.setNewSiteName(e.target.value)}
              placeholder="e.g. Footbridge behind the school"
              className="mt-1 w-full rounded-xl border border-line bg-card px-4 py-3"
            />
          </label>
        )}
      </Question>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">When</span>
          <input type="datetime-local" value={p.when} onChange={(e) => p.setWhen(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-card px-4 py-3" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Your name or group (shown with your records)</span>
          <input value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="e.g. Ana, or Class 7B" className="mt-1 w-full rounded-xl border border-line bg-card px-4 py-3" />
        </label>
      </div>
    </div>
  );
}

function WaterStep({ water, setWater }: { water: WaterObservation; setWater: (w: WaterObservation) => void }) {
  const set = <K extends keyof WaterObservation>(k: K, v: WaterObservation[K]) => setWater({ ...water, [k]: v });
  return (
    <div>
      <Tip>Scoop some water into a clear cup or jar and hold it against something white.</Tip>
      <Question title="How clear is it?">
        <Choices value={water.clarity} onChange={(v) => set('clarity', v)} options={[
          { value: 'clear', label: 'Clear', hint: 'See straight through', swatch: 'linear-gradient(135deg,#eef6f5,#d6ebe6)' },
          { value: 'slightly-cloudy', label: 'A bit cloudy', hint: 'Slightly hazy', swatch: 'linear-gradient(135deg,#dfe3dc,#bfc8bd)' },
          { value: 'murky', label: 'Murky', hint: "Can't see through", swatch: 'linear-gradient(135deg,#a7a08a,#7d7563)' },
        ]} />
      </Question>
      <Question title="What colour?">
        <Choices value={water.colour} onChange={(v) => set('colour', v)} cols={5} options={[
          { value: 'clear', label: 'No colour', swatch: '#e9f1ef' },
          { value: 'brown', label: 'Brown / tea', swatch: '#a67c52' },
          { value: 'green', label: 'Green', swatch: '#6c9a45' },
          { value: 'grey', label: 'Grey / milky', swatch: '#a9aaa6' },
          { value: 'other', label: 'Other', swatch: 'conic-gradient(#d9622b,#e3b23c,#5b8fd9,#d9622b)' },
        ]} />
      </Question>
      <Question title="Does it smell?" hint="Waft the air over the cup towards your nose — don't sniff directly.">
        <Choices value={water.smell} onChange={(v) => set('smell', v)} cols={4} options={[
          { value: 'none', label: 'Nothing', emoji: '🙂' },
          { value: 'earthy', label: 'Earthy / leafy', emoji: '🍂' },
          { value: 'sewage', label: 'Sewage / rotten eggs', emoji: '🤢' },
          { value: 'chemical', label: 'Chemical / petrol', emoji: '⚗️' },
        ]} />
      </Question>
      <Question title="Foam, bubbles that stay, or an oily rainbow sheen?">
        <Choices value={water.foamOrSheen} onChange={(v) => set('foamOrSheen', v)} options={[
          { value: false, label: 'No' },
          { value: true, label: 'Yes', hint: 'Foam or rainbow film' },
        ]} />
      </Question>
      <Question title="How is it flowing?">
        <Choices value={water.flow} onChange={(v) => set('flow', v)} options={[
          { value: 'still', label: 'Still', hint: 'Like a pond' },
          { value: 'slow', label: 'Slow', hint: 'Gently moving' },
          { value: 'fast', label: 'Fast', hint: 'Bubbly, over stones' },
        ]} />
      </Question>
      <Question title="Green or brown slime on stones, or scum on the surface?">
        <Choices value={water.algae} onChange={(v) => set('algae', v)} options={[
          { value: 'none', label: 'None' },
          { value: 'some', label: 'Some', hint: 'Thin film' },
          { value: 'lots', label: 'Lots', hint: 'Thick mats or scum' },
        ]} />
      </Question>
      <Question title="Water temperature (optional)" hint="If you have a thermometer, hold it in the water for a minute.">
        <div className="flex items-center gap-3">
          <input
            type="number" inputMode="decimal" step="0.1" min={-5} max={120}
            value={water.temperature ?? ''}
            onChange={(e) => set('temperature', e.target.value === '' ? undefined : Number(e.target.value))}
            className="w-32 rounded-xl border border-line bg-card px-4 py-3 font-mono"
            aria-label="Water temperature in degrees Celsius"
            placeholder="—"
          />
          <span className="text-ink-2">°C</span>
        </div>
      </Question>
    </div>
  );
}

function HabitatStep({ habitat, setHabitat }: { habitat: HabitatObservation; setHabitat: (h: HabitatObservation) => void }) {
  const set = <K extends keyof HabitatObservation>(k: K, v: HabitatObservation[K]) => setHabitat({ ...habitat, [k]: v });
  return (
    <div>
      <Tip>Look 10 steps upstream and downstream from where you are standing.</Tip>
      <Question title="What is the stream bed mostly made of?" hint="This changes how the animal score is read.">
        <Choices value={habitat.substrate} onChange={(v) => set('substrate', v)} options={[
          { value: 'rocky', label: 'Stones & pebbles', emoji: '🪨' },
          { value: 'sandy', label: 'Sand, silt or mud', emoji: '🏖️' },
        ]} />
      </Question>
      <Question title="Plants growing along the banks"><Choices value={habitat.bankVegetation} onChange={(v) => set('bankVegetation', v)} options={LEVELS} cols={4} /></Question>
      <Question title="Trees shading the water"><Choices value={habitat.shade} onChange={(v) => set('shade', v)} options={LEVELS} cols={4} /></Question>
      <Question title="Litter in or next to the water"><Choices value={habitat.litter} onChange={(v) => set('litter', v)} options={LEVELS} cols={4} /></Question>
      <Question title="Roads, roofs and pavement nearby"><Choices value={habitat.urbanisation} onChange={(v) => set('urbanisation', v)} options={LEVELS} cols={4} /></Question>
      <Question title="Any pipes or drains pouring into the stream?">
        <Choices value={habitat.pipesOrOutfalls} onChange={(v) => set('pipesOrOutfalls', v)} options={[
          { value: false, label: 'No' },
          { value: true, label: 'Yes', hint: 'Water coming out of a pipe' },
        ]} />
      </Question>
    </div>
  );
}

function BugStep({ taxa, setTaxa, minutes, setMinutes }: { taxa: string[]; setTaxa: (t: string[]) => void; minutes: number; setMinutes: (m: number) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);
  const startTimer = () => {
    if (timer.current) window.clearInterval(timer.current);
    setLeft(300);
    timer.current = window.setInterval(() => {
      setLeft((l) => {
        if (l === null || l <= 1) {
          if (timer.current) window.clearInterval(timer.current);
          setMinutes(5);
          if ('vibrate' in navigator) navigator.vibrate?.(300);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
  };
  const toggle = (id: string) => setTaxa(taxa.includes(id) ? taxa.filter((t) => t !== id) : [...taxa, id]);
  const groups: [string, Taxon[]][] = [
    ['Very sensitive', TAXA.filter((t) => t.sensitivity === 'very-sensitive')],
    ['Sensitive', TAXA.filter((t) => t.sensitivity === 'sensitive')],
    ['Hardy', TAXA.filter((t) => t.sensitivity === 'tolerant')],
  ];
  return (
    <div>
      <div className="card mb-5 grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="font-semibold">How to find them</p>
          <p className="text-sm text-ink-2">
            Hold a net or sieve downstream, then gently rub stones and stir the bottom with your feet for a few minutes.
            Tip the catch into a white tray with some water and look closely. Put everything back afterwards!
          </p>
        </div>
        <div className="flex items-center gap-3">
          {left !== null && left > 0 ? (
            <span className="font-mono text-3xl font-semibold tabular-nums text-river" role="timer" aria-live="off">
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={startTimer}>
              ⏱ {left === 0 ? 'Done! Restart' : '5-min timer'}
            </button>
          )}
          <label className="text-sm">
            <span className="sr-only">Minutes searched</span>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="rounded-full border border-line bg-paper px-3 py-2">
              {[1, 2, 3, 4, 5, 8, 10].map((m) => <option key={m} value={m}>{m} min searched</option>)}
            </select>
          </label>
        </div>
      </div>

      <p className="mb-4 text-sm text-ink-2">
        Tap every kind of animal you found. <strong>{taxa.length} selected.</strong> Not sure? Tap "How to tell" to compare.
      </p>
      {groups.map(([label, list]) => (
        <section key={label} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((t) => {
              const on = taxa.includes(t.id);
              return (
                <div key={t.id} className="tile relative flex flex-col" aria-pressed={on}>
                  <button type="button" onClick={() => toggle(t.id)} aria-pressed={on} className="flex flex-1 flex-col items-center p-3 text-center">
                    {on && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-river text-paper"><Icon name="check" size={14} strokeWidth={3} /></span>}
                    <BugIcon taxon={t} size={76} />
                    <span className="mt-1 font-medium leading-tight">{t.name}</span>
                  </button>
                  <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className="border-t border-line px-3 py-1.5 text-xs font-semibold text-river" aria-expanded={open === t.id}>
                    How to tell
                  </button>
                  {open === t.id && (
                    <div className="border-t border-line p-3 text-xs text-ink-2">
                      <p><strong>Look for:</strong> {t.lookFor}</p>
                      <p className="mt-1"><strong>Why it matters:</strong> {t.whyItMatters}</p>
                      <p className="mt-1 font-mono text-ink-3">{t.scientific} · weight {t.weight}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <button type="button" className="text-sm font-semibold text-ink-3 underline" onClick={() => setTaxa([])}>
        I searched and found nothing
      </button>
    </div>
  );
}

function PhotoStep({ photo, setPhoto }: { photo?: { url: string; analysis: PhotoAnalysis }; setPhoto: (p?: { url: string; analysis: PhotoAnalysis }) => void }) {
  const [busy, setBusy] = useState(false);
  const onFile = (file?: File) => {
    if (!file) return;
    setBusy(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = 160 / Math.max(img.width, img.height);
      const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      setPhoto({ url, analysis: analysePixels(ctx.getImageData(0, 0, w, h).data, w, h) });
      setBusy(false);
    };
    img.onerror = () => setBusy(false);
    img.src = url;
  };
  const a = photo?.analysis;
  return (
    <div>
      <Tip>Fill a white cup or tray with stream water and photograph it from above, in daylight. The photo is analysed on your phone and never uploaded.</Tip>
      <label className="card flex cursor-pointer flex-col items-center gap-3 border-dashed p-8 text-center hover:bg-paper-2/40">
        {photo ? (
          <img src={photo.url} alt="Your water photo" className="max-h-64 rounded-xl object-contain" />
        ) : (
          <>
            <Icon name="camera" size={40} className="text-river" />
            <span className="font-semibold">Take or choose a photo</span>
          </>
        )}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        {busy && <span className="text-sm text-ink-3">Analysing colour…</span>}
      </label>
      {a && (
        <div className="card mt-4 flex items-center gap-4 p-4">
          <span className="size-14 shrink-0 rounded-xl border border-line" style={{ background: `rgb(${a.meanRgb.join(',')})` }} />
          <div className="text-sm">
            <p className="font-semibold">On-device reading: looks <span className="text-river">{a.tint}</span></p>
            <p className="font-mono text-xs text-ink-3">hue {Math.round(a.hue)}° · saturation {Math.round(a.saturation * 100)}% · brightness {Math.round(a.brightness * 100)}% · confidence {Math.round(a.confidence * 100)}%</p>
            <button type="button" className="mt-1 text-xs font-semibold text-warning underline" onClick={() => setPhoto(undefined)}>Remove photo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ result, substrate, decisions, setDecisions, onFix }: {
  result: ReturnType<typeof runCopilot>;
  substrate: 'rocky' | 'sandy';
  decisions: FlagDecision[];
  setDecisions: (d: FlagDecision[]) => void;
  onFix: (f: Flag) => void;
}) {
  const { observed, prediction, flags } = result;
  const cat = categorise(observed, substrate);
  const max = 12;
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const decisionFor = (id: string) => decisions.find((d) => d.flagId === id);
  const setDecision = (d: FlagDecision) => setDecisions([...decisions.filter((x) => x.flagId !== d.flagId), d]);
  const topContribs = prediction.contributions.slice(0, 6);
  const maxEffect = Math.max(0.5, ...topContribs.map((c) => Math.abs(c.effect)));
  const corrected = decisions.filter((d) => d.action === 'changed');

  return (
    <div className="grid gap-5">
      <section className="card p-5" aria-labelledby="exp">
        <h2 id="exp" className="font-semibold">Your animals vs. what the stream suggests</h2>
        <p className="mb-5 text-sm text-ink-3">
          The co-pilot only reveals its expectation now — after you recorded your animals — so it can't bias what you see.
        </p>
        <div className="relative mb-2 h-10">
          <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-paper-2" />
          <div className="absolute top-3 h-4 rounded-full bg-shallows" style={{ left: pos(Math.max(0, prediction.low)), width: `calc(${pos(prediction.high)} - ${pos(Math.max(0, prediction.low))})` }} title="Expected range" />
          <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: pos(observed) }}>
            <span className="size-10 rounded-full border-4 border-card shadow" style={{ background: CATEGORIES[cat].colour }} />
          </div>
        </div>
        <div className="flex justify-between font-mono text-xs text-ink-3"><span>0</span><span>6</span><span>12</span></div>
        <p className="mt-3 text-sm">
          Your score <strong className="font-mono">{observed.toFixed(1)}</strong> ({CATEGORIES[cat].label}) · expected{' '}
          <strong className="font-mono">{Math.max(0, prediction.low).toFixed(1)}–{prediction.high.toFixed(1)}</strong> for a stream that looks like this.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-river">Why does the co-pilot expect that?</summary>
          <ul className="mt-3 grid gap-2">
            {topContribs.map((c) => (
              <li key={c.key} className="grid grid-cols-[1fr_120px_48px] items-center gap-3 text-sm">
                <span>{c.label}</span>
                <span className="relative h-2 rounded-full bg-paper-2">
                  <span
                    className="absolute top-0 h-2 rounded-full"
                    style={{
                      background: c.effect > 0 ? 'var(--good)' : 'var(--warning)',
                      width: `${(Math.abs(c.effect) / maxEffect) * 50}%`,
                      left: c.effect > 0 ? '50%' : `${50 - (Math.abs(c.effect) / maxEffect) * 50}%`,
                    }}
                  />
                  <span className="absolute left-1/2 top-[-3px] h-3.5 w-px bg-ink-3" />
                </span>
                <span className="text-right font-mono text-xs">{c.effect > 0 ? '+' : ''}{c.effect.toFixed(1)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            Transparent linear model: each bar is how much that observation moves the expected score from the average stream.
            Trained on 2,500 expert-prior records; designed to be retrained on verified OneAquaHealth data.
          </p>
        </details>
      </section>

      {flags.length === 0 ? (
        <section className="card flex items-center gap-4 border-good/40 bg-good-soft p-5">
          <Icon name="check" size={28} className="text-good" />
          <div>
            <p className="font-semibold">Everything is consistent{corrected.length ? ' — thanks for double-checking!' : ''}</p>
            <p className="text-sm text-ink-2">The co-pilot found nothing unusual. Your check will be published straight away.</p>
          </div>
        </section>
      ) : (
        <section aria-labelledby="flags">
          <h2 id="flags" className="mb-2 font-semibold">The co-pilot has {flags.length} question{flags.length > 1 ? 's' : ''} for you</h2>
          <p className="mb-3 text-sm text-ink-3">You are the scientist here. Change your answer, or tell us you're sure — unusual findings are often the most valuable.</p>
          <ul className="grid gap-3">
            {flags.map((f) => {
              const d = decisionFor(f.id);
              const tone = f.severity === 'critical' ? 'border-warning/50' : f.severity === 'warning' ? 'border-caution/50' : 'border-line';
              return (
                <li key={f.id} className={`card border-l-4 p-4 ${tone}`}>
                  <div className="flex items-start gap-3">
                    <Icon name={f.severity === 'info' ? 'info' : 'alert'} className={f.severity === 'critical' ? 'text-warning' : f.severity === 'warning' ? 'text-caution' : 'text-river'} />
                    <div className="flex-1">
                      <p className="font-semibold">{f.title}</p>
                      <p className="text-sm">{f.message}</p>
                      <p className="mt-2 text-sm text-ink-2"><strong>Why:</strong> {f.why}</p>
                      <p className="mt-1 text-sm text-ink-2"><strong>Try:</strong> {f.suggestion}</p>
                      <p className="mt-1 text-[0.7rem] uppercase tracking-wider text-ink-3">Source: {f.source === 'model' ? 'plausibility model' : f.source === 'photo' ? 'photo analysis' : 'expert rule'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => onFix(f)}>Go back & check</button>
                        <button
                          type="button"
                          className={`btn px-3 py-1.5 text-sm ${d?.action === 'confirmed' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setDecision({ flagId: f.id, action: 'confirmed', note: d?.note })}
                        >
                          I'm sure
                        </button>
                      </div>
                      {d?.action === 'confirmed' && (
                        <label className="mt-3 block">
                          <span className="text-xs font-medium text-ink-2">Tell the experts what you saw (earns trust & XP)</span>
                          <input
                            value={d.note ?? ''}
                            onChange={(e) => setDecision({ ...d, note: e.target.value })}
                            placeholder="e.g. Counted 2 tails on 3 animals"
                            className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-ink-3">
            {decide(flags, decisions).status === 'needs-review'
              ? 'This check will be published as preliminary and sent to a local expert for a quick look.'
              : 'This check will be published straight away.'}
          </p>
        </section>
      )}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-5 flex gap-3 rounded-2xl bg-shallows/30 p-3 text-sm text-ink-2">
      <Icon name="drop" className="mt-0.5 shrink-0 text-river" /> <span>{children}</span>
    </p>
  );
}
