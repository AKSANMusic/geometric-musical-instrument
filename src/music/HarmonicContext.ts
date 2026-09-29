/**
 * HarmonicContext.ts — Tonal Center, Modal Framework, and Stability Scoring
 *
 * Provides musical scales, stability metrics, and harmonic tension tracking
 * for Western Just Intonation, Equal Temperament, and Persian Dastgah modes (Shur, Homayoun, Chahargah).
 */

import type { ScaleContext } from '../mapping/PitchMapper';

export interface ScaleDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: 'pentatonic' | 'heptatonic' | 'microtonal' | 'chromatic';
  readonly ratios: readonly number[];        // Frequency ratios from 1/1 tonic
  readonly stabilities: readonly number[];   // Stability rating [0, 1] per degree
  readonly degreeNames: readonly string[];
  readonly description: string;
}

// ─── Standard Presets ─────────────────────────────────────────────────────────

export const BUILTIN_SCALES: Record<string, ScaleDefinition> = {
  majorPentatonic: {
    id: 'majorPentatonic',
    name: 'Major Pentatonic (JI)',
    category: 'pentatonic',
    ratios: [1.0, 9 / 8, 5 / 4, 3 / 2, 5 / 3],
    stabilities: [1.0, 0.6, 0.85, 0.95, 0.7],
    degreeNames: ['1 (Root)', '2 (Maj 2nd)', '3 (Maj 3rd)', '5 (Perf 5th)', '6 (Maj 6th)'],
    description: 'Ancient, consonant 5-tone Just Intonation scale.',
  },

  minorPentatonic: {
    id: 'minorPentatonic',
    name: 'Minor Pentatonic (JI)',
    category: 'pentatonic',
    ratios: [1.0, 6 / 5, 4 / 3, 3 / 2, 9 / 5],
    stabilities: [1.0, 0.75, 0.7, 0.95, 0.65],
    degreeNames: ['1 (Root)', 'b3 (Min 3rd)', '4 (Perf 4th)', '5 (Perf 5th)', 'b7 (Min 7th)'],
    description: 'Blues/folk minor pentatonic with pure intervals.',
  },

  shur: {
    id: 'shur',
    name: 'Dastgāh-e Šur (Dastgah Shur)',
    category: 'microtonal',
    // Ratios with Koron (neutral second ~150 cents: 12/11 or 13/12):
    // 1/1 (Tonic), 12/11 (Koron 2nd), 4/3 (4th), 3/2 (5th), 5/3 (6th), 16/9 (Min 7th)
    ratios: [1.0, 12 / 11, 4 / 3, 3 / 2, 5 / 3, 16 / 9],
    stabilities: [1.0, 0.45, 0.75, 0.9, 0.6, 0.5],
    degreeNames: ['Tonic (Pillar)', 'Koron (Shahid / expressive neutral)', '4th (Ist / Pause)', '5th', '6th', '7th'],
    description: 'The mother of Persian dastgahs featuring expressive neutral Koron intervals.',
  },

  homayoun: {
    id: 'homayoun',
    name: 'Dastgāh-e Homāyun',
    category: 'microtonal',
    // 1/1, 16/15 (Minor 2nd), 5/4 (Major 3rd), 4/3 (4th), 3/2 (5th), 8/5 (Minor 6th), 15/8 (Major 7th)
    ratios: [1.0, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 15 / 8],
    stabilities: [1.0, 0.4, 0.8, 0.7, 0.9, 0.5, 0.35],
    degreeNames: ['Tonic', 'Min 2nd', 'Maj 3rd', '4th', '5th', 'Min 6th', 'Maj 7th'],
    description: 'Solemn, contemplative Persian mode with distinctive augmented intervals.',
  },

  chahargah: {
    id: 'chahargah',
    name: 'Dastgāh-e Chahārgāh',
    category: 'microtonal',
    // Double harmonic major scale structure: 1, 16/15, 5/4, 4/3, 3/2, 8/5, 15/8
    ratios: [1.0, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 15 / 8],
    stabilities: [1.0, 0.4, 0.85, 0.65, 0.9, 0.5, 0.35],
    degreeNames: ['Tonic', 'Koron/b2', 'Maj 3rd', '4th', '5th', 'Koron/b6', 'Maj 7th'],
    description: 'Heroic and energetic Persian dastgah with iconic resonant microtonality.',
  },

  equalTemperament12: {
    id: 'equalTemperament12',
    name: '12-Tone Equal Temperament',
    category: 'chromatic',
    ratios: Array.from({ length: 12 }, (_, i) => Math.pow(2, i / 12)),
    stabilities: [1.0, 0.2, 0.5, 0.3, 0.7, 0.6, 0.25, 0.9, 0.3, 0.65, 0.35, 0.4],
    degreeNames: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    description: 'Standard 12-TET chromatic scale.',
  },
};

const NOTE_ROOT_FREQUENCIES: Record<string, number> = {
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33,
};

export class HarmonicContext {
  private tonicFreqHz: number;
  private currentScale: ScaleDefinition;
  private customRatios: number[] | null = null;
  private customStabilities: number[] | null = null;

  constructor(root = 'D4', scaleId = 'shur') {
    this.tonicFreqHz = NOTE_ROOT_FREQUENCIES[root] ?? 293.66; // D4 default
    this.currentScale = BUILTIN_SCALES[scaleId] ?? BUILTIN_SCALES.majorPentatonic;
  }

  public setRoot(rootNote: string): void {
    if (NOTE_ROOT_FREQUENCIES[rootNote]) {
      this.tonicFreqHz = NOTE_ROOT_FREQUENCIES[rootNote];
    } else {
      // Direct numeric frequency check or fallback
      const parsed = parseFloat(rootNote);
      if (!isNaN(parsed) && parsed > 20 && parsed < 5000) {
        this.tonicFreqHz = parsed;
      }
    }
  }

  public setTonicFrequency(freqHz: number): void {
    if (freqHz > 20 && freqHz < 5000) {
      this.tonicFreqHz = freqHz;
    }
  }

  public getTonicFrequency(): number {
    return this.tonicFreqHz;
  }

  public setScale(scaleId: string): void {
    if (BUILTIN_SCALES[scaleId]) {
      this.currentScale = BUILTIN_SCALES[scaleId];
      this.customRatios = null;
      this.customStabilities = null;
    }
  }

  public setCustomScale(
    ratios: readonly number[],
    stabilities?: readonly number[],
    name = 'Custom Scala Scale',
  ): void {
    this.customRatios = [...ratios];
    this.customStabilities = stabilities
      ? [...stabilities]
      : ratios.map((r, i) => (i === 0 ? 1.0 : i === Math.floor(ratios.length / 2) ? 0.85 : 0.5));
    this.currentScale = {
      id: 'custom',
      name,
      category: 'microtonal',
      ratios: this.customRatios,
      stabilities: this.customStabilities,
      degreeNames: ratios.map((_, i) => `Degree ${i + 1}`),
      description: 'User-loaded microtonal scale',
    };
  }

  public getScaleDefinition(): ScaleDefinition {
    return this.currentScale;
  }

  /**
   * Return ScaleContext compatible with PitchMapper.
   */
  public toScaleContext(): ScaleContext {
    return {
      tonicFreqHz: this.tonicFreqHz,
      ratios: this.currentScale.ratios,
      stabilities: this.currentScale.stabilities,
      degreeNames: this.currentScale.degreeNames,
    };
  }

  /**
   * Calculate stability of a given frequency against the current harmonic framework.
   * Returns [0, 1] where 1.0 is pure tonic octave/unison.
   */
  public evaluateStability(freqHz: number): number {
    if (freqHz <= 0) return 0;
    const ratio = freqHz / this.tonicFreqHz;
    const octaveNorm = ratio / Math.pow(2, Math.floor(Math.log2(ratio)));

    // Find nearest degree in current scale
    let bestDist = Infinity;
    let bestDegree = 0;
    for (let i = 0; i < this.currentScale.ratios.length; i++) {
      const r = this.currentScale.ratios[i];
      const dist = Math.abs(Math.log2(octaveNorm / r));
      if (dist < bestDist) {
        bestDist = dist;
        bestDegree = i;
      }
    }

    const baseStability = this.currentScale.stabilities[bestDegree] ?? 0.5;
    // Detuning penalty: if frequency is not an exact match for degree ratio, degrade stability
    const detuneCents = Math.abs(bestDist * 1200);
    const detunePenalty = Math.max(0, 1 - detuneCents / 50);

    return Math.max(0, Math.min(1, baseStability * (0.7 + 0.3 * detunePenalty)));
  }

  /**
   * Find closest stable pitch (Tonic or Fifth) to resolve toward during cadence.
   */
  public snapToResolution(freqHz: number): number {
    const tonic = this.tonicFreqHz;
    const fifthRatio = this.currentScale.ratios.find(r => Math.abs(r - 1.5) < 0.05) ?? 1.5;

    // Find current octave
    const ratio = freqHz / tonic;
    const octaveMultiplier = Math.pow(2, Math.round(Math.log2(Math.max(1e-5, ratio))));
    const candidateTonic = tonic * octaveMultiplier;
    const candidateFifth = tonic * fifthRatio * (octaveMultiplier > 1 ? octaveMultiplier / 2 : octaveMultiplier);

    const distToTonic = Math.abs(Math.log2(freqHz / candidateTonic));
    const distToFifth = Math.abs(Math.log2(freqHz / candidateFifth));

    return distToTonic <= distToFifth ? candidateTonic : candidateFifth;
  }
}
