import { describe, expect, it } from 'vitest';
import { categorise, miniSassScore } from '../scoring';
import { defaultModel, FEATURES, fitModel, predict } from '../model';

describe('miniSASS scoring', () => {
  it('averages weights of unique known groups', () => {
    expect(miniSassScore(['stoneflies', 'worms'])).toBe(9.5);
    expect(miniSassScore(['stoneflies', 'stoneflies', 'unknown'])).toBe(17);
    expect(miniSassScore([])).toBe(0);
  });
  it('uses substrate-specific thresholds', () => {
    expect(categorise(8, 'rocky')).toBe('natural');
    expect(categorise(7, 'rocky')).toBe('good');
    expect(categorise(7, 'sandy')).toBe('natural');
    expect(categorise(4, 'sandy')).toBe('very-poor');
    expect(categorise(0, 'rocky')).toBe('very-poor');
  });
});

describe('plausibility model', () => {
  it('recovers known linear weights', () => {
    const X = Array.from({ length: 200 }, (_, i) => [i % 7, (i * 13) % 5]);
    const y = X.map(([a, b]) => 3 + 2 * a - 1.5 * b);
    const m = fitModel(X, y, 1e-6);
    expect(m.weights[0]).toBeCloseTo(2, 3);
    expect(m.weights[1]).toBeCloseTo(-1.5, 3);
    expect(m.r2).toBeGreaterThan(0.999);
  });
  it('learns ecologically sensible directions from expert priors', () => {
    const m = defaultModel();
    const w = (k: string) => m.weights[FEATURES.findIndex((f) => f.key === k)];
    console.log('r2', m.r2.toFixed(3), 'sd', m.residualSd.toFixed(2), Object.fromEntries(FEATURES.map((f, i) => [f.key, +m.weights[i].toFixed(2)])));
    expect(m.r2).toBeGreaterThan(0.4);
    expect(w('sewage')).toBeLessThan(0);
    expect(w('murky')).toBeLessThan(0);
    expect(w('vegetation')).toBeGreaterThan(0);
  });
  it('explains a polluted-looking site with negative contributions', () => {
    const p = predict(
      defaultModel(),
      { clarity: 'murky', colour: 'grey', smell: 'sewage', foamOrSheen: true, flow: 'slow', algae: 'lots' },
      { substrate: 'sandy', bankVegetation: 0, shade: 0, litter: 3, pipesOrOutfalls: true, urbanisation: 3 },
    );
    const clean = predict(
      defaultModel(),
      { clarity: 'clear', colour: 'clear', smell: 'none', foamOrSheen: false, flow: 'fast', algae: 'none' },
      { substrate: 'rocky', bankVegetation: 3, shade: 3, litter: 0, pipesOrOutfalls: false, urbanisation: 0 },
    );
    console.log('polluted', p.expected.toFixed(2), 'clean', clean.expected.toFixed(2));
    expect(clean.expected - p.expected).toBeGreaterThan(3);
    expect(p.contributions[0].effect).toBeLessThan(0);
  });
});
