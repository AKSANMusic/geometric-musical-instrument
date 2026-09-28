/**
 * pitch-engine.ts — Canonical Pitch Representation & Conversion Engine
 *
 * Every pitch in the system carries a complete PitchDescriptor that includes:
 * - Exact frequency in Hz (authoritative)
 * - Nearest 12-TET MIDI note number
 * - Fractional MIDI number for continuous pitch
 * - Cent deviation from nearest semitone
 * - JI ratio from tonic
 * - Scale degree
 * - Register (octave layer)
 * - Microtonal flag
 *
 * This module provides pure functions with no audio/UI/MIDI dependencies.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PitchDescriptor {
  readonly frequency: number;        // Exact Hz (authoritative)
  readonly midiNote: number;         // Nearest 12-TET integer [0, 127]
  readonly fractionalMidi: number;   // Continuous MIDI number (e.g. 69.5)
  readonly centsOffset: number;      // Deviation from midiNote in cents [-50, +50]
  readonly scaleDegree: number;      // 0-indexed position in current scale
  readonly register: number;         // Octave offset from tonic
  readonly label: string;            // Human-readable name (e.g. "A4 +7¢")
  readonly isMicrotonal: boolean;    // |centsOffset| >= 20
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHROMATIC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// ─── Core Conversion Functions ───────────────────────────────────────────────

/**
 * Convert frequency in Hz to exact (fractional) MIDI note number.
 * A4 = 440 Hz = MIDI 69.
 */
export function frequencyToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Convert MIDI note number to frequency in Hz.
 * A4 = MIDI 69 = 440 Hz.
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert a MIDI note number to its chromatic note name with octave.
 * E.g. 69 → "A4", 60 → "C4"
 */
export function midiToNoteName(midi: number): string {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const note = CHROMATIC_NAMES[((clamped % 12) + 12) % 12];
  const octave = Math.floor(clamped / 12) - 1;
  return `${note}${octave}`;
}

/**
 * Calculate the cent offset between a frequency and its nearest 12-TET MIDI note.
 * Returns value in [-50, +50] cents.
 */
export function frequencyToCents(freq: number): number {
  const exactMidi = frequencyToMidi(freq);
  const nearestMidi = Math.round(exactMidi);
  return Math.round((exactMidi - nearestMidi) * 100);
}

/**
 * Compute pitch bend values (14-bit) for a given frequency against a base MIDI note.
 * @param targetFreq - Exact target frequency in Hz
 * @param baseMidi - Base MIDI note number (nearest 12-TET)
 * @param bendRangeSemitones - Pitch bend range in semitones (default ±2)
 * @returns 14-bit pitch bend value, LSB, MSB, and cents offset
 */
export function calculatePitchBend(
  targetFreq: number,
  baseMidi: number,
  bendRangeSemitones: number = 2,
): { bend14: number; lsb: number; msb: number; cents: number } {
  const exactMidi = frequencyToMidi(targetFreq);
  const centsOffset = (exactMidi - baseMidi) * 100;
  const bendRange = bendRangeSemitones * 100; // range in cents
  const clampedCents = Math.max(-bendRange, Math.min(bendRange, centsOffset));
  const normalizedBend = Math.round(8192 + (clampedCents / bendRange) * 8191);
  const bend14 = Math.max(0, Math.min(16383, normalizedBend));

  return {
    bend14,
    lsb: bend14 & 0x7f,
    msb: (bend14 >> 7) & 0x7f,
    cents: centsOffset,
  };
}

/**
 * Build a full PitchDescriptor from a frequency, tonic, and scale context.
 */
export function buildPitchDescriptor(
  freq: number,
  tonicFreq: number = 440,
  scaleRatios: readonly number[] = [1],
  scaleDegreeHint: number = 0,
): PitchDescriptor {
  const exactMidi = frequencyToMidi(freq);
  const baseMidi = Math.round(exactMidi);
  const clampedMidi = Math.max(0, Math.min(127, baseMidi));
  const centsOffset = Math.round((exactMidi - baseMidi) * 100);
  const isMicrotonal = Math.abs(centsOffset) >= 20;

  // Register relative to tonic
  const ratio = freq / tonicFreq;
  const register = ratio > 0 ? Math.floor(Math.log2(ratio)) : 0;

  // Find closest scale degree
  let bestDegree = scaleDegreeHint;
  if (scaleRatios.length > 1) {
    let bestDist = Infinity;
    const octaveNormRatio = ratio / Math.pow(2, register);
    for (let i = 0; i < scaleRatios.length; i++) {
      const dist = Math.abs(Math.log2(octaveNormRatio / scaleRatios[i]));
      if (dist < bestDist) {
        bestDist = dist;
        bestDegree = i;
      }
    }
  }

  // Label
  const noteName = midiToNoteName(clampedMidi);
  let label = noteName;
  if (isMicrotonal) {
    label += ` ${centsOffset > 0 ? '+' : ''}${centsOffset}¢`;
  }

  return {
    frequency: freq,
    midiNote: clampedMidi,
    fractionalMidi: exactMidi,
    centsOffset,
    scaleDegree: bestDegree,
    register,
    label,
    isMicrotonal,
  };
}
