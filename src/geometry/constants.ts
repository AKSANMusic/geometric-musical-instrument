/**
 * Just Intonation ratios and scale definitions.
 *
 * Each scale defines 5 intervals for the pentagon's 5 edges.
 * SIDE_RATIOS are wavelength-proportional (longer side = lower frequency).
 * FREQ_RATIOS are the frequency-domain values.
 */

export interface ScaleDefinition {
  readonly name: string;
  readonly sideRatios: readonly number[];
  readonly freqRatios: readonly number[];
  readonly labels: readonly string[];
}

// ─── Scale Library ───────────────────────────────────────────────────────────

export const SCALES: Record<string, ScaleDefinition> = {
  // ─── Persian Dastgahs (دستگاه‌های موسیقی ایرانی) ──────────────────────────────
  shur: {
    name: 'شور (Dastgah Shur)',
    sideRatios: [1, 11 / 12, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 12 / 11, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', '2nd Koron (12/11)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  chahargah: {
    name: 'چهارگاه (Dastgah Chahargah)',
    sideRatios: [1, 11 / 12, 4 / 5, 3 / 4, 2 / 3, 11 / 18, 8 / 15],
    freqRatios: [1, 12 / 11, 5 / 4, 4 / 3, 3 / 2, 18 / 11, 15 / 8],
    labels: ['Tonic (1/1)', '2nd Koron (12/11)', 'Maj 3rd (5/4)', 'P4 (4/3)', 'P5 (3/2)', '6th Koron (18/11)', 'Maj 7th (15/8)'],
  },
  homayoun: {
    name: 'همایون (Dastgah Homayoun)',
    sideRatios: [1, 15 / 16, 4 / 5, 3 / 4, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', 'Min 2nd (16/15)', 'Maj 3rd (5/4)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  segah: {
    name: 'سه‌گاه (Dastgah Segah)',
    sideRatios: [1, 11 / 12, 9 / 11, 3 / 4, 2 / 3, 11 / 18, 5 / 9],
    freqRatios: [1, 12 / 11, 11 / 9, 4 / 3, 3 / 2, 18 / 11, 9 / 5],
    labels: ['Tonic (1/1)', '2nd Koron (12/11)', 'Neutral 3rd (11/9)', 'P4 (4/3)', 'P5 (3/2)', '6th Koron (18/11)', 'Min 7th (9/5)'],
  },
  mahur: {
    name: 'ماهور (Dastgah Mahur)',
    sideRatios: [1, 8 / 9, 4 / 5, 3 / 4, 2 / 3, 3 / 5, 8 / 15],
    freqRatios: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Maj 3rd (5/4)', 'P4 (4/3)', 'P5 (3/2)', 'Maj 6th (5/3)', 'Maj 7th (15/8)'],
  },
  esfahan: {
    name: 'اصفهان (Avaz Esfahan)',
    sideRatios: [1, 8 / 9, 5 / 6, 3 / 4, 2 / 3, 11 / 18, 8 / 15],
    freqRatios: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 18 / 11, 15 / 8],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', '6th Koron (18/11)', 'Maj 7th (15/8)'],
  },
  nava: {
    name: 'نوا (Dastgah Nava)',
    sideRatios: [1, 8 / 9, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  rastPanjgah: {
    name: 'راست‌پنجگاه (Dastgah Rast-Panjgah)',
    sideRatios: [1, 8 / 9, 4 / 5, 3 / 4, 2 / 3, 16 / 27, 8 / 15],
    freqRatios: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 27 / 16, 15 / 8],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Maj 3rd (5/4)', 'P4 (4/3)', 'P5 (3/2)', 'Pyth 6th (27/16)', 'Maj 7th (15/8)'],
  },

  // ─── Turkish & Arabic Makams (مقام‌های ترکی و شرقی) ──────────────────────────
  bayati: {
    name: 'بیاتی (Makam Bayati)',
    sideRatios: [1, 11 / 12, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 12 / 11, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', 'Ussak 2nd (12/11)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  hijaz: {
    name: 'حجاز (Makam Hijaz)',
    sideRatios: [1, 15 / 16, 4 / 5, 3 / 4, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', 'Min 2nd (16/15)', 'Maj 3rd (5/4)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  rast: {
    name: 'راست (Makam Rast)',
    sideRatios: [1, 8 / 9, 9 / 11, 3 / 4, 2 / 3, 3 / 5, 6 / 11],
    freqRatios: [1, 9 / 8, 11 / 9, 4 / 3, 3 / 2, 5 / 3, 11 / 6],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Segah 3rd (11/9)', 'P4 (4/3)', 'P5 (3/2)', 'Maj 6th (5/3)', 'Neutral 7th (11/6)'],
  },
  nihavend: {
    name: 'نهاوند (Makam Nihavend)',
    sideRatios: [1, 8 / 9, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 8 / 15],
    freqRatios: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 15 / 8],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Maj 7th (15/8)'],
  },
  saba: {
    name: 'صبا (Makam Saba)',
    sideRatios: [1, 11 / 12, 5 / 6, 11 / 16, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 12 / 11, 6 / 5, 16 / 11, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', '2nd Koron (12/11)', 'Min 3rd (6/5)', 'Dim 5th (16/11)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  kurdi: {
    name: 'کردی (Makam Kurdi)',
    sideRatios: [1, 15 / 16, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 16 / 15, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', 'Min 2nd (16/15)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  ushak: {
    name: 'عشاق (Makam Ushak)',
    sideRatios: [1, 11 / 12, 5 / 6, 3 / 4, 2 / 3, 3 / 5, 5 / 9],
    freqRatios: [1, 12 / 11, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 9 / 5],
    labels: ['Tonic (1/1)', '2nd Koron (12/11)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Maj 6th (5/3)', 'Min 7th (9/5)'],
  },

  // ─── Western Scales & Church Modes (گام‌های ماژور، مینور و مدهای کلیسایی) ────
  majorIonian: {
    name: 'Major / Ionian (ماژور)',
    sideRatios: [1, 8 / 9, 4 / 5, 3 / 4, 2 / 3, 3 / 5, 8 / 15],
    freqRatios: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Maj 3rd (5/4)', 'P4 (4/3)', 'P5 (3/2)', 'Maj 6th (5/3)', 'Maj 7th (15/8)'],
  },
  naturalMinor: {
    name: 'Natural Minor / Aeolian (مینور طبیعی)',
    sideRatios: [1, 8 / 9, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  harmonicMinor: {
    name: 'Harmonic Minor (مینور هارمونیک)',
    sideRatios: [1, 8 / 9, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 8 / 15],
    freqRatios: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 15 / 8],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Maj 7th (15/8)'],
  },
  melodicMinor: {
    name: 'Melodic Minor (مینور ملودیک)',
    sideRatios: [1, 8 / 9, 5 / 6, 3 / 4, 2 / 3, 3 / 5, 8 / 15],
    freqRatios: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 15 / 8],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Maj 6th (5/3)', 'Maj 7th (15/8)'],
  },
  dorian: {
    name: 'Dorian (دوریان)',
    sideRatios: [1, 8 / 9, 5 / 6, 3 / 4, 2 / 3, 3 / 5, 5 / 9],
    freqRatios: [1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 5 / 3, 9 / 5],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Maj 6th (5/3)', 'Min 7th (9/5)'],
  },
  mixolydian: {
    name: 'Mixolydian (میکسولیدین)',
    sideRatios: [1, 8 / 9, 4 / 5, 3 / 4, 2 / 3, 3 / 5, 5 / 9],
    freqRatios: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 9 / 5],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Maj 3rd (5/4)', 'P4 (4/3)', 'P5 (3/2)', 'Maj 6th (5/3)', 'Min 7th (9/5)'],
  },
  lydian: {
    name: 'Lydian (لیدین)',
    sideRatios: [1, 8 / 9, 4 / 5, 32 / 45, 2 / 3, 3 / 5, 8 / 15],
    freqRatios: [1, 9 / 8, 5 / 4, 45 / 32, 3 / 2, 5 / 3, 15 / 8],
    labels: ['Tonic (1/1)', 'Maj 2nd (9/8)', 'Maj 3rd (5/4)', 'Aug 4th (45/32)', 'P5 (3/2)', 'Maj 6th (5/3)', 'Maj 7th (15/8)'],
  },
  phrygian: {
    name: 'Phrygian (فریژین)',
    sideRatios: [1, 15 / 16, 5 / 6, 3 / 4, 2 / 3, 5 / 8, 5 / 9],
    freqRatios: [1, 16 / 15, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', 'Min 2nd (16/15)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },
  locrian: {
    name: 'Locrian (لوکرین)',
    sideRatios: [1, 15 / 16, 5 / 6, 3 / 4, 45 / 64, 5 / 8, 5 / 9],
    freqRatios: [1, 16 / 15, 6 / 5, 4 / 3, 64 / 45, 8 / 5, 9 / 5],
    labels: ['Tonic (1/1)', 'Min 2nd (16/15)', 'Min 3rd (6/5)', 'P4 (4/3)', 'Dim 5th (64/45)', 'Min 6th (8/5)', 'Min 7th (9/5)'],
  },

  // ─── Traditional Pentatonic Scales (پنتاتونیک) ──────────────────────────────
  majorPentatonic: {
    name: 'Major Pentatonic',
    sideRatios: [1, 8 / 9, 4 / 5, 2 / 3, 3 / 5],
    freqRatios: [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3],
    labels: ['Root (1/1)', 'Maj 2nd (9/8)', 'Maj 3rd (5/4)', 'P5 (3/2)', 'Maj 6th (5/3)'],
  },
  minorPentatonic: {
    name: 'Minor Pentatonic',
    sideRatios: [1, 5 / 6, 3 / 4, 2 / 3, 5 / 9],
    freqRatios: [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5],
    labels: ['Root (1/1)', 'Min 3rd (6/5)', 'P4 (4/3)', 'P5 (3/2)', 'Min 7th (9/5)'],
  },
  japanese: {
    name: 'Japanese (In)',
    sideRatios: [1, 15 / 16, 3 / 4, 2 / 3, 5 / 8],
    freqRatios: [1, 16 / 15, 4 / 3, 3 / 2, 8 / 5],
    labels: ['Root (1/1)', 'Min 2nd (16/15)', 'P4 (4/3)', 'P5 (3/2)', 'Min 6th (8/5)'],
  },
  hirajoshi: {
    name: 'Hirajoshi',
    sideRatios: [1, 8 / 9, 5 / 6, 2 / 3, 5 / 8],
    freqRatios: [1, 9 / 8, 6 / 5, 3 / 2, 8 / 5],
    labels: ['Root (1/1)', 'Maj 2nd (9/8)', 'Min 3rd (6/5)', 'P5 (3/2)', 'Min 6th (8/5)'],
  },
  egyptian: {
    name: 'Egyptian (Suspended)',
    sideRatios: [1, 8 / 9, 3 / 4, 2 / 3, 9 / 16],
    freqRatios: [1, 9 / 8, 4 / 3, 3 / 2, 16 / 9],
    labels: ['Root (1/1)', 'Maj 2nd (9/8)', 'P4 (4/3)', 'P5 (3/2)', 'Min 7th (16/9)'],
  },
  pelog: {
    name: 'Pelog (Balinese)',
    sideRatios: [1, 8 / 9, 4 / 5, 2 / 3, 4 / 7],
    freqRatios: [1, 9 / 8, 5 / 4, 3 / 2, 7 / 4],
    labels: ['Root (1/1)', 'Maj 2nd (9/8)', 'Maj 3rd (5/4)', 'P5 (3/2)', 'Harm 7th (7/4)'],
  },
  chinesePentatonic: {
    name: 'Chinese (Gong)',
    sideRatios: [1, 8 / 9, 3 / 4, 2 / 3, 8 / 15],
    freqRatios: [1, 9 / 8, 4 / 3, 3 / 2, 15 / 8],
    labels: ['Root (1/1)', 'Maj 2nd (9/8)', 'P4 (4/3)', 'P5 (3/2)', 'Maj 7th (15/8)'],
  },
  bluesPentatonic: {
    name: 'Blues Minor',
    sideRatios: [1, 5 / 6, 5 / 7, 2 / 3, 4 / 7],
    freqRatios: [1, 6 / 5, 7 / 5, 3 / 2, 7 / 4],
    labels: ['Root (1/1)', 'Min 3rd (6/5)', 'Dim 5th (7/5)', 'P5 (3/2)', 'Harm 7th (7/4)'],
  },
};

/** Default scale key */
export const DEFAULT_SCALE = 'majorPentatonic';

// ─── Root Note Frequencies ───────────────────────────────────────────────────

export interface RootNote {
  readonly name: string;
  readonly frequency: number; // Hz at octave 4
}

/** All 12 chromatic root notes at octave 4 (A4 = 440 Hz) */
export const ROOT_NOTES: Record<string, RootNote> = {
  C:  { name: 'C',  frequency: 261.63 },
  Cs: { name: 'C#', frequency: 277.18 },
  D:  { name: 'D',  frequency: 293.66 },
  Ds: { name: 'D#', frequency: 311.13 },
  E:  { name: 'E',  frequency: 329.63 },
  F:  { name: 'F',  frequency: 349.23 },
  Fs: { name: 'F#', frequency: 369.99 },
  G:  { name: 'G',  frequency: 392.00 },
  Gs: { name: 'G#', frequency: 415.30 },
  A:  { name: 'A',  frequency: 440.00 },
  As: { name: 'A#', frequency: 466.16 },
  B:  { name: 'B',  frequency: 493.88 },
};

/** Default root note key */
export const DEFAULT_ROOT = 'A';

/**
 * Circle of Fifths order: each step clockwise is ascending a Perfect Fifth (3/2, +7 semitones)
 * C -> G -> D -> A -> E -> B -> F# -> C# -> G# -> D# -> A# -> F -> C
 */
export const CIRCLE_OF_FIFTHS: readonly string[] = [
  'C', 'G', 'D', 'A', 'E', 'B', 'Fs', 'Cs', 'Gs', 'Ds', 'As', 'F',
];

/**
 * Concentric Circle of Fifths Pairs:
 * - Outer Ring: Major Keys
 * - Inner Ring: Relative Minor Keys (3 semitones below, 5/6 minor third ratio)
 */
export interface CircleKey {
  readonly majorKey: string;      // Key code in ROOT_NOTES
  readonly majorLabel: string;    // Display name (e.g. 'C')
  readonly minorKey: string;      // Relative minor key code
  readonly minorLabel: string;    // Display name (e.g. 'Am')
}

export const CIRCLE_OF_FIFTHS_PAIRS: readonly CircleKey[] = [
  { majorKey: 'C',  majorLabel: 'C',  minorKey: 'A',  minorLabel: 'Am' },
  { majorKey: 'G',  majorLabel: 'G',  minorKey: 'E',  minorLabel: 'Em' },
  { majorKey: 'D',  majorLabel: 'D',  minorKey: 'B',  minorLabel: 'Bm' },
  { majorKey: 'A',  majorLabel: 'A',  minorKey: 'Fs', minorLabel: 'F#m' },
  { majorKey: 'E',  majorLabel: 'E',  minorKey: 'Cs', minorLabel: 'C#m' },
  { majorKey: 'B',  majorLabel: 'B',  minorKey: 'Gs', minorLabel: 'G#m' },
  { majorKey: 'Fs', majorLabel: 'F#', minorKey: 'Ds', minorLabel: 'D#m' },
  { majorKey: 'Cs', majorLabel: 'C#', minorKey: 'As', minorLabel: 'A#m' },
  { majorKey: 'Gs', majorLabel: 'G#', minorKey: 'F',  minorLabel: 'Fm' },
  { majorKey: 'Ds', majorLabel: 'D#', minorKey: 'C',  minorLabel: 'Cm' },
  { majorKey: 'As', majorLabel: 'A#', minorKey: 'G',  minorLabel: 'Gm' },
  { majorKey: 'F',  majorLabel: 'F',  minorKey: 'D',  minorLabel: 'Dm' },
];

/** Get next key clockwise along Circle of Fifths (+3/2 Perfect Fifth) */
export function getNextFifth(currentKey: string): string {
  const idx = CIRCLE_OF_FIFTHS.indexOf(currentKey);
  if (idx === -1) return 'A';
  return CIRCLE_OF_FIFTHS[(idx + 1) % CIRCLE_OF_FIFTHS.length];
}

/** Get previous key counter-clockwise along Circle of Fifths (-3/2 / +4/3 Fourth) */
export function getPreviousFifth(currentKey: string): string {
  const idx = CIRCLE_OF_FIFTHS.indexOf(currentKey);
  if (idx === -1) return 'A';
  return CIRCLE_OF_FIFTHS[(idx - 1 + CIRCLE_OF_FIFTHS.length) % CIRCLE_OF_FIFTHS.length];
}

/** Get the relative minor key code for a given major key code */
export function getRelativeMinor(majorKey: string): string {
  const pair = CIRCLE_OF_FIFTHS_PAIRS.find(p => p.majorKey === majorKey);
  return pair ? pair.minorKey : 'A';
}

/** Get the relative major key code for a given minor key code */
export function getRelativeMajor(minorKey: string): string {
  const pair = CIRCLE_OF_FIFTHS_PAIRS.find(p => p.minorKey === minorKey);
  return pair ? pair.majorKey : 'C';
}

// ─── Legacy exports (for backward compatibility with tests) ──────────────────

export const JI_SIDE_RATIOS = SCALES.majorPentatonic.sideRatios;
export const JI_FREQ_RATIOS = SCALES.majorPentatonic.freqRatios;
export const INTERVAL_LABELS = SCALES.majorPentatonic.labels;
