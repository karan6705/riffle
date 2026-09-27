// HL7 FHIR R4 mapping of a citizen stream assessment.
//
// Bundle (collection)
//  ├─ Location          — the sampling site (position = WGS84)
//  ├─ Observation       — miniSASS score (+ one component per group found)
//  ├─ Observation ×n    — water & habitat findings
//  ├─ Observation       — One Health index (ecosystem / people / animals)
//  ├─ DetectedIssue ×n  — co-pilot flags and the citizen's resolution
//  └─ Provenance        — who did what: citizen (author), co-pilot (verifier), expert
//
// Environmental observations have no LOINC codes yet, so we publish a small
// CodeSystem; UCUM is used for units. `subject` → Location is valid in R4.

import type { Flag } from './copilot';
import type { OneHealthScore } from './onehealth';
import { CATEGORIES } from './scoring';
import { TAXA_BY_ID } from './taxa';
import type { Assessment } from './types';

export const CS = 'https://riffle.app/fhir/CodeSystem/stream-assessment';
const OBS_CAT = 'http://terminology.hl7.org/CodeSystem/observation-category';
const UCUM = 'http://unitsofmeasure.org';

type Resource = { resourceType: string; id: string; [k: string]: unknown };
export interface BundleEntry { fullUrl: string; resource: Resource }
export interface Bundle {
  resourceType: 'Bundle';
  id: string;
  type: 'collection';
  timestamp: string;
  meta: { profile?: string[]; tag?: { system: string; code: string; display?: string }[] };
  entry: BundleEntry[];
}

const code = (c: string, display: string) => ({ coding: [{ system: CS, code: c, display }], text: display });
const urn = (id: string) => `urn:uuid:${id}`;

/** Stable, deterministic UUID-shaped id so re-exports of the same record are idempotent. */
export function stableId(...parts: string[]): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  const a = hex(h1), b = hex(h2), c = hex(Math.imul(h1 ^ h2, 3266489917) >>> 0), d = hex((h1 + h2) >>> 0);
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-a${c.slice(1, 4)}-${c.slice(4)}${d}`;
}

export function toFhirBundle(a: Assessment, oh: OneHealthScore, flags: Flag[]): Bundle {
  const entries: BundleEntry[] = [];
  const add = (r: Resource) => {
    entries.push({ fullUrl: urn(r.id), resource: r });
    return { reference: urn(r.id) };
  };
  const obsBase = (key: string) => ({
    resourceType: 'Observation',
    id: stableId(a.id, key),
    status: a.status === 'rejected' ? 'entered-in-error' : a.status === 'needs-review' ? 'preliminary' : 'final',
    effectiveDateTime: a.observedAt,
    performer: [{ display: a.observer }],
  });

  const location = add({
    resourceType: 'Location',
    id: stableId('site', a.siteId),
    identifier: [{ system: 'https://riffle.app/sites', value: a.siteId }],
    status: 'active',
    name: a.siteName,
    mode: 'instance',
    type: [{ coding: [{ system: CS, code: 'stream-monitoring-site', display: 'Urban freshwater stream monitoring site' }] }],
    physicalType: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/location-physical-type', code: 'area', display: 'Area' }] },
    position: { latitude: a.location.lat, longitude: a.location.lng },
  });

  const cat = CATEGORIES[oh.category];
  const bio = add({
    ...obsBase('minisass'),
    category: [{ coding: [{ system: OBS_CAT, code: 'survey', display: 'Survey' }] }],
    code: code('minisass-score', 'miniSASS average sensitivity score'),
    subject: location,
    valueQuantity: { value: oh.bugScore, unit: 'score', system: UCUM, code: '1' },
    interpretation: [{ coding: [{ system: CS, code: oh.category, display: cat.label }], text: cat.plain }],
    method: code('minisass-kick-sample', `Kick sample, ${a.samplingMinutes} min, ${a.habitat.substrate} bed`),
    component: a.taxa.map((id) => ({
      code: code(`taxon-${id}`, `${TAXA_BY_ID[id]?.name} (${TAXA_BY_ID[id]?.scientific})`),
      valueBoolean: true,
    })),
  });

  const water = a.water, hab = a.habitat;
  const findings: [string, string, Record<string, unknown>][] = [
    ['clarity', 'Water clarity', { valueCodeableConcept: code(water.clarity, water.clarity) }],
    ['colour', 'Water colour', { valueCodeableConcept: code(water.colour, water.colour) }],
    ['odour', 'Water odour', { valueCodeableConcept: code(water.smell, water.smell) }],
    ['foam-sheen', 'Foam or oily sheen present', { valueBoolean: water.foamOrSheen }],
    ['flow', 'Flow regime', { valueCodeableConcept: code(water.flow, water.flow) }],
    ['algae', 'Algal cover', { valueCodeableConcept: code(water.algae, water.algae) }],
    ['bank-vegetation', 'Bank vegetation cover (0–3)', { valueInteger: hab.bankVegetation }],
    ['shade', 'Canopy shade (0–3)', { valueInteger: hab.shade }],
    ['litter', 'Litter (0–3)', { valueInteger: hab.litter }],
    ['outfalls', 'Discharging pipes or outfalls', { valueBoolean: hab.pipesOrOutfalls }],
    ['urbanisation', 'Sealed surfaces nearby (0–3)', { valueInteger: hab.urbanisation }],
  ];
  if (water.temperature !== undefined) {
    findings.push(['water-temperature', 'Water temperature', { valueQuantity: { value: water.temperature, unit: '°C', system: UCUM, code: 'Cel' } }]);
  }
  const findingRefs = findings.map(([k, label, value]) =>
    add({
      ...obsBase(k),
      category: [{ coding: [{ system: OBS_CAT, code: 'exam', display: 'Exam' }] }],
      code: code(k, label),
      subject: location,
      ...value,
    }),
  );

  const index = add({
    ...obsBase('one-health'),
    category: [{ coding: [{ system: CS, code: 'one-health', display: 'One Health' }] }],
    code: code('one-health-index', 'One Health stream index'),
    subject: location,
    valueQuantity: { value: oh.overall, unit: '%', system: UCUM, code: '%' },
    derivedFrom: [bio, ...findingRefs],
    component: (['ecosystem', 'people', 'animals'] as const).map((k) => ({
      code: code(`one-health-${k}`, `${k[0].toUpperCase()}${k.slice(1)} health`),
      valueQuantity: { value: oh[k], unit: '%', system: UCUM, code: '%' },
    })),
  });

  const issueRefs = flags.map((f) => {
    const d = a.decisions.find((x) => x.flagId === f.id);
    return add({
      resourceType: 'DetectedIssue',
      id: stableId(a.id, 'flag', f.id),
      status: d ? 'final' : 'preliminary',
      severity: f.severity === 'critical' ? 'high' : f.severity === 'warning' ? 'moderate' : 'low',
      code: code(`copilot-${f.id}`, f.title),
      detail: `${f.message} ${f.why}`,
      identifiedDateTime: a.observedAt,
      author: { display: 'Riffle co-pilot' },
      implicated: [bio],
      mitigation: d
        ? [{ action: code(d.action === 'changed' ? 'citizen-corrected' : 'citizen-confirmed', d.action === 'changed' ? 'Citizen corrected the entry' : `Citizen confirmed${d.note ? `: ${d.note}` : ''}`) }]
        : undefined,
    });
  });

  const agents: Record<string, unknown>[] = [
    { type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'author' }] }, who: { display: a.observer } },
    { type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'verifier' }] }, who: { display: 'Riffle co-pilot (explainable model + rules, on-device)' } },
  ];
  if (a.reviewedBy) {
    agents.push({ type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'attester' }] }, who: { display: a.reviewedBy } });
  }
  add({
    resourceType: 'Provenance',
    id: stableId(a.id, 'provenance'),
    target: [bio, index, ...findingRefs, ...issueRefs],
    recorded: a.observedAt,
    activity: code(a.status, `Review status: ${a.status}`),
    agent: agents,
    location,
  });

  return {
    resourceType: 'Bundle',
    id: stableId(a.id, 'bundle'),
    type: 'collection',
    timestamp: a.observedAt,
    meta: { tag: [{ system: CS, code: a.demo ? 'demo-data' : 'citizen-data', display: a.demo ? 'Synthetic demo data' : 'Citizen science data' }] },
    entry: entries.map((e) => ({ ...e, resource: JSON.parse(JSON.stringify(e.resource)) })),
  };
}

export interface ValidationIssue { path: string; message: string }

const REQUIRED: Record<string, string[]> = {
  Location: [],
  Observation: ['status', 'code'],
  DetectedIssue: ['status'],
  Provenance: ['target', 'recorded', 'agent'],
};
const OBS_STATUS = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];

/** Lightweight structural validation: required elements, R4 status codes, choice[x] exclusivity, and internal reference integrity. */
export function validateBundle(b: Bundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (b.resourceType !== 'Bundle') issues.push({ path: 'resourceType', message: 'must be Bundle' });
  const urls = new Set(b.entry.map((e) => e.fullUrl));
  if (urls.size !== b.entry.length) issues.push({ path: 'entry', message: 'duplicate fullUrl' });
  b.entry.forEach((e, i) => {
    const r = e.resource;
    const p = `entry[${i}].resource(${r.resourceType})`;
    if (!r.id) issues.push({ path: p, message: 'missing id' });
    for (const field of REQUIRED[r.resourceType] ?? []) {
      if (r[field] === undefined || (Array.isArray(r[field]) && !(r[field] as unknown[]).length)) {
        issues.push({ path: `${p}.${field}`, message: 'required element missing' });
      }
    }
    if (r.resourceType === 'Observation') {
      if (!OBS_STATUS.includes(r.status as string)) issues.push({ path: `${p}.status`, message: 'invalid status' });
      const values = Object.keys(r).filter((k) => k.startsWith('value'));
      if (values.length > 1) issues.push({ path: p, message: 'only one value[x] allowed' });
    }
    // Every urn:uuid reference must resolve inside the bundle.
    JSON.stringify(r, (k, v) => {
      if (k === 'reference' && typeof v === 'string' && v.startsWith('urn:uuid:') && !urls.has(v)) {
        issues.push({ path: p, message: `unresolved reference ${v}` });
      }
      return v;
    });
  });
  return issues;
}
