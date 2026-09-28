/**
 * instrument-range.ts — Instrument Pitch Range Mapping & Constraint Engine
 *
 * Provides physical register constraints for acoustic modeling VSTs (such as SWAM Cello C2-G5),
 * orchestral instruments, and Persian traditional instruments.
 * Ensures flawless MIDI mapping, smart octave-folding, and visual range indication.
 */

export interface RangePreset {
  readonly id: string;
  readonly name: string;
  readonly farsiName: string;
  readonly minNote: string;
  readonly maxNote: string;
  readonly minMidi: number;
  readonly maxMidi: number;
  readonly description: string;
}

export type RangeBehavior = 'fold' | 'auto-fit' | 'mute';

export interface InstrumentRangeConfig {
  enabled: boolean;
  presetId: string;
  minMidi: number;
  maxMidi: number;
  behavior: RangeBehavior;
}

const NOTE_BASE_INDICES: Record<string, number> = {
  C: 0,
  'C#': 1,
  DB: 1,
  D: 2,
  'D#': 3,
  EB: 3,
  E: 4,
  F: 5,
  'F#': 6,
  GB: 6,
  G: 7,
  'G#': 8,
  AB: 8,
  A: 9,
  'A#': 10,
  BB: 10,
  B: 11,
};

const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Parses note string (e.g. "C2", "G5", "F#3") into MIDI note number (0 - 127).
 */
export function noteNameToMidi(noteName: string): number {
  const clean = noteName.trim().toUpperCase();
  const match = clean.match(/^([A-G][#B]?)(-?\d+)$/);
  if (!match) return 60; // Default C4

  const pitchName = match[1];
  const octave = parseInt(match[2], 10);
  const base = NOTE_BASE_INDICES[pitchName] ?? 0;
  return (octave + 1) * 12 + base;
}

/**
 * Formats MIDI note number into string representation (e.g. 36 -> "C2", 79 -> "G5").
 */
export function midiToNoteName(midi: number): string {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const pitch = CHROMATIC_SCALE[clamped % 12];
  const octave = Math.floor(clamped / 12) - 1;
  return `${pitch}${octave}`;
}

/**
 * Converts MIDI note number to fundamental frequency in Hz (A4 = 440 Hz).
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Converts fundamental frequency to exact fractional MIDI note number.
 */
export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

// ─── Standard & Traditional Instrument Presets ───────────────────────────────

export const INSTRUMENT_PRESETS: RangePreset[] = [
  {
    id: 'swam-cello',
    name: 'SWAM Cello / Orchestra Cello',
    farsiName: 'ویولنسل (SWAM Cello)',
    minNote: 'C2',
    maxNote: 'G5',
    minMidi: 36, // ~65.4 Hz
    maxMidi: 79, // ~784.0 Hz
    description: 'Physical Modeling Cello register (Open C2 string to 7th position G5)',
  },
  {
    id: 'violin',
    name: 'Violin',
    farsiName: 'ویولن (Violin)',
    minNote: 'G3',
    maxNote: 'E7',
    minMidi: 55, // 196.0 Hz
    maxMidi: 100, // 2637.0 Hz
    description: 'Classical Violin register (Open G3 string to high E7 register)',
  },
  {
    id: 'viola',
    name: 'Viola / Alto',
    farsiName: 'ویولا / آلتو (Viola)',
    minNote: 'C3',
    maxNote: 'A6',
    minMidi: 48, // 130.8 Hz
    maxMidi: 93, // 1760.0 Hz
    description: 'Warm tenor/alto orchestral string register (C3 to A6)',
  },
  {
    id: 'contrabass',
    name: 'Double Bass / Contrabass',
    farsiName: 'کنترباس (Double Bass)',
    minNote: 'C1',
    maxNote: 'G3',
    minMidi: 24, // 32.7 Hz
    maxMidi: 55, // 196.0 Hz
    description: 'Deep orchestral bass register (Low C1 extension to G3)',
  },
  {
    id: 'persian-tar',
    name: 'Persian Tar',
    farsiName: 'تار ایرانی',
    minNote: 'C3',
    maxNote: 'C6',
    minMidi: 48, // 130.8 Hz
    maxMidi: 84, // 1046.5 Hz
    description: 'Persian long-necked lute register (Bam string C3 to high Dastan C6)',
  },
  {
    id: 'persian-setar',
    name: 'Setar',
    farsiName: 'سه‌تار',
    minNote: 'C3',
    maxNote: 'F5',
    minMidi: 48, // 130.8 Hz
    maxMidi: 77, // 698.5 Hz
    description: 'Intimate Persian Setar register (C3 to F5)',
  },
  {
    id: 'santur',
    name: 'Santur (9-Kharak)',
    farsiName: 'سنتور ۹ پل',
    minNote: 'E3',
    maxNote: 'F6',
    minMidi: 52, // 164.8 Hz
    maxMidi: 89, // 1396.9 Hz
    description: 'Persian hammered dulcimer (Shor/Yellow/White/Back-Kharak E3-F6)',
  },
  {
    id: 'kamancheh',
    name: 'Kamancheh',
    farsiName: 'کمانچه',
    minNote: 'D3',
    maxNote: 'D6',
    minMidi: 50, // 146.8 Hz
    maxMidi: 86, // 1174.7 Hz
    description: 'Persian spiked fiddle register (Open D3 to D6)',
  },
  {
    id: 'persian-ney',
    name: 'Ney (Haft-Band)',
    farsiName: 'نی هفت‌بند',
    minNote: 'D4',
    maxNote: 'D7',
    minMidi: 62, // 293.7 Hz
    maxMidi: 98, // 2349.3 Hz
    description: 'Persian end-blown cane flute (Ghasabeh/Shekar-Lab to high Owj)',
  },
  {
    id: 'guitar',
    name: 'Classical Guitar',
    farsiName: 'گیتار کلاسیک',
    minNote: 'E2',
    maxNote: 'B5',
    minMidi: 40, // 82.4 Hz
    maxMidi: 83, // 987.8 Hz
    description: 'Standard 6-string classical guitar range (Open low E2 to 19th fret B5)',
  },
  {
    id: 'piano-88',
    name: 'Full Concert Piano',
    farsiName: 'پیانو گرند ۸۸ کلاویه',
    minNote: 'A0',
    maxNote: 'C8',
    minMidi: 21, // 27.5 Hz
    maxMidi: 108, // 4186.0 Hz
    description: 'Full 88-key standard acoustic grand piano range',
  },
  {
    id: 'custom',
    name: 'Custom Range...',
    farsiName: 'محدوده سفارشی',
    minNote: 'C2',
    maxNote: 'G5',
    minMidi: 36,
    maxMidi: 79,
    description: 'User-defined minimum and maximum note boundaries',
  },
];

export const DEFAULT_RANGE_CONFIG: InstrumentRangeConfig = {
  enabled: true,
  presetId: 'swam-cello',
  minMidi: 36, // C2
  maxMidi: 79, // G5
  behavior: 'fold',
};

// ─── Range Validation & Smart Octave Folding ─────────────────────────────────

export interface RangeProcessingResult {
  frequency: number;
  midiNote: number;
  inRange: boolean;
  foldedOctaves: number; // e.g. +1 if folded up an octave, -1 if folded down
}

/**
 * Checks if a given frequency falls within the configured MIDI range.
 */
export function isFrequencyInRange(freq: number, minMidi: number, maxMidi: number): boolean {
  const midi = frequencyToMidi(freq);
  // Allow slight microtonal tolerance (0.4 semitone) at the boundaries
  return midi >= minMidi - 0.4 && midi <= maxMidi + 0.4;
}

/**
 * Transposes a frequency by octaves (±12 semitones) so it sits comfortably within [minMidi, maxMidi].
 * Preserves exact Just Intonation cents offset and microtonal micro-intervals!
 */
export function foldFrequencyToRange(
  freq: number,
  minMidi: number,
  maxMidi: number,
): RangeProcessingResult {
  let currentFreq = freq;
  let currentMidi = frequencyToMidi(currentFreq);
  let octaves = 0;

  // If already in range, return as-is
  if (currentMidi >= minMidi - 0.4 && currentMidi <= maxMidi + 0.4) {
    return {
      frequency: currentFreq,
      midiNote: Math.round(currentMidi),
      inRange: true,
      foldedOctaves: 0,
    };
  }

  // Fold up if too low
  while (currentMidi < minMidi - 0.4 && octaves < 5) {
    currentFreq *= 2;
    currentMidi += 12;
    octaves += 1;
  }

  // Fold down if too high
  while (currentMidi > maxMidi + 0.4 && octaves > -5) {
    currentFreq /= 2;
    currentMidi -= 12;
    octaves -= 1;
  }

  // Check if final note is within range
  const inRange = currentMidi >= minMidi - 0.5 && currentMidi <= maxMidi + 0.5;

  return {
    frequency: currentFreq,
    midiNote: Math.max(0, Math.min(127, Math.round(currentMidi))),
    inRange,
    foldedOctaves: octaves,
  };
}

/**
 * Computes optimal ring scaling (baseFrequency and scalingFactor k)
 * to distribute N concentric rings strictly across [minMidi, maxMidi].
 */
export function computeAutoFitRangeParameters(
  minMidi: number,
  maxMidi: number,
  levels: number,
): { baseFrequency: number; scalingFactor: number } {
  const minFreq = midiToFrequency(minMidi);
  const maxFreq = midiToFrequency(maxMidi);

  // If single level, base is minFreq
  if (levels <= 1) {
    return { baseFrequency: minFreq, scalingFactor: -1 };
  }

  // Ratio from highest register to lowest register
  const totalRatio = maxFreq / minFreq;
  // Step multiplier per concentric level: r^(levels - 1) = totalRatio
  const stepRatio = Math.pow(totalRatio, 1 / (levels - 1));

  // In our engine, scalingFactor k relates frequency by f = baseFreq * (1/k)^n
  // Therefore k = 1 / stepRatio
  const k = Math.max(0.4, Math.min(0.95, 1 / stepRatio));

  return {
    baseFrequency: minFreq,
    scalingFactor: k,
  };
}
