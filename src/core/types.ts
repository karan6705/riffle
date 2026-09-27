// Shared domain types for a citizen stream assessment.

export type Clarity = 'clear' | 'slightly-cloudy' | 'murky';
export type WaterColour = 'clear' | 'brown' | 'green' | 'grey' | 'other';
export type Smell = 'none' | 'earthy' | 'sewage' | 'chemical';
export type Flow = 'still' | 'slow' | 'fast';
export type Substrate = 'rocky' | 'sandy';
export type Algae = 'none' | 'some' | 'lots';
/** 0 = none, 1 = a little, 2 = a lot, 3 = almost everywhere */
export type Level = 0 | 1 | 2 | 3;

export interface GeoPoint {
  lat: number;
  lng: number;
  /** GPS accuracy in metres, when known. */
  accuracy?: number;
}

export interface WaterObservation {
  clarity: Clarity;
  colour: WaterColour;
  smell: Smell;
  foamOrSheen: boolean;
  flow: Flow;
  algae: Algae;
  /** Water temperature in °C, optional (not every citizen has a thermometer). */
  temperature?: number;
}

export interface HabitatObservation {
  substrate: Substrate;
  bankVegetation: Level;
  shade: Level;
  litter: Level;
  pipesOrOutfalls: boolean;
  /** Share of the surrounding area that is sealed (roads, roofs), 0..3. */
  urbanisation: Level;
}

export interface PhotoAnalysis {
  meanRgb: [number, number, number];
  hue: number;
  saturation: number;
  brightness: number;
  greenIndex: number;
  tint: 'clear' | 'green' | 'brown' | 'grey';
  confidence: number;
}

export type ReviewStatus = 'auto-accepted' | 'needs-review' | 'expert-verified' | 'rejected';

export interface FlagDecision {
  flagId: string;
  action: 'changed' | 'confirmed';
  note?: string;
}

export interface Assessment {
  id: string;
  siteId: string;
  siteName: string;
  location: GeoPoint;
  observedAt: string; // ISO timestamp
  observer: string;
  samplingMinutes: number;
  water: WaterObservation;
  habitat: HabitatObservation;
  /** miniSASS group ids found in the sample. */
  taxa: string[];
  photo?: PhotoAnalysis;
  /** Filled by the co-pilot + human-in-the-loop review. */
  qualityScore: number;
  decisions: FlagDecision[];
  status: ReviewStatus;
  reviewNote?: string;
  reviewedBy?: string;
  /** True for the seeded demo dataset. */
  demo?: boolean;
}

export interface Site {
  id: string;
  name: string;
  stream: string;
  city: string;
  location: GeoPoint;
  substrate: Substrate;
  /** 0..1 — how exposed the catchment is to sealed surfaces / sewer overflow. */
  vulnerability: number;
  description: string;
}
