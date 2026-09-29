/**
 * RingModel.ts — Musical Interpretation Strategies for Concentric Rings
 *
 * Implements:
 * - Octaves: Inner rings represent successive octave transpositions (f * 2^level).
 * - Harmonics: Inner rings represent natural harmonic partial series (1f, 2f, 3f, 4f, 5f, 6f...).
 * - ChordTones: Inner rings distribute root, 3rd, 5th, 7th, and 9th chord components.
 * - Echoes: Inner rings are softer, delayed acoustic reflections of outer strikes.
 * - Counterpoint: Different rings act as independent polyphonic voices.
 */

import type { RingStrategy } from '../domain/project-state';

export interface RingMusicalBehavior {
  readonly level: number;
  readonly frequencyMultiplier: number;
  readonly defaultVelocityScale: number;
  readonly delayOffsetSeconds: number;
  readonly roleHint: 'lead' | 'harmony' | 'bass' | 'echo';
}

export class RingModel {
  public static getBehavior(strategy: RingStrategy, level: number, totalLevels = 6): RingMusicalBehavior {
    switch (strategy) {
      case 'harmonics':
        // Natural harmonic series: partial n = level + 1
        return {
          level,
          frequencyMultiplier: level + 1,
          defaultVelocityScale: Math.max(0.3, 1.0 - level * 0.12),
          delayOffsetSeconds: 0,
          roleHint: level === 0 ? 'bass' : 'harmony',
        };

      case 'chordTones':
        // Root (1), Third (5/4), Fifth (3/2), Seventh (9/5), Octave (2), Ninth (9/4)
        const chordRatios = [1.0, 5 / 4, 3 / 2, 9 / 5, 2.0, 9 / 4, 5 / 2, 3.0];
        const ratio = chordRatios[level % chordRatios.length] * Math.pow(2, Math.floor(level / chordRatios.length));
        return {
          level,
          frequencyMultiplier: ratio,
          defaultVelocityScale: Math.max(0.4, 0.95 - level * 0.08),
          delayOffsetSeconds: 0,
          roleHint: level === 0 ? 'bass' : 'harmony',
        };

      case 'echoes':
        // Softer, delayed reflections of outer rings
        return {
          level,
          frequencyMultiplier: Math.pow(2, Math.floor(level / 2)),
          defaultVelocityScale: Math.pow(0.65, level),
          delayOffsetSeconds: level * 0.085, // Cascading delay
          roleHint: level === 0 ? 'lead' : 'echo',
        };

      case 'counterpoint':
        // Independent melodic tessituras
        const voiceMultipliers = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0];
        return {
          level,
          frequencyMultiplier: voiceMultipliers[level % voiceMultipliers.length],
          defaultVelocityScale: 0.85,
          delayOffsetSeconds: 0,
          roleHint: level % 2 === 0 ? 'lead' : 'harmony',
        };

      case 'octaves':
      default:
        // Classic octave transposition: each ring doubles frequency
        return {
          level,
          frequencyMultiplier: Math.pow(2, level),
          defaultVelocityScale: Math.max(0.45, 1.0 - level * 0.06),
          delayOffsetSeconds: 0,
          roleHint: level === 0 ? 'bass' : level <= 2 ? 'harmony' : 'lead',
        };
    }
  }
}
