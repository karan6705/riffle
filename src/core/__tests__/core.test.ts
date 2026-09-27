import { describe, expect, it } from 'vitest';
import { decide, runCopilot, type CopilotInput } from '../copilot';
import { toFhirBundle, validateBundle, stableId } from '../fhir';
import { earnedBadges, levelFor, weekStreak, xpFor } from '../gamification';
import { defaultModel } from '../model';
import { oneHealth } from '../onehealth';
import { analysePixels } from '../photo';
import { SITES, seedAssessments } from '../seed';
import type { Assessment } from '../types';
import { alertsFor, groupAlerts, parseOpenMeteo, siteRisk, stressScenario } from '../warning';

const clean: CopilotInput = {
  water: { clarity: 'clear', colour: 'clear', smell: 'none', foamOrSheen: false, flow: 'fast', algae: 'none', temperature: 14 },
  habitat: { substrate: 'rocky', bankVegetation: 3, shade: 3, litter: 0, pipesOrOutfalls: false, urbanisation: 0 },
  taxa: ['stoneflies', 'other-mayflies', 'caddisflies', 'crabs-shrimps', 'minnow-mayflies'],
  samplingMinutes: 5,
  location: { lat: 40.2, lng: -8.4, accuracy: 8 },
  observedAt: '2026-09-01T10:00:00Z',
};
const now = new Date('2026-09-27T12:00:00Z');
const ids = (a: CopilotInput) => runCopilot(a, defaultModel(), now).flags.map((f) => f.id);

describe('co-pilot', () => {
  it('raises nothing for a consistent clean record', () => {
    expect(ids(clean)).toEqual([]);
  });
  it('flags sensitive animals in sewage-like water', () => {
    expect(ids({ ...clean, water: { ...clean.water, smell: 'sewage', colour: 'grey' } })).toContain('sensitive-vs-sewage');
  });
  it('recognises a Fahrenheit temperature', () => {
    const r = runCopilot({ ...clean, water: { ...clean.water, temperature: 64 } }, defaultModel(), now);
    const f = r.flags.find((x) => x.id === 'temperature-range')!;
    expect(f.severity).toBe('critical');
    expect(f.why).toContain('17.8 °C');
  });
  it('flags a model deviation with explained drivers', () => {
    const polluted: CopilotInput = {
      ...clean,
      water: { clarity: 'murky', colour: 'grey', smell: 'chemical', foamOrSheen: true, flow: 'slow', algae: 'lots' },
      habitat: { substrate: 'sandy', bankVegetation: 0, shade: 0, litter: 3, pipesOrOutfalls: true, urbanisation: 3 },
      taxa: ['stoneflies', 'other-mayflies'],
    };
    const r = runCopilot(polluted, defaultModel(), now);
    const f = r.flags.find((x) => x.id === 'model-deviation');
    expect(f).toBeDefined();
    expect(r.zScore).toBeGreaterThan(2);
    expect(f!.why).toMatch(/Biggest drivers/);
  });
  it('handles empty samples, future dates and poor GPS', () => {
    const got = ids({ ...clean, taxa: [], samplingMinutes: 2, observedAt: '2027-01-01T00:00:00Z', location: { lat: 0, lng: 0, accuracy: 500 } });
    expect(got).toEqual(expect.arrayContaining(['no-animals', 'future-date', 'gps-accuracy']));
  });
  it('detects photo/answer disagreement', () => {
    const photo = { meanRgb: [60, 120, 50] as [number, number, number], hue: 110, saturation: 0.6, brightness: 0.5, greenIndex: 0.52, tint: 'green' as const, confidence: 0.9 };
    expect(ids({ ...clean, photo })).toContain('photo-mismatch');
  });
  it('routes unresolved warnings to experts; corrections restore quality', () => {
    const r = runCopilot({ ...clean, water: { ...clean.water, smell: 'sewage' } }, defaultModel(), now);
    expect(decide(r.flags, []).status).toBe('needs-review');
    const fixed = decide(r.flags, r.flags.map((f) => ({ flagId: f.id, action: 'changed' as const })));
    expect(fixed).toEqual({ qualityScore: 100, status: 'auto-accepted' });
    const noted = decide(r.flags, r.flags.map((f) => ({ flagId: f.id, action: 'confirmed' as const, note: 'sure' })));
    expect(noted.qualityScore).toBeGreaterThan(decide(r.flags, []).qualityScore);
  });
});

describe('photo analysis', () => {
  const solid = (r: number, g: number, b: number, n = 20) => {
    const d: number[] = [];
    for (let i = 0; i < n * n; i++) d.push(r, g, b, 255);
    return analysePixels(d, n, n);
  };
  it('classifies tints', () => {
    expect(solid(70, 140, 60).tint).toBe('green');
    expect(solid(150, 110, 60).tint).toBe('brown');
    expect(solid(140, 140, 138).tint).toBe('grey');
    expect(solid(235, 238, 240).tint).toBe('clear');
  });
  it('ignores specular highlights', () => {
    expect(solid(255, 255, 255).confidence).toBe(0);
  });
});

describe('One Health', () => {
  it('scores a clean stream as good', () => {
    const oh = oneHealth(clean);
    expect(oh.band).toBe('good');
    expect(oh.category).toBe('natural');
  });
  it('warns pet owners about blooms and people about sewage after rain', () => {
    const oh = oneHealth(
      { ...clean, water: { ...clean.water, algae: 'lots', colour: 'green', flow: 'still' }, habitat: { ...clean.habitat, urbanisation: 3 }, taxa: ['worms'] },
      { recentRain: 25 },
    );
    expect(oh.advice.find((a) => a.audience === 'pets')?.tone).toBe('warning');
    expect(oh.advice.find((a) => a.audience === 'people')?.tone).toBe('warning');
    expect(oh.overall).toBeLessThan(55);
  });
});

describe('early warning', () => {
  it('raises overflow/flood and heat alerts under the stress scenario', () => {
    const risk = siteRisk(SITES[1], stressScenario(now));
    const alerts = alertsFor(SITES[1], risk, '2026-01-01');
    const types = alerts.map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(['overflow', 'heat']));
    expect(alerts[0].level).toBe('warning');
  });
  it('stays quiet on calm weather', () => {
    const calm = stressScenario(now).map((d) => ({ ...d, precip: 0, tmax: 22 }));
    expect(alertsFor(SITES[0], siteRisk(SITES[0], calm))).toEqual([]);
  });
  it('ignores past days and groups alerts across sites', () => {
    const days = stressScenario(now);
    const risk = siteRisk(SITES[1], days);
    const future = alertsFor(SITES[1], risk, days[7].date);
    expect(future.every((a) => a.date >= days[7].date)).toBe(true);
    const groups = groupAlerts(SITES.map((site) => ({ site, alerts: alertsFor(site, siteRisk(site, days), '2026-01-01') })));
    const keys = groups.map((g) => g.type + g.date);
    expect(new Set(keys).size).toBe(keys.length);
    expect(groups[0].level).toBe('warning');
    expect(groups.some((g) => g.sites.length > 1)).toBe(true);
  });
  it('parses Open-Meteo payloads', () => {
    const days = parseOpenMeteo({ daily: { time: ['2026-09-27'], precipitation_sum: [null], temperature_2m_max: [21.5] } });
    expect(days).toEqual([{ date: '2026-09-27', precip: 0, tmax: 21.5 }]);
    expect(() => parseOpenMeteo({})).toThrow();
  });
});

describe('FHIR R4 export', () => {
  const a: Assessment = {
    ...clean,
    id: 'test-1',
    siteId: 's1',
    siteName: 'Test site',
    observer: 'Tester',
    water: { ...clean.water, smell: 'sewage' },
    qualityScore: 90,
    decisions: [{ flagId: 'sensitive-vs-sewage', action: 'confirmed', note: 'sure' }],
    status: 'needs-review',
  };
  const r = runCopilot(a, defaultModel(), now);
  const bundle = toFhirBundle(a, oneHealth(a), r.flags);
  it('produces a structurally valid bundle', () => {
    expect(validateBundle(bundle)).toEqual([]);
    const types = bundle.entry.map((e) => e.resource.resourceType);
    expect(types).toEqual(expect.arrayContaining(['Location', 'Observation', 'DetectedIssue', 'Provenance']));
  });
  it('marks unreviewed flagged records as preliminary', () => {
    const obs = bundle.entry.find((e) => e.resource.resourceType === 'Observation')!.resource;
    expect(obs.status).toBe('preliminary');
  });
  it('detects broken references', () => {
    const broken = structuredClone(bundle);
    broken.entry = broken.entry.filter((e) => e.resource.resourceType !== 'Location');
    expect(validateBundle(broken).some((i) => i.message.startsWith('unresolved reference'))).toBe(true);
  });
  it('generates stable UUID-shaped ids', () => {
    expect(stableId('x')).toBe(stableId('x'));
    expect(stableId('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('gamification', () => {
  it('computes levels and streaks', () => {
    expect(levelFor(0).level.name).toBe('Tadpole');
    expect(levelFor(450).level.name).toBe('Caddis Builder');
    const d = (s: string) => new Date(s);
    expect(weekStreak([d('2026-09-25'), d('2026-09-17'), d('2026-09-09')], d('2026-09-27'))).toBe(3);
    expect(weekStreak([d('2026-08-01')], d('2026-09-27'))).toBe(0);
  });
  it('rewards honest corrections', () => {
    const base = { ...clean, id: 'x', siteId: 's', siteName: 's', observer: 'me', qualityScore: 100, status: 'auto-accepted' as const };
    const a = { ...base, decisions: [{ flagId: 'f', action: 'changed' as const }] };
    expect(xpFor(a).total).toBeGreaterThan(xpFor({ ...base, decisions: [] }).total);
    expect(earnedBadges([a], now).has('honest-scientist')).toBe(true);
  });
});

describe('seed data over time', () => {
  it.each(['2026-09-26', '2026-10-02', '2026-10-15', '2027-01-20', '2027-06-30'])('stays plausible when generated on %s', (day) => {
    const at = new Date(`${day}T10:00:00Z`);
    const data = seedAssessments(at);
    expect(data.every((a) => new Date(a.observedAt) < at)).toBe(true);
    const recent = data.filter((a) => at.getTime() - new Date(a.observedAt).getTime() < 30 * 86400000);
    expect(recent.length).toBeGreaterThan(5);
    const eco = (site: string, from: number, to?: number) => {
      const xs = data.filter((a) => a.siteId === site && !a.id.includes('review')).slice(from, to).map((a) => oneHealth(a).ecosystem);
      return xs.reduce((s, x) => s + x, 0) / xs.length;
    };
    expect(eco('coselhas-up', 0)).toBeGreaterThan(eco('coselhas-urban', 0));
    expect(eco('coselhas-urban', 0, 8)).toBeGreaterThan(eco('coselhas-urban', -6));
  });
});

describe('seed data', () => {
  const data = seedAssessments();
  it('is deterministic and plausible', () => {
    expect(seedAssessments().length).toBe(data.length);
    expect(data.length).toBeGreaterThan(100);
    expect(data.filter((a) => a.status === 'needs-review').length).toBeGreaterThanOrEqual(2);
  });
  it('tells the intended stories', () => {
    const avg = (site: string, from: number, to: number) => {
      const xs = data.filter((a) => a.siteId === site && !a.id.includes('review')).slice(from, to).map((a) => oneHealth(a).ecosystem);
      return xs.reduce((s, x) => s + x, 0) / xs.length;
    };
    // Reference reach healthier than the urban reach, and the urban reach degrades.
    expect(avg('coselhas-up', 0, 30)).toBeGreaterThan(avg('coselhas-urban', 0, 30));
    expect(avg('coselhas-urban', 0, 8)).toBeGreaterThan(avg('coselhas-urban', -6, undefined as unknown as number));
    // Restored reach improves.
    expect(avg('covoes-hospital', -6, undefined as unknown as number)).toBeGreaterThan(avg('covoes-hospital', 0, 6));
    // Every demo record exports to a valid FHIR bundle.
    for (const a of data.slice(0, 40)) {
      const r = runCopilot(a, defaultModel(), now);
      expect(validateBundle(toFhirBundle(a, oneHealth(a), r.flags))).toEqual([]);
    }
  });
});
