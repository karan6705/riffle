// One Health translation: the same stream observation, read three ways —
// for the ecosystem, for people, and for animals (pets, livestock, wildlife).

import { categorise, ecosystemPercent, miniSassScore, type EcoCategory } from './scoring';
import type { Assessment } from './types';

export type Audience = 'people' | 'pets' | 'wildlife' | 'community';

export interface Advice {
  audience: Audience;
  tone: 'good' | 'caution' | 'warning';
  title: string;
  text: string;
}

export interface OneHealthScore {
  overall: number;
  ecosystem: number;
  people: number;
  animals: number;
  band: 'good' | 'caution' | 'warning';
  category: EcoCategory;
  bugScore: number;
  advice: Advice[];
}

export interface WeatherContext {
  /** Rain in the last 48 h, mm. */
  recentRain?: number;
  /** Max air temperature today, °C. */
  airTemp?: number;
}

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

type Obs = Pick<Assessment, 'water' | 'habitat' | 'taxa'>;

export function oneHealth(a: Obs, weather: WeatherContext = {}): OneHealthScore {
  const { water: w, habitat: h } = a;
  const bugScore = miniSassScore(a.taxa);
  const category = categorise(bugScore, h.substrate);
  const habitat = ((h.bankVegetation + h.shade + (3 - h.litter)) / 9) * 100;
  const ecosystem = clamp(0.7 * ecosystemPercent(bugScore, h.substrate) + 0.3 * habitat);

  const bloom = w.algae === 'lots' && (w.colour === 'green' || w.flow === 'still');
  const warm = (w.temperature ?? 0) >= 24 || (weather.airTemp ?? 0) >= 32;
  const rainy = (weather.recentRain ?? 0) >= 10;

  let people = 100;
  if (w.smell === 'sewage') people -= 35;
  if (w.smell === 'chemical') people -= 25;
  if (w.colour === 'grey') people -= 15;
  if (w.foamOrSheen) people -= 10;
  if (h.pipesOrOutfalls) people -= 10;
  if (bloom) people -= 20;
  else if (w.colour === 'green') people -= 8;
  if (rainy) people -= h.urbanisation >= 2 ? 20 : 10;
  people -= h.litter * 4;

  let animals = 100;
  if (bloom) animals -= 35;
  else if (w.algae === 'lots') animals -= 12;
  if (w.smell === 'sewage') animals -= 20;
  if (w.smell === 'chemical') animals -= 25;
  if (warm) animals -= w.flow === 'still' ? 20 : 10;
  animals -= h.litter * 5;
  animals -= (100 - ecosystem) * 0.2;

  const scores = { ecosystem, people: clamp(people), animals: clamp(animals) };
  const overall = clamp(0.4 * scores.ecosystem + 0.3 * scores.people + 0.3 * scores.animals);
  const band = overall >= 70 ? 'good' : overall >= 45 ? 'caution' : 'warning';

  const advice: Advice[] = [];
  if (w.smell === 'sewage' || w.colour === 'grey' || (rainy && h.urbanisation >= 2)) {
    advice.push({
      audience: 'people',
      tone: 'warning',
      title: 'Avoid skin contact today',
      text: rainy
        ? 'Heavy rain can make sewers overflow into urban streams. Keep hands and faces out of the water for 48 h, and wash hands after visiting.'
        : 'Signs of sewage mean bacteria such as E. coli may be present. Keep hands and faces out of the water and wash hands after visiting.',
    });
  } else {
    advice.push({
      audience: 'people',
      tone: 'good',
      title: 'No sign of sewage',
      text: 'No obvious signs of sewage. As always, wash hands after touching stream water and do not drink it untreated.',
    });
  }
  if (bloom) {
    advice.push({
      audience: 'pets',
      tone: 'warning',
      title: 'Keep dogs on the lead',
      text: 'Thick green algae in slow or warm water may be a cyanobacteria bloom. Toxins can kill a dog within hours of drinking or licking its fur.',
    });
  } else if (w.algae === 'lots' || warm) {
    advice.push({
      audience: 'pets',
      tone: 'caution',
      title: 'Watch your dog',
      text: 'Warm water and algae growth can quickly turn into a toxic bloom. Bring fresh water for your pet.',
    });
  }
  if (category === 'natural' || category === 'good') {
    advice.push({
      audience: 'wildlife',
      tone: 'good',
      title: 'A healthy food web',
      text: 'Sensitive insects feed fish, birds, bats and amphibians. Protecting shade and bank plants keeps it that way.',
    });
  } else {
    advice.push({
      audience: 'wildlife',
      tone: category === 'fair' ? 'caution' : 'warning',
      title: 'Wildlife is losing its food',
      text: 'With few sensitive insects, kingfishers, dippers, trout and bats find less to eat. Shade, plants and cleaner drains help recovery.',
    });
  }
  if (h.litter >= 2 || h.pipesOrOutfalls) {
    advice.push({
      audience: 'community',
      tone: 'caution',
      title: h.pipesOrOutfalls ? 'Report the outfall' : 'Organise a clean-up',
      text: h.pipesOrOutfalls
        ? 'Discharging pipes may be misconnected household drains. Your geo-tagged report helps the water utility trace them.'
        : 'Litter harms animals and blocks flow. Invite neighbours to a clean-up — Riffle can create a community challenge for this site.',
    });
  }

  return { overall, ...scores, band, category, bugScore, advice };
}
