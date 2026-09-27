// The AI co-pilot. It never changes a citizen's answer: it raises explainable
// flags, the citizen decides (change or confirm with a note), and anything left
// in doubt is routed to an expert — a human-in-the-loop by design.

import { predict, type Prediction, type TrainedModel } from './model';
import { miniSassScore } from './scoring';
import { TAXA_BY_ID, VERY_SENSITIVE } from './taxa';
import type { Assessment, FlagDecision, ReviewStatus } from './types';

export type Severity = 'info' | 'warning' | 'critical';
export type WizardStep = 'site' | 'water' | 'habitat' | 'bugs' | 'photo';

export interface Flag {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  /** Plain-language reason — the "explainable" part. */
  why: string;
  suggestion: string;
  step: WizardStep;
  source: 'rule' | 'model' | 'photo';
}

export type CopilotInput = Pick<
  Assessment,
  'water' | 'habitat' | 'taxa' | 'photo' | 'samplingMinutes' | 'location' | 'observedAt'
>;

export interface CopilotResult {
  observed: number;
  prediction: Prediction;
  zScore: number;
  flags: Flag[];
}

const names = (ids: string[]) => ids.map((id) => TAXA_BY_ID[id]?.name.toLowerCase() ?? id).join(', ');

export function runCopilot(a: CopilotInput, model: TrainedModel, now = new Date()): CopilotResult {
  const flags: Flag[] = [];
  const observed = miniSassScore(a.taxa);
  const prediction = predict(model, a.water, a.habitat);
  const zScore = a.taxa.length ? (observed - prediction.expected) / model.residualSd : 0;
  const sensitive = a.taxa.filter((t) => VERY_SENSITIVE.includes(t));

  if (new Date(a.observedAt).getTime() > now.getTime() + 5 * 60_000) {
    flags.push({
      id: 'future-date',
      severity: 'critical',
      source: 'rule',
      step: 'site',
      title: 'Date is in the future',
      message: 'The observation time is later than now.',
      why: 'Records are matched with weather and other observations by time, so a wrong date breaks trend and early-warning analysis.',
      suggestion: 'Check the date and time of your visit.',
    });
  }

  if (a.location.accuracy !== undefined && a.location.accuracy > 100) {
    flags.push({
      id: 'gps-accuracy',
      severity: 'info',
      source: 'rule',
      step: 'site',
      title: 'Location is approximate',
      message: `Your GPS fix is only accurate to about ${Math.round(a.location.accuracy)} m.`,
      why: 'Urban streams change quickly over short distances; a precise point lets us compare your visit with others at the same spot.',
      suggestion: 'Tap the map to drop the pin exactly where you sampled.',
    });
  }

  const t = a.water.temperature;
  if (t !== undefined && (t < -1 || t > 35)) {
    const maybeF = t > 35 && t < 105;
    flags.push({
      id: 'temperature-range',
      severity: 'critical',
      source: 'rule',
      step: 'water',
      title: 'Water temperature looks impossible',
      message: `${t} °C is outside the range of a flowing European stream.`,
      why: maybeF
        ? `This looks like a Fahrenheit reading — ${t} °F is ${(((t - 32) * 5) / 9).toFixed(1)} °C.`
        : 'Stream water in Europe stays between about 0 and 30 °C.',
      suggestion: maybeF ? 'Convert to °C, or re-measure with the thermometer fully in the water.' : 'Re-measure with the thermometer fully in the water for a minute.',
    });
  }

  if (a.taxa.length === 0) {
    flags.push({
      id: 'no-animals',
      severity: a.samplingMinutes < 5 ? 'warning' : 'info',
      source: 'rule',
      step: 'bugs',
      title: 'No animals found',
      message: a.samplingMinutes < 5 ? `You searched for ${a.samplingMinutes} min.` : 'An empty sample is a strong signal.',
      why: 'Even stressed streams usually hold worms or fly larvae. An empty net is either a very short search or a sign of serious pollution — both matter.',
      suggestion: a.samplingMinutes < 5
        ? 'If you can, kick-sample the stones in a fast, shallow section for 5 minutes and look again.'
        : 'If you are sure, confirm — this record will be highlighted to local experts.',
    });
  } else if (a.samplingMinutes < 3) {
    flags.push({
      id: 'short-sampling',
      severity: 'info',
      source: 'rule',
      step: 'bugs',
      title: 'Short search',
      message: `You sampled for ${a.samplingMinutes} min.`,
      why: 'Shorter searches miss rarer, often more sensitive, animals — which makes the stream look worse than it is.',
      suggestion: 'Next time aim for 5 minutes across different habitats (stones, plants, leaf packs).',
    });
  }

  if (sensitive.length && (a.water.smell === 'sewage' || a.water.colour === 'grey')) {
    flags.push({
      id: 'sensitive-vs-sewage',
      severity: 'warning',
      source: 'rule',
      step: 'bugs',
      title: 'Very sensitive animals in sewage-like water',
      message: `You found ${names(sensitive)} while reporting ${a.water.smell === 'sewage' ? 'a sewage smell' : 'grey, milky water'}.`,
      why: 'These animals need oxygen-rich water. Sewage is broken down by bacteria that use up the oxygen, so they rarely survive it for long.',
      suggestion: 'Check the tails: stoneflies have 2, swimming mayflies 3. If the ID is right, this may be a brand-new spill — please confirm, it is urgent information.',
    });
  }

  if (a.water.flow === 'still' && a.taxa.includes('stoneflies')) {
    flags.push({
      id: 'stoneflies-still',
      severity: 'info',
      source: 'rule',
      step: 'bugs',
      title: 'Stoneflies in still water',
      message: 'Stoneflies almost always live in flowing water.',
      why: 'They breathe through their skin and gills, relying on current to bring fresh oxygen.',
      suggestion: 'Could it be a swimming mayfly (3 tails) or a damselfly larva (3 paddles)?',
    });
  }

  if (a.taxa.length === 1 && sensitive.length === 1) {
    flags.push({
      id: 'lone-sensitive',
      severity: 'info',
      source: 'rule',
      step: 'bugs',
      title: 'Only one, very sensitive, group',
      message: `Finding only ${names(sensitive)} is unusual.`,
      why: 'Streams clean enough for very sensitive animals usually also hold several other groups; a single find inflates the score.',
      suggestion: 'Search a little longer in different spots — leaf packs and plant roots are good places.',
    });
  }

  if (a.taxa.length && Math.abs(zScore) > 2) {
    const higher = zScore > 0;
    const drivers = prediction.contributions.slice(0, 3).map((c) => `${c.label.toLowerCase()} (${c.effect > 0 ? '+' : ''}${c.effect.toFixed(1)})`);
    flags.push({
      id: 'model-deviation',
      severity: 'warning',
      source: 'model',
      step: 'bugs',
      title: higher ? 'More sensitive life than expected' : 'Less sensitive life than expected',
      message: `Your animals score ${observed.toFixed(1)}, but a stream that looks like this usually scores ${Math.max(0, prediction.low).toFixed(1)}–${prediction.high.toFixed(1)}.`,
      why: `The expectation comes from what you saw of the water and banks. Biggest drivers: ${drivers.join(', ') || 'none'}.`,
      suggestion: higher
        ? 'Double-check the IDs of the most sensitive animals using the picture guide. If they are right, great — this stretch is doing better than it looks!'
        : 'Did you search fast, stony sections and plant roots? If so, something invisible (e.g. a chemical) may be affecting the stream.',
    });
  }

  if (a.photo && a.photo.confidence >= 0.5) {
    const reported = a.water.colour;
    const seen = a.photo.tint;
    const mismatch =
      (seen === 'green' && reported !== 'green') ||
      (seen === 'grey' && reported === 'clear') ||
      (seen === 'brown' && reported === 'clear') ||
      (seen === 'clear' && (reported === 'green' || reported === 'grey'));
    if (mismatch) {
      flags.push({
        id: 'photo-mismatch',
        severity: 'warning',
        source: 'photo',
        step: 'water',
        title: 'Photo and colour answer disagree',
        message: `Your photo looks ${seen}, but you reported ${reported} water.`,
        why: `On-device colour analysis measured hue ${Math.round(a.photo.hue)}°, saturation ${Math.round(a.photo.saturation * 100)}%. Lighting and reflections can fool it, so you decide.`,
        suggestion: 'Look again at water in a white cup or tray. Change your answer or confirm it.',
      });
    }
  }

  return { observed, prediction, zScore, flags };
}

/** Quality score 0–100 and routing, after the citizen's decisions on each flag. */
export function decide(flags: Flag[], decisions: FlagDecision[]): { qualityScore: number; status: ReviewStatus } {
  const penalty: Record<Severity, number> = { info: 4, warning: 15, critical: 35 };
  let score = 100;
  let needsExpert = false;
  for (const f of flags) {
    const d = decisions.find((x) => x.flagId === f.id);
    if (d?.action === 'changed') continue;
    const confirmedWithNote = d?.action === 'confirmed' && !!d.note?.trim();
    score -= confirmedWithNote ? penalty[f.severity] / 2 : penalty[f.severity];
    if (f.severity === 'critical' || (f.severity === 'warning' && f.source !== 'photo')) needsExpert = true;
  }
  return { qualityScore: Math.max(0, Math.round(score)), status: needsExpert ? 'needs-review' : 'auto-accepted' };
}
