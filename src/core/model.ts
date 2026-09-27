// Explainable plausibility model.
//
// A ridge regression predicts the miniSASS score we would *expect* from what the
// citizen saw of the water and habitat. If the bugs they reported disagree
// strongly with that expectation, the co-pilot asks them to double-check —
// and shows exactly which observations drove the expectation.
//
// The model ships trained on a synthetic dataset generated from expert priors
// (documented in `simulateTrainingSample`). `fitModel` is generic so the same
// code can be retrained on real, expert-verified OneAquaHealth records.

import { createRng, type Rng } from './rng';
import { miniSassScore } from './scoring';
import { TAXA } from './taxa';
import type { HabitatObservation, Level, WaterObservation } from './types';

export interface Feature {
  key: string;
  label: string;
  /** How to describe the feature when it is absent / below average. */
  absent?: string;
  value: (w: WaterObservation, h: HabitatObservation) => number;
}

const lvl = (l: Level) => l / 3;

export const FEATURES: Feature[] = [
  { key: 'murky', label: 'Cloudy / murky water', absent: 'Clear water', value: (w) => ({ clear: 0, 'slightly-cloudy': 0.5, murky: 1 })[w.clarity] },
  { key: 'green', label: 'Green-tinted water', absent: 'No green tint', value: (w) => +(w.colour === 'green') },
  { key: 'grey', label: 'Grey / milky water', absent: 'Not grey or milky', value: (w) => +(w.colour === 'grey') },
  { key: 'brown', label: 'Brown water', absent: 'Not brown', value: (w) => +(w.colour === 'brown') },
  { key: 'sewage', label: 'Sewage or rotten-egg smell', absent: 'No sewage smell', value: (w) => +(w.smell === 'sewage') },
  { key: 'chemical', label: 'Chemical smell', absent: 'No chemical smell', value: (w) => +(w.smell === 'chemical') },
  { key: 'foam', label: 'Foam or oily sheen', absent: 'No foam or sheen', value: (w) => +w.foamOrSheen },
  { key: 'fast', label: 'Fast, bubbly flow', absent: 'Slow or still flow', value: (w) => +(w.flow === 'fast') },
  { key: 'still', label: 'Still / stagnant water', absent: 'Moving water', value: (w) => +(w.flow === 'still') },
  { key: 'algae', label: 'Algae on stones or surface', absent: 'Little or no algae', value: (w) => ({ none: 0, some: 0.5, lots: 1 })[w.algae] },
  { key: 'vegetation', label: 'Plants along the banks', absent: 'Few plants on the banks', value: (_, h) => lvl(h.bankVegetation) },
  { key: 'shade', label: 'Tree shade over the water', absent: 'Little tree shade', value: (_, h) => lvl(h.shade) },
  { key: 'litter', label: 'Litter in or near the stream', absent: 'Little litter', value: (_, h) => lvl(h.litter) },
  { key: 'pipes', label: 'Pipes or drains discharging', absent: 'No discharging pipes', value: (_, h) => +h.pipesOrOutfalls },
  { key: 'urban', label: 'Sealed surfaces around the site', absent: 'Green surroundings', value: (_, h) => lvl(h.urbanisation) },
  { key: 'rocky', label: 'Rocky stream bed', absent: 'Sandy or muddy bed', value: (_, h) => +(h.substrate === 'rocky') },
  {
    key: 'warm',
    label: 'Warm water',
    absent: 'Cool water',
    value: (w) => (w.temperature === undefined ? 0 : Math.max(-1, Math.min(1.5, (w.temperature - 16) / 8))),
  },
];

export interface TrainedModel {
  intercept: number;
  weights: number[];
  means: number[];
  residualSd: number;
  r2: number;
  n: number;
}

export function featurize(w: WaterObservation, h: HabitatObservation): number[] {
  return FEATURES.map((f) => f.value(w, h));
}

/** Solve A x = b with Gaussian elimination + partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

/** Ridge regression on mean-centred features (intercept not penalised). */
export function fitModel(X: number[][], y: number[], lambda = 1): TrainedModel {
  const n = X.length;
  const d = X[0].length;
  const means = Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[j], 0) / n);
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const Xc = X.map((r) => r.map((v, j) => v - means[j]));
  const XtX = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => Xc.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lambda : 0)),
  );
  const Xty = Array.from({ length: d }, (_, i) => Xc.reduce((s, r, k) => s + r[i] * (y[k] - yMean), 0));
  const weights = solve(XtX, Xty);
  const preds = Xc.map((r) => yMean + r.reduce((s, v, j) => s + v * weights[j], 0));
  const ssRes = preds.reduce((s, p, k) => s + (y[k] - p) ** 2, 0);
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  return {
    intercept: yMean,
    weights,
    means,
    residualSd: Math.sqrt(ssRes / Math.max(1, n - d - 1)),
    r2: 1 - ssRes / ssTot,
    n,
  };
}

export interface Contribution {
  key: string;
  label: string;
  effect: number;
}

export interface Prediction {
  expected: number;
  low: number;
  high: number;
  contributions: Contribution[];
}

export function predict(model: TrainedModel, w: WaterObservation, h: HabitatObservation): Prediction {
  const x = featurize(w, h);
  const contributions = FEATURES.map((f, j) => ({
    key: f.key,
    label: x[j] < model.means[j] && f.absent ? f.absent : f.label,
    effect: model.weights[j] * (x[j] - model.means[j]),
  }))
    .filter((c) => Math.abs(c.effect) >= 0.05)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  const expected = model.intercept + contributions.reduce((s, c) => s + c.effect, 0);
  return {
    expected,
    low: expected - 2 * model.residualSd,
    high: expected + 2 * model.residualSd,
    contributions,
  };
}

// ---------- Synthetic training data from expert priors ----------

const lv = (x: number): Level => Math.max(0, Math.min(3, Math.round(x * 3))) as Level;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface SimulatedSample {
  water: WaterObservation;
  habitat: HabitatObservation;
  taxa: string[];
}

/**
 * Generative story: a latent pollution pressure `p` and habitat quality `q`
 * drive both what a citizen sees (colour, smell, algae…) and which animals can
 * survive (sensitive groups need low p and good q). Used for training and for
 * the demo dataset.
 */
export function simulateSample(rng: Rng, p = rng.next(), q = rng.next(), rocky = rng.chance(0.6)): SimulatedSample {
  const noisy = (x: number, sd = 0.15) => clamp01(x + rng.normal(0, sd));
  // Point-source events (a leaking sewer, a misconnected drain) hit otherwise
  // decent sites too, independently of the diffuse urban pressure.
  const pointSource = rng.chance(0.12);
  const murk = noisy(p * 0.8 + (1 - q) * 0.2);
  const water: WaterObservation = {
    clarity: murk > 0.66 ? 'murky' : murk > 0.33 ? 'slightly-cloudy' : 'clear',
    colour: p > 0.75 && rng.chance(0.5) ? 'grey' : p > 0.55 && rng.chance(0.45) ? 'green' : murk > 0.6 && rng.chance(0.5) ? 'brown' : 'clear',
    smell: (pointSource && rng.chance(0.75)) || (p > 0.7 && rng.chance(0.6)) ? 'sewage' : p > 0.6 && rng.chance(0.15) ? 'chemical' : rng.chance(0.2) ? 'earthy' : 'none',
    foamOrSheen: rng.chance(p * 0.6 + (pointSource ? 0.3 : 0)),
    flow: rocky ? (rng.chance(0.7) ? 'fast' : 'slow') : rng.chance(0.25) ? 'still' : 'slow',
    algae: noisy(p * 0.9) > 0.66 ? 'lots' : noisy(p * 0.9) > 0.3 ? 'some' : 'none',
    temperature: rng.chance(0.6) ? Math.round((14 + p * 6 + (1 - q) * 3 + rng.normal(0, 2)) * 10) / 10 : undefined,
  };
  const habitat: HabitatObservation = {
    substrate: rocky ? 'rocky' : 'sandy',
    bankVegetation: lv(noisy(q)),
    shade: lv(noisy(q * 0.8)),
    litter: lv(noisy(p * 0.6 + (1 - q) * 0.3)),
    pipesOrOutfalls: pointSource ? rng.chance(0.7) : rng.chance(p * 0.5),
    urbanisation: lv(noisy(p * 0.5 + (1 - q) * 0.4)),
  };
  // Survival probability of each group falls with pressure, faster for sensitive ones.
  const health = clamp01(1.08 - p * 0.95 + (q - 0.5) * 0.35 + (rocky ? 0.05 : -0.05) - (pointSource ? 0.3 : 0));
  const taxa = TAXA.filter((t) => {
    // The hardiest groups (worms, leeches, fly larvae…) are outcompeted in clean
    // streams and dominate degraded ones.
    if (t.sensitivity === 'tolerant') {
      return rng.chance(t.weight <= 3 ? 0.08 + 0.8 * (1 - health) ** 1.6 : 0.3 + 0.25 * (1 - Math.abs(health - 0.5) * 2));
    }
    const need = t.sensitivity === 'very-sensitive' ? 0.66 : 0.42;
    const prob = health > need ? 0.85 * Math.min(1, (health - need) / 0.3 + 0.25) : 0.03;
    return rng.chance(prob);
  }).map((t) => t.id);
  if (taxa.length === 0) taxa.push(rng.pick(['worms', 'true-flies', 'leeches']));
  return { water, habitat, taxa };
}

let cached: TrainedModel | null = null;

/** The default model, trained once on 2,500 synthetic expert-prior samples. */
export function defaultModel(): TrainedModel {
  if (cached) return cached;
  const rng = createRng(20261004);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < 2500; i++) {
    const s = simulateSample(rng);
    X.push(featurize(s.water, s.habitat));
    y.push(miniSassScore(s.taxa));
  }
  cached = fitModel(X, y, 2);
  return cached;
}
