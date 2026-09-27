// Macroinvertebrate groups and sensitivity weights, adapted from the miniSASS
// citizen biomonitoring method (GroundTruth / Water Research Commission).
// Scientific names are kept next to the plain-language names so that experts
// can audit the mapping while citizens never have to learn the jargon.

export type Sensitivity = 'very-sensitive' | 'sensitive' | 'tolerant';

export interface Taxon {
  id: string;
  name: string;
  scientific: string;
  weight: number;
  sensitivity: Sensitivity;
  lookFor: string;
  whyItMatters: string;
  /** Parameters for the procedural illustration in <BugIcon>. */
  shape: {
    body: number; // body length 0..1
    width: number; // body width 0..1
    segments: number;
    legs: number; // pairs
    tails: number;
    wings?: boolean;
    shell?: 'spiral' | 'case' | 'carapace';
    claws?: boolean;
  };
}

export const TAXA: Taxon[] = [
  {
    id: 'stoneflies',
    name: 'Stoneflies',
    scientific: 'Plecoptera',
    weight: 17,
    sensitivity: 'very-sensitive',
    lookFor: 'Flat, 6 legs, two long tails, two antennae. Crawl slowly on stones.',
    whyItMatters: 'Need cold, clean, oxygen-rich water. Among the first to disappear when a stream is polluted.',
    shape: { body: 0.8, width: 0.35, segments: 6, legs: 3, tails: 2 },
  },
  {
    id: 'other-mayflies',
    name: 'Flat & crawling mayflies',
    scientific: 'Ephemeroptera (non-Baetidae)',
    weight: 11,
    sensitivity: 'very-sensitive',
    lookFor: 'Gills along the sides of the belly, usually three tails. Cling flat to rocks.',
    whyItMatters: 'Their feathery gills need well-oxygenated water; silt and organic pollution suffocate them.',
    shape: { body: 0.75, width: 0.4, segments: 7, legs: 3, tails: 3 },
  },
  {
    id: 'caddisflies',
    name: 'Caddisflies',
    scientific: 'Trichoptera',
    weight: 9,
    sensitivity: 'sensitive',
    lookFor: 'Caterpillar-like; many build a tube-shaped case from sand, twigs or leaves.',
    whyItMatters: 'Case builders need clean gravel and leaf litter — a sign of healthy banks and moderate pollution at most.',
    shape: { body: 0.7, width: 0.3, segments: 5, legs: 3, tails: 0, shell: 'case' },
  },
  {
    id: 'crabs-shrimps',
    name: 'Crabs & shrimps',
    scientific: 'Decapoda / Amphipoda',
    weight: 6,
    sensitivity: 'sensitive',
    lookFor: 'Many legs, hard curved body. Freshwater shrimps swim on their side.',
    whyItMatters: 'Shred fallen leaves and feed fish; sensitive to pesticides and low oxygen.',
    shape: { body: 0.7, width: 0.45, segments: 6, legs: 5, tails: 0, shell: 'carapace', claws: true },
  },
  {
    id: 'dragonflies',
    name: 'Dragonfly larvae',
    scientific: 'Anisoptera',
    weight: 6,
    sensitivity: 'sensitive',
    lookFor: 'Chunky body, big eyes, no tails (just short spikes). Lie in wait on the bottom.',
    whyItMatters: 'Top predators of the stream bed; need stable habitat and vegetation to emerge.',
    shape: { body: 0.75, width: 0.55, segments: 5, legs: 3, tails: 0 },
  },
  {
    id: 'minnow-mayflies',
    name: 'Swimming mayflies',
    scientific: 'Baetidae',
    weight: 5,
    sensitivity: 'tolerant',
    lookFor: 'Small, streamlined, dart like tiny fish. Two or three tails.',
    whyItMatters: 'The hardiest mayflies — present even in moderately impacted streams.',
    shape: { body: 0.6, width: 0.25, segments: 7, legs: 3, tails: 3 },
  },
  {
    id: 'bugs-beetles',
    name: 'Water bugs & beetles',
    scientific: 'Hemiptera / Coleoptera',
    weight: 5,
    sensitivity: 'tolerant',
    lookFor: 'Hard wing cases or oar-like back legs. Some carry an air bubble.',
    whyItMatters: 'Many breathe air from the surface, so they cope with low oxygen better than gill breathers.',
    shape: { body: 0.6, width: 0.5, segments: 2, legs: 3, tails: 0, wings: true },
  },
  {
    id: 'damselflies',
    name: 'Damselfly larvae',
    scientific: 'Zygoptera',
    weight: 4,
    sensitivity: 'tolerant',
    lookFor: 'Slender body ending in three leaf-like paddles.',
    whyItMatters: 'Need plants along the edges to hunt and emerge.',
    shape: { body: 0.85, width: 0.2, segments: 8, legs: 3, tails: 3 },
  },
  {
    id: 'snails-clams',
    name: 'Snails & clams',
    scientific: 'Gastropoda / Bivalvia',
    weight: 4,
    sensitivity: 'tolerant',
    lookFor: 'Soft body in a coiled or two-part shell.',
    whyItMatters: 'Graze algae and filter water; some thrive where nutrients are high.',
    shape: { body: 0.5, width: 0.5, segments: 1, legs: 0, tails: 0, shell: 'spiral' },
  },
  {
    id: 'flatworms',
    name: 'Flatworms',
    scientific: 'Turbellaria',
    weight: 3,
    sensitivity: 'tolerant',
    lookFor: 'Very flat, glides smoothly, arrow-shaped head with two eye spots.',
    whyItMatters: 'Scavengers found in many conditions.',
    shape: { body: 0.7, width: 0.25, segments: 1, legs: 0, tails: 0 },
  },
  {
    id: 'true-flies',
    name: 'Fly larvae',
    scientific: 'Diptera',
    weight: 2,
    sensitivity: 'tolerant',
    lookFor: 'Soft, legless maggot-like body; bloodworms are bright red.',
    whyItMatters: 'Red bloodworms carry haemoglobin to survive very low oxygen — a pollution warning when they dominate.',
    shape: { body: 0.75, width: 0.18, segments: 9, legs: 0, tails: 0 },
  },
  {
    id: 'worms',
    name: 'Worms',
    scientific: 'Oligochaeta',
    weight: 2,
    sensitivity: 'tolerant',
    lookFor: 'Long, thin, segmented like an earthworm.',
    whyItMatters: 'Thrive in silty, nutrient-rich mud where others cannot.',
    shape: { body: 0.95, width: 0.12, segments: 12, legs: 0, tails: 0 },
  },
  {
    id: 'leeches',
    name: 'Leeches',
    scientific: 'Hirudinea',
    weight: 2,
    sensitivity: 'tolerant',
    lookFor: 'Flattened worm with a sucker at each end; moves like an inchworm.',
    whyItMatters: 'Tolerate organic pollution and low oxygen.',
    shape: { body: 0.7, width: 0.42, segments: 7, legs: 0, tails: 0 },
  },
];

export const TAXA_BY_ID: Record<string, Taxon> = Object.fromEntries(TAXA.map((t) => [t.id, t]));

export const VERY_SENSITIVE = TAXA.filter((t) => t.sensitivity === 'very-sensitive').map((t) => t.id);
