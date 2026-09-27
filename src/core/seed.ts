// Synthetic but ecologically plausible demo dataset for Coimbra (Portugal),
// using real urban stream names. Coordinates are approximate. Each site has a
// storyline so trends and alerts have something meaningful to show.

import { decide, runCopilot } from './copilot';
import { defaultModel, simulateSample } from './model';
import { createRng } from './rng';
import type { Assessment, Site } from './types';

export const CITY_CENTRE = { lat: 40.2056, lng: -8.4195 };

interface Story { p: (monthIndex: number, month: number) => number; q: number; rocky: boolean }

export const SITES: (Site & { story: Story })[] = [
  {
    id: 'coselhas-up',
    name: 'Coselhas — upper valley',
    stream: 'Ribeira de Coselhas',
    city: 'Coimbra',
    location: { lat: 40.2362, lng: -8.4108 },
    substrate: 'rocky',
    vulnerability: 0.25,
    description: 'Wooded headwater with riffles and alder shade. The reference reach for the city.',
    story: { p: () => 0.12, q: 0.85, rocky: true },
  },
  {
    id: 'coselhas-urban',
    name: 'Coselhas — urban reach',
    stream: 'Ribeira de Coselhas',
    city: 'Coimbra',
    location: { lat: 40.2195, lng: -8.4205 },
    substrate: 'rocky',
    vulnerability: 0.8,
    description: 'Channelised stretch between roads. Construction upstream since early 2026.',
    story: { p: (i) => (i < 9 ? 0.5 : Math.min(0.85, 0.5 + (i - 9) * 0.05)), q: 0.35, rocky: true },
  },
  {
    id: 'covoes-up',
    name: 'Covões — Vale de Canas',
    stream: 'Ribeira dos Covões',
    city: 'Coimbra',
    location: { lat: 40.1905, lng: -8.4665 },
    substrate: 'rocky',
    vulnerability: 0.35,
    description: 'Semi-rural reach with farmland and patches of riparian forest.',
    story: { p: () => 0.28, q: 0.7, rocky: true },
  },
  {
    id: 'covoes-hospital',
    name: 'Covões — hospital reach',
    stream: 'Ribeira dos Covões',
    city: 'Coimbra',
    location: { lat: 40.1938, lng: -8.4555 },
    substrate: 'sandy',
    vulnerability: 0.7,
    description: 'Urban reach restored with bank planting and a stormwater wetland in autumn 2025.',
    story: { p: (i) => (i < 6 ? 0.65 : Math.max(0.3, 0.65 - (i - 6) * 0.04)), q: 0.5, rocky: false },
  },
  {
    id: 'vale-flores',
    name: 'Vale das Flores — park pond outlet',
    stream: 'Vale das Flores stream',
    city: 'Coimbra',
    location: { lat: 40.1975, lng: -8.4125 },
    substrate: 'sandy',
    vulnerability: 0.6,
    description: 'Slow outlet of a park pond, popular with dog walkers. Prone to summer algae.',
    story: { p: (_, m) => (m >= 5 && m <= 8 ? 0.7 : 0.4), q: 0.55, rocky: false },
  },
  {
    id: 'mondego-parque',
    name: 'Mondego — Parque Verde',
    stream: 'Rio Mondego',
    city: 'Coimbra',
    location: { lat: 40.2012, lng: -8.4262 },
    substrate: 'sandy',
    vulnerability: 0.5,
    description: 'Main river edge in the city park; receives several urban tributaries.',
    story: { p: () => 0.38, q: 0.5, rocky: false },
  },
];

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(10, 0, 0, 0);
  return d;
}

const OBSERVERS = ['Ana R.', 'Tiago M.', 'Inês C.', 'Duarte F.', 'EB2,3 Martim de Freitas (school)', 'Rita S.', 'João P.', 'Sofia L.', 'Coimbra Rangers club'];

/** Demo data is generated relative to `now`, so it always looks current. */
export function seedAssessments(now = startOfToday(), seed = 48): Assessment[] {
  const rng = createRng(seed);
  const model = defaultModel();
  const out: Assessment[] = [];
  const months = 18;
  for (const site of SITES) {
    for (let i = 0; i < months; i++) {
      const date = new Date(now);
      date.setUTCMonth(date.getUTCMonth() - (months - 1 - i));
      const month = date.getUTCMonth();
      const visits = rng.chance(0.35) ? 2 : 1;
      for (let v = 0; v < visits; v++) {
        const d = new Date(date);
        d.setUTCDate(Math.max(1, Math.min(26, 3 + Math.floor(rng.next() * 24))));
        d.setUTCHours(8 + Math.floor(rng.next() * 9), Math.floor(rng.next() * 60));
        // The current month may not have reached that day yet: keep every visit in the past.
        if (d.getTime() > now.getTime() - 86400000) d.setTime(now.getTime() - (2 + Math.floor(rng.next() * 5)) * 86400000);
        const p = Math.max(0, Math.min(1, site.story.p(i, month) + rng.normal(0, 0.06)));
        const s = simulateSample(rng, p, site.story.q, site.story.rocky);
        // Seasonal water temperature (warmest in August).
        const seasonal = 13 + 7 * Math.sin(((month - 4) / 12) * 2 * Math.PI) + p * 3;
        s.water.temperature = rng.chance(0.7) ? Math.round((seasonal + rng.normal(0, 1)) * 10) / 10 : undefined;
        const base = {
          water: s.water,
          habitat: s.habitat,
          taxa: s.taxa,
          samplingMinutes: rng.chance(0.75) ? 5 : 3,
          location: site.location,
          observedAt: d.toISOString(),
        };
        const { flags } = runCopilot(base, model, now);
        const decisions = flags.map((f) => ({
          flagId: f.id,
          action: rng.chance(0.4) ? ('changed' as const) : ('confirmed' as const),
          note: rng.chance(0.5) ? 'Checked again on site' : undefined,
        }));
        const verdict = decide(flags, decisions);
        const old = i < months - 2;
        out.push({
          id: `demo-${site.id}-${i}-${v}`,
          siteId: site.id,
          siteName: site.name,
          observer: rng.pick(OBSERVERS),
          ...base,
          qualityScore: verdict.qualityScore,
          decisions,
          // Older flagged records have already been through expert review.
          status: verdict.status === 'needs-review' && old ? (rng.chance(0.85) ? 'expert-verified' : 'rejected') : verdict.status,
          reviewedBy: verdict.status === 'needs-review' && old ? 'Dr. M. Costa (UC freshwater lab)' : undefined,
          demo: true,
        });
      }
    }
  }
  out.push(...pendingReviewExamples(now));
  return out.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

/** Hand-written records that show the review queue at its most interesting. */
function pendingReviewExamples(now: Date): Assessment[] {
  const at = (daysAgo: number, h: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    d.setUTCHours(h, 15);
    return d.toISOString();
  };
  const urban = SITES[1];
  const flores = SITES[4];
  return [
    {
      id: 'demo-review-1',
      siteId: urban.id,
      siteName: urban.name,
      location: urban.location,
      observedAt: at(2, 9),
      observer: 'Inês C.',
      samplingMinutes: 5,
      water: { clarity: 'murky', colour: 'grey', smell: 'sewage', foamOrSheen: true, flow: 'fast', algae: 'some', temperature: 19.4 },
      habitat: { substrate: 'rocky', bankVegetation: 1, shade: 1, litter: 2, pipesOrOutfalls: true, urbanisation: 3 },
      taxa: ['stoneflies', 'minnow-mayflies', 'true-flies', 'worms'],
      qualityScore: 78,
      decisions: [
        { flagId: 'sensitive-vs-sewage', action: 'confirmed', note: 'Two tails, definitely stoneflies — smell started this morning, maybe a new spill?' },
      ],
      status: 'needs-review',
      demo: true,
    },
    {
      id: 'demo-review-2',
      siteId: flores.id,
      siteName: flores.name,
      location: flores.location,
      observedAt: at(1, 17),
      observer: 'EB2,3 Martim de Freitas (school)',
      samplingMinutes: 2,
      water: { clarity: 'slightly-cloudy', colour: 'green', smell: 'earthy', foamOrSheen: false, flow: 'still', algae: 'lots', temperature: 26.1 },
      habitat: { substrate: 'sandy', bankVegetation: 2, shade: 1, litter: 1, pipesOrOutfalls: false, urbanisation: 2 },
      taxa: [],
      qualityScore: 81,
      decisions: [{ flagId: 'no-animals', action: 'confirmed', note: 'Class of 24 searched — nothing found, water very warm' }],
      status: 'needs-review',
      demo: true,
    },
  ];
}
